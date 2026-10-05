import type { Task, TaskStatus } from '../types/task';
import { TaskCard } from './TaskCard';

interface BoardProps {
  tasks: Task[];
  onDropOnColumn: (e: React.DragEvent, status: TaskStatus, taskId?: string) => void;
  onEditTask: (task: Task) => void;
  onToggleTaskComplete: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

const BOARD_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];

export function Board({
  tasks,
  onDropOnColumn,
  onEditTask,
  onToggleTaskComplete,
  onDeleteTask,
}: BoardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[calc(100vh-320px)]">
      {BOARD_STATUSES.map((status) => {
        const statusTasks = tasks.filter((t) => t.status === status);

        return (
          <div
            key={status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDropOnColumn(e, status)}
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
              {statusTasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  status={status}
                  onDropOnColumn={onDropOnColumn}
                  onEdit={onEditTask}
                  onToggleComplete={onToggleTaskComplete}
                  onDelete={onDeleteTask}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}