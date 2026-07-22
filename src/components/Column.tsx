import type { Task, Status } from '../types/task';
import { TaskCard } from './TaskCard';
import { Droppable } from '@hello-pangea/dnd';

interface ColumnsProps {
  title: string;
  status: Status;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
}

export function Columns({
  title,
  status,
  tasks,
  onEditTask,
  onDeleteTask,
}: ColumnsProps) {
  return (
    <div className="flex flex-col bg-[#1a1e24] border border-[#2e3640] rounded-2xl p-4 min-w-[280px] w-full min-h-[calc(100vh-180px)] shadow-lg">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 px-1 pb-3 border-b border-[#2e3640]">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <h2 className="font-semibold text-xs text-slate-300 uppercase tracking-wider">
            {title}
          </h2>
        </div>
        <span className="bg-[#111418] border border-[#2e3640] text-slate-400 text-[11px] font-mono px-2.5 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      {/* Droppable Zone */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-3 flex-1 rounded-xl transition-colors p-1 ${
              snapshot.isDraggingOver
                ? 'bg-[#222831]/80 border border-dashed border-blue-500/40'
                : ''
            }`}
          >
            {tasks.length === 0 && !snapshot.isDraggingOver ? (
              <div className="h-32 border border-dashed border-[#2e3640] rounded-xl flex items-center justify-center text-xs text-slate-500 font-mono">
                Empty column
              </div>
            ) : (
              tasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                />
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}