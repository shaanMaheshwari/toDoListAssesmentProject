export type Status = 'todo' | 'in_progress' | 'in_review' | 'done';
export type Priority = 'low' | 'normal' | 'high';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  due_date?: string;
  created_at: string;
}