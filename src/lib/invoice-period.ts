// ─── Etiqueta del período de una factura (#62) ───────────────────────────────
//
// Nació inline en `/portal/billing`. Al mostrar #62 las mismas facturas en las cards de
// `/portal/hours`, las dos pantallas necesitan EXACTAMENTE la misma etiqueta: si divergen, el
// cliente lee "Julio de 2026" en una y "Julio – Agosto de 2026" en la otra para la misma
// factura y no tiene forma de saber cuál mira.
//
// Mismo criterio que `hours-month.ts`: el parámetro se tipa ESTRUCTURALMENTE, no con la
// interface de ninguna de las dos pantallas — cada una declara la suya (con campos distintos) y
// las dos satisfacen esto sin acoplarse entre sí.

/** Lo mínimo que necesita la etiqueta. Lo cumplen las dos interfaces de factura del portal. */
export interface InvoicePeriodLike {
  periodStart: string;
  periodEnd: string;
  /** Corte parcial (H8b): cuando existe, es el final REAL de lo facturado. */
  cutoffDate?: string | null;
}

/**
 * 'Julio de 2026' para una factura de un mes; 'Junio de 2026 – Agosto de 2026' para una
 * ACUMULADA que abarca varios.
 *
 * El final del rango sale de `cutoffDate` cuando hay corte parcial: es hasta dónde se facturó
 * de verdad, que es lo que el cliente tiene que poder cotejar contra sus horas.
 */
export function invoiceRangeLabel(inv: InvoicePeriodLike): string {
  const fmt = (iso: string) => {
    const s = new Intl.DateTimeFormat('es-PY', {
      timeZone: 'America/Asuncion',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const start = fmt(inv.periodStart);
  const end = fmt(inv.cutoffDate ?? inv.periodEnd);
  return start === end ? start : `${start} – ${end}`;
}

/** Fecha corta de un hito de la factura (envío / pago), en la zona en que se factura. */
export function invoiceDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PY', {
    timeZone: 'America/Asuncion',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
