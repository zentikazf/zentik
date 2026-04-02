'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
 TrendingUp,
 TrendingDown,
 Zap,
 Clock,
 Target,
 Users,
 AlertTriangle,
 CheckCircle2,
 BarChart3,
 ArrowRight,
 RefreshCw,
 Activity,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { useProject } from '@/providers/project-provider';
import { formatDuration } from '@/lib/utils';

interface StatsData {
 tasksByStatus: { status: string; count: number }[];
 tasksByPriority: { priority: string; count: number }[];
 totalTasks: number;
 timeTracking: { totalMinutes: number; totalEntries: number };
 memberCount: number;
 sprintCount: number;
}

interface ProductivityMember {
 userId: string;
 userName: string;
 tasksCompleted: number;
 totalHours: number;
 avgCompletionDays: number;
}

interface BurndownPoint {
 date: string;
 remaining: number;
 completed: number;
}

interface VelocitySprint {
 sprintId: string;
 sprintName: string;
 plannedPoints: number;
 completedPoints: number;
 tasksPlanned: number;
 tasksCompleted: number;
}

interface TimeEntry {
 userId: string;
 userName: string;
 taskTitle: string;
 totalMinutes: number;
 totalHours: number;
}

const statusLabels: Record<string, string> = {
 BACKLOG: 'Backlog',
 TODO: 'Por Hacer',
 IN_PROGRESS: 'En Progreso',
 IN_REVIEW: 'En Revisión',
 DONE: 'Completada',
 CANCELLED: 'Cancelada',
};

const statusColors: Record<string, string> = {
 BACKLOG: '#94a3b8',
 TODO: '#60a5fa',
 IN_PROGRESS: '#f59e0b',
 IN_REVIEW: '#a78bfa',
 DONE: '#22c55e',
 CANCELLED: '#ef4444',
};

const priorityLabels: Record<string, string> = {
 URGENT: 'Urgente',
 HIGH: 'Alta',
 MEDIUM: 'Media',
 LOW: 'Baja',
};

const priorityColors: Record<string, string> = {
 URGENT: '#ef4444',
 HIGH: '#f97316',
 MEDIUM: '#eab308',
 LOW: '#22c55e',
};

export default function ProjectReportsPage() {
 const { projectId } = useParams<{ projectId: string }>();
 const { project } = useProject();
 const orgId = project?.organizationId;

 const [stats, setStats] = useState<StatsData | null>(null);
 const [productivity, setProductivity] = useState<ProductivityMember[]>([]);
 const [burndown, setBurndown] = useState<BurndownPoint[]>([]);
 const [velocity, setVelocity] = useState<VelocitySprint[]>([]);
 const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
 const [loading, setLoading] = useState(true);
 const [startDate, setStartDate] = useState('');
 const [endDate, setEndDate] = useState('');

 const buildQs = () => {
 const params = new URLSearchParams();
 if (startDate) params.set('startDate', startDate);
 if (endDate) params.set('endDate', endDate);
 const qs = params.toString();
 return qs ? `?${qs}` : '';
 };

 const loadAll = async () => {
 setLoading(true);
 const qs = buildQs();
 const results = await Promise.allSettled([
 api.get(`/projects/${projectId}/stats`),
 orgId ? api.get(`/organizations/${orgId}/reports/productivity${qs}`) : Promise.resolve(null),
 api.get(`/projects/${projectId}/reports/burndown${qs}`),
 api.get(`/projects/${projectId}/reports/velocity${qs}`),
 api.get(`/projects/${projectId}/reports/time-distribution${qs}`),
 ]);

 if (results[0].status === 'fulfilled' && results[0].value) {
 const d = results[0].value.data;
 setStats({
 tasksByStatus: (d.tasksByStatus || []).map((r: any) => ({ status: r.status, count: Number(r.count) })),
 tasksByPriority: (d.tasksByPriority || []).map((r: any) => ({ priority: r.priority, count: Number(r.count) })),
 totalTasks: Number(d.totalTasks || 0),
 timeTracking: d.timeTracking || { totalMinutes: 0, totalEntries: 0 },
 memberCount: Number(d.memberCount || 0),
 sprintCount: Number(d.sprintCount || 0),
 });
 }
 if (results[1].status === 'fulfilled' && results[1].value) {
 setProductivity(results[1].value.data?.members || []);
 }
 if (results[2].status === 'fulfilled' && results[2].value) {
 setBurndown(results[2].value.data?.chartData || []);
 }
 if (results[3].status === 'fulfilled' && results[3].value) {
 setVelocity(results[3].value.data?.sprints || []);
 }
 if (results[4].status === 'fulfilled' && results[4].value) {
 setTimeEntries(results[4].value.data?.entries || []);
 }
 setLoading(false);
 };

 useEffect(() => {
 if (projectId) loadAll();
 }, [projectId, orgId]);

 // === Derived metrics (psychology-informed) ===

 const completionRate = useMemo(() => {
 if (!stats) return 0;
 const done = stats.tasksByStatus.find((s) => s.status === 'DONE')?.count || 0;
 return stats.totalTasks > 0 ? Math.round((done / stats.totalTasks) * 100) : 0;
 }, [stats]);

 const inReviewCount = useMemo(() => {
 return stats?.tasksByStatus.find((s) => s.status === 'IN_REVIEW')?.count || 0;
 }, [stats]);

 // Theory of Constraints: find bottleneck (status with most non-done tasks)
 const bottleneck = useMemo(() => {
 if (!stats) return null;
 const active = stats.tasksByStatus.filter((s) => s.status !== 'DONE' && s.status !== 'CANCELLED');
 if (active.length === 0) return null;
 return active.reduce((max, s) => (s.count > max.count ? s : max), active[0]);
 }, [stats]);

 // Pareto: top contributor (who does the most)
 const topContributor = useMemo(() => {
 if (productivity.length === 0) return null;
 const totalDone = productivity.reduce((sum, m) => sum + m.tasksCompleted, 0);
 const top = productivity[0]; // already sorted desc
 if (!top || totalDone === 0) return null;
 return { ...top, percentage: Math.round((top.tasksCompleted / totalDone) * 100) };
 }, [productivity]);

 // Time per member aggregated
 const memberTime = useMemo(() => {
 const map = new Map<string, { name: string; minutes: number }>();
 timeEntries.forEach((e) => {
 const existing = map.get(e.userId) || { name: e.userName, minutes: 0 };
 existing.minutes += e.totalMinutes;
 map.set(e.userId, existing);
 });
 return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
 }, [timeEntries]);

 // Velocity trend (compounding/momentum)
 const velocityTrend = useMemo(() => {
 if (velocity.length < 2) return null;
 const last = velocity[velocity.length - 1];
 const prev = velocity[velocity.length - 2];
 if (prev.completedPoints === 0) return null;
 const change = Math.round(((last.completedPoints - prev.completedPoints) / prev.completedPoints) * 100);
 return { change, improving: change > 0 };
 }, [velocity]);

 if (loading) {
 return (
 <div className="space-y-5">
 <div className="grid grid-cols-4 gap-4">
 {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl"/>)}
 </div>
 <Skeleton className="h-72 rounded-2xl"/>
 <div className="grid grid-cols-2 gap-4">
 <Skeleton className="h-64 rounded-2xl"/>
 <Skeleton className="h-64 rounded-2xl"/>
 </div>
 </div>
 );
 }

 const doneTasks = stats?.tasksByStatus.find((s) => s.status === 'DONE')?.count || 0;
 const inProgressTasks = stats?.tasksByStatus.find((s) => s.status === 'IN_PROGRESS')?.count || 0;

 return (
 <div className="space-y-6">
 {/* Date Filters */}
 <div className="flex items-end gap-3">
 <div className="space-y-1">
 <Label className="text-xs text-muted-foreground">Desde</Label>
 <Input type="date"value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 rounded-xl"/>
 </div>
 <div className="space-y-1">
 <Label className="text-xs text-muted-foreground">Hasta</Label>
 <Input type="date"value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 rounded-xl"/>
 </div>
 <Button variant="outline"size="sm"className="rounded-full"onClick={loadAll}>
 <RefreshCw className="mr-1.5 h-3.5 w-3.5"/> Actualizar
 </Button>
 </div>

 {/* ====== KPI Cards (Goal-Gradient: show progress clearly) ====== */}
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 {/* Completion Rate */}
 <div className="rounded-2xl bg-card p-5">
 <div className="flex items-center justify-between">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
 <Target className="h-5 w-5 text-success"/>
 </div>
 <span className="text-3xl font-bold text-foreground">{completionRate}%</span>
 </div>
 <p className="mt-3 text-sm text-muted-foreground">Tasa de Completación</p>
 <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
 <div className="h-full rounded-full bg-success transition-all duration-700"style={{ width: `${completionRate}%` }} />
 </div>
 <p className="mt-1.5 text-xs text-muted-foreground">{doneTasks} de {stats?.totalTasks || 0} tareas</p>
 </div>

 {/* Active Tasks */}
 <div className="rounded-2xl bg-card p-5">
 <div className="flex items-center justify-between">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
 <Activity className="h-5 w-5 text-primary"/>
 </div>
 <span className="text-3xl font-bold text-foreground">{inProgressTasks}</span>
 </div>
 <p className="mt-3 text-sm text-muted-foreground">En Progreso</p>
 <p className="mt-1.5 text-xs text-muted-foreground">{inReviewCount} en revisión</p>
 </div>

 {/* Team Size & Hours */}
 <div className="rounded-2xl bg-card p-5">
 <div className="flex items-center justify-between">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/10">
 <Clock className="h-5 w-5 text-info"/>
 </div>
 <span className="text-3xl font-bold text-foreground">
 {Math.round((stats?.timeTracking.totalMinutes || 0) / 60)}h
 </span>
 </div>
 <p className="mt-3 text-sm text-muted-foreground">Horas Registradas</p>
 <p className="mt-1.5 text-xs text-muted-foreground">{stats?.timeTracking.totalEntries || 0} entradas de tiempo</p>
 </div>

 {/* Velocity Trend (Compounding) */}
 <div className="rounded-2xl bg-card p-5">
 <div className="flex items-center justify-between">
 <div className={`flex h-10 w-10 items-center justify-center rounded-full ${velocityTrend?.improving ? 'bg-success/10' : 'bg-warning/10'}`}>
 {velocityTrend?.improving ? (
 <TrendingUp className="h-5 w-5 text-success"/>
 ) : (
 <TrendingDown className="h-5 w-5 text-warning"/>
 )}
 </div>
 <span className="text-3xl font-bold text-foreground">
 {velocityTrend ? `${velocityTrend.change > 0 ? '+' : ''}${velocityTrend.change}%` : '—'}
 </span>
 </div>
 <p className="mt-3 text-sm text-muted-foreground">Tendencia Velocidad</p>
 <p className="mt-1.5 text-xs text-muted-foreground">
 {velocityTrend ? (velocityTrend.improving ? 'Mejorando vs sprint anterior' : 'Bajando vs sprint anterior') : 'Se necesitan 2+ sprints'}
 </p>
 </div>
 </div>

 {/* ====== Bottleneck Alert (Theory of Constraints) ====== */}
 {bottleneck && bottleneck.count > 0 && (
 <div className="flex items-center gap-4 rounded-2xl border border-warning/30 bg-warning/10 p-4">
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/15">
 <AlertTriangle className="h-5 w-5 text-warning"/>
 </div>
 <div>
 <p className="text-sm font-semibold text-warning">
 Cuello de Botella Detectado
 </p>
 <p className="text-sm text-warning">
 <span className="font-medium">{bottleneck.count} tareas</span> acumuladas en{' '}
 <span className="font-medium">{statusLabels[bottleneck.status] || bottleneck.status}</span>.
 Liberar este punto aceleraría el flujo completo del proyecto.
 </p>
 </div>
 </div>
 )}

 {/* ====== Two-column layout ====== */}
 <div className="grid gap-5 lg:grid-cols-2">
 {/* --- Task Distribution by Status (Flow visualization) --- */}
 <div className="rounded-2xl bg-card p-6">
 <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-foreground">
 <BarChart3 className="h-4 w-4 text-indigo-500"/>
 Flujo de Tareas por Estado
 </h3>
 {stats && stats.tasksByStatus.length > 0 ? (
 <div className="space-y-3">
 {stats.tasksByStatus
 .filter((s) => s.count > 0)
 .sort((a, b) => {
 const order = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];
 return order.indexOf(a.status) - order.indexOf(b.status);
 })
 .map((s) => {
 const pct = stats.totalTasks > 0 ? (s.count / stats.totalTasks) * 100 : 0;
 const color = statusColors[s.status] || '#6b7280';
 return (
 <div key={s.status}>
 <div className="mb-1 flex items-center justify-between text-sm">
 <div className="flex items-center gap-2">
 <div className="h-2.5 w-2.5 rounded-full"style={{ backgroundColor: color }} />
 <span className="font-medium text-foreground">{statusLabels[s.status] || s.status}</span>
 </div>
 <span className="text-xs text-muted-foreground">{s.count} ({Math.round(pct)}%)</span>
 </div>
 <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
 <div className="h-full rounded-full transition-all duration-500"style={{ width: `${pct}%`, backgroundColor: color }} />
 </div>
 </div>
 );
 })}
 {/* Flow arrow visualization */}
 <div className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground">
 {['Backlog', 'Prog.', 'Review', 'Done'].map((label, i) => (
 <span key={label} className="flex items-center gap-1">
 <span className="rounded bg-muted px-1.5 py-0.5">{label}</span>
 {i < 3 && <ArrowRight className="h-3 w-3"/>}
 </span>
 ))}
 </div>
 </div>
 ) : (
 <p className="py-8 text-center text-sm text-muted-foreground">Sin datos de tareas</p>
 )}
 </div>

 {/* --- Priority Distribution --- */}
 <div className="rounded-2xl bg-card p-6">
 <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-foreground">
 <AlertTriangle className="h-4 w-4 text-warning"/>
 Distribución por Prioridad
 </h3>
 {stats && stats.tasksByPriority.length > 0 ? (
 <div className="space-y-3">
 {stats.tasksByPriority
 .filter((p) => p.count > 0)
 .sort((a, b) => {
 const order = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
 return order.indexOf(a.priority) - order.indexOf(b.priority);
 })
 .map((p) => {
 const pct = stats.totalTasks > 0 ? (p.count / stats.totalTasks) * 100 : 0;
 const color = priorityColors[p.priority] || '#6b7280';
 return (
 <div key={p.priority}>
 <div className="mb-1 flex items-center justify-between text-sm">
 <div className="flex items-center gap-2">
 <div className="h-2.5 w-2.5 rounded-full"style={{ backgroundColor: color }} />
 <span className="font-medium text-foreground">{priorityLabels[p.priority] || p.priority}</span>
 </div>
 <span className="text-xs text-muted-foreground">{p.count} ({Math.round(pct)}%)</span>
 </div>
 <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
 <div className="h-full rounded-full transition-all duration-500"style={{ width: `${pct}%`, backgroundColor: color }} />
 </div>
 </div>
 );
 })}
 {stats.tasksByPriority.filter((p) => p.priority === 'URGENT' || p.priority === 'HIGH').reduce((sum, p) => sum + p.count, 0) > 0 && (
 <p className="mt-2 text-xs text-muted-foreground">
 {stats.tasksByPriority.filter((p) => p.priority === 'URGENT' || p.priority === 'HIGH').reduce((sum, p) => sum + p.count, 0)} tareas de alta prioridad pendientes
 </p>
 )}
 </div>
 ) : (
 <p className="py-8 text-center text-sm text-muted-foreground">Sin datos de prioridad</p>
 )}
 </div>
 </div>

 {/* ====== Team Productivity (Pareto Principle) ====== */}
 <div className="rounded-2xl bg-card p-6">
 <div className="mb-4 flex items-center justify-between">
 <h3 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
 <Users className="h-4 w-4 text-primary"/>
 Productividad del Equipo
 </h3>
 {topContributor && (
 <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
 Top: {topContributor.userName} ({topContributor.percentage}% completadas)
 </span>
 )}
 </div>
 {productivity.length > 0 ? (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
 <th className="pb-3 pr-4">Miembro</th>
 <th className="pb-3 pr-4 text-right">Completadas</th>
 <th className="pb-3 pr-4 text-right">Horas</th>
 <th className="pb-3 pr-4 text-right">Prom. Días/Tarea</th>
 <th className="pb-3 w-1/3">Rendimiento</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {productivity.map((m) => {
 const maxCompleted = Math.max(...productivity.map((p) => p.tasksCompleted), 1);
 const pct = (m.tasksCompleted / maxCompleted) * 100;
 return (
 <tr key={m.userId} className="group">
 <td className="py-3 pr-4">
 <div className="flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-info/10 text-xs font-semibold text-info">
 {m.userName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
 </div>
 <span className="font-medium text-foreground">{m.userName}</span>
 </div>
 </td>
 <td className="py-3 pr-4 text-right font-semibold text-foreground">{m.tasksCompleted}</td>
 <td className="py-3 pr-4 text-right text-muted-foreground">{m.totalHours}h</td>
 <td className="py-3 pr-4 text-right">
 <span className={`text-sm ${m.avgCompletionDays <= 3 ? 'text-success' : m.avgCompletionDays <= 7 ? 'text-warning' : 'text-destructive'}`}>
 {m.avgCompletionDays}d
 </span>
 </td>
 <td className="py-3">
 <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
 <div className="h-full rounded-full bg-info/100 transition-all duration-500"style={{ width: `${pct}%` }} />
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 ) : (
 <p className="py-8 text-center text-sm text-muted-foreground">No hay datos de productividad del equipo</p>
 )}
 </div>

 {/* ====== Time Distribution per Member ====== */}
 {memberTime.length > 0 && (
 <div className="rounded-2xl bg-card p-6">
 <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-foreground">
 <Clock className="h-4 w-4 text-info"/>
 Distribución de Tiempo por Miembro
 </h3>
 <div className="space-y-3">
 {memberTime.map((m) => {
 const maxMin = memberTime[0]?.minutes || 1;
 const pct = (m.minutes / maxMin) * 100;
 const hours = Math.floor(m.minutes / 60);
 const mins = m.minutes % 60;
 return (
 <div key={m.name}>
 <div className="mb-1 flex items-center justify-between text-sm">
 <span className="font-medium text-foreground">{m.name}</span>
 <span className="font-mono text-xs text-muted-foreground">{hours}h {mins}m</span>
 </div>
 <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
 <div className="h-full rounded-full bg-info/100 transition-all duration-500"style={{ width: `${pct}%` }} />
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* ====== Burndown Chart ====== */}
 <div className="rounded-2xl bg-card p-6">
 <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-foreground">
 <TrendingDown className="h-4 w-4 text-primary"/>
 Burndown
 </h3>
 {burndown.length > 0 ? (
 <div className="space-y-1.5">
 {(() => {
 const maxVal = Math.max(...burndown.map((p) => p.remaining + p.completed), 1);
 return burndown.map((point, i) => {
 const remainPct = (point.remaining / maxVal) * 100;
 const donePct = (point.completed / maxVal) * 100;
 const dateStr = new Date(point.date).toLocaleDateString('es-PY', { month: 'short', day: 'numeric' });
 return (
 <div key={i} className="flex items-center gap-3">
 <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{dateStr}</span>
 <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-muted">
 <div className="h-full bg-success transition-all"style={{ width: `${donePct}%` }} />
 <div className="h-full bg-primary transition-all"style={{ width: `${remainPct}%` }} />
 </div>
 <div className="flex w-20 shrink-0 gap-2 text-xs">
 <span className="text-success">{point.completed}</span>
 <span className="text-muted-foreground/50">/</span>
 <span className="text-primary">{point.remaining}</span>
 </div>
 </div>
 );
 });
 })()}
 <div className="mt-2 flex items-center justify-end gap-4 text-xs text-muted-foreground">
 <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-success"/> Completadas</span>
 <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-primary"/> Pendientes</span>
 </div>
 </div>
 ) : (
 <p className="py-8 text-center text-sm text-muted-foreground">No hay datos de burndown disponibles</p>
 )}
 </div>

 {/* ====== Sprint Velocity (Compounding Effect) ====== */}
 <div className="rounded-2xl bg-card p-6">
 <div className="mb-4 flex items-center justify-between">
 <h3 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
 <Zap className="h-4 w-4 text-warning"/>
 Velocidad por Sprint
 </h3>
 {velocityTrend && (
 <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
 velocityTrend.improving
 ? 'bg-success/10 text-success'
 : 'bg-destructive/10 text-destructive'
 }`}>
 {velocityTrend.improving ? <TrendingUp className="h-3 w-3"/> : <TrendingDown className="h-3 w-3"/>}
 {velocityTrend.change > 0 ? '+' : ''}{velocityTrend.change}%
 </span>
 )}
 </div>
 {velocity.length > 0 ? (
 <div className="space-y-4">
 {velocity.map((sprint) => {
 const maxPoints = Math.max(...velocity.map((s) => Math.max(s.plannedPoints, s.completedPoints)), 1);
 const plannedPct = (sprint.plannedPoints / maxPoints) * 100;
 const completedPct = (sprint.completedPoints / maxPoints) * 100;
 const efficiency = sprint.plannedPoints > 0 ? Math.round((sprint.completedPoints / sprint.plannedPoints) * 100) : 0;
 return (
 <div key={sprint.sprintId}>
 <div className="mb-1 flex items-center justify-between text-sm">
 <span className="font-medium text-foreground">{sprint.sprintName}</span>
 <div className="flex items-center gap-3 text-xs text-muted-foreground">
 <span>{sprint.tasksCompleted}/{sprint.tasksPlanned} tareas</span>
 <span className={`font-semibold ${efficiency >= 80 ? 'text-success' : efficiency >= 50 ? 'text-warning' : 'text-destructive'}`}>
 {efficiency}% eficiencia
 </span>
 </div>
 </div>
 <div className="space-y-1">
 <div className="flex items-center gap-2">
 <span className="w-16 text-right text-xs text-muted-foreground">Plan</span>
 <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
 <div className="h-full rounded-full bg-muted-foreground"style={{ width: `${plannedPct}%` }} />
 </div>
 <span className="w-10 text-right text-xs text-muted-foreground">{sprint.plannedPoints}pt</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="w-16 text-right text-xs text-muted-foreground">Real</span>
 <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
 <div className="h-full rounded-full bg-info/100"style={{ width: `${completedPct}%` }} />
 </div>
 <span className="w-10 text-right text-xs text-muted-foreground">{sprint.completedPoints}pt</span>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 <p className="py-8 text-center text-sm text-muted-foreground">No hay datos de velocidad — se necesitan sprints con tareas</p>
 )}
 </div>
 </div>
 );
}
