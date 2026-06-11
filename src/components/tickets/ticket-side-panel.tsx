'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertCircle,
  Building,
  Clock,
  ExternalLink,
  FolderKanban,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Save,
  ShieldAlert,
  Tag,
  User,
  UserCheck,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { ticketService } from '@/services/ticket.service';
import { TicketActionBar } from './ticket-action-bar';
import { TicketEventTimeline } from './ticket-event-timeline';
import { TicketChat } from './ticket-chat';
import { STATUS_BADGE, STATUS_LABEL, KANBAN_STATUS_LABEL } from './ticket-status-machine';
import type { TicketDetail, TicketStatus } from '@/types/ticket.types';

const PANEL_WIDTH_KEY = 'zentik:ticket-panel-width'; // 'standard' | 'expanded'

// Mapping criticidad → label + color de badge
const CRITICALITY_BADGE: Record<string, { label: string; className: string }> = {
  HIGH:   { label: 'Alta',  className: 'bg-destructive/10 text-destructive border-transparent' },
  MEDIUM: { label: 'Media', className: 'bg-warning/10 text-warning border-transparent' },
  LOW:    { label: 'Baja',  className: 'bg-muted text-muted-foreground border-transparent' },
};

interface TicketSidePanelProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketUpdated?: (ticket: TicketDetail) => void;
}

export function TicketSidePanel({
  ticketId,
  open,
  onOpenChange,
  onTicketUpdated,
}: TicketSidePanelProps) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [eventsKey, setEventsKey] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // Notas del admin
  const [adminNotes, setAdminNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Cargar preferencia de ancho desde localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(PANEL_WIDTH_KEY);
      setExpanded(saved === 'expanded');
    } catch {
      // ignore
    }
  }, []);

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PANEL_WIDTH_KEY, next ? 'expanded' : 'standard');
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Cargar ticket cuando cambia el id
  useEffect(() => {
    if (!ticketId || !open) {
      setTicket(null);
      setAdminNotes('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    ticketService
      .detail(ticketId)
      .then((res) => {
        if (cancelled) return;
        setTicket(res.data);
        setAdminNotes(res.data.adminNotes ?? '');
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo cargar el ticket');
          onOpenChange(false);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ticketId, open, onOpenChange]);

  const handleUpdated = (updated: TicketDetail) => {
    setTicket(updated);
    setAdminNotes(updated.adminNotes ?? '');
    setEventsKey((k) => k + 1);
    onTicketUpdated?.(updated);
  };

  const handleSaveNotes = async () => {
    if (!ticket || savingNotes) return;
    if ((adminNotes ?? '') === (ticket.adminNotes ?? '')) {
      toast.error('Sin cambios', 'Las notas son iguales a las guardadas');
      return;
    }
    setSavingNotes(true);
    try {
      const res = await ticketService.update(ticket.id, { adminNotes });
      handleUpdated(res.data);
      toast.success('Notas guardadas', 'Las notas internas se actualizaron');
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudieron guardar las notas');
    } finally {
      setSavingNotes(false);
    }
  };

  const sla = ticket && (ticket.slaResponseBreached || ticket.slaResolutionBreached);
  const assignee = ticket?.task?.assignments?.[0]?.user;
  const criticality = ticket?.criticality || ticket?.categoryConfig?.criticality || ticket?.priority;
  const criticalityStyle = criticality ? CRITICALITY_BADGE[criticality] : null;
  const formatFull = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-PY', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'p-0 flex flex-col gap-0',
          'w-full sm:max-w-none',
          expanded ? 'sm:w-screen' : 'sm:w-[60vw]',
          'transition-[width] duration-200 ease-in-out',
        )}
      >
        {loading || !ticket ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      #{ticket.ticketNumber || ticket.id.slice(-8).toUpperCase()}
                    </span>
                    <SheetTitle className="text-base font-semibold text-foreground truncate">
                      {ticket.title}
                    </SheetTitle>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ticket.client?.name || 'Sin cliente'} ·{' '}
                    {new Date(ticket.createdAt).toLocaleDateString('es-PY', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                    {ticket.project && <> · <span className="text-primary">{ticket.project.name}</span></>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 mr-8">
                  {sla && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                      <ShieldAlert className="h-3 w-3" /> SLA
                    </span>
                  )}
                  <Badge className={cn(STATUS_BADGE[ticket.status], 'text-[10px]')}>
                    {STATUS_LABEL[ticket.status]}
                  </Badge>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={toggleExpanded}
                          aria-label={expanded ? 'Reducir panel' : 'Expandir panel'}
                        >
                          {expanded ? (
                            <Minimize2 className="h-3.5 w-3.5" />
                          ) : (
                            <Maximize2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {expanded ? 'Reducir a 60%' : 'Expandir a pantalla completa'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            {/* Body */}
            <div
              className={cn(
                'flex-1 min-h-0 overflow-hidden grid gap-3 p-3',
                expanded ? 'grid-cols-1 lg:grid-cols-[1fr_380px]' : 'grid-cols-1',
              )}
            >
              {/* Columna izquierda: chat */}
              <TicketChat channelId={ticket.channel?.id} className="min-h-0 h-full" />

              {/* Columna derecha: action bar + estado kanban + detalles + notas + descripcion + timeline */}
              <div className={cn(
                'flex flex-col gap-3 min-h-0 overflow-y-auto',
                !expanded && 'border-t border-border pt-3',
              )}>
                {/* 1) Action bar */}
                <TicketActionBar
                  ticket={ticket}
                  onUpdated={handleUpdated}
                />


                {/* 2) Estado en Kanban — educativo + link al board */}
                {ticket.task?.boardColumn && (
                  <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <RefreshCw className="h-3 w-3" /> Estado en Kanban
                      </h4>
                      {ticket.project && ticket.task && (
                        <Link
                          href={`/projects/${ticket.project.id}/board?task=${ticket.task.id}`}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          Ver en kanban <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: ticket.task.boardColumn.color || '#6366F1' }}
                      />
                      <span className="font-medium text-foreground">
                        {KANBAN_STATUS_LABEL[ticket.task.boardColumn.mappedStatus || ''] ||
                          ticket.task.boardColumn.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Mapeado desde el estado del ticket. Para cambiarlo, usá el selector de arriba —
                      la sincronización es automática.
                    </p>
                  </div>
                )}

                {/* 3) Detalles enriquecidos */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-2.5 text-sm">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Detalles
                  </h4>

                  {ticket.client && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                        <Building className="h-3.5 w-3.5" /> Cliente
                      </span>
                      <div className="text-right min-w-0">
                        <div className="font-medium truncate">{ticket.client.name}</div>
                        {ticket.client.email && (
                          <div className="text-[11px] text-muted-foreground truncate">{ticket.client.email}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {ticket.project && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                        <FolderKanban className="h-3.5 w-3.5" /> Proyecto
                      </span>
                      <Link
                        href={`/projects/${ticket.project.id}`}
                        className="font-medium text-primary hover:underline inline-flex items-center gap-1 truncate"
                      >
                        {ticket.project.name} <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                      </Link>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                      <UserCheck className="h-3.5 w-3.5" /> Asignado
                    </span>
                    {assignee ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarImage src={assignee.image || undefined} />
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                            {getInitials(assignee.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate">{assignee.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Sin asignar</span>
                    )}
                  </div>

                  {criticalityStyle && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                        <AlertCircle className="h-3.5 w-3.5" /> Criticidad
                      </span>
                      <Badge className={cn(criticalityStyle.className, 'text-[10px]')}>
                        {criticalityStyle.label}
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                      <Tag className="h-3.5 w-3.5" /> Tipo
                    </span>
                    <span className="font-medium">
                      {ticket.categoryConfig?.name ||
                        (ticket.category === 'SUPPORT_REQUEST' ? 'Soporte' : 'Desarrollo')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                      <Clock className="h-3.5 w-3.5" /> Creado
                    </span>
                    <span className="font-medium text-xs">{formatFull(ticket.createdAt)}</span>
                  </div>

                  {ticket.createdByUser && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                        <User className="h-3.5 w-3.5" /> Creado por
                      </span>
                      <span className="font-medium truncate">{ticket.createdByUser.name}</span>
                    </div>
                  )}

                  {ticket.closedAt && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                        <Clock className="h-3.5 w-3.5" /> Cerrado
                      </span>
                      <div className="text-right">
                        <div className="font-medium text-xs">{formatFull(ticket.closedAt)}</div>
                        {ticket.closedByUser && (
                          <div className="text-[11px] text-muted-foreground">por {ticket.closedByUser.name}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4) Descripcion */}
                {ticket.description && (
                  <div className="rounded-xl border border-border bg-card p-3 space-y-1">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Descripcion
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {ticket.description}
                    </p>
                  </div>
                )}

                {/* 5) Notas del admin */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Notas del admin
                  </h4>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Notas internas sobre este ticket — no son visibles para el cliente..."
                    rows={3}
                    className="text-sm resize-none"
                    maxLength={2000}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {(adminNotes ?? '').length}/2000
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveNotes}
                      disabled={savingNotes || (adminNotes ?? '') === (ticket.adminNotes ?? '')}
                      className="h-7 gap-1.5 text-xs"
                    >
                      {savingNotes ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      {savingNotes ? 'Guardando...' : 'Guardar notas'}
                    </Button>
                  </div>
                </div>

                {/* 6) Notas del cierre (si aplica) */}
                {ticket.closeNote && (
                  <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 space-y-1">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-warning">
                      Nota de cierre
                    </h4>
                    <p className="text-sm text-foreground leading-relaxed">{ticket.closeNote}</p>
                  </div>
                )}

                {/* 7) Timeline */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Historial
                  </h4>
                  <TicketEventTimeline ticketId={ticket.id} refreshKey={eventsKey} />
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
