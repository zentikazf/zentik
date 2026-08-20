'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, AlertTriangle, Ban, History, Sliders, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { CloseCycleDialog } from './close-cycle-dialog';
import { CancelCycleDialog } from './cancel-cycle-dialog';
import { BillingCycle, BillingRow, CycleBuilder, CycleStatus, formatPeriodLabel, formatUsd } from './types';

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
          {row.atrasada && row.workedMonth && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
              title="Trabajo de un mes anterior ya cerrado, arrastrado a este cierre"
            >
              <History className="h-2.5 w-2.5" /> {formatPeriodLabel(row.workedMonth)}
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
  const [closeOpen, setCloseOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BillingCycle | null>(null);

  const hasFacturable = builder.soporte.some((r) => r.billable);
  const hasVariables = builder.variables.length > 0; // #23
  const hasVariablesValue = builder.variablesSubtotalUsd > 0; // #23: hay comercial > 0 → conversión al generar

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

      {/* Total en vivo — Soporte (Gs) + Variables (USD, se convierte al generar) */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Soporte (facturable)</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
                {formatCurrency(builder.totalFacturable, builder.currency)}
              </p>
              {builder.subtotalFueraCupo !== '0' && (
                <p className="mt-1 text-xs text-warning">
                  Incluye {formatCurrency(builder.subtotalFueraCupo, builder.currency)} fuera de cupo
                </p>
              )}
            </div>
            {hasVariablesValue && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Variables (Botmaker)</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
                  {formatUsd(builder.variablesSubtotalUsd)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">se convierte a Gs al generar</p>
              </div>
            )}
          </div>
          {canManage &&
            (hasVariablesValue ? (
              // Con variables, la emisión pasa por el flujo de conversión (tasa editable) de /generar.
              <Link href={`/clients/${clientId}/facturacion/generar`}>
                <Button>Generar factura (convertir)</Button>
              </Link>
            ) : (
              <Button onClick={() => setCloseOpen(true)} disabled={!hasFacturable}>
                Generar factura (Borrador)
              </Button>
            ))}
        </div>
      </div>

      {/* H8b: integridad — facturable sin fecha de trabajo bloquea el cierre (no perder plata). */}
      {builder.sinFechaTrabajo > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {builder.sinFechaTrabajo} movimiento(s) facturable(s) sin fecha de trabajo. Hay que corregir el
            dato antes de cerrar — el cierre se bloquea para no perder esa plata.
          </span>
        </div>
      )}

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
            <Sliders className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Variables</h3>
            <span className="ml-auto text-xs text-muted-foreground">cobra (Botmaker)</span>
          </div>
          {builder.variablesBilled ? (
            // #23: dinámico — ya facturadas → factura al día + link directo a la factura emitida.
            <div className="px-4 py-6 text-center">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" /> Factura al día — nada pendiente
              </p>
              {builder.variablesBilledCycleId && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  <Link
                    href={`/clients/${clientId}/facturacion/${builder.variablesBilledCycleId}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Ver la factura emitida
                    {(() => {
                      const c = builder.cycles.find((x) => x.id === builder.variablesBilledCycleId);
                      return c ? ` (${c.invoiceNumber})` : '';
                    })()}
                    {' '}→
                  </Link>
                </p>
              )}
            </div>
          ) : !hasVariables ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Sin variables en este mes. Cargalas en la sección Variables del cliente.
            </p>
          ) : (
            <>
              <div className="divide-y divide-border">
                {builder.variables.map((v, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 px-3 py-2">
                    <p className="min-w-0 truncate text-sm text-foreground">{v.label}</p>
                    <span className="shrink-0 font-mono text-sm font-semibold text-foreground">
                      {formatUsd(v.commercialValue)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border px-3 py-2.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Subtotal variables</span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {formatUsd(builder.variablesSubtotalUsd)}
                </span>
              </div>
              <p className="px-3 pb-3 text-[11px] text-muted-foreground">
                En USD — se convierte a Gs al generar la factura.
              </p>
            </>
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
                <div key={c.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                      href={`/clients/${clientId}/facturacion/${c.id}`}
                      className="flex items-center gap-3 transition-opacity hover:opacity-80"
                      title="Ver lo facturado"
                    >
                      <span className="font-mono text-sm text-foreground">{c.invoiceNumber}</span>
                      <Badge variant={conf.variant}>{conf.label}</Badge>
                      {c.kind === 'ACCUMULATED' && <Badge variant="info">Acumulada</Badge>}
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
                            onClick={() => setCancelTarget(c)}
                            title="Anula la factura y libera los movimientos"
                          >
                            <Ban className="mr-1 h-3.5 w-3.5" /> Anular
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {c.status === 'CANCELLED' && c.cancelReason && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Anulada
                      {c.cancelledAt
                        ? ` el ${new Date(c.cancelledAt).toLocaleDateString('es-PY', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}`
                        : ''}{' '}
                      — {c.cancelReason}
                    </p>
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
        open={closeOpen}
        onOpenChange={setCloseOpen}
        onSaved={onChanged}
      />

      {cancelTarget && (
        <CancelCycleDialog
          orgId={orgId}
          clientId={clientId}
          invoiceNumber={cancelTarget.invoiceNumber}
          cycleId={cancelTarget.id}
          open={!!cancelTarget}
          onOpenChange={(open) => !open && setCancelTarget(null)}
          onDone={onChanged}
        />
      )}
    </div>
  );
}
