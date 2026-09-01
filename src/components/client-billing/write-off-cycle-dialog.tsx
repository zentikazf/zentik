'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
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
import { formatCurrency } from '@/lib/utils';

interface Props {
  orgId: string;
  clientId: string;
  invoiceNumber: string;
  cycleId: string;
  totalAmount: string;
  creditedTotal: string;
  balance: string;
  currency: string;
  defaultReason?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/**
 * #65 A1.4 — "Cerrar sin cobro".
 *
 * El problema que cierra: una factura acreditada al 100% por notas de crédito dejaba al operador
 * ante tres salidas y las tres mienten. Dejarla "Enviada" la mantiene como cobranza abierta que
 * nadie va a cobrar. Marcarla "Cobrada" sella una fecha de pago que nunca existió, y ese estado
 * es terminal. Anularla devuelve 409, porque liberar los movimientos devolvería por segunda vez
 * una plata que la nota de crédito ya devolvió.
 *
 * Calcado de `CancelCycleDialog`, que es la convención del repo para las acciones con motivo
 * obligatorio. La diferencia visual es deliberada: acá el recuadro es informativo y el botón
 * neutro, no destructivo — cerrar una factura saldada no destruye nada.
 */
export function WriteOffCycleDialog({
  orgId,
  clientId,
  invoiceNumber,
  cycleId,
  totalAmount,
  creditedTotal,
  balance,
  currency,
  defaultReason = '',
  open,
  onOpenChange,
  onDone,
}: Props) {
  const [reason, setReason] = useState(defaultReason);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (reason.trim().length < 3) {
      toast.error('Falta el motivo', 'Escribí por qué se cierra sin cobro (mínimo 3 caracteres)');
      return;
    }
    setSaving(true);
    try {
      await api.post(
        `/organizations/${orgId}/clients/${clientId}/billing/cycles/${cycleId}/write-off`,
        { reason: reason.trim() },
      );
      toast.success('Factura cerrada sin cobro', 'No se registró ningún pago: la fecha de cobro queda vacía');
      onDone();
      onOpenChange(false);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo cerrar la factura');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cerrar sin cobro — {invoiceNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* El desglose que da sentido al cierre: de dónde sale el saldo. */}
          <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 font-mono text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Total factura</span>
              <span>{formatCurrency(totalAmount, currency)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Notas de crédito</span>
              <span>{formatCurrency(creditedTotal, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-foreground">
              <span>Saldo</span>
              <span>{formatCurrency(balance, currency)}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <p className="text-xs text-muted-foreground">
              La factura queda <strong>cerrada sin cobro</strong>: conserva su número y sus movimientos, y{' '}
              <strong>no se registra ninguna fecha de pago</strong> — porque no hubo pago. Si el cliente
              termina pagando, se puede marcar como cobrada después.
            </p>
          </div>

          <div className="space-y-2">
            <Label>
              Motivo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: saldo 0 por NC-2026-00004, incobrable, condonada por acuerdo comercial..."
              rows={3}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? 'Cerrando...' : 'Cerrar sin cobro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
