'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import {
  SLA_CRITICALITY_LABEL,
  type ProjectContractItemInput,
  type ProjectSlaContractsResponse,
  type SlaPolicy,
} from '@/types/sla.types';
import { useCanManageSla } from './use-can-manage-sla';

/** Valor centinela del select: Radix no admite `value=""`. */
const NO_POLICY = 'NONE';

/**
 * SLA del proyecto (#42 Fase 1): política propia (paso 2 de la cascada) +
 * matriz tipo → política (paso 1, los contratos).
 *
 * La política propia se guarda al instante (un solo campo); la matriz tiene
 * botón de guardado porque el backend la persiste completa en una transacción.
 */
export function ProjectSlaSection({ projectId }: { projectId: string }) {
  const { orgId } = useOrg();
  const router = useRouter();
  const canManageSla = useCanManageSla();

  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [contracts, setContracts] = useState<ProjectSlaContractsResponse | null>(null);
  /** Borrador de la matriz: ticketTypeId → policyId | NO_POLICY. */
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);

  const load = useCallback(async () => {
    if (!orgId || !canManageSla) return;
    try {
      const [policiesRes, contractsRes] = await Promise.all([
        slaService.listPolicies(orgId),
        slaService.getProjectContracts(orgId, projectId),
      ]);
      setPolicies(policiesRes.data);
      setContracts(contractsRes.data);
      setDraft(
        Object.fromEntries(
          contractsRes.data.items.map((item) => [item.ticketTypeId, item.slaPolicyId ?? NO_POLICY]),
        ),
      );
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo cargar el SLA del proyecto'));
    } finally {
      setLoading(false);
    }
  }, [orgId, projectId, canManageSla]);

  useEffect(() => {
    load();
  }, [load]);

  // El backend gatea la configuración de SLA por rol: para el resto la sección no existe.
  if (!canManageSla) return null;

  const handleProjectPolicyChange = async (value: string) => {
    if (!orgId) return;
    setSavingPolicy(true);
    try {
      await slaService.assignProjectPolicy(orgId, projectId, {
        slaPolicyId: value === NO_POLICY ? null : value,
      });
      toast.success(
        'SLA del proyecto actualizado',
        value === NO_POLICY
          ? 'El proyecto vuelve a heredar el SLA del cliente'
          : 'Se aplicará a los tickets sin contrato para su tipo',
      );
      await load();
      router.refresh();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo asignar la política al proyecto'));
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleSaveMatrix = async () => {
    if (!orgId || !contracts) return;

    const items: ProjectContractItemInput[] = [];
    for (const row of contracts.items) {
      const selected = draft[row.ticketTypeId] ?? NO_POLICY;
      if (selected !== NO_POLICY) {
        items.push({
          ticketTypeId: row.ticketTypeId,
          slaPolicyId: selected,
          // Las notas del contrato no se editan en esta fase: se reenvían para
          // que el upsert (que persiste la fila completa) no las borre.
          ...(row.contractNotes ? { contractNotes: row.contractNotes } : {}),
          isActive: true,
        });
      } else if (row.contractId && row.slaPolicyId) {
        // Sacar la política de un tipo que YA tenía contrato = desactivarlo
        // (el backend exige `slaPolicyId` en cada fila, se manda el vigente).
        items.push({
          ticketTypeId: row.ticketTypeId,
          slaPolicyId: row.slaPolicyId,
          isActive: false,
        });
      }
    }

    if (items.length === 0) {
      toast.error('Sin cambios', 'Elegí al menos una política para guardar la matriz');
      return;
    }

    setSavingMatrix(true);
    try {
      const res = await slaService.upsertProjectContracts(orgId, projectId, { items });
      setContracts(res.data);
      setDraft(
        Object.fromEntries(
          res.data.items.map((item) => [item.ticketTypeId, item.slaPolicyId ?? NO_POLICY]),
        ),
      );
      toast.success('Contratos guardados', `${items.length} tipo(s) actualizados`);
      router.refresh();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudieron guardar los contratos'));
    } finally {
      setSavingMatrix(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  const coverage = contracts?.coverage;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">SLA del proyecto</h2>
          <p className="text-xs text-muted-foreground">
            Primero manda el contrato del tipo; si no hay, se usa el SLA propio del proyecto y luego
            el del cliente.
          </p>
        </div>
      </div>

      {policies.length === 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            La organización todavía no tiene políticas SLA activas. Creá al menos una en{' '}
            <Link href="/settings/sla/politicas" className="text-primary hover:underline">
              Configuración → SLA
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SLA propio del proyecto */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">SLA propio del proyecto</p>
            <Select
              value={contracts?.project.slaPolicyId ?? NO_POLICY}
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
                    {policy.name} · {SLA_CRITICALITY_LABEL[policy.criticality]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Se aplica a los tickets de este proyecto cuyo tipo no tenga contrato.
            </p>
          </div>

          {/* Matriz tipo → política */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Contratos por tipo de solicitud</p>
              {coverage && coverage.totalTypes > 0 && (
                <Badge variant={coverage.isComplete ? 'success' : 'warning'} className="text-[10px]">
                  {coverage.isComplete ? (
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                  ) : (
                    <AlertTriangle className="mr-1 h-3 w-3" />
                  )}
                  {coverage.coveredTypes}/{coverage.totalTypes} con contrato
                </Badge>
              )}
            </div>

            {!contracts || contracts.items.length === 0 ? (
              <p className="rounded-lg border border-border p-4 text-xs text-muted-foreground">
                No hay tipos de solicitud activos.{' '}
                <Link href="/settings/sla/tipos" className="text-primary hover:underline">
                  Creá el primero
                </Link>{' '}
                para poder definir contratos.
              </p>
            ) : (
              <>
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo de solicitud</TableHead>
                        <TableHead className="w-[280px]">Política SLA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.items.map((row) => (
                        <TableRow key={row.ticketTypeId}>
                          <TableCell className="font-medium">{row.ticketTypeName}</TableCell>
                          <TableCell>
                            <Select
                              value={draft[row.ticketTypeId] ?? NO_POLICY}
                              onValueChange={(value) =>
                                setDraft((prev) => ({ ...prev, [row.ticketTypeId]: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Sin contrato" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_POLICY}>Sin contrato</SelectItem>
                                {policies.map((policy) => (
                                  <SelectItem key={policy.id} value={policy.id}>
                                    {policy.name} · {SLA_CRITICALITY_LABEL[policy.criticality]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button onClick={handleSaveMatrix} disabled={savingMatrix} className="rounded-full">
                  {savingMatrix ? 'Guardando...' : 'Guardar contratos'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
