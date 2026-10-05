import { supabase, getOrCreateGuestUser } from '../lib/supabase';
//import { Task } from '../types/task';

interface ParsedCanvasTask {
  canvas_event_id: string;
  title: string;
  description: string;
  due_date: string;
  course_code: string | null;
}

function parseICalData(icalText: string): ParsedCanvasTask[] {
  const events: ParsedCanvasTask[] = [];
  const veventBlocks = icalText.split('BEGIN:VEVENT');

  for (let i = 1; i < veventBlocks.length; i++) {
    const block = veventBlocks[i].split('END:VEVENT')[0];

    const uidMatch = block.match(/UID:(.+?)\r?\n/);
    const canvas_event_id = uidMatch ? uidMatch[1].trim() : '';

    if (!canvas_event_id) continue;

    const summaryMatch = block.match(/SUMMARY:(.+?)\r?\n/);
    let rawSummary = summaryMatch ? summaryMatch[1].trim() : 'Canvas Assignment';

    let course_code: string | null = null;
    const courseMatch = rawSummary.match(/\[(.*?)\]/);
    if (courseMatch) {
      course_code = courseMatch[1].trim();
      rawSummary = rawSummary.replace(/\[.*?\]/, '').trim();
    }

    const descMatch = block.match(/DESCRIPTION:(.+?)\r?\n/);
    const description = descMatch ? descMatch[1].trim().replace(/\\n/g, '\n') : '';

    const dtMatch =
      block.match(/DTEND(?:;VALUE=DATE)?:([0-9T]+Z?)/) ||
      block.match(/DTSTART(?:;VALUE=DATE)?:([0-9T]+Z?)/);
    let due_date = new Date().toISOString().split('T')[0];

    if (dtMatch) {
      const rawDt = dtMatch[1];
      if (rawDt.length >= 8) {
        due_date = `${rawDt.substring(0, 4)}-${rawDt.substring(4, 6)}-${rawDt.substring(6, 8)}`;
      }
    }

    events.push({
      canvas_event_id,
      title: rawSummary,
      description,
      due_date,
      course_code,
    });
  }

  return events;
}

export async function syncCanvasTasks(): Promise<void> {
  const user = await getOrCreateGuestUser();
  if (!user) return;

  const feedUrl = localStorage.getItem('canvas_ical_url');
  if (!feedUrl) return;

  try {
    const response = await fetch(feedUrl);
    if (!response.ok) throw new Error(`Failed to fetch feed: ${response.statusText}`);

    const icalText = await response.text();
    const parsedEvents = parseICalData(icalText);

    if (parsedEvents.length === 0) return;

    // Direct upsert on canvas_event_id
    const payload = parsedEvents.map((event) => ({
      user_id: user.id,
      canvas_event_id: event.canvas_event_id,
      title: event.title,
      description: event.description,
      due_date: event.due_date,
      course_code: event.course_code,
      status: 'todo',
      priority: 'normal',
      position: 0,
      is_deleted: false,
    }));

    const { error } = await supabase.from('tasks').upsert(payload, {
      onConflict: 'canvas_event_id',
      ignoreDuplicates: true,
    });

    if (error) console.error('Error syncing Canvas tasks:', error);
  } catch (err) {
    console.error('Canvas sync exception:', err);
  }
}