'use client';

import { CheckCircle2, MinusCircle, ShieldAlert } from 'lucide-react';
import { humanizeDelta, diffMin } from '@/lib/format/humanize-delta';
import type { TicketListItem } from '@/types/ticket.types';

/**
 * Badge SLA para la columna "Resultado SLA" en la tab Resuelto.
 * Verde "Cumplido" / rojo "Breach +Xh".
 */
export function SlaBadge({ ticket }: { ticket: TicketListItem }) {
  // Sin ninguna deadline no hubo SLA que cumplir: no se puede marcar breach (el cron
  // exige deadline no nula), así que el badge caía en el verde "Cumplido" y afirmaba
  // algo falso. Es el mismo "Sin SLA" que ya usa el panel de filtros (NO_SLA), y es
  // lo que hace VISIBLE cualquier ticket que nazca sin deadlines.
  if (!ticket.responseDeadline && !ticket.resolutionDeadline) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
        title="El ticket se creó sin SLA asignado"
      >
        <MinusCircle className="h-3 w-3" /> Sin SLA
      </span>
    );
  }

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

// `CriticalityBadge` se mudó a `./criticality-badge` (#42 Fase 3, paso A): era
// una de las 6 copias del mapa label/color de criticidad.
