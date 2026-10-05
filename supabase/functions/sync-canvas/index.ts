import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import ical from "npm:ical";

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const todayStr = new Date().toISOString().split("T")[0];

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, canvas_feed_url")
      .not("canvas_feed_url", "is", null);

    if (profileError) throw profileError;

    let totalSynced = 0;

    for (const profile of profiles || []) {
      if (!profile.canvas_feed_url) continue;

      // Select canvas_event_id instead of canvas_uid
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("canvas_event_id, status, is_deleted")
        .eq("user_id", profile.id)
        .not("canvas_event_id", "is", null);

      const existingMap = new Map<string, { status: string; is_deleted: boolean }>();
      if (existingTasks) {
        existingTasks.forEach((t) => {
          if (t.canvas_event_id) {
            existingMap.set(t.canvas_event_id, {
              status: t.status,
              is_deleted: t.is_deleted ?? false,
            });
          }
        });
      }

      let icsText = "";
      try {
        const response = await fetch(profile.canvas_feed_url);
        if (!response.ok) continue;
        icsText = await response.text();
      } catch {
        continue;
      }

      const parsedFeed = ical.parseICS(icsText);
      const payload = [];

      for (const key in parsedFeed) {
        const event = parsedFeed[key];
        if (event.type !== "VEVENT") continue;

        const canvasEventId = event.uid;
        if (!canvasEventId) continue;

        const existingRecord = existingMap.get(canvasEventId);

        if (existingRecord?.is_deleted) continue;

        const dueDate = event.end
          ? new Date(event.end).toISOString().split("T")[0]
          : null;

        if (dueDate && dueDate < todayStr) continue;

        const title = event.summary || "Untitled Canvas Task";
        if (
          !title ||
          /^announcement:/i.test(title) ||
          title.toLowerCase().includes("[announcement]")
        ) {
          continue;
        }

        const description = event.description || "";
        const courseMatch = title.match(/\[(.*?)\]/);
        const courseCode = courseMatch ? courseMatch[1] : null;

        const currentStatus = existingRecord ? existingRecord.status : "todo";

        payload.push({
          user_id: profile.id,
          canvas_event_id: canvasEventId,
          title: title.replace(/\s*\[.*?\]\s*/, "").trim(),
          description: description,
          course_code: courseCode,
          due_date: dueDate,
          status: currentStatus,
          priority: "normal",
          is_deleted: false,
        });
      }

      if (payload.length > 0) {
        const { error: upsertError } = await supabase
          .from("tasks")
          .upsert(payload, { onConflict: "canvas_event_id" });

        if (!upsertError) {
          totalSynced += payload.length;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced: totalSynced }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "An unknown error occurred";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});