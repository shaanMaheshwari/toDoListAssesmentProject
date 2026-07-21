import type { Task, Status } from '../types/task';
import { TaskCard } from './TaskCard';

interface ColumnsProps {
  title: string;
  status: Status;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
}

export function Columns({
  title,
  tasks,
  onEditTask,
  onDeleteTask,
}: ColumnsProps) {
  return (
    <div className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-2xl p-4 min-w-[280px] w-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm text-slate-200">{title}</h2>
          <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full font-mono">
            {tasks.length}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="h-28 border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-600">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
            />
          ))
        )}
      </div>
    </div>
  );
}