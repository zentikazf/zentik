'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Download, Save, Lock, ArrowRightLeft, AlertTriangle, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatUsd, formatPeriodLabel } from '@/components/client-billing/types';

type PricingMode = 'DIRECTO' | 'CALCULO' | 'MANUAL';

interface StatementItem {
  label: string;
  usage?: number | null;
  rawValue?: number | null;
  commercialValue: number;
  source: 'BOTMAKER' | 'MANUAL';
  mode?: PricingMode | null;
  incluidas?: number | null;
  unitPrice?: number | null;
}

interface EditItem {
  _key: string;
  label: string;
  usage: number | null;
  rawValue: number | null;
  commercial: string; // string para tipear decimales (solo se usa en MANUAL)
  source: 'BOTMAKER' | 'MANUAL';
  mode: PricingMode | null;
  incluidas: string; // solo CALCULO
  unitPrice: string; // solo CALCULO
}

interface Props {
  orgId: string;
  clientId: string;
  period: string;
  accountId: string | null;
  onBack: () => void;
  onSaved: () => void;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Fórmula ÚNICA (espeja computeCommercial del backend): DIRECTO = crudo; CALCULO = max(0, usage−incluidas)×precio;
// MANUAL/sin regla = valor tipeado.
function effectiveCommercial(i: EditItem): number {
  if (i.mode === 'DIRECTO') return round2(i.rawValue ?? 0);
  if (i.mode === 'CALCULO') {
    const cobrable = Math.max(0, (i.usage ?? 0) - (parseFloat(i.incluidas) || 0));
    return round2(cobrable * (parseFloat(i.unitPrice) || 0));
  }
  return parseFloat(i.commercial) || 0;
}

const MODE_BADGE: Record<PricingMode, { label: string; className: string }> = {
  DIRECTO: { label: 'Directo', className: 'bg-info/10 text-info' },
  CALCULO: { label: 'Cálculo', className: 'bg-primary/10 text-primary' },
  MANUAL: { label: 'Manual', className: 'bg-muted text-muted-foreground' },
};

export function VariablesEditor({ orgId, clientId, period, accountId, onBack, onSaved }: Props) {
  const [items, setItems] = useState<EditItem[] | null>(null);
  const [note, setNote] = useState('');
  const [billed, setBilled] = useState(false);
  const [billedCycleId, setBilledCycleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const keySeq = useRef(0);

  const nextKey = () => `k${keySeq.current++}`;
  const toEdit = (i: StatementItem): EditItem => ({
    _key: nextKey(),
    label: i.label,
    usage: i.usage ?? null,
    rawValue: i.rawValue ?? null,
    commercial: String(i.commercialValue ?? 0),
    source: i.source,
    mode: i.mode ?? null,
    incluidas: i.incluidas != null ? String(i.incluidas) : '0',
    unitPrice: i.unitPrice != null ? String(i.unitPrice) : '',
  });

  const load = useCallback(async () => {
    setItems(null);
    try {
      const res = await api.get<{
        items: StatementItem[];
        note: string | null;
        billed: boolean;
        billedCycleId: string | null;
        exists: boolean;
      }>(`/organizations/${orgId}/clients/${clientId}/billing/variables/${period}`);
      setNote(res.data.note ?? '');
      setBilled(res.data.billed);
      setBilledCycleId(res.data.billedCycleId ?? null);
      if (res.data.exists) {
        setItems(res.data.items.map(toEdit)); // mes guardado → SOLO lo guardado
      } else if (accountId) {
        try {
          // mes nuevo → auto-import; el backend ya arrastra el contrato (reglas) y recalcula el comercial.
          const imp = await api.get<StatementItem[]>(
            `/organizations/${orgId}/clients/${clientId}/billing/variables/${period}/import`,
          );
          setItems(imp.data.map(toEdit));
        } catch {
          setItems([]);
        }
      } else {
        setItems([]);
      }
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo cargar el período');
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, clientId, period, accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const total = (items ?? []).reduce((s, i) => s + effectiveCommercial(i), 0);

  const update = (key: string, patch: Partial<EditItem>) =>
    setItems((prev) => (prev ?? []).map((i) => (i._key === key ? { ...i, ...patch } : i)));

  const addManual = () =>
    setItems((prev) => [
      ...(prev ?? []),
      { _key: nextKey(), label: '', usage: null, rawValue: null, commercial: '0', source: 'MANUAL', mode: 'MANUAL', incluidas: '0', unitPrice: '' },
    ]);

  const remove = (key: string) => setItems((prev) => (prev ?? []).filter((i) => i._key !== key));

  // Traspaso directo: crudo → comercial.
  const pasar = (key: string) => update(key, { mode: 'DIRECTO' });
  // Cálculo por unidad: activa la sub-fila incluidas × precio.
  const calcular = (key: string) => update(key, { mode: 'CALCULO' });

  const doImport = async () => {
    setConfirmImport(false);
    setImporting(true);
    try {
      const res = await api.get<StatementItem[]>(
        `/organizations/${orgId}/clients/${clientId}/billing/variables/${period}/import`,
      );
      setItems(res.data.map(toEdit));
      toast.success('Importado', `${res.data.length} variable(s) traídas de Botmaker`);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo importar de Botmaker');
    } finally {
      setImporting(false);
    }
  };

  const onImportClick = () => {
    if ((items ?? []).length > 0) setConfirmImport(true);
    else doImport();
  };

  const save = async () => {
    const list = items ?? [];
    if (list.some((i) => !i.label.trim())) {
      toast.error('Error', 'Todas las variables necesitan un nombre');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/organizations/${orgId}/clients/${clientId}/billing/variables/${period}`, {
        items: list.map((i) => ({
          label: i.label.trim(),
          ...(i.usage != null && { usage: i.usage }),
          ...(i.rawValue != null && { rawValue: i.rawValue }),
          commercialValue: effectiveCommercial(i),
          source: i.source,
          ...(i.mode && { mode: i.mode }),
          ...(i.mode === 'CALCULO' && { incluidas: parseFloat(i.incluidas) || 0, unitPrice: parseFloat(i.unitPrice) || 0 }),
        })),
        note: note.trim() || undefined,
      });
      toast.success('Guardado', 'Las variables del mes quedaron guardadas');
      onSaved(); // refresca la lista de meses en segundo plano
      await load(); // recarga desde la DB → quedás en el editor VIENDO lo guardado (confirma que persistió)
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudieron guardar las variables');
    } finally {
      setSaving(false);
    }
  };

  const readOnly = billed;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Meses
        </button>
        <h2 className="text-[15px] font-semibold text-foreground">{formatPeriodLabel(period)}</h2>
      </div>

      {readOnly && (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Estas variables ya se facturaron y quedaron congeladas. Para editarlas, reabrí (anulá) la factura del ciclo
            que las incluye.
            {billedCycleId && (
              <>
                {' '}
                <Link
                  href={`/clients/${clientId}/facturacion/${billedCycleId}`}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Ver la factura →
                </Link>
              </>
            )}
          </span>
        </div>
      )}

      {/* Total + acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total comercial (USD)</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{formatUsd(total)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Se convierte a Gs al generar la factura.</p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onImportClick} disabled={importing || !accountId} title={!accountId ? 'Mapeá una cuenta Botmaker para importar' : 'Traer del consumo de Botmaker'}>
              <Download className="mr-1.5 h-4 w-4" />
              {importing ? 'Re-importando...' : 'Re-importar'}
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        )}
      </div>

      {confirmImport && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Re-importar reemplaza los ítems actuales por el consumo de Botmaker (arrastra las reglas del contrato). ¿Seguir?
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmImport(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={doImport}>
              Reemplazar
            </Button>
          </div>
        </div>
      )}

      {/* Tabla */}
      {items === null ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-[1fr_90px_100px_120px_auto] items-center gap-2 border-b border-border px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">
            <span>Variable</span>
            <span className="text-right">Cantidad</span>
            <span className="text-right">Crudo (USD)</span>
            <span className="text-right">Comercial (USD)</span>
            <span className="w-[92px]" />
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sin variables. Importá de Botmaker o agregá una manual.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((i) => {
                const isCalc = i.mode === 'CALCULO';
                const isAuto = i.mode === 'DIRECTO' || i.mode === 'CALCULO';
                return (
                  <div key={i._key} className="px-4 py-2">
                    <div className="grid grid-cols-[1fr_90px_100px_120px_auto] items-center gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Input
                          value={i.label}
                          onChange={(e) => update(i._key, { label: e.target.value })}
                          placeholder="Nombre de la variable"
                          disabled={readOnly}
                          className="h-8"
                        />
                        {i.mode && (
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${MODE_BADGE[i.mode].className}`}>
                            {MODE_BADGE[i.mode].label}
                          </span>
                        )}
                      </div>
                      <span className="text-right font-mono text-xs text-muted-foreground">
                        {i.usage != null ? i.usage.toLocaleString('en-US') : '—'}
                      </span>
                      <span className="text-right font-mono text-xs text-muted-foreground">
                        {i.rawValue != null ? formatUsd(i.rawValue) : '—'}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={isAuto ? String(effectiveCommercial(i)) : i.commercial}
                        readOnly={isAuto}
                        onChange={(e) => update(i._key, { mode: 'MANUAL', commercial: e.target.value })}
                        disabled={readOnly}
                        className={`h-8 text-right font-mono ${isAuto ? 'bg-muted/40' : ''}`}
                        title={isAuto ? 'Calculado por la regla. Escribí para pasarlo a manual.' : 'Valor manual'}
                      />
                      <div className="flex w-[92px] items-center justify-end gap-1">
                        {!readOnly && i.rawValue != null && (
                          <button
                            onClick={() => pasar(i._key)}
                            title="Traspaso directo (crudo → comercial)"
                            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-primary/10 hover:text-primary ${i.mode === 'DIRECTO' ? 'bg-info/10 text-info' : 'text-muted-foreground'}`}
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {!readOnly && (
                          <button
                            onClick={() => calcular(i._key)}
                            title="Calcular por unidad (incluidas × precio)"
                            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-primary/10 hover:text-primary ${isCalc ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                          >
                            <Calculator className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {!readOnly && (
                          <button
                            onClick={() => remove(i._key)}
                            title="Eliminar"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Sub-fila del cálculo por unidad */}
                    {isCalc && !readOnly && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">Incluidas / no cobrables</span>
                        <Input
                          type="number"
                          min={0}
                          value={i.incluidas}
                          onChange={(e) => update(i._key, { incluidas: e.target.value })}
                          className="h-7 w-24 font-mono"
                        />
                        <span className="text-muted-foreground">× Precio unitario (USD)</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.0001"
                          value={i.unitPrice}
                          onChange={(e) => update(i._key, { unitPrice: e.target.value })}
                          placeholder="0.00"
                          className="h-7 w-28 font-mono"
                        />
                        <span className="ml-auto font-mono text-foreground">
                          = {formatUsd(effectiveCommercial(i))}
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({Math.max(0, (i.usage ?? 0) - (parseFloat(i.incluidas) || 0)).toLocaleString('en-US')} cobrables)
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {!readOnly && (
            <div className="border-t border-border px-4 py-2.5">
              <Button variant="ghost" size="sm" onClick={addManual}>
                <Plus className="mr-1 h-4 w-4" /> Nueva variable
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Nota */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Nota del mes</p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota opcional del período..."
          rows={2}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
