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
      <div className="min-h-screen bg-[#0c2340] flex items-center justify-center text-[#8c6f66] text-sm tracking-wide">
        Loading workspace...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c2340] text-slate-100 flex flex-col font-sans selection:bg-[#4292c6] selection:text-slate-900">
      {/* Header Bar using Classic Navy & Sky Blue */}
      <header className="border-b border-[#103b6b] bg-[#0c2340]/90 backdrop-blur-md px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-30">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#4292c6] shadow-sm shadow-[#4292c6]/50" />
            <h1 className="text-xl font-bold tracking-tight text-white">
              Task Workspace
            </h1>
          </div>
          <p className="text-xs text-[#8c6f66] mt-0.5 pl-5 font-mono tracking-wider uppercase">
            Next Play Sports Assessment
          </p>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#103b6b]/60 border border-[#4292c6]/30 rounded-xl px-4 py-2 text-xs text-white placeholder-[#8c6f66] focus:outline-none focus:border-[#4292c6] transition-all w-full sm:w-64"
          />
          <button
            onClick={() => {
              setEditingTask(null);
              setIsModalOpen(true);
            }}
            className="bg-[#4292c6] hover:bg-[#357ebd] text-[#0c2340] font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-[#4292c6]/20 shrink-0 tracking-wide"
          >
            + New Task
          </button>
        </div>
      </header>

      {/* Main Board Container */}
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