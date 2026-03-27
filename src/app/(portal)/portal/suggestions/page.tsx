'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquarePlus, Clock, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pendiente', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800/50' },
  REVIEWING: { label: 'En Revision', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/50' },
  ACCEPTED: { label: 'Aceptada', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/50' },
  REJECTED: { label: 'Rechazada', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800/50' },
  IMPLEMENTED: { label: 'Implementada', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Baja', color: 'text-slate-400 dark:text-slate-500' },
  MEDIUM: { label: 'Media', color: 'text-blue-500 dark:text-blue-400' },
  HIGH: { label: 'Alta', color: 'text-indigo-500 dark:text-indigo-400' },
};

interface Suggestion {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  project?: {
    id: string;
    name: string;
  };
}

export default function PortalSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/portal/suggestions');
        const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setSuggestions(data);
      } catch (err) {
        toast.error('Error', 'Error al cargar las sugerencias');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[20px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Mis Sugerencias</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Historial de sugerencias y mejoras solicitadas para tus proyectos</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 dark:bg-blue-950/50">
          <MessageSquarePlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{suggestions.length} Total</span>
        </div>
      </div>

      {suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] bg-white py-20 text-center dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
            <MessageSquarePlus className="h-7 w-7 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Aun no hay sugerencias</h3>
          <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            Crea tu primera sugerencia desde la vista detallada de alguno de tus proyectos activos.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:gap-6">
          {suggestions.map((suggestion) => {
            const statusConf = STATUS_CONFIG[suggestion.status] || STATUS_CONFIG.PENDING;
            const prioConf = PRIORITY_CONFIG[suggestion.priority] || PRIORITY_CONFIG.MEDIUM;
            
            return (
              <div
                key={suggestion.id}
                className="group relative flex flex-col sm:flex-row gap-5 sm:items-center justify-between rounded-[24px] bg-white p-6 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-blue-500/20"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <Badge className={`${statusConf.bg} ${statusConf.color} border-none text-[10px] uppercase tracking-wider font-bold`}>
                      {statusConf.label}
                    </Badge>
                    <span className="text-xs font-semibold text-gray-400 px-2 py-0.5 rounded-full bg-gray-50 dark:bg-gray-800">
                      Proyecto: {suggestion.project?.name || 'Desconocido'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-white truncate">
                    {suggestion.title}
                  </h3>
                  {suggestion.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                      {suggestion.description}
                    </p>
                  )}
                  {suggestion.adminNotes && (
                    <div className="mt-3 flex gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                      <p className="leading-relaxed"><span className="font-semibold">Nota del admin:</span> {suggestion.adminNotes}</p>
                    </div>
                  )}
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 sm:border-l border-gray-100 dark:border-gray-800 pt-4 sm:pt-0 sm:pl-6 min-w-[140px]">
                  <div className="text-xs font-medium flex items-center gap-1.5">
                    <span className="text-gray-500 dark:text-gray-400">Prioridad:</span>
                    <span className={`font-bold ${prioConf.color}`}>{prioConf.label}</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(suggestion.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
