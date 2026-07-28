'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface Props {
  orgId: string;
  clientId: string;
  invoiceNumber: string;
  cycleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/**
 * H8d/A3: anular una factura exige MOTIVO obligatorio. Libera los movimientos estampados (vuelven a ser
 * facturables) y deja la factura marcada "Anulada" como registro permanente (keep-data, nunca se borra).
 */
export function CancelCycleDialog({
  orgId,
  clientId,
  invoiceNumber,
  cycleId,
  open,
  onOpenChange,
  onDone,
}: Props) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (reason.trim().length < 3) {
      toast.error('Falta el motivo', 'Escribí por qué se anula la factura (mínimo 3 caracteres)');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/organizations/${orgId}/clients/${clientId}/billing/cycles/${cycleId}/reopen`, {
        cancelReason: reason.trim(),
      });
      toast.success('Factura anulada', 'Los movimientos vuelven a estar disponibles para facturar');
      onDone();
      onOpenChange(false);
      setReason('');
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo anular la factura');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Anular factura — {invoiceNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-xs text-muted-foreground">
              La factura queda como <strong>registro anulado</strong> (no se borra, conserva su número) y sus
              movimientos vuelven a estar disponibles. El motivo queda guardado en el historial.
            </p>
          </div>

          <div className="space-y-2">
            <Label>
              Motivo de la anulación <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: cargada por error, cliente pidió refacturar, montos incorrectos..."
              rows={3}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Anulando...' : 'Anular factura'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
