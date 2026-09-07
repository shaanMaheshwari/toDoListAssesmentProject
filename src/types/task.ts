export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high';

export interface Task {
  id: string;
  user_id?: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  created_at?: string;
  source?: 'manual' | 'canvas';
  course_code?: string | null;
  position: number; 
}

export type ViewMode = 'board' | 'calendar';
export type DateFilter = 'all' | 'today' | 'week' | 'month';