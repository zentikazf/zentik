'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, ChevronDown, ChevronRight, Eye, EyeOff, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CRITICALITY_LABEL } from '@/lib/criticality';
import type {
  ProjectContractItemInput,
  ProjectSlaContract,
  SlaPolicy,
} from '@/types/sla.types';

/** Valor centinela del select: Radix no admite `value=""`. */
export const NO_POLICY = 'NONE';

/**
 * Estado del Select de una rama cuyos hijos contratados NO comparten política
 * (#48 R5.6). Es un dato HEREDADO, no una opción: se muestra y no se elige.
 * Mismo espíritu que `NO_POLICY`, pero este item va `disabled`.
 */
export const MIXED_POLICY = 'MIXED';

const INDENT_PX = 20;

/** Lo que el usuario está por guardar de una rama. */
export interface BranchDraft {
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

export interface ContractTreeEditorProps {
  /** El catálogo COMPLETO de tipos con la asignación encima (shape de `getByProject`). */
  items: ProjectSlaContract[];
  policies: SlaPolicy[];
  saving: boolean;
  /** Recibe SOLO el diff. No se llama si no hay nada válido que guardar. */
  onSave: (items: ProjectContractItemInput[]) => void | Promise<void>;
  /**
   * El ojito (#48 R5.8). **Opcional a propósito**: es un campo del TIPO, global a
   * la organización. Sin esta prop el ojito NO se renderiza — el caso del paquete
   * de contratos (#58 R2.3), que no puede tocar el catálogo de toda la org.
   */
  onToggleVisible?: (row: ProjectSlaContract, next: boolean) => void;
  /** Se inyecta al lado del botón Guardar (#58 R2.3: "Aplicar paquete"). */
  headerActions?: React.ReactNode;
  /** Default: el título del centro de contratación. */
  title?: string;
  /**
   * El pie que explica qué significa destildar. Es lo único del render que NO
   * sirve igual en las dos pantallas: en el proyecto destildar descontrata "en
   * este proyecto", en el paquete saca el tipo del paquete y no toca a nadie.
   */
  footerNote?: React.ReactNode;
}

const DEFAULT_FOOTER_NOTE = (
  <>
    Destildar un tipo <strong>descontrata de verdad</strong>: el cliente deja de verlo en este
    proyecto. Lo que no toques queda como está.
  </>
);

/**
 * El editor de árbol tipo → política (#48 R5), extraído del centro de
 * contratación para que el paquete de contratos (#58) lo REUSE en vez de
 * clonarlo.
 *
 * ── Por qué se comparte y no se copia (#58 R2.2) ────────────────────────────
 * Codifica tres invariantes contraintuitivas que un clon rompe en cuanto alguien
 * toque una sola de las dos pantallas:
 *   1. `BranchDraft.touched` — nunca reescribe una política que el usuario no tocó.
 *   2. `MIXED_POLICY` es dato heredado, no opción: el `SelectItem` va `disabled`.
 *   3. Omitir = "no lo cambies": el payload solo lleva lo que cambió.
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
export function ContractTreeEditor({
  items,
  policies,
  saving,
  onSave,
  onToggleVisible,
  headerActions,
  title = 'Tipos de solicitud contratados',
  footerNote = DEFAULT_FOOTER_NOTE,
}: ContractTreeEditorProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  /** ticketTypeId → contratado. Espejo editable de `isActive`. */
  const [checked, setChecked] = useState<Record<string, boolean>>(() => checkedFrom(items));
  /** branchKey → política elegida para la rama (+ si el usuario la tocó). */
  const [branches, setBranches] = useState<Record<string, BranchDraft>>(() => branchesFrom(items));

  /**
   * El borrador se reinicia cuando cambia lo CONTRATADO — la carga inicial y el
   * guardado —, y NO cuando cambia algo que no es contrato.
   *
   * La distinción no es cosmética: el ojito reescribe `items` (`clientVisible` es
   * parte de la fila) y rehidratar ahí tiraría a la basura los cambios sin
   * guardar. Antes de la extracción la regla era implícita: la página llamaba
   * `hydrateDraft` a mano en los dos únicos puntos donde correspondía.
   */
  const hydratedKey = useRef(contractSignatureOf(items));
  useEffect(() => {
    const signature = contractSignatureOf(items);
    if (hydratedKey.current === signature) return;
    hydratedKey.current = signature;
    setChecked(checkedFrom(items));
    setBranches(branchesFrom(items));
  }, [items]);

  // ── Estructura del árbol ───────────────────────────────────────────────────
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
  const descendantsOf = useMemo(() => {
    return (rootId: string): ProjectSlaContract[] => {
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
    };
  }, [childrenOf]);

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
  const payload = useMemo(
    () => buildPayload(items, branches, checked),
    [items, branches, checked],
  );
  const pendingCount = payload.pending;

  const handleSave = async () => {
    if (payload.error) {
      toast.error('Falta la política', payload.error);
      return;
    }
    if (payload.items.length === 0) {
      toast.success('Sin cambios', 'No hay nada nuevo para guardar.');
      return;
    }
    await onSave(payload.items);
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
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {headerActions}
          <Button onClick={handleSave} disabled={saving || pendingCount === 0} className="rounded-full">
            {saving ? 'Guardando...' : pendingCount > 0 ? `Guardar (${pendingCount})` : 'Guardar'}
          </Button>
        </div>
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
              Ningún tipo coincide con la búsqueda. El filtro es solo de vista: lo que ya
              cambiaste se guarda igual aunque lo ocultes.
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
                    onPolicy={(value) => setBranchPolicy(root.ticketTypeId, value)}
                    onToggleVisible={onToggleVisible}
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
                    onToggleVisible={onToggleVisible}
                  />
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">{footerNote}</p>
        </>
      )}
    </section>
  );
}

// ─── Helpers puros (#58 R2.4: testeables sin montar React) ───────────────────

/**
 * Los tipos que ESTA pantalla contrata: todos menos las carpetas (raíces con
 * hijos), que son cabeceras de card y no tienen check.
 *
 * Una raíz SIN hijos es una hoja suelta y sí se contrata (#48 R5.4).
 */
export function managedIdsOf(items: ProjectSlaContract[]): Set<string> {
  const withChildren = new Set(items.map((row) => row.parentId).filter(Boolean) as string[]);
  return new Set(
    items
      .filter((row) => !(row.parentId === null && withChildren.has(row.ticketTypeId)))
      .map((row) => row.ticketTypeId),
  );
}

/** Hojas sueltas: raíces SIN hijos. Se editan con su propio Select (#48 R5.4). */
export function leafIdsOf(items: ProjectSlaContract[]): Set<string> {
  const withChildren = new Set(items.map((row) => row.parentId).filter(Boolean) as string[]);
  return new Set(
    items
      .filter((row) => row.parentId === null && !withChildren.has(row.ticketTypeId))
      .map((row) => row.ticketTypeId),
  );
}

/**
 * Clave de la rama a la que pertenece una fila.
 *
 * Es el id de su RAÍZ: la política se decide una vez por rama, no por nivel
 * intermedio (decisión 7 del dueño — el padre ES una criticidad). Una hoja
 * suelta es su propia rama.
 */
export function branchKeyOf(row: ProjectSlaContract, items: ProjectSlaContract[]): string {
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

/** ticketTypeId → contratado. El borrador arranca SIENDO lo cargado. */
export function checkedFrom(items: ProjectSlaContract[]): Record<string, boolean> {
  return Object.fromEntries(items.map((row) => [row.ticketTypeId, row.isActive]));
}

/**
 * La política de cada rama se deriva de sus hijos ya contratados: una sola
 * política → esa; varias → `MIXED`; ninguno → `NO_POLICY`. Nace `touched: false`
 * porque el usuario todavía no tocó nada.
 */
export function branchesFrom(items: ProjectSlaContract[]): Record<string, BranchDraft> {
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
  return next;
}

/**
 * Huella de lo CONTRATADO. Dos `items[]` con la misma huella producen el mismo
 * borrador, así que rehidratar sería un no-op — y encima destructivo, porque
 * borraría los cambios sin guardar. Ver el efecto de rehidratación.
 */
function contractSignatureOf(items: ProjectSlaContract[]): string {
  return items
    .map((row) => `${row.ticketTypeId}:${row.isActive ? 1 : 0}:${row.slaPolicyId ?? ''}`)
    .join('|');
}

/** Lo que el editor está por mandar, y por qué el botón está (o no) habilitado. */
export interface ContractTreePayload {
  items: ProjectContractItemInput[];
  /** Cambios pendientes, INCLUIDOS los que todavía no son válidos. */
  pending: number;
  error?: string;
}

/**
 * El payload se arma DIFFEANDO el borrador contra lo cargado (#48 R5.6/R5.7).
 * Lo que el usuario no tocó no viaja — y como el backend hace upsert de lo
 * recibido y deja intacto lo omitido (#48 T1), no viajar es exactamente
 * "no lo cambies".
 */
export function buildPayload(
  items: ProjectSlaContract[],
  branches: Record<string, BranchDraft>,
  checked: Record<string, boolean>,
): ContractTreePayload {
  const out: ProjectContractItemInput[] = [];
  const managed = managedIdsOf(items);
  // Se acumulan y NO se corta: si cortáramos acá, `pending` volvería 0, el
  // botón quedaría deshabilitado y el usuario nunca vería el aviso de qué le
  // falta. El error se muestra recién al apretar Guardar.
  let invalid = 0;
  let firstError: string | undefined;

  const leaves = leafIdsOf(items);

  for (const row of items) {
    // La CARPETA (raíz con hijos) no se contrata desde acá: no tiene check, y
    // su contrato propio —si lo tiene— es dato heredado que #48 R6 manda dejar
    // VIVO. Si entrara al fan-out, elegir la política de la rama le reescribiría
    // la suya en silencio, sobre una fila que el usuario no puede ni ver marcada.
    if (!managed.has(row.ticketTypeId)) continue;

    const key = branchKeyOf(row, items);
    const branch = branches[key];

    // ── HOJA SUELTA (#48 R5.4): "igual que hoy" — el Select ES el control.
    // Sin check: dos controles para lo mismo dejaban "Sin contrato" como un
    // no-op silencioso cuando el check seguía tildado.
    if (leaves.has(row.ticketTypeId)) {
      const policyId = branch?.policyId ?? NO_POLICY;
      const wants = policyId !== NO_POLICY && policyId !== MIXED_POLICY;
      if (!wants) {
        if (row.isActive) out.push({ ticketTypeId: row.ticketTypeId, isActive: false });
      } else if (!row.isActive || policyId !== row.slaPolicyId) {
        out.push({
          ticketTypeId: row.ticketTypeId,
          slaPolicyId: policyId,
          ...(row.contractNotes ? { contractNotes: row.contractNotes } : {}),
          isActive: true,
        });
      }
      continue;
    }

    // ── HIJO DE UNA RAMA (#48 R5.5): el CHECK es el control; la política sale
    // de la cabecera (decisión 12: sin override por hijo).
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
        invalid++;
        firstError ??= `Elegí una política para "${labelOfBranch(key, items)}" antes de contratar sus tipos.`;
        continue;
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

  return { items: out, pending: out.length + invalid, error: firstError };
}

// ─── Piezas ──────────────────────────────────────────────────────────────────

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
  /**
   * En la CABECERA de una rama, "Sin contrato" es solo el estado vacío: se
   * muestra y no se elige, porque descontratar ahí se hace destildando los hijos
   * (decisión 4: el check es UN control). Elegirlo no haría nada — un no-op
   * silencioso es peor que una opción que no está.
   *
   * En una HOJA suelta sí es elegible: ahí el Select ES el control y "Sin
   * contrato" significa descontratar, igual que en la matriz vieja (R5.4).
   */
  noPolicySelectable,
}: {
  value: string;
  policies: SlaPolicy[];
  onChange: (value: string) => void;
  noPolicySelectable?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[230px] text-sm">
        <SelectValue placeholder="Sin contrato" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_POLICY} disabled={!noPolicySelectable}>
          Sin contrato
        </SelectItem>
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

/**
 * Hoja suelta (#48 R5.4): fila plana con su Select. Igual que la matriz vieja —
 * elegir una política la contrata, "Sin contrato" la descontrata.
 *
 * SIN checkbox a propósito: el check es el control de los HIJOS de una rama
 * (decisión 3). Acá sería un segundo control para lo mismo.
 */
function LeafRow({
  row,
  policies,
  draft,
  onPolicy,
  onToggleVisible,
}: {
  row: ProjectSlaContract;
  policies: SlaPolicy[];
  draft?: BranchDraft;
  onPolicy: (value: string) => void;
  onToggleVisible?: (row: ProjectSlaContract, next: boolean) => void;
}) {
  const policyId = draft?.policyId ?? NO_POLICY;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{row.ticketTypeName}</p>
        {!row.clientVisible && (
          <p className="text-[10px] text-muted-foreground">Carpeta: el cliente no la ve</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {onToggleVisible && (
          <VisibilityToggle row={row} onToggle={(value) => onToggleVisible(row, value)} />
        )}
        <PolicySelect
          value={policyId}
          policies={policies}
          onChange={onPolicy}
          noPolicySelectable
        />
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
  onToggleVisible?: (row: ProjectSlaContract, value: boolean) => void;
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
          {onToggleVisible && (
            <VisibilityToggle row={root} onToggle={(value) => onToggleVisible(root, value)} />
          )}
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
