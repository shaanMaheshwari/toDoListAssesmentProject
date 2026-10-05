import { useState } from 'react';
import { RefreshCw, Settings } from 'lucide-react';
import { useTasks } from './hooks/useTasks';
import { useTaskFilters } from './hooks/useTaskFilters';
import { getLocalDateString } from './utils/dateUtils';
import type { Task, DateFilter } from './types/task';
import { Board } from './components/Board';
import { WeeklyCalendar } from './components/WeeklyCalendar';
import { TaskModal } from './components/TaskModal';
import { CanvasSyncModal } from './components/CanvasSyncModal';
import { CanvasSettings } from './components/CanvasSettings';

export default function App() {
  const {
    tasks,
    loading,
    isSyncingCanvas,
    triggerCanvasSync,
    handleDropOnColumn,
    handleToggleTaskComplete,
    handleDeleteTask,
    handleSaveTask,
    handleTasksImported,
  } = useTasks();

  const {
    searchQuery,
    setSearchQuery,
    selectedCourse,
    setSelectedCourse,
    viewMode,
    setViewMode,
    dateFilter,
    setDateFilter,
    uniqueCourseCodes,
    filteredTasks,
    resetFilters,
  } = useTaskFilters(tasks);

  // Modal & Settings States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCanvasModalOpen, setIsCanvasModalOpen] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultDueDate, setDefaultDueDate] = useState<string>('');

  // Replace this with your actual authenticated user ID if using Supabase Auth
  const currentUserId = 'user-id-placeholder'; 

  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter((t) => t.status === 'done').length;
  const progressPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const openCreateModal = (dateStr?: string) => {
    setEditingTask(null);
    setDefaultDueDate(dateStr || getLocalDateString());
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const onSave = async (taskData: Partial<Task>, taskToEdit: Task | null) => {
    await handleSaveTask(taskData, taskToEdit);
    if (!taskToEdit) resetFilters();
  };

  const onDelete = async (taskId: string) => {
    await handleDeleteTask(taskId);
    if (editingTask?.id === taskId) closeModal();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col font-sans">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Student Task Planner</h1>
          <p className="text-xs text-slate-400">Organize coursework, assignments, and weekly schedules</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search assignments or courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-64"
          />
          <button
            onClick={() => void triggerCanvasSync()}
            disabled={isSyncingCanvas}
            title="Re-sync Canvas assignments"
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncingCanvas ? 'animate-spin text-indigo-400' : ''} />
          </button>

          {/* Toggle Canvas Feed Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Configure Canvas Feed URL"
            className={`p-2 border rounded-lg transition text-xs flex items-center gap-1.5 ${
              showSettings 
                ? 'bg-indigo-600 border-indigo-500 text-white' 
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
          >
            <Settings size={14} />
          </button>

          <button
            onClick={() => setIsCanvasModalOpen(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold text-xs rounded-lg transition"
          >
            Sync Canvas
          </button>
          <button
            onClick={() => openCreateModal()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition shadow-md shadow-indigo-950"
          >
            + Add Task
          </button>
        </div>
      </header>

      {/* Expandable Canvas Feed Settings Banner */}
      {showSettings && (
        <div className="mb-6">
          <CanvasSettings userId={currentUserId} />
        </div>
      )}

      {/* Progress Bar Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-950/80 border border-indigo-800/50 flex items-center justify-center font-bold text-indigo-300 text-sm">
            {progressPercentage}%
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Assignment Progress</h2>
            <p className="text-xs text-slate-400">
              {completedTasks} of {totalTasks} tasks completed
            </p>
          </div>
        </div>

        <div className="w-full sm:w-64 bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
          <div
            className="bg-indigo-500 h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('board')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition ${
              viewMode === 'board' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Kanban Board
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition ${
              viewMode === 'calendar' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Weekly Calendar
          </button>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Courses</option>
            {uniqueCourseCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>

          <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {(['all', 'today', 'week', 'month'] as DateFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={`px-3 py-1 text-xs font-medium capitalize rounded-md transition ${
                  dateFilter === filter ? 'bg-slate-800 text-indigo-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
            Loading tasks...
          </div>
        ) : viewMode === 'board' ? (
          <Board
            tasks={filteredTasks}
            onDropOnColumn={handleDropOnColumn}
            onEditTask={openEditModal}
            onToggleTaskComplete={handleToggleTaskComplete}
            onDeleteTask={handleDeleteTask}
          />
        ) : (
          <WeeklyCalendar
            tasks={filteredTasks}
            onToggleDone={handleToggleTaskComplete}
            onDeleteTask={handleDeleteTask}
            onTaskClick={openEditModal}
            onDayClick={openCreateModal}
          />
        )}
      </main>

      {/* Task Creation & Editing Modal */}
      <TaskModal
        isOpen={isModalOpen}
        editingTask={editingTask}
        defaultDueDate={defaultDueDate}
        onClose={closeModal}
        onSave={onSave}
        onDelete={onDelete}
      />

      {/* Canvas Manual/File Sync Modal */}
      <CanvasSyncModal
        isOpen={isCanvasModalOpen}
        onClose={() => setIsCanvasModalOpen(false)}
        onTasksImported={handleTasksImported}
      />
    </div>
  );
}