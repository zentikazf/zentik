'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trash2, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

interface BoardSettingsDialogProps {
  projectId: string;
  board?: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function BoardSettingsDialog({
  projectId,
  board,
  open,
  onOpenChange,
  onSaved,
}: BoardSettingsDialogProps) {
  const [name, setName] = useState(board?.name || '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEdit = !!board;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/projects/${projectId}/boards/${board.id}`, { name: name.trim() });
        toast.success('Tablero actualizado');
      } else {
        await api.post(`/projects/${projectId}/boards`, { name: name.trim() });
        toast.success('Tablero creado', `"${name.trim()}" ha sido creado exitosamente`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al guardar el tablero';
      toast.error('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!board) return;
    setDeleting(true);
    try {
      await api.delete(`/projects/${projectId}/boards/${board.id}`);
      toast.success('Tablero eliminado');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al eliminar el tablero';
      toast.error('Error', message);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Configuración del Tablero' : 'Nuevo Tablero'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nombre del tablero</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Sprint Board, Kanban, Flujo de trabajo..."
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-col">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear Tablero'}
            </Button>
          </div>

          {isEdit && (
            <>
              <Separator />
              {confirmDelete ? (
                <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    ¿Eliminar este tablero?
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                      No
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                      {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar tablero
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
