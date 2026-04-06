'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { PhaseBadge } from '@/components/ui/phase-badge';
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
  Activity,
  Zap,
  FileText,
  MessageSquare,
  UserPlus,
  Edit3,
  Trash2,
  BarChart3,
  ArrowUpRight,
  Timer,
  Flame,
  ListChecks,
  CircleDot,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

// ── Mapeos de labels ──────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  DISCOVERY: 'Descubrimiento',
  PLANNING: 'Planificación',
  DEVELOPMENT: 'Desarrollo',
  TESTING: 'Testing',
  DEPLOY: 'Deploy',
  SUPPORT: 'Soporte',
  ON_HOLD: 'En Pausa',
  COMPLETED: 'Completado',
};

const priorityConfig: Record<string, { color: string; label: string }> = {
  URGENT: { color: 'bg-destructive/15 text-destructive', label: 'Urgente' },
  HIGH: { color: 'bg-destructive/15 text-destructive', label: 'Alta' },
  MEDIUM: { color: 'bg-warning/15 text-warning', label: 'Media' },
  LOW: { color: 'bg-muted text-muted-foreground', label: 'Baja' },
};

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'Por Hacer',
  IN_PROGRESS: 'En Progreso',
  IN_REVIEW: 'En Revisión',
  DONE: 'Completada',
  CANCELLED: 'Cancelada',
};

const activityIcons: Record<string, typeof Activity> = {
  'task.created': Zap,
  'task.updated': Edit3,
  'task.completed': CheckCircle,
  'task.deleted': Trash2,
  'task.assigned': UserPlus,
  'task.status.changed': ArrowUpRight,
  'task.approval.requested': Clock,
  'task.approval.approved': CheckCircle,
  'task.approval.rejected': AlertTriangle,
  'subtask.created': Zap,
  'project.created': FolderKanban,
  'project.updated': Edit3,
  'sprint.created': BarChart3,
  'sprint.started': ArrowUpRight,
  'sprint.completed': CheckCircle,
  'file.uploaded': FileText,
  'suggestion.created': MessageSquare,
  'meeting.created': CalendarDays,
  'meeting.updated': CalendarDays,
  'meeting.deleted': Trash2,
  'organization.member.joined': UserPlus,
  'organization.member.removed': Trash2,
  'task.label.added': Target,
  'task.label.removed': Target,
};

const activityLabels: Record<string, string> = {
  'task.created': 'creó una tarea',
  'task.updated': 'actualizó una tarea',
  'task.completed': 'completó una tarea',
  'task.deleted': 'eliminó una tarea',
  'task.assigned': 'asignó una tarea',
  'task.unassigned': 'desasignó una tarea',
  'task.status.changed': 'cambió el estado de una tarea',
  'task.label.added': 'agregó etiqueta',
  'task.label.removed': 'removió etiqueta',
  'task.approval.requested': 'solicitó aprobación de tarea',
  'task.approval.approved': 'aprobó una tarea',
  'task.approval.rejected': 'rechazó una tarea',
  'subtask.created': 'creó una subtarea',
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
  'meeting.created': 'programó una reunión',
  'meeting.updated': 'actualizó una reunión',
  'meeting.deleted': 'canceló una reunión',
  'organization.member.joined': 'se unió a la organización',
  'organization.member.removed': 'fue removido de la organización',
};

// ── Helpers ───────────────────────────────────────────────────────────

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

function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getActivityDetail(entry: any): string {
  if (entry.action === 'task.status.changed' && entry.newData?.fromStatus && entry.newData?.toStatus) {
    return `${STATUS_LABELS[entry.newData.fromStatus] || entry.newData.fromStatus} → ${STATUS_LABELS[entry.newData.toStatus] || entry.newData.toStatus}`;
  }
  if ((entry.action === 'task.label.added' || entry.action === 'task.label.removed') && entry.newData?.labelName) {
    return entry.newData.labelName;
  }
  if (entry.action === 'organization.member.joined' && entry.newData?.userName) {
    return `${entry.newData.userName} como ${entry.newData.roleName || 'miembro'}`;
  }
  if (entry.action === 'organization.member.removed' && entry.newData?.userName) {
    return entry.newData.userName;
  }
  if ((entry.action === 'meeting.created' || entry.action === 'subtask.created') && entry.newData?.title) {
    return entry.newData.title;
  }
  return '';
}

// ── Main Component ────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const { orgId, organization } = useOrg();
  const { hasPermission, isOwner, roleName } = usePermissions();

  // Shared state
  const [loading, setLoading] = useState(true);
  const [myTasks, setMyTasks] = useState<any[]>([]);

  // Owner/PM state
  const [stats, setStats] = useState<any>(null);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [orgTimeData, setOrgTimeData] = useState<any>(null);

  // Personal metrics state (for all roles)
  const [personalSummary, setPersonalSummary] = useState<any>(null);
  const [personalTime, setPersonalTime] = useState<any>(null);

  // Permissions
  const canSeeProjects = hasPermission('read:projects');
  const canManageProjects = hasPermission('manage:projects');
  const canSeeAudit = hasPermission('read:audit');
  const isManagerial = canSeeProjects && canManageProjects;

  useEffect(() => {
    if (!orgId) return;

    const load = async () => {
      setLoading(true);
      try {
        const promises: Promise<any>[] = [
          api.get<any>('/users/me/tasks?limit=10').catch(() => ({ data: [] })),
          api.get<any>('/users/me/reports/summary').catch(() => ({ data: null })),
          api.get<any>('/users/me/time-report').catch(() => ({ data: null })),
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

        if (isManagerial) {
          promises.push(
            api.get<any>(`/organizations/${orgId}/reports/time`).catch(() => ({ data: null })),
          );
        }

        const results = await Promise.all(promises);
        let idx = 0;

        // Always available
        const tasksData = results[idx++]?.data;
        setMyTasks(Array.isArray(tasksData) ? tasksData : tasksData?.data || []);

        const summaryData = results[idx++]?.data;
        setPersonalSummary(summaryData);

        const timeData = results[idx++]?.data;
        setPersonalTime(timeData);

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

        if (isManagerial) {
          const orgTime = results[idx++]?.data;
          setOrgTimeData(orgTime);
        }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Error inesperado al cargar el dashboard';
        toast.error('Error', message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orgId, canSeeProjects, canManageProjects, canSeeAudit, isManagerial]);

  // ── Loading state ─────────────────────────────────────────────────

  if (loading || !orgId) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-80 rounded-xl" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Computed values ───────────────────────────────────────────────

  const firstName = user?.name?.split(' ')[0] || '';
  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const urgentTasks = myTasks.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH');
  const dueSoonTasks = myTasks.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    const diff = (due.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff <= 3 && diff >= 0;
  });

  const completionRate = stats?.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  const personalCompletionRate = personalSummary?.completionRate ?? 0;
  const personalTasksCompleted = personalSummary?.tasksCompleted ?? 0;
  const personalTasksInProgress = personalSummary?.tasksInProgress ?? 0;
  const personalTimeLogged = personalTime?.totalMinutes ?? 0;
  const personalBillable = personalTime?.billableMinutes ?? 0;

  const orgTotalHours = orgTimeData?.totalMinutes
    ? Math.round(orgTimeData.totalMinutes / 60)
    : 0;

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Hola, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {roleName && (
              <span className="mr-1.5 inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {roleName}
              </span>
            )}
            <span className="capitalize">{today}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageProjects && approvals.length > 0 && (
            <Link href="/approvals">
              <Badge variant="warning" className="cursor-pointer gap-1.5 py-1.5 px-3">
                <ClipboardCheck className="h-3.5 w-3.5" />
                {approvals.length} aprobaciones pendientes
              </Badge>
            </Link>
          )}
          {urgentTasks.length > 0 && (
            <Badge className="gap-1.5 py-1.5 px-3 bg-destructive/15 text-destructive border-transparent">
              <AlertTriangle className="h-3.5 w-3.5" />
              {urgentTasks.length} urgentes
            </Badge>
          )}
          {dueSoonTasks.length > 0 && (
            <Badge className="gap-1.5 py-1.5 px-3 bg-warning/15 text-warning border-transparent">
              <Clock className="h-3.5 w-3.5" />
              {dueSoonTasks.length} vencen pronto
            </Badge>
          )}
        </div>
      </div>

      {/* ── Personal Performance Card (all roles) ──────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Flame className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tu resumen</p>
              <p className="text-lg font-bold text-foreground">
                {personalTasksCompleted > 0
                  ? `Completaste ${personalTasksCompleted} tarea${personalTasksCompleted !== 1 ? 's' : ''}`
                  : 'Sin tareas completadas aún'}
                {personalTasksInProgress > 0 && (
                  <span className="text-muted-foreground font-normal">
                    {' '}· {personalTasksInProgress} en progreso
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{formatHours(personalTimeLogged)}</p>
              <p className="text-xs text-muted-foreground">Tiempo registrado</p>
            </div>
            {personalBillable > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{formatHours(personalBillable)}</p>
                <p className="text-xs text-muted-foreground">Facturable</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{personalCompletionRate}%</p>
              <p className="text-xs text-muted-foreground">Completitud</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      {isManagerial && stats ? (
        /* Owner / PM / PO KPIs */
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard
            title="Proyectos Activos"
            value={stats.totalProjects}
            icon={FolderKanban}
            subtitle="Total organización"
          />
          <StatCard
            title="Tareas Activas"
            value={stats.activeTasks}
            icon={Target}
            subtitle="En progreso o pendientes"
          />
          <StatCard
            title="Completadas"
            value={stats.completedTasks}
            icon={CheckCircle}
            subtitle={`${completionRate}% finalización`}
          />
          <StatCard
            title="Equipo"
            value={stats.teamMembers}
            icon={Users}
            subtitle="Colaboradores activos"
          />
          <StatCard
            title="Horas Equipo"
            value={`${orgTotalHours}h`}
            icon={Timer}
            subtitle="Total registradas"
          />
        </div>
      ) : canSeeProjects && stats ? (
        /* Tech Lead KPIs */
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Proyectos"
            value={stats.totalProjects}
            icon={FolderKanban}
          />
          <StatCard
            title="Tareas Activas"
            value={stats.activeTasks}
            icon={Target}
          />
          <StatCard
            title="Completadas"
            value={stats.completedTasks}
            icon={CheckCircle}
            subtitle={`${completionRate}% finalización`}
          />
          <StatCard
            title="Equipo"
            value={stats.teamMembers}
            icon={Users}
          />
        </div>
      ) : (
        /* Developer / QA / Designer / DevOps / Soporte KPIs */
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Tareas Asignadas"
            value={myTasks.length}
            icon={ListChecks}
            subtitle={`${personalTasksInProgress} en progreso`}
          />
          <StatCard
            title="Completadas"
            value={personalTasksCompleted}
            icon={CheckCircle}
            subtitle={`${personalCompletionRate}% completitud`}
          />
          <StatCard
            title="Alta Prioridad"
            value={urgentTasks.length}
            icon={AlertTriangle}
            subtitle={urgentTasks.length > 0 ? 'Requieren atención' : 'Todo en orden'}
          />
          <StatCard
            title="Vencen Pronto"
            value={dueSoonTasks.length}
            icon={Clock}
            subtitle="Próximos 3 días"
          />
        </div>
      )}

      {/* ── Completion Progress Bar (for project viewers) ──────────── */}
      {canSeeProjects && stats && stats.totalTasks > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-semibold text-card-foreground">Progreso General</h2>
            </div>
            <span className="text-lg font-bold text-primary">{completionRate}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{stats.completedTasks} completadas</span>
            <span>{stats.activeTasks} activas</span>
            <span>{stats.totalTasks} total</span>
          </div>
        </div>
      )}

      {/* ── Main Content Grid ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── My Tasks (2/3 width on lg) ───────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-card-foreground">Mis Tareas</h2>
            <Badge variant="info" className="gap-1">
              <CircleDot className="h-3 w-3" />
              {myTasks.filter((t: any) => ['TODO', 'IN_PROGRESS', 'IN_REVIEW'].includes(t.status)).length} activas
            </Badge>
          </div>
          <div className="space-y-1.5">
            {(() => {
              const activeTasks = myTasks.filter((t: any) => ['TODO', 'IN_PROGRESS', 'IN_REVIEW'].includes(t.status));
              if (activeTasks.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-xl bg-muted p-4 mb-3">
                      <CheckCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Sin tareas activas</p>
                    <p className="mt-1 text-xs text-muted-foreground">Cuando te asignen tareas, aparecerán aquí</p>
                  </div>
                );
              }
              const grouped: Record<string, any[]> = {};
              for (const task of activeTasks) {
                const projName = task.project?.name || 'Sin proyecto';
                if (!grouped[projName]) grouped[projName] = [];
                grouped[projName].push(task);
              }
              const userRoleId = organization?.roleId;
              return Object.entries(grouped).map(([projName, tasks]) => (
                <div key={projName}>
                  <p className="mb-1 mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 first:mt-0">{projName}</p>
                  {tasks.slice(0, 5).map((task: any) => {
                    const pConfig = priorityConfig[task.priority] || priorityConfig.MEDIUM;
                    const isCrossRole = task.role && userRoleId && task.role.id !== userRoleId;
                    return (
                      <Link key={task.id} href={`/projects/${task.projectId}/board`} className="block">
                        <div className="group flex items-center gap-3 rounded-lg border border-transparent p-3 transition-all hover:border-border hover:bg-muted/50">
                          <div className={`h-2 w-2 shrink-0 rounded-full ${task.status === 'IN_PROGRESS' ? 'bg-primary' : task.status === 'IN_REVIEW' ? 'bg-warning' : 'bg-muted-foreground/40'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-sm font-medium text-card-foreground group-hover:text-foreground">
                                {task.title}
                              </p>
                              <span className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${isCrossRole ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary'}`}>
                                {isCrossRole ? 'Cross-rol' : 'Tú'}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="text-[10px]">{STATUS_LABELS[task.status] || task.status}</span>
                              {task.dueDate && (
                                <>
                                  <span className="text-muted-foreground/30">·</span>
                                  <span className="flex items-center gap-0.5 whitespace-nowrap">
                                    <CalendarDays className="h-3 w-3" />
                                    {new Date(task.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <Badge className={`shrink-0 border-transparent text-[10px] ${pConfig.color}`}>
                            {pConfig.label}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                  {tasks.length > 5 && (
                    <p className="pl-3 text-[11px] text-muted-foreground">+{tasks.length - 5} más en {projName}</p>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>

        {/* ── Right column ─────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Entregas cercanas */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-card-foreground">Entregas Cercanas</h2>
              {dueSoonTasks.length > 0 && (
                <Badge variant="warning" className="gap-1 text-[10px]">
                  <Clock className="h-3 w-3" />
                  {dueSoonTasks.length}
                </Badge>
              )}
            </div>
            {dueSoonTasks.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Sin entregas cercanas</p>
            ) : (
              <div className="space-y-1.5">
                {dueSoonTasks.slice(0, 5).map((task: any) => {
                  const dueDate = new Date(task.dueDate);
                  const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <Link key={task.id} href={`/projects/${task.projectId}/board`} className="block">
                      <div className="flex items-center justify-between rounded-lg p-2.5 transition-colors hover:bg-muted/50">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-card-foreground">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.project?.name}</p>
                        </div>
                        <Badge className={`ml-2 shrink-0 border-transparent text-[10px] ${daysLeft <= 1 ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning'}`}>
                          {daysLeft <= 0 ? 'Hoy' : `${daysLeft}d`}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Time by project (personal) */}
          {personalTime?.byProject && personalTime.byProject.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-card-foreground">Tiempo por Proyecto</h2>
                <Timer className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-3">
                {personalTime.byProject.slice(0, 5).map((proj: any, i: number) => {
                  const pct = personalTimeLogged > 0 ? Math.round((proj.minutes / personalTimeLogged) * 100) : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate font-medium text-card-foreground">{proj.projectName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatHours(proj.minutes)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Projects (Owner/PM/PO/TL only) ─────────────────────────── */}
      {canSeeProjects && recentProjects.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-card-foreground">Proyectos</h2>
            <Link
              href="/projects"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((project: any) => {
              const taskCount = project._count?.tasks || 0;
              const memberCount = project._count?.members || 0;
              return (
                <Link key={project.id} href={`/projects/${project.id}/alcance`} className="block">
                  <div className="group rounded-xl border border-border p-4 transition-all hover:border-primary/30 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-card-foreground group-hover:text-primary transition-colors">
                        {project.name}
                      </p>
                      <PhaseBadge phase={project.status} label={statusLabels[project.status] || project.status} />
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" /> {taskCount} tareas
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {memberCount}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Activity Feed (audit permission) ───────────────────────── */}
      {canSeeAudit && activityLog.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold text-card-foreground">Actividad Reciente</h2>
            </div>
            <Badge variant="info" className="text-[10px]">
              {activityLog.length} eventos
            </Badge>
          </div>
          <div className="relative">
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-0.5">
              {activityLog.map((entry: any, i: number) => {
                const IconComp = activityIcons[entry.action] || Activity;
                const label = activityLabels[entry.action] || entry.action;
                const resourceName = entry.newData?.title || entry.newData?.name || entry.resourceId?.slice(0, 8);
                const detail = getActivityDetail(entry);

                return (
                  <div
                    key={entry.id || i}
                    className="relative flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="relative z-10 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-muted ring-4 ring-card">
                      <IconComp className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-card-foreground">
                          {entry.user?.name || entry.newData?.userName || 'Sistema'}
                        </span>{' '}
                        {label}
                        {resourceName && (
                          <>
                            {' '}
                            <span className="font-medium text-foreground/70">
                              &quot;{resourceName}&quot;
                            </span>
                          </>
                        )}
                      </p>
                      {detail && (
                        <p className="mt-0.5 text-xs font-medium text-primary">{detail}</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
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

      {/* ── Approvals (PM/PO/Owner) ────────────────────────────────── */}
      {canManageProjects && approvals.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-warning" />
              <h2 className="text-base font-semibold text-card-foreground">Pendientes de Aprobación</h2>
            </div>
            <Badge variant="warning" className="text-[10px]">
              {approvals.length} pendientes
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {approvals.slice(0, 6).map((task: any) => (
              <Link key={task.id} href={`/projects/${task.projectId}/approvals`} className="block">
                <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 transition-all hover:bg-warning/10 hover:shadow-sm">
                  <p className="truncate text-sm font-medium text-card-foreground">{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{task.project?.name}</p>
                  {task.assignments?.[0]?.user && (
                    <p className="mt-2 text-xs text-warning">
                      por {task.assignments[0].user.name}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
