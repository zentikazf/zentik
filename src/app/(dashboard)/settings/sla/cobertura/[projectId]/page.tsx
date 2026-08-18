'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Info } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { CRITICALITY_LABEL } from '@/lib/criticality';
import type {
  ProjectContractItemInput,
  ProjectSlaContract,
  ProjectSlaContractsResponse,
  SlaPolicy,
} from '@/types/sla.types';
import { useCanManageSla } from '@/components/sla/use-can-manage-sla';
import { ContractTreeEditor, NO_POLICY } from '@/components/sla/contract-tree-editor';

/**
 * NIVEL 2 — el centro de contratación (#48 R5).
 *
 * Un solo lugar para contratar (decisión 6 del dueño). La matriz plana de
 * `project-sla-section` se reemplazó en el MISMO release: dos editores del mismo
 * `PUT .../sla-contracts` con semánticas distintas son dos escritores del mismo
 * dato.
 *
 * ── Qué quedó acá y qué se fue (#58 T1) ─────────────────────────────────────
 * El árbol es `ContractTreeEditor` (`components/sla/`): lo comparte con el
 * editor de paquetes de contratos, que necesita las MISMAS tres invariantes
 * (`touched`, MIXED heredado, omitir = no lo cambies). Esta página quedó como el
 * wrapper que sabe de PROYECTO: la cascada (paso 2), el ojito —que es del tipo y
 * global a la org— y las llamadas al backend.
 */
export default function ContractCenterPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { orgId } = useOrg();
  const router = useRouter();
  const canManageSla = useCanManageSla();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProjectSlaContractsResponse | null>(null);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // ── Carga ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!orgId || !canManageSla) return;
    try {
      const [contractsRes, policiesRes] = await Promise.all([
        slaService.getProjectContracts(orgId, projectId),
        slaService.listPolicies(orgId),
      ]);
      setData(contractsRes.data);
      setPolicies(policiesRes.data);
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo cargar el proyecto'));
    } finally {
      setLoading(false);
    }
  }, [orgId, projectId, canManageSla]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * El editor manda SOLO el diff (`buildPayload`) y ya descartó el caso vacío y
   * el inválido: acá solo queda la llamada. La respuesta reemplaza `data`, y el
   * editor rehidrata su borrador porque cambió lo contratado.
   */
  const handleSave = async (payload: ProjectContractItemInput[]) => {
    if (!orgId) return;

    setSaving(true);
    try {
      const res = await slaService.upsertProjectContracts(orgId, projectId, { items: payload });
      setData(res.data);
      toast.success('Contratos guardados', `${payload.length} tipo(s) actualizados`);
      router.refresh();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudieron guardar los contratos'));
    } finally {
      setSaving(false);
    }
  };

  /** Paso 2 de la cascada. Es un PATCH escalar e idempotente: se guarda al instante. */
  const handleProjectPolicyChange = async (value: string) => {
    if (!orgId) return;
    setSavingPolicy(true);
    try {
      await slaService.assignProjectPolicy(orgId, projectId, {
        slaPolicyId: value === NO_POLICY ? null : value,
      });
      setData((prev) =>
        prev
          ? { ...prev, project: { ...prev.project, slaPolicyId: value === NO_POLICY ? null : value } }
          : prev,
      );
      toast.success(
        'SLA del proyecto actualizado',
        value === NO_POLICY
          ? 'El proyecto vuelve a heredar el SLA del cliente'
          : 'Se aplicará a los tickets cuyo tipo no tenga contrato',
      );
      router.refresh();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo asignar la política al proyecto'));
    } finally {
      setSavingPolicy(false);
    }
  };

  /**
   * El ojito (#48 R5.8). Es un campo del TIPO, **global a la organización**: se
   * guarda al instante y se refleja en el estado local sin recargar todo.
   */
  const handleToggleVisible = async (row: ProjectSlaContract, next: boolean) => {
    if (!orgId) return;
    try {
      await slaService.updateType(orgId, row.ticketTypeId, { clientVisible: next });
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((r) =>
                r.ticketTypeId === row.ticketTypeId ? { ...r, clientVisible: next } : r,
              ),
            }
          : prev,
      );
      toast.success(
        next ? 'Tipo visible para el cliente' : 'Convertido en carpeta',
        next
          ? `"${row.ticketTypeName}" vuelve a ofrecerse en el portal, en TODOS los proyectos.`
          : `"${row.ticketTypeName}" deja de ofrecerse en el portal, en TODOS los proyectos. Sus hijos contratados se siguen viendo.`,
      );
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo cambiar la visibilidad del tipo'));
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
        <p className="text-sm text-muted-foreground">No se pudo cargar el proyecto.</p>
        <Link href="/settings/sla/cobertura" className="text-sm text-primary hover:underline">
          Volver a Cobertura
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header (#48 R5.3) ─────────────────────────────────────────────── */}
      <section className="space-y-5 rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <Link href="/settings/sla/cobertura">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">{data.project.name}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {data.project.client?.name ?? 'Sin cliente'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">SLA propio del proyecto</Label>
          <Select
            value={data.project.slaPolicyId ?? NO_POLICY}
            onValueChange={handleProjectPolicyChange}
            disabled={savingPolicy}
          >
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Sin SLA propio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_POLICY}>Sin SLA propio (hereda del cliente)</SelectItem>
              {policies.map((policy) => (
                <SelectItem key={policy.id} value={policy.id}>
                  {policy.name} · {CRITICALITY_LABEL[policy.criticality]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Se aplica a los tickets de este proyecto cuyo tipo no tenga contrato. Se guarda al
            instante.
          </p>
        </div>

        {/*
          Regla contraintuitiva y DELIBERADA del backend (paridad con OSD): la
          cascada y la disponibilidad buscan el `ticketTypeId` tal cual, sin trepar
          por los ancestros. Esta pantalla hace el fan-out — crea una fila por hijo
          tildado —, pero el DATO sigue siendo exacto. Se avisa acá porque una card
          con un Select en la cabecera invita justo a suponer lo contrario.
        */}
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Los contratos son <strong>por tipo exacto</strong>: contratar una carpeta NO cubre a sus
            hijos. La política que elegís en la carpeta se copia a cada hijo que tildes.
          </span>
        </div>
      </section>

      {/* ── Árbol ─────────────────────────────────────────────────────────── */}
      <ContractTreeEditor
        items={data.items}
        policies={policies}
        saving={saving}
        onSave={handleSave}
        onToggleVisible={handleToggleVisible}
      />
    </div>
  );
}
