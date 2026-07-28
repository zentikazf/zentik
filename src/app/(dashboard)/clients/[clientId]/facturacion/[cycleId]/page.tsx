'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Ban, Download, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getToken } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, formatDate, formatWorkedOn } from '@/lib/utils';
import {
  CYCLE_STATUS_CONFIG,
  CycleTransactionLine,
  CycleTransactionsResponse,
  formatPeriodLabel,
} from '@/components/client-billing/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function LinesTable({ txs, currency }: { txs: CycleTransactionLine[]; currency: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-3 py-2.5 font-medium text-muted-foreground">Trabajo</th>
            <th className="px-3 py-2.5 font-medium text-muted-foreground">Concepto</th>
            <th className="px-3 py-2.5 font-medium text-muted-foreground">Tipo</th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Horas</th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Monto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {txs.map((tx) => {
            const fueraCupo = tx.type === 'LOAN';
            return (
              <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {/* H8b: workedOn es @db.Date (UTC-midnight = día Asunción) → formatWorkedOn evita
                      el day-shift; createdAt es instante real → display local. */}
                  {tx.workedOn
                    ? formatWorkedOn(tx.workedOn)
                    : new Date(tx.createdAt).toLocaleDateString('es-PY', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                </td>
                <td className="px-3 py-2.5">
                  <p className="truncate max-w-[280px] text-foreground">{tx.task?.title ?? tx.note ?? '—'}</p>
                  {tx.atrasada && tx.workedMonth && (
                    <span
                      className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                      title="Trabajo de un mes anterior, arrastrado a esta factura"
                    >
                      <Clock className="h-2.5 w-2.5" /> {formatPeriodLabel(tx.workedMonth)}
                    </span>
                  )}
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
                  {tx.priceAmount ? formatCurrency(tx.priceAmount, tx.priceCurrency ?? currency) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CycleDetailPage() {
  const { clientId, cycleId } = useParams<{ clientId: string; cycleId: string }>();
  const { orgId } = useOrg();

  const [data, setData] = useState<CycleTransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

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

  // Descarga del PDF: fetch crudo + blob + <a download> (el api-client axios no expone helper de
  // blob), mismo patrón que el export CSV de tickets. Bearer + cookie de sesión (cross-site fallback).
  const handleDownloadPdf = useCallback(async () => {
    if (!orgId || !clientId || !cycleId || downloading) return;
    setDownloading(true);
    try {
      const url = `${API_URL}/api/v1/organizations/${orgId}/clients/${clientId}/billing/cycles/${cycleId}/pdf`;
      const token = getToken();
      const res = await fetch(url, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        if (res.status === 403) {
          toast.error('Sin permisos', 'No tenés permiso para descargar la factura');
        } else {
          toast.error('Error', `No se pudo descargar el PDF (HTTP ${res.status})`);
        }
        return;
      }
      const blob = await res.blob();
      const filename = `${data?.cycle.invoiceNumber ?? 'factura'}.pdf`;
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'No se pudo descargar el PDF');
    } finally {
      setDownloading(false);
    }
  }, [orgId, clientId, cycleId, downloading, data]);

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

  const { cycle, transactions, grupos } = data;
  const conf = CYCLE_STATUS_CONFIG[cycle.status];
  const startMonth = cycle.periodStart.slice(0, 7);
  const endMonth = (cycle.cutoffDate ?? cycle.periodEnd).slice(0, 7);
  const periodoLabel =
    startMonth === endMonth
      ? formatPeriodLabel(startMonth)
      : `${formatPeriodLabel(startMonth)} – ${formatPeriodLabel(endMonth)}`;
  const desglosado = grupos.length > 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/clients/${clientId}/facturacion`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a facturación
        </Link>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadPdf} disabled={downloading}>
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Descargar PDF
        </Button>
      </div>

      {/* Header con totales congelados */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-lg font-semibold text-foreground">{cycle.invoiceNumber}</h1>
              <Badge variant={conf.variant}>{conf.label}</Badge>
              {cycle.kind === 'ACCUMULATED' && <Badge variant="info">Acumulada</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Período: {periodoLabel}</p>
            {cycle.cutoffDate && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Facturado hasta {formatDate(cycle.cutoffDate)}
              </p>
            )}
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

      {/* Banner de anulación */}
      {cycle.status === 'CANCELLED' && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <Ban className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Factura anulada
            {cycle.cancelledAt ? ` el ${formatDate(cycle.cancelledAt)}` : ''}
            {cycle.cancelReason ? ` — ${cycle.cancelReason}` : ''}. Los movimientos volvieron a estar
            disponibles para facturar.
          </span>
        </div>
      )}

      {/* Líneas facturadas */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Líneas facturadas</h2>
          <span className="ml-auto text-xs text-muted-foreground">{transactions.length} movimiento(s)</span>
        </div>
        {transactions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sin líneas en esta factura</p>
        ) : desglosado ? (
          <div className="divide-y divide-border">
            {grupos.map((g) => (
              <div key={g.workedMonth}>
                <div className="flex items-center justify-between gap-3 bg-muted/30 px-4 py-2">
                  <span className="text-sm font-semibold text-foreground">{g.label}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-xs text-muted-foreground">{g.horas.toFixed(2)}h</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatCurrency(g.subtotal, cycle.currency)}
                    </span>
                  </div>
                </div>
                <LinesTable
                  txs={transactions.filter((t) =>
                    g.workedMonth === 'sin-fecha' ? t.workedMonth === null : t.workedMonth === g.workedMonth,
                  )}
                  currency={cycle.currency}
                />
              </div>
            ))}
          </div>
        ) : (
          <LinesTable txs={transactions} currency={cycle.currency} />
        )}
      </div>
    </div>
  );
}
