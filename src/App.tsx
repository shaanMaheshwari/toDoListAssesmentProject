import { useEffect, useState } from 'react';
import { initializeGuestAuth, supabase } from './lib/supabase';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const setupAuth = async () => {
      await initializeGuestAuth();
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
      setLoading(false);
    };
    setupAuth();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Initializing guest session...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-2 text-indigo-400">Kanban Task Board</h1>
      <p className="text-slate-400">Connected to Supabase as Guest: {userId}</p>
    </div>
  );
}