'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { ticketService } from '@/services/ticket.service';
import { TaskHoursGateDialog } from '@/components/task/task-hours-gate-dialog';
import {
  STATUS_LABEL,
  getValidTransitions,
} from './ticket-status-machine';
import type {
  TicketStatus,
  TicketDetail,
  TicketAssignee,
} from '@/types/ticket.types';

interface OrgMember {
  id: string;
  userId: string;
  user: { id: string; name: string; email?: string; image?: string | null };
}

interface TicketActionBarProps {
  ticket: TicketDetail;
  onUpdated: (updated: TicketDetail) => void;
}

export function TicketActionBar({ ticket, onUpdated }: TicketActionBarProps) {
  const { orgId } = useOrg();
  const currentAssignee = ticket.task?.assignments?.[0]?.user ?? null;

  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [assigneeId, setAssigneeId] = useState<string>(currentAssignee?.id ?? '');
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);

  // H6 — gate de horas reactivo: resolver un ticket sin horas en su task abre el diálogo.
  const [gateOpen, setGateOpen] = useState(false);
  const [gateInfo, setGateInfo] = useState<{
    taskId: string;
    targetStatus: string;
    canCloseWithoutHours: boolean;
    logHoursEndpoint?: string;
    payload: { status?: TicketStatus; assigneeId?: string | null };
  } | null>(null);

  // Re-sync local state when ticket changes (WS push, etc.)
  useEffect(() => {
    setStatus(ticket.status);
    setAssigneeId(ticket.task?.assignments?.[0]?.user.id ?? '');
  }, [ticket.id, ticket.status, ticket.task?.assignments]);

  useEffect(() => {
    if (!orgId) return;
    setLoadingMembers(true);
    api
      .get<{ data?: OrgMember[] } | OrgMember[]>(`/organizations/${orgId}/members`)
      .then((res) => {
        const list = Array.isArray(res.data)
          ? (res.data as OrgMember[])
          : ((res.data as { data?: OrgMember[] })?.data ?? []);
        setMembers(list);
      })
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, [orgId]);

  const validStatuses = useMemo(() => getValidTransitions(ticket.status), [ticket.status]);

  const hasChanges =
    status !== ticket.status ||
    (assigneeId || '') !== (currentAssignee?.id ?? '');

  const handleConfirm = async () => {
    if (!hasChanges || saving) return;

    const payload: { status?: TicketStatus; assigneeId?: string | null } = {};
    if (status !== ticket.status) payload.status = status;
    if ((assigneeId || '') !== (currentAssignee?.id ?? '')) {
      payload.assigneeId = assigneeId || null;
    }

    setSaving(true);
    try {
      const res = await ticketService.update(ticket.id, payload);
      onUpdated(res.data);

      const parts: string[] = [];
      if (payload.status) parts.push(`Estado: ${STATUS_LABEL[payload.status]}`);
      if (payload.assigneeId !== undefined) {
        const name = members.find((m) => m.user.id === payload.assigneeId)?.user.name;
        parts.push(payload.assigneeId ? `Asignado: ${name}` : 'Sin asignar');
      }
      toast.success('Ticket actualizado', parts.join(' · '));
    } catch (err) {
      // H6: el ticket no tiene horas reales en su task → abrir el diálogo del gate
      // apuntando a ticket.task.id, en vez del toast genérico.
      if (err instanceof ApiError && err.code === 'WORK_HOURS_REQUIRED' && ticket.task?.id) {
        const d = (err.details || {}) as Record<string, unknown>;
        setGateInfo({
          taskId: (d.taskId as string) || ticket.task.id,
          targetStatus: (d.targetStatus as string) || 'IN_REVIEW',
          canCloseWithoutHours: !!d.canCloseWithoutHours,
          logHoursEndpoint: d.logHoursEndpoint as string | undefined,
          payload,
        });
        setGateOpen(true);
        return;
      }
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo actualizar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Estado */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Estado</label>
          <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {validStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Asignado */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Asignado</label>
          <Select
            value={assigneeId || 'none'}
            onValueChange={(v) => setAssigneeId(v === 'none' ? '' : v)}
            disabled={loadingMembers}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={loadingMembers ? 'Cargando...' : 'Sin asignar'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Boton confirmar — aparece solo si hay cambios pendientes */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          hasChanges ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <Button
          onClick={handleConfirm}
          disabled={saving || !hasChanges}
          className="w-full h-9 gap-2"
          size="sm"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {saving ? 'Guardando...' : 'Confirmar cambios'}
        </Button>
      </div>
    </div>

    {gateInfo && (
      <TaskHoursGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        taskId={gateInfo.taskId}
        targetLabel={gateInfo.targetStatus === 'DONE' ? 'Completada' : 'En Revisión'}
        canCloseWithoutHours={gateInfo.canCloseWithoutHours}
        logHoursEndpoint={gateInfo.logHoursEndpoint}
        onLogged={async () => {
          // Horas registradas → reintentar la transición del ticket.
          const res = await ticketService.update(ticket.id, gateInfo.payload);
          onUpdated(res.data);
        }}
        onEscape={async (reason) => {
          // Cerrar la task sin horas (audita) y luego re-aplicar la transición del ticket.
          await api.patch(`/tasks/${gateInfo.taskId}`, {
            status: gateInfo.targetStatus,
            closeWithoutHours: true,
            closeWithoutHoursReason: reason,
          });
          const res = await ticketService.update(ticket.id, gateInfo.payload);
          onUpdated(res.data);
        }}
      />
    )}
    </>
  );
}
