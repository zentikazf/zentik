'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, Loader2, Ban, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, getToken } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { invoiceRangeLabel, invoiceDateShort } from '@/lib/invoice-period';
import { taxLegend, taxRatePercent } from '@/lib/tax';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// #63 — LA FACTURA COMO DOCUMENTO, con ruta propia.
//
// Antes el detalle vivía como acordeón dentro de la lista: el cliente abría una fila y leía el
// desglose apretado entre otras facturas, sin poder compartir el enlace ni volver a ella. Una
// factura es un documento — se abre, se lee entera y se baja. Por eso ahora tiene URL propia
// (`/portal/billing/<id>`), y la lista es sólo una lista.
//
// ⚠️ ACÁ NO SE CALCULA NADA. Todos los montos —incluido el desglose del IVA— vienen del backend
// como string, sacados del ESTAMPADO de esta factura. La página sólo los dibuja.

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  kind: 'MONTH' | 'ACCUMULATED';
  periodStart: string;
  periodEnd: string;
  cutoffDate: string | null;
  status: 'SENT' | 'PAID' | 'CANCELLED' | 'WRITTEN_OFF';
  // #65 A1.2 — el saldo, calculado en el backend. Opcionales por la ventana de deploy.
  creditedTotal?: string;
  balance?: string;
  creditNoteCount?: number;
  sentAt: string | null;
  paidAt: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  currency: string;
  consumo: { label: string; amount: string }[];
  fee: { label: string; amount: string }[];
  subtotalConsumo: string;
  subtotalFee: string;
  tiempo: { concepto: string; hours: number; amount: string }[];
  subtotalTiempo: string;
  totalHoras: number;
  total: string;
  // Los cuatro en null = factura emitida sin IVA → no se dibuja ninguna línea de impuesto.
  taxRate: string | null;
  taxMode: string | null;
  netAmount: string | null;
  taxAmount: string | null;
  creditNotes: {
    id: string;
    number: string;
    totalAmount: string; // NEGATIVO
    totalHours: number;
    issuedAt: string;
    taxMode: string | null;
  }[];
}

const STATUS: Record<InvoiceDetail['status'], { label: string; className: string }> = {
  SENT: { label: 'Enviada', className: 'bg-info/10 text-info' },
  PAID: { label: 'Cobrada', className: 'bg-success/15 text-success' },
  CANCELLED: { label: 'Anulada', className: 'bg-destructive/10 text-destructive' },
  // #65 A1.4 — ver el comentario gemelo en el listado: "Cerrada", en gris, nunca en verde.
  WRITTEN_OFF: { label: 'Cerrada', className: 'bg-muted text-muted-foreground' },
};

/** Una sección de líneas del documento (Consumo · Fee · Tiempo facturado) con su subtotal. */
function Section({
  title,
  rows,
  subtotal,
  currency,
  hoursCol,
}: {
  title: string;
  rows: { concepto: string; hours?: number; amount: string }[];
  subtotal: string;
  currency: string;
  hoursCol?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-muted/30 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2.5">
                  <p className="max-w-md truncate text-foreground">{r.concepto}</p>
                </td>
                {hoursCol && (
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">
                    {(r.hours ?? 0).toFixed(2)}h
                  </td>
                )}
                <td className="px-4 py-2.5 text-right font-mono text-foreground">
                  {formatCurrency(r.amount, currency)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-border bg-muted/20">
              <td className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Subtotal
              </td>
              {hoursCol && <td />}
              <td className="px-4 py-2.5 text-right font-mono font-medium text-foreground">
                {formatCurrency(subtotal, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PortalInvoicePage() {
  const router = useRouter();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { user, loading } = useAuth();
  const canSeeBilling = user?.client?.portalBillingEnabled === true;

  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !canSeeBilling) router.replace('/portal');
  }, [loading, canSeeBilling, router]);

  useEffect(() => {
    if (!canSeeBilling || !invoiceId) return;
    api
      .get<InvoiceDetail>(`/portal/invoices/${invoiceId}/detail`)
      .then((r) => setDetail(r.data))
      .catch(() => setError(true));
  }, [canSeeBilling, invoiceId]);

  const doDownload = useCallback(
    async (url: string, filename: string, id: string) => {
      if (downloadingId) return;
      setDownloadingId(id);
      try {
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
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
      } catch (err) {
        toast.error('Error', err instanceof Error ? err.message : 'No se pudo descargar el PDF');
      } finally {
        setDownloadingId(null);
      }
    },
    [downloadingId],
  );

  if (loading || !canSeeBilling || (!detail && !error)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-6">
        <Link href="/portal/billing" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver a Facturación
        </Link>
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No encontramos esta factura</p>
          <p className="mt-1 text-sm text-muted-foreground">Puede que ya no esté disponible.</p>
        </div>
      </div>
    );
  }

  const c = detail.currency;
  const st = STATUS[detail.status] ?? STATUS.SENT;
  const cancelled = detail.status === 'CANCELLED';
  // #63: el desglose se dibuja SÓLO si la factura lo tiene estampado. Sin IVA, el bloque de
  // totales queda en una sola línea, exactamente como antes.
  const conIva = detail.netAmount != null && detail.taxAmount != null;
  const pct = taxRatePercent(detail.taxRate);
  const leyenda = taxLegend(detail.taxMode, pct);

  return (
    <div className="space-y-6">
      <Link
        href="/portal/billing"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Facturación
      </Link>

      {/* ── Encabezado del documento ── */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold tracking-tight text-foreground">
                {detail.invoiceNumber}
              </h1>
              <Badge className={`${st.className} text-[10px]`}>{st.label}</Badge>
              {detail.kind === 'ACCUMULATED' && (
                <span className="text-[10px] text-muted-foreground">Acumulada</span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{invoiceRangeLabel(detail)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {detail.paidAt
                ? `Pagada el ${invoiceDateShort(detail.paidAt)}`
                : detail.sentAt
                  ? `Enviada el ${invoiceDateShort(detail.sentAt)}`
                  : ''}
              {detail.totalHoras > 0 && ` · ${detail.totalHoras.toFixed(2)}h facturadas`}
            </p>
          </div>
          {!cancelled && (
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                doDownload(
                  `${API_URL}/api/v1/portal/invoices/${detail.id}/pdf`,
                  `${detail.invoiceNumber}.pdf`,
                  detail.id,
                )
              }
              disabled={downloadingId === detail.id}
            >
              {downloadingId === detail.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Descargar PDF
            </Button>
          )}
        </div>

        {cancelled && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
            <Ban className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">
              Esta factura fue anulada
              {detail.cancelledAt ? ` el ${invoiceDateShort(detail.cancelledAt)}` : ''}.
              {detail.cancelReason ? ` Motivo: ${detail.cancelReason}` : ''}
            </p>
          </div>
        )}
      </div>

      {/* ── Cuerpo del documento: todas las secciones, abiertas ── */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6">
        {/* Consumo y Fee vienen con `label`; el tiempo con `concepto`. Se normalizan acá para que
            `Section` sea una sola tabla y no tres variantes de lo mismo. */}
        <Section
          title="Consumo"
          rows={detail.consumo.map((l) => ({ concepto: l.label, amount: l.amount }))}
          subtotal={detail.subtotalConsumo}
          currency={c}
        />
        <Section
          title="Fee fijo"
          rows={detail.fee.map((l) => ({ concepto: l.label, amount: l.amount }))}
          subtotal={detail.subtotalFee}
          currency={c}
        />
        {/* Sin acordeón: el tiempo facturado es parte de la factura, no un extra a descubrir. */}
        <Section
          title="Tiempo facturado"
          rows={detail.tiempo}
          subtotal={detail.subtotalTiempo}
          currency={c}
          hoursCol
        />

        {detail.consumo.length === 0 && detail.fee.length === 0 && detail.tiempo.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Esta factura no tiene líneas.</p>
        )}

        {/* ── Totales ──
            #63: con IVA son tres líneas y CIERRAN (`Subtotal + IVA = TOTAL`, por construcción del
            backend). Sin el desglose, una factura EXCLUDED mostraba subtotales netos y un total
            10% mayor, y la diferencia se leía como un error de la pantalla. */}
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          {conIva && (
            <>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono text-foreground">{formatCurrency(detail.netAmount, c)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">IVA ({pct}%)</span>
                <span className="font-mono text-foreground">{formatCurrency(detail.taxAmount, c)}</span>
              </div>
              <div className="border-t border-primary/20" />
            </>
          )}
          {/* #65 A1.2 — con notas de crédito, el total emitido deja de ser lo que el cliente debe.
              La página tiene un botón "Descargar PDF" a ochenta líneas de acá y ese PDF ya imprime
              el SALDO: sin este bloque, el documento y la pantalla que se lo dio dirían cosas
              distintas. Sin NC queda exactamente igual que antes. */}
          {(detail.creditNoteCount ?? 0) > 0 ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Total de la factura</span>
                <span className="font-mono text-foreground">{formatCurrency(detail.total, c)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Notas de crédito</span>
                <span className="font-mono text-info">
                  {formatCurrency(detail.creditedTotal ?? '0', c)}
                </span>
              </div>
              <div className="border-t border-primary/20" />
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Saldo
                </span>
                <span className="font-mono text-lg font-semibold text-foreground">
                  {formatCurrency(detail.balance ?? detail.total, c)}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total de la factura
              </span>
              <span className="font-mono text-lg font-semibold text-foreground">
                {formatCurrency(detail.total, c)}
              </span>
            </div>
          )}
          {/* La frase que responde la pregunta del cliente: ¿el IVA estaba adentro o se sumó? */}
          {leyenda && <p className="text-[11px] text-muted-foreground">{leyenda}</p>}
        </div>
      </div>

      {/* ── Notas de crédito de ESTA factura ── */}
      {detail.creditNotes.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-info/30 bg-card">
          <div className="border-b border-info/30 bg-info/5 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Notas de crédito sobre esta factura
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Importes que se te devolvieron. Se descuentan de lo facturado arriba.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {detail.creditNotes.map((nc) => (
              <li key={nc.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <span className="font-mono text-sm font-medium text-foreground">{nc.number}</span>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Emitida el {invoiceDateShort(nc.issuedAt)}
                    {nc.totalHours !== 0 && ` · ${nc.totalHours.toFixed(2)}h`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-sm font-semibold text-info">
                    {formatCurrency(nc.totalAmount, c)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      doDownload(
                        `${API_URL}/api/v1/portal/credit-notes/${nc.id}/pdf`,
                        `${nc.number}.pdf`,
                        nc.id,
                      )
                    }
                    disabled={downloadingId === nc.id}
                  >
                    {downloadingId === nc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    PDF
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
