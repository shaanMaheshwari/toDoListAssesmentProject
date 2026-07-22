import type { Task, Status } from '../types/task';
import { Columns } from './Column';
import { DragDropContext } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';

interface BoardProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onStatusChange: (taskId: string, newStatus: Status) => void;
}

const COLUMNS: { title: string; status: Status }[] = [
  { title: 'To Do', status: 'todo' },
  { title: 'In Progress', status: 'in_progress' },
  { title: 'In Review', status: 'in_review' },
  { title: 'Done', status: 'done' },
];

export function Board({ tasks, onEditTask, onDeleteTask, onStatusChange }: BoardProps) {
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a valid droppable zone
    if (!destination) return;

    // Dropped in the exact same column and position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Status changed -> trigger backend update
    const newStatus = destination.droppableId as Status;
    onStatusChange(draggableId, newStatus);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full min-w-[1000px]">
        {COLUMNS.map((col) => (
          <Columns
            key={col.status}
            title={col.title}
            status={col.status}
            tasks={tasks.filter((t) => t.status === col.status)}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>
    </DragDropContext>
  );
}