'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MessageSquarePlus, ChevronDown, ChevronUp, ArrowRightCircle, User,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendiente', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  { value: 'REVIEWING', label: 'En Revisión', color: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400' },
  { value: 'ACCEPTED', label: 'Aceptada', color: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400' },
  { value: 'REJECTED', label: 'Rechazada', color: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400' },
  { value: 'IMPLEMENTED', label: 'Implementada', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400' },
];

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Baja', color: 'bg-blue-50 text-blue-600' },
  MEDIUM: { label: 'Media', color: 'bg-yellow-50 text-yellow-600' },
  HIGH: { label: 'Alta', color: 'bg-orange-50 text-orange-600' },
};

export default function SuggestionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSuggestions();
  }, [projectId]);

  const loadSuggestions = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/suggestions`);
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setSuggestions(list);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al cargar sugerencias';
      toast.error('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (suggestionId: string, status: string) => {
    try {
      const res = await api.patch(`/projects/${projectId}/suggestions/${suggestionId}`, { status });
      setSuggestions((prev) => prev.map((s) => (s.id === suggestionId ? res.data : s)));
      toast.success('Estado actualizado');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al actualizar';
      toast.error('Error', msg);
    }
  };

  const handleSaveNotes = async (suggestionId: string) => {
    const notes = editingNotes[suggestionId];
    if (notes === undefined) return;
    try {
      const res = await api.patch(`/projects/${projectId}/suggestions/${suggestionId}`, {
        adminNotes: notes,
      });
      setSuggestions((prev) => prev.map((s) => (s.id === suggestionId ? res.data : s)));
      toast.success('Nota guardada');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al guardar nota';
      toast.error('Error', msg);
    }
  };

  const handleConvert = async (suggestionId: string) => {
    try {
      const res = await api.post(`/projects/${projectId}/suggestions/${suggestionId}/convert`);
      setSuggestions((prev) => prev.map((s) => (s.id === suggestionId ? res.data : s)));
      toast.success('Sugerencia convertida en tarea');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al convertir';
      toast.error('Error', msg);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-[25px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white flex items-center gap-2">
          <MessageSquarePlus className="h-5 w-5" />
          Sugerencias de Clientes
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Revisa, gestiona y convierte sugerencias de clientes en tareas
        </p>
      </div>

      {suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="rounded-[25px] bg-white p-8 text-center dark:bg-gray-900 max-w-md">
            <MessageSquarePlus className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Sin sugerencias</h2>
            <p className="mt-2 text-sm text-gray-500">
              Los clientes aún no han enviado sugerencias para este proyecto.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <div className="space-y-3">
            {suggestions.map((sug) => {
              const expanded = expandedId === sug.id;
              const statusInfo = STATUS_OPTIONS.find((s) => s.value === sug.status) || STATUS_OPTIONS[0];
              const priorityInfo = PRIORITY_LABELS[sug.priority] || PRIORITY_LABELS.MEDIUM;

              return (
                <div
                  key={sug.id}
                  className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden"
                >
                  {/* Row */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    onClick={() => setExpandedId(expanded ? null : sug.id)}
                  >
                    {expanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{sug.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {sug.client && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-400">
                            <User className="h-3 w-3" /> {sug.client.name}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400">
                          {new Date(sug.createdAt).toLocaleDateString('es-PY', {
                            day: '2-digit', month: 'short',
                          })}
                        </span>
                      </div>
                    </div>

                    <Badge className={priorityInfo.color + ' text-[10px]'}>{priorityInfo.label}</Badge>
                    <Badge className={statusInfo.color + ' text-[10px]'}>{statusInfo.label}</Badge>
                  </div>

                  {/* Expanded content */}
                  {expanded && (
                    <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-4 bg-gray-50/50 dark:bg-gray-800/20">
                      {sug.description && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Descripción</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{sug.description}</p>
                        </div>
                      )}

                      {/* Status change */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">Estado:</span>
                        <Select
                          value={sug.status}
                          onValueChange={(v) => handleStatusChange(sug.id, v)}
                        >
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Admin notes */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Nota interna</p>
                        <Textarea
                          value={editingNotes[sug.id] ?? sug.adminNotes ?? ''}
                          onChange={(e) =>
                            setEditingNotes((prev) => ({ ...prev, [sug.id]: e.target.value }))
                          }
                          placeholder="Agregar nota interna..."
                          rows={2}
                          className="text-xs"
                        />
                        {editingNotes[sug.id] !== undefined && editingNotes[sug.id] !== (sug.adminNotes ?? '') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 rounded-full text-xs"
                            onClick={() => handleSaveNotes(sug.id)}
                          >
                            Guardar nota
                          </Button>
                        )}
                      </div>

                      {/* Convert to task */}
                      {!sug.taskId && sug.status !== 'REJECTED' && (
                        <Button
                          size="sm"
                          className="rounded-full"
                          onClick={() => handleConvert(sug.id)}
                        >
                          <ArrowRightCircle className="mr-1.5 h-3.5 w-3.5" />
                          Convertir en Tarea
                        </Button>
                      )}

                      {sug.task && (
                        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3">
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Convertida en tarea: <strong>{sug.task.title}</strong> ({sug.task.status})
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
