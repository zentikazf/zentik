'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowRight, GitBranch, MessageSquare, UserPlus, UserMinus, Lock, RefreshCcw,
  Send, CheckCircle2, Clock, AlertTriangle, AlertOctagon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ticketService } from '@/services/ticket.service';
import { STATUS_LABEL, KANBAN_STATUS_LABEL } from './ticket-status-machine';
import type { TicketEvent, TicketStatus } from '@/types/ticket.types';

interface TicketEventTimelineProps {
  ticketId: string;
  refreshKey?: number;
}

const EVENT_ICON: Record<string, React.ElementType> = {
  STATUS_CHANGE: ArrowRight,
  ASSIGNED: UserPlus,
  UNASSIGNED: UserMinus,
  KANBAN_MOVE: GitBranch,
  CLOSED: Lock,
  REOPENED: RefreshCcw,
  COMMENT_ADDED: MessageSquare,
  FIRST_RESPONSE: Send,
  RESOLVED: CheckCircle2,
  SLA_WARNING: Clock,
  SLA_BREACH_RESPONSE: AlertTriangle,
  SLA_BREACH_RESOLUTION: AlertOctagon,
};

const SOURCE_LABEL: Record<string, string> = {
  TICKET: 'Tickets',
  KANBAN: 'Kanban',
  SYSTEM: 'Sistema',
};

const SOURCE_COLOR: Record<string, string> = {
  TICKET: 'text-primary',
  KANBAN: 'text-info',
  SYSTEM: 'text-muted-foreground',
};

function describeEvent(ev: TicketEvent): string {
  if (ev.type === 'STATUS_CHANGE') {
    const from = ev.fromValue ? STATUS_LABEL[ev.fromValue as TicketStatus] || ev.fromValue : '—';
    const to = ev.toValue ? STATUS_LABEL[ev.toValue as TicketStatus] || ev.toValue : '—';
    return `Estado: ${from} → ${to}`;
  }
  if (ev.type === 'KANBAN_MOVE') {
    const newKanban = (ev.metadata as Record<string, unknown> | null)?.newTaskStatus as string | undefined;
    const target = newKanban ? KANBAN_STATUS_LABEL[newKanban] || newKanban : ev.toValue || '';
    return `Kanban movio a: ${target}`;
  }
  if (ev.type === 'ASSIGNED') return 'Usuario asignado';
  if (ev.type === 'UNASSIGNED') return 'Usuario removido';
  if (ev.type === 'CLOSED') {
    const reason = (ev.metadata as Record<string, unknown> | null)?.reason as string | undefined;
    return reason ? `Cerrado (${reason})` : 'Cerrado';
  }
  if (ev.type === 'REOPENED') return 'Reabierto';
  if (ev.type === 'FIRST_RESPONSE') return 'El equipo respondió por primera vez';
  if (ev.type === 'RESOLVED') return 'Ticket resuelto';
  if (ev.type === 'SLA_WARNING') {
    const meta = ev.metadata as Record<string, unknown> | null;
    const pct = meta?.progress ?? meta?.progressPct;
    return typeof pct === 'number'
      ? `Alerta SLA: ${Math.round(pct)}% del tiempo consumido`
      : 'Alerta SLA: tiempo agotándose';
  }
  if (ev.type === 'SLA_BREACH_RESPONSE') return 'SLA de respuesta vencido';
  if (ev.type === 'SLA_BREACH_RESOLUTION') return 'SLA de resolución vencido';
  return ev.type;
}

function formatDate(s: string): string {
  try {
    const d = new Date(s);
    return d.toLocaleString('es-PY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return s;
  }
}

export function TicketEventTimeline({ ticketId, refreshKey }: TicketEventTimelineProps) {
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ticketService
      .events(ticketId)
      .then((res) => {
        if (cancelled) return;
        setEvents(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => !cancelled && setEvents([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ticketId, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin eventos registrados.</p>;
  }

  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {events.map((ev) => {
        const Icon = EVENT_ICON[ev.type] || ArrowRight;
        return (
          <li key={ev.id} className="relative">
            <span className={cn(
              'absolute -left-[22px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card border border-border',
              SOURCE_COLOR[ev.source],
            )}>
              <Icon className="h-2.5 w-2.5" />
            </span>
            <div className="text-xs text-foreground">{describeEvent(ev)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              <span className={cn('font-medium', SOURCE_COLOR[ev.source])}>{SOURCE_LABEL[ev.source]}</span>
              {ev.user?.name && <span> · {ev.user.name}</span>}
              <span> · {formatDate(ev.createdAt)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
