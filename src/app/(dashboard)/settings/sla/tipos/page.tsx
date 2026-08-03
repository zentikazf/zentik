'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Pencil, Plus, RotateCcw, Tags, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { cn } from '@/lib/utils';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import type { TicketType } from '@/types/sla.types';

interface TypeForm {
  name: string;
  slug: string;
  isActive: boolean;
}

const EMPTY_FORM: TypeForm = { name: '', slug: '', isActive: true };

/** Mismo formato que acepta el backend (`^[a-z0-9]+(-[a-z0-9]+)*$`). */
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export default function TicketTypesPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<TicketType[]>([]);

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<TicketType | null>(null);
  const [form, setForm] = useState<TypeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await slaService.listTypes(orgId, true);
      setTypes(res.data);
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudieron cargar los tipos de solicitud'));
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

  const openEdit = (type: TicketType) => {
    setEditing(type);
    setForm({ name: type.name, slug: type.slug, isActive: type.isActive });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!orgId) return;
    const name = form.name.trim();
    const slug = form.slug.trim();
    const errors: string[] = [];
    if (name.length < 2) errors.push('El nombre debe tener al menos 2 caracteres');
    if (name.length > 100) errors.push('El nombre no puede exceder 100 caracteres');
    if (slug && !SLUG_REGEX.test(slug)) {
      errors.push('El identificador solo admite minúsculas, números y guiones');
    }
    if (errors.length > 0) {
      toast.error('Datos inválidos', errors.join(' · '));
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await slaService.updateType(orgId, editing.id, {
          name,
          // Solo se manda el slug si cambió: renombrar no debe mover la clave estable.
          ...(slug && slug !== editing.slug ? { slug } : {}),
          isActive: form.isActive,
        });
        toast.success('Actualizado', `Tipo "${name}" actualizado`);
      } else {
        await slaService.createType(orgId, { name, ...(slug ? { slug } : {}) });
        toast.success('Creado', `Tipo "${name}" creado`);
      }
      setShowDialog(false);
      await load();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo guardar el tipo de solicitud'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (type: TicketType) => {
    if (!orgId) return;
    if (!confirm(`¿Desactivar el tipo "${type.name}"? Los tickets ya creados no se tocan.`)) return;
    try {
      await slaService.deactivateType(orgId, type.id);
      toast.success('Desactivado', `Tipo "${type.name}" desactivado`);
      await load();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo desactivar el tipo'));
    }
  };

  const handleReactivate = async (type: TicketType) => {
    if (!orgId) return;
    try {
      await slaService.updateType(orgId, type.id, { isActive: true });
      toast.success('Reactivado', `Tipo "${type.name}" reactivado`);
      await load();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo reactivar el tipo'));
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
            <Tags className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-base font-semibold">Tipos de solicitud</h2>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-3.5 w-3.5" /> Nuevo tipo
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          El tipo es la otra mitad del contrato: en cada proyecto se define qué política SLA aplica a
          cada tipo de solicitud. En esta fase la lista es plana.
        </p>

        {types.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay tipos todavía. Creá uno o importá la configuración actual desde la tab Políticas
            SLA.
          </p>
        ) : (
          <div className="space-y-2">
            {types.map((type) => (
              <div
                key={type.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border border-border p-3',
                  !type.isActive && 'opacity-50',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{type.name}</p>
                    {!type.isActive && (
                      <Badge variant="secondary" className="text-[10px]">
                        Inactivo
                      </Badge>
                    )}
                  </div>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{type.slug}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(type)}
                    aria-label={`Editar ${type.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {type.isActive ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDeactivate(type)}
                      aria-label={`Desactivar ${type.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleReactivate(type)}
                      aria-label={`Reactivar ${type.name}`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar tipo' : 'Nuevo tipo de solicitud'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Incidencia"
              />
            </div>
            <div className="space-y-2">
              <Label>Identificador (opcional)</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="incidencia"
              />
              <p className="text-[11px] text-muted-foreground">
                Si lo dejás vacío se genera del nombre. Solo minúsculas, números y guiones.
              </p>
            </div>
            {editing && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Activo</p>
                  <p className="text-[11px] text-muted-foreground">
                    Un tipo inactivo no entra en la matriz de contratos ni en la cobertura.
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
