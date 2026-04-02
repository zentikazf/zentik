'use client';

import { useState } from 'react';
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

interface InvoiceDialogProps {
 projectId: string;
 invoice?: any | null;
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onSaved: () => void;
}

export function InvoiceDialog({ projectId, invoice, open, onOpenChange, onSaved }: InvoiceDialogProps) {
 const isEdit = !!invoice;
 const [periodStart, setPeriodStart] = useState(invoice?.periodStart?.split('T')[0] || '');
 const [periodEnd, setPeriodEnd] = useState(invoice?.periodEnd?.split('T')[0] || '');
 const [notes, setNotes] = useState(invoice?.notes || '');
 const [dueDate, setDueDate] = useState(invoice?.dueDate?.split('T')[0] || '');
 const [defaultHourlyRate, setDefaultHourlyRate] = useState('');
 const [saving, setSaving] = useState(false);

 const handleSave = async () => {
 setSaving(true);
 try {
 if (isEdit) {
 await api.patch(`/invoices/${invoice.id}`, {
 notes: notes.trim() || undefined,
 dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
 });
 toast.success('Factura actualizada');
 } else {
 if (!periodStart || !periodEnd) {
 toast.error('Error', 'Selecciona el periodo de facturación');
 setSaving(false);
 return;
 }
 await api.post(`/projects/${projectId}/invoices`, {
 periodStart: new Date(periodStart).toISOString(),
 periodEnd: new Date(periodEnd).toISOString(),
 notes: notes.trim() || undefined,
 defaultHourlyRate: defaultHourlyRate ? Number(defaultHourlyRate) : undefined,
 });
 toast.success('Factura generada', 'La factura ha sido creada exitosamente');
 }
 onSaved();
 onOpenChange(false);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al guardar la factura';
 toast.error('Error', message);
 } finally {
 setSaving(false);
 }
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-lg">
 <DialogHeader>
 <DialogTitle>{isEdit ? 'Editar Factura' : 'Generar Nueva Factura'}</DialogTitle>
 </DialogHeader>

 <div className="space-y-5 py-2">
 {!isEdit && (
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Inicio del periodo</Label>
 <Input type="date"value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
 </div>
 <div className="space-y-2">
 <Label>Fin del periodo</Label>
 <Input type="date"value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
 </div>
 </div>
 )}

 {!isEdit && (
 <div className="space-y-2">
 <Label>Tarifa/hora por defecto (₲)</Label>
 <Input
 type="number"
 value={defaultHourlyRate}
 onChange={(e) => setDefaultHourlyRate(e.target.value)}
 placeholder="Ej: 150000"
 min={0}
 />
 <p className="text-xs text-muted-foreground">
 Se usa para tareas sin tarifa propia. Las horas billable se importan automáticamente por tarea.
 </p>
 </div>
 )}

 {isEdit && (
 <div className="space-y-2">
 <Label>Fecha de vencimiento</Label>
 <Input type="date"value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
 </div>
 )}

 <div className="space-y-2">
 <Label>Notas</Label>
 <Textarea
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 placeholder="Notas adicionales para la factura..."
 rows={3}
 />
 </div>
 </div>

 <DialogFooter>
 <Button variant="outline"onClick={() => onOpenChange(false)}>Cancelar</Button>
 <Button onClick={handleSave} disabled={saving}>
 {saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Generar Factura'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
