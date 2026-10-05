import { useState, useEffect, useCallback } from 'react';
import { supabase, getOrCreateGuestUser } from '../lib/supabase';
import { syncCanvasTasks } from '../services/canvasService';
import { generateTempId, getLocalDateString } from '../utils/dateUtils';
import type { Task, TaskStatus } from '../types/task';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function shouldSyncCanvas(): boolean {
  const lastSync = localStorage.getItem('last_canvas_sync_timestamp');
  if (!lastSync) return true;

  const timePassed = Date.now() - parseInt(lastSync, 10);
  return timePassed >= SEVEN_DAYS_MS;
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncingCanvas, setIsSyncingCanvas] = useState<boolean>(false);

  const fetchTasksFromDB = useCallback(async (): Promise<Task[]> => {
    const user = await getOrCreateGuestUser();
    if (!user) return [];

    const todayStr = getLocalDateString();

    // 1. HARD PURGE past due Canvas tasks directly in DB on fetch
    await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .not('canvas_event_id', 'is', null)
      .lt('due_date', todayStr);

    // 2. Fetch active tasks (only tasks due today or in the future for Canvas tasks)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true });

    if (error) throw error;

    // Filter out past due Canvas tasks from client state as a second safety layer
    const activeTasks = ((data || []) as Task[]).filter((t) => {
      if (t.canvas_event_id && t.due_date && t.due_date < todayStr) {
        return false;
      }
      return true;
    });

    return activeTasks;
  }, []);

  const triggerCanvasSync = useCallback(
    async (forceSync: boolean = false): Promise<void> => {
      if (!forceSync && !shouldSyncCanvas()) return;

      setIsSyncingCanvas(true);
      try {
        await syncCanvasTasks();
        localStorage.setItem('last_canvas_sync_timestamp', Date.now().toString());

        const refreshedTasks = await fetchTasksFromDB();
        setTasks(refreshedTasks);
      } catch (err) {
        console.error('Error during Canvas sync:', err);
      } finally {
        setIsSyncingCanvas(false);
      }
    },
    [fetchTasksFromDB]
  );

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const data = await fetchTasksFromDB();
        if (isMounted) {
          setTasks(data);
          setLoading(false);
        }

        if (shouldSyncCanvas()) {
          setIsSyncingCanvas(true);
          await syncCanvasTasks();
          localStorage.setItem('last_canvas_sync_timestamp', Date.now().toString());

          const refreshed = await fetchTasksFromDB();
          if (isMounted) {
            setTasks(refreshed);
          }
        }
      } catch (err) {
        console.error('Error initializing tasks:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
          setIsSyncingCanvas(false);
        }
      }
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [fetchTasksFromDB]);

  const persistTaskPositions = async (updatedTasks: Task[]): Promise<void> => {
    try {
      const updatePromises = updatedTasks.map((t, index) =>
        supabase
          .from('tasks')
          .update({
            status: t.status,
            position: index,
          })
          .eq('id', t.id)
      );

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Failed to persist task positions:', error);
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

    const reorderedTargetColumn = targetColumnTasks.map((t, idx) => ({
      ...t,
      position: idx,
    }));

    const otherTasks = tasks.filter(
      (t) => t.status !== targetStatus && t.id !== draggedTaskId
    );
    const newTasksState = [...otherTasks, ...reorderedTargetColumn];

    setTasks(newTasksState);
    await persistTaskPositions(reorderedTargetColumn);
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

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

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
        canvas_event_id: null,
        title: taskData.title || '',
        description: taskData.description || '',
        status: taskData.status || 'todo',
        priority: taskData.priority || 'normal',
        due_date: finalDueDate,
        course_code: taskData.course_code || null,
        position: statusTasks.length,
        is_deleted: false,
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
            is_deleted: false,
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

  const handleTasksImported = () => {
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