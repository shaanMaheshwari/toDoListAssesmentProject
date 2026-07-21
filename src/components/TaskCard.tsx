import type { Task, Priority } from '../types/task';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

const priorityColors: Record<Priority, string> = {
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  normal: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  high: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  return (
    <div className="group bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-slate-100 text-sm leading-snug line-clamp-2">
          {task.title}
        </h3>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border uppercase tracking-wider ${
            priorityColors[task.priority]
          }`}
        >
          {task.priority}
        </span>
      </div>

      {task.description && (
        <p className="text-slate-400 text-xs mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-700/40">
        <span>{task.due_date ? `Due ${task.due_date}` : 'No due date'}</span>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(task)}
            className="text-slate-400 hover:text-indigo-400 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="text-slate-400 hover:text-rose-400 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}