'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { AlertTriangle, CheckCircle2, Info, Search, ShieldCheck } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { buildTicketTypeAncestorNames, ticketTypeContext } from '@/lib/ticket-type-path';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { CRITICALITY_LABEL } from '@/lib/criticality';
import type {
  ProjectContractItemInput,
  ProjectSlaContractsResponse,
  SlaPolicy,
  TicketType,
} from '@/types/sla.types';
import { useCanManageSla } from './use-can-manage-sla';

/** Valor centinela del select: Radix no admite `value=""`. */
const NO_POLICY = 'NONE';

/** Filtro de la matriz por estado de contrato (#42 Fase 2.1). */
type ContractFilter = 'ALL' | 'WITH' | 'WITHOUT';

const CONTRACT_FILTER_LABEL: Record<ContractFilter, string> = {
  ALL: 'Todos',
  WITH: 'Con contrato',
  WITHOUT: 'Sin contrato',
};

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
  /**
   * Catálogo de tipos, SOLO para mostrar el camino del padre en la matriz
   * (#42 Fase 3): las filas de contratos traen `ticketTypeName` pelado y con un
   * árbol hay homónimos en ramas distintas ("Error del sistema" bajo Incidencia
   * y bajo Consulta). No participa del guardado.
   */
  const [types, setTypes] = useState<TicketType[]>([]);
  /** Borrador de la matriz: ticketTypeId → policyId | NO_POLICY. */
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);
  /** Filtros de la matriz. Son SOLO de vista: no tocan `draft` ni lo que se guarda. */
  const [search, setSearch] = useState('');
  const [contractFilter, setContractFilter] = useState<ContractFilter>('ALL');

  /**
   * @param preserveDraft no pisar las selecciones de la matriz que el usuario aún
   *   no guardó. Se usa al cambiar el SLA propio del proyecto: ese flujo recarga
   *   para reflejar el cambio, pero sin `preserveDraft` borraba en silencio lo que
   *   el usuario venía eligiendo en la matriz.
   */
  const load = useCallback(async (opts?: { preserveDraft?: boolean }) => {
    if (!orgId || !canManageSla) return;
    try {
      const [policiesRes, contractsRes, typesRes] = await Promise.all([
        slaService.listPolicies(orgId),
        slaService.getProjectContracts(orgId, projectId),
        // El árbol de tipos es SOLO contexto visual: si falla, la matriz se
        // pinta igual con los nombres pelados (degradación, no error).
        slaService.listTypes(orgId).catch(() => null),
      ]);
      setPolicies(policiesRes.data);
      setContracts(contractsRes.data);
      setTypes(Array.isArray(typesRes?.data) ? typesRes.data : []);
      if (!opts?.preserveDraft) {
        setDraft(
          Object.fromEntries(
            contractsRes.data.items.map((item) => [item.ticketTypeId, item.slaPolicyId ?? NO_POLICY]),
          ),
        );
      }
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo cargar el SLA del proyecto'));
    } finally {
      setLoading(false);
    }
  }, [orgId, projectId, canManageSla]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Vista filtrada de la matriz (#42 Fase 2.1). Con ~100 tipos la tabla es
   * interminable, así que se filtra por nombre y por estado de contrato.
   *
   * ⚠️ INVARIANTE: esto es SOLO presentación. `handleSaveMatrix` arma el payload
   * recorriendo `contracts.items` (la lista COMPLETA) y leyendo `draft`, que
   * tampoco se toca al filtrar. Así, ocultar filas NO desactiva ni pierde los
   * contratos de los tipos no visibles. No cambiar el guardado para que use esta
   * lista: sería exactamente el bug que este filtro debe evitar.
   */
  const allItems = useMemo(() => contracts?.items ?? [], [contracts]);

  const ancestorNames = useMemo(() => buildTicketTypeAncestorNames(types), [types]);

  /** Camino del padre (`"Incidencia"`), o cadena vacía si el tipo es raíz. */
  const typeContext = useCallback(
    (ticketTypeId: string) => ticketTypeContext(ancestorNames, ticketTypeId),
    [ancestorNames],
  );

  const hasContract = useCallback(
    (ticketTypeId: string) => (draft[ticketTypeId] ?? NO_POLICY) !== NO_POLICY,
    [draft],
  );

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allItems.filter((row) => {
      // Se busca también por el camino del padre: escribir "incidencia" trae la
      // rama entera, no solo el tipo que se llama así.
      const haystack = `${typeContext(row.ticketTypeId)} ${row.ticketTypeName}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (contractFilter === 'WITH') return hasContract(row.ticketTypeId);
      if (contractFilter === 'WITHOUT') return !hasContract(row.ticketTypeId);
      return true;
    });
  }, [allItems, search, contractFilter, hasContract, typeContext]);

  /** Se cuenta sobre el borrador, no sobre lo persistido: refleja lo que se va a guardar. */
  const draftContractCount = useMemo(
    () => allItems.filter((row) => hasContract(row.ticketTypeId)).length,
    [allItems, hasContract],
  );

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
      // preserveDraft: cambiar el SLA del proyecto no debe borrar las selecciones
      // de la matriz que el usuario todavía no guardó.
      await load({ preserveDraft: true });
      router.refresh();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo asignar la política al proyecto'));
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleSaveMatrix = async () => {
    if (!orgId || !contracts) return;

    // ⚠️ Se recorre `contracts.items` (TODOS los tipos), NUNCA la lista filtrada
    // de la vista.
    //
    // El motivo NO es el que decía este comentario hasta #48. El backend hace un
    // upsert de las filas RECIBIDAS y **lo omitido queda intacto**: no desactiva
    // nada (verificado en `SlaContractService.upsertForProject`). O sea que
    // mandar solo lo visible no borraría los contratos ocultos — simplemente no
    // los tocaría.
    //
    // Se recorre la lista completa porque desactivar es EXPLÍCITO: un tipo cuya
    // política el usuario sacó necesita viajar con `isActive: false`, y esa
    // decisión vive en `draft`, que no se filtra. Si el bucle usara la vista
    // filtrada, destildar algo y después filtrarlo perdería la desactivación.
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
        // Sacar la política de un tipo que YA tenía contrato = desactivarlo.
        // Desde #48 T1 el backend no exige `slaPolicyId` con `isActive: false`,
        // pero se sigue mandando: es el valor vigente y el backend lo ignora.
        items.push({
          ticketTypeId: row.ticketTypeId,
          slaPolicyId: row.slaPolicyId,
          isActive: false,
        });
      }
    }

    // Nada que mandar = el proyecto no tenía contratos y sigue sin tenerlos. NO es
    // un error: "todo sin contrato" es un estado válido (el ticket resuelve por el
    // SLA del proyecto/cliente/criticidad). Se avisa como info, no como fallo.
    if (items.length === 0) {
      toast.success(
        'Sin contratos por tipo',
        'Este proyecto no tiene contratos: los tickets resolverán su SLA por el proyecto, el cliente o su criticidad.',
      );
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
                    {policy.name} · {CRITICALITY_LABEL[policy.criticality]}
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
                {/*
                  ⚠️ Regla contraintuitiva y DELIBERADA del backend (paridad con
                  OSD): la cascada de SLA y la disponibilidad del portal buscan el
                  `ticketTypeId` tal cual, sin trepar por los ancestros. Heredar
                  contratos haría que agregar un subtipo cambie en silencio el SLA
                  de tickets que ya estaban cubiertos. Se avisa acá porque el árbol
                  invita justo a suponer lo contrario.
                */}
                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Los contratos son <strong>por tipo exacto</strong>: contratar un tipo padre NO
                    cubre a sus hijos. Cada subtipo necesita su propia fila.
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar tipo de solicitud..."
                      className="h-9 pl-8 text-sm"
                      aria-label="Buscar tipo de solicitud"
                    />
                  </div>
                  <Select
                    value={contractFilter}
                    onValueChange={(value) => setContractFilter(value as ContractFilter)}
                  >
                    <SelectTrigger className="h-9 w-[170px] text-sm" aria-label="Filtrar por contrato">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CONTRACT_FILTER_LABEL) as ContractFilter[]).map((value) => (
                        <SelectItem key={value} value={value}>
                          {CONTRACT_FILTER_LABEL[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  {visibleItems.length} de {allItems.length} tipos · {draftContractCount} con
                  contrato
                </p>

                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo de solicitud</TableHead>
                        <TableHead className="w-[280px]">Política SLA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-xs text-muted-foreground">
                            Ningún tipo coincide con el filtro. Los contratos de las filas ocultas se
                            conservan al guardar.
                          </TableCell>
                        </TableRow>
                      ) : (
                        visibleItems.map((row) => (
                          <TableRow key={row.ticketTypeId}>
                            <TableCell>
                              {/* Camino del padre como CONTEXTO, nunca como
                                  cobertura: el contrato es de este tipo exacto. */}
                              {typeContext(row.ticketTypeId) && (
                                <span className="block truncate text-[10px] text-muted-foreground">
                                  {typeContext(row.ticketTypeId)}
                                </span>
                              )}
                              <span className="font-medium">{row.ticketTypeName}</span>
                            </TableCell>
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
                                      {policy.name} · {CRITICALITY_LABEL[policy.criticality]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
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
