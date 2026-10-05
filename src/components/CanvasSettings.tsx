import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CanvasSettingsProps {
  userId: string;
}

export function CanvasSettings({ userId }: CanvasSettingsProps) {
  const [feedUrl, setFeedUrl] = useState('');
  const [status, setStatus] = useState('');

  // Fetch initial canvas feed URL if already saved
  useEffect(() => {
    async function fetchFeedUrl() {
      const { data, error } = await supabase
        .from('profiles')
        .select('canvas_feed_url')
        .eq('id', userId)
        .single();

      if (!error && data?.canvas_feed_url) {
        setFeedUrl(data.canvas_feed_url);
      }
    }

    if (userId) fetchFeedUrl();
  }, [userId]);

  async function handleSave() {
    setStatus('Saving...');
    const { error } = await supabase
      .from('profiles')
      .update({ canvas_feed_url: feedUrl })
      .eq('id', userId);

    if (error) {
      setStatus('Error saving URL: ' + error.message);
    } else {
      setStatus('Saved! Tasks will sync automatically every 2 hours.');
    }
  }

  return (
    <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 max-w-md shadow-lg">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">
        Canvas Calendar Sync
      </h3>
      <p className="text-xs text-slate-400 mb-3">
        Paste your Canvas iCal feed URL once to keep your board updated automatically.
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://canvas.instructure.com/feeds/calendars/..."
          value={feedUrl}
          onChange={(e) => setFeedUrl(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-700 text-xs text-slate-100 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleSave}
          className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-medium px-4 py-2 rounded-lg transition"
        >
          Save
        </button>
      </div>
      {status && <p className="text-xs text-indigo-400 mt-2.5">{status}</p>}
    </div>
  );
}