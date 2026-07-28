'use client';

import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Clock, DollarSign, TrendingUp, CheckCircle2, Circle, ChevronDown } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';

interface HoursTransaction {
 id: string;
 type: 'USAGE' | 'LOAN';
 hours: number;
 note: string | null;
 createdAt: string;
 priceAmount: string | null;
 priceRate: string | null;
 priceCurrency: string | null;
 billedCycleId: string | null;
 workedOn: string | null;
 task?: {
  id: string;
  title: string;
  type: 'SUPPORT' | 'PROJECT' | null;
  project?: { id: string; name: string } | null;
 } | null;
}

interface HoursResponse {
 contractedHours: number;
 usedHours: number;
 loanedHours: number;
 availableHours: number;
 percentUsed: number;
 currency: string;
 developmentHourlyRate: string | null;
 supportHourlyRate: string | null;
 totalAmount: number;
 transactions: HoursTransaction[];
}

// Mes de trabajo real del registro (workedOn date-only, sin day-shift por TZ); fallback a la fecha de carga
// (createdAt, mes en Asunción). Devuelve la clave 'YYYY-MM'.
function monthKeyOf(t: HoursTransaction): string {
 if (t.workedOn) return t.workedOn.slice(0, 7);
 const p = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Asuncion',
  year: 'numeric',
  month: '2-digit',
 }).formatToParts(new Date(t.createdAt));
 const y = p.find((x) => x.type === 'year')?.value ?? '0000';
 const m = p.find((x) => x.type === 'month')?.value ?? '00';
 return `${y}-${m}`;
}

// 'YYYY-MM' → 'Julio 2026' (es-PY, capitalizado).
function monthLabelEs(key: string): string {
 const [y, m] = key.split('-').map(Number);
 if (!y || !m) return key;
 const s = new Intl.DateTimeFormat('es-PY', { month: 'long', year: 'numeric' }).format(
  new Date(Date.UTC(y, m - 1, 15)),
 );
 return s.charAt(0).toUpperCase() + s.slice(1);
}

// Fecha corta del registro para la fila (día + mes; el año ya va en el header del mes). workedOn parseado
// a medianoche LOCAL para no correr un día por la zona horaria.
function rowDateShort(t: HoursTransaction): string {
 const iso = t.workedOn ? `${t.workedOn.slice(0, 10)}T00:00:00` : t.createdAt;
 return new Date(iso).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
}

// Agrupa por mes (clave desc = más reciente primero). Dentro del grupo conserva el orden que ya trae el backend
// (createdAt desc).
function groupByMonth(txs: HoursTransaction[]): { key: string; txs: HoursTransaction[] }[] {
 const map = new Map<string, HoursTransaction[]>();
 for (const t of txs) {
  const k = monthKeyOf(t);
  const arr = map.get(k);
  if (arr) arr.push(t);
  else map.set(k, [t]);
 }
 return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, list]) => ({ key, txs: list }));
}

export default function PortalHoursPage() {
 const [data, setData] = useState<HoursResponse | null>(null);
 const [loading, setLoading] = useState(true);

 const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

 const monthGroups = useMemo(() => groupByMonth(data?.transactions ?? []), [data]);

 // Default: abrir el mes más reciente cuando llegan los datos.
 useEffect(() => {
  if (monthGroups.length > 0) setOpenMonths(new Set([monthGroups[0].key]));
 }, [monthGroups.length]);

 const toggleMonth = (key: string) =>
  setOpenMonths((prev) => {
   const next = new Set(prev);
   if (next.has(key)) next.delete(key);
   else next.add(key);
   return next;
  });

 useEffect(() => {
  api.get<HoursResponse>('/portal/hours')
   .then((r) => setData(r.data))
   .catch((err) => {
    const msg = err instanceof ApiError ? err.message : 'Error al cargar horas';
    toast.error('Error', msg);
   })
   .finally(() => setLoading(false));
 }, []);

 if (loading) {
  return (
   <div className="space-y-6">
    <Skeleton className="h-8 w-64"/>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
     {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl"/>)}
    </div>
    <Skeleton className="h-96 rounded-xl"/>
   </div>
  );
 }

 if (!data) {
  return (
   <div className="py-16 text-center">
    <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50"/>
    <p className="text-muted-foreground">No hay datos disponibles.</p>
   </div>
  );
 }

 return (
  <div className="space-y-6">
   <div>
    <h1 className="text-2xl font-bold tracking-tight text-foreground">Mis horas</h1>
    <p className="mt-1 text-sm text-muted-foreground">
     Detalle de tiempo registrado y costo asociado.
    </p>
   </div>

   {/* KPI cards */}
   <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    <div className="rounded-xl border border-border bg-card p-5">
     <div className="flex items-center gap-2 mb-2">
      <TrendingUp className="h-4 w-4 text-success"/>
      <p className="text-xs text-muted-foreground">Disponibles</p>
     </div>
     <p className="text-2xl font-bold text-foreground">{data.availableHours.toFixed(1)}h</p>
     {data.loanedHours > 0 && (
      <p className="text-[11px] text-warning">+{data.loanedHours.toFixed(1)}h en préstamo</p>
     )}
    </div>
    <div className="rounded-xl border border-border bg-card p-5">
     <div className="flex items-center gap-2 mb-2">
      <Clock className="h-4 w-4 text-primary"/>
      <p className="text-xs text-muted-foreground">Consumidas</p>
     </div>
     <p className="text-2xl font-bold text-foreground">{data.usedHours.toFixed(1)}h</p>
     <p className="text-[11px] text-muted-foreground">de {data.contractedHours.toFixed(1)}h contratadas</p>
    </div>
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
     <div className="flex items-center gap-2 mb-2">
      <DollarSign className="h-4 w-4 text-primary"/>
      <p className="text-xs text-muted-foreground">Total facturable</p>
     </div>
     <p className="text-2xl font-bold text-primary">
      {formatCurrency(data.totalAmount, data.currency)}
     </p>
     <p className="text-[11px] text-muted-foreground">Pendiente de facturar</p>
    </div>
   </div>

   {/* Registros por mes (acordeón) */}
   {data.transactions.length === 0 ? (
    <div className="rounded-xl border border-border bg-card py-12 text-center">
     <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50"/>
     <p className="text-sm text-muted-foreground">No hay registros aún</p>
    </div>
   ) : (
    <div className="space-y-3">
     {monthGroups.map(({ key, txs }) => {
      const open = openMonths.has(key);
      const monthHours = txs.reduce((s, t) => s + t.hours, 0);
      const monthPending = txs
       .filter((t) => t.priceAmount !== null && t.billedCycleId === null)
       .reduce((s, t) => s + parseFloat(t.priceAmount!), 0);
      return (
       <div key={key} className="rounded-xl border border-border bg-card overflow-hidden">
        <button
         type="button"
         onClick={() => toggleMonth(key)}
         aria-expanded={open}
         className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/30"
        >
         <div className="flex items-center gap-3">
          <ChevronDown
           className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
          />
          <div>
           <p className="text-sm font-semibold text-foreground">{monthLabelEs(key)}</p>
           <p className="text-[11px] text-muted-foreground">
            {txs.length} {txs.length === 1 ? 'registro' : 'registros'} · {monthHours.toFixed(2)}h
           </p>
          </div>
         </div>
         {monthPending > 0 && (
          <div className="text-right">
           <p className="font-mono text-sm font-semibold text-primary">
            {formatCurrency(monthPending, data.currency)}
           </p>
           <p className="text-[10px] text-muted-foreground">pendiente</p>
          </div>
         )}
        </button>

        {open && (
         <div className="border-t border-border overflow-x-auto animate-fade-in">
          <table className="w-full text-sm">
           <thead className="bg-muted/30 text-xs">
            <tr>
             <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Fecha</th>
             <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tarea</th>
             <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tipo</th>
             <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Horas</th>
             <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Estado</th>
             <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Costo</th>
            </tr>
           </thead>
           <tbody className="divide-y divide-border">
            {txs.map((t) => (
             <tr key={t.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{rowDateShort(t)}</td>
              <td className="px-4 py-3">
               <p className="text-sm text-foreground truncate max-w-xs">
                {t.task?.title ?? t.note ?? '—'}
               </p>
               {t.task?.project && (
                <p className="text-[11px] text-muted-foreground">{t.task.project.name}</p>
               )}
              </td>
              <td className="px-4 py-3">
               {t.task?.type === 'SUPPORT' && (
                <Badge className="bg-warning/15 text-warning text-[10px]">Soporte</Badge>
               )}
               {t.task?.type === 'PROJECT' && (
                <Badge className="bg-info/10 text-info text-[10px]">Desarrollo</Badge>
               )}
               {!t.task?.type && <span className="text-xs text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-foreground">{t.hours.toFixed(2)}h</td>
              <td className="px-4 py-3">
               {t.billedCycleId ? (
                <Badge className="inline-flex items-center gap-1 bg-success/15 text-success text-[10px]">
                 <CheckCircle2 className="h-3 w-3" /> Facturado
                </Badge>
               ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                 <Circle className="h-3 w-3" /> Pendiente
                </span>
               )}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-foreground">
               {formatCurrency(t.priceAmount, t.priceCurrency ?? data.currency)}
              </td>
             </tr>
            ))}
           </tbody>
          </table>
         </div>
        )}
       </div>
      );
     })}
    </div>
   )}

   <p className="text-[11px] text-muted-foreground italic">
    Acá podés ver el detalle del tiempo que el equipo dedicó a tus proyectos.
   </p>
  </div>
 );
}
