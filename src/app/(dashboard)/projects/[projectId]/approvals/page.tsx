'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { cn, getInitials, formatDate } from '@/lib/utils';

export default function ProjectApprovalsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}/approvals`);
      setTasks(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al cargar aprobaciones';
      toast.error('Error', message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleApprove = async (taskId: string) => {
    setProcessing(taskId);
    try {
      await api.post(`/tasks/${taskId}/approve`);
      toast.success('Aprobada', 'La tarea fue aprobada y movida a Deploy');
      await loadApprovals();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al aprobar';
      toast.error('Error', message);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (taskId: string) => {
    setProcessing(taskId);
    try {
      await api.post(`/tasks/${taskId}/reject`, { reason: rejectReason || undefined });
      toast.success('Rechazada', 'La tarea fue devuelta a Desarrollo');
      setRejectingId(null);
      setRejectReason('');
      await loadApprovals();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al rechazar';
      toast.error('Error', message);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-sm px-3 py-1">
          {tasks.length} pendiente{tasks.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 dark:bg-gray-900">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Todo al día</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            No hay tareas pendientes de aprobación
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-2xl bg-white p-5 transition-shadow hover:shadow-md dark:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="truncate text-[15px] font-semibold text-gray-800 dark:text-white">
                      {task.title}
                    </h3>
                    {task.reviewAttempts > 0 && (
                      <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Intento #{task.reviewAttempts + 1}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    {task.column && <span>{task.column.name}</span>}
                    {task.updatedAt && <span>{formatDate(task.updatedAt)}</span>}
                  </div>

                  {task.assignees?.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-gray-400">Asignados:</span>
                      <div className="flex -space-x-1">
                        {task.assignees.map((u: any) => (
                          <Avatar key={u.id} className="h-6 w-6 border border-white dark:border-gray-900">
                            <AvatarImage src={u.image} />
                            <AvatarFallback className="bg-blue-100 text-[10px] text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                              {getInitials(u.name || '')}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {rejectingId === task.id ? (
                    <div className="flex flex-col gap-2">
                      <Textarea
                        placeholder="Motivo del rechazo (opcional)"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-64 text-sm"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 rounded-full"
                          onClick={() => { setRejectingId(null); setRejectReason(''); }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 rounded-full bg-red-600 hover:bg-red-700"
                          onClick={() => handleReject(task.id)}
                          disabled={processing === task.id}
                        >
                          Confirmar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="rounded-full bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(task.id)}
                        disabled={processing === task.id}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => setRejectingId(task.id)}
                        disabled={processing === task.id}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Rechazar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
