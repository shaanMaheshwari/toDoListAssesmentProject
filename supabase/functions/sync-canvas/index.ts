import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import ical from "npm:ical";

// Prefix unused HTTP request parameter with an underscore (_req)
serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service role key to bypass RLS for background sync
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch all users who have registered a Canvas feed URL
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, canvas_feed_url")
      .not("canvas_feed_url", "is", null);

    if (profileError) throw profileError;

    let totalSynced = 0;

    for (const profile of profiles || []) {
      if (!profile.canvas_feed_url) continue;

      // 2. Fetch the .ics feed directly from Canvas
      const response = await fetch(profile.canvas_feed_url);
      if (!response.ok) continue;

      const icsText = await response.text();
      const parsedFeed = ical.parseICS(icsText);

      // 3. Process each calendar event
      for (const key in parsedFeed) {
        const event = parsedFeed[key];
        if (event.type !== "VEVENT") continue;

        const canvasUid = event.uid;
        const title = event.summary || "Untitled Canvas Task";
        const description = event.description || "";

        // Extract Course Code from brackets, e.g. "Homework 1 [CMSC330]" -> "CMSC330"
        const courseMatch = title.match(/\[(.*?)\]/);
        const courseCode = courseMatch ? courseMatch[1] : null;

        // Format due date (YYYY-MM-DD)
        const dueDate = event.end
          ? new Date(event.end).toISOString().split("T")[0]
          : null;

        // 4. Upsert into database (prevents duplicate tasks)
        const { error: upsertError } = await supabase
          .from("tasks")
          .upsert(
            {
              user_id: profile.id,
              canvas_uid: canvasUid,
              title: title.replace(/\s*\[.*?\]\s*/, ""), // Strip [COURSE] from title
              description: description,
              course_code: courseCode,
              due_date: dueDate,
              status: "todo",
              priority: "normal",
            },
            { onConflict: "canvas_uid" }
          );

        if (!upsertError) totalSynced++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced: totalSynced }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: unknown) {
    // Type narrowing for unknown error object
    const errorMessage =
      err instanceof Error ? err.message : "An unknown error occurred";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});