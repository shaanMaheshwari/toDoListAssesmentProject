import { useState, useEffect, useCallback } from 'react';
import { supabase, getOrCreateGuestUser } from '../lib/supabase';
import { syncCanvasTasks } from '../services/canvasService';
import { generateTempId, getLocalDateString } from '../utils/dateUtils';
import type { Task, TaskStatus } from '../types/task';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncingCanvas, setIsSyncingCanvas] = useState<boolean>(false);

  const fetchTasksFromDB = useCallback(async (): Promise<Task[]> => {
    const user = await getOrCreateGuestUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true });

    if (error) throw error;
    return (data || []) as Task[];
  }, []);

  const triggerCanvasSync = useCallback(async (): Promise<void> => {
    setIsSyncingCanvas(true);
    try {
      const updated = await syncCanvasTasks();
      if (updated) {
        setTasks((prevTasks) => {
          const taskMap = new Map(
            prevTasks.map((t) => [t.canvas_event_id || t.id, t])
          );
          updated.forEach((task) => {
            const key = task.canvas_event_id || task.id;
            taskMap.set(key, task);
          });
          return Array.from(taskMap.values());
        });
      }
    } finally {
      setIsSyncingCanvas(false);
    }
  }, []);

  useEffect(() => {
    fetchTasksFromDB()
      .then((data) => {
        setTasks(data);
        setLoading(false);
        void triggerCanvasSync();
      })
      .catch((err) => {
        console.error('Error fetching tasks:', err);
        setLoading(false);
      });
  }, [fetchTasksFromDB, triggerCanvasSync]);

  const persistTaskPositions = async (updatedTasks: Task[]): Promise<void> => {
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

  const handleDropOnColumn = async (
    e: React.DragEvent,
    targetStatus: TaskStatus,
    targetTaskId?: string
  ): Promise<void> => {
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

    const otherTasks = tasks.filter(
      (t) => t.status !== targetStatus && t.id !== draggedTaskId
    );
    const newTasksState = [...otherTasks, ...targetColumnTasks];

    setTasks(newTasksState);
    await persistTaskPositions(targetColumnTasks);
  };

  const handleToggleTaskComplete = async (taskId: string): Promise<void> => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    const newStatus: TaskStatus = targetTask.status === 'done' ? 'todo' : 'done';

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);

    if (error) {
      console.error('Failed to toggle task status:', error);
      void fetchTasksFromDB().then(setTasks);
    }
  };

  const handleDeleteTask = async (taskId: string): Promise<void> => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);

    if (error) {
      console.error('Failed to delete task from Supabase:', error);
      void fetchTasksFromDB().then(setTasks);
    }
  };

  const handleSaveTask = async (
    taskData: Partial<Task>,
    editingTask: Task | null
  ): Promise<void> => {
    const user = await getOrCreateGuestUser();
    if (!user) return;

    const finalDueDate = taskData.due_date || getLocalDateString();

    if (editingTask) {
      const updatedTask: Partial<Task> = {
        title: taskData.title,
        description: taskData.description,
        status: taskData.status,
        priority: taskData.priority,
        due_date: finalDueDate,
        course_code: taskData.course_code || null,
      };

      setTasks((prev) =>
        prev.map((t) => (t.id === editingTask.id ? ({ ...t, ...updatedTask } as Task) : t))
      );

      await supabase.from('tasks').update(updatedTask).eq('id', editingTask.id);
    } else {
      const tempId = generateTempId();
      const statusTasks = tasks.filter((t) => t.status === (taskData.status || 'todo'));

      const newTaskObj: Task = {
        id: tempId,
        user_id: user.id,
        title: taskData.title || '',
        description: taskData.description || '',
        status: taskData.status || 'todo',
        priority: taskData.priority || 'normal',
        due_date: finalDueDate,
        course_code: taskData.course_code || null,
        position: statusTasks.length,
        created_at: new Date().toISOString(),
      };

      setTasks((prev) => [...prev, newTaskObj]);

      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            user_id: user.id,
            title: taskData.title,
            description: taskData.description,
            status: taskData.status,
            priority: taskData.priority,
            due_date: finalDueDate,
            course_code: taskData.course_code || null,
            position: statusTasks.length,
          },
        ])
        .select();

      if (error) {
        console.error('Error inserting task into Supabase:', error);
      } else if (data && data.length > 0) {
        setTasks((prev) => prev.map((t) => (t.id === tempId ? (data[0] as Task) : t)));
      }
    }
  };

  const handleTasksImported = (importedTasks: Task[]) => {
    setTasks((prev) => {
      const mergedMap = new Map<string, Task>();
      prev.forEach((t) => mergedMap.set(t.canvas_event_id || t.id, t));
      importedTasks.forEach((t) => mergedMap.set(t.canvas_event_id || t.id, t));
      return Array.from(mergedMap.values());
    });
    void fetchTasksFromDB().then(setTasks);
  };

  return {
    tasks,
    loading,
    isSyncingCanvas,
    triggerCanvasSync,
    handleDropOnColumn,
    handleToggleTaskComplete,
    handleDeleteTask,
    handleSaveTask,
    handleTasksImported,
  };
}