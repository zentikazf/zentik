'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimeEntryDialog } from '@/components/time/time-entry-dialog';
import { Clock, DollarSign, Hash, Plus, Pencil, Trash2, Calendar } from 'lucide-react';
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

  const [report, setReport] = useState<any[]>([]);

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
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setReport(data);
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

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-[25px]" />
          <Skeleton className="h-24 rounded-[25px]" />
          <Skeleton className="h-24 rounded-[25px]" />
        </div>
        <Skeleton className="h-64 rounded-[25px]" />
      </div>
    );
  }

  const maxReportDuration = report.length > 0 ? Math.max(...report.map((r) => r.totalDuration || r.duration || 0)) : 1;

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Registro de Tiempo</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Controla las horas dedicadas a cada tarea del proyecto
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
              <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tiempo Total</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatDuration(totalSeconds)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Facturable</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatDuration(billableSeconds)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-950">
              <Hash className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Entradas</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{entries.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters + Add */}
      <div className="rounded-[25px] bg-white p-5 dark:bg-gray-900">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Desde</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Hasta</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
          </div>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => loadEntries()}>Aplicar</Button>
          <div className="flex-1" />
          <Button className="rounded-full" onClick={() => { setEditingEntry(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Entrada
          </Button>
        </div>
      </div>

      {/* Entries List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Entradas de Tiempo</h2>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center rounded-[25px] bg-white py-16 text-center dark:bg-gray-900">
            <Clock className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-400">No hay registros de tiempo</p>
            <p className="mt-1 text-sm text-gray-400">
              Usa el botón &quot;Agregar Entrada&quot; para registrar tiempo manualmente
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-[25px] bg-white p-5 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-medium text-gray-800 dark:text-white">
                        {entry.task?.title || 'Tarea sin título'}
                      </p>
                      {entry.task?.identifier && (
                        <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">{entry.task.identifier}</Badge>
                      )}
                    </div>
                    {entry.description && (
                      <p className="text-[13px] text-gray-400">{entry.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-[13px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(entry.startTime)}
                      </span>
                      <span>→</span>
                      <span>{formatDateTime(entry.endTime)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge className="bg-gray-100 font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {formatDuration(entry.duration || 0)}
                    </Badge>
                    {entry.billable && (
                      <Badge className="bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400">
                        Facturable
                      </Badge>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingEntry(entry); setDialogOpen(true); }}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Time Report */}
      {report.length > 0 && (
        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <h2 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white">Distribución de Tiempo</h2>
          <div className="space-y-4">
            {report.map((item, i) => {
              const duration = item.totalDuration || item.duration || 0;
              const pct = maxReportDuration > 0 ? (duration / maxReportDuration) * 100 : 0;
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium text-gray-800 dark:text-white">
                      {item.taskTitle || item.task?.title || item.memberName || item.name || `Ítem ${i + 1}`}
                    </span>
                    <span className="ml-4 shrink-0 font-mono text-gray-400">
                      {formatDuration(duration)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
