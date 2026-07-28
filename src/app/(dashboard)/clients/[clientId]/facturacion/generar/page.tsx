'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Receipt, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, formatDate, formatWorkedOn } from '@/lib/utils';
import { CyclePreview, MonthSummary, formatPeriodLabel } from '@/components/client-billing/types';

type Mode = 'MES' | 'ACUMULADO';

// Corte parcial: fin del día elegido en hora local es-PY → ISO (patrón close-cycle-dialog.tsx:58).
function untilToIso(until: string): string {
  return new Date(`${until}T23:59:59.999`).toISOString();
}

export default function GenerarFacturaPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { orgId } = useOrg();
  const { hasPermission } = usePermissions();
  const router = useRouter();
  const canManage = hasPermission('manage:billing');

  const [months, setMonths] = useState<MonthSummary[]>([]);
  const [loadingMonths, setLoadingMonths] = useState(true);

  const [step, setStep] = useState<'tipo' | 'preview'>('tipo');
  const [mode, setMode] = useState<Mode>('MES');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [usePartial, setUsePartial] = useState(false);
  const [until, setUntil] = useState('');
  const [notes, setNotes] = useState('');

  const [preview, setPreview] = useState<CyclePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [emitting, setEmitting] = useState(false);

  // Meses con algo por facturar (remanente > 0). El backend ya excluye lo estampado.
  const facturableMonths = months.filter((m) => m.totalFacturable !== '0' && m.estado !== 'SIN_TRABAJO');

  const loadMonths = useCallback(async () => {
    if (!orgId || !clientId) return;
    setLoadingMonths(true);
    try {
      const res = await api.get<MonthSummary[]>(`/organizations/${orgId}/clients/${clientId}/billing/cycles`);
      setMonths(res.data);
    } catch {
      toast.error('Error', 'No se pudieron cargar los meses de facturación');
    } finally {
      setLoadingMonths(false);
    }
  }, [orgId, clientId]);

  useEffect(() => {
    loadMonths();
  }, [loadMonths]);

  const buildParams = () => {
    const body: { mode: Mode; period?: string; months?: string[]; until?: string } = { mode };
    if (mode === 'MES') body.period = selectedPeriod ?? undefined;
    else body.months = selectedMonths;
    if (usePartial && until) body.until = untilToIso(until);
    return body;
  };

  const canPreview = mode === 'MES' ? !!selectedPeriod : selectedMonths.length > 0;

  const goPreview = async () => {
    if (!orgId || !clientId || !canPreview) return;
    setStep('preview');
    setLoadingPreview(true);
    setPreview(null);
    try {
      const res = await api.post<CyclePreview>(
        `/organizations/${orgId}/clients/${clientId}/billing/cycles/preview`,
        buildParams(),
      );
      setPreview(res.data);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo calcular el preview');
      setStep('tipo');
    } finally {
      setLoadingPreview(false);
    }
  };

  const emit = async () => {
    if (!orgId || !clientId || !preview?.puedeEmitir) return;
    setEmitting(true);
    try {
      const body = { ...buildParams(), notes: notes.trim() || undefined };
      const res = await api.post<{ id: string; invoiceNumber: string }>(
        `/organizations/${orgId}/clients/${clientId}/billing/cycles/emit`,
        body,
      );
      toast.success('Factura emitida', `Se generó ${res.data.invoiceNumber} en Borrador`);
      router.push(`/clients/${clientId}/facturacion/${res.data.id}`);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo emitir la factura');
      setEmitting(false);
    }
  };

  const toggleMonth = (period: string) => {
    setSelectedMonths((prev) =>
      prev.includes(period) ? prev.filter((p) => p !== period) : [...prev, period],
    );
  };

  if (!canManage) {
    return (
      <div className="space-y-4">
        <Link
          href={`/clients/${clientId}/facturacion`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a facturación
        </Link>
        <p className="py-16 text-center text-sm text-muted-foreground">
          No tenés permiso para generar facturas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/clients/${clientId}/facturacion`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a facturación
      </Link>

      <div className="flex items-center gap-2">
        <Receipt className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">Generar factura</h1>
      </div>

      {/* Pasos */}
      <div className="flex items-center gap-2 text-xs font-medium">
        <span className={step === 'tipo' ? 'text-primary' : 'text-muted-foreground'}>1. Qué facturar</span>
        <span className="text-muted-foreground">›</span>
        <span className={step === 'preview' ? 'text-primary' : 'text-muted-foreground'}>2. Revisar y emitir</span>
      </div>

      {step === 'tipo' && (
        <div className="space-y-5">
          {/* Selector de tipo */}
          <div className="inline-flex rounded-lg border border-border bg-muted p-1">
            <button
              onClick={() => setMode('MES')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                mode === 'MES' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Un mes
            </button>
            <button
              onClick={() => setMode('ACUMULADO')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                mode === 'ACUMULADO' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Meses acumulados (no cobrados)
            </button>
          </div>

          {loadingMonths ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : facturableMonths.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-12 text-center">
              <p className="text-sm font-medium text-foreground">Sin actividad facturable</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuando el cliente registre horas de soporte cobrables, sus meses aparecerán acá.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
                {mode === 'MES'
                  ? 'Elegí el mes a facturar'
                  : 'Elegí los meses a incluir en una sola factura'}
              </div>
              <div className="divide-y divide-border">
                {facturableMonths.map((m) => {
                  const selected =
                    mode === 'MES' ? selectedPeriod === m.period : selectedMonths.includes(m.period);
                  return (
                    <button
                      key={m.period}
                      onClick={() =>
                        mode === 'MES' ? setSelectedPeriod(m.period) : toggleMonth(m.period)
                      }
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 ${
                        selected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {mode === 'ACUMULADO' && <Checkbox checked={selected} className="pointer-events-none" />}
                        {mode === 'MES' && (
                          <span
                            className={`h-4 w-4 rounded-full border ${
                              selected ? 'border-primary bg-primary' : 'border-border'
                            }`}
                          />
                        )}
                        <span className="text-sm font-medium text-foreground">
                          {formatPeriodLabel(m.period)}
                        </span>
                        {m.estado === 'FACTURADO_PARCIAL' && (
                          <Badge variant="warning">Parcial</Badge>
                        )}
                      </div>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {formatCurrency(m.totalFacturable, m.currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Corte parcial */}
          {facturableMonths.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border bg-card px-4 py-3">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={usePartial}
                  onChange={(e) => setUsePartial(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Corte parcial (facturar solo hasta una fecha de trabajo)
              </label>
              {usePartial && (
                <div className="space-y-1 pl-6">
                  <Label>Facturar trabajo hasta</Label>
                  <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Se incluye todo el trabajo con <strong>fecha de trabajo ≤</strong> esta fecha, aún no
                    facturado. El resto queda disponible para una factura posterior.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={goPreview} disabled={!canPreview || (usePartial && !until)}>
              Ver preview
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-5">
          {loadingPreview ? (
            <>
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </>
          ) : !preview ? null : (
            <>
              {/* Bloqueos */}
              {!preview.puedeEmitir && preview.motivo !== 'NOTHING_TO_BILL' && (
                <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {preview.bloqueos.sinTarifaRate && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Hay soporte sin tarifa configurada en el rango. Configurá la tarifa antes de facturar.
                      </span>
                    </div>
                  )}
                  {preview.bloqueos.sinFechaTrabajo.count > 0 && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {preview.bloqueos.sinFechaTrabajo.count} movimiento(s) facturable(s) sin fecha de
                        trabajo. Corregí el dato para no perder esa plata.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {preview.motivo === 'NOTHING_TO_BILL' ? (
                <div className="rounded-xl border border-border bg-card py-12 text-center">
                  <p className="text-sm font-medium text-foreground">Sin actividad facturable en este rango</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    No hay movimientos no facturados para lo seleccionado.
                  </p>
                </div>
              ) : (
                <>
                  {/* Grupos por mes */}
                  <div className="space-y-4">
                    {preview.grupos.map((g) => (
                      <div key={g.workedMonth} className="rounded-xl border border-border bg-card">
                        <div className="flex items-center justify-between border-b border-border px-4 py-3">
                          <h3 className="text-sm font-semibold text-foreground">{g.label}</h3>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-xs text-muted-foreground">{g.horasMes.toFixed(2)}h</span>
                            <span className="font-mono font-semibold text-foreground">
                              {formatCurrency(g.subtotalMes, preview.currency)}
                            </span>
                          </div>
                        </div>
                        <div className="divide-y divide-border">
                          {g.rows.map((r) => (
                            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm text-foreground">
                                  {r.task?.title ?? r.note ?? '—'}
                                </p>
                                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                  {r.workedOn && <span>{formatWorkedOn(r.workedOn)}</span>}
                                  {r.fueraCupo && (
                                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                                      Fuera de cupo
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-4">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {r.hours.toFixed(2)}h
                                </span>
                                <span className="w-24 text-right font-mono text-sm font-semibold text-foreground">
                                  {formatCurrency(r.priceAmount, r.priceCurrency ?? preview.currency)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total + hint */}
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total a facturar</p>
                        <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
                          {formatCurrency(preview.total, preview.currency)}
                        </p>
                      </div>
                      {preview.cutoffDate && (
                        <p className="text-xs text-muted-foreground">
                          Corte por fecha de trabajo hasta {formatDate(preview.cutoffDate)}
                        </p>
                      )}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Se asignará el próximo número ({preview.nextInvoiceHint}) al emitir.
                    </p>
                  </div>

                  {/* Notas */}
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notas de la factura (opcional)..."
                      rows={2}
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep('tipo')} disabled={emitting}>
                  Volver
                </Button>
                <Button onClick={emit} disabled={!preview.puedeEmitir || emitting}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  {emitting ? 'Emitiendo...' : 'Emitir factura (Borrador)'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
