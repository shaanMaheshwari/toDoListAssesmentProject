import React, { useState } from 'react';
import { 
  format, 
  addWeeks, 
  subWeeks, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  isToday 
} from 'date-fns';
import type { Task } from '../types/task';

interface WeeklyCalendarProps {
  tasks: Task[];
  onToggleDone: (taskId: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onTaskClick: (task: Task) => void;
  onDayClick: (dateStr: string) => void;
}

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ 
  tasks, 
  onToggleDone, 
  onDeleteTask,
  onTaskClick,
  onDayClick,
}) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const handlePrevWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const handleNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const handleToday = () => setCurrentWeek(new Date());

  // Week starting on Sunday to match standard calendar views
  const startDate = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const endDate = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="bg-[#0b0f19] border border-slate-800/80 rounded-xl p-6 shadow-xl">
      {/* Calendar Header with Navigation */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-semibold text-slate-200">
          {format(startDate, 'MMM d')} – {format(endDate, 'MMM d, yyyy')}
        </h2>
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-md transition border border-slate-700/50"
          >
            Today
          </button>
          <button
            onClick={handlePrevWeek}
            className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-md transition border border-slate-700/50"
          >
            &larr; Prev
          </button>
          <button
            onClick={handleNextWeek}
            className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-md transition border border-slate-700/50"
          >
            Next &rarr;
          </button>
        </div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-3">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayTasks = tasks.filter((task) => {
            const rawDate = task.due_date;
            if (!rawDate) return false;
            const taskDate = new Date(rawDate.includes('T') ? rawDate : `${rawDate}T00:00:00`);
            return isSameDay(taskDate, day);
          });
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day.toString()}
              onClick={() => onDayClick(dateStr)}
              className={`min-h-[480px] p-3 rounded-lg border flex flex-col cursor-pointer transition ${
                isCurrentDay 
                  ? 'border-indigo-500/80 bg-[#121829]' 
                  : 'border-slate-800/80 bg-[#121829]/50 hover:bg-[#121829]'
              }`}
            >
              {/* Day Header */}
              <div className="mb-4">
                <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {format(day, 'EEE')}
                </span>
                <span className={`text-sm font-bold ${isCurrentDay ? 'text-indigo-400' : 'text-slate-200'}`}>
                  {format(day, 'd')}
                </span>
              </div>

              {/* Day Tasks */}
              <div className="space-y-2 flex-1">
                {dayTasks.map((task) => {
                  const isDone = task.status === 'done';
                  return (
                    <div
                      key={task.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick(task);
                      }}
                      className={`group relative p-2.5 rounded-lg border text-xs transition-all flex flex-col gap-1 cursor-pointer ${
                        isDone
                          ? 'bg-slate-900/60 border-slate-800/60 text-slate-500 opacity-60'
                          : 'bg-[#1b2336] border-slate-700/50 text-slate-200 hover:border-indigo-500/60 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className={`font-medium line-clamp-2 leading-snug ${isDone ? 'line-through' : ''}`}>
                          {task.title}
                        </span>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onToggleDone(task.id);
                            }}
                            title="Toggle completed"
                            className="text-slate-400 hover:text-emerald-400"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onDeleteTask(task.id);
                            }}
                            title="Delete task"
                            className="text-slate-400 hover:text-rose-400"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {task.course_code && (
                        <span className="text-[10px] font-semibold text-indigo-400/90 uppercase tracking-wide">
                          {task.course_code}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};