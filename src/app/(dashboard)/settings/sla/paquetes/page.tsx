'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, Info, Package, Plus } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { cn } from '@/lib/utils';
import type { ContractPackageListItem } from '@/types/sla.types';

/**
 * Paquetes de contratos default (#58 R3.1) — el listado.
 *
 * Un paquete es un grupo con nombre de pares tipo → política que se arma UNA vez
 * y se aplica a muchos proyectos. Aplicarlo es una COPIA: editar el paquete
 * después no cambia ningún proyecto (decisión 2 del dueño).
 */
export default function ContractPackagesPage() {
  const { orgId } = useOrg();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<ContractPackageListItem[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await slaService.listPackages(orgId, true);
      setPackages(res.data);
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudieron cargar los paquetes'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!orgId) return;
    const name = form.name.trim();
    if (name.length < 2) {
      toast.error('Datos inválidos', 'El nombre debe tener al menos 2 caracteres');
      return;
    }

    setSaving(true);
    try {
      const res = await slaService.createPackage(orgId, {
        name,
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      toast.success('Paquete creado', `Ahora elegí qué tipos trae "${name}"`);
      setShowCreate(false);
      setForm({ name: '', notes: '' });
      // Un paquete nace vacío: el paso siguiente es llenarlo, así que se entra
      // directo al editor en vez de dejarlo en una lista sin nada que mostrar.
      router.push(`/settings/sla/paquetes/${res.data.id}`);
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo crear el paquete'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Paquetes de contratos</h2>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Nuevo paquete
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Un paquete se arma una vez y se aplica a muchos proyectos. Aplicarlo es una{' '}
            <strong>copia</strong>: se crean los contratos del proyecto y ahí se corta la relación.
            Editar el paquete <strong>no cambia</strong> los proyectos que ya lo recibieron — para
            eso está el botón de re-aplicar.
          </span>
        </div>

        {packages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Todavía no hay paquetes. Creá el primero para dejar un proyecto nuevo configurado de
            una sola vez.
          </p>
        ) : (
          <div className="space-y-2">
            {packages.map((pkg) => (
              <Link
                key={pkg.id}
                href={`/settings/sla/paquetes/${pkg.id}`}
                className={cn(
                  'group flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/50 hover:bg-accent/40',
                  !pkg.isActive && 'opacity-50',
                )}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{pkg.name}</p>
                    {!pkg.isActive && (
                      <Badge variant="secondary" className="text-[10px]">
                        Archivado
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {pkg.itemCount} tipo{pkg.itemCount === 1 ? '' : 's'}
                    </Badge>
                    {pkg.usedInProjects > 0 && (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        usado en {pkg.usedInProjects} proyecto
                        {pkg.usedInProjects === 1 ? '' : 's'}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {pkg.branches.length > 0
                      ? pkg.branches.map((b) => `${b.name} (${b.count})`).join(' · ')
                      : 'Sin tipos todavía'}
                    {pkg.notes && ` — ${pkg.notes}`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo paquete de contratos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Soporte estándar"
              />
              <p className="text-[11px] text-muted-foreground">
                Único dentro de la organización.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nota (opcional)</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Para qué sirve este paquete"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              El paquete nace vacío: en el paso siguiente elegís qué tipos trae y con qué política.
            </p>
            <Button className="w-full" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creando...' : 'Crear y elegir tipos'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
