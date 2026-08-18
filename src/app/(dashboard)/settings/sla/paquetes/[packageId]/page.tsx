'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Info, Pencil, RefreshCw } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import type {
  ContractPackageApplicationRow,
  ContractPackageDetail,
  ProjectContractItemInput,
  SlaPolicy,
} from '@/types/sla.types';
import { useCanManageSla } from '@/components/sla/use-can-manage-sla';
import { ContractTreeEditor } from '@/components/sla/contract-tree-editor';
import { ApplyContractPackageDialog } from '@/components/sla/apply-contract-package-dialog';

/**
 * El editor de UN paquete de contratos (#58 R3.1 / T5).
 *
 * Consume el MISMO `ContractTreeEditor` que el centro de contratación, **sin el
 * ojito**: `clientVisible` es un campo del TIPO, global a la organización, y un
 * paquete que lo llevara cambiaría el catálogo de toda la org al aplicarse.
 *
 * Lo único que cambia respecto del proyecto es qué significa destildar: acá saca
 * el tipo del paquete (borra la fila) y no toca ningún proyecto.
 */
export default function ContractPackageEditorPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const { orgId } = useOrg();
  const canManageSla = useCanManageSla();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ContractPackageDetail | null>(null);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [saving, setSaving] = useState(false);

  const [showRename, setShowRename] = useState(false);
  const [form, setForm] = useState({ name: '', notes: '' });
  const [savingHeader, setSavingHeader] = useState(false);

  // ── Re-aplicar (#58 R6) ────────────────────────────────────────────────────
  const [showReapply, setShowReapply] = useState(false);
  const [applications, setApplications] = useState<ContractPackageApplicationRow[]>([]);
  const [reapplyTarget, setReapplyTarget] = useState<ContractPackageApplicationRow | null>(null);

  const load = useCallback(async () => {
    if (!orgId || !canManageSla) return;
    try {
      const [packageRes, policiesRes] = await Promise.all([
        slaService.getPackage(orgId, packageId),
        slaService.listPolicies(orgId),
      ]);
      setData(packageRes.data);
      setPolicies(policiesRes.data);
      setForm({
        name: packageRes.data.package.name,
        notes: packageRes.data.package.notes ?? '',
      });
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo cargar el paquete'));
    } finally {
      setLoading(false);
    }
  }, [orgId, packageId, canManageSla]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Guardar los ítems. Después del PUT, si el paquete ya se usó, se OFRECE
   * re-aplicarlo (R6.1) — nunca se hace solo (R6.3). Editar un paquete no toca
   * ningún proyecto: esa es la decisión 2 del dueño y no se negocia acá.
   */
  const handleSave = async (payload: ProjectContractItemInput[]) => {
    if (!orgId) return;

    setSaving(true);
    try {
      const res = await slaService.upsertPackageItems(orgId, packageId, { items: payload });
      setData(res.data);
      toast.success('Paquete guardado', `${payload.length} tipo(s) actualizados`);

      if (res.data.package.usedInProjects > 0) {
        const applicationsRes = await slaService.listPackageApplications(orgId, packageId);
        setApplications(applicationsRes.data);
        setShowReapply(true);
      }
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo guardar el paquete'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHeader = async () => {
    if (!orgId || !data) return;
    const name = form.name.trim();
    if (name.length < 2) {
      toast.error('Datos inválidos', 'El nombre debe tener al menos 2 caracteres');
      return;
    }

    setSavingHeader(true);
    try {
      await slaService.updatePackage(orgId, packageId, { name, notes: form.notes.trim() });
      setData({ ...data, package: { ...data.package, name, notes: form.notes.trim() || null } });
      toast.success('Paquete actualizado', `"${name}" guardado`);
      setShowRename(false);
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo actualizar el paquete'));
    } finally {
      setSavingHeader(false);
    }
  };

  const handleToggleActive = async (next: boolean) => {
    if (!orgId || !data) return;
    try {
      await slaService.updatePackage(orgId, packageId, { isActive: next });
      setData({ ...data, package: { ...data.package, isActive: next } });
      toast.success(
        next ? 'Paquete activo' : 'Paquete archivado',
        next
          ? 'Vuelve a ofrecerse para aplicar.'
          : 'Deja de ofrecerse para aplicar. Los proyectos que ya lo recibieron no cambian.',
      );
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo archivar el paquete'));
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!canManageSla) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No tenés permisos para configurar el SLA.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">No se pudo cargar el paquete.</p>
        <Link href="/settings/sla/paquetes" className="text-sm text-primary hover:underline">
          Volver a Paquetes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-5 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Link href="/settings/sla/paquetes">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-foreground">
                  {data.package.name}
                </h2>
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {data.package.itemCount} tipo{data.package.itemCount === 1 ? '' : 's'}
                </Badge>
                {data.package.usedInProjects > 0 && (
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    usado en {data.package.usedInProjects} proyecto
                    {data.package.usedInProjects === 1 ? '' : 's'}
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {data.package.notes || 'Sin nota'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2" title="Un paquete archivado no se ofrece para aplicar">
              <span className="text-[11px] text-muted-foreground">Activo</span>
              <Switch
                checked={data.package.isActive}
                onCheckedChange={handleToggleActive}
                aria-label="Paquete activo"
              />
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setShowRename(true)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Editar
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Este paquete lleva <strong>solo tipos y políticas</strong>. No incluye el SLA propio
            del proyecto ni la visibilidad de los tipos: el ojito es un campo del tipo, global a la
            organización, y un paquete que lo llevara cambiaría el catálogo de todos los proyectos.
          </span>
        </div>
      </section>

      <ContractTreeEditor
        items={data.items}
        policies={policies}
        saving={saving}
        onSave={handleSave}
        title="Tipos que trae el paquete"
        footerNote={
          <>
            Destildar un tipo lo <strong>saca del paquete</strong>. No toca ningún proyecto: los
            que ya lo recibieron quedan como están.
          </>
        }
      />

      {/* ── Editar nombre / nota ────────────────────────────────────────── */}
      <Dialog open={showRename} onOpenChange={setShowRename}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar paquete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nota</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Para qué sirve este paquete"
              />
            </div>
            <Button className="w-full" onClick={handleSaveHeader} disabled={savingHeader}>
              {savingHeader ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Re-aplicar (#58 R6): se OFRECE, nunca se hace solo ──────────── */}
      <Dialog open={showReapply} onOpenChange={setShowReapply}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {applications.length} proyecto{applications.length === 1 ? '' : 's'} usa
              {applications.length === 1 ? '' : 'n'} este paquete
            </DialogTitle>
            <DialogDescription>
              Los cambios que acabás de guardar <strong>no llegaron</strong> a esos proyectos: un
              paquete se copia, no se vincula. Podés re-aplicarlo, de a uno y viendo antes qué
              cambia en cada uno.
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-[280px] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {applications.map((row) => (
              <li key={row.projectId} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {row.projectName}
                    {!row.projectIsActive && (
                      <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                        (archivado)
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Última vez: {new Date(row.lastAppliedAt).toLocaleDateString('es-PY')} ·{' '}
                    {row.lastAppliedByName}
                    {row.timesApplied > 1 && ` · ${row.timesApplied} veces`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5"
                  onClick={() => setReapplyTarget(row)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Re-aplicar
                </Button>
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReapply(false)}>
              Ahora no
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
        Un preview POR PROYECTO, con elección explícita (R6.2). Es el mismo
        diálogo de aplicar, con el paquete fijo: lo que se elige acá es a qué
        proyecto va y qué conflictos se pisan.
      */}
      {reapplyTarget && orgId && (
        <ApplyContractPackageDialog
          orgId={orgId}
          projectId={reapplyTarget.projectId}
          projectName={reapplyTarget.projectName}
          packageId={packageId}
          open
          onOpenChange={(next) => {
            if (!next) setReapplyTarget(null);
          }}
          onApplied={() => setReapplyTarget(null)}
        />
      )}
    </div>
  );
}
