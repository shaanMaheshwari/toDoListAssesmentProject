import { useState, useEffect } from 'react';
import type { Task, Status, Priority } from '../types/task';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Partial<Task>) => void;
  initialData?: Task | null;
}

export function TaskModal({ isOpen, onClose, onSave, initialData }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Status>('todo');
  const [priority, setPriority] = useState<Priority>('normal');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setStatus(initialData.status);
      setPriority(initialData.priority);
      setDueDate(initialData.due_date || '');
    } else {
      setTitle('');
      setDescription('');
      setStatus('todo');
      setPriority('normal');
      setDueDate('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      ...(initialData?.id ? { id: initialData.id } : {}),
      title,
      description,
      status,
      priority,
      due_date: dueDate || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c2340]/80 backdrop-blur-sm p-4">
      <div className="bg-[#281e1c] border border-[#8c6f66]/50 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#8c6f66]/30">
          <h2 className="text-base font-bold text-white tracking-tight">
            {initialData ? 'Edit Task Record' : 'Create New Task'}
          </h2>
          <button
            onClick={onClose}
            className="text-[#8c6f66] hover:text-white text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-[#c2b4ad] mb-1.5">
              Task Title <span className="text-[#4292c6]">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#103b6b]/40 border border-[#8c6f66]/40 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#4292c6] transition-all"
              placeholder="e.g. Implement drag & drop"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#c2b4ad] mb-1.5">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#103b6b]/40 border border-[#8c6f66]/40 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#4292c6] resize-none transition-all"
              placeholder="Add details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#c2b4ad] mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="w-full bg-[#103b6b]/40 border border-[#8c6f66]/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4292c6]"
              >
                <option value="todo" className="bg-[#281e1c]">To Do</option>
                <option value="in_progress" className="bg-[#281e1c]">In Progress</option>
                <option value="in_review" className="bg-[#281e1c]">In Review</option>
                <option value="done" className="bg-[#281e1c]">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#c2b4ad] mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full bg-[#103b6b]/40 border border-[#8c6f66]/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4292c6]"
              >
                <option value="low" className="bg-[#281e1c]">Low</option>
                <option value="normal" className="bg-[#281e1c]">Normal</option>
                <option value="high" className="bg-[#281e1c]">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#c2b4ad] mb-1.5">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-[#103b6b]/40 border border-[#8c6f66]/40 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#4292c6]"
            />
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-[#8c6f66]/30">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#8c8275] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#4292c6] hover:bg-[#357ebd] text-[#0c2340] font-bold text-xs rounded-xl shadow-md transition-all"
            >
              Save Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}