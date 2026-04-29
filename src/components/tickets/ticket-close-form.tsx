'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { ticketService } from '@/services/ticket.service';
import type { TicketCloseReason, TicketDetail } from '@/types/ticket.types';

const REASONS: { value: TicketCloseReason; label: string }[] = [
  { value: 'RESOLVED_BY_SUPPORT', label: 'Resuelto por soporte' },
  { value: 'RESOLVED_BY_CLIENT', label: 'Resuelto por cliente' },
  { value: 'DUPLICATE', label: 'Duplicado' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'OTHER', label: 'Otro' },
];

interface TicketCloseFormProps {
  ticketId: string;
  onClosed: (updated: TicketDetail) => void;
  onCancel: () => void;
}

export function TicketCloseForm({ ticketId, onClosed, onCancel }: TicketCloseFormProps) {
  const [reason, setReason] = useState<TicketCloseReason | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleClose = async () => {
    if (!reason || saving) return;
    setSaving(true);
    try {
      const res = await ticketService.close(ticketId, { reason, note: note.trim() || undefined });
      onClosed(res.data);
      toast.success('Ticket cerrado', `Motivo: ${REASONS.find((r) => r.value === reason)?.label}`);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo cerrar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Cerrar ticket</h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cancelar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Motivo</label>
        <div className="flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                reason === r.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Nota (opcional)
        </label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Detalle adicional sobre el cierre..."
          rows={2}
          className="text-sm resize-none"
          maxLength={500}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleClose} disabled={!reason || saving} className="gap-2">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? 'Cerrando...' : 'Cerrar ticket'}
        </Button>
      </div>
    </div>
  );
}
