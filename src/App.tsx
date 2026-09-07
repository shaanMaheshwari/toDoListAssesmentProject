import React, { useState, useEffect } from 'react';
import { startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { supabase, getOrCreateGuestUser } from './lib/supabase';
import type { Task, ViewMode, DateFilter, TaskStatus } from './types/task';
import { WeeklyCalendar } from './components/WeeklyCalendar';
import { CanvasSyncModal } from './components/CanvasSyncModal';

const generateTempId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `temp-${Math.random().toString(36).substring(2, 9)}`;
};

const getLocalDateString = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCanvasModalOpen, setIsCanvasModalOpen] = useState<boolean>(false);

  // Form State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskDesc, setTaskDesc] = useState<string>('');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('todo');
  const [taskPriority, setTaskPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [taskDueDate, setTaskDueDate] = useState<string>('');
  const [courseCode, setCourseCode] = useState<string>('');

  const fetchTasksFromDB = async () => {
    const user = await getOrCreateGuestUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true });

    if (error) throw error;
    return data || [];
  };

  useEffect(() => {
    fetchTasksFromDB()
      .then((data) => {
        setTasks(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching tasks:', err);
        setLoading(false);
      });
  }, []);

  // Dynamically extract unique course codes from tasks
  const uniqueCourseCodes = Array.from(
    new Set(
      tasks
        .map((t) => t.course_code)
        .filter((code): code is string => Boolean(code && code.trim() !== ''))
    )
  ).sort();

  // Persist position and status updates back to Supabase
  const persistTaskPositions = async (updatedTasks: Task[]) => {
    const updates = updatedTasks.map((t, index) => ({
      id: t.id,
      user_id: t.user_id,
      title: t.title,
      status: t.status,
      position: index,
    }));

    const { error } = await supabase
      .from('tasks')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      console.error('Failed to sync reordered positions:', error);
    }
  };

  const handleDropOnColumn = async (e: React.DragEvent, targetStatus: TaskStatus, targetTaskId?: string) => {
    e.preventDefault();
    const draggedTaskId = e.dataTransfer.getData('text/plain');
    if (!draggedTaskId) return;

    const draggedTask = tasks.find((t) => t.id === draggedTaskId);
    if (!draggedTask) return;

    const targetColumnTasks = tasks.filter(
      (t) => t.status === targetStatus && t.id !== draggedTaskId
    );

    let insertIndex = targetColumnTasks.length;
    if (targetTaskId) {
      const idx = targetColumnTasks.findIndex((t) => t.id === targetTaskId);
      if (idx !== -1) insertIndex = idx;
    }

    const updatedDraggedTask = { ...draggedTask, status: targetStatus };
    targetColumnTasks.splice(insertIndex, 0, updatedDraggedTask);

    const otherTasks = tasks.filter((t) => t.status !== targetStatus && t.id !== draggedTaskId);
    const newTasksState = [...otherTasks, ...targetColumnTasks];

    setTasks(newTasksState);
    await persistTaskPositions(targetColumnTasks);
  };

  const handleToggleTaskComplete = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();

    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id);

    if (error) {
      console.error('Failed to toggle task status:', error);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const user = await getOrCreateGuestUser();
    const finalDueDate = taskDueDate || getLocalDateString();

    if (editingTask) {
      const updatedTask: Partial<Task> = {
        title: taskTitle,
        description: taskDesc,
        status: taskStatus,
        priority: taskPriority,
        due_date: finalDueDate,
        course_code: courseCode || null,
      };

      setTasks((prev) =>
        prev.map((t) => (t.id === editingTask.id ? ({ ...t, ...updatedTask } as Task) : t))
      );

      await supabase.from('tasks').update(updatedTask).eq('id', editingTask.id);
    } else {
      const tempId = generateTempId();
      const statusTasks = tasks.filter((t) => t.status === taskStatus);

      const newTaskObj: Task = {
        id: tempId,
        user_id: user.id,
        title: taskTitle,
        description: taskDesc,
        status: taskStatus,
        priority: taskPriority,
        due_date: finalDueDate,
        course_code: courseCode || null,
        position: statusTasks.length,
        created_at: new Date().toISOString(),
      };

      setDateFilter('all');
      setSelectedCourse('all');
      setSearchQuery('');
      setTasks((prev) => [...prev, newTaskObj]);

      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          user_id: user.id,
          title: taskTitle,
          description: taskDesc,
          status: taskStatus,
          priority: taskPriority,
          due_date: finalDueDate,
          course_code: courseCode || null,
          position: statusTasks.length,
        }])
        .select();

      if (error) {
        console.error('Error inserting task into Supabase:', error);
      } else if (data && data.length > 0) {
        setTasks((prev) => prev.map((t) => (t.id === tempId ? data[0] : t)));
      }
    }

    closeModal();
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await supabase.from('tasks').delete().eq('id', taskId);
    closeModal();
  };

  const openCreateModal = (defaultDate?: string) => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskStatus('todo');
    setTaskPriority('normal');
    setTaskDueDate(defaultDate || getLocalDateString());
    setCourseCode('');
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDesc(task.description || '');
    setTaskStatus(task.status);
    setTaskPriority(task.priority);
    setTaskDueDate(task.due_date || getLocalDateString());
    setCourseCode(task.course_code || '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const filteredTasks = tasks.filter((task) => {
    if (!task) return false;

    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.course_code && task.course_code.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedCourse !== 'all') {
      if (!task.course_code || task.course_code.toUpperCase() !== selectedCourse.toUpperCase()) {
        return false;
      }
    }

    if (dateFilter === 'all' || !task.due_date) return true;

    const cleanDateStr = task.due_date.includes('T') ? task.due_date : `${task.due_date}T00:00:00`;
    const due = parseISO(cleanDateStr);
    const now = new Date();

    if (dateFilter === 'today') return isSameDay(due, now);
    if (dateFilter === 'week') {
      const weekStart = startOfWeek(now, { weekStartsOn: 0 });
      const weekEnd = addDays(weekStart, 6);
      return due >= weekStart && due <= weekEnd;
    }
    if (dateFilter === 'month') {
      return due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear();
    }

    return true;
  });

  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter((t) => t.status === 'done').length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

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

      {/* Progress Bar Header */}
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
        {/* View Mode Toggle */}
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
          {/* Course Code Filter Dropdown */}
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

          {/* Date Range Filters */}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[calc(100vh-320px)]">
            {(['todo', 'in_progress', 'in_review', 'done'] as TaskStatus[]).map((status) => {
              const statusTasks = filteredTasks.filter((t) => t.status === status);

              return (
                <div
                  key={status}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnColumn(e, status)}
                  className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {status.replace('_', ' ')}
                    </h3>
                    <span className="text-xs font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                      {statusTasks.length}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
                    {statusTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                        onDrop={(e) => {
                          e.stopPropagation();
                          handleDropOnColumn(e, status, task.id);
                        }}
                        onClick={() => openEditModal(task)}
                        className={`bg-slate-800 border p-3.5 rounded-lg cursor-grab active:cursor-grabbing transition group shadow-sm ${
                          task.status === 'done'
                            ? 'border-slate-800 opacity-60'
                            : 'border-slate-700/80 hover:border-indigo-500/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <button
                            onClick={(e) => handleToggleTaskComplete(e, task)}
                            className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                              task.status === 'done'
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-600 hover:border-indigo-400 bg-slate-900/50'
                            }`}
                          >
                            {task.status === 'done' && (
                              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 20 20">
                                <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                              </svg>
                            )}
                          </button>

                          {task.course_code && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800/50 rounded inline-block">
                              {task.course_code}
                            </span>
                          )}
                        </div>

                        <h4
                          className={`text-sm font-semibold transition-colors ${
                            task.status === 'done'
                              ? 'line-through text-slate-500'
                              : 'text-slate-100 group-hover:text-indigo-300'
                          }`}
                        >
                          {task.title}
                        </h4>

                        {task.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{task.description}</p>
                        )}

                        <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400">
                          <span
                            className={`capitalize px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              task.priority === 'high'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800/40'
                                : task.priority === 'normal'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/40'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                            }`}
                          >
                            {task.priority}
                          </span>
                          {task.due_date && <span>Due: {task.due_date}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <WeeklyCalendar
            tasks={filteredTasks}
            onUpdateTaskDueDate={async (taskId, newDate) => {
              setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, due_date: newDate } : t)));
              await supabase.from('tasks').update({ due_date: newDate }).eq('id', taskId);
            }}
            onTaskClick={openEditModal}
            onDayClick={(dateStr) => openCreateModal(dateStr)}
          />
        )}
      </main>

      {/* Task Creation & Editing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingTask ? 'Edit Task' : 'Create New Task'}
            </h3>

            <form onSubmit={handleSaveTask} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g., Problem Set 3"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Course Code</label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g., CMSC330"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Additional details..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Status</label>
                  <select
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as 'low' | 'normal' | 'high')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
                {editingTask ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(editingTask.id)}
                    className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-semibold rounded-lg transition"
                  >
                    Delete Task
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Canvas Sync Modal */}
      <CanvasSyncModal
        isOpen={isCanvasModalOpen}
        onClose={() => setIsCanvasModalOpen(false)}
        onTasksImported={(importedTasks) => {
          setTasks((prev) => [...prev, ...importedTasks]);
        }}
      />
    </div>
  );
}