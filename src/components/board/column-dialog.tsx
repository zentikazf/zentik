'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const presetColors = [
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#84cc16', // lime
  '#eab308', // yellow
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#8b5cf6', // violet
];

interface ColumnDialogProps {
  boardId: string;
  column?: { id: string; name: string; color?: string; taskLimit?: number; position?: number } | null;
  position: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ColumnDialog({
  boardId,
  column,
  position,
  open,
  onOpenChange,
  onSaved,
}: ColumnDialogProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [wipLimit, setWipLimit] = useState('');
  const [saving, setSaving] = useState(false);

  const isEdit = !!column;

  useEffect(() => {
    if (column) {
      setName(column.name);
      setColor(column.color || '#6366f1');
      setWipLimit(column.taskLimit ? String(column.taskLimit) : '');
    } else {
      setName('');
      setColor('#6366f1');
      setWipLimit('');
    }
  }, [column, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        color,
      };
      if (wipLimit && Number(wipLimit) > 0) {
        payload.wipLimit = Number(wipLimit);
      }

      if (isEdit) {
        await api.patch(`/boards/${boardId}/columns/${column.id}`, payload);
        toast.success('Columna actualizada');
      } else {
        payload.position = position;
        await api.post(`/boards/${boardId}/columns`, payload);
        toast.success('Columna creada', `"${name.trim()}" ha sido agregada al tablero`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al guardar la columna';
      toast.error('Error', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Columna' : 'Nueva Columna'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: To Do, In Progress, Done..."
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {presetColors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110',
                    color === c ? 'border-foreground scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Límite de tareas (WIP)</Label>
            <Input
              type="number"
              value={wipLimit}
              onChange={(e) => setWipLimit(e.target.value)}
              placeholder="0 = sin límite"
              min={0}
              max={100}
            />
            <p className="text-xs text-muted-foreground">
              Cantidad máxima de tareas permitidas en esta columna. Dejar vacío para sin límite.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear Columna'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
