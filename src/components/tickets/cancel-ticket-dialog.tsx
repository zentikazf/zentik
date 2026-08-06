'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { ticketService } from '@/services/ticket.service';
import type { TicketDetail } from '@/types/ticket.types';

interface CancelTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  onCancelled: (updated: TicketDetail) => void;
}

/** Motivos de cancelación (espejo del enum CloseReasonDto del backend). */
const REASONS: { value: string; label: string }[] = [
  { value: 'OTHER', label: 'Otro' },
  { value: 'DUPLICATE', label: 'Duplicado' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'RESOLVED_BY_CLIENT', label: 'Resuelto por el cliente' },
];

/**
 * Diálogo «Cancelar ticket» (#43 R1b). Cancelar reutiliza el estado CLOSED como
 * «Cancelado»: el comentario es OBLIGATORIO (candado también en el service). El
 * comentario es INTERNO — el cliente ve solo el estado «Cancelado», nunca el motivo.
 */
export function CancelTicketDialog({ open, onOpenChange, ticketId, onCancelled }: CancelTicketDialogProps) {
  const [reason, setReason] = useState('OTHER');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    const trimmed = note.trim();
    if (!trimmed) {
      toast.error('Falta el comentario', 'El motivo de la cancelación es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      const res = await ticketService.cancel(ticketId, { reason, note: trimmed });
      onCancelled(res.data);
      toast.success('Ticket cancelado', 'El ticket quedó marcado como «Cancelado».');
      onOpenChange(false);
      setNote('');
      setReason('OTHER');
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo cancelar el ticket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar ticket</DialogTitle>
          <DialogDescription>
            El ticket quedará como «Cancelado». El comentario es interno (el cliente no lo ve).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Comentario <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Por qué se cancela este ticket (obligatorio, interno)"
              maxLength={500}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Volver
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={saving || !note.trim()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? 'Cancelando...' : 'Cancelar ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
