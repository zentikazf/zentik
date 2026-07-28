'use client';

import { useState } from 'react';
import { FileMinus, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { api, ApiError, getToken } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import type { CycleTransactionLine } from '@/components/client-billing/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Respuesta del dry-run POST .../credit-notes/preview. Montos como STRING (Decimal del backend);
// totalAmount/totalHours ya vienen NEGATIVOS. Las líneas listan el monto POSITIVO original.
interface CreditNotePreview {
  invoiceNumber: string;
  currency: string;
  returnHoursToBillable: boolean;
  lineCount: number;
  totalAmount: string; // NEGATIVO
  totalHours: number; // NEGATIVO
  lines: Array<{
    id: string;
    description: string;
    hours: number; // POSITIVO
    priceAmount: string; // POSITIVO
    workedOn: string | null;
  }>;
}

// Respuesta de POST .../credit-notes (201) — la NC recién emitida.
interface CreditNoteCreated {
  id: string;
  number: string; // NC-YYYY-NNNNN
  appliesToCycleId: string;
  totalAmount: string; // NEGATIVO
  totalHours: number; // NEGATIVO
  lineCount: number;
  returnHoursToBillable: boolean;
}

interface Props {
  orgId: string;
  clientId: string;
  cycleId: string;
  invoiceNumber: string;
  currency: string;
  lines: CycleTransactionLine[]; // snapshot ya fetcheado (data.transactions)
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/**
 * H9b — emitir una nota de crédito sobre una factura SENT/PAID. Selección de líneas a acreditar +
 * motivo obligatorio (min 3) + toggle "devolver horas a facturable" (default ON). Preview server-side
 * (dry-run, cero writes) antes de emitir. Al emitir descarga el PDF de la NC y recarga el detalle.
 */
export function CreditNoteDialog({
  orgId,
  clientId,
  cycleId,
  invoiceNumber,
  currency,
  lines,
  open,
  onOpenChange,
  onDone,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [returnHours, setReturnHours] = useState(true);
  const [preview, setPreview] = useState<CreditNotePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const base = `/organizations/${orgId}/clients/${clientId}/billing/cycles/${cycleId}/credit-notes`;
  const allSelected = lines.length > 0 && selected.size === lines.length;
  const canEmit = selected.size > 0 && reason.trim().length >= 3 && !saving;

  const reset = () => {
    setSelected(new Set());
    setReason('');
    setReturnHours(true);
    setPreview(null);
  };

  // El preview depende de las líneas seleccionadas + returnHours: invalidarlo al cambiarlos.
  const toggleLine = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPreview(null);
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(lines.map((l) => l.id)));
    setPreview(null);
  };

  const handleReturnHours = (v: boolean) => {
    setReturnHours(v);
    setPreview(null);
  };

  const buildBody = () => ({
    lineIds: [...selected],
    reason: reason.trim(),
    returnHoursToBillable: returnHours,
  });

  const handlePreview = async () => {
    if (selected.size === 0) return;
    setPreviewing(true);
    try {
      const res = await api.post<CreditNotePreview>(`${base}/preview`, buildBody());
      setPreview(res.data);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo generar la vista previa');
    } finally {
      setPreviewing(false);
    }
  };

  // Descarga del PDF de la NC recién creada: fetch crudo + blob + <a download> (Bearer + cookie de
  // sesión), mismo patrón que el PDF de la factura. Ruta staff.
  const downloadPdf = async (nc: CreditNoteCreated) => {
    try {
      const url = `${API_URL}/api/v1/organizations/${orgId}/clients/${clientId}/billing/credit-notes/${nc.id}/pdf`;
      const token = getToken();
      const res = await fetch(url, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        toast.error('Error', `No se pudo descargar el PDF de la nota de crédito (HTTP ${res.status})`);
        return;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `${nc.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    } catch {
      toast.error('Error', 'No se pudo descargar el PDF de la nota de crédito');
    }
  };

  const handleEmit = async () => {
    if (!canEmit) return;
    setSaving(true);
    try {
      const res = await api.post<CreditNoteCreated>(base, buildBody());
      toast.success(
        'Nota de crédito emitida',
        `${res.data.number} · ${formatCurrency(res.data.totalAmount, currency)}`,
      );
      await downloadPdf(res.data);
      onDone();
      onOpenChange(false);
      reset();
    } catch (err) {
      // Errores por code (LINE_ALREADY_CREDITED, CREDIT_NOTE_INVALID_INVOICE_STATE,
      // CREDIT_NOTE_INVALID_LINE, CYCLE_NOT_FOUND, ...): el message del backend ya viene en es-PY.
      toast.error(
        'No se pudo emitir la nota de crédito',
        err instanceof ApiError ? err.message : 'Error inesperado',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nota de crédito — {invoiceNumber}</DialogTitle>
          <DialogDescription>
            Seleccioná las líneas a acreditar. Se emite una nota de crédito (monto negativo) asociada a esta
            factura; la factura original no se modifica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Selección de líneas */}
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Líneas de la factura
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={toggleAll}
                disabled={lines.length === 0 || saving}
              >
                {allSelected ? 'Ninguna' : 'Acreditar todo'}
              </Button>
            </div>
            {lines.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Esta factura no tiene líneas.</p>
            ) : (
              <ul className="max-h-[240px] divide-y divide-border overflow-y-auto">
                {lines.map((l) => {
                  const concepto = l.task?.title ?? l.note ?? '—';
                  return (
                    <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Checkbox
                        id={`ncline-${l.id}`}
                        checked={selected.has(l.id)}
                        onCheckedChange={() => toggleLine(l.id)}
                        disabled={saving}
                      />
                      <label
                        htmlFor={`ncline-${l.id}`}
                        className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3"
                      >
                        <span className="truncate text-sm text-foreground">{concepto}</span>
                        <span className="flex shrink-0 items-center gap-3 font-mono text-xs text-muted-foreground">
                          <span>{l.hours.toFixed(2)}h</span>
                          <span className="text-foreground">
                            {l.priceAmount ? formatCurrency(l.priceAmount, l.priceCurrency ?? currency) : '—'}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Motivo obligatorio */}
          <div className="space-y-2">
            <Label htmlFor="nc-reason">
              Motivo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="nc-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: horas cargadas por error, ajuste comercial acordado con el cliente..."
              rows={3}
              disabled={saving}
            />
          </div>

          {/* Toggle devolver horas a facturable (default ON) */}
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="nc-return-hours" className="cursor-pointer">
                Devolver horas a facturable
              </Label>
              <p className="text-xs text-muted-foreground">
                Las horas acreditadas vuelven a estar disponibles para facturar. Desactivalo para un descuento
                sin re-facturar (gesto comercial).
              </p>
            </div>
            <Switch
              id="nc-return-hours"
              checked={returnHours}
              onCheckedChange={handleReturnHours}
              disabled={saving}
            />
          </div>

          {/* Vista previa server-side */}
          {preview && (
            <div className="rounded-lg border border-info/30 bg-info/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Vista previa
                </span>
                <span className="text-xs text-muted-foreground">{preview.lineCount} línea(s)</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-mono text-xs text-muted-foreground">{preview.totalHours.toFixed(2)}h</span>
                <span className="font-mono text-lg font-semibold text-info">
                  {formatCurrency(preview.totalAmount, preview.currency)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            className="gap-1.5"
            onClick={handlePreview}
            disabled={selected.size === 0 || previewing || saving}
          >
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Ver preview
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button className="gap-1.5" onClick={handleEmit} disabled={!canEmit}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileMinus className="h-4 w-4" />}
              Emitir nota de crédito
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
