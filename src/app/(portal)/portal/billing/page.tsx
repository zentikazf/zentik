'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, Download, Loader2, FileText, ChevronDown, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, getToken } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// 'YYYY-MM' → 'Julio 2026' (es-PY, capitalizado).
function monthLabel(period: string): string {
 const [y, m] = period.split('-').map(Number);
 if (!y || !m) return period;
 const s = new Intl.DateTimeFormat('es-PY', { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 15)));
 return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Tipos ────────────────────────────────────────────────────────────

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

interface PortalCreditNote {
 id: string;
 number: string;
 appliesToInvoiceNumber: string;
 totalAmount: string;
 totalHours: number;
 currency: string;
 issuedAt: string;
}

// #23 — detalle de una factura (todo en Gs, como se facturó).
interface InvoiceDetail {
 invoiceNumber: string;
 currency: string;
 consumo: { label: string; amount: string }[];
 fee: { label: string; amount: string }[];
 subtotalConsumo: string;
 subtotalFee: string;
 tiempo: { concepto: string; hours: number; amount: string }[];
 subtotalTiempo: string;
 totalHoras: number;
 total: string;
}

const INVOICE_STATUS: Record<PortalInvoice['status'], { label: string; className: string }> = {
 SENT: { label: 'Enviada', className: 'bg-info/10 text-info' },
 PAID: { label: 'Cobrada', className: 'bg-success/15 text-success' },
 CANCELLED: { label: 'Anulada', className: 'bg-destructive/10 text-destructive' },
};

function invoiceMonthKey(inv: PortalInvoice): string {
 const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit' })
  .formatToParts(new Date(inv.periodStart));
 const y = p.find((x) => x.type === 'year')?.value ?? '0000';
 const m = p.find((x) => x.type === 'month')?.value ?? '00';
 return `${y}-${m}`;
}

function invoiceRangeLabel(inv: PortalInvoice): string {
 const fmt = (iso: string) => {
  const s = new Intl.DateTimeFormat('es-PY', { timeZone: 'America/Asuncion', month: 'long', year: 'numeric' }).format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
 };
 const start = fmt(inv.periodStart);
 const end = fmt(inv.cutoffDate ?? inv.periodEnd);
 return start === end ? start : `${start} – ${end}`;
}

// ── Sub-bloque: tabla de líneas (concepto + monto Gs) con subtotal ──
function LinesTable({ title, rows, subtotal, currency }: {
 title: string;
 rows: { label: string; amount: string }[];
 subtotal: string;
 currency: string;
}) {
 return (
  <div className="overflow-x-auto rounded-lg border border-border">
   <table className="w-full text-sm">
    <thead>
     <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
      <th className="px-4 py-2.5 text-left font-medium">{title}</th>
      <th className="px-4 py-2.5 text-right font-medium">Total</th>
     </tr>
    </thead>
    <tbody>
     {rows.length === 0 ? (
      <tr><td colSpan={2} className="px-4 py-3 text-center text-xs text-muted-foreground">Sin ítems.</td></tr>
     ) : (
      rows.map((r, i) => (
       <tr key={i} className="border-b border-border/50 last:border-0">
        <td className="px-4 py-2.5 font-mono text-xs">{r.label}</td>
        <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(r.amount, currency)}</td>
       </tr>
      ))
     )}
     <tr className="border-t-2 border-border bg-muted/30">
      <td className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Subtotal</td>
      <td className="px-4 py-2.5 text-right font-mono font-medium">{formatCurrency(subtotal, currency)}</td>
     </tr>
    </tbody>
   </table>
  </div>
 );
}

// ── Detalle de la factura (Consumo → Fee → Tiempo facturado colapsable), todo en Gs ──
function InvoiceDetailBody({ detail, tiempoOpen, onToggleTiempo }: {
 detail: InvoiceDetail;
 tiempoOpen: boolean;
 onToggleTiempo: () => void;
}) {
 const c = detail.currency;
 return (
  <div className="space-y-4">
   {/* 1) Consumo */}
   <LinesTable title="Consumo" rows={detail.consumo} subtotal={detail.subtotalConsumo} currency={c} />
   {/* 2) Fee fijo */}
   {detail.fee.length > 0 && (
    <LinesTable title="Fee fijo" rows={detail.fee} subtotal={detail.subtotalFee} currency={c} />
   )}
   {/* 3) Tiempo facturado — sub-card colapsable */}
   {detail.tiempo.length > 0 && (
    <div className="overflow-hidden rounded-lg border border-border">
     <button
      type="button"
      onClick={onToggleTiempo}
      aria-expanded={tiempoOpen}
      className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
     >
      <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200', tiempoOpen && 'rotate-180')} />
      <Clock className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Tiempo facturado</span>
      <span className="ml-auto font-mono text-xs font-semibold text-foreground">
       {detail.totalHoras.toFixed(2)}h · {formatCurrency(detail.subtotalTiempo, c)}
      </span>
     </button>
     {tiempoOpen && (
      <div className="overflow-x-auto border-t border-border animate-fade-in">
       <table className="w-full text-sm">
        <thead>
         <tr className="border-b border-border bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
          <th className="px-4 py-2.5 text-left font-medium">Concepto</th>
          <th className="px-4 py-2.5 text-right font-medium">Horas</th>
          <th className="px-4 py-2.5 text-right font-medium">Monto</th>
         </tr>
        </thead>
        <tbody>
         {detail.tiempo.map((t, i) => (
          <tr key={i} className="border-b border-border/50 last:border-0">
           <td className="px-4 py-2.5"><p className="truncate max-w-xs text-foreground">{t.concepto}</p></td>
           <td className="px-4 py-2.5 text-right font-mono text-xs">{t.hours.toFixed(2)}h</td>
           <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(t.amount, c)}</td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     )}
    </div>
   )}
   {/* Total de la factura */}
   <div className="flex items-baseline justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total de la factura</span>
    <span className="font-mono text-lg font-semibold text-foreground">{formatCurrency(detail.total, c)}</span>
   </div>
  </div>
 );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function PortalBillingPage() {
 const router = useRouter();
 const { user, loading } = useAuth();
 const canSeeBilling = user?.client?.portalBillingEnabled === true;

 const [invoices, setInvoices] = useState<PortalInvoice[] | null>(null);
 const [creditNotes, setCreditNotes] = useState<PortalCreditNote[]>([]);
 const [openInv, setOpenInv] = useState<Set<string>>(new Set());
 const [openTiempo, setOpenTiempo] = useState<Set<string>>(new Set());
 const [details, setDetails] = useState<Map<string, InvoiceDetail | 'loading' | 'error'>>(new Map());
 const [downloadingId, setDownloadingId] = useState<string | null>(null);

 useEffect(() => {
  if (!loading && !canSeeBilling) router.replace('/portal');
 }, [loading, canSeeBilling, router]);

 useEffect(() => {
  if (!canSeeBilling) return;
  api
   .get<{ invoices: PortalInvoice[]; creditNotes: PortalCreditNote[] }>('/portal/invoices')
   .then((r) => {
    setInvoices(r.data.invoices ?? []);
    setCreditNotes(r.data.creditNotes ?? []);
   })
   .catch(() => {
    setInvoices([]);
    setCreditNotes([]);
   });
 }, [canSeeBilling]);

 const loadDetail = useCallback(async (id: string) => {
  setDetails((prev) => new Map(prev).set(id, 'loading'));
  try {
   const res = await api.get<InvoiceDetail>(`/portal/invoices/${id}/detail`);
   setDetails((prev) => new Map(prev).set(id, res.data));
  } catch {
   setDetails((prev) => new Map(prev).set(id, 'error'));
  }
 }, []);

 const toggleInvoice = (id: string) => {
  setOpenInv((prev) => {
   const next = new Set(prev);
   if (next.has(id)) next.delete(id);
   else {
    next.add(id);
    if (!details.has(id)) loadDetail(id); // lazy load al abrir
   }
   return next;
  });
 };

 const toggleTiempo = (id: string) =>
  setOpenTiempo((prev) => {
   const next = new Set(prev);
   if (next.has(id)) next.delete(id);
   else next.add(id);
   return next;
  });

 const doDownload = useCallback(
  async (url: string, filename: string, id: string) => {
   if (downloadingId) return;
   setDownloadingId(id);
   try {
    const token = getToken();
    const res = await fetch(url, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : undefined });
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

 if (loading || !canSeeBilling) {
  return (
   <div className="space-y-6">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-96 rounded-xl" />
   </div>
  );
 }

 // Facturas agrupadas por mes de facturación (desc).
 const months = (() => {
  const map = new Map<string, PortalInvoice[]>();
  for (const inv of invoices ?? []) {
   const k = invoiceMonthKey(inv);
   const arr = map.get(k);
   if (arr) arr.push(inv);
   else map.set(k, [inv]);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
 })();

 return (
  <div className="space-y-6">
   <div>
    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
     <Receipt className="h-6 w-6" /> Facturación
    </h1>
    <p className="mt-1 text-sm text-muted-foreground">Tus facturas por mes. Abrí una para ver el detalle.</p>
   </div>

   {invoices === null ? (
    <div className="space-y-3">
     {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
   ) : months.length === 0 ? (
    <div className="rounded-xl border border-border bg-card px-5 py-12 text-center">
     <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
     <p className="text-sm font-medium text-foreground">Estamos preparando tu facturación</p>
     <p className="mt-1 text-sm text-muted-foreground">Todavía no se emitieron facturas.</p>
    </div>
   ) : (
    <div className="space-y-6">
     {months.map(([key, invs]) => (
      <div key={key} className="space-y-3">
       <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{monthLabel(key)}</h2>
       {invs.map((inv) => {
        const st = INVOICE_STATUS[inv.status];
        const cancelled = inv.status === 'CANCELLED';
        const open = openInv.has(inv.id);
        const detail = details.get(inv.id);
        return (
         <div key={inv.id} className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Header del card de factura */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
           <button
            type="button"
            onClick={() => toggleInvoice(inv.id)}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
           >
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
            <div className="min-w-0">
             <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-medium text-foreground">{inv.invoiceNumber}</span>
              <Badge className={`${st.className} text-[10px]`}>{st.label}</Badge>
              {inv.kind === 'ACCUMULATED' && <span className="text-[10px] text-muted-foreground">Acumulada</span>}
             </div>
             <p className="mt-0.5 text-xs text-muted-foreground">{invoiceRangeLabel(inv)}</p>
             {cancelled && inv.cancelReason && (
              <p className="mt-1 text-[11px] text-destructive/80">Motivo: {inv.cancelReason}</p>
             )}
            </div>
           </button>
           <div className="flex items-center gap-4">
            <div className="text-right">
             <p className="font-mono text-sm font-semibold text-foreground">{formatCurrency(inv.totalAmount, inv.currency)}</p>
             <p className="font-mono text-[11px] text-muted-foreground">{inv.totalHours.toFixed(2)}h</p>
            </div>
            {!cancelled && (
             <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => doDownload(`${API_URL}/api/v1/portal/invoices/${inv.id}/pdf`, `${inv.invoiceNumber}.pdf`, inv.id)}
              disabled={downloadingId === inv.id}
             >
              {downloadingId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar
             </Button>
            )}
           </div>
          </div>

          {/* Detalle (lazy) */}
          {open && (
           <div className="border-t border-border p-4 animate-fade-in">
            {detail === undefined || detail === 'loading' ? (
             <Skeleton className="h-40 rounded-lg" />
            ) : detail === 'error' ? (
             <p className="py-4 text-center text-sm text-muted-foreground">No se pudo cargar el detalle.</p>
            ) : (
             <InvoiceDetailBody detail={detail} tiempoOpen={openTiempo.has(inv.id)} onToggleTiempo={() => toggleTiempo(inv.id)} />
            )}
           </div>
          )}

          {/* Notas de crédito asociadas */}
          {creditNotes
           .filter((nc) => nc.appliesToInvoiceNumber === inv.invoiceNumber)
           .map((nc) => (
            <div key={nc.id} className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info/30 bg-info/5 px-4 py-2.5">
             <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
               <span className="font-mono text-xs font-medium text-foreground">{nc.number}</span>
               <Badge className="bg-info/10 text-info text-[10px]">Nota de crédito</Badge>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Aplica a {nc.appliesToInvoiceNumber}</p>
             </div>
             <div className="flex items-center gap-3">
              <p className="font-mono text-sm font-semibold text-info">{formatCurrency(nc.totalAmount, nc.currency)}</p>
              <Button
               variant="outline"
               size="sm"
               className="gap-1.5"
               onClick={() => doDownload(`${API_URL}/api/v1/portal/credit-notes/${nc.id}/pdf`, `${nc.number}.pdf`, nc.id)}
               disabled={downloadingId === nc.id}
              >
               {downloadingId === nc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
               Descargar
              </Button>
             </div>
            </div>
           ))}
         </div>
        );
       })}
      </div>
     ))}
    </div>
   )}
  </div>
 );
}
