'use client';

import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertCircle,
  Clock,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Tag,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { ticketService } from '@/services/ticket.service';
import { TicketActionBar } from './ticket-action-bar';
import { TicketCloseForm } from './ticket-close-form';
import { TicketEventTimeline } from './ticket-event-timeline';
import { TicketChat } from './ticket-chat';
import { STATUS_BADGE, STATUS_LABEL, KANBAN_STATUS_LABEL } from './ticket-status-machine';
import type { TicketDetail } from '@/types/ticket.types';

const PANEL_WIDTH_KEY = 'zentik:ticket-panel-width'; // 'standard' | 'expanded'

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
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [eventsKey, setEventsKey] = useState(0);
  const [expanded, setExpanded] = useState(false);

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
      setShowCloseForm(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    ticketService
      .detail(ticketId)
      .then((res) => {
        if (!cancelled) setTicket(res.data);
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
    setEventsKey((k) => k + 1);
    onTicketUpdated?.(updated);
  };

  const handleClosed = (updated: TicketDetail) => {
    setShowCloseForm(false);
    handleUpdated(updated);
  };

  const sla = ticket && (ticket.slaResponseBreached || ticket.slaResolutionBreached);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          // Override del default w-3/4 sm:max-w-sm — usamos toggle 60% / 100%
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
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
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

            {/* Body — 2 columnas en expanded, 1 columna en standard */}
            <div
              className={cn(
                'flex-1 min-h-0 overflow-hidden grid gap-3 p-3',
                expanded ? 'grid-cols-1 lg:grid-cols-[1fr_360px]' : 'grid-cols-1',
              )}
            >
              {/* Columna izquierda: chat */}
              <TicketChat channelId={ticket.channel?.id} className="min-h-0 h-full" />

              {/* Columna derecha: action bar + detalles + timeline */}
              <div className={cn(
                'flex flex-col gap-3 min-h-0 overflow-y-auto',
                !expanded && 'border-t border-border pt-3',
              )}>
                {/* Action bar / Close form */}
                {showCloseForm ? (
                  <TicketCloseForm
                    ticketId={ticket.id}
                    onClosed={handleClosed}
                    onCancel={() => setShowCloseForm(false)}
                  />
                ) : (
                  <TicketActionBar
                    ticket={ticket}
                    onUpdated={handleUpdated}
                    onCloseRequested={() => setShowCloseForm(true)}
                  />
                )}

                {/* Estado dual: ticket + kanban */}
                {ticket.task?.boardColumn && (
                  <div className="rounded-xl border border-border bg-card p-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Estado en Kanban
                    </h4>
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: ticket.task.boardColumn.color || '#6366F1' }}
                      />
                      <span className="font-medium text-foreground">
                        {KANBAN_STATUS_LABEL[ticket.task.boardColumn.mappedStatus || ''] ||
                          ticket.task.boardColumn.name}
                      </span>
                    </div>
                  </div>
                )}

                {/* Detalles */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-2 text-sm">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Detalles
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" /> Tipo
                    </span>
                    <span className="font-medium">
                      {ticket.category === 'SUPPORT_REQUEST' ? 'Soporte' : 'Desarrollo'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" /> Criticidad
                    </span>
                    <span className="font-medium">{ticket.priority}</span>
                  </div>
                  {ticket.createdByUser && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" /> Creado por
                      </span>
                      <span className="font-medium">{ticket.createdByUser.name}</span>
                    </div>
                  )}
                  {ticket.closedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> Cerrado
                      </span>
                      <span className="font-medium">
                        {new Date(ticket.closedAt).toLocaleDateString('es-PY')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Descripcion */}
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

                {/* Notas del cierre */}
                {ticket.closeNote && (
                  <div className="rounded-xl border border-border bg-card p-3 space-y-1">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Nota de cierre
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{ticket.closeNote}</p>
                  </div>
                )}

                {/* Timeline */}
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
