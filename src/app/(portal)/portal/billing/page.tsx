'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, Clock, Download, Loader2, FileText, Sliders } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, getToken } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// USD con 2 decimales (las variables se guardan en USD).
const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 'YYYY-MM' → 'Julio 2026' (es-PY, capitalizado).
function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  const s = new Intl.DateTimeFormat('es-PY', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ────────────────────────────────────────────────────────────────────
// #23 — Variables de facturación (consumo Botmaker). Reemplaza el mock: ahora
// lee /portal/variables (valores COMERCIALES del cliente, scopeado por su clientId;
// nunca el crudo del GET ni datos de otras cuentas).
// ────────────────────────────────────────────────────────────────────

interface PortalVariableStatement {
  period: string;
  note: string | null;
  currency: 'USD';
  items: { label: string; commercialValue: number }[];
  total: number;
}

function VariablesSection() {
  const [statements, setStatements] = useState<PortalVariableStatement[] | null>(null);

  useEffect(() => {
    api
      .get<{ statements: PortalVariableStatement[] }>('/portal/variables')
      .then((r) => setStatements(r.data.statements))
      .catch(() => setStatements([]));
  }, []);

  if (statements === null) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  if (statements.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card px-5 py-12 text-center">
        <Sliders className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">Estamos preparando tu facturación</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando esté lista, vas a ver acá el detalle de consumo del período.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {statements.map((s) => (
        <section key={s.period} className="rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-foreground">
                <Sliders className="h-4 w-4" /> Consumo — {monthLabel(s.period)}
              </h2>
              {s.note && <p className="mt-0.5 text-xs text-muted-foreground">{s.note}</p>}
            </div>
            <Badge variant="secondary" className="text-xs">
              {s.items.length} ítems
            </Badge>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 text-left font-medium">Concepto</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {s.items.map((it, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-3 align-top">
                      <div className="font-mono text-xs">{it.label}</div>
                    </td>
                    <td className="px-5 py-3 text-right align-top font-mono">{fmtUSD(it.commercialValue)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Total del período
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-medium">{fmtUSD(s.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// H8f — Facturas de horas emitidas (motor de horas). GATE-1: el cliente ve
// SENT/PAID + CANCELLED marcadas "Anulada" (sin acción); nunca DRAFT. El backend
// (getMyInvoices) ya filtra. El totalAmount ya incluye las variables convertidas (#23).
// ────────────────────────────────────────────────────────────────────

interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  kind: 'MONTH' | 'ACCUMULATED';
  periodStart: string;
  periodEnd: string;
  cutoffDate: string | null;
  totalHours: number;
  totalAmount: string;
  currency: string;
  status: 'SENT' | 'PAID' | 'CANCELLED';
  cancelReason: string | null;
  cancelledAt: string | null;
}

// H9b — nota de crédito emitida sobre una factura. Se muestra asociada a su factura (por número),
// con badge propio y monto NEGATIVO (formatCurrency ya lo pinta como "-Gs …"). Descargable.
interface PortalCreditNote {
  id: string;
  number: string; // NC-YYYY-NNNNN
  appliesToInvoiceNumber: string; // FAC-YYYY-NNNNN
  totalAmount: string; // ya NEGATIVO
  totalHours: number; // negativo
  currency: string;
  issuedAt: string;
}

// Estado → etiqueta es-PY + token semántico (theme-aware, 4.5:1 en claro/oscuro).
// Coherente con el admin (Borrador→Enviada→Cobrada). CANCELLED = "Anulada", sin acción.
const INVOICE_STATUS: Record<PortalInvoice['status'], { label: string; className: string }> = {
  SENT: { label: 'Enviada', className: 'bg-info/10 text-info' },
  PAID: { label: 'Cobrada', className: 'bg-success/15 text-success' },
  CANCELLED: { label: 'Anulada', className: 'bg-destructive/10 text-destructive' },
};

// Período en la zona del negocio (America/Asuncion) para no correr un mes por TZ —
// mismo criterio que el generador de PDF (H8e). Rango si el corte cae en otro mes.
function invoicePeriodLabel(inv: PortalInvoice): string {
  const fmt = (iso: string) => {
    const s = new Intl.DateTimeFormat('es-PY', {
      timeZone: 'America/Asuncion',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const start = fmt(inv.periodStart);
  const end = fmt(inv.cutoffDate ?? inv.periodEnd);
  return start === end ? start : `${start} – ${end}`;
}

function HoursInvoicesSection() {
  // H9b — el contrato de GET portal/invoices cambió a { invoices, creditNotes } (antes era un array).
  const [invoices, setInvoices] = useState<PortalInvoice[] | null>(null);
  const [creditNotes, setCreditNotes] = useState<PortalCreditNote[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ invoices: PortalInvoice[]; creditNotes: PortalCreditNote[] }>('/portal/invoices')
      .then((r) => {
        setInvoices(r.data.invoices);
        setCreditNotes(r.data.creditNotes ?? []);
      })
      .catch(() => {
        setInvoices([]);
        setCreditNotes([]);
      });
  }, []);

  // Descarga: fetch crudo + blob + <a download> (Bearer + cookie de sesión), mismo patrón que el
  // PDF admin de H8e. El backend valida que el documento sea del cliente y esté emitido (SENT/PAID).
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

  const handleDownload = useCallback(
    (inv: PortalInvoice) =>
      doDownload(`${API_URL}/api/v1/portal/invoices/${inv.id}/pdf`, `${inv.invoiceNumber}.pdf`, inv.id),
    [doDownload],
  );

  const handleDownloadCreditNote = useCallback(
    (nc: PortalCreditNote) =>
      doDownload(`${API_URL}/api/v1/portal/credit-notes/${nc.id}/pdf`, `${nc.number}.pdf`, nc.id),
    [doDownload],
  );

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-foreground">
          <Clock className="h-4 w-4" /> Facturas de horas
        </h2>
        {invoices && invoices.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {invoices.length}
          </Badge>
        )}
      </header>

      {invoices === null ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Todavía no se emitieron facturas.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {invoices.map((inv) => {
            const st = INVOICE_STATUS[inv.status];
            const cancelled = inv.status === 'CANCELLED';
            return (
              <li key={inv.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium text-foreground">{inv.invoiceNumber}</span>
                      <Badge className={`${st.className} text-[10px]`}>{st.label}</Badge>
                      {inv.kind === 'ACCUMULATED' && (
                        <span className="text-[10px] text-muted-foreground">Acumulada</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{invoicePeriodLabel(inv)}</p>
                    {cancelled && inv.cancelReason && (
                      <p className="mt-1 text-[11px] text-destructive/80">Motivo: {inv.cancelReason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold text-foreground">
                        {formatCurrency(inv.totalAmount, inv.currency)}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">{inv.totalHours.toFixed(2)}h</p>
                    </div>
                    {!cancelled && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleDownload(inv)}
                        disabled={downloadingId === inv.id}
                      >
                        {downloadingId === inv.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        Descargar
                      </Button>
                    )}
                  </div>
                </div>
                {/* H9b — notas de crédito asociadas a esta factura (por número) */}
                {creditNotes
                  .filter((nc) => nc.appliesToInvoiceNumber === inv.invoiceNumber)
                  .map((nc) => (
                    <div
                      key={nc.id}
                      className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info/30 bg-info/5 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-medium text-foreground">{nc.number}</span>
                          <Badge className="bg-info/10 text-info text-[10px]">Nota de crédito</Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Aplica a {nc.appliesToInvoiceNumber}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-mono text-sm font-semibold text-info">
                          {formatCurrency(nc.totalAmount, nc.currency)}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleDownloadCreditNote(nc)}
                          disabled={downloadingId === nc.id}
                        >
                          {downloadingId === nc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          Descargar
                        </Button>
                      </div>
                    </div>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────

export default function PortalBillingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Multitenant gate: el cliente debe tener portalBillingEnabled=true en su Client.
  const canSeeBilling = user?.client?.portalBillingEnabled === true;

  useEffect(() => {
    if (!loading && !canSeeBilling) router.replace('/portal');
  }, [loading, canSeeBilling, router]);

  if (loading || !canSeeBilling) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Receipt className="h-6 w-6" /> Facturación
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Detalle de consumo y facturas emitidas.
        </p>
      </div>

      {/* #23 — Variables de facturación (consumo comercial guardado) */}
      <VariablesSection />

      {/* H8f — Facturas de horas emitidas (motor de horas) */}
      <HoursInvoicesSection />
    </div>
  );
}
