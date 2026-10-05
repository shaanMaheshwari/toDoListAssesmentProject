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

    const payload = [];

    for (const block of vevents) {
      const cleanBlock = block.split(/END:VEVENT/i)[0];

      const uidMatch = cleanBlock.match(/^UID:(.*)$/m);
      const canvasEventId = uidMatch ? uidMatch[1].trim() : null;

      const summaryMatch = cleanBlock.match(/^SUMMARY.*?:(.*)$/m);
      const rawSummary = summaryMatch ? summaryMatch[1].trim() : 'Canvas Assignment';

      if (
        !rawSummary ||
        /^announcement:/i.test(rawSummary) ||
        rawSummary.toLowerCase().includes('[announcement]')
      ) {
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

      const dtEndMatch = cleanBlock.match(/^DTEND.*?:(\d{8}(?:T\d{6}Z?)?)/m);
      const dtStartMatch = cleanBlock.match(/^DTSTART.*?:(\d{8}(?:T\d{6}Z?)?)/m);
      const rawDateStr = dtEndMatch ? dtEndMatch[1] : dtStartMatch ? dtStartMatch[1] : null;

      let dueDateStr = getLocalDateString();
      if (rawDateStr && rawDateStr.length >= 8) {
        const year = rawDateStr.substring(0, 4);
        const month = rawDateStr.substring(4, 6);
        const day = rawDateStr.substring(6, 8);
        dueDateStr = `${year}-${month}-${day}`;
      }

      const descMatch = cleanBlock.match(/^DESCRIPTION.*?:(.*)$/m);
      const description = descMatch
        ? descMatch[1].replace(/\\n/g, '\n').replace(/\\/g, '').trim()
        : 'Imported from Canvas iCal Feed';

      if (!parsedCourseCode) {
        const descCourseMatch = description.match(/\[(.*?)\]/);
        if (descCourseMatch) parsedCourseCode = descCourseMatch[1].trim();
      }

      payload.push({
        user_id: user.id,
        title: cleanTitle || rawSummary,
        description,
        status: 'todo' as TaskStatus,
        priority: 'normal' as TaskPriority,
        due_date: dueDateStr,
        course_code: parsedCourseCode,
        canvas_event_id: canvasEventId,
      });
    }

    if (payload.length > 0) {
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