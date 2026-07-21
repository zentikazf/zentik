// Tipos del feature #25 (cierre de ciclo de facturación por cliente).
// Espejan el shape que devuelve `client-billing.service.ts` del backend.
// Los montos llegan como STRING (Prisma.Decimal.toJSON() === toString()); nunca
// se hace aritmética monetaria en el cliente (§1.4).

export type CycleStatus = 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED';

export type CycleEstado =
  | 'EN_CURSO'
  | 'NO_FACTURADO'
  | 'FACTURADO_PARCIAL'
  | 'FACTURADO'
  | 'SIN_TRABAJO';

export interface BillingRow {
  id: string;
  type: string;
  hours: number;
  note: string | null;
  createdAt: string;
  priceAmount: string | null;
  priceRate: string | null;
  priceCurrency: string | null;
  task: { id: string; title: string; type: string } | null;
  billable: boolean;
  fueraCupo: boolean;
  sinTarifa: boolean;
}

export interface BillingCycle {
  id: string;
  status: CycleStatus;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  totalAmount: string;
  currency: string;
  notes: string | null;
  closedAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface MonthSummary {
  period: string;
  estado: CycleEstado;
  totalFacturable: string;
  currency: string;
  cycles: BillingCycle[];
}

export interface CycleBuilder {
  period: string;
  soporte: BillingRow[];
  proyecto: BillingRow[];
  interno: BillingRow[];
  subtotalSoporte: string;
  subtotalFueraCupo: string;
  totalFacturable: string;
  currency: string;
  cycles: BillingCycle[];
}

// Respuesta de GET .../billing/cycles/:cycleId/transactions (T24 — líneas facturadas).
export interface CycleTransactionLine {
  id: string;
  createdAt: string;
  type: string;
  hours: number;
  note: string | null;
  priceAmount: string | null;
  priceCurrency: string | null;
  task: { id: string; title: string; type: string } | null;
}

export interface CycleTransactionsResponse {
  cycle: BillingCycle;
  transactions: CycleTransactionLine[];
}

// Config de estado de la factura (español) — compartida entre builder y detalle.
export const CYCLE_STATUS_CONFIG: Record<
  CycleStatus,
  { label: string; variant: 'muted' | 'info' | 'success' | 'destructive' }
> = {
  DRAFT: { label: 'Borrador', variant: 'muted' },
  SENT: { label: 'Enviada', variant: 'info' },
  PAID: { label: 'Cobrada', variant: 'success' },
  CANCELLED: { label: 'Cancelada', variant: 'destructive' },
};

// Etiqueta 'YYYY-MM' → 'Julio 2026' (es-PY), primera letra en mayúscula.
export function formatPeriodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  const label = new Intl.DateTimeFormat('es-PY', { month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, 1),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}
