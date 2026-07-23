'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatHoursFromMinutes, formatWorkedOn } from '@/lib/utils';

interface ApprovalEntry {
 minutes: number;
 workedOn: string | null;
 userId: string | null;
 userName: string | null;
}

interface ApprovalPreview {
 task: { id: string; title: string; projectId: string };
 originalEstimate: number;
 realHours: number;
 realMinutes: number;
 hasManualHours: boolean;
 entries: ApprovalEntry[];
 closedWithoutHours: { by: string; reason: string | null; at: string } | null;
}

interface TaskApprovalOtpModalProps {
 taskId: string | null;
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onApproved?: () => void;
}

export function TaskApprovalOtpModal({ taskId, open, onOpenChange, onApproved }: TaskApprovalOtpModalProps) {
 const [preview, setPreview] = useState<ApprovalPreview | null>(null);
 const [loading, setLoading] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 // H6 — si la tarea no tiene horas reales, el backend bloquea la aprobación;
 // ofrecemos "aprobar sin horas (0 h)" con motivo (auditado).
 const [escapeMode, setEscapeMode] = useState(false);
 const [escapeReason, setEscapeReason] = useState('');

 useEffect(() => {
 if (!open || !taskId) {
 setPreview(null);
 setEscapeMode(false);
 setEscapeReason('');
 return;
 }
 setLoading(true);
 api.get(`/tasks/${taskId}/approval-preview`)
 .then((res) => {
 setPreview(res.data as ApprovalPreview);
 })
 .catch((err) => {
 const msg = err instanceof ApiError ? err.message : 'No se pudo cargar el preview';
 toast.error('Error', msg);
 onOpenChange(false);
 })
 .finally(() => setLoading(false));
 }, [open, taskId, onOpenChange]);

 // H7 — la aprobación NO manda confirmedHours: el backend cobra las horas MANUALES
 // reales cargadas en la tarea. El modal solo confirma.
 const handleConfirm = async () => {
 if (!taskId) return;
 setSubmitting(true);
 try {
 await api.post(`/tasks/${taskId}/approve`, {});
 toast.success(
 'Tarea aprobada',
 preview ? `Se descontaron ${formatHoursFromMinutes(preview.realMinutes)} del cupo` : 'Horas confirmadas',
 );
 onApproved?.();
 onOpenChange(false);
 } catch (err) {
 // H6: sin horas reales → ofrecer aprobar sin horas (el aprobador tiene manage:projects).
 if (err instanceof ApiError && err.code === 'WORK_HOURS_REQUIRED') {
 setEscapeMode(true);
 } else {
 const msg = err instanceof ApiError ? err.message : 'Error al aprobar la tarea';
 toast.error('Error', msg);
 }
 } finally {
 setSubmitting(false);
 }
 };

 const handleApproveWithoutHours = async () => {
 if (!taskId) return;
 const reason = escapeReason.trim();
 if (!reason) return;
 setSubmitting(true);
 try {
 await api.post(`/tasks/${taskId}/approve`, { closeWithoutHours: true, closeWithoutHoursReason: reason });
 toast.success('Tarea aprobada sin horas', 'Quedó registrado el motivo');
 onApproved?.();
 onOpenChange(false);
 } catch (err) {
 const msg = err instanceof ApiError ? err.message : 'No se pudo aprobar sin horas';
 toast.error('Error', msg);
 } finally {
 setSubmitting(false);
 }
 };

 if (!preview && !loading) return null;

 const variance = preview ? preview.realHours - (preview.originalEstimate || 0) : 0;

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Clock className="h-4 w-4 text-primary"/>
 Confirmá las horas trabajadas
 </DialogTitle>
 </DialogHeader>

 {loading || !preview ? (
 <div className="space-y-3 py-4">
 <div className="h-4 w-3/4 animate-pulse rounded bg-muted"/>
 <div className="h-12 w-full animate-pulse rounded-xl bg-muted"/>
 </div>
 ) : (
 <>
 <div className="space-y-3 py-2">
 {/* AJ-3 — la tarea llegó cerrada sin horas (escape H6): avisar al PM. */}
 {preview.closedWithoutHours && (
 <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
 <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
 <AlertTriangle className="h-3.5 w-3.5"/> Cerrada sin horas por {preview.closedWithoutHours.by}
 </p>
 {preview.closedWithoutHours.reason && (
 <p className="mt-1 text-[11px] text-muted-foreground">Motivo: {preview.closedWithoutHours.reason}</p>
 )}
 </div>
 )}

 <div>
 <p className="text-xs text-muted-foreground">Tarea</p>
 <p className="text-sm font-medium text-foreground">{preview.task.title}</p>
 </div>

 {escapeMode ? (
 <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
 <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
 <AlertTriangle className="h-3.5 w-3.5"/> Aprobar sin horas (0 h)
 </p>
 <p className="text-[11px] text-muted-foreground">
 Aprobala sin horas si el trabajo fue realmente nulo. Queda registrado quién y por qué.
 </p>
 <Textarea
 value={escapeReason}
 onChange={(e) => setEscapeReason(e.target.value)}
 placeholder="Motivo (obligatorio) — ej: ticket trivial, sin trabajo imputable."
 rows={2}
 autoFocus
 />
 </div>
 ) : preview.hasManualHours ? (
 <>
 {/* Desglose read-only de las horas reales cargadas. */}
 <div className="space-y-1.5">
 <p className="text-xs text-muted-foreground">Estas son las horas reales cargadas en la tarea:</p>
 <ul className="divide-y divide-border rounded-xl border border-border">
 {preview.entries.map((e, i) => (
 <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
 <span className="font-medium text-foreground">{formatHoursFromMinutes(e.minutes)}</span>
 <span className="text-xs text-muted-foreground">
 {e.workedOn ? formatWorkedOn(e.workedOn) : 'sin fecha'}{e.userName ? ` · ${e.userName}` : ''}
 </span>
 </li>
 ))}
 </ul>
 </div>

 {/* Total destacado + nota de impacto. */}
 <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
 <div className="flex items-center justify-between">
 <span className="text-xs text-muted-foreground">Total a confirmar</span>
 <span className="text-lg font-bold text-primary">{formatHoursFromMinutes(preview.realMinutes)}</span>
 </div>
 <p className="mt-1 text-[11px] text-muted-foreground">
 Al confirmar, se descuentan {formatHoursFromMinutes(preview.realMinutes)} del cupo del cliente.
 </p>
 </div>

 {/* Varianza informativa vs. estimación (no editable). */}
 {preview.originalEstimate > 0 && (
 <p className="text-center text-[11px] text-muted-foreground">
 Estimaste {preview.originalEstimate}h ·{' '}
 {variance > 0 && `↑ ${variance.toFixed(1)}h por encima de lo estimado`}
 {variance < 0 && `↓ ${Math.abs(variance).toFixed(1)}h por debajo de lo estimado`}
 {variance === 0 && '✓ en estimación'}
 </p>
 )}
 </>
 ) : (
 // Caso 0 entradas reales: sin el warning engañoso anterior.
 <div className="space-y-2 rounded-lg border border-border p-3">
 <p className="text-sm font-medium text-foreground">Esta tarea no tiene horas reales cargadas.</p>
 <p className="text-[11px] text-muted-foreground">
 Cargá las horas trabajadas y volvé a aprobar, o aprobá sin horas (0 h) si el trabajo fue nulo.
 </p>
 <Link href={`/projects/${preview.task.projectId}/tasks/${preview.task.id}`}>
 <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
 Cargar horas
 </Button>
 </Link>
 </div>
 )}
 </div>

 <DialogFooter>
 {escapeMode ? (
 <>
 <Button variant="outline" onClick={() => setEscapeMode(false)} disabled={submitting}>
 Volver
 </Button>
 <Button variant="destructive" onClick={handleApproveWithoutHours} disabled={submitting || !escapeReason.trim()}>
 {submitting ? 'Aprobando...' : 'Aprobar sin horas (0 h)'}
 </Button>
 </>
 ) : preview.hasManualHours ? (
 <>
 <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
 Cancelar
 </Button>
 <Button onClick={handleConfirm} disabled={submitting} className="bg-primary hover:bg-primary/90">
 <CheckCircle2 className="h-3 w-3 mr-1"/>
 {submitting ? 'Aprobando...' : `Confirmar ${formatHoursFromMinutes(preview.realMinutes)} y aprobar`}
 </Button>
 </>
 ) : (
 <>
 <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
 Cerrar
 </Button>
 <Button variant="destructive" onClick={() => setEscapeMode(true)} disabled={submitting}>
 Aprobar sin horas (0 h)
 </Button>
 </>
 )}
 </DialogFooter>
 </>
 )}
 </DialogContent>
 </Dialog>
 );
}
