'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Lock, Pencil, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatUsd, formatPeriodLabel } from '@/components/client-billing/types';

interface SavedRow {
  period: string;
  itemCount: number;
  totalCommercial: number;
  note: string | null;
  billed: boolean;
  billedCycleId: string | null; // #23: link directo a la factura que incluyó este mes
}

interface Props {
  orgId: string;
  clientId: string;
  clientName: string;
  accountId: string | null;
  onOpenMonth: (period: string) => void;
  onChangeAccount: () => void;
}

// Meses desde enero del año actual hasta el mes actual (del más nuevo al más viejo). La lista existe
// por defecto: cada mes nuevo aparece solo. Los meses sin consumo traen 0 al abrirlos (auto-import).
function monthsFromJanuary(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const current = now.getMonth() + 1; // 1-12
  const list: string[] = [];
  for (let m = current; m >= 1; m--) list.push(`${year}-${String(m).padStart(2, '0')}`);
  return list;
}

export function MonthList({ orgId, clientId, clientName, accountId, onOpenMonth, onChangeAccount }: Props) {
  const [saved, setSaved] = useState<SavedRow[] | null>(null);

  const load = useCallback(async () => {
    setSaved(null);
    try {
      const res = await api.get<SavedRow[]>(`/organizations/${orgId}/clients/${clientId}/billing/variables`);
      setSaved(res.data);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudieron cargar los meses');
      setSaved([]);
    }
  }, [orgId, clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const savedMap = new Map((saved ?? []).map((s) => [s.period, s]));
  const generated = monthsFromJanuary();
  // Meses guardados fuera del rango (más viejos que enero de este año) también se muestran.
  const extra = (saved ?? []).map((s) => s.period).filter((p) => !generated.includes(p));
  const periods = [...new Set([...generated, ...extra])].sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="space-y-4">
      {/* Header: nombre del cliente en grande + accountId chico */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-foreground">{clientName}</p>
          {accountId && (
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">Botmaker · {accountId}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onChangeAccount}>
          Cambiar
        </Button>
      </div>

      {/* Lista de meses (desde enero, autogenerada) */}
      {saved === null ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {periods.map((period) => {
              const s = savedMap.get(period);
              return (
                <div
                  key={period}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenMonth(period)}
                  onKeyDown={(e) => e.key === 'Enter' && onOpenMonth(period)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{formatPeriodLabel(period)}</span>
                    {s ? (
                      s.billed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          <Lock className="h-2.5 w-2.5" /> Facturado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          <Pencil className="h-2.5 w-2.5" /> Guardado
                        </span>
                      )
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        Sin cargar
                      </span>
                    )}
                    {s && <span className="text-xs text-muted-foreground">{s.itemCount} ítem(s)</span>}
                    {/* #23: mes ya facturado → link directo a la factura (sin abrir el editor) */}
                    {s?.billed && s.billedCycleId && (
                      <Link
                        href={`/clients/${clientId}/facturacion/${s.billedCycleId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                      >
                        <Receipt className="h-3 w-3" /> Ver factura →
                      </Link>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {s && (
                      <span className="font-mono text-sm font-semibold text-foreground">{formatUsd(s.totalCommercial)}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
