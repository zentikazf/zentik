'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, ChevronRight, Lock, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatUsd, formatPeriodLabel } from '@/components/client-billing/types';

interface MonthRow {
  period: string;
  itemCount: number;
  totalCommercial: number;
  note: string | null;
  billed: boolean;
}

interface Props {
  orgId: string;
  clientId: string;
  accountId: string | null;
  onOpenMonth: (period: string) => void;
  onChangeAccount: () => void;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function MonthList({ orgId, clientId, accountId, onOpenMonth, onChangeAccount }: Props) {
  const [months, setMonths] = useState<MonthRow[] | null>(null);
  const [newPeriod, setNewPeriod] = useState(currentMonth());

  const load = useCallback(async () => {
    setMonths(null);
    try {
      const res = await api.get<MonthRow[]>(`/organizations/${orgId}/clients/${clientId}/billing/variables`);
      setMonths(res.data);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudieron cargar los meses');
      setMonths([]);
    }
  }, [orgId, clientId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      {/* Header: cuenta mapeada + cambiar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Cuenta Botmaker</p>
          <p className="truncate font-mono text-sm text-foreground">{accountId ?? 'Sin mapear (variables manuales)'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onChangeAccount}>
          Cambiar
        </Button>
      </div>

      {/* Nuevo mes */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">Cargar variables de un mes</p>
          <Input type="month" value={newPeriod} onChange={(e) => setNewPeriod(e.target.value)} className="max-w-[200px]" />
        </div>
        <Button onClick={() => newPeriod && onOpenMonth(newPeriod)} disabled={!newPeriod}>
          <Plus className="mr-1 h-4 w-4" /> Abrir mes
        </Button>
      </div>

      {/* Lista de meses con statement */}
      {months === null ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : months.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Todavía no cargaste variables. Elegí un mes arriba para empezar.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {months.map((m) => (
              <button
                key={m.period}
                onClick={() => onOpenMonth(m.period)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{formatPeriodLabel(m.period)}</span>
                  {m.billed ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      <Lock className="h-2.5 w-2.5" /> Facturado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <Pencil className="h-2.5 w-2.5" /> Editable
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{m.itemCount} ítem(s)</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-foreground">{formatUsd(m.totalCommercial)}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
