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
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
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
          <Label className="text-xs text-gray-400">Desde</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 rounded-xl" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-400">Hasta</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 rounded-xl" />
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={loadAll}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Actualizar
        </Button>
      </div>

      {/* ====== KPI Cards (Goal-Gradient: show progress clearly) ====== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Completion Rate */}
        <div className="rounded-2xl bg-white p-5 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
              <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-3xl font-bold text-gray-800 dark:text-white">{completionRate}%</span>
          </div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Tasa de Completación</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-green-500 transition-all duration-700" style={{ width: `${completionRate}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-gray-400">{doneTasks} de {stats?.totalTasks || 0} tareas</p>
        </div>

        {/* Active Tasks */}
        <div className="rounded-2xl bg-white p-5 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-3xl font-bold text-gray-800 dark:text-white">{inProgressTasks}</span>
          </div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">En Progreso</p>
          <p className="mt-1.5 text-xs text-gray-400">{inReviewCount} en revisión</p>
        </div>

        {/* Team Size & Hours */}
        <div className="rounded-2xl bg-white p-5 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-950">
              <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-3xl font-bold text-gray-800 dark:text-white">
              {Math.round((stats?.timeTracking.totalMinutes || 0) / 60)}h
            </span>
          </div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Horas Registradas</p>
          <p className="mt-1.5 text-xs text-gray-400">{stats?.timeTracking.totalEntries || 0} entradas de tiempo</p>
        </div>

        {/* Velocity Trend (Compounding) */}
        <div className="rounded-2xl bg-white p-5 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${velocityTrend?.improving ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-amber-50 dark:bg-amber-950'}`}>
              {velocityTrend?.improving ? (
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <TrendingDown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <span className="text-3xl font-bold text-gray-800 dark:text-white">
              {velocityTrend ? `${velocityTrend.change > 0 ? '+' : ''}${velocityTrend.change}%` : '—'}
            </span>
          </div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Tendencia Velocidad</p>
          <p className="mt-1.5 text-xs text-gray-400">
            {velocityTrend ? (velocityTrend.improving ? 'Mejorando vs sprint anterior' : 'Bajando vs sprint anterior') : 'Se necesitan 2+ sprints'}
          </p>
        </div>
      </div>

      {/* ====== Bottleneck Alert (Theory of Constraints) ====== */}
      {bottleneck && bottleneck.count > 0 && (
        <div className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/50">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Cuello de Botella Detectado
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
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
        <div className="rounded-2xl bg-white p-6 dark:bg-gray-900">
          <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-gray-800 dark:text-white">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
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
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="font-medium text-gray-700 dark:text-gray-300">{statusLabels[s.status] || s.status}</span>
                        </div>
                        <span className="text-xs text-gray-400">{s.count} ({Math.round(pct)}%)</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              {/* Flow arrow visualization */}
              <div className="mt-4 flex items-center justify-center gap-1 text-xs text-gray-400">
                {['Backlog', 'Prog.', 'Review', 'Done'].map((label, i) => (
                  <span key={label} className="flex items-center gap-1">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">{label}</span>
                    {i < 3 && <ArrowRight className="h-3 w-3" />}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">Sin datos de tareas</p>
          )}
        </div>

        {/* --- Priority Distribution --- */}
        <div className="rounded-2xl bg-white p-6 dark:bg-gray-900">
          <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-gray-800 dark:text-white">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
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
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="font-medium text-gray-700 dark:text-gray-300">{priorityLabels[p.priority] || p.priority}</span>
                        </div>
                        <span className="text-xs text-gray-400">{p.count} ({Math.round(pct)}%)</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              {stats.tasksByPriority.filter((p) => p.priority === 'URGENT' || p.priority === 'HIGH').reduce((sum, p) => sum + p.count, 0) > 0 && (
                <p className="mt-2 text-xs text-gray-400">
                  {stats.tasksByPriority.filter((p) => p.priority === 'URGENT' || p.priority === 'HIGH').reduce((sum, p) => sum + p.count, 0)} tareas de alta prioridad pendientes
                </p>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">Sin datos de prioridad</p>
          )}
        </div>
      </div>

      {/* ====== Team Productivity (Pareto Principle) ====== */}
      <div className="rounded-2xl bg-white p-6 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-gray-800 dark:text-white">
            <Users className="h-4 w-4 text-blue-500" />
            Productividad del Equipo
          </h3>
          {topContributor && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              Top: {topContributor.userName} ({topContributor.percentage}% completadas)
            </span>
          )}
        </div>
        {productivity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:border-gray-800">
                  <th className="pb-3 pr-4">Miembro</th>
                  <th className="pb-3 pr-4 text-right">Completadas</th>
                  <th className="pb-3 pr-4 text-right">Horas</th>
                  <th className="pb-3 pr-4 text-right">Prom. Días/Tarea</th>
                  <th className="pb-3 w-1/3">Rendimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {productivity.map((m) => {
                  const maxCompleted = Math.max(...productivity.map((p) => p.tasksCompleted), 1);
                  const pct = (m.tasksCompleted / maxCompleted) * 100;
                  return (
                    <tr key={m.userId} className="group">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                            {m.userName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800 dark:text-white">{m.userName}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold text-gray-800 dark:text-white">{m.tasksCompleted}</td>
                      <td className="py-3 pr-4 text-right text-gray-600 dark:text-gray-400">{m.totalHours}h</td>
                      <td className="py-3 pr-4 text-right">
                        <span className={`text-sm ${m.avgCompletionDays <= 3 ? 'text-green-600' : m.avgCompletionDays <= 7 ? 'text-amber-600' : 'text-red-500'}`}>
                          {m.avgCompletionDays}d
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">No hay datos de productividad del equipo</p>
        )}
      </div>

      {/* ====== Time Distribution per Member ====== */}
      {memberTime.length > 0 && (
        <div className="rounded-2xl bg-white p-6 dark:bg-gray-900">
          <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-gray-800 dark:text-white">
            <Clock className="h-4 w-4 text-purple-500" />
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
                    <span className="font-medium text-gray-700 dark:text-gray-300">{m.name}</span>
                    <span className="font-mono text-xs text-gray-400">{hours}h {mins}m</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className="h-full rounded-full bg-purple-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====== Burndown Chart ====== */}
      <div className="rounded-2xl bg-white p-6 dark:bg-gray-900">
        <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-gray-800 dark:text-white">
          <TrendingDown className="h-4 w-4 text-blue-500" />
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
                    <span className="w-16 shrink-0 text-right text-xs text-gray-400">{dateStr}</span>
                    <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="h-full bg-green-400 transition-all" style={{ width: `${donePct}%` }} />
                      <div className="h-full bg-blue-400 transition-all" style={{ width: `${remainPct}%` }} />
                    </div>
                    <div className="flex w-20 shrink-0 gap-2 text-xs">
                      <span className="text-green-600">{point.completed}</span>
                      <span className="text-gray-300">/</span>
                      <span className="text-blue-600">{point.remaining}</span>
                    </div>
                  </div>
                );
              });
            })()}
            <div className="mt-2 flex items-center justify-end gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-400" /> Completadas</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-400" /> Pendientes</span>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">No hay datos de burndown disponibles</p>
        )}
      </div>

      {/* ====== Sprint Velocity (Compounding Effect) ====== */}
      <div className="rounded-2xl bg-white p-6 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-gray-800 dark:text-white">
            <Zap className="h-4 w-4 text-yellow-500" />
            Velocidad por Sprint
          </h3>
          {velocityTrend && (
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              velocityTrend.improving
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
            }`}>
              {velocityTrend.improving ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
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
                    <span className="font-medium text-gray-700 dark:text-gray-300">{sprint.sprintName}</span>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{sprint.tasksCompleted}/{sprint.tasksPlanned} tareas</span>
                      <span className={`font-semibold ${efficiency >= 80 ? 'text-green-600' : efficiency >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                        {efficiency}% eficiencia
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right text-xs text-gray-400">Plan</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className="h-full rounded-full bg-gray-300 dark:bg-gray-600" style={{ width: `${plannedPct}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs text-gray-400">{sprint.plannedPoints}pt</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-right text-xs text-gray-400">Real</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${completedPct}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs text-gray-400">{sprint.completedPoints}pt</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">No hay datos de velocidad — se necesitan sprints con tareas</p>
        )}
      </div>
    </div>
  );
}
