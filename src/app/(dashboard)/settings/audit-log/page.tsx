'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import { formatDateTime, getInitials } from '@/lib/utils';

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  createdAt: string;
  user?: { id: string; name: string; image?: string | null };
}

const actionLabels: Record<string, string> = {
  create: 'Creó',
  created: 'Creó',
  update: 'Actualizó',
  updated: 'Actualizó',
  delete: 'Eliminó',
  deleted: 'Eliminó',
  assign: 'Asignó',
  complete: 'Completó',
  start: 'Inició',
  move: 'Movió',
};

const resourceLabels: Record<string, string> = {
  task: 'Tarea',
  project: 'Proyecto',
  sprint: 'Sprint',
  board: 'Tablero',
  column: 'Columna',
  member: 'Miembro',
  role: 'Rol',
  file: 'Archivo',
  invoice: 'Factura',
  organization: 'Organización',
};

export default function AuditLogPage() {
  const { orgId } = useOrg();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  useEffect(() => {
    if (orgId) loadEntries();
  }, [orgId, page]);

  const loadEntries = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await api.get<any>(`/organizations/${orgId}/audit-log?page=${page}&limit=${limit}`);
      const data = res.data;
      setEntries(Array.isArray(data) ? data : data?.data || []);
      setTotal(data?.total || data?.meta?.total || 0);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al cargar el registro';
      toast.error('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Registro de Actividad</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Historial completo de acciones en tu organización
        </p>
      </div>

      <div className="rounded-[25px] bg-white dark:bg-gray-900">
        {loading ? (
          <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/2 rounded" />
                  <Skeleton className="h-3 w-1/4 rounded" />
                </div>
                <Skeleton className="h-3 w-32 rounded" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            No hay registros de actividad
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden border-b border-gray-100 px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-400 md:grid md:grid-cols-12 md:gap-4 dark:border-gray-800">
              <div className="col-span-3">Usuario</div>
              <div className="col-span-3">Acción</div>
              <div className="col-span-2">Recurso</div>
              <div className="col-span-2">Fecha</div>
              <div className="col-span-2">IP</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="grid items-center gap-4 px-6 py-4 text-sm md:grid-cols-12"
                >
                  <div className="col-span-3 flex items-center gap-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-blue-100 text-[10px] font-semibold text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                        {getInitials(entry.user?.name || '?')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate font-medium text-gray-800 dark:text-white">{entry.user?.name || 'Sistema'}</span>
                  </div>

                  <div className="col-span-3 text-gray-500 dark:text-gray-400">
                    {actionLabels[entry.action.toLowerCase()] || entry.action}
                  </div>

                  <div className="col-span-2">
                    <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                      {resourceLabels[entry.resource.toLowerCase()] || entry.resource}
                    </Badge>
                  </div>

                  <div className="col-span-2 text-xs text-gray-400">
                    {formatDateTime(entry.createdAt)}
                  </div>

                  <div className="col-span-2 font-mono text-xs text-gray-400">
                    {entry.ipAddress || '—'}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 dark:border-gray-800">
            <span className="text-sm text-gray-400">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Siguiente <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
