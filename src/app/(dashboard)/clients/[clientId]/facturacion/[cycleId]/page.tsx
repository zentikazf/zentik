'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Ban, Download, Loader2, FileMinus, Sliders } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getToken } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, formatDate, formatWorkedOn } from '@/lib/utils';
import {
  CYCLE_STATUS_CONFIG,
  CreditNoteSummary,
  CycleTransactionLine,
  CycleTransactionsResponse,
  formatPeriodLabel,
} from '@/components/client-billing/types';
import { CreditNoteDialog } from '@/components/client-billing/credit-note-dialog';

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

  const { hasPermission } = usePermissions();

  const [data, setData] = useState<CycleTransactionsResponse | null>(null);
  const [creditNotes, setCreditNotes] = useState<CreditNoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadingNcId, setDownloadingNcId] = useState<string | null>(null);
  const [ncOpen, setNcOpen] = useState(false);

  const load = useCallback(async () => {
    if (!orgId || !clientId || !cycleId) return;
    setLoading(true);
    const cycleBase = `/organizations/${orgId}/clients/${clientId}/billing/cycles/${cycleId}`;
    try {
      // Las NC alimentan el banner "esta factura tiene N nota(s) de crédito"; su fetch tolera fallo
      // (p. ej. sin read:billing) sin romper la carga principal de la factura.
      const [txRes, ncRes] = await Promise.all([
        api.get<CycleTransactionsResponse>(`${cycleBase}/transactions`),
        api.get<CreditNoteSummary[]>(`${cycleBase}/credit-notes`).catch(() => null),
      ]);
      setData(txRes.data);
      setCreditNotes(ncRes?.data ?? []);
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

  // Descarga del PDF de una nota de crédito (ruta staff), mismo patrón blob que la factura.
  const handleDownloadCreditNote = useCallback(
    async (nc: CreditNoteSummary) => {
      if (!orgId || !clientId || downloadingNcId) return;
      setDownloadingNcId(nc.id);
      try {
        const url = `${API_URL}/api/v1/organizations/${orgId}/clients/${clientId}/billing/credit-notes/${nc.id}/pdf`;
        const token = getToken();
        const res = await fetch(url, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          toast.error('Error', `No se pudo descargar el PDF (HTTP ${res.status})`);
          return;
        }
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = `${nc.number}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
      } catch (err) {
        toast.error('Error', err instanceof Error ? err.message : 'No se pudo descargar el PDF');
      } finally {
        setDownloadingNcId(null);
      }
    },
    [orgId, clientId, downloadingNcId],
  );

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
        <div className="flex items-center gap-2">
          {hasPermission('manage:billing') && (cycle.status === 'SENT' || cycle.status === 'PAID') && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setNcOpen(true)}>
              <FileMinus className="h-4 w-4" /> Nota de crédito
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar PDF
          </Button>
        </div>
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
              {/* #63 — El IVA ESTAMPADO en esta factura (no el que el cliente tenga hoy: acá se lee
                  el documento, no la configuración). Sin el desglose, una factura EXCLUDED mostraba
                  un total mayor que la suma de sus propios subtotales por mes —que son netos— y la
                  diferencia se leía como un error de la pantalla. Null = factura sin IVA: queda
                  exactamente la línea única de siempre. */}
              {cycle.netAmount != null && cycle.taxAmount != null && (
                <div className="mb-1 space-y-0.5">
                  <p className="font-mono text-xs text-muted-foreground">
                    Subtotal {formatCurrency(cycle.netAmount, cycle.currency)}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    IVA
                    {cycle.taxRate != null &&
                      ` (${new Intl.NumberFormat('es-PY', { maximumFractionDigits: 2 }).format(
                        parseFloat(cycle.taxRate) * 100,
                      )}%)`}{' '}
                    {formatCurrency(cycle.taxAmount, cycle.currency)}
                  </p>
                </div>
              )}
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

      {/* Banner: esta factura tiene nota(s) de crédito */}
      {creditNotes.length > 0 && (
        <div className="rounded-xl border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">
          <div className="flex items-center gap-2">
            <FileMinus className="h-4 w-4 shrink-0" />
            <span className="font-medium">
              Esta factura tiene {creditNotes.length} nota{creditNotes.length === 1 ? '' : 's'} de crédito.
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {creditNotes.map((nc) => (
              <li key={nc.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs">
                  {nc.number} · {formatCurrency(nc.totalAmount, cycle.currency)} · {nc.totalHours.toFixed(2)}h
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-info hover:text-info"
                  onClick={() => handleDownloadCreditNote(nc)}
                  disabled={downloadingNcId === nc.id}
                >
                  {downloadingNcId === nc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Descargar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* #23: Variables (Botmaker) estampadas en la factura — consumo primero, tiempo después */}
      {cycle.variablesBilling && cycle.variablesBilling.lines.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Sliders className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Variables (Botmaker)</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              1 USD ≈ {formatCurrency(cycle.variablesBilling.rate, cycle.currency)} ·{' '}
              {formatDate(cycle.variablesBilling.rateDate)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2.5 font-medium text-muted-foreground">Variable</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Comercial (USD)</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Convertido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cycle.variablesBilling.lines.map((l, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-xs text-foreground">{l.label}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                      US$ {l.commercialUsd}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-foreground">
                      {formatCurrency(l.convertedPyg, cycle.currency)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground" colSpan={2}>
                    Subtotal variables
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-foreground">
                    {formatCurrency(cycle.variablesBilling.amountPyg, cycle.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Líneas facturadas */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Tiempo facturado</h2>
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

      {orgId && (
        <CreditNoteDialog
          orgId={orgId}
          clientId={clientId}
          cycleId={cycleId}
          invoiceNumber={cycle.invoiceNumber}
          currency={cycle.currency}
          lines={transactions}
          open={ncOpen}
          onOpenChange={setNcOpen}
          onDone={load}
        />
      )}
    </div>
  );
}
