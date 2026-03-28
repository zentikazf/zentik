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
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-[25px]" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Registro de Tiempo
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Controla y factura las horas de cada tarea del proyecto
          </p>
        </div>
        <Button className="rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25" onClick={() => { setEditingEntry(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Entrada
        </Button>
      </div>

      {/* KPI Cards — Portal Style */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        {/* Card 1: Total Hours — Blue */}
        <div className="group relative overflow-hidden rounded-[20px] bg-blue-500 p-5 shadow-lg shadow-blue-500/20 text-white transition-all hover:shadow-blue-500/40 hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-blue-400/30 blur-2xl transition-transform duration-500 group-hover:scale-110" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-blue-100">Tiempo Total</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Clock className="h-4 w-4 text-white" />
            </div>
          </div>
          <h3 className="text-3xl font-bold">{totalHours}h</h3>
          <p className="mt-1 text-xs font-medium text-blue-100 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> {entries.length} entradas
          </p>
        </div>

        {/* Card 2: Billable — Dark */}
        <div className="group relative overflow-hidden rounded-[20px] bg-gray-900 dark:bg-gray-950 p-5 shadow-xl text-white border border-gray-800 transition-all hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 hover:border-blue-500/30">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">Facturable</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 group-hover:bg-blue-500/20 group-hover:border-blue-500/50 transition-colors">
              <DollarSign className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
            </div>
          </div>
          <h3 className="text-3xl font-bold">{billableHours}h</h3>
          <p className="mt-1 text-xs font-medium text-gray-400 flex items-center gap-1">
            <span className="text-blue-400">{totalSeconds > 0 ? Math.round((billableSeconds / totalSeconds) * 100) : 0}%</span> del total
          </p>
        </div>

        {/* Card 3: Non-billable — Dark */}
        <div className="group relative overflow-hidden rounded-[20px] bg-gray-900 dark:bg-gray-950 p-5 shadow-xl text-white border border-gray-800 transition-all hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 hover:border-blue-500/30">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">No Facturable</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 group-hover:bg-blue-500/20 group-hover:border-blue-500/50 transition-colors">
              <BarChart3 className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
            </div>
          </div>
          <h3 className="text-3xl font-bold">{((totalSeconds - billableSeconds) / 3600).toFixed(1)}h</h3>
          <p className="mt-1 text-xs font-medium text-gray-400">Horas internas</p>
        </div>

        {/* Card 4: Entries — Light Blue */}
        <div className="group relative overflow-hidden rounded-[20px] bg-blue-400 p-5 shadow-lg shadow-blue-400/20 text-white transition-all hover:shadow-blue-400/40 hover:-translate-y-1">
          <div className="absolute bottom-0 right-0 h-24 w-24 translate-x-4 translate-y-4 rounded-full bg-white/20 blur-xl transition-transform duration-500 group-hover:scale-125" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-blue-50">Registros</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <FileText className="h-4 w-4 text-white" />
            </div>
          </div>
          <h3 className="text-3xl font-bold">{entries.length}</h3>
          <p className="mt-1 text-xs font-medium text-blue-50 flex items-center gap-1">
            Entradas de tiempo
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-[24px] bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Desde</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Hasta</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 rounded-xl" />
          </div>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => loadEntries()}>
            Filtrar
          </Button>
          {(startDate || endDate) && (
            <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-xs text-blue-600 hover:underline">
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Content Grid: Entries + Distribution */}
      <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
        {/* Entries List */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white px-1">Entradas de Tiempo</h2>

          {entries.length === 0 ? (
            <div className="flex flex-col items-center rounded-[24px] bg-white py-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="font-medium text-gray-800 dark:text-white">No hay registros de tiempo</p>
              <p className="mt-1 text-sm text-gray-400">Selecciona una tarea para registrar horas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="group rounded-[20px] bg-white p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:bg-gray-900 border border-gray-100 dark:border-gray-800 transition-all hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[15px] font-semibold text-gray-800 dark:text-white">
                          {entry.task?.title || 'Tarea sin título'}
                        </p>
                        {entry.task?.identifier && (
                          <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 text-[10px]">{entry.task.identifier}</Badge>
                        )}
                      </div>
                      {entry.description && (
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">{entry.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-[12px] text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateTime(entry.startTime)}
                        </span>
                        <ArrowRight className="h-3 w-3" />
                        <span>{entry.endTime ? formatDateTime(entry.endTime) : '—'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="font-mono text-lg font-bold text-gray-800 dark:text-white">
                          {formatDuration(entry.duration || 0)}
                        </p>
                        {entry.billable && (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-[10px]">
                            Facturable
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingEntry(entry); setDialogOpen(true); }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
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
          <h2 className="text-lg font-bold text-gray-800 dark:text-white px-1">Distribución</h2>

          {distribution.length > 0 ? (
            <div className="rounded-[24px] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <div className="space-y-4">
                {distribution.slice(0, 8).map((item: any, i: number) => {
                  const dur = item.totalDuration || 0;
                  const pct = maxDuration > 0 ? (dur / maxDuration) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate font-medium text-gray-800 dark:text-white pr-2">
                          {item.task?.title || item.taskTitle || `Tarea ${i + 1}`}
                        </span>
                        <span className="shrink-0 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {formatDuration(dur)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] bg-white p-6 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <BarChart3 className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-400">Sin datos de distribución</p>
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
