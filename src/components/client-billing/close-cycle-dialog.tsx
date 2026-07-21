'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { formatPeriodLabel } from './types';

interface Props {
  orgId: string;
  clientId: string;
  period: string;
  subtotal: string;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function CloseCycleDialog({
  orgId,
  clientId,
  period,
  subtotal,
  currency,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [partial, setPartial] = useState(false);
  const [until, setUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleClose = async () => {
    if (partial && !until) {
      toast.error('Error', 'Elegí la fecha de corte parcial');
      return;
    }
    setSaving(true);
    try {
      const body: { until?: string; notes?: string } = {};
      if (partial && until) {
        // Fin del día elegido en hora local (es-PY). Ver §6.2: el backend interpreta
        // el instante y valida que caiga dentro del período.
        body.until = new Date(`${until}T23:59:59.999`).toISOString();
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generar factura — {formatPeriodLabel(period)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total a facturar</span>
              <span className="font-mono text-lg font-semibold text-foreground">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>
          </div>

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
              Corte parcial (facturar solo hasta una fecha)
            </label>
            {partial && (
              <div className="space-y-1 pl-6">
                <Label>Facturar movimientos hasta</Label>
                <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  El remanente posterior queda disponible como &quot;Facturar resto&quot;.
                </p>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleClose} disabled={saving}>
            {saving ? 'Generando...' : 'Generar factura (Borrador)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
