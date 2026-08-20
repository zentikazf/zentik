'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CyclePreview, formatPeriodLabel } from './types';

interface Props {
  orgId: string;
  clientId: string;
  period: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

// Fin del día elegido en hora local (es-PY). Ver §6.2: el backend interpreta el instante y valida
// que caiga dentro del período. El MISMO valor alimenta el preview y el cierre: si divergieran, el
// número que se lee no sería el que se estampa — que es justo el bug que arregla #60.
function untilToIso(until: string): string {
  return new Date(`${until}T23:59:59.999`).toISOString();
}

// Horas con coma decimal es-PY (mismo formato que formatHoursFromMinutes de lib/utils, pero acá la
// entrada ya viene en horas: `grupos[].horasMes`).
function formatHours(hours: number): string {
  const value = new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(hours);
  return `${value} h`;
}

// Conteos del preview. Son CANTIDADES (movimientos/horas), no montos: la plata sale siempre como
// string del backend y nunca se opera en el cliente (§1.4).
function contarMovimientos(p: CyclePreview | null): number {
  return p ? p.grupos.reduce((acc, g) => acc + g.rows.length, 0) : 0;
}

function contarHoras(p: CyclePreview | null): number {
  return p ? Math.round(p.grupos.reduce((acc, g) => acc + g.horasMes, 0) * 100) / 100 : 0;
}

export function CloseCycleDialog({ orgId, clientId, period, open, onOpenChange, onSaved }: Props) {
  const [partial, setPartial] = useState(false);
  const [until, setUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Preview del mes COMPLETO: es lo que se muestra sin corte y la línea base contra la que se
  // calcula cuánto queda afuera cuando sí hay corte (el backend no devuelve el excluido).
  const [base, setBase] = useState<CyclePreview | null>(null);
  const [baseError, setBaseError] = useState<string | null>(null);
  const [loadingBase, setLoadingBase] = useState(false);

  // Preview del corte parcial. Solo se pide con una fecha válida dentro del período.
  const [cut, setCut] = useState<CyclePreview | null>(null);
  const [cutError, setCutError] = useState<string | null>(null);
  const [loadingCut, setLoadingCut] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  // R2.2: se debouncea SOLO la fecha tipeada; el check de corte parcial dispara al instante.
  const debouncedUntil = useDebounce(until, 400);

  // En modo MES el backend rechaza con INVALID_UNTIL cualquier corte fuera del mes que se factura
  // (computeFacturable). Se valida acá para no mandar una request condenada y para poder explicarlo
  // al lado del campo en vez de como un error suelto.
  const untilEnPeriodo =
    /^\d{4}-\d{2}-\d{2}$/.test(debouncedUntil) && debouncedUntil.startsWith(`${period}-`);
  const corteActivo = partial && untilEnPeriodo;

  // Entre la tecla y el debounce, lo que hay en pantalla es el total de OTRA fecha: cuenta como
  // "cargando" (R2.3 — nunca un número viejo al lado de una fecha nueva).
  const debouncePendiente = partial && until !== debouncedUntil;

  const previewUrl = `/organizations/${orgId}/clients/${clientId}/billing/cycles/preview`;

  // Guardas de secuencia: `api.post` no acepta AbortSignal, así que en vez de cancelar la petición
  // anterior se DESCARTA la respuesta que no corresponde a la última (T1). Sin esto, dos requests
  // que vuelven al revés dejan en pantalla el total de una fecha que el usuario ya cambió.
  const baseSeq = useRef(0);
  const cutSeq = useRef(0);

  // Cada apertura arranca limpia: un corte a medio configurar de la vez anterior es justo el estado
  // que hace emitir un monto distinto del que se leyó.
  useEffect(() => {
    if (!open) return;
    setPartial(false);
    setUntil('');
    setNotes('');
    setCut(null);
    setCutError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const seq = ++baseSeq.current;
    setLoadingBase(true);
    setBaseError(null);
    api
      .post<CyclePreview>(previewUrl, { mode: 'MES', period })
      .then((res) => {
        if (seq !== baseSeq.current) return;
        setBase(res.data);
      })
      .catch((err) => {
        if (seq !== baseSeq.current) return;
        setBase(null);
        setBaseError(
          err instanceof ApiError ? err.message : 'No se pudo calcular el total del período',
        );
      })
      .finally(() => {
        if (seq === baseSeq.current) setLoadingBase(false);
      });
  }, [open, previewUrl, period, reloadKey]);

  useEffect(() => {
    if (!open) return;
    if (!corteActivo) {
      cutSeq.current++; // invalida cualquier respuesta de corte que siga en vuelo
      setCut(null);
      setCutError(null);
      setLoadingCut(false);
      return;
    }
    const seq = ++cutSeq.current;
    setLoadingCut(true);
    setCutError(null);
    api
      .post<CyclePreview>(previewUrl, { mode: 'MES', period, until: untilToIso(debouncedUntil) })
      .then((res) => {
        if (seq !== cutSeq.current) return;
        setCut(res.data);
      })
      .catch((err) => {
        if (seq !== cutSeq.current) return;
        setCut(null);
        setCutError(err instanceof ApiError ? err.message : 'No se pudo calcular el corte');
      })
      .finally(() => {
        if (seq === cutSeq.current) setLoadingCut(false);
      });
  }, [open, previewUrl, period, corteActivo, debouncedUntil, reloadKey]);

  // R2.4: el número que se muestra sale SIEMPRE del preview.
  const preview = corteActivo ? cut : base;
  const error = corteActivo ? cutError : baseError;
  const cargando =
    loadingBase || (corteActivo && loadingCut) || debouncePendiente || (!preview && !error);

  const movimientos = contarMovimientos(preview);
  const horas = contarHoras(preview);
  // R3.2 — lo que NO entra: base menos corte. Conteos, no plata (R2.5).
  const fueraMovimientos =
    corteActivo && cut && base ? contarMovimientos(base) - contarMovimientos(cut) : 0;
  const fueraHoras =
    corteActivo && cut && base
      ? Math.round((contarHoras(base) - contarHoras(cut)) * 100) / 100
      : 0;

  const sinNadaQueFacturar = preview?.motivo === 'NOTHING_TO_BILL';
  // #23: este diálogo manda el body de siempre (sin exchangeRate), así que un período con variables
  // muere en 409 EXCHANGE_RATE_REQUIRED al emitir. Se avisa acá en vez de post-submit; el flujo que
  // deja revisar la tasa es /facturacion/generar.
  const tieneVariables = (preview?.variablesSubtotalUsd ?? 0) > 0;

  const puedeEmitir = !!preview && preview.puedeEmitir && !tieneVariables;
  const bloqueado = saving || cargando || !!error || !puedeEmitir || (partial && !untilEnPeriodo);

  const handleClose = async () => {
    if (partial && !untilEnPeriodo) {
      toast.error('Error', `Elegí una fecha de corte dentro de ${formatPeriodLabel(period)}`);
      return;
    }
    setSaving(true);
    try {
      const body: { until?: string; notes?: string } = {};
      if (corteActivo) {
        // Mismo instante que se le pasó al preview: lo que se leyó es lo que se estampa.
        body.until = untilToIso(debouncedUntil);
      }
      if (notes.trim()) body.notes = notes.trim();

      await api.post(
        `/organizations/${orgId}/clients/${clientId}/billing/cycles/${period}/close`,
        body,
      );
      toast.success('Factura generada', 'El período quedó congelado en una factura Borrador');
      onSaved();
      onOpenChange(false);
      setPartial(false);
      setUntil('');
      setNotes('');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No se pudo cerrar el período';
      toast.error('Error', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generar factura — {formatPeriodLabel(period)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* R3.1 — resumen: total, movimientos y horas, siempre del preview */}
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  {corteActivo ? 'Total del corte' : 'Total a facturar'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {corteActivo && preview
                    ? `Trabajo hasta el ${formatDate(preview.cutoffDate)}`
                    : 'Mes completo'}
                </p>
              </div>
              {cargando ? (
                <Skeleton className="h-7 w-36" />
              ) : error || !preview ? (
                <span className="font-mono text-lg font-semibold text-muted-foreground">—</span>
              ) : (
                <span className="font-mono text-lg font-semibold text-foreground">
                  {formatCurrency(preview.total, preview.currency)}
                </span>
              )}
            </div>
            <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              {cargando ? (
                <Skeleton className="h-4 w-48" />
              ) : error || !preview ? (
                <span>—</span>
              ) : (
                <span>
                  {movimientos} movimiento{movimientos === 1 ? '' : 's'} · {formatHours(horas)}
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-destructive">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="mt-1 text-xs font-medium text-destructive underline underline-offset-2"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* R3.2 — lo que queda afuera del corte */}
          {corteActivo && !cargando && !error && !sinNadaQueFacturar && cut && base && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-xs text-muted-foreground">
                {fueraMovimientos > 0 ? (
                  <>
                    Quedan afuera{' '}
                    <strong className="text-foreground">
                      {fueraMovimientos} movimiento{fueraMovimientos === 1 ? '' : 's'} ·{' '}
                      {formatHours(fueraHoras)}
                    </strong>
                    , disponibles para la próxima factura.
                  </>
                ) : (
                  <>El corte no deja nada afuera: entra todo el trabajo del período.</>
                )}
              </p>
            </div>
          )}

          {/* R3.5 — el corte (o el período) no deja nada que facturar */}
          {sinNadaQueFacturar && !cargando && !error && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              {corteActivo
                ? 'No hay movimientos con fecha de trabajo hasta el corte elegido. Elegí una fecha posterior.'
                : 'No hay movimientos facturables en este período.'}
            </div>
          )}

          {/* R3.4 — bloqueos accionables: el motivo concreto, antes del submit */}
          {preview && !cargando && !error && !preview.puedeEmitir && !sinNadaQueFacturar && (
            <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {preview.bloqueos.sinTarifaRate && (
                <p>
                  Hay soporte sin tarifa configurada en el rango. Configurá la tarifa antes de
                  facturar.
                </p>
              )}
              {preview.bloqueos.sinFechaTrabajo.count > 0 && (
                <p>
                  {preview.bloqueos.sinFechaTrabajo.count} movimiento(s) facturable(s) sin fecha de
                  trabajo. Corregí el dato para no perder esa plata.
                </p>
              )}
              {preview.bloqueos.revertidasVivas.count > 0 && (
                <p>
                  {preview.bloqueos.revertidasVivas.count} carga(s) revertida(s) sin neutralizar en
                  el conjunto facturable. Revisá esos movimientos antes de emitir.
                </p>
              )}
            </div>
          )}

          {/* #23 — con variables este diálogo no puede emitir (no pide la tasa) */}
          {tieneVariables && !cargando && !error && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-xs text-muted-foreground">
                Este período incluye <strong>variables</strong>, que se facturan convertidas a la
                tasa del día. Este diálogo no pide la tasa: generá la factura desde{' '}
                <strong>Facturación › Generar factura</strong>, que la deja revisar antes de emitir.
              </p>
            </div>
          )}

          {/* R3.3 — desglose por mes de trabajo cuando el conjunto cruza más de uno */}
          {preview && !cargando && !error && preview.grupos.length > 1 && (
            <div className="rounded-lg border border-border">
              <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                Desglose por mes de trabajo
              </p>
              <div className="divide-y divide-border">
                {preview.grupos.map((g) => (
                  <div
                    key={g.workedMonth}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="truncate text-xs text-foreground">{g.label}</span>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {formatHours(g.horasMes)}
                      </span>
                      <span className="w-28 text-right font-mono text-xs font-semibold text-foreground">
                        {formatCurrency(g.subtotalMes, preview.currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs text-muted-foreground">
              Al generar la factura, este período queda <strong>congelado</strong>: los movimientos
              incluidos pasan a ser de solo lectura. Podés reabrir el ciclo mientras no esté Cobrado.
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={partial}
                onChange={(e) => setPartial(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Corte parcial (facturar solo hasta una fecha de trabajo)
            </label>
            {partial && (
              <div className="space-y-1 pl-6">
                <Label>Facturar trabajo hasta esta fecha</Label>
                <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                {!until ? (
                  <p className="text-xs text-muted-foreground">
                    Elegí la fecha para ver el total del corte. Mientras tanto se muestra el mes
                    completo.
                  </p>
                ) : !untilEnPeriodo && !debouncePendiente ? (
                  <p className="text-xs text-destructive">
                    La fecha de corte tiene que caer dentro de {formatPeriodLabel(period)}.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Corta por <strong>fecha de trabajo</strong> (no de registro). El trabajo
                    posterior queda disponible como &quot;Facturar resto&quot;.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas de la factura (opcional)..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleClose} disabled={bloqueado}>
            {saving ? 'Generando...' : 'Generar factura (Borrador)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
