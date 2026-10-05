import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import ical from "npm:ical";

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const todayStr = new Date().toISOString().split("T")[0];

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, canvas_feed_url")
      .not("canvas_feed_url", "is", null);
    if (profileError) throw profileError;

    let inserted = 0;
    let updated = 0;

    for (const profile of profiles || []) {
      if (!profile.canvas_feed_url) continue;

      let icsText = "";
      try {
        const response = await fetch(profile.canvas_feed_url);
        if (!response.ok) continue;
        icsText = await response.text();
      } catch {
        continue;
      }

      // Read existing tasks AFTER the fetch to keep the race window small
      const { data: existingTasks, error: existingErr } = await supabase
        .from("tasks")
        .select("canvas_event_id, title, description, course_code, due_date, is_deleted")
        .eq("user_id", profile.id)
        .not("canvas_event_id", "is", null)
        .range(0, 9999);
      if (existingErr) continue;

      const existingMap = new Map(
        (existingTasks || []).map((t) => [t.canvas_event_id as string, t])
      );

      const parsedFeed = ical.parseICS(icsText);
      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: {
        canvas_event_id: string;
        title: string;
        description: string;
        course_code: string | null;
        due_date: string | null;
      }[] = [];

      for (const key in parsedFeed) {
        const event = parsedFeed[key];
        if (event.type !== "VEVENT") continue;

        const canvasEventId = event.uid;
        if (!canvasEventId) continue;

        const existing = existingMap.get(canvasEventId);
        if (existing?.is_deleted) continue; // user deleted it; leave it alone

        const dueDate = event.end
          ? new Date(event.end).toISOString().split("T")[0]
          : null;
        if (dueDate && dueDate < todayStr) continue;

        const rawTitle = event.summary || "Untitled Canvas Task";
        if (/^announcement:/i.test(rawTitle) || rawTitle.toLowerCase().includes("[announcement]")) {
          continue;
        }

        const courseMatch = rawTitle.match(/\[(.*?)\]/);
        const courseCode = courseMatch ? courseMatch[1] : null;
        const title = rawTitle.replace(/\s*\[.*?\]\s*/, "").trim();
        const description = event.description || "";

        if (existing) {
          // Only touch Canvas-owned metadata, and only if it changed
          const changed =
            existing.title !== title ||
            (existing.description ?? "") !== description ||
            existing.course_code !== courseCode ||
            existing.due_date !== dueDate;
          if (changed) {
            toUpdate.push({ canvas_event_id: canvasEventId, title, description, course_code: courseCode, due_date: dueDate });
          }
        } else {
          toInsert.push({
            user_id: profile.id,
            canvas_event_id: canvasEventId,
            title,
            description,
            course_code: courseCode,
            due_date: dueDate,
            status: "todo",
            priority: "normal",
            position: 0,
            is_deleted: false,
          });
        }
      }

      // New tasks only. ignoreDuplicates means that if a row appeared in the
      // meantime, it is skipped rather than overwritten.
      if (toInsert.length > 0) {
        const { error } = await supabase
          .from("tasks")
          .upsert(toInsert, { onConflict: "user_id,canvas_event_id", ignoreDuplicates: true });
        if (!error) inserted += toInsert.length;
      }

      // Existing tasks: metadata only, never status/priority/position/is_deleted
      for (const t of toUpdate) {
        const { error } = await supabase
          .from("tasks")
          .update({
            title: t.title,
            description: t.description,
            course_code: t.course_code,
            due_date: t.due_date,
          })
          .eq("user_id", profile.id)
          .eq("canvas_event_id", t.canvas_event_id)
          .eq("is_deleted", false);
        if (!error) updated++;
      }
    }

    return new Response(JSON.stringify({ success: true, inserted, updated }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});