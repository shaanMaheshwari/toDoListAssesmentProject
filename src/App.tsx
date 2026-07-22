import { useEffect, useState } from 'react';
import { initializeGuestAuth, supabase } from './lib/supabase';
import type { Task, Status } from './types/task';
import { Board } from './components/Board';
import { TaskModal } from './components/TaskModal';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    await initializeGuestAuth();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTasks(data as Task[]);
    }
    setLoading(false);
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (taskData.id) {
      const { error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', taskData.id);
      if (!error) fetchTasks();
    } else {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;

      const { error } = await supabase
        .from('tasks')
        .insert([{ ...taskData, user_id: userId }]);
      if (!error) fetchTasks();
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: Status) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);

    if (error) {
      console.error('Failed to update status:', error);
      fetchTasks();
    }
  };

  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const filteredTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111418] flex items-center justify-center text-slate-400 text-sm tracking-wide font-sans">
        Loading workspace...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111418] text-slate-200 flex flex-col font-sans selection:bg-blue-500/30 selection:text-slate-100">
      {/* Header Bar */}
      <header className="border-b border-[#2e3640] bg-[#111418]/90 backdrop-blur-md px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-30">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <h1 className="text-lg font-semibold tracking-tight text-slate-100">
              Task Workspace
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 pl-4 font-mono tracking-wider uppercase">
            Next Play Sports Assessment
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#1a1e24] border border-[#2e3640] rounded-xl px-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all w-full sm:w-64"
          />
          <button
            onClick={() => {
              setEditingTask(null);
              setIsModalOpen(true);
            }}
            className="bg-[#3b82f6] hover:bg-blue-600 text-white font-medium text-xs px-4 py-2 rounded-xl transition-all shrink-0 tracking-wide shadow-md"
          >
            + New Task
          </button>
        </div>
      </header>

      {/* Main Board Area */}
      <main className="flex-1 p-8 overflow-x-auto">
        <Board
          tasks={filteredTasks}
          onEditTask={(task) => {
            setEditingTask(task);
            setIsModalOpen(true);
          }}
          onDeleteTask={handleDeleteTask}
          onStatusChange={handleStatusChange}
        />
      </main>

      {/* Task Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        initialData={editingTask}
      />
    </div>
  );
}