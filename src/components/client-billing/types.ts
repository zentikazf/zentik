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
  workedOn: string | null; // H8b: fecha real de trabajo (eje de facturación)
  workedMonth: string | null; // H8b: 'YYYY-MM' de pertenencia
  atrasada: boolean; // H8b: pertenece a un mes anterior al del builder (arrastrada)
  priceAmount: string | null;
  priceRate: string | null;
  priceCurrency: string | null;
  task: { id: string; title: string; type: string } | null;
  billable: boolean;
  fueraCupo: boolean;
  sinTarifa: boolean;
}

export type CycleKind = 'MONTH' | 'ACCUMULATED';

// #23 — Variable de facturación (Botmaker). Montos comerciales en USD (number, no monetario-string:
// son cents con 2 decimales; el subtotal/total viene calculado del backend).
export interface VariableLine {
  label: string;
  commercialValue: number; // USD
}

// #23 — Estampado inmutable de variables + tasa en una factura ya emitida.
export interface VariablesBillingStamp {
  amountPyg: string;
  currency: string;
  rate: string;
  rateDate: string;
  lines: Array<{ label: string; commercialUsd: string; convertedPyg: string }>;
}

export interface BillingCycle {
  id: string;
  status: CycleStatus;
  kind: CycleKind; // H8d: MONTH (un mes) | ACCUMULATED (varios meses en una factura)
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  cutoffDate: string | null; // H8b: instante efectivo del corte (= periodEnd si mes completo)
  totalHours: number;
  totalAmount: string;
  currency: string;
  notes: string | null;
  closedAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  cancelReason: string | null; // H8d/A3: motivo de anulación
  cancelledAt: string | null; // H8d/A3: cuándo se anuló
  variablesBilling?: VariablesBillingStamp | null; // #23: variables + tasa estampadas (null = sin variables)
  createdAt: string;
}

// H8d — respuesta del dry-run POST .../billing/cycles/preview. Montos como STRING (Decimal del backend);
// NUNCA aritmética monetaria en el cliente — los subtotales/total ya vienen calculados.
export interface CyclePreview {
  mode: 'MES' | 'ACUMULADO';
  periodStart: string;
  periodEnd: string;
  cutoffDate: string;
  grupos: Array<{
    workedMonth: string; // 'YYYY-MM'
    label: string; // 'Abril 2026'
    rows: BillingRow[];
    subtotalMes: string;
    horasMes: number;
  }>;
  total: string;
  currency: string;
  // #23 — Variables (Botmaker) que se sumarán (convertidas) al total. `suggestedRate` prefill del campo
  // editable de conversión (null → el admin la pega a mano). Montos en USD.
  variables: VariableLine[];
  variablesSubtotalUsd: number;
  suggestedRate: number | null;
  bloqueos: {
    sinTarifaRate: boolean;
    sinFechaTrabajo: { count: number; ids: string[] };
  };
  puedeEmitir: boolean;
  motivo: 'NOTHING_TO_BILL' | null;
  nextInvoiceHint: string;
}

export interface MonthSummary {
  period: string;
  estado: CycleEstado;
  totalFacturable: string;
  variablesUsd: number; // #23: comercial USD no facturado del mes (para ofrecer meses solo-variables)
  currency: string;
  cycles: BillingCycle[];
}

export interface CycleBuilder {
  period: string;
  soporte: BillingRow[];
  proyecto: BillingRow[];
  interno: BillingRow[];
  variables: VariableLine[]; // #23: reemplazan la columna Proyecto/Interno (comerciales USD del mes)
  variablesSubtotalUsd: number; // #23
  variablesBilled: boolean; // #23: statement ya facturado → "Factura al día, nada pendiente"
  variablesBilledCycleId: string | null; // #23: link a la factura que las incluyó
  subtotalSoporte: string;
  subtotalFueraCupo: string;
  totalFacturable: string;
  currency: string;
  sinFechaTrabajo: number; // H8b: filas facturables con precio pero sin worked_on (bloquean el cierre)
  cycles: BillingCycle[];
}

// #23 — Formateo USD con 2 decimales (formatCurrency del proyecto es PYG 0-decimales). Las variables son USD.
export function formatUsd(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// Respuesta de GET .../billing/cycles/:cycleId/transactions (T24 — líneas facturadas).
export interface CycleTransactionLine {
  id: string;
  createdAt: string;
  workedOn: string | null; // H8b
  workedMonth: string | null; // H8b: mes de pertenencia
  atrasada: boolean; // H8b: pertenece a un mes anterior al del ciclo
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
  grupos: Array<{ workedMonth: string; label: string; subtotal: string; horas: number }>; // H8d: desglose por mes
}

// H9b — resumen de una nota de crédito emitida sobre una factura (banner staff del detalle).
// Respuesta de GET .../billing/cycles/:cycleId/credit-notes (orden issuedAt desc). Montos como STRING
// (Decimal del backend); totalAmount/totalHours ya vienen NEGATIVOS.
export interface CreditNoteSummary {
  id: string;
  number: string; // NC-YYYY-NNNNN
  reason: string;
  totalAmount: string; // NEGATIVO
  totalHours: number; // NEGATIVO
  returnHoursToBillable: boolean;
  issuedAt: string;
}

// Config de estado de la factura (español) — compartida entre builder y detalle.
export const CYCLE_STATUS_CONFIG: Record<
  CycleStatus,
  { label: string; variant: 'muted' | 'info' | 'success' | 'destructive' }
> = {
  DRAFT: { label: 'Borrador', variant: 'muted' },
  SENT: { label: 'Enviada', variant: 'info' },
  PAID: { label: 'Cobrada', variant: 'success' },
  CANCELLED: { label: 'Anulada', variant: 'destructive' },
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
