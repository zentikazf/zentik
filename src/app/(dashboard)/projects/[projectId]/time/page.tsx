'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimeEntryDialog } from '@/components/time/time-entry-dialog';
import {
 Clock, DollarSign, TrendingUp, Plus, Pencil, Trash2, Calendar,
 BarChart3, ArrowRight, FileText,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatDateTime, formatDuration } from '@/lib/utils';

export default function TimeTrackingPage() {
 const { projectId } = useParams<{ projectId: string }>();
 const [entries, setEntries] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [startDate, setStartDate] = useState('');
 const [endDate, setEndDate] = useState('');
 const [dialogOpen, setDialogOpen] = useState(false);
 const [editingEntry, setEditingEntry] = useState<any>(null);
 const [report, setReport] = useState<any>(null);

 const loadEntries = useCallback(async () => {
 try {
 const params = new URLSearchParams();
 params.set('projectId', projectId);
 if (startDate) params.set('startDate', startDate);
 if (endDate) params.set('endDate', endDate);
 const res = await api.get(`/time-entries?${params}`);
 setEntries(Array.isArray(res.data) ? res.data : res.data?.data || []);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al cargar registros de tiempo';
 toast.error('Error', message);
 } finally {
 setLoading(false);
 }
 }, [projectId, startDate, endDate]);

 const loadReport = useCallback(async () => {
 try {
 const res = await api.get(`/projects/${projectId}/time-report`);
 setReport(res.data);
 } catch {}
 }, [projectId]);

 useEffect(() => {
 loadEntries();
 loadReport();
 }, [projectId, loadEntries, loadReport]);

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/time-entries/${id}`);
 toast.success('Entrada eliminada');
 loadEntries();
 loadReport();
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al eliminar';
 toast.error('Error', message);
 }
 };

 const handleSaved = () => {
 loadEntries();
 loadReport();
 setEditingEntry(null);
 };

 const totalSeconds = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
 const billableSeconds = entries.filter((e) => e.billable).reduce((sum, e) => sum + (e.duration || 0), 0);
 const totalHours = (totalSeconds / 3600).toFixed(1);
 const billableHours = (billableSeconds / 3600).toFixed(1);

 // Get report distribution data
 const distribution = (() => {
 if (!report) return [];
 if (report.byTask) return report.byTask;
 if (Array.isArray(report)) return report;
 return [];
 })();
 const maxDuration = distribution.length > 0 ? Math.max(...distribution.map((r: any) => r.totalDuration || 0)) : 1;

 if (loading) {
 return (
 <div className="space-y-5">
 <Skeleton className="h-10 w-64 rounded-xl"/>
 <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
 {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl"/>)}
 </div>
 <Skeleton className="h-64 rounded-xl"/>
 </div>
 );
 }

 return (
 <div className="space-y-7">
 {/* Header */}
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
 <div>
 <h1 className="text-2xl font-bold tracking-tight text-foreground">
 Registro de Tiempo
 </h1>
 <p className="mt-1 text-sm text-muted-foreground">
 Controla y factura las horas de cada tarea del proyecto
 </p>
 </div>
 <Button className="rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"onClick={() => { setEditingEntry(null); setDialogOpen(true); }}>
 <Plus className="mr-2 h-4 w-4"/> Nueva Entrada
 </Button>
 </div>

 {/* KPI Cards — Portal Style */}
 <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
 {/* Card 1: Total Hours — Blue */}
 <div className="group relative overflow-hidden rounded-xl bg-primary p-5 shadow-lg shadow-primary/20 text-primary-foreground transition-all hover:shadow-primary/40 hover:-translate-y-1">
 <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-primary-foreground/10 blur-2xl transition-transform duration-500 group-hover:scale-110"/>
 <div className="flex items-center justify-between mb-4">
 <span className="text-sm font-medium text-primary-foreground/80">Tiempo Total</span>
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20 backdrop-blur-sm">
 <Clock className="h-4 w-4 text-primary-foreground"/>
 </div>
 </div>
 <h3 className="text-3xl font-bold">{totalHours}h</h3>
 <p className="mt-1 text-xs font-medium text-primary-foreground/80 flex items-center gap-1">
 <TrendingUp className="h-3 w-3"/> {entries.length} entradas
 </p>
 </div>

 {/* Card 2: Billable — Dark */}
 <div className="group relative overflow-hidden rounded-xl bg-card p-5 shadow-xl text-foreground border border-border transition-all hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30">
 <div className="flex items-center justify-between mb-4">
 <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Facturable</span>
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted border border-border group-hover:bg-primary/20 group-hover:border-primary/50 transition-colors">
 <DollarSign className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors"/>
 </div>
 </div>
 <h3 className="text-3xl font-bold">{billableHours}h</h3>
 <p className="mt-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
 <span className="text-primary">{totalSeconds > 0 ? Math.round((billableSeconds / totalSeconds) * 100) : 0}%</span> del total
 </p>
 </div>

 {/* Card 3: Non-billable — Dark */}
 <div className="group relative overflow-hidden rounded-xl bg-card p-5 shadow-xl text-foreground border border-border transition-all hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30">
 <div className="flex items-center justify-between mb-4">
 <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">No Facturable</span>
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted border border-border group-hover:bg-primary/20 group-hover:border-primary/50 transition-colors">
 <BarChart3 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors"/>
 </div>
 </div>
 <h3 className="text-3xl font-bold">{((totalSeconds - billableSeconds) / 3600).toFixed(1)}h</h3>
 <p className="mt-1 text-xs font-medium text-muted-foreground">Horas internas</p>
 </div>

 {/* Card 4: Entries — Light Blue */}
 <div className="group relative overflow-hidden rounded-xl bg-primary/80 p-5 shadow-lg shadow-primary/20 text-primary-foreground transition-all hover:shadow-primary/40 hover:-translate-y-1">
 <div className="absolute bottom-0 right-0 h-24 w-24 translate-x-4 translate-y-4 rounded-full bg-primary-foreground/20 blur-xl transition-transform duration-500 group-hover:scale-125"/>
 <div className="flex items-center justify-between mb-4">
 <span className="text-sm font-medium text-primary-foreground/90">Registros</span>
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20 backdrop-blur-sm">
 <FileText className="h-4 w-4 text-primary-foreground"/>
 </div>
 </div>
 <h3 className="text-3xl font-bold">{entries.length}</h3>
 <p className="mt-1 text-xs font-medium text-primary-foreground/90 flex items-center gap-1">
 Entradas de tiempo
 </p>
 </div>
 </div>

 {/* Filters */}
 <div className="rounded-[24px] bg-card p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border">
 <div className="flex flex-wrap items-end gap-4">
 <div className="space-y-1">
 <Label className="text-xs text-muted-foreground">Desde</Label>
 <Input type="date"value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 rounded-xl"/>
 </div>
 <div className="space-y-1">
 <Label className="text-xs text-muted-foreground">Hasta</Label>
 <Input type="date"value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 rounded-xl"/>
 </div>
 <Button variant="outline"size="sm"className="rounded-full"onClick={() => loadEntries()}>
 Filtrar
 </Button>
 {(startDate || endDate) && (
 <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-xs text-primary hover:underline">
 Limpiar
 </button>
 )}
 </div>
 </div>

 {/* Content Grid: Entries + Distribution */}
 <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
 {/* Entries List */}
 <div className="lg:col-span-2 space-y-3">
 <h2 className="text-lg font-bold text-foreground px-1">Entradas de Tiempo</h2>

 {entries.length === 0 ? (
 <div className="flex flex-col items-center rounded-[24px] bg-card py-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border">
 <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
 <Clock className="h-6 w-6 text-primary"/>
 </div>
 <p className="font-medium text-foreground">No hay registros de tiempo</p>
 <p className="mt-1 text-sm text-muted-foreground">Selecciona una tarea para registrar horas</p>
 </div>
 ) : (
 <div className="space-y-3">
 {entries.map((entry) => (
 <div key={entry.id} className="group rounded-xl bg-card p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border transition-all hover:shadow-lg hover:border-primary/30 ">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0 flex-1 space-y-1.5">
 <div className="flex items-center gap-2 flex-wrap">
 <p className="text-[15px] font-semibold text-foreground">
 {entry.task?.title || 'Tarea sin título'}
 </p>
 {entry.task?.identifier && (
 <Badge className="bg-primary/10 text-primary text-[10px]">{entry.task.identifier}</Badge>
 )}
 </div>
 {entry.description && (
 <p className="text-[13px] text-muted-foreground">{entry.description}</p>
 )}
 <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
 <span className="flex items-center gap-1">
 <Calendar className="h-3 w-3"/>
 {formatDateTime(entry.startTime)}
 </span>
 <ArrowRight className="h-3 w-3"/>
 <span>{entry.endTime ? formatDateTime(entry.endTime) : '—'}</span>
 </div>
 </div>

 <div className="flex items-center gap-2 shrink-0">
 <div className="text-right">
 <p className="font-mono text-lg font-bold text-foreground">
 {formatDuration(entry.duration || 0)}
 </p>
 {entry.billable && (
 <Badge className="bg-success/15 text-success text-[10px]">
 Facturable
 </Badge>
 )}
 </div>
 <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 <button
 onClick={() => { setEditingEntry(entry); setDialogOpen(true); }}
 className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
 >
 <Pencil className="h-3 w-3"/>
 </button>
 <button
 onClick={() => handleDelete(entry.id)}
 className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
 >
 <Trash2 className="h-3 w-3"/>
 </button>
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Distribution Sidebar */}
 <div className="space-y-5">
 <h2 className="text-lg font-bold text-foreground px-1">Distribución</h2>

 {distribution.length > 0 ? (
 <div className="rounded-[24px] bg-card p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border">
 <div className="space-y-4">
 {distribution.slice(0, 8).map((item: any, i: number) => {
 const dur = item.totalDuration || 0;
 const pct = maxDuration > 0 ? (dur / maxDuration) * 100 : 0;
 return (
 <div key={i} className="space-y-1.5">
 <div className="flex items-center justify-between text-sm">
 <span className="truncate font-medium text-foreground pr-2">
 {item.task?.title || item.taskTitle || `Tarea ${i + 1}`}
 </span>
 <span className="shrink-0 font-mono text-xs font-semibold text-primary">
 {formatDuration(dur)}
 </span>
 </div>
 <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
 <div
 className="h-full rounded-full bg-gradient-to-r from-primary/100 to-blue-400 transition-all duration-500"
 style={{ width: `${pct}%` }}
 />
 </div>
 </div>
 );
 })}
 </div>
 </div>
 ) : (
 <div className="rounded-[24px] bg-card p-6 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border">
 <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2"/>
 <p className="text-sm text-muted-foreground">Sin datos de distribución</p>
 </div>
 )}
 </div>
 </div>

 <TimeEntryDialog
 projectId={projectId}
 entry={editingEntry}
 open={dialogOpen}
 onOpenChange={setDialogOpen}
 onSaved={handleSaved}
 />
 </div>
 );
}
