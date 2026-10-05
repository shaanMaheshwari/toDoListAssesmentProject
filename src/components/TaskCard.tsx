import React from 'react';
import { Trash2 } from 'lucide-react';
import type { Task, TaskStatus } from '../types/task';

export interface TaskCardProps {
  task: Task;
  index?: number; // Added to resolve TS(2322) in Board
  status?: TaskStatus;
  onDropOnColumn?: (e: React.DragEvent, status: TaskStatus, taskId?: string) => void;
  onEdit: (task: Task) => void;
  onToggleComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export function TaskCard({
  task,
  status,
  onDropOnColumn,
  onEdit,
  onToggleComplete,
  onDelete,
}: TaskCardProps) {
  const isDone = task.status === 'done';

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
      onDrop={(e) => {
        e.stopPropagation();
        if (onDropOnColumn && status) {
          onDropOnColumn(e, status, task.id);
        }
      }}
      onClick={() => onEdit(task)}
      className={`bg-slate-800 border p-3.5 rounded-lg cursor-grab active:cursor-grabbing transition group shadow-sm relative ${
        isDone
          ? 'border-slate-800 opacity-60'
          : 'border-slate-700/80 hover:border-indigo-500/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(task.id);
            }}
            title={isDone ? 'Mark Incomplete' : 'Mark Complete'}
            className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
              isDone
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-slate-600 hover:border-indigo-400 bg-slate-900/50'
            }`}
          >
            {isDone && (
              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 20 20">
                <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {task.course_code && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800/50 rounded inline-block">
              {task.course_code}
            </span>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            title="Delete task"
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 rounded transition-opacity"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <h4
        className={`text-sm font-semibold transition-colors ${
          isDone
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
          {task.priority || 'normal'}
        </span>
        {task.due_date && <span>Due: {task.due_date}</span>}
      </div>
    </div>
  );
}