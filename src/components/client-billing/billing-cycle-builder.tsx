'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, Lock, AlertTriangle, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { CloseCycleDialog } from './close-cycle-dialog';
import { BillingCycle, BillingRow, CycleBuilder, CycleStatus, formatPeriodLabel } from './types';

const CYCLE_STATUS: Record<CycleStatus, { label: string; variant: 'muted' | 'info' | 'success' | 'destructive' }> = {
  DRAFT: { label: 'Borrador', variant: 'muted' },
  SENT: { label: 'Enviada', variant: 'info' },
  PAID: { label: 'Cobrada', variant: 'success' },
  CANCELLED: { label: 'Cancelada', variant: 'destructive' },
};

interface Props {
  orgId: string;
  clientId: string;
  builder: CycleBuilder;
  canManage: boolean;
  onBack: () => void;
  onChanged: () => void;
}

function RowLine({ row, currency }: { row: BillingRow; currency: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground">{row.task?.title ?? row.note ?? '—'}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {row.fueraCupo && (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
              Fuera de cupo
            </span>
          )}
          {row.sinTarifa && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
              <AlertTriangle className="h-2.5 w-2.5" /> Sin tarifa
            </span>
          )}
          {!row.billable && !row.sinTarifa && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              No cobra
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className="font-mono text-xs text-muted-foreground">{row.hours.toFixed(2)}h</span>
        <span className="w-24 text-right font-mono text-sm font-semibold text-foreground">
          {row.priceAmount ? formatCurrency(row.priceAmount, row.priceCurrency ?? currency) : '—'}
        </span>
      </div>
    </div>
  );
}

export function BillingCycleBuilder({ orgId, clientId, builder, canManage, onBack, onChanged }: Props) {
  const [showVisibleOnly, setShowVisibleOnly] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const hasFacturable = builder.soporte.some((r) => r.billable);
  const visibleOnly = [...builder.proyecto, ...builder.interno];

  const updateStatus = async (cycle: BillingCycle, status: 'SENT' | 'PAID') => {
    setActingId(cycle.id);
    try {
      await api.patch(`/organizations/${orgId}/clients/${clientId}/billing/cycles/${cycle.id}`, { status });
      toast.success('Factura actualizada', status === 'SENT' ? 'Marcada como Enviada' : 'Marcada como Cobrada');
      onChanged();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo actualizar la factura');
    } finally {
      setActingId(null);
    }
  };

  const reopen = async (cycle: BillingCycle) => {
    setActingId(cycle.id);
    try {
      await api.post(`/organizations/${orgId}/clients/${clientId}/billing/cycles/${cycle.id}/reopen`);
      toast.success('Ciclo reabierto', 'Los movimientos vuelven a estar disponibles');
      onChanged();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo reabrir el ciclo');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Meses
        </button>
        <h2 className="text-[15px] font-semibold text-foreground">{formatPeriodLabel(builder.period)}</h2>
      </div>

      {/* Total en vivo */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total facturable</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
              {formatCurrency(builder.totalFacturable, builder.currency)}
            </p>
            {builder.subtotalFueraCupo !== '0' && (
              <p className="mt-1 text-xs text-warning">
                Incluye {formatCurrency(builder.subtotalFueraCupo, builder.currency)} fuera de cupo
              </p>
            )}
          </div>
          {canManage && (
            <Button onClick={() => setCloseOpen(true)} disabled={!hasFacturable}>
              Generar factura (Borrador)
            </Button>
          )}
        </div>
      </div>

      {/* 2 columnas: Soporte | Proyecto + Interno */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Lock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Soporte</h3>
            <span className="ml-auto text-xs text-muted-foreground">suma y factura</span>
          </div>
          {builder.soporte.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin soporte en este mes</p>
          ) : (
            <div className="divide-y divide-border">
              {builder.soporte.map((r) => (
                <RowLine key={r.id} row={r} currency={builder.currency} />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <button
              onClick={() => setShowVisibleOnly((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-foreground"
              title="Solo se muestra, no cobra"
            >
              {showVisibleOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              Proyecto / Interno
            </button>
            <span className="ml-auto text-xs text-muted-foreground">no cobra</span>
          </div>
          {!showVisibleOnly ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {visibleOnly.length} movimiento(s) oculto(s). El ojito solo los muestra.
            </p>
          ) : visibleOnly.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin proyecto/interno en este mes</p>
          ) : (
            <div className="divide-y divide-border">
              {visibleOnly.map((r) => (
                <RowLine key={r.id} row={r} currency={builder.currency} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Facturas del período */}
      {builder.cycles.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Facturas del mes</h3>
          </div>
          <div className="divide-y divide-border">
            {builder.cycles.map((c) => {
              const conf = CYCLE_STATUS[c.status];
              const acting = actingId === c.id;
              return (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <Link
                    href={`/clients/${clientId}/facturacion/${c.id}`}
                    className="flex items-center gap-3 transition-opacity hover:opacity-80"
                    title="Ver lo facturado"
                  >
                    <span className="font-mono text-sm text-foreground">{c.invoiceNumber}</span>
                    <Badge variant={conf.variant}>{conf.label}</Badge>
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {formatCurrency(c.totalAmount, c.currency)}
                    </span>
                  </Link>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      {c.status === 'DRAFT' && (
                        <Button size="sm" variant="outline" disabled={acting} onClick={() => updateStatus(c, 'SENT')}>
                          Marcar Enviada
                        </Button>
                      )}
                      {c.status === 'SENT' && (
                        <Button size="sm" variant="outline" disabled={acting} onClick={() => updateStatus(c, 'PAID')}>
                          Marcar Cobrada
                        </Button>
                      )}
                      {c.status !== 'PAID' && c.status !== 'CANCELLED' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={acting}
                          onClick={() => reopen(c)}
                          title="Libera los movimientos estampados"
                        >
                          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reabrir
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CloseCycleDialog
        orgId={orgId}
        clientId={clientId}
        period={builder.period}
        subtotal={builder.totalFacturable}
        currency={builder.currency}
        open={closeOpen}
        onOpenChange={setCloseOpen}
        onSaved={onChanged}
      />
    </div>
  );
}
