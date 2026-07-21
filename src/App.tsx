import { useEffect, useState } from 'react';
import { initializeGuestAuth, supabase } from './lib/supabase';
import type { Task } from './types/task';
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

  // Fetch tasks from Supabase on mount
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

  // Handle Save (both Create and Update)
  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (taskData.id) {
      // Update existing task
      const { error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', taskData.id);

      if (!error) fetchTasks();
    } else {
      // Create new task
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;

      const { error } = await supabase
        .from('tasks')
        .insert([{ ...taskData, user_id: userId }]);

      if (!error) fetchTasks();
    }
  };

  // Handle Delete
  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  };

  // Filter tasks dynamically based on the search query
  const filteredTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 text-sm font-medium">
        Loading board...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Task Board
          </h1>
          <p className="text-xs text-slate-500">Next Play Sports Assessment</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 flex-1 sm:w-64"
          />
          <button
            onClick={() => {
              setEditingTask(null);
              setIsModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2 rounded-xl transition-all shadow-sm shrink-0"
          >
            + New Task
          </button>
        </div>
      </header>

      {/* Main Kanban Board View */}
      <main className="flex-1 p-6 overflow-x-auto">
        <Board
          tasks={filteredTasks}
          onEditTask={(task) => {
            setEditingTask(task);
            setIsModalOpen(true);
          }}
          onDeleteTask={handleDeleteTask}
        />
      </main>

      {/* Task Creation & Edit Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        initialData={editingTask}
      />
    </div>
  );
}