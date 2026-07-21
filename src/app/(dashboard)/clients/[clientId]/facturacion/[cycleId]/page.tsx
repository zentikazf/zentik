'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  CYCLE_STATUS_CONFIG,
  CycleTransactionsResponse,
  formatPeriodLabel,
} from '@/components/client-billing/types';

export default function CycleDetailPage() {
  const { clientId, cycleId } = useParams<{ clientId: string; cycleId: string }>();
  const { orgId } = useOrg();

  const [data, setData] = useState<CycleTransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId || !clientId || !cycleId) return;
    setLoading(true);
    try {
      const res = await api.get<CycleTransactionsResponse>(
        `/organizations/${orgId}/clients/${clientId}/billing/cycles/${cycleId}/transactions`,
      );
      setData(res.data);
    } catch {
      toast.error('Error', 'No se pudo cargar la factura');
    } finally {
      setLoading(false);
    }
  }, [orgId, clientId, cycleId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Link
          href={`/clients/${clientId}/facturacion`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <p className="py-16 text-center text-sm text-muted-foreground">Factura no encontrada</p>
      </div>
    );
  }

  const { cycle, transactions } = data;
  const conf = CYCLE_STATUS_CONFIG[cycle.status];

  return (
    <div className="space-y-5">
      <Link
        href={`/clients/${clientId}/facturacion`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a facturación
      </Link>

      {/* Header con totales congelados */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-lg font-semibold text-foreground">{cycle.invoiceNumber}</h1>
              <Badge variant={conf.variant}>{conf.label}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Período: {formatPeriodLabel(cycle.periodStart.slice(0, 7))}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Horas</p>
              <p className="font-mono text-lg font-semibold text-foreground">{cycle.totalHours.toFixed(2)}h</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total facturado</p>
              <p className="font-mono text-lg font-semibold text-foreground">
                {formatCurrency(cycle.totalAmount, cycle.currency)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Líneas facturadas */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Líneas facturadas</h2>
          <span className="ml-auto text-xs text-muted-foreground">{transactions.length} movimiento(s)</span>
        </div>
        {transactions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sin líneas en esta factura</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2.5 font-medium text-muted-foreground">Fecha</th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground">Concepto</th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground">Tipo</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Horas</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => {
                  const fueraCupo = tx.type === 'LOAN';
                  return (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString('es-PY', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="truncate max-w-[280px] text-foreground">
                          {tx.task?.title ?? tx.note ?? '—'}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            fueraCupo ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'
                          }`}
                        >
                          {fueraCupo ? 'Fuera de cupo' : 'Soporte'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-foreground">
                        {tx.hours.toFixed(2)}h
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-foreground">
                        {tx.priceAmount ? formatCurrency(tx.priceAmount, tx.priceCurrency ?? cycle.currency) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
