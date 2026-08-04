'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Info, Layers, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { cn } from '@/lib/utils';
import { ticketService } from '@/services/ticket.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import type { SlaCriticality } from '@/types/sla.types';
import type { TicketCategoryConfigItem } from '@/types/ticket.types';

/**
 * Categorías internas (#42 Fase 2.1).
 *
 * El CRUD estaba enterrado en la tab **legacy**, donde nadie lo encontraba: con
 * cero categorías cargadas el selector "Categoría interna" del diálogo de
 * reclasificación aparecía vacío. Se muda tal cual (mismos endpoints
 * `organizations/:orgId/ticket-categories`) a su tab propia, al lado de
 * Políticas / Tipos / Criticidades, porque en el modelo nuevo esta entidad ya NO
 * es lo que elige el cliente: es la clasificación con la que tipifica el equipo.
 */

/** Mismo tope que `CreateCategoryConfigDto` del backend. */
const MAX_NAME = 100;
const MAX_DESCRIPTION = 500;

// Sin lista ni badge de criticidad: esta pantalla dejó de mostrarla en Fase 2.1
// (la categoría interna clasifica el problema, no define urgencia). Las dos
// constantes que quedaron sin uso se borraron con la unificación de Fase 3.

interface CategoryForm {
  name: string;
  description: string;
  criticality: SlaCriticality;
  isActive: boolean;
}

const EMPTY_FORM: CategoryForm = {
  name: '',
  description: '',
  criticality: 'MEDIUM',
  isActive: true,
};

export default function InternalCategoriesPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<TicketCategoryConfigItem[]>([]);

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<TicketCategoryConfigItem | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      // El endpoint devuelve activas e inactivas: acá se administran las dos
      // (una inactiva se puede reactivar sin volver a crearla).
      const res = await ticketService.categories(orgId);
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudieron cargar las categorías internas'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (category: TicketCategoryConfigItem) => {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description ?? '',
      criticality: category.criticality,
      isActive: category.isActive !== false,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!orgId) return;
    const name = form.name.trim();
    const description = form.description.trim();
    const errors: string[] = [];
    if (name.length < 2) errors.push('El nombre debe tener al menos 2 caracteres');
    if (name.length > MAX_NAME) errors.push(`El nombre no puede exceder ${MAX_NAME} caracteres`);
    if (description.length > MAX_DESCRIPTION) {
      errors.push(`La descripción no puede exceder ${MAX_DESCRIPTION} caracteres`);
    }
    if (errors.length > 0) {
      toast.error('Datos inválidos', errors.join(' · '));
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await ticketService.updateCategory(orgId, editing.id, {
          name,
          // Vacío se manda igual: es cómo se borra una descripción existente.
          description,
          criticality: form.criticality,
          isActive: form.isActive,
        });
        toast.success('Actualizada', `Categoría "${name}" actualizada`);
      } else {
        await ticketService.createCategory(orgId, {
          name,
          ...(description ? { description } : {}),
          criticality: form.criticality,
        });
        toast.success('Creada', `Categoría "${name}" creada`);
      }
      setShowDialog(false);
      await load();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo guardar la categoría'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (category: TicketCategoryConfigItem) => {
    if (!orgId) return;
    if (!confirm(`¿Desactivar la categoría "${category.name}"? Los tickets ya tipificados no se tocan.`)) {
      return;
    }
    try {
      await ticketService.deactivateCategory(orgId, category.id);
      toast.success('Desactivada', `Categoría "${category.name}" desactivada`);
      await load();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo desactivar la categoría'));
    }
  };

  const handleReactivate = async (category: TicketCategoryConfigItem) => {
    if (!orgId) return;
    try {
      await ticketService.updateCategory(orgId, category.id, { isActive: true });
      toast.success('Reactivada', `Categoría "${category.name}" reactivada`);
      await load();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo reactivar la categoría'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-base font-semibold">Categorías internas</h2>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-3.5 w-3.5" /> Nueva categoría
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Clasificación interna del equipo. El cliente no la elige: se asigna al tipificar el
            ticket.
          </span>
        </div>

        {categories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay categorías todavía. Creá la primera para poder tipificar tickets desde el panel
            del ticket.
          </p>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => {
              const isActive = category.isActive !== false;
              return (
                <div
                  key={category.id}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-lg border border-border p-3',
                    !isActive && 'opacity-50',
                  )}
                >
                  {/* Sin badge de criticidad: la categoría interna clasifica el
                      problema, no define urgencia ni SLA (ver nota del formulario). */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{category.name}</p>
                        {!isActive && (
                          <Badge variant="secondary" className="text-[10px]">
                            Inactiva
                          </Badge>
                        )}
                      </div>
                      {category.description && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(category)}
                      aria-label={`Editar ${category.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {isActive ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDeactivate(category)}
                        aria-label={`Desactivar ${category.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleReactivate(category)}
                        aria-label={`Reactivar ${category.name}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          La criticidad de la categoría es la del modelo viejo: solo se usa mientras el motor de
          políticas con cascada esté apagado. Con el motor activo, el SLA lo resuelve la política y
          la categoría queda como etiqueta de reporting.
        </p>
      </section>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar categoría' : 'Nueva categoría interna'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Integración de API"
                maxLength={MAX_NAME}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Para qué se usa esta categoría"
                rows={2}
                maxLength={MAX_DESCRIPTION}
                className="resize-none text-sm"
              />
            </div>
            {/*
              El selector de criticidad se OCULTA a propósito (#42 Fase 2.1).
              `TicketCategoryConfig.criticality` es una herencia del modelo viejo,
              donde la categoría que elegía el cliente determinaba la criticidad y
              con ella el SLA. En el modelo nuevo la categoría es SOLO clasificación
              interna: la criticidad la declara el cliente (o la ajusta el equipo al
              reclasificar) y el SLA lo resuelve la cascada de políticas.

              El campo NO se elimina del modelo ni del payload: lo sigue usando el
              path legacy cuando `SLA_CASCADE_ENABLED` está apagado. Se envía el
              default (`MEDIUM`) para no romper ese camino, pero pedirlo en pantalla
              hacía creer que define algo — y hoy no define nada.
            */}
            {editing && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Activa</p>
                  <p className="text-[11px] text-muted-foreground">
                    Una categoría inactiva no se ofrece al reclasificar.
                  </p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                />
              </div>
            )}
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
