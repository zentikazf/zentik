'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, Trash2, Download, Save, Lock, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatUsd, formatPeriodLabel } from '@/components/client-billing/types';

interface StatementItem {
  label: string;
  rawValue?: number | null;
  commercialValue: number;
  source: 'BOTMAKER' | 'MANUAL';
}

interface EditItem {
  _key: string;
  label: string;
  rawValue: number | null;
  commercial: string; // string para tipear decimales sin perder el punto
  source: 'BOTMAKER' | 'MANUAL';
}

interface Props {
  orgId: string;
  clientId: string;
  period: string;
  accountId: string | null;
  onBack: () => void;
  onSaved: () => void;
}

export function VariablesEditor({ orgId, clientId, period, accountId, onBack, onSaved }: Props) {
  const [items, setItems] = useState<EditItem[] | null>(null);
  const [note, setNote] = useState('');
  const [billed, setBilled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const keySeq = useRef(0);

  const nextKey = () => `k${keySeq.current++}`;
  const toEdit = (i: StatementItem): EditItem => ({
    _key: nextKey(),
    label: i.label,
    rawValue: i.rawValue ?? null,
    commercial: String(i.commercialValue ?? 0),
    source: i.source,
  });

  const load = useCallback(async () => {
    setItems(null);
    try {
      const res = await api.get<{ items: StatementItem[]; note: string | null; billed: boolean; exists: boolean }>(
        `/organizations/${orgId}/clients/${clientId}/billing/variables/${period}`,
      );
      setNote(res.data.note ?? '');
      setBilled(res.data.billed);
      if (res.data.exists) {
        // Mes ya guardado → cargar SOLO lo guardado (nunca pisar los comerciales ya cargados).
        setItems(res.data.items.map(toEdit));
      } else if (accountId) {
        // Mes nuevo → auto-import de Botmaker (crudo USD, comercial 0). 0 variables = sin consumo ese mes.
        try {
          const imp = await api.get<StatementItem[]>(
            `/organizations/${orgId}/clients/${clientId}/billing/variables/${period}/import`,
          );
          setItems(imp.data.map(toEdit));
        } catch {
          setItems([]); // Botmaker sin datos o error → vacío; podés agregar variables manuales.
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

  const total = (items ?? []).reduce((s, i) => s + (parseFloat(i.commercial) || 0), 0);

  const update = (key: string, patch: Partial<EditItem>) =>
    setItems((prev) => (prev ?? []).map((i) => (i._key === key ? { ...i, ...patch } : i)));

  const addManual = () =>
    setItems((prev) => [
      ...(prev ?? []),
      { _key: nextKey(), label: '', rawValue: null, commercial: '0', source: 'MANUAL' },
    ]);

  const remove = (key: string) => setItems((prev) => (prev ?? []).filter((i) => i._key !== key));

  const pasar = (key: string) =>
    setItems((prev) =>
      (prev ?? []).map((i) => (i._key === key && i.rawValue != null ? { ...i, commercial: String(i.rawValue) } : i)),
    );

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
          ...(i.rawValue != null && { rawValue: i.rawValue }),
          commercialValue: parseFloat(i.commercial) || 0,
          source: i.source,
        })),
        note: note.trim() || undefined,
      });
      toast.success('Guardado', 'Las variables del mes quedaron guardadas');
      onSaved();
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
            Re-importar reemplaza los ítems actuales por el consumo de Botmaker. ¿Seguir?
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
          <div className="grid grid-cols-[1fr_130px_150px_auto] items-center gap-2 border-b border-border px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">
            <span>Variable</span>
            <span className="text-right">Valor crudo (USD)</span>
            <span className="text-right">Valor comercial (USD)</span>
            <span className="w-16" />
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sin variables. Importá de Botmaker o agregá una manual.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((i) => (
                <div key={i._key} className="grid grid-cols-[1fr_130px_150px_auto] items-center gap-2 px-4 py-2">
                  <Input
                    value={i.label}
                    onChange={(e) => update(i._key, { label: e.target.value })}
                    placeholder="Nombre de la variable"
                    disabled={readOnly}
                    className="h-8"
                  />
                  <span className="text-right font-mono text-xs text-muted-foreground">
                    {i.rawValue != null ? formatUsd(i.rawValue) : '—'}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={i.commercial}
                    onChange={(e) => update(i._key, { commercial: e.target.value })}
                    disabled={readOnly}
                    className="h-8 text-right font-mono"
                  />
                  <div className="flex w-16 items-center justify-end gap-1">
                    {!readOnly && i.rawValue != null && (
                      <button
                        onClick={() => pasar(i._key)}
                        title="Pasar el crudo al comercial"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
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
              ))}
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
