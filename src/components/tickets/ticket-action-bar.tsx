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
import { Loader2, Check, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { ticketService } from '@/services/ticket.service';
import { TaskHoursGateDialog } from '@/components/task/task-hours-gate-dialog';
import { CancelTicketDialog } from './cancel-ticket-dialog';
import { ReclassifyTicketDialog } from './reclassify-ticket-dialog';
import {
  STATUS_LABEL,
  getSelectableTransitions,
  canCancel,
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

  // #43 — cancelar es una acción dedicada (comentario obligatorio), no un valor del Select.
  const [cancelOpen, setCancelOpen] = useState(false);

  // H6 — gate de horas reactivo: resolver un ticket sin horas en su task abre el diálogo.
  const [gateOpen, setGateOpen] = useState(false);
  const [gateInfo, setGateInfo] = useState<{
    taskId: string;
    targetStatus: string;
    canCloseWithoutHours: boolean;
    logHoursEndpoint?: string;
    payload: { status?: TicketStatus; assigneeId?: string | null };
  } | null>(null);

  // #44 — gate de tipificación reactivo: resolver sin tipificar abre el diálogo de
  // tipificación en modo gate y, al guardar, reintenta la resolución (patrón del gate de horas).
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [classifyInfo, setClassifyInfo] = useState<{
    missing: ('ticketType' | 'categoryConfig')[];
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

  // #43: el Select solo ofrece estados seleccionables (Nuevo/En curso/Resuelto) +
  // el actual. «Cancelado» sale por el botón/diálogo; «En revisión» es tombstone.
  const validStatuses = useMemo(() => getSelectableTransitions(ticket.status), [ticket.status]);
  const showCancel = canCancel(ticket.status);

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
      // H8c: reabrir el ticket movería la task fuera de DONE; si está facturada → 409.
      // Bloqueo duro (sin escape): toast claro, la nota de crédito es H9.
      if (err instanceof ApiError && err.code === 'TASK_HOURS_BILLED') {
        toast.error('No se puede reabrir: ya está facturada', err.message);
        return;
      }
      // #44: resolver un ticket sin tipificar → abrir el diálogo de tipificación en
      // modo gate (en vez del toast genérico) y, al guardar, reintentar la resolución.
      if (err instanceof ApiError && err.code === 'TICKET_CLASSIFICATION_REQUIRED') {
        const d = (err.details || {}) as Record<string, unknown>;
        const missing = Array.isArray(d.missing)
          ? (d.missing.filter((m) => m === 'ticketType' || m === 'categoryConfig') as (
              | 'ticketType'
              | 'categoryConfig'
            )[])
          : [];
        setClassifyInfo({ missing, payload });
        setClassifyOpen(true);
        return;
      }
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

      {/* #43: cancelar ticket — acción dedicada, secundaria, con comentario obligatorio */}
      {showCancel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCancelOpen(true)}
          className="w-full h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancelar ticket
        </Button>
      )}
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

    {classifyInfo && (
      <ReclassifyTicketDialog
        open={classifyOpen}
        onOpenChange={setClassifyOpen}
        ticket={ticket}
        mode="gate"
        missingFields={classifyInfo.missing}
        onReclassified={async () => {
          // Tipificado → reintentar la resolución con el mismo payload.
          const res = await ticketService.update(ticket.id, classifyInfo.payload);
          onUpdated(res.data);
        }}
      />
    )}

    <CancelTicketDialog
      open={cancelOpen}
      onOpenChange={setCancelOpen}
      ticketId={ticket.id}
      onCancelled={onUpdated}
    />
    </>
  );
}
