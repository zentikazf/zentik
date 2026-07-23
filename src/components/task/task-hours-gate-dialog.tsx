'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Clock, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

interface TaskHoursGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tarea a la que se le cargarán las horas (o que se cerrará sin horas). */
  taskId: string;
  /** Etiqueta del estado destino para el microcopy: "En Revisión" | "Completada". */
  targetLabel: string;
  /** Si true, ofrece el paso "cerrar sin horas" (actor asignado o con manage:projects). */
  canCloseWithoutHours: boolean;
  /** Endpoint de carga de horas (del error del gate). Default: POST /tasks/:id/time-entries. */
  logHoursEndpoint?: string;
  /** Fecha mínima (YYYY-MM-DD) para el picker de "trabajado el" — típicamente el día de la tarea. */
  taskDay?: string;
  /** Se llama tras registrar horas OK — el padre re-dispara la transición original. Puede lanzar. */
  onLogged: () => void | Promise<void>;
  /** Se llama al confirmar el escape — el padre hace el PATCH con closeWithoutHours. Puede lanzar. */
  onEscape: (reason: string) => void | Promise<void>;
}

/**
 * H6 — Diálogo del gate de horas. Reutilizable por el board (reactivo), el detalle
 * (proactivo) y el panel de ticket (reactivo). Molde: el diálogo de rechazo del detalle.
 * Dos pasos:
 *   1) Cargar horas reales → registra y re-dispara la transición.
 *   2) (solo si canCloseWithoutHours) Cerrar sin horas → pide motivo obligatorio y audita.
 */
export function TaskHoursGateDialog({
  open,
  onOpenChange,
  taskId,
  targetLabel,
  canCloseWithoutHours,
  logHoursEndpoint,
  taskDay,
  onLogged,
  onEscape,
}: TaskHoursGateDialogProps) {
  const [step, setStep] = useState<'log' | 'escape'>('log');
  const [hours, setHours] = useState('');
  const [workedOn, setWorkedOn] = useState<string>(() => new Date().toLocaleDateString('en-CA'));
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const endpoint = logHoursEndpoint?.replace(/^POST\s+/i, '') ?? `/tasks/${taskId}/time-entries`;

  const reset = () => {
    setStep('log');
    setHours('');
    setNote('');
    setReason('');
    setWorkedOn(new Date().toLocaleDateString('en-CA'));
  };

  const close = () => {
    onOpenChange(false);
    // pequeño delay para que el fade no muestre el reset
    setTimeout(reset, 200);
  };

  const handleRegister = async () => {
    const h = Number(hours);
    if (!hours || Number.isNaN(h) || h <= 0) {
      toast.error('Horas inválidas', 'Ingresá una cantidad de horas mayor a 0.');
      return;
    }
    setBusy(true);
    try {
      await api.post(endpoint, {
        minutes: Math.round(h * 60),
        workedOn,
        note: note || undefined,
      });
      await onLogged();
      close();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudieron registrar las horas.';
      toast.error('No se pudo registrar', msg);
    } finally {
      setBusy(false);
    }
  };

  const handleEscape = async () => {
    const r = reason.trim();
    if (!r) return;
    setBusy(true);
    try {
      await onEscape(r);
      close();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo cerrar la tarea.';
      toast.error('No se pudo cerrar', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md">
        {step === 'log' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" /> Cargá las horas antes de cerrar
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Para pasar la tarea a <span className="font-medium text-foreground">{targetLabel}</span> necesitás
              registrar al menos una carga de horas real. La estimación no cuenta.
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRegister(); } }}
                  placeholder="Horas"
                  autoFocus
                  className="h-9 w-24 rounded border border-border bg-background px-2 text-sm text-foreground"
                />
                <input
                  type="date"
                  value={workedOn}
                  max={todayStr}
                  min={taskDay}
                  onChange={(e) => setWorkedOn(e.target.value)}
                  className="h-9 flex-1 rounded border border-border bg-background px-2 text-xs text-foreground"
                />
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nota (opcional)"
                rows={2}
                className="text-sm resize-none min-h-0"
              />
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
              <Button className="w-full gap-2" disabled={busy || !hours} onClick={handleRegister}>
                <Clock className="h-4 w-4" /> {busy ? 'Registrando...' : 'Registrar y cerrar'}
              </Button>
              {canCloseWithoutHours && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep('escape')}
                  className="w-full text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                >
                  Cerrar sin horas (0 h)
                </button>
              )}
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Cerrar sin registrar horas
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Usá esto solo para tareas de 0 h reales (ticket trivial o falso positivo). Queda registrado
              quién y cuándo.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Motivo (obligatorio)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: falso positivo, ya resuelto sin trabajo."
                rows={3}
                autoFocus
              />
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep('log')}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
              >
                ← Volver a cargar horas
              </button>
              <Button variant="destructive" disabled={busy || !reason.trim()} onClick={handleEscape}>
                {busy ? 'Cerrando...' : 'Confirmar cierre sin horas'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
