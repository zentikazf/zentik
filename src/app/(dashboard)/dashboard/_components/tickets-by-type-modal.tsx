'use client';

import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Headphones,
  Code2,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  TicketCheck,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type {
  TicketCategoryActive,
  TicketsBreakdownFilters,
  TicketsBreakdownResponse,
} from '@/types/tickets-breakdown';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: TicketsBreakdownFilters;
  /** Data del breakdown. El parent es responsable del fetch (controlled). */
  data: TicketsBreakdownResponse | null;
  loading: boolean;
  error: Error | null;
  /** Reintento (re-fetch) cuando el usuario clickea retry en el error state. */
  onRetry: () => void;
  onTypeSelect: (category: TicketCategoryActive) => void;
}

const CATEGORY_META: Record<
  TicketCategoryActive,
  { label: string; icon: typeof Headphones; accent: string }
> = {
  SUPPORT_REQUEST: {
    label: 'Soporte',
    icon: Headphones,
    accent: 'text-info',
  },
  NEW_DEVELOPMENT: {
    label: 'Desarrollo',
    icon: Code2,
    accent: 'text-primary',
  },
};

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

// ─── Modal A — TicketsByTypeModal ────────────────────────────────────
//
// Primer paso del drill-down. Muestra 2 cards grandes (Soporte / Desarrollo)
// con el total y un resumen SLA por categoria. Click en una card escala al
// padre via onTypeSelect — el padre cierra este modal y abre TicketsByStatusModal.
//
// Fetch lazy: `enabled = open` (no penaliza el load inicial del dashboard).
// Sigue el patron del repo: 'use client', Dialog de shadcn, Skeleton para
// loading, toast.error para errores no transitorios.

export function TicketsByTypeModal({
  open,
  onOpenChange,
  filters,
  data,
  loading,
  error,
  onRetry,
  onTypeSelect,
}: Props) {
  // El hook (en el parent) ya hace setError; mostramos toast la primera vez
  // que vemos el error (efecto separado para evitar disparar dentro del render).
  useEffect(() => {
    if (!error || !open) return;
    toast.error(
      'No se pudo cargar el breakdown',
      error.message || 'Reintentá en unos segundos.',
    );
  }, [error, open]);

  const periodLabel = (() => {
    const start = filters.startDate ? filters.startDate.slice(0, 10) : null;
    const end = filters.endDate ? filters.endDate.slice(0, 10) : null;
    if (start && end) return `Periodo: ${start} al ${end}`;
    if (start) return `Desde: ${start}`;
    if (end) return `Hasta: ${end}`;
    return 'Periodo: histórico completo';
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" aria-labelledby="tickets-by-type-title">
        <DialogHeader>
          <DialogTitle id="tickets-by-type-title" className="flex items-center gap-2">
            <TicketCheck className="h-5 w-5 text-primary" />
            Tickets — Detalle por tipo
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </DialogHeader>

        {loading && !data && (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        )}

        {!loading && error && !data && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">
              No se pudo cargar el breakdown
            </p>
            <p className="text-xs text-muted-foreground">
              {error.message || 'Reintentá en unos segundos.'}
            </p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        )}

        {data && data.total === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <TicketCheck className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Sin tickets en este periodo
            </p>
            <p className="text-xs text-muted-foreground">
              Ajustá los filtros del dashboard para ver otros rangos.
            </p>
          </div>
        )}

        {data && data.total > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(['SUPPORT_REQUEST', 'NEW_DEVELOPMENT'] as TicketCategoryActive[]).map(
              (category) => {
                const meta = CATEGORY_META[category];
                const block = data.byCategory[category];
                const Icon = meta.icon;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => onTypeSelect(category)}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-accent p-2.5">
                        <Icon className={`h-6 w-6 ${meta.accent}`} />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          {meta.label}
                        </p>
                        <p className="text-4xl font-bold tracking-tight text-card-foreground leading-none">
                          {block.total}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          tickets · click para desglose por estado
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                );
              },
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
