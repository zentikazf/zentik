'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// ────────────────────────────────────────────────────────────────────
// Datos mock — período 2026-04. Reemplazar por fetch a /portal/billing
// cuando exista integración con Botmaker.
// ────────────────────────────────────────────────────────────────────

interface ProductUsage {
 productId: string;
 usage: number;
 cost: number;
}

interface BillingPeriodData {
 period: string;
 accountAlias: string;
 productUsage: ProductUsage[];
 project: { name: string; messages: number; sessions: number; tokens: number; billableActions: number; waConvs: number };
}

const FORTALEZA_DATA: BillingPeriodData = {
 period: '2026-04',
 accountAlias: 'Fortaleza Inmuebles',
 productUsage: [
  { productId: 'WA_BUSINESS_MKT_INITIATED_CONVERSATIONS', usage: 10848, cost: 875.17 },
  { productId: 'SESSIONS', usage: 12670, cost: 415.81 },
  { productId: 'FEE', usage: 1, cost: 149 },
  { productId: 'GENERATIVE_AGENT_TOKENS', usage: 37409709, cost: 59.86 },
  { productId: 'AGENTS', usage: 30, cost: 60 },
  { productId: 'WHATSAPP_LINE', usage: 2, cost: 50 },
  { productId: 'NOTIFICATION_WA_FAILED', usage: 3178, cost: 9.54 },
  { productId: 'GENERATIVE_ADMINISTRATIVE_COSTS', usage: 43982415, cost: 6.48 },
  { productId: 'GENERATIVE_PRODUCTIVITY_TOKENS', usage: 4713660, cost: 1.89 },
  { productId: 'GENERATIVE_NLU_TOKENS', usage: 935037, cost: 1.5 },
  { productId: 'GENERATIVE_RESPONSES_TOKENS', usage: 924009, cost: 1.48 },
  { productId: 'WA_USER_INITIATED_CONVERSATIONS', usage: 413, cost: 1.78 },
  { productId: 'WA_BUSINESS_UTIL_INITIATED_CONVERSATIONS', usage: 16, cost: 0.27 },
  { productId: 'AV_SCAN', usage: 252, cost: 0.23 },
  { productId: 'NOTIFICATION_WA_NOT_ANSWERED', usage: 7, cost: 0.04 },
  { productId: 'BILLABLE_ACTIONS', usage: 40, cost: 0 },
  { productId: 'MESSAGES', usage: 33928, cost: 0 },
  { productId: 'URL_SCAN', usage: 34, cost: 0 },
  { productId: 'CDN_STORAGE', usage: 170408637, cost: 0 },
 ],
 project: { name: 'fortaleza', messages: 33928, sessions: 12670, tokens: 43982415, billableActions: 40, waConvs: 11277 },
};

// ────────────────────────────────────────────────────────────────────
// Reglas de pricing Fortaleza — overrides sobre costo Botmaker.
// Items sin regla: traspaso directo (passthrough).
// ────────────────────────────────────────────────────────────────────

type PricingRule = (p: ProductUsage) => { cost: number; note: string };

const FORTALEZA_RULES: Record<string, PricingRule> = {
 SESSIONS: (p) => {
  const included = 3000;
  const billable = Math.max(0, p.usage - included);
  return {
   cost: +(billable * 0.065).toFixed(2),
   note: `${fmtNum(included)} incluidas · ${fmtNum(billable)} × $0.065`,
  };
 },
 FEE: () => ({ cost: 299, note: 'Fee mensual plataforma' }),
 AGENTS: (p) => ({
  cost: 24 * 10,
  note: `${p.usage} total · 6 internos · 24 × $10`,
 }),
 WHATSAPP_LINE: (p) => {
  const billable = Math.max(0, p.usage - 1);
  return {
   cost: billable * 100,
   note: `${p.usage} totales · 1 incluida · ${billable} × $100`,
  };
 },
 AV_SCAN: (p) => ({
  cost: +(p.usage * 0.024).toFixed(2),
  note: `${fmtNum(p.usage)} × $0.024`,
 }),
 NOTIFICATION_WA_FAILED: (p) => ({
  cost: +(p.usage * 0.06).toFixed(2),
  note: `${fmtNum(p.usage)} × $0.06`,
 }),
 NOTIFICATION_WA_NOT_ANSWERED: (p) => ({
  cost: +(p.usage * 0.10).toFixed(2),
  note: `${p.usage} × $0.10`,
 }),
};

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtNum(n: number) { return n.toLocaleString('en-US'); }
const fmtCompact = (n: number) => {
 if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
 if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
 if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
 return n.toString();
};

const productLabel = (id: string) =>
 id
  .replace(/_/g, ' ')
  .toLowerCase()
  .replace(/\bwa\b/g, 'WA')
  .replace(/\bnlu\b/g, 'NLU')
  .replace(/\bav\b/g, 'AV')
  .replace(/\bcdn\b/g, 'CDN')
  .replace(/\burl\b/g, 'URL')
  .replace(/^\w/, (c) => c.toUpperCase());

interface TransformedProduct extends ProductUsage {
 note?: string;
 override: boolean;
}

function buildClientView(data: BillingPeriodData) {
 const transformed: TransformedProduct[] = data.productUsage
  .filter((p) => p.cost > 0)
  .map((p) => {
   const rule = FORTALEZA_RULES[p.productId];
   if (rule) {
    const result = rule(p);
    return { ...p, cost: result.cost, note: result.note, override: true };
   }
   return { ...p, override: false };
  });

 const fee = transformed.find((p) => p.productId === 'FEE') || null;
 const variables = transformed
  .filter((p) => p.productId !== 'FEE')
  .sort((a, b) => b.cost - a.cost);

 const subtotalVariables = +variables.reduce((s, p) => s + p.cost, 0).toFixed(2);
 const subtotalFee = fee ? fee.cost : 0;
 const subtotal = +(subtotalVariables + subtotalFee).toFixed(2);
 const iva = +(subtotal * 0.10).toFixed(2);
 const total = +(subtotal + iva).toFixed(2);

 const zeroProducts = data.productUsage.filter((p) => p.cost === 0 && p.usage > 0);

 return { variables, fee, subtotalVariables, subtotalFee, subtotal, iva, total, zeroProducts };
}

// ────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────

export default function PortalBillingPage() {
 const router = useRouter();
 const { user, loading } = useAuth();
 const [data] = useState<BillingPeriodData>(FORTALEZA_DATA);

 // Multitenant gate: el cliente debe tener portalBillingEnabled=true en su Client.
 // Esto reemplaza el matching frágil de slug/name por "fortaleza". Cuando otros
 // clientes activen el feature, no requiere cambio de código — solo flip del flag.
 const canSeeBilling = user?.client?.portalBillingEnabled === true;

 useEffect(() => {
  if (!loading && !canSeeBilling) router.replace('/portal');
 }, [loading, canSeeBilling, router]);

 const view = useMemo(() => buildClientView(data), [data]);

 if (loading || !canSeeBilling) {
  return (
   <div className="space-y-6">
    <Skeleton className="h-8 w-64" />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
     {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
    <Skeleton className="h-96 rounded-xl" />
   </div>
  );
 }

 return (
  <div className="space-y-6">
   {/* Header */}
   <div className="flex items-start justify-between gap-4 flex-wrap">
    <div>
     <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
      <Receipt className="h-6 w-6" /> Facturación
     </h1>
     <p className="mt-1 text-sm text-muted-foreground">
      Detalle de consumo y facturación del período · {data.accountAlias}
     </p>
    </div>
    <div className="text-right">
     <p className="text-xs uppercase tracking-wider text-muted-foreground">Período</p>
     <p className="font-mono text-lg font-medium">{data.period}</p>
    </div>
   </div>

   {/* KPIs */}
   <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
    <KpiCard label="Subtotal consumo" value={fmtUSD(view.subtotalVariables)} sub="USD" />
    <KpiCard label="Fee fijo" value={fmtUSD(view.subtotalFee)} sub="USD" />
    <KpiCard label="IVA 10%" value={fmtUSD(view.iva)} sub="USD" />
    <KpiCard label="Total a pagar" value={fmtUSD(view.total)} sub="USD c/ IVA" highlight />
   </div>

   {/* Productos facturables */}
   <section className="rounded-xl border border-border bg-card">
    <header className="flex items-center justify-between border-b border-border px-5 py-4">
     <h2 className="text-sm font-medium uppercase tracking-wider text-foreground">
      Productos facturados
     </h2>
     <Badge variant="secondary" className="text-xs">{view.variables.length} ítems</Badge>
    </header>
    <div className="overflow-x-auto">
     <table className="w-full text-sm">
      <thead>
       <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
        <th className="px-5 py-3 text-left font-medium">Concepto</th>
        <th className="px-5 py-3 text-right font-medium">Cantidad</th>
        <th className="px-5 py-3 text-right font-medium">Precio</th>
        <th className="px-5 py-3 text-right font-medium">Total</th>
       </tr>
      </thead>
      <tbody>
       {view.variables.map((p) => (
        <tr key={p.productId} className="border-b border-border/50 last:border-0">
         <td className="px-5 py-3 align-top">
          <div className="font-mono text-xs">{productLabel(p.productId)}</div>
          {p.note && <div className="mt-1 font-mono text-[10px] text-muted-foreground">{p.note}</div>}
         </td>
         <td className="px-5 py-3 text-right align-top font-mono text-xs text-muted-foreground">
          {fmtNum(p.usage)}
         </td>
         <td className="px-5 py-3 text-right align-top font-mono text-xs text-muted-foreground">
          {p.override ? '—' : fmtUnitPrice(p.cost, p.usage)}
         </td>
         <td className="px-5 py-3 text-right align-top font-mono">{fmtUSD(p.cost)}</td>
        </tr>
       ))}
       <tr className="border-t-2 border-border bg-muted/30">
        <td className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground" colSpan={3}>
         Subtotal consumo
        </td>
        <td className="px-5 py-3 text-right font-mono font-medium">{fmtUSD(view.subtotalVariables)}</td>
       </tr>
      </tbody>
     </table>
    </div>
   </section>

   {/* Fee fijo */}
   {view.fee && (
    <section className="rounded-xl border border-border bg-card">
     <header className="border-b border-border px-5 py-4">
      <h2 className="text-sm font-medium uppercase tracking-wider text-foreground">Fee fijo</h2>
     </header>
     <table className="w-full text-sm">
      <tbody>
       <tr>
        <td className="px-5 py-3">
         <div className="font-mono text-xs">{productLabel(view.fee.productId)}</div>
         {view.fee.note && (
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{view.fee.note}</div>
         )}
        </td>
        <td className="px-5 py-3 text-right font-mono">{fmtUSD(view.fee.cost)}</td>
       </tr>
      </tbody>
     </table>
    </section>
   )}

   {/* Totales */}
   <section className="rounded-xl border border-border bg-card p-5">
    <div className="space-y-2 font-mono text-sm">
     <div className="flex justify-between text-muted-foreground">
      <span className="text-xs uppercase tracking-wider">Subtotal</span>
      <span>{fmtUSD(view.subtotal)}</span>
     </div>
     <div className="flex justify-between text-muted-foreground">
      <span className="text-xs uppercase tracking-wider">IVA 10%</span>
      <span>{fmtUSD(view.iva)}</span>
     </div>
     <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
      <span className="text-sm font-medium uppercase tracking-wider">Total c/ IVA</span>
      <span className="text-2xl font-medium">{fmtUSD(view.total)}</span>
     </div>
    </div>
   </section>

  </div>
 );
}

function fmtUnitPrice(cost: number, usage: number) {
 if (!usage) return '—';
 const unit = cost / usage;
 if (unit === 0) return '$0.00';
 if (unit >= 1) return '$' + unit.toFixed(2);
 if (unit >= 0.01) return '$' + unit.toFixed(4);
 const perK = unit * 1e3;
 if (perK >= 0.01) return '$' + perK.toFixed(2) + '/K';
 const perM = unit * 1e6;
 if (perM >= 0.01) return '$' + perM.toFixed(2) + '/M';
 return '$' + (unit * 1e9).toFixed(2) + '/B';
}

function KpiCard({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
 return (
  <div
   className={
    'rounded-xl border p-4 ' +
    (highlight ? 'border-primary/40 bg-primary/5' : 'border-border bg-card')
   }
  >
   <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
   <p className="mt-2 font-mono text-2xl font-medium tracking-tight">{value}</p>
   <p className="mt-1 font-mono text-[10px] text-muted-foreground">{sub}</p>
  </div>
 );
}

function Stat({ k, v }: { k: string; v: string }) {
 return (
  <div>
   <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
   <p className="mt-0.5 font-mono text-sm">{v}</p>
  </div>
 );
}
