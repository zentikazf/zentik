'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { PhaseBadge } from '@/components/ui/phase-badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
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
  Timer,
  Flame,
  ListChecks,
  CircleDot,
  Filter,
  ChevronRight,
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
  BACKLOG: 'Nuevo',
  TODO: 'Pendiente',
  IN_PROGRESS: 'En Desarrollo',
  IN_REVIEW: 'En Revisión',
  DONE: 'Completada',
  CANCELLED: 'Cancelada',
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

function complianceColor(status: 'GREEN' | 'ORANGE' | 'RED'): { bar: string; badge: string; label: string } {
  switch (status) {
    case 'GREEN':
      return {
        bar: 'bg-success',
        badge: 'bg-success/15 text-success',
        label: 'En cumplimiento',
      };
    case 'ORANGE':
      return {
        bar: 'bg-warning',
        badge: 'bg-warning/15 text-warning',
        label: 'Por debajo',
      };
    case 'RED':
    default:
      return {
        bar: 'bg-destructive',
        badge: 'bg-destructive/15 text-destructive',
        label: 'Crítico',
      };
  }
}

// ── Types ─────────────────────────────────────────────────────────────

type ModalType = 'projects' | 'pending' | 'completed' | 'members' | 'hours' | null;

// ── Main Component ────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const { orgId, organization } = useOrg();
  const { hasPermission, isOwner, roleName } = usePermissions();

  // Shared state
  const [loading, setLoading] = useState(true);
  const [myTasks, setMyTasks] = useState<any[]>([]);

  // Owner/PM state (legacy for non-managerial)
  const [stats, setStats] = useState<any>(null);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [orgTimeData, setOrgTimeData] = useState<any>(null);

  // Personal metrics state (for all roles)
  const [personalSummary, setPersonalSummary] = useState<any>(null);
  const [personalTime, setPersonalTime] = useState<any>(null);

  // Managerial dashboard state (Cupo 1)
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterMemberId, setFilterMemberId] = useState('');
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Permissions
  const canSeeProjects = hasPermission('read:projects');
  const canManageProjects = hasPermission('manage:projects');
  const isManagerial = canSeeProjects && canManageProjects;

  const loadDashboard = useCallback(async () => {
    if (!orgId || !isManagerial) return;
    const params = new URLSearchParams();
    if (filterStartDate) params.set('startDate', new Date(filterStartDate).toISOString());
    if (filterEndDate) params.set('endDate', new Date(filterEndDate + 'T23:59:59').toISOString());
    if (filterClientId) params.set('clientId', filterClientId);
    if (filterMemberId) params.set('memberId', filterMemberId);
    const qs = params.toString();
    try {
      const res = await api.get<any>(`/organizations/${orgId}/dashboard${qs ? `?${qs}` : ''}`);
      setDashboardData(res.data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No se pudo actualizar el dashboard';
      toast.error('Error', message);
    }
  }, [orgId, isManagerial, filterStartDate, filterEndDate, filterClientId, filterMemberId]);

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

        if (isManagerial) {
          // Cupo 1: use new dashboard endpoint + load filter options
          promises.push(
            api.get<any>(`/organizations/${orgId}/dashboard`).catch(() => ({ data: null })),
            api.get<any>(`/organizations/${orgId}/clients?limit=200`).catch(() => ({ data: [] })),
          );
        } else if (canSeeProjects) {
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

        if (!isManagerial && canSeeProjects) {
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

        if (isManagerial) {
          const dbData = results[idx++]?.data;
          if (dbData) setDashboardData(dbData);

          const clientsData = results[idx++]?.data;
          const clientList = clientsData?.data || (Array.isArray(clientsData) ? clientsData : []);
          setClients(clientList);

          // Extract members from dashboard data for filter
          if (dbData?.teamMembers?.items) {
            setMembers(dbData.teamMembers.items.map((m: any) => ({ id: m.id, name: m.name })));
          }
        } else if (canSeeProjects) {
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

        if (!isManagerial && canSeeProjects) {
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
  }, [orgId, canSeeProjects, canManageProjects, isManagerial]);

  // Reload dashboard when filters change (post initial load).
  useEffect(() => {
    if (loading || !isManagerial) return;
    loadDashboard();
  }, [loading, isManagerial, loadDashboard]);

  // Mantener opciones del filtro de miembros sincronizadas con el snapshot
  // del backend, pero sin vaciarlas si se aplica un filtro por memberId.
  useEffect(() => {
    if (filterMemberId) return;
    const items = dashboardData?.teamMembers?.items;
    if (Array.isArray(items)) {
      setMembers(items.map((m: any) => ({ id: m.id, name: m.name })));
    }
  }, [dashboardData, filterMemberId]);

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

  // For non-managerial
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

  // ── Modal content helpers ─────────────────────────────────────────

  const getModalTitle = (): string => {
    switch (activeModal) {
      case 'projects': return 'Proyectos Activos';
      case 'pending': return 'Tareas Pendientes';
      case 'completed': return 'Tareas Completadas';
      case 'members': return 'Miembros del Equipo';
      case 'hours': return 'Horas por Cliente';
      default: return '';
    }
  };

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

      {/* ═══════════════════════════════════════════════════════════════
          CUPO 1: Dashboard Gerencial (Owner, PM, PO, Tech Lead)
          ═══════════════════════════════════════════════════════════════ */}
      {isManagerial ? (
        !dashboardData ? (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-xl" />
            ))}
          </div>
        ) : (
        <>
          {/* ── Filtros ──────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
            <Filter className="h-4 w-4 text-muted-foreground mt-1" />
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Desde</label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Hasta</label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
            {clients.length > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Cliente</label>
                <Select value={filterClientId || 'all'} onValueChange={(v) => setFilterClientId(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {members.length > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Miembro</label>
                <Select value={filterMemberId || 'all'} onValueChange={(v) => setFilterMemberId(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(filterStartDate || filterEndDate || filterClientId || filterMemberId) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setFilterClientId(''); setFilterMemberId(''); }}
              >
                Limpiar
              </Button>
            )}
          </div>

          {/* ── KPI Cards (clickables) ───────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <button onClick={() => setActiveModal('projects')} className="text-left">
              <StatCard
                title="Proyectos Activos"
                value={dashboardData.activeProjects?.count ?? 0}
                icon={FolderKanban}
                subtitle="Click para ver detalle"
                className="hover:border-primary/40 transition-colors cursor-pointer"
              />
            </button>
            <button onClick={() => setActiveModal('pending')} className="text-left">
              <StatCard
                title="Tareas Pendientes"
                value={dashboardData.pendingTasks?.count ?? 0}
                icon={Target}
                subtitle="En progreso o por hacer"
                className="hover:border-primary/40 transition-colors cursor-pointer"
              />
            </button>
            <button onClick={() => setActiveModal('completed')} className="text-left">
              <StatCard
                title="Completadas"
                value={dashboardData.completedTasks?.count ?? 0}
                icon={CheckCircle}
                subtitle={dashboardData.pendingTasks?.count + dashboardData.completedTasks?.count > 0
                  ? `${Math.round((dashboardData.completedTasks.count / (dashboardData.pendingTasks.count + dashboardData.completedTasks.count)) * 100)}% finalización`
                  : '0%'}
                className="hover:border-primary/40 transition-colors cursor-pointer"
              />
            </button>
            <button onClick={() => setActiveModal('members')} className="text-left">
              <StatCard
                title="Equipo"
                value={dashboardData.teamMembers?.count ?? 0}
                icon={Users}
                subtitle="Colaboradores activos"
                className="hover:border-primary/40 transition-colors cursor-pointer"
              />
            </button>
            <button onClick={() => setActiveModal('hours')} className="text-left">
              <StatCard
                title="Horas Equipo"
                value={`${dashboardData.hours?.totalHours ?? 0}h`}
                icon={Timer}
                subtitle={dashboardData.hours?.billableHours ? `${dashboardData.hours.billableHours}h facturables` : 'Total registradas'}
                className="hover:border-primary/40 transition-colors cursor-pointer"
              />
            </button>
          </div>

          {/* ── Mini Mis Tareas + Entregas ────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-3">
            {(() => {
              const activeTasks = myTasks.filter((t: any) => ['TODO', 'IN_PROGRESS', 'IN_REVIEW'].includes(t.status));
              if (activeTasks.length === 0) return null;
              return (
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-card-foreground">Mis Tareas</h2>
                <Badge variant="info" className="gap-1">
                  <CircleDot className="h-3 w-3" />
                  {activeTasks.length} activas
                </Badge>
              </div>
              <div className="space-y-1.5">
                {(() => {
                  const userRoleId = organization?.roleId;
                  return activeTasks.slice(0, 6).map((task: any) => {
                    const pConfig = priorityConfig[task.priority] || priorityConfig.MEDIUM;
                    const isCrossRole = task.role && userRoleId && task.role.id !== userRoleId;
                    return (
                      <Link key={task.id} href={`/projects/${task.projectId}/board`} className="block">
                        <div className="group flex items-center gap-3 rounded-lg border border-transparent p-2.5 transition-all hover:border-border hover:bg-muted/50">
                          <div className={`h-2 w-2 shrink-0 rounded-full ${task.status === 'IN_PROGRESS' ? 'bg-primary' : task.status === 'IN_REVIEW' ? 'bg-warning' : 'bg-muted-foreground/40'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-card-foreground">{task.title}</p>
                            <p className="text-[10px] text-muted-foreground">{task.project?.name} · {STATUS_LABELS[task.status] || task.status}</p>
                          </div>
                          <Badge className={`shrink-0 border-transparent text-[10px] ${pConfig.color}`}>
                            {pConfig.label}
                          </Badge>
                          {isCrossRole && (
                            <span className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-warning/15 text-warning">
                              Cross-rol
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  });
                })()}
              </div>
            </div>
              );
            })()}

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
          </div>

          {/* ── Equipo con Cumplimiento de Horas ─────────────────────── */}
          {dashboardData.teamMembers?.items && dashboardData.teamMembers.items.length > 0 && (() => {
            const team = dashboardData.teamMembers.items as any[];
            const thresholds = dashboardData.teamMembers.thresholds || { green: 120, orange: 100 };
            const greenMin = thresholds.green;
            const orangeMin = thresholds.orange;
            const counts = team.reduce(
              (acc, m) => {
                acc[m.complianceStatus] = (acc[m.complianceStatus] || 0) + 1;
                return acc;
              },
              { GREEN: 0, ORANGE: 0, RED: 0 } as Record<'GREEN' | 'ORANGE' | 'RED', number>,
            );
            const monthLabel = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            return (
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold text-card-foreground">Equipo</h2>
                    <Badge variant="info" className="text-[10px]">
                      {team.length} miembro{team.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground capitalize">{monthLabel}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-success font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" /> {counts.GREEN} En cumplimiento
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-warning font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" /> {counts.ORANGE} Por debajo
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-destructive font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> {counts.RED} Crítico
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  {team.map((m) => {
                    const status = (m.complianceStatus || 'RED') as 'GREEN' | 'ORANGE' | 'RED';
                    const colors = complianceColor(status);
                    // El ancho de la barra se escala a greenMin para que "completar" sea llegar a verde.
                    const pct = Math.min(100, Math.max(0, (m.monthlyHours / greenMin) * 100));
                    const initials = getInitials(m.name || '');
                    return (
                      <div key={m.id} className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {m.image && <AvatarImage src={m.image} alt={m.name} />}
                          <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
                            {initials || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-card-foreground">{m.name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {m.role || 'Sin rol'}
                                {typeof m.activeTasks === 'number' && (
                                  <> · {m.activeTasks} activa{m.activeTasks !== 1 ? 's' : ''}</>
                                )}
                                {typeof m.completedTasks === 'number' && (
                                  <> · {m.completedTasks} completada{m.completedTasks !== 1 ? 's' : ''}</>
                                )}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
                                {colors.label}
                              </span>
                              <span className="text-sm font-semibold tabular-nums text-card-foreground">
                                {m.monthlyHours}h
                              </span>
                            </div>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── Approvals ─────────────────────────────────────────────── */}
          {approvals.length > 0 && (
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

          {/* ── KPI Modal ─────────────────────────────────────────────── */}
          <Dialog open={!!activeModal} onOpenChange={(open) => { if (!open) setActiveModal(null); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{getModalTitle()}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-1 pr-4">
                  {activeModal === 'projects' && dashboardData.activeProjects?.items?.map((p: any) => (
                    <Link key={p.id} href={`/projects/${p.id}`} className="block">
                      <div className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted/50 group">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            {p.client?.name && <span>{p.client.name}</span>}
                            <span>{p._count?.tasks || 0} tareas</span>
                            <span>{p._count?.members || 0} miembros</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <PhaseBadge phase={p.status} label={statusLabels[p.status] || p.status} />
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </Link>
                  ))}

                  {activeModal === 'pending' && dashboardData.pendingTasks?.items?.map((t: any) => (
                    <Link key={t.id} href={`/projects/${t.project?.id}/board`} className="block">
                      <div className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted/50 group">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{t.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span>{t.project?.name}</span>
                            <span>{STATUS_LABELS[t.status] || t.status}</span>
                            {t.dueDate && (
                              <span className="flex items-center gap-0.5">
                                <CalendarDays className="h-3 w-3" />
                                {new Date(t.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`shrink-0 border-transparent text-[10px] ${(priorityConfig[t.priority] || priorityConfig.MEDIUM).color}`}>
                            {(priorityConfig[t.priority] || priorityConfig.MEDIUM).label}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </Link>
                  ))}

                  {activeModal === 'completed' && dashboardData.completedTasks?.items?.map((t: any) => (
                    <Link key={t.id} href={`/projects/${t.project?.id}/board`} className="block">
                      <div className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted/50 group">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{t.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span>{t.project?.name}</span>
                            {t.updatedAt && <span>{timeAgo(t.updatedAt)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-success" />
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </Link>
                  ))}

                  {activeModal === 'members' && dashboardData.teamMembers?.items?.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg p-3 hover:bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{m.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          {m.role && <span>{m.role}</span>}
                          <span>{m.email}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="text-center">
                          <p className="font-semibold text-foreground">{m.activeTasks}</p>
                          <p className="text-muted-foreground">activas</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-success">{m.completedTasks}</p>
                          <p className="text-muted-foreground">completadas</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {activeModal === 'hours' && dashboardData.hours?.byClient?.map((c: any) => (
                    <div key={c.clientId} className="flex items-center justify-between rounded-lg p-3 hover:bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{c.clientName}</p>
                        <p className="text-xs text-muted-foreground">{c.projectCount} proyecto{c.projectCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{c.totalHours}h</p>
                        <p className="text-[10px] text-muted-foreground">{c.totalMinutes} min</p>
                      </div>
                    </div>
                  ))}

                  {activeModal === 'hours' && (!dashboardData.hours?.byClient || dashboardData.hours.byClient.length === 0) && (
                    <p className="py-8 text-center text-sm text-muted-foreground">Sin registros de horas en este periodo</p>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </>
        )
      ) : (
        /* ═══════════════════════════════════════════════════════════════
           CUPO 2: Dashboard Operativo (Developer, QA, Designer, etc.)
           ═══════════════════════════════════════════════════════════════ */
        <>
          {/* ── Personal Performance Card ──────────────────────────── */}
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

          {/* ── KPI Cards ──────────────────────────────────────────── */}
          {canSeeProjects && stats ? (
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

          {/* ── Completion Progress Bar ────────────────────────────── */}
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

          {/* ── Main Content Grid ──────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* ── My Tasks ────────────────────────────────────────── */}
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

            {/* ── Right column ─────────────────────────────────────── */}
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

          {/* ── Projects (TL only, not managerial) ─────────────────── */}
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

          {/* ── Approvals ──────────────────────────────────────────── */}
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
        </>
      )}
    </div>
  );
}
