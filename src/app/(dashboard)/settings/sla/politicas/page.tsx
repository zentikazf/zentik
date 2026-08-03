'use client';

import { useCallback, useEffect, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DownloadCloud,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { cn } from '@/lib/utils';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import {
  SLA_CRITICALITY_LABEL,
  type SlaCriticality,
  type SlaPolicy,
  type SlaReadiness,
} from '@/types/sla.types';

/** Tope defensivo del backend (`MAX_SLA_HOURS` en create-sla-policy.dto.ts). */
const MAX_SLA_HOURS = 8760;

/** Nombres que el backend acepta como política de fallback global (paso 5). */
const STANDARD_NAMES = ['Estándar', 'Estandar'];

const CRITICALITY_STYLE: Record<SlaCriticality, string> = {
  HIGH: 'bg-destructive/10 text-destructive',
  MEDIUM: 'bg-warning/10 text-warning',
  LOW: 'bg-muted text-muted-foreground',
};

interface PolicyForm {
  name: string;
  criticality: SlaCriticality;
  firstResponseHours: string;
  resolutionHours: string;
  pausesOnWaiting: boolean;
  isActive: boolean;
}

const EMPTY_FORM: PolicyForm = {
  name: '',
  criticality: 'MEDIUM',
  firstResponseHours: '4',
  resolutionHours: '24',
  pausesOnWaiting: false,
  isActive: true,
};

/** Horas → texto corto ("4 h", "1 d 4 h") para el resumen de la fila. */
function formatHours(hours: number): string {
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest > 0 ? `${days} d ${rest} h` : `${days} d`;
}

export default function SlaPoliciesPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [readiness, setReadiness] = useState<SlaReadiness | null>(null);

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<SlaPolicy | null>(null);
  const [form, setForm] = useState<PolicyForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      // includeInactive: las desactivadas se muestran atenuadas y se pueden
      // reactivar (misma UX que las categorías de la config actual).
      const [policiesRes, readinessRes] = await Promise.all([
        slaService.listPolicies(orgId, true),
        slaService.getReadiness(orgId),
      ]);
      setPolicies(policiesRes.data);
      setReadiness(readinessRes.data);
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudieron cargar las políticas SLA'));
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

  const openEdit = (policy: SlaPolicy) => {
    setEditing(policy);
    setForm({
      name: policy.name,
      criticality: policy.criticality,
      firstResponseHours: String(policy.firstResponseHours),
      resolutionHours: String(policy.resolutionHours),
      pausesOnWaiting: policy.pausesOnWaiting,
      isActive: policy.isActive,
    });
    setShowDialog(true);
  };

  /** Validación imperativa (el repo no usa react-hook-form). */
  const validate = (): string[] => {
    const errors: string[] = [];
    const name = form.name.trim();
    if (name.length < 2) errors.push('El nombre debe tener al menos 2 caracteres');
    if (name.length > 100) errors.push('El nombre no puede exceder 100 caracteres');

    const pairs: [string, string][] = [
      ['Horas de primera respuesta', form.firstResponseHours],
      ['Horas de resolución', form.resolutionHours],
    ];
    for (const [label, raw] of pairs) {
      const value = Number(raw);
      if (!raw.trim() || !Number.isInteger(value)) {
        errors.push(`${label}: debe ser un número entero`);
      } else if (value < 1 || value > MAX_SLA_HOURS) {
        errors.push(`${label}: debe estar entre 1 y ${MAX_SLA_HOURS}`);
      }
    }
    return errors;
  };

  const handleSave = async () => {
    if (!orgId) return;
    const errors = validate();
    if (errors.length > 0) {
      toast.error('Datos inválidos', errors.join(' · '));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        criticality: form.criticality,
        firstResponseHours: Number(form.firstResponseHours),
        resolutionHours: Number(form.resolutionHours),
        pausesOnWaiting: form.pausesOnWaiting,
      };
      if (editing) {
        await slaService.updatePolicy(orgId, editing.id, { ...payload, isActive: form.isActive });
        toast.success('Actualizada', `Política "${payload.name}" actualizada`);
      } else {
        await slaService.createPolicy(orgId, payload);
        toast.success('Creada', `Política "${payload.name}" creada`);
      }
      setShowDialog(false);
      await load();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo guardar la política'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (policy: SlaPolicy) => {
    if (!orgId) return;
    if (!confirm(`¿Desactivar la política "${policy.name}"? Los tickets ya creados no se tocan.`)) {
      return;
    }
    try {
      await slaService.deactivatePolicy(orgId, policy.id);
      toast.success('Desactivada', `Política "${policy.name}" desactivada`);
      await load();
    } catch (err) {
      // 409 SLA_POLICY_IN_USE trae el detalle de cuántos contratos/proyectos/clientes la usan.
      toast.error('No se pudo desactivar', getApiErrorMessage(err, 'Error al desactivar la política'));
    }
  };

  const handleReactivate = async (policy: SlaPolicy) => {
    if (!orgId) return;
    try {
      await slaService.updatePolicy(orgId, policy.id, { isActive: true });
      toast.success('Reactivada', `Política "${policy.name}" reactivada`);
      await load();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo reactivar la política'));
    }
  };

  const handleImport = async () => {
    if (!orgId) return;
    setImporting(true);
    try {
      const res = await slaService.importCurrentConfig(orgId);
      const { policiesCreated, typesCreated, alreadyExisting } = res.data;
      toast.success(
        'Importación completa',
        `${policiesCreated} política(s) y ${typesCreated} tipo(s) creados · ${alreadyExisting} ya existían`,
      );
      await load();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo importar la configuración actual'));
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Readiness — guardarraíl del feature flag */}
      {readiness && (
        <section
          className={cn(
            'rounded-xl border p-4',
            readiness.canEnable
              ? 'border-success/30 bg-success/5'
              : 'border-warning/40 bg-warning/5',
          )}
        >
          <div className="flex items-start gap-3">
            {readiness.canEnable ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {readiness.canEnable
                  ? 'La organización está lista para activar el motor de SLA'
                  : 'Todavía no se puede activar el motor de SLA'}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {readiness.canEnable ? (
                  <>
                    Existe la política <strong>&laquo;Estándar&raquo;</strong> que la cascada usa como
                    último recurso. Hoy hay {readiness.policiesCount} política(s) y{' '}
                    {readiness.typesCount} tipo(s) activos.
                  </>
                ) : (
                  <>
                    Falta una política activa llamada <strong>&laquo;Estándar&raquo;</strong>. Sin ella,
                    un ticket sin contrato, sin SLA de proyecto ni de cliente y sin política para su
                    criticidad quedaría <strong>sin SLA</strong>. Creala a mano o usá{' '}
                    <strong>Importar configuración actual</strong>.
                  </>
                )}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Listado */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-base font-semibold">Políticas SLA</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleImport} disabled={importing}>
              <DownloadCloud className="mr-2 h-3.5 w-3.5" />
              {importing ? 'Importando...' : 'Importar configuración actual'}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-3.5 w-3.5" /> Nueva política
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Una política define los tiempos de primera respuesta y resolución. Se asigna por contrato
          (proyecto + tipo), por proyecto o por cliente; si no hay ninguna, se cae a la política de la
          criticidad del ticket y por último a &laquo;Estándar&raquo;.
        </p>

        {policies.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay políticas todavía. Creá una o importá la configuración actual.
          </p>
        ) : (
          <div className="space-y-2">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3',
                  !policy.isActive && 'opacity-50',
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      CRITICALITY_STYLE[policy.criticality],
                    )}
                  >
                    {SLA_CRITICALITY_LABEL[policy.criticality]}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{policy.name}</p>
                      {STANDARD_NAMES.includes(policy.name) && (
                        <Badge variant="secondary" className="text-[10px]">
                          Fallback global
                        </Badge>
                      )}
                      {!policy.isActive && (
                        <Badge variant="secondary" className="text-[10px]">
                          Inactiva
                        </Badge>
                      )}
                    </div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      1ª respuesta {formatHours(policy.firstResponseHours)} · resolución{' '}
                      {formatHours(policy.resolutionHours)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(policy)}
                    aria-label={`Editar ${policy.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {policy.isActive ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDeactivate(policy)}
                      aria-label={`Desactivar ${policy.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleReactivate(policy)}
                      aria-label={`Reactivar ${policy.name}`}
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

      {/* Alta / edición */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar política SLA' : 'Nueva política SLA'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Crítico 24/7"
              />
              <p className="text-[11px] text-muted-foreground">
                Usá el nombre <strong>Estándar</strong> para la política de último recurso.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Criticidad</Label>
              <Select
                value={form.criticality}
                onValueChange={(value) =>
                  setForm({ ...form, criticality: value as SlaCriticality })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="LOW">Baja</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Si un ticket no tiene contrato ni SLA de proyecto/cliente, se usa la política de su
                criticidad.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>1ª respuesta (horas)</Label>
                <Input
                  type="number"
                  min={1}
                  max={MAX_SLA_HOURS}
                  value={form.firstResponseHours}
                  onChange={(e) => setForm({ ...form, firstResponseHours: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Resolución (horas)</Label>
                <Input
                  type="number"
                  min={1}
                  max={MAX_SLA_HOURS}
                  value={form.resolutionHours}
                  onChange={(e) => setForm({ ...form, resolutionHours: e.target.value })}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Son horas <strong>hábiles</strong>: se cuentan con el horario y los feriados de la tab
              Calendario.
            </p>
            {editing && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Activa</p>
                  <p className="text-[11px] text-muted-foreground">
                    Una política inactiva no se puede asignar ni la considera la cascada.
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
