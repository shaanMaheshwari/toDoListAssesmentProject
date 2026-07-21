import type { Task, Status } from '../types/task';
import { Columns } from './Column';

interface BoardProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
}

const COLUMNS: { title: string; status: Status }[] = [
  { title: 'To Do', status: 'todo' },
  { title: 'In Progress', status: 'in_progress' },
  { title: 'In Review', status: 'in_review' },
  { title: 'Done', status: 'done' },
];

export function Board({ tasks, onEditTask, onDeleteTask }: BoardProps) {
  return (
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
  );
}