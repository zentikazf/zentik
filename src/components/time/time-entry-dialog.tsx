'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, AlertTriangle, Clock, Pencil } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

interface TimeEntryDialogProps {
 projectId: string;
 entry?: any | null;
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onSaved: () => void;
}

export function TimeEntryDialog({
 projectId,
 entry,
 open,
 onOpenChange,
 onSaved,
}: TimeEntryDialogProps) {
 const [tasks, setTasks] = useState<any[]>([]);
 const [taskId, setTaskId] = useState('');
 const [description, setDescription] = useState('');
 const [billable, setBillable] = useState(true);
 const [saving, setSaving] = useState(false);

 // Task data (auto-filled)
 const [taskData, setTaskData] = useState<any>(null);
 const [startDate, setStartDate] = useState('');
 const [endDate, setEndDate] = useState('');
 const [hours, setHours] = useState('');
 const [confirmed, setConfirmed] = useState(false);
 const [editing, setEditing] = useState(false);

 const isEdit = !!entry;

 useEffect(() => {
 if (!open) return;
 const loadTasks = async () => {
 try {
 const res = await api.get(`/projects/${projectId}/tasks?limit=200`);
 const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
 setTasks(list.filter((t: any) => !['DONE', 'CANCELLED'].includes(t.status) && t.type !== 'SUPPORT'));
 } catch {}
 };
 loadTasks();
 }, [projectId, open]);

 useEffect(() => {
 if (!open) return;
 if (entry) {
 setTaskId(entry.taskId || '');
 setDescription(entry.description || '');
 setBillable(entry.billable ?? true);
 if (entry.startTime) setStartDate(new Date(entry.startTime).toISOString().split('T')[0]);
 if (entry.endTime) setEndDate(new Date(entry.endTime).toISOString().split('T')[0]);
 if (entry.duration) setHours(String((entry.duration / 3600).toFixed(1)));
 setConfirmed(true);
 setEditing(true);
 } else {
 resetForm();
 }
 }, [entry, open]);

 const resetForm = () => {
 setTaskId('');
 setDescription('');
 setBillable(true);
 setTaskData(null);
 setStartDate('');
 setEndDate('');
 setHours('');
 setConfirmed(false);
 setEditing(false);
 };

 // When task is selected, auto-fill from task data
 const handleTaskSelect = async (id: string) => {
 setTaskId(id);
 setConfirmed(false);
 setEditing(false);

 if (!id) {
 setTaskData(null);
 return;
 }

 try {
 const res = await api.get(`/tasks/${id}`);
 const task = res.data;
 setTaskData(task);

 // Auto-fill from task
 if (task.startDate) setStartDate(new Date(task.startDate).toISOString().split('T')[0]);
 else setStartDate(new Date().toISOString().split('T')[0]);

 if (task.dueDate) setEndDate(new Date(task.dueDate).toISOString().split('T')[0]);
 else setEndDate(new Date().toISOString().split('T')[0]);

 setHours(task.estimatedHours ? String(task.estimatedHours) : '0');
 } catch {
 toast.error('Error', 'No se pudo cargar los datos de la tarea');
 }
 };

 const handleConfirm = () => setConfirmed(true);

 const handleEdit = () => setEditing(true);

 const handleSave = async () => {
 if (!taskId || !startDate || !endDate || !hours) {
 toast.error('Error', 'Completa todos los campos requeridos');
 return;
 }

 const h = parseFloat(hours) || 0;
 if (h <= 0) {
 toast.error('Error', 'Las horas deben ser mayores a 0');
 return;
 }

 setSaving(true);
 try {
 const startISO = new Date(`${startDate}T09:00:00`).toISOString();
 const durationSeconds = Math.round(h * 3600);
 const endISO = new Date(new Date(startISO).getTime() + durationSeconds * 1000).toISOString();

 const payload = {
 taskId,
 description: description.trim() || undefined,
 startTime: startISO,
 endTime: endISO,
 duration: durationSeconds,
 billable,
 };

 if (isEdit) {
 await api.patch(`/time-entries/${entry.id}`, payload);
 toast.success('Entrada actualizada');
 } else {
 await api.post('/time-entries', payload);
 toast.success('Entrada registrada', 'Las horas se han agregado a facturación');
 }

 // If user edited the dates/hours, update the task too
 if (editing && taskData) {
 const taskUpdate: Record<string, unknown> = {};
 if (startDate !== (taskData.startDate ? new Date(taskData.startDate).toISOString().split('T')[0] : '')) {
 taskUpdate.startDate = new Date(`${startDate}T00:00:00`).toISOString();
 }
 if (endDate !== (taskData.dueDate ? new Date(taskData.dueDate).toISOString().split('T')[0] : '')) {
 taskUpdate.dueDate = new Date(`${endDate}T23:59:59`).toISOString();
 }
 if (String(taskData.estimatedHours || 0) !== hours) {
 taskUpdate.estimatedHours = parseFloat(hours);
 }
 if (Object.keys(taskUpdate).length > 0) {
 await api.patch(`/tasks/${taskId}`, taskUpdate).catch(() => {});
 }
 }

 onSaved();
 onOpenChange(false);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al guardar la entrada';
 toast.error('Error', message);
 } finally {
 setSaving(false);
 }
 };

 const selectedTask = tasks.find((t) => t.id === taskId);

 return (
 <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
 <DialogContent className="sm:max-w-lg">
 <DialogHeader>
 <DialogTitle>{isEdit ? 'Editar Entrada de Tiempo' : 'Nueva Entrada de Tiempo'}</DialogTitle>
 </DialogHeader>

 <div className="space-y-5 py-2">
 {/* Task selector */}
 <div className="space-y-2">
 <Label>Tarea</Label>
 <Select value={taskId} onValueChange={handleTaskSelect}>
 <SelectTrigger>
 <SelectValue placeholder="Seleccionar tarea..."/>
 </SelectTrigger>
 <SelectContent>
 {tasks.map((t) => {
 const isSupport = t.type === 'SUPPORT';
 return (
 <SelectItem
 key={t.id}
 value={t.id}
 disabled={isSupport}
 >
 <span className="flex items-center gap-2">
 <span>{t.identifier ? `${t.identifier} — ` : ''}{t.title}</span>
 {isSupport && (
 <span className="text-[10px] text-muted-foreground">(Soporte — no configurable)</span>
 )}
 </span>
 </SelectItem>
 );
 })}
 </SelectContent>
 </Select>
 <p className="text-[11px] text-muted-foreground">
 Las tareas de <strong>soporte</strong> descuentan horas automaticamente del cupo del cliente al completarse — no se registran manualmente aqui.
 </p>
 </div>

 {/* Auto-filled data from task */}
 {taskId && !isEdit && (
 <>
 <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 space-y-3">
 <div className="flex items-center gap-2 text-sm font-medium text-primary">
 <CheckCircle2 className="h-4 w-4"/>
 Datos extraídos de la tarea
 </div>

 <div className="grid grid-cols-3 gap-3">
 <div>
 <p className="text-[11px] text-muted-foreground">Fecha inicio</p>
 <p className="text-sm font-semibold text-foreground">{startDate || '—'}</p>
 </div>
 <div>
 <p className="text-[11px] text-muted-foreground">Fecha fin</p>
 <p className="text-sm font-semibold text-foreground">{endDate || '—'}</p>
 </div>
 <div>
 <p className="text-[11px] text-muted-foreground">Horas estimadas</p>
 <p className="text-sm font-semibold text-foreground">{hours || '0'}h</p>
 </div>
 </div>

 {!confirmed ? (
 <div className="flex items-center gap-3 pt-1">
 <p className="text-xs text-muted-foreground flex-1">
 ¿Estos datos son correctos?
 </p>
 <Button size="sm"className="h-7 text-xs rounded-full bg-primary hover:bg-primary/90"onClick={handleConfirm}>
 <CheckCircle2 className="h-3 w-3 mr-1"/> Sí, correctos
 </Button>
 <Button variant="outline"size="sm"className="h-7 text-xs rounded-full"onClick={handleEdit}>
 <Pencil className="h-3 w-3 mr-1"/> Editar
 </Button>
 </div>
 ) : !editing ? (
 <div className="flex items-center gap-2 pt-1">
 <Badge className="bg-success/15 text-success text-[11px]">
 <CheckCircle2 className="h-3 w-3 mr-1"/> Datos confirmados
 </Badge>
 <button onClick={handleEdit} className="text-[11px] text-primary hover:underline">
 Editar de todas formas
 </button>
 </div>
 ) : null}
 </div>

 {/* Editable fields when user clicks"Editar"*/}
 {editing && (
 <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 space-y-3">
 <div className="flex items-center gap-2 text-sm font-medium text-warning">
 <AlertTriangle className="h-4 w-4"/>
 Editando datos — se actualizará la tarea
 </div>
 <div className="grid grid-cols-3 gap-3">
 <div className="space-y-1">
 <Label className="text-[11px]">Fecha inicio</Label>
 <Input type="date"value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs"/>
 </div>
 <div className="space-y-1">
 <Label className="text-[11px]">Fecha fin</Label>
 <Input type="date"value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs"/>
 </div>
 <div className="space-y-1">
 <Label className="text-[11px]">Horas</Label>
 <Input type="number"value={hours} onChange={(e) => setHours(e.target.value)} className="h-8 text-xs"min={0} step={0.5} />
 </div>
 </div>
 </div>
 )}
 </>
 )}

 {/* Edit mode - inline fields for existing entries */}
 {isEdit && (
 <div className="grid grid-cols-3 gap-3">
 <div className="space-y-1">
 <Label className="text-[11px]">Fecha inicio</Label>
 <Input type="date"value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs"/>
 </div>
 <div className="space-y-1">
 <Label className="text-[11px]">Fecha fin</Label>
 <Input type="date"value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs"/>
 </div>
 <div className="space-y-1">
 <Label className="text-[11px]">Horas</Label>
 <Input type="number"value={hours} onChange={(e) => setHours(e.target.value)} className="h-8 text-xs"min={0} step={0.5} />
 </div>
 </div>
 )}

 {/* Description */}
 {(confirmed || editing || isEdit) && (
 <>
 <div className="space-y-2">
 <Label>Nota (opcional)</Label>
 <Textarea
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Breve nota sobre el trabajo realizado..."
 rows={2}
 />
 </div>
 <div className="flex items-center justify-between rounded-lg border border-border p-3">
 <div>
 <Label className="text-sm font-medium">Facturable</Label>
 <p className="text-[11px] text-muted-foreground">¿Esta entrada se factura al cliente?</p>
 </div>
 <Switch checked={billable} onCheckedChange={setBillable} />
 </div>
 </>
 )}
 </div>

 <DialogFooter>
 <Button variant="outline"onClick={() => { resetForm(); onOpenChange(false); }}>
 Cancelar
 </Button>
 <Button
 onClick={handleSave}
 disabled={saving || !taskId || (!confirmed && !editing && !isEdit)}
 className="bg-primary hover:bg-primary/90"
 >
 {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : billable ? 'Registrar y Facturar' : 'Registrar Entrada'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
