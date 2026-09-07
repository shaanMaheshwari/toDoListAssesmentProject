import React, { useState } from 'react';
import { supabase, getOrCreateGuestUser } from '../lib/supabase';
import type { Task, TaskStatus } from '../types/task';

interface CanvasSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTasksImported: (importedTasks: Task[]) => void;
}

interface ParsedCanvasEvent {
  summary: string;
  description: string;
  dueDateStr: string;
  courseCode: string | null;
}

export const CanvasSyncModal: React.FC<CanvasSyncModalProps> = ({
  isOpen,
  onClose,
  onTasksImported,
}) => {
  const [importTab, setImportTab] = useState<'url' | 'raw'>('raw');
  const [icalUrl, setIcalUrl] = useState<string>('');
  const [rawIcsText, setRawIcsText] = useState<string>('');
  const [syncing, setSyncing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const fetchIcalData = async (targetUrl: string): Promise<string> => {
    let formattedUrl = targetUrl.trim();
    if (formattedUrl.startsWith('webcal://')) {
      formattedUrl = formattedUrl.replace('webcal://', 'https://');
    }

    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(formattedUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(formattedUrl)}`,
    ];

    for (const proxy of proxies) {
      try {
        const response = await fetch(proxy);
        if (response.ok) {
          const text = await response.text();
          if (text.includes('BEGIN:VCALENDAR') || text.includes('BEGIN:VEVENT')) {
            return text;
          }
        }
      } catch {
        // Continue to next proxy
      }
    }

    throw new Error(
      'Canvas blocked proxy access. Please use the "Paste iCal Code" tab to import directly.'
    );
  };

  const parseCanvasIcalText = (icsData: string): ParsedCanvasEvent[] => {
    // Standardize line endings and unfold multi-line iCal properties (RFC 5545)
    const normalizedText = icsData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const unfoldedText = normalizedText.replace(/\n[ \t]/g, '');

    // Extract all VEVENT blocks
    const vevents = unfoldedText.split(/BEGIN:VEVENT/i).slice(1);
    const events: ParsedCanvasEvent[] = [];

    for (const veventBlock of vevents) {
      const cleanBlock = veventBlock.split(/END:VEVENT/i)[0];

      // Extract SUMMARY
      const summaryMatch = cleanBlock.match(/^SUMMARY.*?:(.*)$/m);
      const rawSummary = summaryMatch ? summaryMatch[1].trim() : 'Canvas Assignment';

      // Parse Course Code from Canvas bracket format: "Assignment Name [CMSC330]"
      const courseMatch = rawSummary.match(/\[(.*?)\]/);
      const courseCode = courseMatch ? courseMatch[1] : null;
      const cleanTitle = rawSummary.replace(/\[.*?\]/, '').trim();

      // Extract DTEND or DTSTART for Due Date
      const dtEndMatch = cleanBlock.match(/^DTEND.*?:(\d{8}(?:T\d{6}Z?)?)/m);
      const dtStartMatch = cleanBlock.match(/^DTSTART.*?:(\d{8}(?:T\d{6}Z?)?)/m);
      const rawDateStr = dtEndMatch ? dtEndMatch[1] : dtStartMatch ? dtStartMatch[1] : null;

      let dueDateStr = new Date().toISOString().split('T')[0];
      if (rawDateStr && rawDateStr.length >= 8) {
        const year = rawDateStr.substring(0, 4);
        const month = rawDateStr.substring(4, 6);
        const day = rawDateStr.substring(6, 8);
        dueDateStr = `${year}-${month}-${day}`;
      }

      // Extract DESCRIPTION
      const descMatch = cleanBlock.match(/^DESCRIPTION.*?:(.*)$/m);
      const description = descMatch
        ? descMatch[1].replace(/\\n/g, '\n').replace(/\\/g, '').trim()
        : 'Imported from Canvas iCal Feed';

      events.push({
        summary: cleanTitle || rawSummary,
        description,
        dueDateStr,
        courseCode,
      });
    }

    return events;
  };

  const handleSync = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSyncing(true);
    setErrorMsg(null);

    try {
        let icsData = '';

        if (importTab === 'url') {
        if (!icalUrl.trim()) throw new Error('Please enter a valid iCal URL.');
        icsData = await fetchIcalData(icalUrl);
        } else {
        if (!rawIcsText.trim()) throw new Error('Please paste your iCal calendar content.');
        icsData = rawIcsText;
        }

        const parsedEvents = parseCanvasIcalText(icsData);

        if (parsedEvents.length === 0) {
        throw new Error('No VEVENT blocks found in the pasted calendar text.');
        }

        const user = await getOrCreateGuestUser();

        // Mapping strictly to base task properties to avoid schema mismatch
        const newTasks = parsedEvents.map((evt) => ({
        user_id: user.id,
        title: evt.summary,
        description: evt.description,
        status: 'todo' as TaskStatus,
        priority: 'normal',
        due_date: new Date(evt.dueDateStr).toISOString(),
        }));

        const { data, error } = await supabase
        .from('tasks')
        .insert(newTasks)
        .select();

        if (error) {
        console.error('Supabase Insert Error:', error);
        throw new Error(`Database Error: ${error.message} (${error.details || error.hint || 'Check table schema'})`);
        }

        if (data) {
        onTasksImported(data as Task[]);
        onClose();
        }
    } catch (err: unknown) {
        console.error('Canvas iCal Sync Full Error Object:', err);

        if (typeof err === 'object' && err !== null && 'message' in err) {
            setErrorMsg((err as { message: string }).message);
        } else if (err instanceof Error) {
            setErrorMsg(err.message);
        } else {
            setErrorMsg(JSON.stringify(err));
        }
    } finally {
        setSyncing(false);
    }
    };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-2">Import Canvas Assignments</h3>

        {/* Tab Toggle */}
        <div className="flex bg-slate-800 p-1 rounded-lg mb-4">
          <button
            type="button"
            onClick={() => {
              setImportTab('url');
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
              importTab === 'url' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            URL Feed
          </button>
          <button
            type="button"
            onClick={() => {
              setImportTab('raw');
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
              importTab === 'raw' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Paste iCal Code
          </button>
        </div>

        <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => void handleSync(e)} className="flex flex-col gap-4">
          {importTab === 'url' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Canvas iCal Feed URL
              </label>
              <input
                type="url"
                required
                placeholder="https://canvas.instructure.com/feeds/calendars/..."
                value={icalUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIcalUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Raw .ics Calendar Text
              </label>
              <textarea
                rows={6}
                required
                placeholder="Paste the raw calendar text here (begins with BEGIN:VCALENDAR)..."
                value={rawIcsText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRawIcsText(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800/40 p-2.5 rounded-lg leading-relaxed">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={syncing}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-xs font-semibold rounded-lg transition flex items-center gap-2"
            >
              {syncing ? 'Processing...' : 'Import Assignments'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};