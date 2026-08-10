'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Info,
  Search,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { cn } from '@/lib/utils';
import { CRITICALITY_LABEL } from '@/lib/criticality';
import type {
  ProjectContractItemInput,
  ProjectSlaContract,
  ProjectSlaContractsResponse,
  SlaPolicy,
} from '@/types/sla.types';
import { useCanManageSla } from '@/components/sla/use-can-manage-sla';

/** Valor centinela del select: Radix no admite `value=""`. */
const NO_POLICY = 'NONE';

/**
 * Estado del Select de una rama cuyos hijos contratados NO comparten política
 * (#48 R5.6). Es un dato HEREDADO, no una opción: se muestra y no se elige.
 * Mismo espíritu que `NO_POLICY`, pero este item va `disabled`.
 */
const MIXED_POLICY = 'MIXED';

const INDENT_PX = 20;

/** Lo que el usuario está por guardar de una rama. */
interface BranchDraft {
  /** `NO_POLICY` | `MIXED_POLICY` | id de política. */
  policyId: string;
  /**
   * ¿El usuario tocó el Select de esta rama?
   *
   * Es la pieza que hace verdadera la regla madre de R5.6: **la card NUNCA
   * reescribe una política que el usuario no tocó**. Sin esta bandera, guardar
   * una rama MIXED para agregar un hijo aplanaría en silencio las políticas de
   * los otros — un cambio retroactivo sobre datos de producción que nadie pidió.
   */
  touched: boolean;
}

/**
 * NIVEL 2 — el centro de contratación (#48 R5).
 *
 * Un solo lugar para contratar (decisión 6 del dueño). La matriz plana de
 * `project-sla-section` se reemplazó en el MISMO release: dos editores del mismo
 * `PUT .../sla-contracts` con semánticas distintas son dos escritores del mismo
 * dato.
 *
 * ── El modelo mental ────────────────────────────────────────────────────────
 * · El check es UN control: **contratado ⟹ visible** (decisión 4). No son dos
 *   toggles.
 * · La política se asigna EN EL PADRE y los checks deciden a qué hijos se aplica
 *   (decisión 3). No hay override por hijo (decisión 12): los hijos de una
 *   carpeta que ES una criticidad comparten política por construcción.
 * · El dato NO cambia: contratos EXACTOS, una fila por hijo. El padre no hereda
 *   nada — el fan-out lo hace esta pantalla, no el resolver (decisión 8).
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
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  /** ticketTypeId → contratado. Espejo editable de `isActive`. */
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  /** branchKey → política elegida para la rama (+ si el usuario la tocó). */
  const [branches, setBranches] = useState<Record<string, BranchDraft>>({});

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
      hydrateDraft(contractsRes.data.items);
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo cargar el proyecto'));
    } finally {
      setLoading(false);
    }
    // `hydrateDraft` es estable (solo usa setState).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, projectId, canManageSla]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * El borrador arranca SIENDO lo cargado. La política de cada rama se deriva de
   * sus hijos ya contratados: una sola política → esa; varias → `MIXED`;
   * ninguno → `NO_POLICY`.
   */
  function hydrateDraft(items: ProjectSlaContract[]) {
    setChecked(Object.fromEntries(items.map((row) => [row.ticketTypeId, row.isActive])));

    const managed = managedIdsOf(items);
    const byBranch = new Map<string, ProjectSlaContract[]>();
    for (const row of items) {
      if (!managed.has(row.ticketTypeId)) continue;
      const key = branchKeyOf(row, items);
      if (!byBranch.has(key)) byBranch.set(key, []);
      byBranch.get(key)!.push(row);
    }

    const next: Record<string, BranchDraft> = {};
    for (const [key, rows] of byBranch) {
      const policies = new Set(
        rows.filter((r) => r.isActive && r.slaPolicyId).map((r) => r.slaPolicyId as string),
      );
      next[key] = {
        policyId:
          policies.size === 0 ? NO_POLICY : policies.size === 1 ? [...policies][0] : MIXED_POLICY,
        touched: false,
      };
    }
    setBranches(next);
  }

  // ── Estructura del árbol ───────────────────────────────────────────────────
  const items = useMemo(() => data?.items ?? [], [data]);

  const childrenOf = useMemo(() => {
    const map = new Map<string, ProjectSlaContract[]>();
    for (const row of items) {
      if (!row.parentId) continue;
      if (!map.has(row.parentId)) map.set(row.parentId, []);
      map.get(row.parentId)!.push(row);
    }
    return map;
  }, [items]);

  /**
   * Toda la rama de un nodo (hijos, nietos…), ordenada por `path` — que es el
   * orden del árbol: cada hijo inmediatamente debajo de su padre.
   *
   * `seen` corta un ciclo ya persistido: imposible con las validaciones del
   * backend, pero colgar el render sale más caro que cubrirlo.
   */
  const descendantsOf = useCallback(
    (rootId: string): ProjectSlaContract[] => {
      const out: ProjectSlaContract[] = [];
      const seen = new Set<string>();
      const stack = [rootId];
      while (stack.length) {
        for (const child of childrenOf.get(stack.pop()!) ?? []) {
          if (seen.has(child.ticketTypeId)) continue;
          seen.add(child.ticketTypeId);
          out.push(child);
          stack.push(child.ticketTypeId);
        }
      }
      return out.sort((a, b) => a.path.localeCompare(b.path, 'es'));
    },
    [childrenOf],
  );

  const roots = useMemo(() => items.filter((row) => !row.parentId), [items]);

  const visibleRoots = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roots;
    // Se busca en toda la rama: escribir el nombre de un hijo trae su carpeta.
    return roots.filter((root) => {
      const branch = [root, ...descendantsOf(root.ticketTypeId)];
      return branch.some((row) => row.ticketTypeName.toLowerCase().includes(query));
    });
  }, [roots, search, descendantsOf]);

  // ── Guardado ───────────────────────────────────────────────────────────────
  /**
   * El payload se arma DIFFEANDO el borrador contra lo cargado (#48 R5.6/R5.7).
   * Lo que el usuario no tocó no viaja — y como el backend hace upsert de lo
   * recibido y deja intacto lo omitido (#48 T1), no viajar es exactamente
   * "no lo cambies".
   */
  const buildPayload = useCallback((): { items: ProjectContractItemInput[]; error?: string } => {
    const out: ProjectContractItemInput[] = [];
    const managed = managedIdsOf(items);

    for (const row of items) {
      // La CARPETA (raíz con hijos) no se contrata desde acá: no tiene check, y
      // su contrato propio —si lo tiene— es dato heredado que #48 R6 manda dejar
      // VIVO. Si entrara al fan-out, elegir la política de la rama le reescribiría
      // la suya en silencio, sobre una fila que el usuario no puede ni ver marcada.
      if (!managed.has(row.ticketTypeId)) continue;

      const key = branchKeyOf(row, items);
      const branch = branches[key];
      const isChecked = checked[row.ticketTypeId] ?? false;

      if (!isChecked) {
        // Destildar SOLO viaja si antes había contrato. Sin esto, el PUT llevaría
        // una fila `isActive: false` por cada tipo sin contratar de la org.
        if (row.isActive) {
          out.push({ ticketTypeId: row.ticketTypeId, isActive: false });
        }
        continue;
      }

      const branchPolicy = branch?.policyId ?? NO_POLICY;
      const hasRealPolicy = branchPolicy !== NO_POLICY && branchPolicy !== MIXED_POLICY;

      if (!row.isActive) {
        // Contrato NUEVO: necesita política sí o sí.
        if (!hasRealPolicy) {
          return {
            items: [],
            error: `Elegí una política para "${labelOfBranch(key, items)}" antes de contratar sus tipos.`,
          };
        }
        out.push({ ticketTypeId: row.ticketTypeId, slaPolicyId: branchPolicy, isActive: true });
        continue;
      }

      // Ya estaba contratado. Solo se reescribe si el usuario TOCÓ el Select de
      // la rama y la política nueva difiere de la suya. Si no lo tocó, la fila no
      // viaja: es la regla madre de R5.6.
      if (branch?.touched && hasRealPolicy && branchPolicy !== row.slaPolicyId) {
        out.push({
          ticketTypeId: row.ticketTypeId,
          slaPolicyId: branchPolicy,
          // Las notas no se editan acá: se reenvían para que el upsert (que
          // persiste la fila completa) no las borre.
          ...(row.contractNotes ? { contractNotes: row.contractNotes } : {}),
          isActive: true,
        });
      }
    }

    return { items: out };
  }, [items, branches, checked]);

  const pendingCount = useMemo(() => buildPayload().items.length, [buildPayload]);

  const handleSave = async () => {
    if (!orgId) return;
    const { items: payload, error } = buildPayload();
    if (error) {
      toast.error('Falta la política', error);
      return;
    }
    if (payload.length === 0) {
      toast.success('Sin cambios', 'No hay nada nuevo para guardar.');
      return;
    }

    setSaving(true);
    try {
      const res = await slaService.upsertProjectContracts(orgId, projectId, { items: payload });
      setData(res.data);
      hydrateDraft(res.data.items);
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

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setBranchPolicy = (key: string, policyId: string) =>
    setBranches((prev) => ({ ...prev, [key]: { policyId, touched: true } }));

  const setChecks = (ids: string[], value: boolean) =>
    setChecked((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, value])) }));

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
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-foreground">Tipos de solicitud contratados</h3>
          <Button onClick={handleSave} disabled={saving || pendingCount === 0} className="rounded-full">
            {saving ? 'Guardando...' : pendingCount > 0 ? `Guardar (${pendingCount})` : 'Guardar'}
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-xs text-muted-foreground">
            No hay tipos de solicitud activos.{' '}
            <Link href="/settings/sla/tipos" className="text-primary hover:underline">
              Creá el primero
            </Link>{' '}
            para poder definir contratos.
          </p>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar tipo o carpeta..."
                className="h-9 pl-8 text-sm"
                aria-label="Buscar tipo de solicitud"
              />
            </div>

            {visibleRoots.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Ningún tipo coincide con la búsqueda. Lo que no se ve no se toca al guardar.
              </p>
            ) : (
              <div className="space-y-2">
                {visibleRoots.map((root) => {
                  const branch = descendantsOf(root.ticketTypeId);
                  return branch.length === 0 ? (
                    <LeafRow
                      key={root.ticketTypeId}
                      row={root}
                      policies={policies}
                      draft={branches[root.ticketTypeId]}
                      checked={checked[root.ticketTypeId] ?? false}
                      onCheck={(value) => setChecks([root.ticketTypeId], value)}
                      onPolicy={(value) => setBranchPolicy(root.ticketTypeId, value)}
                      onToggleVisible={(value) => handleToggleVisible(root, value)}
                    />
                  ) : (
                    <BranchCard
                      key={root.ticketTypeId}
                      root={root}
                      branch={branch}
                      policies={policies}
                      draft={branches[root.ticketTypeId]}
                      checked={checked}
                      expanded={expanded.has(root.ticketTypeId)}
                      onToggleExpand={() => toggleExpanded(root.ticketTypeId)}
                      onCheck={setChecks}
                      onPolicy={(value) => setBranchPolicy(root.ticketTypeId, value)}
                      onToggleVisible={handleToggleVisible}
                    />
                  );
                })}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Destildar un tipo <strong>descontrata de verdad</strong>: el cliente deja de verlo en
              este proyecto. Lo que no toques queda como está.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

// ─── Piezas ──────────────────────────────────────────────────────────────────

/**
 * Clave de la rama a la que pertenece una fila.
 *
 * Es el id de su RAÍZ: la política se decide una vez por rama, no por nivel
 * intermedio (decisión 7 del dueño — el padre ES una criticidad). Una hoja
 * suelta es su propia rama.
 */
/**
 * Los tipos que ESTA pantalla contrata: todos menos las carpetas (raíces con
 * hijos), que son cabeceras de card y no tienen check.
 *
 * Una raíz SIN hijos es una hoja suelta y sí se contrata (#48 R5.4).
 */
function managedIdsOf(items: ProjectSlaContract[]): Set<string> {
  const withChildren = new Set(items.map((row) => row.parentId).filter(Boolean) as string[]);
  return new Set(
    items
      .filter((row) => !(row.parentId === null && withChildren.has(row.ticketTypeId)))
      .map((row) => row.ticketTypeId),
  );
}

function branchKeyOf(row: ProjectSlaContract, items: ProjectSlaContract[]): string {
  let current = row;
  let hops = 0;
  while (current.parentId && hops < 5) {
    const parent = items.find((r) => r.ticketTypeId === current.parentId);
    if (!parent) break;
    current = parent;
    hops++;
  }
  return current.ticketTypeId;
}

function labelOfBranch(key: string, items: ProjectSlaContract[]): string {
  return items.find((r) => r.ticketTypeId === key)?.ticketTypeName ?? 'esta rama';
}

/** El ojito, con el aviso de que es global a la organización. */
function VisibilityToggle({
  row,
  onToggle,
}: {
  row: ProjectSlaContract;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5" title="Visible para el cliente (en TODOS los proyectos)">
      {row.clientVisible ? (
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
      ) : (
        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <Switch
        checked={row.clientVisible}
        onCheckedChange={onToggle}
        aria-label={`Visibilidad de ${row.ticketTypeName} para el cliente`}
      />
    </div>
  );
}

function PolicySelect({
  value,
  policies,
  onChange,
  disabled,
}: {
  value: string;
  policies: SlaPolicy[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-9 w-[230px] text-sm">
        <SelectValue placeholder="Sin contrato" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_POLICY}>Sin contrato</SelectItem>
        {/* Estado heredado, no una opción: se muestra y no se elige (#48 R5.6). */}
        {value === MIXED_POLICY && (
          <SelectItem value={MIXED_POLICY} disabled>
            Políticas mixtas
          </SelectItem>
        )}
        {policies.map((policy) => (
          <SelectItem key={policy.id} value={policy.id}>
            {policy.name} · {CRITICALITY_LABEL[policy.criticality]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Hoja suelta (#48 R5.4): fila plana con su Select. Igual que la matriz vieja. */
function LeafRow({
  row,
  policies,
  draft,
  checked,
  onCheck,
  onPolicy,
  onToggleVisible,
}: {
  row: ProjectSlaContract;
  policies: SlaPolicy[];
  draft?: BranchDraft;
  checked: boolean;
  onCheck: (value: boolean) => void;
  onPolicy: (value: string) => void;
  onToggleVisible: (value: boolean) => void;
}) {
  const policyId = draft?.policyId ?? NO_POLICY;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheck(value === true)}
          aria-label={`Contratar ${row.ticketTypeName}`}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.ticketTypeName}</p>
          {!row.clientVisible && (
            <p className="text-[10px] text-muted-foreground">Carpeta: el cliente no la ve</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <VisibilityToggle row={row} onToggle={onToggleVisible} />
        <PolicySelect value={policyId} policies={policies} onChange={onPolicy} disabled={!checked} />
      </div>
    </div>
  );
}

/**
 * Nodo con hijos (#48 R5.5): card colapsable con el ojito, el Select de la rama,
 * el contador y "Tildar todos". Al desplegar, un check por descendiente
 * indentado por `level`.
 */
function BranchCard({
  root,
  branch,
  policies,
  draft,
  checked,
  expanded,
  onToggleExpand,
  onCheck,
  onPolicy,
  onToggleVisible,
}: {
  root: ProjectSlaContract;
  branch: ProjectSlaContract[];
  policies: SlaPolicy[];
  draft?: BranchDraft;
  checked: Record<string, boolean>;
  expanded: boolean;
  onToggleExpand: () => void;
  onCheck: (ids: string[], value: boolean) => void;
  onPolicy: (value: string) => void;
  onToggleVisible: (row: ProjectSlaContract, value: boolean) => void;
}) {
  const policyId = draft?.policyId ?? NO_POLICY;
  const isMixed = policyId === MIXED_POLICY;

  const contractedChildren = branch.filter((row) => checked[row.ticketTypeId]).length;
  const allChecked = contractedChildren === branch.length && branch.length > 0;

  /**
   * Desglose de las políticas mixtas (#48 R5.6): sin esto, "Políticas mixtas" es
   * un cartel que no dice qué hay adentro y obliga a desplegar para entenderlo.
   * Se calcula sobre lo PERSISTIDO (`row.slaPolicyId`), que es lo que el usuario
   * necesita saber antes de decidir si lo pisa.
   */
  const breakdown = useMemo(() => {
    if (!isMixed) return [];
    const counts = new Map<string, number>();
    for (const row of branch) {
      if (!row.isActive || !row.slaPolicyName) continue;
      counts.set(row.slaPolicyName, (counts.get(row.slaPolicyName) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [isMixed, branch]);

  return (
    <div className="rounded-lg border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Colapsar' : 'Expandir'} ${root.ticketTypeName}`}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{root.ticketTypeName}</p>
            <p className="text-[10px] text-muted-foreground">
              {contractedChildren}/{branch.length} tipo{branch.length === 1 ? '' : 's'} contratado
              {contractedChildren === 1 ? '' : 's'}
              {!root.clientVisible && ' · carpeta (el cliente no la ve)'}
              {/* #48 R6: un contrato sobre la carpeta queda VIVO y sigue
                  resolviendo. Se muestra para que no sea un estado invisible. */}
              {root.isActive && root.slaPolicyName && ` · la carpeta tiene contrato propio (${root.slaPolicyName})`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <VisibilityToggle row={root} onToggle={(value) => onToggleVisible(root, value)} />
          <PolicySelect value={policyId} policies={policies} onChange={onPolicy} />
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => onCheck(branch.map((row) => row.ticketTypeId), !allChecked)}
          >
            {allChecked ? 'Destildar todos' : 'Tildar todos'}
          </Button>
        </div>
      </div>

      {isMixed && (
        <div className="mx-3 mb-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-2.5 text-[11px] text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <span>
            Esta rama tiene políticas distintas:{' '}
            {breakdown.map(([name, count], i) => (
              <span key={name}>
                {i > 0 && ' · '}
                <strong>{count}</strong> con {name}
              </span>
            ))}
            . Elegir una política acá las <strong>reemplaza en todos los tipos tildados</strong>. Si
            no tocás el selector, cada uno conserva la suya.
          </span>
        </div>
      )}

      {expanded && (
        <div className="space-y-1 border-t border-border p-3">
          {branch.map((row) => (
            <div
              key={row.ticketTypeId}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-accent/40"
              // La sangría sale del `level` del backend, no del anidado del DOM.
              style={{ marginLeft: (row.level - root.level - 1) * INDENT_PX }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Checkbox
                  checked={checked[row.ticketTypeId] ?? false}
                  onCheckedChange={(value) => onCheck([row.ticketTypeId], value === true)}
                  aria-label={`Contratar ${row.ticketTypeName}`}
                />
                <span className="truncate text-sm">{row.ticketTypeName}</span>
                {!row.clientVisible && (
                  <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                    <EyeOff className="h-3 w-3" />
                    Carpeta
                  </Badge>
                )}
              </div>
              {/* Cada hijo muestra su política REAL (#48 R5.6): con la rama en
                  MIXED es la única forma de saber cuál se va a pisar. */}
              <span
                className={cn(
                  'shrink-0 text-[11px]',
                  row.isActive ? 'text-muted-foreground' : 'text-muted-foreground/60',
                )}
              >
                {row.isActive && row.slaPolicyName ? row.slaPolicyName : 'Sin contrato'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
