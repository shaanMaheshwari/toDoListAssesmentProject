import React from 'react';
import { 
  startOfWeek, 
  addDays, 
  format, 
  isSameDay, 
  parseISO 
} from 'date-fns';
import type { Task } from '../types/task';

interface WeeklyCalendarProps {
  tasks: Task[];
  onUpdateTaskDueDate: (taskId: string, newDueDate: string) => Promise<void>;
  onTaskClick: (task: Task) => void;
  onDayClick?: (dateStr: string) => void; // <-- Add this property
}

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  tasks,
  onUpdateTaskDueDate,
  onTaskClick,
  onDayClick,
}) => {
  const [currentWeekStart, setCurrentWeekStart] = React.useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );

  const days = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const handlePrevWeek = () => setCurrentWeekStart((prev) => addDays(prev, -7));
  const handleNextWeek = () => setCurrentWeekStart((prev) => addDays(prev, 7));
  const handleToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      {/* Calendar Header / Week Controls */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <h2 className="text-sm font-bold text-white tracking-wide">
          {format(days[0], 'MMM d')} - {format(days[6], 'MMM d, yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition"
          >
            Today
          </button>
          <button
            onClick={handlePrevWeek}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition"
          >
            &larr; Prev
          </button>
          <button
            onClick={handleNextWeek}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition"
          >
            Next &rarr;
          </button>
        </div>
      </div>

      {/* Grid of Days */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3 flex-1 min-h-[500px]">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayTasks = tasks.filter(
            (t) => t.due_date && isSameDay(parseISO(t.due_date), day)
          );
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={dateStr}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData('text/plain');
                if (taskId) onUpdateTaskDueDate(taskId, dateStr);
              }}
              className={`flex flex-col bg-slate-900 border ${
                isToday ? 'border-indigo-500/80 bg-indigo-950/20' : 'border-slate-800'
              } rounded-lg p-3 transition`}
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/60">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    {format(day, 'EEE')}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      isToday ? 'text-indigo-400' : 'text-slate-200'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                {onDayClick && (
                  <button
                    onClick={() => onDayClick(dateStr)}
                    className="text-slate-500 hover:text-indigo-400 text-xs font-bold p-1 rounded hover:bg-slate-800 transition"
                    title="Add task for this date"
                  >
                    +
                  </button>
                )}
              </div>

              <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
                {dayTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                    onClick={() => onTaskClick(task)}
                    className="bg-slate-800 border border-slate-700/70 p-2.5 rounded-md cursor-grab active:cursor-grabbing hover:border-indigo-500/60 transition group text-left shadow-sm"
                  >
                    {task.course_code && (
                      <span className="text-[9px] font-bold px-1 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800/40 rounded mb-1 inline-block">
                        {task.course_code}
                      </span>
                    )}
                    <h4 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors line-clamp-2">
                      {task.title}
                    </h4>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};