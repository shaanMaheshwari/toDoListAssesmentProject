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
    <div className="flex flex-col bg-[#3f2f2c] border border-[#8c6f66]/30 rounded-2xl p-4 min-w-[290px] w-full shadow-xl">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 px-1 pb-3 border-b border-[#8c6f66]/30">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-[#4292c6]" />
          <h2 className="font-semibold text-xs text-[#d1c4be] uppercase tracking-wider">
            {title}
          </h2>
        </div>
        <span className="bg-[#281e1c] border border-[#8c6f66]/40 text-[#d1c4be] text-[11px] font-mono px-2.5 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-3 flex-1 min-h-[200px] rounded-xl transition-colors p-1.5 ${
              snapshot.isDraggingOver
                ? 'bg-[#281e1c]/60 border border-dashed border-[#4292c6]/60'
                : ''
            }`}
          >
            {tasks.length === 0 && !snapshot.isDraggingOver ? (
              <div className="h-32 border border-dashed border-[#8c6f66]/30 rounded-xl flex items-center justify-center text-xs text-[#8c6f66] font-mono">
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