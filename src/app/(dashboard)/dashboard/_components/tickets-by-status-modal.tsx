'use client';

import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Timer,
} from 'lucide-react';
import type {
  TicketCategoryActive,
  TicketsBreakdownFilters,
  TicketsBreakdownResponse,
  TicketStatusActive,
} from '@/types/tickets-breakdown';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: TicketCategoryActive | null;
  data: TicketsBreakdownResponse | null;
  filters: TicketsBreakdownFilters;
  /** Vuelve al Modal A (TicketsByTypeModal). */
  onBack: () => void;
}

const CATEGORY_LABELS: Record<TicketCategoryActive, string> = {
  SUPPORT_REQUEST: 'Soporte',
  NEW_DEVELOPMENT: 'Desarrollo',
};

const STATUSES: {
  key: TicketStatusActive;
  label: string;
  dot: string;
  accent: string;
}[] = [
  { key: 'OPEN',        label: 'Abierto',     dot: 'bg-info',        accent: 'text-info' },
  { key: 'IN_PROGRESS', label: 'En progreso', dot: 'bg-warning',     accent: 'text-warning' },
  { key: 'IN_REVIEW',   label: 'En revisión', dot: 'bg-primary',     accent: 'text-primary' },
  { key: 'RESOLVED',    label: 'Resuelto',    dot: 'bg-success',     accent: 'text-success' },
];

// ─── Helpers locales ─────────────────────────────────────────────────

function formatOvershoot(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
}

// ─── Modal B — TicketsByStatusModal ──────────────────────────────────
//
// Segundo paso del drill-down. Recibe la category seleccionada del Modal A
// y los datos ya cargados (no refetchea). Renderiza 4 buckets de estado
// con count, complied, breach respuesta, breach resolucion, overshoot
// promedio y CTA "Ver listado" que deeplinkea a /tickets con los query
// params correctos (category, status, startDate, endDate, clientId, memberId).
//
// El sub-filtro slaOutcome queda para la feature #10 (ya planificada).

export function TicketsByStatusModal({
  open,
  onOpenChange,
  category,
  data,
  filters,
  onBack,
}: Props) {
  const router = useRouter();

  if (!category || !data) return null;

  const block = data.byCategory[category];
  const categoryLabel = CATEGORY_LABELS[category];

  const handleViewList = (status: TicketStatusActive) => {
    const params = new URLSearchParams();
    params.set('category', category);
    params.set('status', status);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.clientId) params.set('clientId', filters.clientId);
    if (filters.memberId) params.set('memberId', filters.memberId);
    router.push(`/tickets?${params.toString()}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl"
        aria-labelledby="tickets-by-status-title"
      >
        <DialogHeader>
          <DialogTitle
            id="tickets-by-status-title"
            className="flex items-center gap-2"
          >
            {categoryLabel} — Detalle por estado
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {block.total} ticket{block.total !== 1 ? 's' : ''} en este periodo
          </p>
        </DialogHeader>

        {block.total === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              Sin tickets de {categoryLabel.toLowerCase()} en este periodo
            </p>
            <p className="text-xs text-muted-foreground">
              Probá con otro rango de fechas o cambiá los filtros del dashboard.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STATUSES.map(({ key, label, dot, accent }) => {
              const bucket = block.byStatus[key];
              return (
                <div
                  key={key}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${dot}`}
                      />
                      <p className={`text-[11px] font-semibold uppercase tracking-wider ${accent}`}>
                        {label}
                      </p>
                    </div>
                  </div>

                  <p className="text-4xl font-bold tracking-tight text-card-foreground leading-none">
                    {bucket.count}
                  </p>

                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-auto gap-1.5"
                    onClick={() => handleViewList(key)}
                    disabled={bucket.count === 0}
                  >
                    Ver listado
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-2 flex justify-start">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver a tipos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
