import { useState, useMemo } from 'react';
import { startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import type { Task, ViewMode, DateFilter } from '../types/task';

export function useTaskFilters(tasks: Task[]) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const uniqueCourseCodes = useMemo(() => {
    return Array.from(
      new Set(
        tasks
          .map((t) => t.course_code)
          .filter((code): code is string => Boolean(code && code.trim() !== ''))
      )
    ).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task) return false;

      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (task.course_code && task.course_code.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (selectedCourse !== 'all') {
        if (!task.course_code || task.course_code.toUpperCase() !== selectedCourse.toUpperCase()) {
          return false;
        }
      }

      if (dateFilter === 'all' || !task.due_date) return true;

      const cleanDateStr = task.due_date.includes('T') ? task.due_date : `${task.due_date}T00:00:00`;
      const due = parseISO(cleanDateStr);
      const now = new Date();

      if (dateFilter === 'today') return isSameDay(due, now);
      if (dateFilter === 'week') {
        const weekStart = startOfWeek(now, { weekStartsOn: 0 });
        const weekEnd = addDays(weekStart, 6);
        return due >= weekStart && due <= weekEnd;
      }
      if (dateFilter === 'month') {
        return due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear();
      }

      return true;
    });
  }, [tasks, searchQuery, selectedCourse, dateFilter]);

  const resetFilters = () => {
    setDateFilter('all');
    setSelectedCourse('all');
    setSearchQuery('');
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedCourse,
    setSelectedCourse,
    viewMode,
    setViewMode,
    dateFilter,
    setDateFilter,
    uniqueCourseCodes,
    filteredTasks,
    resetFilters,
  };
}