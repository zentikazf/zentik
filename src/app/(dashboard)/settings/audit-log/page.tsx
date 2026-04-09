'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  ChevronRight,
  Activity,
  Zap,
  Edit3,
  Trash2,
  UserPlus,
  CheckCircle,
  FolderKanban,
  BarChart3,
  ArrowUpRight,
  FileText,
  MessageSquare,
  CalendarDays,
  AlertTriangle,
  Clock,
  Target,
  ShieldAlert,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from '@/hooks/use-toast';

// ── Mapeos ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Nuevo',
  TODO: 'Pendiente',
  IN_PROGRESS: 'En Desarrollo',
  IN_REVIEW: 'En Revisión',
  DONE: 'Completada',
  CANCELLED: 'Cancelada',
};

const activityIcons: Record<string, typeof Activity> = {
  'task.created': Zap,
  'task.updated': Edit3,
  'task.completed': CheckCircle,
  'task.deleted': Trash2,
  'task.assigned': UserPlus,
  'task.status.changed': ArrowUpRight,
  'task.approval.requested': Clock,
  'task.approval.approved': CheckCircle,
  'task.approval.rejected': AlertTriangle,
  'subtask.created': Zap,
  'project.created': FolderKanban,
  'project.updated': Edit3,
  'sprint.created': BarChart3,
  'sprint.started': ArrowUpRight,
  'sprint.completed': CheckCircle,
  'file.uploaded': FileText,
  'suggestion.created': MessageSquare,
  'meeting.created': CalendarDays,
  'meeting.updated': CalendarDays,
  'meeting.deleted': Trash2,
  'organization.member.joined': UserPlus,
  'organization.member.removed': Trash2,
  'task.label.added': Target,
  'task.label.removed': Target,
};

const activityLabels: Record<string, string> = {
  'task.created': 'creó una tarea',
  'task.updated': 'actualizó una tarea',
  'task.completed': 'completó una tarea',
  'task.deleted': 'eliminó una tarea',
  'task.assigned': 'asignó una tarea',
  'task.unassigned': 'desasignó una tarea',
  'task.status.changed': 'cambió el estado de una tarea',
  'task.label.added': 'agregó etiqueta',
  'task.label.removed': 'removió etiqueta',
  'task.approval.requested': 'solicitó aprobación de tarea',
  'task.approval.approved': 'aprobó una tarea',
  'task.approval.rejected': 'rechazó una tarea',
  'subtask.created': 'creó una subtarea',
  'project.created': 'creó un proyecto',
  'project.updated': 'actualizó un proyecto',
  'sprint.created': 'creó un sprint',
  'sprint.started': 'inició un sprint',
  'sprint.completed': 'completó un sprint',
  'file.uploaded': 'subió un archivo',
  'file.deleted': 'eliminó un archivo',
  'suggestion.created': 'envió una sugerencia',
  'board.column.created': 'creó una columna',
  'board.column.updated': 'actualizó una columna',
  'meeting.created': 'programó una reunión',
  'meeting.updated': 'actualizó una reunión',
  'meeting.deleted': 'canceló una reunión',
  'organization.member.joined': 'se unió a la organización',
  'organization.member.removed': 'fue removido de la organización',
};

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  createdAt: string;
  newData?: Record<string, any> | null;
  user?: { id: string; name: string; image?: string | null };
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `hace ${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function getActivityDetail(entry: AuditEntry): string {
  const data = entry.newData || {};
  if (entry.action === 'task.status.changed' && data.fromStatus && data.toStatus) {
    return `${STATUS_LABELS[data.fromStatus] || data.fromStatus} → ${STATUS_LABELS[data.toStatus] || data.toStatus}`;
  }
  if ((entry.action === 'task.label.added' || entry.action === 'task.label.removed') && data.labelName) {
    return data.labelName;
  }
  if (entry.action === 'organization.member.joined' && data.userName) {
    return `${data.userName} como ${data.roleName || 'miembro'}`;
  }
  if (entry.action === 'organization.member.removed' && data.userName) {
    return data.userName;
  }
  if ((entry.action === 'meeting.created' || entry.action === 'subtask.created') && data.title) {
    return data.title;
  }
  return '';
}

export default function AuditLogPage() {
  const { orgId } = useOrg();
  const { isOwner } = usePermissions();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  useEffect(() => {
    if (!orgId || !isOwner) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get<any>(`/organizations/${orgId}/audit-log?page=${page}&limit=${limit}`);
        if (cancelled) return;
        const data = res.data;
        setEntries(Array.isArray(data) ? data : data?.data || []);
        setTotal(data?.total || data?.meta?.total || 0);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'Error al cargar el registro';
        toast.error('Error', message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [orgId, page, isOwner]);

  // Acceso restringido al Owner.
  if (!isOwner) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold text-foreground">Registro de Actividad</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Historial completo de acciones en tu organización
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Acceso restringido</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            El registro de actividad solo es visible para el propietario (Owner) de la organización.
          </p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold text-foreground">Registro de Actividad</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historial completo de acciones en tu organización
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-[38px] w-[38px] rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/2 rounded" />
                  <Skeleton className="h-3 w-1/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No hay registros de actividad
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-0.5">
              {entries.map((entry) => {
                const IconComp = activityIcons[entry.action] || Activity;
                const label = activityLabels[entry.action] || entry.action;
                const resourceName =
                  entry.newData?.title ||
                  entry.newData?.name ||
                  entry.resourceId?.slice(0, 8);
                const detail = getActivityDetail(entry);

                return (
                  <div
                    key={entry.id}
                    className="relative flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="relative z-10 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-muted ring-4 ring-card">
                      <IconComp className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-card-foreground">
                          {entry.user?.name || entry.newData?.userName || 'Sistema'}
                        </span>{' '}
                        {label}
                        {resourceName && (
                          <>
                            {' '}
                            <span className="font-medium text-foreground/70">
                              &quot;{resourceName}&quot;
                            </span>
                          </>
                        )}
                      </p>
                      {detail && (
                        <p className="mt-0.5 text-xs font-medium text-primary">{detail}</p>
                      )}
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{timeAgo(entry.createdAt)}</span>
                        {entry.resource && (
                          <>
                            <span className="opacity-30">·</span>
                            <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 py-0 font-normal">
                              {entry.resource}
                            </Badge>
                          </>
                        )}
                        {entry.ipAddress && (
                          <>
                            <span className="opacity-30">·</span>
                            <span className="font-mono">{entry.ipAddress}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">
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
