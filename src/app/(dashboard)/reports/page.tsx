'use client';

import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
 Tooltip,
 TooltipContent,
 TooltipProvider,
 TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Info, BarChart3, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from '@/hooks/use-toast';
import { formatDuration, getInitials } from '@/lib/utils';

interface TeamMonthlyItem {
 userId: string;
 name: string;
 image?: string;
 role?: string | null;
 completedTasks: number;
 totalSeconds: number;
 hours: number;
 avgDaysPerTask: number;
 onTimeTasks: number;
 performancePct: number | null;
}

// Format YYYY-MM → "Mayo 2026"
function formatMonthLabel(monthYM: string): string {
 const [y, m] = monthYM.split('-').map(Number);
 const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
 return `${months[m - 1]} ${y}`;
}

// Build last 12 months as YYYY-MM
function buildMonthOptions(): string[] {
 const options: string[] = [];
 const now = new Date();
 for (let i = 0; i < 12; i++) {
 const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
 options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
 }
 return options;
}

export default function ReportsPage() {
 const { orgId } = useOrg();
 const { hasPermission } = usePermissions();

 // Cupo 1: Owner / PM / PO / Tech Lead — ven el reporte mensual del equipo
 const isManagerial = hasPermission('manage:projects');

 const monthOptions = useMemo(() => buildMonthOptions(), []);
 const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]);

 // Cupo 1 state
 const [teamData, setTeamData] = useState<{ month: string; items: TeamMonthlyItem[] } | null>(null);
 const [loadingTeam, setLoadingTeam] = useState(true);

 // Cupo 2 state (resumen personal + tiempo personal)
 const [personalData, setPersonalData] = useState<any>(null);
 const [timeReport, setTimeReport] = useState<any>(null);
 const [loadingPersonal, setLoadingPersonal] = useState(true);

 // Load reporte mensual del equipo (solo Cupo 1)
 useEffect(() => {
 if (!orgId || !isManagerial) {
 setLoadingTeam(false);
 return;
 }
 setLoadingTeam(true);
 api.get(`/organizations/${orgId}/reports/team-monthly?month=${selectedMonth}`)
 .then((res) => setTeamData(res.data as { month: string; items: TeamMonthlyItem[] }))
 .catch((err) => {
 if (err instanceof ApiError) toast.error('Error', err.message);
 setTeamData(null);
 })
 .finally(() => setLoadingTeam(false));
 }, [orgId, isManagerial, selectedMonth]);

 // Load resumen personal (solo Cupo 2)
 useEffect(() => {
 if (isManagerial) {
 setLoadingPersonal(false);
 return;
 }
 setLoadingPersonal(true);
 Promise.all([
 api.get('/users/me/reports/summary').catch(() => ({ data: null })),
 api.get('/users/me/time-report').catch(() => ({ data: null })),
 ]).then(([summary, time]) => {
 setPersonalData(summary.data);
 setTimeReport(time.data);
 }).finally(() => setLoadingPersonal(false));
 }, [isManagerial]);

 // ── Render: Cupo 1 (Gerencial) ────────────────────────────────
 if (isManagerial) {
 return (
 <TooltipProvider delayDuration={100}>
 <div className="space-y-6">
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
 <div>
 <h1 className="text-[22px] font-semibold text-foreground">Reporte mensual del equipo</h1>
 <p className="mt-1 text-sm text-muted-foreground">
 Resumen de productividad por miembro. Cambia el mes para ver historico.
 </p>
 </div>
 <select
 value={selectedMonth}
 onChange={(e) => setSelectedMonth(e.target.value)}
 className="h-10 rounded-xl border border-input bg-transparent px-3 text-sm w-56"
 >
 {monthOptions.map((m) => (
 <option key={m} value={m}>{formatMonthLabel(m)}</option>
 ))}
 </select>
 </div>

 <div className="rounded-xl border border-border bg-card overflow-hidden">
 {loadingTeam ? (
 <div className="p-6 space-y-3">
 {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg"/>)}
 </div>
 ) : !teamData || teamData.items.length === 0 ? (
 <div className="flex flex-col items-center py-16 text-center">
 <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/50"/>
 <p className="text-muted-foreground">No hay datos para {formatMonthLabel(selectedMonth)}</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="bg-muted/50 border-b border-border">
 <tr className="text-left text-xs text-muted-foreground">
 <th className="px-5 py-3 font-medium">Miembro</th>
 <th className="px-5 py-3 font-medium text-right">Completadas</th>
 <th className="px-5 py-3 font-medium text-right">Horas</th>
 <th className="px-5 py-3 font-medium text-right">Prom. Días/Tarea</th>
 <th className="px-5 py-3 font-medium text-right">
 <span className="inline-flex items-center gap-1.5">
 Rendimiento
 <Tooltip>
 <TooltipTrigger asChild>
 <button type="button" className="text-muted-foreground/70 hover:text-foreground">
 <Info className="h-3 w-3"/>
 </button>
 </TooltipTrigger>
 <TooltipContent side="top" align="end" className="max-w-xs text-[11px]">
 % de tareas entregadas a tiempo. Se calcula como tareas completadas
 antes o en su fecha límite ÷ total de completadas en el mes.
 </TooltipContent>
 </Tooltip>
 </span>
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {teamData.items.map((m) => (
 <tr key={m.userId} className="hover:bg-muted/30 transition-colors">
 <td className="px-5 py-3.5">
 <div className="flex items-center gap-2.5">
 <Avatar className="h-7 w-7">
 <AvatarImage src={m.image} />
 <AvatarFallback className="text-[10px] bg-primary/15 text-primary">{getInitials(m.name)}</AvatarFallback>
 </Avatar>
 <div className="min-w-0">
 <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
 {m.role && <p className="text-[10px] text-muted-foreground">{m.role}</p>}
 </div>
 </div>
 </td>
 <td className="px-5 py-3.5 text-right text-foreground font-medium">{m.completedTasks}</td>
 <td className="px-5 py-3.5 text-right text-foreground font-medium">{m.hours}h</td>
 <td className="px-5 py-3.5 text-right text-muted-foreground">
 {m.avgDaysPerTask > 0 ? `${m.avgDaysPerTask}d` : '—'}
 </td>
 <td className="px-5 py-3.5 text-right">
 {m.performancePct !== null ? (
 <span className={`font-semibold ${m.performancePct >= 80 ? 'text-success' : m.performancePct >= 60 ? 'text-warning' : 'text-destructive'}`}>
 {m.performancePct}%
 </span>
 ) : (
 <span className="text-muted-foreground">—</span>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 <p className="text-[11px] text-muted-foreground italic px-1">
 Vista exclusiva para roles gerenciales (Cupo 1). Los datos se actualizan en tiempo real
 con los registros de tiempo confirmados.
 </p>
 </div>
 </TooltipProvider>
 );
 }

 // ── Render: Cupo 2 (Dev/QA/Designer) — solo resumen personal ──
 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-[22px] font-semibold text-foreground">Mi resumen</h1>
 <p className="mt-1 text-sm text-muted-foreground">Mis tareas y tiempo registrado.</p>
 </div>

 {loadingPersonal ? (
 <div className="grid gap-4 md:grid-cols-4">
 {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl"/>)}
 </div>
 ) : (
 <>
 {personalData && (
 <div className="rounded-xl border border-border bg-card p-6">
 <h2 className="mb-5 text-lg font-semibold text-foreground">Productividad</h2>
 <div className="grid gap-4 md:grid-cols-4">
 <div className="rounded-xl bg-primary/10 p-4">
 <div className="flex items-center gap-2 mb-1">
 <CheckCircle2 className="h-4 w-4 text-primary"/>
 <p className="text-xs text-muted-foreground">Completadas</p>
 </div>
 <p className="text-2xl font-bold text-foreground">{personalData.tasksCompleted ?? 0}</p>
 </div>
 <div className="rounded-xl bg-warning/10 p-4">
 <div className="flex items-center gap-2 mb-1">
 <TrendingUp className="h-4 w-4 text-warning"/>
 <p className="text-xs text-muted-foreground">En progreso</p>
 </div>
 <p className="text-2xl font-bold text-foreground">{personalData.tasksInProgress ?? 0}</p>
 </div>
 <div className="rounded-xl bg-success/10 p-4">
 <div className="flex items-center gap-2 mb-1">
 <Clock className="h-4 w-4 text-success"/>
 <p className="text-xs text-muted-foreground">Tiempo registrado</p>
 </div>
 <p className="text-2xl font-bold text-foreground">{formatDuration(personalData.totalTimeLogged ?? 0)}</p>
 </div>
 <div className="rounded-xl bg-info/10 p-4">
 <div className="flex items-center gap-2 mb-1">
 <BarChart3 className="h-4 w-4 text-info"/>
 <p className="text-xs text-muted-foreground">Productividad</p>
 </div>
 <p className="text-2xl font-bold text-foreground">{personalData.productivityScore ?? personalData.completionRate ?? 0}%</p>
 </div>
 </div>
 </div>
 )}

 {timeReport && timeReport.byProject && Array.isArray(timeReport.byProject) && timeReport.byProject.length > 0 && (
 <div className="rounded-xl border border-border bg-card p-6">
 <h2 className="mb-4 text-lg font-semibold text-foreground">Tiempo por proyecto</h2>
 <div className="space-y-2">
 {timeReport.byProject.map((p: any, i: number) => (
 <div key={i} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
 <span className="text-foreground">{p.projectName || p.project?.name || p.name}</span>
 <span className="font-medium text-primary">
 {formatDuration(p.totalDuration ?? p.minutes ?? (p.hours ? p.hours * 60 : 0))}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}

 {!personalData && !timeReport && (
 <div className="flex flex-col items-center rounded-xl bg-card py-16 text-center border border-border">
 <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/50"/>
 <p className="text-muted-foreground">No hay datos disponibles todavía</p>
 </div>
 )}
 </>
 )}
 </div>
 );
}
