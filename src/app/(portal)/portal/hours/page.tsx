'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Clock, DollarSign, TrendingUp } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

interface HoursTransaction {
 id: string;
 type: 'USAGE' | 'LOAN';
 hours: number;
 note: string | null;
 createdAt: string;
 priceAmount: string | null;
 priceRate: string | null;
 priceCurrency: string | null;
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

export default function PortalHoursPage() {
 const [data, setData] = useState<HoursResponse | null>(null);
 const [loading, setLoading] = useState(true);

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
     <p className="text-[11px] text-muted-foreground">
      {data.transactions.filter((t) => t.priceAmount !== null).length} con costo · {' '}
      {data.transactions.filter((t) => t.priceAmount === null).length} sin costo
     </p>
    </div>
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
   </div>

   {/* Transactions */}
   <div className="rounded-xl border border-border bg-card overflow-hidden">
    <div className="px-5 py-3 border-b border-border">
     <h2 className="text-sm font-semibold text-foreground">Registros de tiempo</h2>
    </div>
    {data.transactions.length === 0 ? (
     <div className="py-12 text-center">
      <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50"/>
      <p className="text-sm text-muted-foreground">No hay registros aún</p>
     </div>
    ) : (
     <div className="overflow-x-auto">
      <table className="w-full text-sm">
       <thead className="bg-muted/30 text-xs">
        <tr>
         <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
         <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tarea</th>
         <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
         <th className="text-right px-4 py-3 font-medium text-muted-foreground">Horas</th>
         <th className="text-right px-4 py-3 font-medium text-muted-foreground">Tarifa</th>
         <th className="text-right px-4 py-3 font-medium text-muted-foreground">Costo</th>
        </tr>
       </thead>
       <tbody className="divide-y divide-border">
        {data.transactions.map((t) => (
         <tr key={t.id} className="hover:bg-muted/30 transition-colors">
          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
           {new Date(t.createdAt).toLocaleDateString('es-PY', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
           })}
          </td>
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
          <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
           {t.hours.toFixed(2)}h
          </td>
          <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
           {formatCurrency(t.priceRate, t.priceCurrency ?? data.currency)}
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

   <p className="text-[11px] text-muted-foreground italic">
    Solo se muestran descuentos consumidos. Las transacciones sin costo asociado son anteriores
    a la facturación automática o no tienen tarifa configurada para su tipo.
   </p>
  </div>
 );
}
