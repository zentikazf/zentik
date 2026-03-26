'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, Paperclip, CheckSquare, Eye } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  LOW: { bg: 'rgba(131,194,157,0.2)', text: '#68b266', label: 'Baja' },
  MEDIUM: { bg: 'rgba(223,168,116,0.2)', text: '#d58d49', label: 'Media' },
  HIGH: { bg: 'rgba(216,114,125,0.1)', text: '#d8727d', label: 'Alta' },
  URGENT: { bg: 'rgba(216,114,125,0.25)', text: '#c43e4e', label: 'Urgente' },
};

interface KanbanCardProps {
  task: {
    id: string;
    title: string;
    description?: string | null;
    priority: string;
    clientVisible?: boolean;
    assignments?: { user: { id: string; name: string; image?: string | null } }[];
    taskLabels?: { label: { id: string; name: string; color: string } }[];
    _count?: { subTasks?: number };
    subTasks?: { status: string }[];
  };
  onClick?: () => void;
  overlay?: boolean;
}

export function KanbanCard({ task, onClick, overlay }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.MEDIUM;
  const assignees = task.assignments || [];
  const totalSubtasks = task._count?.subTasks || task.subTasks?.length || 0;
  const completedSubtasks = task.subTasks?.filter((s) => s.status === 'DONE').length || 0;
  const labels = task.taskLabels || [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => { if (!isDragging && onClick) onClick(); }}
      className={cn(
        'group relative bg-white dark:bg-gray-800 rounded-2xl p-4 cursor-grab active:cursor-grabbing transition-all hover:shadow-md',
        isDragging && 'opacity-50',
        overlay && 'shadow-lg rotate-1',
      )}
    >
      {/* Priority Badge */}
      <div
        className="inline-flex items-center rounded px-2 py-0.5 mb-2"
        style={{ backgroundColor: priority.bg }}
      >
        <span className="text-xs font-medium" style={{ color: priority.text }}>
          {priority.label}
        </span>
      </div>

      {/* Labels */}
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {labels.map((tl) => (
            <span
              key={tl.label.id}
              className="inline-block h-1.5 w-8 rounded-full"
              style={{ backgroundColor: tl.label.color }}
            />
          ))}
        </div>
      )}

      {/* Title */}
      <h3 className="font-semibold text-[#0d062d] dark:text-white text-sm leading-snug mb-1 line-clamp-2">
        {task.title}
      </h3>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-[#787486] dark:text-gray-400 leading-normal mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        {/* Avatars */}
        <div className="flex items-center -space-x-1.5">
          {assignees.slice(0, 3).map((a) => (
            <Avatar key={a.user.id} className="h-6 w-6 border-2 border-white dark:border-gray-800">
              <AvatarImage src={a.user.image || undefined} />
              <AvatarFallback className="text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {getInitials(a.user.name)}
              </AvatarFallback>
            </Avatar>
          ))}
          {assignees.length > 3 && (
            <span className="ml-1 text-[10px] text-gray-400">+{assignees.length - 3}</span>
          )}
          {assignees.length === 0 && (
            <div className="h-6 w-6 rounded-full bg-gray-100 dark:bg-gray-700" />
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2.5 text-[#787486] dark:text-gray-400">
          {task.clientVisible && (
            <Eye className="h-3.5 w-3.5 text-green-500" />
          )}
          {totalSubtasks > 0 && (
            <div className="flex items-center gap-1 text-[11px]">
              <CheckSquare className="h-3 w-3" />
              <span>{completedSubtasks}/{totalSubtasks}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
