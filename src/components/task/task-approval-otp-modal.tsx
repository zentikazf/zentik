'use client';

import { useEffect, useState } from 'react';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Pencil, Clock, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

interface ApprovalPreview {
 task: { id: string; title: string };
 originalEstimate: number;
 currentDraftHours: number;
 hasDraft: boolean;
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
 const [editing, setEditing] = useState(false);
 const [hours, setHours] = useState('');
 const [submitting, setSubmitting] = useState(false);
 // H6 — si la tarea no tiene horas reales, el backend bloquea la aprobación;
 // ofrecemos "aprobar sin horas (0 h)" con motivo (auditado).
 const [escapeMode, setEscapeMode] = useState(false);
 const [escapeReason, setEscapeReason] = useState('');

 useEffect(() => {
 if (!open || !taskId) {
 setPreview(null);
 setEditing(false);
 setHours('');
 setEscapeMode(false);
 setEscapeReason('');
 return;
 }
 setLoading(true);
 api.get(`/tasks/${taskId}/approval-preview`)
 .then((res) => {
 const data = res.data as ApprovalPreview;
 setPreview(data);
 setHours(String(data.currentDraftHours || data.originalEstimate || 0));
 })
 .catch((err) => {
 const msg = err instanceof ApiError ? err.message : 'No se pudo cargar el preview';
 toast.error('Error', msg);
 onOpenChange(false);
 })
 .finally(() => setLoading(false));
 }, [open, taskId, onOpenChange]);

 const handleConfirm = async () => {
 if (!taskId) return;
 const parsed = parseFloat(hours);
 if (Number.isNaN(parsed) || parsed < 0) {
 toast.error('Error', 'Ingresa un numero valido de horas');
 return;
 }

 setSubmitting(true);
 try {
 await api.post(`/tasks/${taskId}/approve`, { confirmedHours: parsed });
 toast.success('Tarea aprobada', `Se registraron ${parsed}h`);
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

 const parsedHours = parseFloat(hours);
 const variance = !Number.isNaN(parsedHours) && preview
 ? parsedHours - (preview.originalEstimate || 0)
 : 0;

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Clock className="h-4 w-4 text-primary"/>
 Confirma las horas trabajadas
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
 <div>
 <p className="text-xs text-muted-foreground">Tarea</p>
 <p className="text-sm font-medium text-foreground">{preview.task.title}</p>
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div className="rounded-xl border border-border p-3">
 <p className="text-[11px] text-muted-foreground">Estimaste</p>
 <p className="text-lg font-bold text-foreground">{preview.originalEstimate}h</p>
 </div>
 <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
 <p className="text-[11px] text-muted-foreground">Registraste</p>
 {editing ? (
 <Input
 type="number"
 min={0}
 step="0.5"
 autoFocus
 value={hours}
 onChange={(e) => setHours(e.target.value)}
 className="h-8 text-lg font-bold border-none px-0 focus-visible:ring-0 shadow-none"
 />
 ) : (
 <p className="text-lg font-bold text-primary">{hours}h</p>
 )}
 </div>
 </div>

 {!editing && !Number.isNaN(parsedHours) && (
 <p className="text-[11px] text-muted-foreground text-center">
 {variance > 0 && `↑ Excediste estimacion en ${variance.toFixed(1)}h`}
 {variance < 0 && `↓ Bajo estimacion por ${Math.abs(variance).toFixed(1)}h`}
 {variance === 0 && '✓ En estimacion'}
 </p>
 )}

 {!preview.hasDraft && !escapeMode && (
 <p className="text-[11px] text-warning bg-warning/10 rounded-lg p-2">
 No hay registro previo de horas. Vas a confirmar las horas manualmente.
 </p>
 )}

 {escapeMode && (
 <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
 <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
 <AlertTriangle className="h-3.5 w-3.5"/> Esta tarea no tiene horas reales cargadas
 </p>
 <p className="text-[11px] text-muted-foreground">
 Podés aprobarla sin horas (0 h) si el trabajo fue realmente nulo. Queda registrado quién y por qué.
 </p>
 <Textarea
 value={escapeReason}
 onChange={(e) => setEscapeReason(e.target.value)}
 placeholder="Motivo (obligatorio) — ej: ticket trivial, sin trabajo imputable."
 rows={2}
 autoFocus
 />
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
 ) : (
 <>
 <Button variant="outline" onClick={() => setEditing(!editing)} disabled={submitting}>
 <Pencil className="h-3 w-3 mr-1"/> {editing ? 'Listo' : 'Ajustar'}
 </Button>
 <Button onClick={handleConfirm} disabled={submitting} className="bg-primary hover:bg-primary/90">
 <CheckCircle2 className="h-3 w-3 mr-1"/>
 {submitting ? 'Aprobando...' : `Confirmar ${hours}h`}
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
