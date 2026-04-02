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

const priorityColors: Record<string, string> = {
 URGENT: 'bg-destructive/15 text-destructive',
 HIGH: 'bg-destructive/15 text-destructive',
 MEDIUM: 'bg-warning/15 text-warning',
 LOW: 'bg-muted text-muted-foreground',
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

const STATUS_LABELS: Record<string, string> = {
 BACKLOG: 'Backlog',
 TODO: 'Por Hacer',
 IN_PROGRESS: 'En Progreso',
 IN_REVIEW: 'En Revisión',
 DONE: 'Completada',
 CANCELLED: 'Cancelada',
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
 <div className="max-w-7xl space-y-6">
 <Skeleton className="h-10 w-64 rounded-xl"/>
 <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <Skeleton key={i} className="h-[120px] rounded-xl"/>
 ))}
 </div>
 <div className="grid gap-7 lg:grid-cols-2">
 <Skeleton className="h-64 rounded-xl"/>
 <Skeleton className="h-64 rounded-xl"/>
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
 <div className="max-w-7xl space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-foreground">
 {greeting}, {user?.name?.split(' ')[0]}
 </h1>
 <p className="mt-1 text-sm text-muted-foreground">
 {roleName && <span className="font-medium text-primary">{roleName}</span>}
 {roleName && ' — '}
 {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
 </p>
 </div>

 {/* Quick Actions */}
 <div className="flex items-center gap-2">
 {canManageProjects && approvals.length > 0 && (
 <Link href="/projects">
 <Badge variant="warning"className="cursor-pointer">
 <ClipboardCheck className="mr-1 h-3 w-3"/>
 {approvals.length} pendientes de aprobación
 </Badge>
 </Link>
 )}
 {urgentTasks.length > 0 && (
 <Badge className="bg-destructive/15 text-destructive border-transparent">
 <AlertTriangle className="mr-1 h-3 w-3"/>
 {urgentTasks.length} urgentes
 </Badge>
 )}
 </div>
 </div>

 {/* KPI Cards — Only for roles with project visibility */}
 {canSeeProjects && stats && (
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
 <StatCard
 title="Proyectos Activos"
 value={stats.totalProjects}
 icon={FolderKanban}
 subtitle="Total en la organización"
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
 subtitle={`${completionRate}% tasa de finalización`}
 />
 <StatCard
 title="Equipo"
 value={stats.teamMembers}
 icon={Users}
 subtitle="Colaboradores activos"
 />
 </div>
 )}

 {/* Developer-focused KPIs when no project visibility */}
 {!canSeeProjects && (
 <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
 <StatCard
 title="Tareas Asignadas"
 value={myTasks.length}
 icon={Target}
 />
 <StatCard
 title="Prioridad Alta/Urgente"
 value={urgentTasks.length}
 icon={AlertTriangle}
 />
 <StatCard
 title="Vencen Pronto"
 value={dueSoonTasks.length}
 icon={Clock}
 />
 </div>
 )}

 {/* Completion Progress Bar — For project viewers */}
 {canSeeProjects && stats && stats.totalTasks > 0 && (
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <TrendingUp className="h-5 w-5 text-primary"/>
 <h2 className="text-sm font-semibold text-card-foreground">Progreso General</h2>
 </div>
 <span className="text-lg font-bold text-primary">{completionRate}%</span>
 </div>
 <div className="h-3 w-full rounded-full bg-muted">
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

 {/* Main Content Grid */}
 <div className="grid gap-7 lg:grid-cols-2">
 {/* My Tasks — Always visible */}
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="mb-5 flex items-center justify-between">
 <h2 className="text-lg font-semibold text-card-foreground">Mis Tareas</h2>
 <Badge variant="info">
 {myTasks.length} activas
 </Badge>
 </div>
 <div className="space-y-2">
 {myTasks.length === 0 ? (
 <p className="py-8 text-center text-sm text-muted-foreground">No tienes tareas asignadas</p>
 ) : (
 myTasks.slice(0, 6).map((task: any) => (
 <Link key={task.id} href={`/projects/${task.projectId}/board`} className="block">
 <div className="flex items-center justify-between rounded-xl border border-border p-3.5 transition-colors hover:bg-muted/50">
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm font-medium text-card-foreground">{task.title}</p>
 <div className="mt-1 flex items-center gap-2">
 <span className="text-xs text-muted-foreground">{task.project?.name}</span>
 {task.dueDate && (
 <>
 <span className="text-muted-foreground/50">·</span>
 <span className="text-xs text-muted-foreground">
 <CalendarDays className="mr-0.5 inline h-3 w-3"/>
 {new Date(task.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
 </span>
 </>
 )}
 </div>
 </div>
 <Badge className={`border-transparent ${priorityColors[task.priority] || priorityColors.MEDIUM}`}>
 {task.priority}
 </Badge>
 </div>
 </Link>
 ))
 )}
 {myTasks.length > 6 && (
 <p className="pt-2 text-center text-xs text-muted-foreground">
 +{myTasks.length - 6} tareas más
 </p>
 )}
 </div>
 </div>

 {/* Projects — For PM, PO, Owner */}
 {canSeeProjects && (
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="mb-5 flex items-center justify-between">
 <h2 className="text-lg font-semibold text-card-foreground">Proyectos</h2>
 <Link
 href="/projects"
 className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
 >
 Ver todos <ArrowRight className="h-3.5 w-3.5"/>
 </Link>
 </div>
 <div className="space-y-2">
 {recentProjects.length === 0 ? (
 <p className="py-8 text-center text-sm text-muted-foreground">No hay proyectos aún</p>
 ) : (
 recentProjects.map((project: any) => {
 const taskCount = project._count?.tasks || 0;
 const memberCount = project._count?.members || 0;
 return (
 <Link key={project.id} href={`/projects/${project.id}/alcance`} className="block">
 <div className="flex items-center justify-between rounded-xl border border-border p-3.5 transition-colors hover:bg-muted/50">
 <div className="min-w-0 flex-1">
 <p className="text-sm font-medium text-card-foreground">{project.name}</p>
 <p className="mt-0.5 truncate text-xs text-muted-foreground">
 {taskCount} tareas · {memberCount} miembros
 </p>
 </div>
 <PhaseBadge phase={project.status} label={statusLabels[project.status] || project.status} />
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
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="mb-5 flex items-center justify-between">
 <h2 className="text-lg font-semibold text-card-foreground">Entregas Cercanas</h2>
 <Badge variant="warning">
 <Clock className="mr-1 h-3 w-3"/>
 {dueSoonTasks.length} esta semana
 </Badge>
 </div>
 <div className="space-y-2">
 {dueSoonTasks.length === 0 ? (
 <p className="py-8 text-center text-sm text-muted-foreground">Sin entregas cercanas</p>
 ) : (
 dueSoonTasks.map((task: any) => {
 const dueDate = new Date(task.dueDate);
 const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
 return (
 <Link key={task.id} href={`/projects/${task.projectId}/board`} className="block">
 <div className="flex items-center justify-between rounded-xl border border-border p-3.5 transition-colors hover:bg-muted/50">
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm font-medium text-card-foreground">{task.title}</p>
 <p className="mt-0.5 text-xs text-muted-foreground">{task.project?.name}</p>
 </div>
 <Badge className={`border-transparent ${daysLeft <= 1 ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning'}`}>
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
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="mb-5 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Activity className="h-5 w-5 text-primary"/>
 <h2 className="text-lg font-semibold text-card-foreground">Actividad Reciente</h2>
 </div>
 <Badge variant="info">
 {activityLog.length} eventos
 </Badge>
 </div>
 <div className="relative">
 {/* Timeline line */}
 <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border"/>

 <div className="space-y-1">
 {activityLog.map((entry: any, i: number) => {
 const IconComp = activityIcons[entry.action] || Activity;
 const label = activityLabels[entry.action] || entry.action;
 const resourceName = entry.newData?.title || entry.newData?.name || entry.resourceId?.slice(0, 8);

 // Build detail line for enriched events
 let detail = '';
 if (entry.action === 'task.status.changed' && entry.newData?.fromStatus && entry.newData?.toStatus) {
 detail = `${STATUS_LABELS[entry.newData.fromStatus] || entry.newData.fromStatus} → ${STATUS_LABELS[entry.newData.toStatus] || entry.newData.toStatus}`;
 } else if ((entry.action === 'task.label.added' || entry.action === 'task.label.removed') && entry.newData?.labelName) {
 detail = entry.newData.labelName;
 } else if (entry.action === 'organization.member.joined' && entry.newData?.userName) {
 detail = `${entry.newData.userName} como ${entry.newData.roleName || 'miembro'}`;
 } else if (entry.action === 'organization.member.removed' && entry.newData?.userName) {
 detail = entry.newData.userName;
 } else if (entry.action === 'meeting.created' && entry.newData?.title) {
 detail = entry.newData.title;
 } else if (entry.action === 'subtask.created' && entry.newData?.title) {
 detail = entry.newData.title;
 }

 return (
 <div
 key={entry.id || i}
 className="relative flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/50"
 >
 <div className="relative z-10 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-muted ring-4 ring-card">
 <IconComp className="h-4 w-4 text-muted-foreground"/>
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
 <p className="mt-0.5 text-xs text-primary font-medium">{detail}</p>
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

 {/* Approvals Section — Only for PO/Owner/PM */}
 {canManageProjects && approvals.length > 0 && (
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="mb-5 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <ClipboardCheck className="h-5 w-5 text-warning"/>
 <h2 className="text-lg font-semibold text-card-foreground">Pendientes de Aprobación</h2>
 </div>
 <Badge variant="warning">
 {approvals.length} pendientes
 </Badge>
 </div>
 <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
 {approvals.slice(0, 6).map((task: any) => (
 <Link key={task.id} href={`/projects/${task.projectId}/approvals`} className="block">
 <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 transition-colors hover:bg-warning/10">
 <p className="truncate text-sm font-medium text-card-foreground">{task.title}</p>
 <p className="mt-1 text-xs text-muted-foreground">{task.project?.name}</p>
 <div className="mt-2 flex items-center gap-2">
 {task.assignments?.[0]?.user && (
 <span className="text-xs text-warning">
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
