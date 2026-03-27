'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FolderKanban,
  CheckCircle,
  Clock,
  Users,
  ArrowRight,
  AlertTriangle,
  ClipboardCheck,
  Target,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  FileText,
  MessageSquare,
  UserPlus,
  Edit3,
  Trash2,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

const statusLabels: Record<string, string> = {
  DEFINITION: 'Definición',
  DEVELOPMENT: 'Desarrollo',
  PRODUCTION: 'Producción',
  ON_HOLD: 'En Pausa',
  COMPLETED: 'Completado',
};

const statusColors: Record<string, string> = {
  DEFINITION: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  DEVELOPMENT: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  PRODUCTION: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  ON_HOLD: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
  COMPLETED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const priorityColors: Record<string, string> = {
  URGENT: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
  HIGH: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
  MEDIUM: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  LOW: 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const activityIcons: Record<string, typeof Activity> = {
  'task.created': Zap,
  'task.updated': Edit3,
  'task.completed': CheckCircle,
  'task.deleted': Trash2,
  'task.assigned': UserPlus,
  'project.created': FolderKanban,
  'project.updated': Edit3,
  'sprint.created': BarChart3,
  'sprint.started': ArrowUpRight,
  'sprint.completed': CheckCircle,
  'file.uploaded': FileText,
  'suggestion.created': MessageSquare,
};

const activityLabels: Record<string, string> = {
  'task.created': 'creó una tarea',
  'task.updated': 'actualizó una tarea',
  'task.completed': 'completó una tarea',
  'task.deleted': 'eliminó una tarea',
  'task.assigned': 'asignó una tarea',
  'task.unassigned': 'desasignó una tarea',
  'task.label.added': 'agregó etiqueta',
  'task.label.removed': 'removió etiqueta',
  'task.approval.approved': 'aprobó una tarea',
  'task.approval.rejected': 'rechazó una tarea',
  'project.created': 'creó un proyecto',
  'project.updated': 'actualizó un proyecto',
  'sprint.created': 'creó un sprint',
  'sprint.started': 'inició un sprint',
  'sprint.completed': 'completó un sprint',
  'file.uploaded': 'subió un archivo',
  'file.deleted': 'eliminó un archivo',
  'suggestion.created': 'envió una sugerencia',
  'board.column.created': 'creó una columna',
  'board.column.updated': 'actualizó una columna',
  'meeting.created': 'creó una reunión',
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `hace ${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const { hasPermission, isOwner, roleName } = usePermissions();
  const [stats, setStats] = useState<any>(null);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const canSeeProjects = hasPermission('read:projects');
  const canSeeBilling = hasPermission('read:billing');
  const canManageProjects = hasPermission('manage:projects');
  const canSeeAudit = hasPermission('read:audit');

  useEffect(() => {
    if (!orgId) return;

    const load = async () => {
      setLoading(true);
      try {
        const promises: Promise<any>[] = [
          api.get<any>('/users/me/tasks?limit=10').catch(() => ({ data: [] })),
        ];

        if (canSeeProjects) {
          promises.push(
            api.get<any>(`/organizations/${orgId}/reports/overview`).catch(() => ({ data: null })),
            api.get<any>(`/organizations/${orgId}/projects?limit=6`).catch(() => ({ data: [] })),
          );
        }

        if (canManageProjects) {
          promises.push(
            api.get<any>(`/organizations/${orgId}/approvals`).catch(() => ({ data: [] })),
          );
        }

        if (canSeeAudit) {
          promises.push(
            api.get<any>(`/organizations/${orgId}/audit-log?limit=8`).catch(() => ({ data: [] })),
          );
        }

        const results = await Promise.all(promises);
        let idx = 0;

        // My tasks (always)
        const tasksData = results[idx++]?.data;
        setMyTasks(Array.isArray(tasksData) ? tasksData : tasksData?.data || []);

        if (canSeeProjects) {
          const overview = results[idx++]?.data;
          if (overview) {
            const summary = overview.summary || overview;
            const tasksByStatus: { status: string; count: number }[] = overview.tasksByStatus || [];
            const activeTasks = tasksByStatus
              .filter((t: any) => t.status !== 'DONE')
              .reduce((sum: number, t: any) => sum + (t.count || 0), 0);
            const completedTasks = tasksByStatus
              .filter((t: any) => t.status === 'DONE')
              .reduce((sum: number, t: any) => sum + (t.count || 0), 0);

            setStats({
              totalProjects: summary.totalProjects ?? 0,
              activeTasks,
              completedTasks,
              teamMembers: summary.totalMembers ?? 0,
              totalTasks: activeTasks + completedTasks,
            });
          }

          const projectsData = results[idx++]?.data;
          setRecentProjects(Array.isArray(projectsData) ? projectsData : projectsData?.data || []);
        }

        if (canManageProjects) {
          const approvalsData = results[idx++]?.data;
          setApprovals(Array.isArray(approvalsData) ? approvalsData : []);
        }

        if (canSeeAudit) {
          const auditData = results[idx++]?.data;
          setActivityLog(Array.isArray(auditData) ? auditData : auditData?.data || []);
        }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Error inesperado al cargar el dashboard';
        toast.error('Error', message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orgId, canSeeProjects, canManageProjects, canSeeAudit]);

  if (loading || !orgId) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-[25px]" />
          ))}
        </div>
        <div className="grid gap-7 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-[25px]" />
          <Skeleton className="h-64 rounded-[25px]" />
        </div>
      </div>
    );
  }

  // Determine greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  const urgentTasks = myTasks.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH');
  const dueSoonTasks = myTasks.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    const now = new Date();
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 3 && diff >= 0;
  });

  const completionRate = stats?.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">
            {greeting}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {roleName && <span className="font-medium text-blue-500">{roleName}</span>}
            {roleName && ' — '}
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {canManageProjects && approvals.length > 0 && (
            <Link href="/projects">
              <Badge className="cursor-pointer bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-400">
                <ClipboardCheck className="mr-1 h-3 w-3" />
                {approvals.length} pendientes de aprobación
              </Badge>
            </Link>
          )}
          {urgentTasks.length > 0 && (
            <Badge className="bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {urgentTasks.length} urgentes
            </Badge>
          )}
        </div>
      </div>

      {/* KPI Cards — Only for roles with project visibility */}
      {canSeeProjects && stats && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Proyectos Activos', value: stats.totalProjects, icon: FolderKanban, subtitle: 'Total en la organización', gradient: 'from-blue-700 via-blue-600 to-blue-800' },
            { title: 'Tareas Activas', value: stats.activeTasks, icon: Target, subtitle: 'En progreso o pendientes', gradient: 'from-blue-600 via-blue-500 to-sky-600' },
            { title: 'Completadas', value: stats.completedTasks, icon: CheckCircle, subtitle: `${completionRate}% tasa de finalización`, gradient: 'from-blue-800 via-blue-700 to-indigo-800' },
            { title: 'Equipo', value: stats.teamMembers, icon: Users, subtitle: 'Colaboradores activos', gradient: 'from-sky-600 via-blue-500 to-blue-700' },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.title}
                className={`relative flex items-center gap-4 overflow-hidden rounded-[25px] bg-gradient-to-br ${kpi.gradient} p-6`}
              >
                <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/5" />
                <div className="absolute bottom-0 left-0 h-16 w-16 rounded-full bg-white/5" />
                <div className="flex h-[55px] w-[55px] shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="relative min-w-0">
                  <div className="mb-1 truncate text-xs text-white/70">{kpi.title}</div>
                  <div className="text-[22px] font-semibold text-white">{kpi.value}</div>
                  <div className="mt-0.5 text-xs text-white/60">{kpi.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Developer-focused KPIs when no project visibility */}
      {!canSeeProjects && (
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { title: 'Tareas Asignadas', value: myTasks.length, icon: Target, gradient: 'from-blue-600 to-blue-800' },
            { title: 'Prioridad Alta/Urgente', value: urgentTasks.length, icon: AlertTriangle, gradient: 'from-red-600 to-red-800' },
            { title: 'Vencen Pronto', value: dueSoonTasks.length, icon: Clock, gradient: 'from-orange-500 to-orange-700' },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.title}
                className={`relative flex items-center gap-4 overflow-hidden rounded-[25px] bg-gradient-to-br ${kpi.gradient} p-6`}
              >
                <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/5" />
                <div className="flex h-[55px] w-[55px] shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="relative">
                  <div className="mb-1 text-xs text-white/70">{kpi.title}</div>
                  <div className="text-[22px] font-semibold text-white">{kpi.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completion Progress Bar — For project viewers */}
      {canSeeProjects && stats && stats.totalTasks > 0 && (
        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Progreso General</h2>
            </div>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{completionRate}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400 transition-all duration-700"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
            <span>{stats.completedTasks} completadas</span>
            <span>{stats.activeTasks} activas</span>
            <span>{stats.totalTasks} total</span>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-7 lg:grid-cols-2">
        {/* My Tasks — Always visible */}
        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Mis Tareas</h2>
            <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              {myTasks.length} activas
            </Badge>
          </div>
          <div className="space-y-2">
            {myTasks.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No tienes tareas asignadas</p>
            ) : (
              myTasks.slice(0, 6).map((task: any) => (
                <Link key={task.id} href={`/projects/${task.projectId}/board`} className="block">
                  <div className="flex items-center justify-between rounded-xl border border-gray-100 p-3.5 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-white">{task.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-gray-400">{task.project?.name}</span>
                        {task.dueDate && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-400">
                              <CalendarDays className="mr-0.5 inline h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge className={priorityColors[task.priority] || priorityColors.MEDIUM}>
                      {task.priority}
                    </Badge>
                  </div>
                </Link>
              ))
            )}
            {myTasks.length > 6 && (
              <p className="pt-2 text-center text-xs text-gray-400">
                +{myTasks.length - 6} tareas más
              </p>
            )}
          </div>
        </div>

        {/* Projects — For PM, PO, Owner */}
        {canSeeProjects && (
          <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Proyectos</h2>
              <Link
                href="/projects"
                className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-2">
              {recentProjects.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No hay proyectos aún</p>
              ) : (
                recentProjects.map((project: any) => {
                  const taskCount = project._count?.tasks || 0;
                  const memberCount = project._count?.members || 0;
                  return (
                    <Link key={project.id} href={`/projects/${project.id}/alcance`} className="block">
                      <div className="flex items-center justify-between rounded-xl border border-gray-100 p-3.5 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 dark:text-white">{project.name}</p>
                          <p className="mt-0.5 truncate text-xs text-gray-400">
                            {taskCount} tareas · {memberCount} miembros
                          </p>
                        </div>
                        <Badge className={statusColors[project.status] || statusColors.DEFINITION}>
                          {statusLabels[project.status] || project.status}
                        </Badge>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Due Soon — For Developers (takes right column when no projects visible) */}
        {!canSeeProjects && (
          <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Entregas Cercanas</h2>
              <Badge className="bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
                <Clock className="mr-1 h-3 w-3" />
                {dueSoonTasks.length} esta semana
              </Badge>
            </div>
            <div className="space-y-2">
              {dueSoonTasks.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">Sin entregas cercanas</p>
              ) : (
                dueSoonTasks.map((task: any) => {
                  const dueDate = new Date(task.dueDate);
                  const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <Link key={task.id} href={`/projects/${task.projectId}/board`} className="block">
                      <div className="flex items-center justify-between rounded-xl border border-gray-100 p-3.5 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800 dark:text-white">{task.title}</p>
                          <p className="mt-0.5 text-xs text-gray-400">{task.project?.name}</p>
                        </div>
                        <Badge className={daysLeft <= 1 ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400'}>
                          {daysLeft <= 0 ? 'Hoy' : `${daysLeft}d`}
                        </Badge>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Activity Feed — Only for users with audit permission */}
      {canSeeAudit && activityLog.length > 0 && (
        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Actividad Reciente</h2>
            </div>
            <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              {activityLog.length} eventos
            </Badge>
          </div>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gray-100 dark:bg-gray-800" />

            <div className="space-y-1">
              {activityLog.map((entry: any, i: number) => {
                const IconComp = activityIcons[entry.action] || Activity;
                const label = activityLabels[entry.action] || entry.action;
                const resourceName = entry.newData?.title || entry.newData?.name || entry.resourceId?.slice(0, 8);
                return (
                  <div
                    key={entry.id || i}
                    className="relative flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="relative z-10 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-gray-50 ring-4 ring-white dark:bg-gray-800 dark:ring-gray-900">
                      <IconComp className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-medium text-gray-800 dark:text-white">
                          {entry.user?.name || 'Sistema'}
                        </span>{' '}
                        {label}
                        {resourceName && (
                          <>
                            {' '}
                            <span className="font-medium text-gray-600 dark:text-gray-300">
                              &quot;{resourceName}&quot;
                            </span>
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {timeAgo(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Approvals Section — Only for PO/Owner/PM */}
      {canManageProjects && approvals.length > 0 && (
        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Pendientes de Aprobación</h2>
            </div>
            <Badge className="bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
              {approvals.length} pendientes
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {approvals.slice(0, 6).map((task: any) => (
              <Link key={task.id} href={`/projects/${task.projectId}/approvals`} className="block">
                <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 transition-colors hover:bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30 dark:hover:bg-orange-950/50">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-white">{task.title}</p>
                  <p className="mt-1 text-xs text-gray-400">{task.project?.name}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {task.assignments?.[0]?.user && (
                      <span className="text-xs text-orange-600 dark:text-orange-400">
                        por {task.assignments[0].user.name}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
