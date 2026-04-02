'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, Clock, CheckCircle2, DollarSign } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import { formatDuration } from '@/lib/utils';

const orgReportTypes = [
 { value: 'overview', label: 'Resumen General' },
 { value: 'tasks', label: 'Reporte de Tareas' },
 { value: 'time', label: 'Reporte de Tiempo' },
 { value: 'team', label: 'Rendimiento del Equipo' },
 { value: 'productivity', label: 'Productividad' },
 { value: 'profitability', label: 'Rentabilidad' },
];

export default function ReportsPage() {
 const { orgId } = useOrg();
 const [reportType, setReportType] = useState('overview');
 const [data, setData] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const [startDate, setStartDate] = useState('');
 const [endDate, setEndDate] = useState('');
 const [personalData, setPersonalData] = useState<any>(null);
 const [timeReport, setTimeReport] = useState<any>(null);

 useEffect(() => {
 if (orgId) loadReport();
 }, [reportType, orgId]);

 useEffect(() => {
 loadPersonalSummary();
 loadTimeReport();
 }, []);

 const loadReport = async () => {
 if (!orgId) return;
 setLoading(true);
 try {
 const params = new URLSearchParams();
 if (startDate) params.set('startDate', startDate);
 if (endDate) params.set('endDate', endDate);
 const qs = params.toString() ? `?${params}` : '';
 const res = await api.get(`/organizations/${orgId}/reports/${reportType}${qs}`);
 setData(res.data);
 } catch (err) {
 setData(null);
 if (err instanceof ApiError) toast.error('Error', err.message);
 } finally {
 setLoading(false);
 }
 };

 const loadPersonalSummary = async () => {
 try {
 const res = await api.get('/users/me/reports/summary');
 setPersonalData(res.data);
 } catch {}
 };

 const loadTimeReport = async () => {
 try {
 const res = await api.get('/users/me/time-report');
 setTimeReport(res.data);
 } catch {}
 };

 return (
 <div className="space-y-7">
 <div>
 <h1 className="text-[22px] font-semibold text-foreground">Reportes</h1>
 <p className="mt-1 text-sm text-muted-foreground">Análisis y métricas de tu organización</p>
 </div>

 {/* Personal Summary */}
 {personalData && (
 <div className="rounded-xl border border-border bg-card p-6">
 <h2 className="mb-5 text-lg font-semibold text-foreground">Mi Resumen Personal</h2>
 <div className="grid gap-4 md:grid-cols-4">
 <div className="rounded-xl bg-primary/10 p-4">
 <p className="text-sm text-muted-foreground">Tareas completadas</p>
 <p className="mt-1 text-2xl font-bold text-foreground">{personalData.tasksCompleted ?? 0}</p>
 </div>
 <div className="rounded-xl bg-warning/10 p-4">
 <p className="text-sm text-muted-foreground">En progreso</p>
 <p className="mt-1 text-2xl font-bold text-foreground">{personalData.tasksInProgress ?? 0}</p>
 </div>
 <div className="rounded-xl bg-success/10 p-4">
 <p className="text-sm text-muted-foreground">Tiempo registrado</p>
 <p className="mt-1 text-2xl font-bold text-foreground">{formatDuration(personalData.totalTimeLogged ?? 0)}</p>
 </div>
 <div className="rounded-xl bg-info/10 p-4">
 <p className="text-sm text-muted-foreground">Productividad</p>
 <p className="mt-1 text-2xl font-bold text-foreground">{personalData.productivityScore ?? personalData.completionRate ?? 0}%</p>
 </div>
 </div>
 </div>
 )}

 {/* Personal Time Report */}
 {timeReport && (
 <div className="rounded-xl border border-border bg-card p-6">
 <h2 className="mb-5 text-lg font-semibold text-foreground">Mi Reporte de Tiempo</h2>
 <div className="grid gap-4 md:grid-cols-3">
 <div className="rounded-xl bg-primary/10 p-4">
 <p className="text-sm text-muted-foreground">Total registrado</p>
 <p className="mt-1 text-2xl font-bold text-foreground">{formatDuration(timeReport.totalMinutes ?? (timeReport.totalHours ? timeReport.totalHours * 60 : 0))}</p>
 </div>
 <div className="rounded-xl bg-success/10 p-4">
 <p className="text-sm text-muted-foreground">Horas facturables</p>
 <p className="mt-1 text-2xl font-bold text-foreground">{formatDuration(timeReport.billableMinutes ?? (timeReport.billableHours ? timeReport.billableHours * 60 : 0))}</p>
 </div>
 <div className="rounded-xl bg-muted p-4">
 <p className="text-sm text-muted-foreground">Entradas</p>
 <p className="mt-1 text-2xl font-bold text-foreground">{timeReport.totalEntries ?? timeReport.entries?.length ?? 0}</p>
 </div>
 </div>
 {timeReport.byProject && Array.isArray(timeReport.byProject) && timeReport.byProject.length > 0 && (
 <div className="mt-5 space-y-2">
 <p className="text-sm font-medium text-muted-foreground">Por proyecto</p>
 {timeReport.byProject.map((p: any, i: number) => (
 <div key={i} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
 <span className="text-foreground">{p.projectName || p.name}</span>
 <span className="font-medium text-primary">{formatDuration(p.minutes ?? (p.hours ? p.hours * 60 : 0))}</span>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* Filters */}
 <div className="rounded-xl border border-border bg-card p-5">
 <div className="flex flex-wrap items-end gap-4">
 <div className="w-56">
 <Select value={reportType} onValueChange={setReportType}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {orgReportTypes.map((r) => (
 <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-1">
 <Label className="text-xs text-muted-foreground">Desde</Label>
 <Input type="date"value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40"/>
 </div>
 <div className="space-y-1">
 <Label className="text-xs text-muted-foreground">Hasta</Label>
 <Input type="date"value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40"/>
 </div>
 <Button variant="outline"size="sm"onClick={loadReport} className="rounded-full">Aplicar</Button>
 </div>
 </div>

 {loading ? (
 <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
 {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl"/>)}
 </div>
 ) : data ? (
 <>
 <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
 {data.tasksCompleted !== undefined && (
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Tareas Completadas</p>
 <p className="mt-1 text-3xl font-bold text-foreground">{data.tasksCompleted}</p>
 </div>
 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
 <CheckCircle2 className="h-6 w-6 text-success"/>
 </div>
 </div>
 </div>
 )}
 {data.tasksInProgress !== undefined && (
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">En Progreso</p>
 <p className="mt-1 text-3xl font-bold text-foreground">{data.tasksInProgress}</p>
 </div>
 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
 <TrendingUp className="h-6 w-6 text-primary"/>
 </div>
 </div>
 </div>
 )}
 {data.totalTimeLogged !== undefined && (
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Tiempo Registrado</p>
 <p className="mt-1 text-3xl font-bold text-foreground">{formatDuration(data.totalTimeLogged)}</p>
 </div>
 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
 <Clock className="h-6 w-6 text-warning"/>
 </div>
 </div>
 </div>
 )}
 {data.completionRate !== undefined && (
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Tasa de Completado</p>
 <p className="mt-1 text-3xl font-bold text-foreground">{data.completionRate}%</p>
 </div>
 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-info/10">
 <BarChart3 className="h-6 w-6 text-info"/>
 </div>
 </div>
 </div>
 )}
 {data.totalRevenue !== undefined && (
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Ingresos Totales</p>
 <p className="mt-1 text-3xl font-bold text-foreground">${data.totalRevenue}</p>
 </div>
 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
 <DollarSign className="h-6 w-6 text-success"/>
 </div>
 </div>
 </div>
 )}
 </div>

 {data.members && Array.isArray(data.members) && data.members.length > 0 && (
 <div className="rounded-xl border border-border bg-card p-6">
 <h2 className="mb-5 text-lg font-semibold text-foreground">Por Miembro</h2>
 <div className="space-y-3">
 {data.members.map((m: any, i: number) => (
 <div key={i} className="flex items-center justify-between rounded-xl border border-border p-3">
 <span className="font-medium text-foreground">{m.name || m.userName || `Miembro ${i + 1}`}</span>
 <div className="flex items-center gap-4 text-sm text-muted-foreground">
 {m.tasksCompleted !== undefined && <span>{m.tasksCompleted} completadas</span>}
 {m.timeLogged !== undefined && <span>{formatDuration(m.timeLogged)}</span>}
 {m.score !== undefined && <span className="font-bold text-primary">{m.score}%</span>}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {data.projects && Array.isArray(data.projects) && data.projects.length > 0 && (
 <div className="rounded-xl border border-border bg-card p-6">
 <h2 className="mb-5 text-lg font-semibold text-foreground">Por Proyecto</h2>
 <div className="space-y-3">
 {data.projects.map((p: any, i: number) => (
 <div key={i} className="flex items-center justify-between rounded-xl border border-border p-3">
 <span className="font-medium text-foreground">{p.name || `Proyecto ${i + 1}`}</span>
 <div className="flex items-center gap-4 text-sm">
 {p.revenue !== undefined && <span className="text-success">${p.revenue}</span>}
 {p.cost !== undefined && <span className="text-destructive">-${p.cost}</span>}
 {p.profit !== undefined && <span className="font-bold text-foreground">${p.profit}</span>}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </>
 ) : (
 <div className="flex flex-col items-center rounded-xl bg-card py-16 text-center">
 <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/50"/>
 <p className="text-muted-foreground">No hay datos disponibles para este reporte</p>
 </div>
 )}
 </div>
 );
}
