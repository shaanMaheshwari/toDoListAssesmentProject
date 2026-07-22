import type { Task, Priority } from '../types/task';
import { Draggable } from '@hello-pangea/dnd';

interface TaskCardProps {
  task: Task;
  index: number;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

const priorityStyles: Record<Priority, { bg: string; text: string; border: string }> = {
  low: {
    bg: 'bg-[#1a1e24]',
    text: 'text-slate-400',
    border: 'border-[#2e3640]',
  },
  normal: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
  },
  high: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
  },
};

export function TaskCard({ task, index, onEdit, onDelete }: TaskCardProps) {
  const pStyle = priorityStyles[task.priority];

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`group bg-[#111418] hover:bg-[#161a20] border border-[#2e3640] rounded-xl p-4 transition-all duration-200 ${
            snapshot.isDragging
              ? 'border-blue-500/50 shadow-2xl bg-[#181d24] scale-[1.01] z-50 ring-1 ring-blue-500/40'
              : ''
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-medium text-slate-200 text-sm leading-snug line-clamp-2">
              {task.title}
            </h3>
            <span
              className={`text-[9px] font-mono px-2 py-0.5 rounded-md border uppercase tracking-wider ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}
            >
              {task.priority}
            </span>
          </div>

          {task.description && (
            <p className="text-slate-400 text-xs mb-3 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2.5 border-t border-[#2e3640]">
            <span className="font-mono text-[10px]">
              {task.due_date ? `Due ${task.due_date}` : 'No due date'}
            </span>

            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(task)}
                className="text-slate-400 hover:text-slate-200 transition-colors text-xs"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(task.id)}
                className="text-slate-400 hover:text-rose-400 transition-colors text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}