'use client';

import { CheckCircle2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { humanizeDelta, diffMin } from '@/lib/format/humanize-delta';
import type { TicketListItem } from '@/types/ticket.types';

/**
 * Badge SLA para la columna "Resultado SLA" en la tab Resuelto.
 * Verde "Cumplido" / rojo "Breach +Xh".
 */
export function SlaBadge({ ticket }: { ticket: TicketListItem }) {
  const breached = ticket.slaResponseBreached || ticket.slaResolutionBreached;
  if (!breached) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
        <CheckCircle2 className="h-3 w-3" /> Cumplido
      </span>
    );
  }

  // Overshoot: priorizamos resolutionDeadline si el ticket esta resuelto,
  // sino el responseDeadline. Si no hay datos suficientes, mostramos solo
  // "Breach" sin minutos.
  let overshootMin = 0;
  if (ticket.resolutionDeadline && ticket.closedAt) {
    overshootMin = diffMin(ticket.resolutionDeadline, ticket.closedAt);
  } else if (ticket.responseDeadline && ticket.closedAt) {
    overshootMin = diffMin(ticket.responseDeadline, ticket.closedAt);
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive"
      title="SLA vencido"
    >
      <ShieldAlert className="h-3 w-3" />
      Breach {overshootMin > 0 ? `+${humanizeDelta(overshootMin)}` : ''}
    </span>
  );
}

/**
 * Badge de criticidad por nivel.
 */
export function CriticalityBadge({ level }: { level: string | null | undefined }) {
  if (!level) return null;
  const config: Record<string, { label: string; bg: string }> = {
    HIGH: { label: 'Alta', bg: 'bg-destructive/10 text-destructive' },
    MEDIUM: { label: 'Media', bg: 'bg-warning/10 text-warning' },
    LOW: { label: 'Baja', bg: 'bg-muted text-muted-foreground' },
  };
  const cfg = config[level] || config.MEDIUM;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', cfg.bg)}>
      <AlertTriangle className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}
