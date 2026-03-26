'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [billable, setBillable] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!entry;

  useEffect(() => {
    if (!open) return;
    const loadTasks = async () => {
      try {
        const res = await api.get(`/projects/${projectId}/tasks?limit=100`);
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setTasks(list);
      } catch {}
    };
    loadTasks();
  }, [projectId, open]);

  useEffect(() => {
    if (entry) {
      setTaskId(entry.taskId || '');
      setDescription(entry.description || '');
      setBillable(entry.billable ?? false);
      if (entry.startTime) {
        const s = new Date(entry.startTime);
        setStartDate(s.toISOString().split('T')[0]);
        setStartTime(s.toTimeString().slice(0, 5));
      }
      if (entry.endTime) {
        const e = new Date(entry.endTime);
        setEndDate(e.toISOString().split('T')[0]);
        setEndTime(e.toTimeString().slice(0, 5));
      }
    } else {
      setTaskId('');
      setDescription('');
      setBillable(false);
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      setStartDate(today);
      setStartTime(now.toTimeString().slice(0, 5));
      setEndDate(today);
      const later = new Date(now.getTime() + 3600000);
      setEndTime(later.toTimeString().slice(0, 5));
    }
  }, [entry, open]);

  const handleSave = async () => {
    if (!taskId || !startDate || !startTime || !endDate || !endTime) {
      toast.error('Error', 'Completa todos los campos requeridos');
      return;
    }

    const startISO = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endISO = new Date(`${endDate}T${endTime}:00`).toISOString();

    if (new Date(endISO) <= new Date(startISO)) {
      toast.error('Error', 'La hora de fin debe ser posterior a la de inicio');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        taskId,
        description: description.trim() || undefined,
        startTime: startISO,
        endTime: endISO,
        billable,
      };

      if (isEdit) {
        await api.patch(`/time-entries/${entry.id}`, payload);
        toast.success('Entrada actualizada');
      } else {
        await api.post('/time-entries', payload);
        toast.success('Entrada creada', 'El registro de tiempo ha sido agregado');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Entrada de Tiempo' : 'Nueva Entrada de Tiempo'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Tarea</Label>
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tarea..." />
              </SelectTrigger>
              <SelectContent>
                {tasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.identifier ? `${t.identifier} — ` : ''}{t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿Qué hiciste durante este tiempo?"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha inicio</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hora inicio</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha fin</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hora fin</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm font-medium">Facturable</Label>
              <p className="text-xs text-muted-foreground">¿Este tiempo es facturable al cliente?</p>
            </div>
            <Switch checked={billable} onCheckedChange={setBillable} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !taskId}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Registrar Tiempo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
