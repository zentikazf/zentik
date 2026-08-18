'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Check, Eye, Loader2, Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import type {
  ApplyPackagePreview,
  ApplyPackageResult,
  ContractPackageListItem,
  PackagePreviewRow,
} from '@/types/sla.types';
import { useCanManageSla } from './use-can-manage-sla';

export interface ApplyContractPackageDialogProps {
  orgId: string;
  projectId: string;
  /** Para el encabezado: "Aplicar a «Proyecto Demo»". */
  projectName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Fija el paquete y esconde el selector. Es el caso del re-aplicar (#58 R6):
   * ahí el paquete ya está decidido y lo que se elige es el proyecto.
   */
  packageId?: string;
  /** Después de aplicar con éxito. El padre recarga lo que tenga que recargar. */
  onApplied?: (result: ApplyPackageResult) => void;
  /**
   * Alta de proyecto (#58 R5.1): agrega "Omitir por ahora" con el aviso de R5.5.
   * Sin esta prop el diálogo se cierra con "Cancelar" y no promete nada.
   *
   * ⚠️ El diálogo NO se cierra solo al omitir: omitir es una decisión del flujo
   * que lo abrió (típicamente "seguí al proyecto"), y ese flujo es el que decide
   * qué pasa después. Cerrarlo también acá dispararía `onOpenChange(false)` y el
   * padre terminaría manejando el MISMO evento dos veces.
   */
  onSkip?: () => void;
}

/**
 * Aplicar un paquete de contratos a un proyecto (#58 R5).
 *
 * UN componente, tres puertas: el alta de proyecto (entre el POST y el
 * `router.push`), el centro de contratación y `ProjectSlaSection`. Y una cuarta
 * de la misma familia: el re-aplicar, con `packageId` fijo.
 *
 * ── Lo que hace y lo que NO hace ────────────────────────────────────────────
 * · El preview lo calcula el BACKEND. Acá no se decide qué es nuevo, qué está
 *   igual ni qué está distinto: se muestra.
 * · Se manda la DECISIÓN (`overwrite` por tipo), nunca el resultado del preview.
 * · **Por default no pisa nada.** El checkbox "pisar este" es lo único que
 *   autoriza tocar un contrato que ya existe y difiere.
 *
 * Gateado con `useCanManageSla()`: si el usuario no puede escribir contratos, el
 * diálogo NO EXISTE (R5.4). Un ADMIN/MANAGER crea el proyecto y simplemente no ve
 * la oferta, en vez de comerse un 403.
 */
export function ApplyContractPackageDialog({
  orgId,
  projectId,
  projectName,
  open,
  onOpenChange,
  packageId: lockedPackageId,
  onApplied,
  onSkip,
}: ApplyContractPackageDialogProps) {
  const canManageSla = useCanManageSla();

  const [packages, setPackages] = useState<ContractPackageListItem[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [selectedId, setSelectedId] = useState<string>(lockedPackageId ?? '');

  const [preview, setPreview] = useState<ApplyPackagePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [overwrite, setOverwrite] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // ── Carga del catálogo de paquetes ─────────────────────────────────────────
  useEffect(() => {
    if (!open || !orgId || !canManageSla || lockedPackageId) {
      setLoadingPackages(false);
      return;
    }
    let cancelled = false;
    setLoadingPackages(true);
    slaService
      .listPackages(orgId)
      .then((res) => {
        if (cancelled) return;
        setPackages(res.data);
        // Con un solo paquete no hay nada que elegir: se preselecciona.
        if (res.data.length === 1) setSelectedId(res.data[0].id);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error('Error', getApiErrorMessage(err, 'No se pudieron cargar los paquetes'));
      })
      .finally(() => {
        if (!cancelled) setLoadingPackages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, orgId, canManageSla, lockedPackageId]);

  // ── Preview ────────────────────────────────────────────────────────────────
  /**
   * Token del pedido en vuelo. Cambiar de paquete rápido deja dos previews
   * corriendo y el que gana es el que tarda MÁS, no el último elegido: sin esto,
   * la pantalla puede terminar mostrando los conflictos del paquete A con el
   * paquete B seleccionado — y los checkboxes autorizarían pisar sobre esa
   * lectura equivocada.
   */
  const previewRequest = useRef(0);

  const loadPreview = useCallback(
    async (packageId: string) => {
      if (!packageId) return;
      const token = ++previewRequest.current;
      setLoadingPreview(true);
      // La selección de "pisar" se descarta con cada preview nuevo: un checkbox
      // sobrevivido de otro paquete autorizaría pisar algo que el usuario no vio.
      setOverwrite(new Set());
      try {
        const res = await slaService.previewContractPackage(orgId, projectId, packageId);
        if (previewRequest.current !== token) return;
        setPreview(res.data);
      } catch (err) {
        if (previewRequest.current !== token) return;
        setPreview(null);
        toast.error('Error', getApiErrorMessage(err, 'No se pudo calcular el preview'));
      } finally {
        if (previewRequest.current === token) setLoadingPreview(false);
      }
    },
    [orgId, projectId],
  );

  useEffect(() => {
    if (!open || !selectedId || !canManageSla) return;
    loadPreview(selectedId);
  }, [open, selectedId, canManageSla, loadPreview]);

  const reset = () => {
    setSelectedId(lockedPackageId ?? '');
    setPreview(null);
    setOverwrite(new Set());
  };

  const toggleOverwrite = (ticketTypeId: string) =>
    setOverwrite((prev) => {
      const next = new Set(prev);
      if (next.has(ticketTypeId)) next.delete(ticketTypeId);
      else next.add(ticketTypeId);
      return next;
    });

  const handleApply = async () => {
    if (!preview || !selectedId) return;
    setSaving(true);
    try {
      const res = await slaService.applyContractPackage(orgId, projectId, {
        packageId: selectedId,
        // Solo viajan las decisiones POSITIVAS: no tildar es el default y no
        // necesita decirse.
        items: [...overwrite].map((ticketTypeId) => ({ ticketTypeId, overwrite: true })),
      });
      toast.success('Paquete aplicado', summarize(res.data));
      onApplied?.(res.data);
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error('No se pudo aplicar', getApiErrorMessage(err, 'Error al aplicar el paquete'));
    } finally {
      setSaving(false);
    }
  };

  // El backend es la autoridad; esto solo evita ofrecer lo que va a dar 403.
  if (!canManageSla) return null;

  const nothingToDo =
    !!preview && preview.toCreate.length === 0 && overwrite.size === 0 && !preview.isEmpty;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aplicar un paquete de contratos</DialogTitle>
          <DialogDescription>
            {projectName
              ? `Copia los tipos y políticas del paquete a "${projectName}".`
              : 'Copia los tipos y políticas del paquete al proyecto.'}{' '}
            Es una copia: después podés editar los contratos del proyecto sin tocar el paquete.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ── Elegir el paquete ─────────────────────────────────────────── */}
          {!lockedPackageId &&
            (loadingPackages ? (
              <Skeleton className="h-10 rounded-lg" />
            ) : packages.length === 0 ? (
              <div className="flex items-start gap-3 rounded-lg border border-border p-4">
                <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Todavía no hay paquetes de contratos.{' '}
                  <Link href="/settings/sla/paquetes" className="text-primary hover:underline">
                    Creá el primero
                  </Link>{' '}
                  para poder dejar un proyecto configurado de una sola vez.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Paquete</p>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí un paquete..." />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name} · {pkg.itemCount} tipo{pkg.itemCount === 1 ? '' : 's'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

          {/* ── El preview ────────────────────────────────────────────────── */}
          {loadingPreview && <Skeleton className="h-40 rounded-lg" />}

          {!loadingPreview && preview && preview.isEmpty && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                El paquete <strong>{preview.package.name}</strong> no tiene ningún tipo de
                solicitud: aplicarlo no haría nada.{' '}
                <Link
                  href={`/settings/sla/paquetes/${preview.package.id}`}
                  className="text-primary hover:underline"
                >
                  Agregale tipos
                </Link>{' '}
                antes de usarlo.
              </p>
            </div>
          )}

          {!loadingPreview && preview && !preview.isEmpty && (
            <div className="space-y-3">
              <PreviewGroup
                tone="new"
                icon={<Plus className="h-3.5 w-3.5 text-success" />}
                title={`${preview.toCreate.length} contrato${preview.toCreate.length === 1 ? '' : 's'} nuevo${preview.toCreate.length === 1 ? '' : 's'}`}
                subtitle="se van a crear"
                rows={preview.toCreate}
                renderRow={(row) => (
                  <>
                    <span className="truncate">{row.ticketTypeName}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {row.packagePolicyName}
                      {row.reactivates && ' · reactiva un contrato apagado'}
                    </span>
                  </>
                )}
              />

              <PreviewGroup
                tone="same"
                icon={<Check className="h-3.5 w-3.5 text-muted-foreground" />}
                title={`${preview.alreadySame.length} ya configurado${preview.alreadySame.length === 1 ? '' : 's'} igual`}
                subtitle="no se tocan"
                rows={preview.alreadySame}
                renderRow={(row) => (
                  <>
                    <span className="truncate">{row.ticketTypeName}</span>
                    <span className="shrink-0 text-muted-foreground">{row.packagePolicyName}</span>
                  </>
                )}
              />

              {/* Los conflictos: la única parte con control. Por default NO se pisan. */}
              {preview.different.length > 0 && (
                <div className="rounded-lg border border-warning/40 bg-warning/5">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                    <p className="text-xs font-medium text-foreground">
                      {preview.different.length} configurado
                      {preview.different.length === 1 ? '' : 's'} distinto
                      {preview.different.length === 1 ? '' : 's'}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      no se tocan salvo que los tildes
                    </span>
                  </div>
                  <ul className="max-h-[200px] divide-y divide-border overflow-y-auto border-t border-border/60">
                    {preview.different.map((row) => (
                      <li key={row.ticketTypeId} className="flex items-center gap-3 px-3 py-2.5">
                        <Checkbox
                          id={`overwrite-${row.ticketTypeId}`}
                          checked={overwrite.has(row.ticketTypeId)}
                          onCheckedChange={() => toggleOverwrite(row.ticketTypeId)}
                          aria-label={`Pisar la política de ${row.ticketTypeName}`}
                        />
                        <label
                          htmlFor={`overwrite-${row.ticketTypeId}`}
                          className="min-w-0 flex-1 cursor-pointer text-xs"
                        >
                          <span className="block truncate font-medium text-foreground">
                            {row.ticketTypeName}
                          </span>
                          <span className="block truncate text-muted-foreground">
                            tiene {row.currentPolicyName} · el paquete trae{' '}
                            {row.packagePolicyName}
                          </span>
                        </label>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {overwrite.has(row.ticketTypeId) ? 'pisar' : 'dejar'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ítems podridos: se saltan y se dicen. Nunca rompen el apply. */}
              {preview.skipped.length > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-foreground">
                    {preview.skipped.length} ítem{preview.skipped.length === 1 ? '' : 's'} omitido
                    {preview.skipped.length === 1 ? '' : 's'}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {preview.skipped.map((item) => (
                      <li key={item.ticketTypeId} className="text-[11px] text-muted-foreground">
                        <strong>{item.ticketTypeName}</strong>: {item.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {nothingToDo && (
                <p className="text-[11px] text-muted-foreground">
                  Este proyecto ya está al día con el paquete. Aplicarlo igual queda registrado,
                  pero no cambia ningún contrato.
                </p>
              )}
            </div>
          )}

          {/* ── El copy de omitir (#58 R5.5) ──────────────────────────────── */}
          {onSkip && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
              <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Si omitís, el proyecto queda <strong>sin contratos</strong>: el cliente va a ver{' '}
                <strong>todos</strong> los tipos de solicitud visibles al pedir soporte, y cada
                ticket va a resolver su SLA por el proyecto, el cliente o su criticidad. Podés
                configurarlo después desde Cobertura.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {onSkip ? (
            <Button
              variant="ghost"
              onClick={() => {
                reset();
                onSkip();
              }}
            >
              Omitir por ahora
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          <Button
            className="gap-1.5"
            onClick={handleApply}
            disabled={saving || !preview || preview.isEmpty || loadingPreview}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Package className="h-4 w-4" />
            )}
            {saving ? 'Aplicando...' : 'Aplicar paquete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Un balde del preview: cabecera con el conteo y la lista adentro. */
function PreviewGroup({
  tone,
  icon,
  title,
  subtitle,
  rows,
  renderRow,
}: {
  tone: 'new' | 'same';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  rows: PackagePreviewRow[];
  renderRow: (row: PackagePreviewRow) => React.ReactNode;
}) {
  if (rows.length === 0) return null;

  return (
    <div
      className={
        tone === 'new'
          ? 'rounded-lg border border-success/30 bg-success/5'
          : 'rounded-lg border border-border'
      }
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        {icon}
        <p className="text-xs font-medium text-foreground">{title}</p>
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
      </div>
      <ul className="max-h-[160px] divide-y divide-border overflow-y-auto border-t border-border/60">
        {rows.map((row) => (
          <li
            key={row.ticketTypeId}
            className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
          >
            {renderRow(row)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** El resumen del toast: lo que pasó, en el orden en que importa. */
function summarize(result: ApplyPackageResult): string {
  const parts: string[] = [];
  if (result.createdCount > 0) {
    parts.push(`${result.createdCount} contrato(s) nuevo(s)`);
  }
  if (result.overwrittenCount > 0) {
    parts.push(`${result.overwrittenCount} pisado(s)`);
  }
  if (result.skippedDifferentCount > 0) {
    parts.push(`${result.skippedDifferentCount} conflicto(s) sin tocar`);
  }
  if (result.skipped.length > 0) {
    parts.push(`${result.skipped.length} ítem(s) omitido(s)`);
  }
  if (parts.length === 0) {
    return `"${result.packageName}": el proyecto ya estaba al día, no cambió ningún contrato.`;
  }
  return `"${result.packageName}": ${parts.join(' · ')}.`;
}

/** Badge reutilizable para los CTA de "aplicar paquete" en los headers. */
export function ApplyPackageBadge({ count }: { count: number }) {
  return (
    <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
      <Package className="h-3 w-3" />
      {count} paquete{count === 1 ? '' : 's'}
    </Badge>
  );
}
