'use client';

import { ChevronRight, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { CycleEstado, MonthSummary, formatPeriodLabel } from './types';

const ESTADO_CONFIG: Record<
  CycleEstado,
  { label: string; variant: 'info' | 'warning' | 'success' | 'muted' }
> = {
  EN_CURSO: { label: 'En curso', variant: 'info' },
  NO_FACTURADO: { label: 'No facturado', variant: 'warning' },
  FACTURADO_PARCIAL: { label: 'Facturado parcial', variant: 'warning' },
  FACTURADO: { label: 'Facturado', variant: 'success' },
  SIN_TRABAJO: { label: 'Sin trabajo', variant: 'muted' },
};

function actionLabel(estado: CycleEstado): string {
  switch (estado) {
    case 'NO_FACTURADO':
    case 'EN_CURSO':
      return 'Facturar';
    case 'FACTURADO_PARCIAL':
      return 'Facturar resto';
    default:
      return 'Ver';
  }
}

interface Props {
  months: MonthSummary[];
  onSelect: (period: string) => void;
}

export function BillingCyclesList({ months, onSelect }: Props) {
  if (months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Receipt className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm font-medium text-foreground">Sin actividad facturable</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando el cliente registre horas de soporte, sus meses aparecerán acá.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {months.map((m) => {
          const conf = ESTADO_CONFIG[m.estado];
          return (
            <li key={m.period}>
              <button
                onClick={() => onSelect(m.period)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-medium text-foreground w-32 shrink-0">
                    {formatPeriodLabel(m.period)}
                  </span>
                  <Badge variant={conf.variant}>{conf.label}</Badge>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {formatCurrency(m.totalFacturable, m.currency)}
                  </span>
                  <span className="hidden sm:inline text-xs font-medium text-primary">
                    {actionLabel(m.estado)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
