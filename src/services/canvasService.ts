import { supabase, getOrCreateGuestUser } from '../lib/supabase';
import { getLocalDateString } from '../utils/dateUtils';
import type { Task, TaskStatus, TaskPriority } from '../types/task';

export const syncCanvasTasks = async (): Promise<Task[] | null> => {
  try {
    const user = await getOrCreateGuestUser();
    if (!user) return null;

    let savedUrl: string | null = localStorage.getItem('canvas_ical_url');

    if (!savedUrl) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('canvas_ical_url')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.canvas_ical_url) {
        savedUrl = profile.canvas_ical_url;
        localStorage.setItem('canvas_ical_url', savedUrl || '');
      }
    }

    if (typeof savedUrl !== 'string' || !savedUrl.trim()) return null;

    let targetUrl = savedUrl.trim();
    if (targetUrl.startsWith('webcal://')) {
      targetUrl = targetUrl.replace('webcal://', 'https://');
    }

    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    ];

    let icsData = '';
    for (const proxy of proxies) {
      try {
        const res = await fetch(proxy);
        if (res.ok) {
          const text = await res.text();
          if (text.includes('BEGIN:VCALENDAR') || text.includes('BEGIN:VEVENT')) {
            icsData = text;
            break;
          }
        }
      } catch {
        // Fall through to next proxy
      }
    }

    if (!icsData) return null;

    const normalized = icsData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const unfolded = normalized.replace(/\n[ \t]/g, '');
    const vevents = unfolded.split(/BEGIN:VEVENT/i).slice(1);

    // Get today's start of day (midnight) in local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const payload = [];

    for (const block of vevents) {
      const cleanBlock = block.split(/END:VEVENT/i)[0];

      const uidMatch = cleanBlock.match(/^UID:(.*)$/m);
      const canvasEventId = uidMatch ? uidMatch[1].trim() : null;

      const summaryMatch = cleanBlock.match(/^SUMMARY.*?:(.*)$/m);
      const rawSummary = summaryMatch ? summaryMatch[1].trim() : 'Canvas Assignment';

      // Skip announcements
      if (
        !rawSummary ||
        /^announcement:/i.test(rawSummary) ||
        rawSummary.toLowerCase().includes('[announcement]')
      ) {
        continue;
      }

      const dtEndMatch = cleanBlock.match(/^DTEND.*?:(\d{8}(?:T\d{6}Z?)?)/m);
      const dtStartMatch = cleanBlock.match(/^DTSTART.*?:(\d{8}(?:T\d{6}Z?)?)/m);
      const rawDateStr = dtEndMatch ? dtEndMatch[1] : dtStartMatch ? dtStartMatch[1] : null;

      let dueDateObj: Date | null = null;
      let dueDateStr = getLocalDateString();

      if (rawDateStr && rawDateStr.length >= 8) {
        const year = parseInt(rawDateStr.substring(0, 4), 10);
        const month = parseInt(rawDateStr.substring(4, 6), 10) - 1; // Month is 0-indexed
        const day = parseInt(rawDateStr.substring(6, 8), 10);
        
        dueDateObj = new Date(year, month, day);
        dueDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }

      // Skip if the parsed date is before today midnight
      if (dueDateObj && dueDateObj < today) {
        continue;
      }

      let parsedCourseCode: string | null = null;
      const courseMatch =
        rawSummary.match(/\[(.*?)\]/) ||
        rawSummary.match(/^([A-Za-z]{2,4}\s*\d{3}[A-Za-z]?):/);

      if (courseMatch) parsedCourseCode = courseMatch[1].trim();

      const cleanTitle = rawSummary
        .replace(/\[.*?\]/g, '')
        .replace(/^([A-Za-z]{2,4}\s*\d{3}[A-Za-z]?):\s*/, '')
        .trim();

      const descMatch = cleanBlock.match(/^DESCRIPTION.*?:(.*)$/m);
      const description = descMatch
        ? descMatch[1].replace(/\\n/g, '\n').replace(/\\/g, '').trim()
        : 'Imported from Canvas iCal Feed';

      if (!parsedCourseCode) {
        const descCourseMatch = description.match(/\[(.*?)\]/);
        if (descCourseMatch) parsedCourseCode = descCourseMatch[1].trim();
      }

      // Inside payload mapping:
        payload.push({
        user_id: user.id,
        title: cleanTitle || rawSummary,
        description,
        status: 'todo' as TaskStatus,
        priority: 'normal' as TaskPriority,
        due_date: dueDateStr,
        course_code: parsedCourseCode,
        canvas_event_id: canvasEventId,
        is_deleted: false,
      });
    }

    if (payload.length > 0) {
      // NOTE: Make sure your DB column name matches 'canvas_event_id'
      const { data: updatedTasks, error } = await supabase
        .from('tasks')
        .upsert(payload, { onConflict: 'canvas_event_id' })
        .select();

      if (!error && updatedTasks) {
        return updatedTasks as Task[];
      }
    }

    return null;
  } catch (err) {
    console.warn('Background Canvas Sync error:', err);
    return null;
  }
};