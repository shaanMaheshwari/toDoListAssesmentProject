import { supabase, getOrCreateGuestUser } from '../lib/supabase';

interface ParsedCanvasTask {
  canvas_event_id: string;
  title: string;
  description: string;
  due_date: string; // YYYY-MM-DD
  course_code: string | null;
}

// Format local Date to YYYY-MM-DD
function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Unfold multiline iCal headers
function unfoldICal(icalText: string): string {
  return icalText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

// Safely extract YYYY-MM-DD from any DTEND / DTSTART string
function extractICalDate(block: string): string | null {
  const match = block.match(/(?:DTEND|DTSTART)(?:;[^:]*)?:([0-9]{8})/i);
  if (!match || !match[1]) return null;
  const raw = match[1];
  return `${raw.substring(0, 4)}-${raw.substring(4, 6)}-${raw.substring(6, 8)}`;
}

function parseICalData(icalText: string, todayStr: string): ParsedCanvasTask[] {
  const events: ParsedCanvasTask[] = [];
  const unfoldedText = unfoldICal(icalText);
  const veventBlocks = unfoldedText.split('BEGIN:VEVENT');

  for (let i = 1; i < veventBlocks.length; i++) {
    const block = veventBlocks[i].split('END:VEVENT')[0];

    // 1. UID
    const uidMatch = block.match(/UID:(.+?)(?:\r?\n|$)/);
    const canvas_event_id = uidMatch ? uidMatch[1].trim() : '';
    if (!canvas_event_id) continue;

    // 2. Summary & Course Code
    const summaryMatch = block.match(/SUMMARY:(.+?)(?:\r?\n|$)/);
    let rawSummary = summaryMatch ? summaryMatch[1].trim() : 'Canvas Assignment';

    let course_code: string | null = null;
    const courseMatch = rawSummary.match(/\[(.*?)\]/);
    if (courseMatch) {
      course_code = courseMatch[1].trim();
      rawSummary = rawSummary.replace(/\[.*?\]/, '').trim();
    }

    // 3. Description
    const descMatch = block.match(/DESCRIPTION:(.+?)(?:\r?\n|$)/);
    const description = descMatch ? descMatch[1].trim().replace(/\\n/g, '\n') : '';

    // 4. Due Date
    const due_date = extractICalDate(block);

    // SKIP: No valid date, OR date is before today
    if (!due_date || due_date < todayStr) {
      continue;
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

    const todayStr = getTodayString();

    // STEP 1: Delete all past-due Canvas tasks in Supabase
    const { error: deleteErr } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .not('canvas_event_id', 'is', null)
      .lt('due_date', todayStr);

    if (deleteErr) console.error('Error deleting past Canvas tasks:', deleteErr);

    // STEP 2: Parse valid upcoming events
    const icalText = await response.text();
    const parsedEvents = parseICalData(icalText, todayStr);

    if (parsedEvents.length === 0) return;

    // STEP 3: Upsert upcoming tasks cleanly
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

    const { error: upsertErr } = await supabase.from('tasks').upsert(payload, {
      onConflict: 'canvas_event_id',
      ignoreDuplicates: false,
    });

    if (upsertErr) console.error('Error upserting Canvas tasks:', upsertErr);
  } catch (err) {
    console.error('Canvas sync error:', err);
  }
}