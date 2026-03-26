'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FolderKanban,
  Calendar,
  MessageSquarePlus,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  Sparkles,
  Bell,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DEFINITION: { label: 'Definicion', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950' },
  DEVELOPMENT: { label: 'Desarrollo', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950' },
  PRODUCTION: { label: 'Produccion', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950' },
  ON_HOLD: { label: 'En Pausa', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950' },
  COMPLETED: { label: 'Completado', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
};

interface PortalProject {
  id: string;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  suggestionsCount: number;
  visibleTasks: number;
  completedTasks: number;
  progress: number;
}

export default function PortalDashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [projRes, notifRes] = await Promise.all([
          api.get('/portal/projects'),
          api.get('/notifications?limit=5').catch(() => ({ data: { data: [] } })),
        ]);
        const data = Array.isArray(projRes.data) ? projRes.data : projRes.data?.data || [];
        setProjects(data);
        setNotifications(notifRes.data?.data || []);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Error al cargar proyectos';
        toast.error('Error', msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos dias' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = user?.name?.split(' ')[0] || 'Cliente';

  const totalTasks = projects.reduce((sum, p) => sum + p.visibleTasks, 0);
  const completedTasks = projects.reduce((sum, p) => sum + p.completedTasks, 0);
  const activeProjects = projects.filter((p) => !['COMPLETED', 'ON_HOLD'].includes(p.status));
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[20px]" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-[20px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 md:p-8">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute bottom-0 right-20 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-blue-200" />
            <span className="text-sm font-medium text-blue-200">Portal de Cliente</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-blue-100/80">
            {activeProjects.length > 0
              ? `Tienes ${activeProjects.length} proyecto${activeProjects.length > 1 ? 's' : ''} activo${activeProjects.length > 1 ? 's' : ''} en progreso`
              : 'Bienvenido a tu portal de seguimiento de proyectos'}
          </p>
        </div>
      </div>

      {/* KPIs */}
      {projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-[20px] bg-white p-5 dark:bg-gray-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
              <FolderKanban className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{projects.length}</p>
              <p className="text-xs text-gray-400">Proyectos</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-[20px] bg-white p-5 dark:bg-gray-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 dark:bg-green-950">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{overallProgress}%</p>
              <p className="text-xs text-gray-400">Progreso General</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-[20px] bg-white p-5 dark:bg-gray-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950">
              <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                {completedTasks}<span className="text-sm font-normal text-gray-400">/{totalTasks}</span>
              </p>
              <p className="text-xs text-gray-400">Tareas Completadas</p>
            </div>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Mis Proyectos</h2>
          {projects.length > 0 && (
            <span className="text-xs text-gray-400">{projects.length} proyecto{projects.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[20px] bg-white py-16 text-center dark:bg-gray-900">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800">
              <FolderKanban className="h-7 w-7 text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">Sin proyectos</h3>
            <p className="mt-1.5 max-w-sm text-sm text-gray-400">
              Aun no tienes proyectos asignados. Contacta a tu equipo para mas informacion.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => {
              const config = STATUS_CONFIG[project.status] || STATUS_CONFIG.DEFINITION;
              return (
                <Link
                  key={project.id}
                  href={`/portal/projects/${project.id}`}
                  className="group relative rounded-[20px] bg-white p-6 transition-all hover:shadow-lg hover:-translate-y-0.5 dark:bg-gray-900"
                >
                  {/* Status indicator dot */}
                  <div className="absolute top-6 right-6">
                    <Badge className={`${config.bg} ${config.color} text-[11px] font-medium`}>
                      {config.label}
                    </Badge>
                  </div>

                  <div className="mb-4 pr-24">
                    <h3 className="text-base font-semibold text-gray-800 group-hover:text-blue-600 transition-colors dark:text-white dark:group-hover:text-blue-400">
                      {project.name}
                    </h3>
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">Progreso</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-white">{project.progress}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-gray-400">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-gray-600 dark:text-gray-300 font-medium">{project.completedTasks}</span>/{project.visibleTasks} tareas
                    </span>
                    {project.suggestionsCount > 0 && (
                      <span className="flex items-center gap-1.5 text-gray-400">
                        <MessageSquarePlus className="h-3.5 w-3.5 text-purple-500" />
                        {project.suggestionsCount}
                      </span>
                    )}
                    {project.endDate && (
                      <span className="flex items-center gap-1.5 text-gray-400">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(project.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>

                  {/* Hover arrow */}
                  <div className="absolute bottom-6 right-6 opacity-0 transition-opacity group-hover:opacity-100">
                    <ArrowRight className="h-4 w-4 text-blue-500" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Notifications */}
      {notifications.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Notificaciones Recientes</h2>
            <Link
              href="/portal/notifications"
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-[20px] bg-white dark:bg-gray-900 divide-y divide-gray-50 dark:divide-gray-800">
            {notifications.slice(0, 3).map((notif: any) => (
              <div key={notif.id} className="flex items-start gap-3 p-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
                  <Bell className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{notif.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{notif.message || notif.body}</p>
                  <p className="text-[10px] text-gray-300 mt-1">
                    {new Date(notif.createdAt).toLocaleDateString('es-ES', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                {!notif.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
