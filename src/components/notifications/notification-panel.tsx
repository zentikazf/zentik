'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  RefreshCw,
  MessageSquare,
  Play,
  CheckCircle,
  AtSign,
  Mail,
  FileText,
  Bell,
  Trash2,
  CheckCheck,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useNotificationStore } from '@/stores/use-notification-store';
import { api } from '@/lib/api-client';
import { formatRelative } from '@/lib/utils';
import type { Notification } from '@/types';

const typeIcons: Record<string, typeof Bell> = {
  TASK_ASSIGNED: UserPlus,
  TASK_UPDATED: RefreshCw,
  TASK_COMMENTED: MessageSquare,
  SPRINT_STARTED: Play,
  SPRINT_COMPLETED: CheckCircle,
  MENTION: AtSign,
  INVITATION: Mail,
  INVOICE_SENT: FileText,
  SYSTEM: Bell,
};

const typeColors: Record<string, string> = {
  TASK_ASSIGNED: 'text-blue-500',
  TASK_UPDATED: 'text-yellow-500',
  TASK_COMMENTED: 'text-green-500',
  SPRINT_STARTED: 'text-purple-500',
  SPRINT_COMPLETED: 'text-emerald-500',
  MENTION: 'text-orange-500',
  INVITATION: 'text-indigo-500',
  INVOICE_SENT: 'text-cyan-500',
  SYSTEM: 'text-muted-foreground',
};

interface NotificationPanelProps {
  open: boolean;
}

export function NotificationPanel({ open }: NotificationPanelProps) {
  const {
    notifications,
    setNotifications,
    markAsRead,
    markAllAsRead,
    removeNotification,
  } = useNotificationStore();
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/notifications?page=1&limit=30');
      const data = res.data;
      const raw = Array.isArray(data) ? data : data?.data || [];
      // Map API fields (readAt, message) to frontend interface (read, body)
      const items: Notification[] = raw.map((n: any) => ({
        ...n,
        read: n.read ?? (n.readAt != null),
        body: n.body ?? n.message ?? null,
      }));
      setNotifications(items);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [setNotifications]);

  useEffect(() => {
    if (open) {
      loadNotifications();
    } else {
      setLoaded(false);
    }
  }, [open, loadNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      markAsRead(id);
    } catch {
      // silent
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      markAllAsRead();
    } catch {
      // silent
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      removeNotification(id);
    } catch {
      // silent
    }
  };

  const unreadExist = notifications.some((n) => !n.read);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Notificaciones</h3>
        {unreadExist && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs text-muted-foreground"
            onClick={handleMarkAllAsRead}
          >
            <CheckCheck className="mr-1 h-3 w-3" />
            Marcar todas como leidas
          </Button>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="max-h-[400px]">
        {loading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 rounded-md p-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              No tienes notificaciones
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Te avisaremos cuando haya algo nuevo
            </p>
          </div>
        ) : (
          <div className="p-1">
            {notifications.map((notification, idx) => {
              const Icon = typeIcons[notification.type] || Bell;
              const iconColor = typeColors[notification.type] || 'text-muted-foreground';
              const isUnread = !notification.read;

              return (
                <div key={notification.id}>
                  <button
                    onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                    className={`flex w-full items-start gap-3 rounded-md p-3 text-left transition-colors hover:bg-muted/50 ${
                      isUnread ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ${iconColor}`}>
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${isUnread ? 'font-semibold' : 'font-normal'}`}>
                          {notification.title}
                        </p>
                        {isUnread && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      {notification.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {notification.body}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {formatRelative(notification.createdAt)}
                      </p>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={(e) => handleDelete(notification.id, e)}
                      className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100 [div:hover>&]:opacity-100"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </button>
                  {idx < notifications.length - 1 && <Separator className="mx-3" />}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
