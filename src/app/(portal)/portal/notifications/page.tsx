'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  MessageSquarePlus,
  FolderKanban,
  ListTodo,
  Calendar,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useNotificationStore } from '@/stores/use-notification-store';
import { cn } from '@/lib/utils';

const NOTIFICATION_ICONS: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  TASK_ASSIGNED: { icon: ListTodo, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950' },
  TASK_COMPLETED: { icon: ListTodo, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950' },
  TASK_UPDATED: { icon: ListTodo, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950' },
  SUGGESTION_RECEIVED: { icon: MessageSquarePlus, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950' },
  PROJECT_UPDATED: { icon: FolderKanban, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950' },
  MEETING_SCHEDULED: { icon: Calendar, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950' },
  MENTION: { icon: MessageSquarePlus, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-950' },
};

const DEFAULT_ICON = { icon: Bell, color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' };

interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  body?: string;
  read: boolean;
  createdAt: string;
  data?: any;
}

export default function PortalNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [markingAll, setMarkingAll] = useState(false);
  const { unreadCount: storeUnread, setUnreadCount } = useNotificationStore();

  const loadNotifications = useCallback(async (p: number) => {
    try {
      const res = await api.get(`/notifications?page=${p}&limit=15`);
      const data = res.data;
      setNotifications(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al cargar notificaciones';
      toast.error('Error', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications(page);
  }, [page, loadNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount(Math.max(0, storeUnread - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('Listo', 'Todas las notificaciones marcadas como leídas');
    } catch {
      toast.error('Error', 'No se pudieron marcar las notificaciones');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      const notif = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (notif && !notif.read) {
        setUnreadCount(Math.max(0, storeUnread - 1));
      }
    } catch {}
  };

  const localUnread = notifications.filter((n) => !n.read).length;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-[20px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
            <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">Notificaciones</h1>
            {localUnread > 0 && (
              <p className="text-xs text-gray-400">
                {localUnread} sin leer
              </p>
            )}
          </div>
        </div>
        {localUnread > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            {markingAll ? 'Marcando...' : 'Marcar todo como leído'}
          </Button>
        )}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] bg-white py-20 text-center dark:bg-gray-900">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800">
            <BellOff className="h-7 w-7 text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white">Sin notificaciones</h3>
          <p className="mt-1.5 max-w-sm text-sm text-gray-400">
            Aquí verás actualizaciones sobre tus proyectos, tareas y sugerencias.
          </p>
        </div>
      ) : (
        <div className="rounded-[20px] bg-white dark:bg-gray-900 overflow-hidden divide-y divide-gray-50 dark:divide-gray-800">
          {notifications.map((notif) => {
            const iconConfig = NOTIFICATION_ICONS[notif.type] || DEFAULT_ICON;
            const Icon = iconConfig.icon;
            return (
              <div
                key={notif.id}
                className={cn(
                  'flex items-start gap-3 p-4 transition-colors',
                  !notif.read && 'bg-blue-50/30 dark:bg-blue-950/10',
                )}
              >
                <div className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                  iconConfig.bg,
                )}>
                  <Icon className={cn('h-4 w-4', iconConfig.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      'text-sm',
                      notif.read
                        ? 'font-medium text-gray-600 dark:text-gray-300'
                        : 'font-semibold text-gray-800 dark:text-white',
                    )}>
                      {notif.title}
                    </p>
                    <span className="shrink-0 text-[11px] text-gray-400">{formatDate(notif.createdAt)}</span>
                  </div>
                  {(notif.message || notif.body) && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{notif.message || notif.body}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {!notif.read && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Marcar como leída
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notif.id)}
                      className="text-[11px] font-medium text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
                {!notif.read && (
                  <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-500">
            {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
