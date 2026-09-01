'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Receipt, FileText, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import { formatCurrency, cn } from '@/lib/utils';
// #62 — la MISMA etiqueta de periodo que usan las cards de /portal/hours (una sola copia).
import { invoiceRangeLabel } from '@/lib/invoice-period';
import { taxLabel } from '@/lib/tax';

// #63 — Esta pantalla pasó a ser SÓLO UNA LISTA.
//
// El detalle vivía acá adentro como acordeón: el cliente abría una fila y leía su factura apretada
// entre las otras, sin poder compartir el enlace ni volver a ella. Una factura es un DOCUMENTO, así
// que ahora tiene ruta propia (`/portal/billing/<id>`) y esta página sólo lista y enlaza.
//
// El acordeón se conserva donde sí corresponde: en `/portal/hours`, que es una vista de CONSUMO
// —meses que se abren y se cierran para explorar—, no un documento.

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
 status: 'SENT' | 'PAID' | 'CANCELLED' | 'WRITTEN_OFF';
 cancelReason: string | null;
 cancelledAt: string | null;
 // #63 — El modo ESTAMPADO en ESTA factura. Opcional por la ventana de deploy (el front sube
 // antes que el backend): sin dato, sin etiqueta, que es como se veía antes de #63.
 taxMode?: string | null;
}

interface PortalCreditNote {
 id: string;
 number: string;
 appliesToInvoiceNumber: string;
 totalAmount: string;
 totalHours: number;
 currency: string;
 issuedAt: string;
 taxMode?: string | null;
}

const INVOICE_STATUS: Record<PortalInvoice['status'], { label: string; className: string }> = {
 SENT: { label: 'Enviada', className: 'bg-info/10 text-info' },
 PAID: { label: 'Cobrada', className: 'bg-success/15 text-success' },
 CANCELLED: { label: 'Anulada', className: 'bg-destructive/10 text-destructive' },
 // #65 A1.4 — "Cerrada": el cliente no necesita saber la contabilidad interna de por qué dejó de
 //   cobrarse, pero SÍ que esta factura ya no está esperando su pago. Deliberadamente NO usa el
 //   verde de "Cobrada": no entró plata, y confundir las dos cosas es exactamente lo que este
 //   estado existe para evitar.
 WRITTEN_OFF: { label: 'Cerrada', className: 'bg-muted text-muted-foreground' },
};

function invoiceMonthKey(inv: PortalInvoice): string {
 const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit' })
  .formatToParts(new Date(inv.periodStart));
 const y = p.find((x) => x.type === 'year')?.value ?? '0000';
 const m = p.find((x) => x.type === 'month')?.value ?? '00';
 return `${y}-${m}`;
}

// ── Page ─────────────────────────────────────────────────────────────

export default function PortalBillingPage() {
 const router = useRouter();
 const { user, loading } = useAuth();
 const canSeeBilling = user?.client?.portalBillingEnabled === true;

 const [invoices, setInvoices] = useState<PortalInvoice[] | null>(null);
 const [creditNotes, setCreditNotes] = useState<PortalCreditNote[]>([]);

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
    <p className="mt-1 text-sm text-muted-foreground">Tus facturas por mes. Entrá a una para ver el detalle completo.</p>
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
        // #63 — La etiqueta sale del `taxMode` de ESTA factura, nunca de la configuración actual
        // del cliente: en esta lista conviven facturas de distintas épocas y distintos modos, y
        // las anteriores a #63 no llevan ninguna.
        const etiqueta = taxLabel(inv.taxMode);
        const ncs = creditNotes.filter((nc) => nc.appliesToInvoiceNumber === inv.invoiceNumber);
        return (
         <div key={inv.id} className="overflow-hidden rounded-xl border border-border bg-card">
          <Link
           href={`/portal/billing/${inv.id}`}
           className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/30"
          >
           <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
             <span className="font-mono text-sm font-medium text-foreground">{inv.invoiceNumber}</span>
             <Badge className={`${st.className} text-[10px]`}>{st.label}</Badge>
             {inv.kind === 'ACCUMULATED' && <span className="text-[10px] text-muted-foreground">Acumulada</span>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{invoiceRangeLabel(inv)}</p>
            {cancelled && inv.cancelReason && (
             <p className="mt-1 text-[11px] text-destructive/80">Motivo: {inv.cancelReason}</p>
            )}
            {ncs.length > 0 && (
             <p className="mt-1 text-[11px] text-info">
              {ncs.length} nota{ncs.length === 1 ? '' : 's'} de crédito
             </p>
            )}
           </div>
           <div className="flex items-center gap-3">
            <div className="text-right">
             <div className="flex items-baseline justify-end gap-1.5">
              <p className={cn('font-mono text-sm font-semibold', cancelled ? 'text-muted-foreground line-through' : 'text-foreground')}>
               {formatCurrency(inv.totalAmount, inv.currency)}
              </p>
              {etiqueta && <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{etiqueta}</span>}
             </div>
             <p className="font-mono text-[11px] text-muted-foreground">{inv.totalHours.toFixed(2)}h</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
           </div>
          </Link>
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
