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
    bg: 'bg-[#103b6b]/40',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
  },
  normal: {
    bg: 'bg-[#103b6b]/70',
    text: 'text-[#4292c6]',
    border: 'border-[#4292c6]/40',
  },
  high: {
    bg: 'bg-[#5c2420]',
    text: 'text-rose-300',
    border: 'border-rose-500/40',
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
          className={`group bg-[#281e1c] hover:bg-[#312523] border rounded-xl p-4 shadow-md transition-all duration-200 ${
            snapshot.isDragging
              ? 'border-[#4292c6] shadow-2xl shadow-black/80 scale-[1.02] z-50 bg-[#382b28]'
              : 'border-[#8c6f66]/40'
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-slate-100 text-sm leading-snug line-clamp-2">
              {task.title}
            </h3>
            <span
              className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-md border uppercase tracking-wider ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}
            >
              {task.priority}
            </span>
          </div>

          {task.description && (
            <p className="text-[#c2b4ad] text-xs mb-3 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          <div className="flex items-center justify-between text-[11px] text-[#8c6f66] pt-3 border-t border-[#8c6f66]/30">
            <span className="font-mono text-[10px]">
              {task.due_date ? `Due ${task.due_date}` : 'No due date'}
            </span>

            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(task)}
                className="text-[#c2b4ad] hover:text-[#4292c6] transition-colors text-xs font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(task.id)}
                className="text-[#c2b4ad] hover:text-rose-400 transition-colors text-xs font-medium"
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