'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  ChevronDown,
  ChevronRight,
  Info,
  Pencil,
  Plus,
  RotateCcw,
  Tags,
  Trash2,
} from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { buildTicketTypeAncestorNames, ticketTypeFullLabel } from '@/lib/ticket-type-path';
import { cn } from '@/lib/utils';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import {
  MAX_TICKET_TYPE_DEPTH,
  MAX_TICKET_TYPE_LEVEL,
  type TicketTypeNode,
} from '@/types/sla.types';

/**
 * Catálogo de tipos de solicitud, en ÁRBOL (#42 Fase 3, paso C).
 *
 * ── Por qué no hay `Accordion` ────────────────────────────────────────────────
 * El repo NO tiene `accordion` (ni `command`) de shadcn, y el árbol tampoco es un
 * acordeón: los nodos se expanden en paralelo, la jerarquía es recursiva y cada
 * fila tiene sus propias acciones. Agregar la primitiva de Radix por esto sería
 * una dependencia nueva para un `useState<Set<string>>` + un chevron. Se resuelve
 * con estado propio (`expanded`) y un botón con `ChevronRight`/`ChevronDown`, que
 * es además lo que permite abrir/cerrar desde código (al crear un hijo se abre su
 * padre solo).
 *
 * ── Invariantes que la UI respeta, pero NO impone ─────────────────────────────
 * La autoridad es siempre el backend (`ticket-type.service.ts`). Acá se filtran
 * las opciones imposibles para no ofrecer un camino que termine en 400
 * (`TICKET_TYPE_MAX_DEPTH`, `TICKET_TYPE_CYCLE`, `TICKET_TYPE_PARENT_INACTIVE`),
 * y si aun así llega el error se muestra tal cual viene: ya está en español.
 */

/** Mismo formato que acepta el backend (`^[a-z0-9]+(-[a-z0-9]+)*$`). */
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Centinela del selector de padre: Radix Select no admite `value=""`. */
const ROOT_PARENT = 'ROOT';

/** Sangría por nivel, en px. */
const INDENT_PX = 22;

/**
 * Título del toast según el código del error. El MENSAJE lo pone el backend (ya
 * viene explicando el caso); esto solo nombra el problema de un vistazo.
 */
const TREE_ERROR_TITLE: Record<string, string> = {
  TICKET_TYPE_CYCLE: 'Movimiento inválido',
  TICKET_TYPE_MAX_DEPTH: 'Profundidad máxima',
  TICKET_TYPE_PARENT_INACTIVE: 'Tipo padre inactivo',
  TICKET_TYPE_DUPLICATE: 'Identificador duplicado',
  TICKET_TYPE_NOT_FOUND: 'Tipo no encontrado',
  TICKET_TYPE_INVALID_NAME: 'Nombre inválido',
};

function errorTitle(err: unknown): string {
  return (err instanceof ApiError && TREE_ERROR_TITLE[err.code]) || 'Error';
}

interface TypeForm {
  name: string;
  slug: string;
  isActive: boolean;
  /** Id del padre, o `ROOT_PARENT` para un tipo raíz. */
  parentId: string;
}

const EMPTY_FORM: TypeForm = { name: '', slug: '', isActive: true, parentId: ROOT_PARENT };

/** Recorrido en profundidad: la lista plana en el mismo orden en que se ve. */
function flattenTree(nodes: TicketTypeNode[]): TicketTypeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}

/** Cuántos tipos cuelgan del nodo, **él incluido** (lo que apagaría la cascada). */
function countBranch(node: TicketTypeNode): number {
  return 1 + node.children.reduce((total, child) => total + countBranch(child), 0);
}

/** Altura de la rama: 0 = hoja. Es lo que "ocupa" el nodo hacia abajo al moverlo. */
function branchHeight(node: TicketTypeNode): number {
  return node.children.length === 0
    ? 0
    : 1 + Math.max(...node.children.map((child) => branchHeight(child)));
}

interface TypeNodeRowProps {
  node: TicketTypeNode;
  expanded: Set<string>;
  onToggle: (typeId: string) => void;
  onEdit: (node: TicketTypeNode) => void;
  onAddChild: (node: TicketTypeNode) => void;
  onDeactivate: (node: TicketTypeNode) => void;
  onReactivate: (node: TicketTypeNode) => void;
}

/** Una fila del árbol + su rama (recursivo). */
function TypeNodeRow({
  node,
  expanded,
  onToggle,
  onEdit,
  onAddChild,
  onDeactivate,
  onReactivate,
}: TypeNodeRowProps) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  // Un hijo de un nodo del último nivel excedería el tope, y colgar de un tipo
  // inactivo lo rechaza el backend (`TICKET_TYPE_PARENT_INACTIVE`).
  const canAddChild = node.isActive && node.level < MAX_TICKET_TYPE_LEVEL;
  const descendants = countBranch(node) - 1;

  return (
    <div>
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg border border-border p-3',
          !node.isActive && 'opacity-50',
        )}
        // La sangría sale del `level` que ya calcula el backend, no del anidado
        // del DOM: así una rama huérfana (padre filtrado) igual se ubica bien.
        style={{ marginLeft: node.level * INDENT_PX }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => onToggle(node.id)}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? 'Colapsar' : 'Expandir'} ${node.name}`}
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : (
            // Espaciador: sin esto las hojas se corren a la izquierda y la
            // columna de nombres queda en zigzag.
            <span className="h-6 w-6 shrink-0" aria-hidden />
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">{node.name}</p>
              {!node.isActive && (
                <Badge variant="secondary" className="text-[10px]">
                  Inactivo
                </Badge>
              )}
              {hasChildren && !isOpen && (
                <Badge variant="secondary" className="text-[10px]">
                  {descendants} {descendants === 1 ? 'subtipo' : 'subtipos'}
                </Badge>
              )}
            </div>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{node.slug}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(node)}
            aria-label={`Editar ${node.name}`}
            title="Editar o mover"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onAddChild(node)}
            disabled={!canAddChild}
            aria-label={`Agregar subtipo de ${node.name}`}
            title={
              !node.isActive
                ? 'Un tipo inactivo no puede tener hijos activos'
                : node.level >= MAX_TICKET_TYPE_LEVEL
                  ? `El árbol admite ${MAX_TICKET_TYPE_DEPTH} niveles: este ya es el último`
                  : 'Agregar subtipo'
            }
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          {node.isActive ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => onDeactivate(node)}
              aria-label={`Desactivar ${node.name}`}
              title={hasChildren ? 'Desactivar la rama completa' : 'Desactivar'}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onReactivate(node)}
              aria-label={`Reactivar ${node.name}`}
              title="Reactivar"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {hasChildren && isOpen && (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <TypeNodeRow
              key={child.id}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDeactivate={onDeactivate}
              onReactivate={onReactivate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TicketTypesPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<TicketTypeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /** El auto-expandido inicial corre UNA vez: después manda el usuario. */
  const seededExpanded = useRef(false);

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<TicketTypeNode | null>(null);
  const [form, setForm] = useState<TypeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      // `includeInactive`: esta pantalla ADMINISTRA el catálogo, así que también
      // muestra los tipos dados de baja (se reactivan sin volver a crearlos).
      const res = await slaService.listTypeTree(orgId, true);
      const nodes = Array.isArray(res.data) ? res.data : [];
      setTree(nodes);
      if (!seededExpanded.current) {
        // Primera carga: todo abierto. El catálogo son decenas de filas y un
        // árbol colapsado esconde justo lo que se vino a administrar. En las
        // recargas siguientes se respeta lo que el usuario haya colapsado.
        seededExpanded.current = true;
        setExpanded(new Set(flattenTree(nodes).map((node) => node.id)));
      }
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudieron cargar los tipos de solicitud'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const flatTypes = useMemo(() => flattenTree(tree), [tree]);
  const ancestorNames = useMemo(() => buildTicketTypeAncestorNames(flatTypes), [flatTypes]);

  /**
   * Padres ofrecibles en el diálogo. Se descarta lo que el backend rechazaría:
   * - inactivos (`TICKET_TYPE_PARENT_INACTIVE`);
   * - el propio nodo y sus descendientes (`TICKET_TYPE_CYCLE`);
   * - los que no dejan lugar para la RAMA que se cuelga, no solo para el nodo:
   *   mover un subárbol de altura 1 bajo un padre de nivel 1 ya excede el tope
   *   (`TICKET_TYPE_MAX_DEPTH`).
   *
   * Excepción: el padre ACTUAL del tipo que se edita entra siempre, aunque esté
   * inactivo (pasa cuando se dio de baja la rama entera). Si no, el selector
   * abriría en blanco y parecería que el tipo está en la raíz — justo antes de
   * que el usuario apriete "Actualizar".
   */
  const parentOptions = useMemo(() => {
    const movingHeight = editing ? branchHeight(editing) : 0;
    const blocked = new Set(
      editing ? [editing.id, ...flattenTree(editing.children).map((node) => node.id)] : [],
    );
    const currentParentId = editing?.parentId ?? null;

    return flatTypes.filter((candidate) => {
      if (blocked.has(candidate.id)) return false;
      if (candidate.id === currentParentId) return true;
      return (
        candidate.isActive && candidate.level + 1 + movingHeight <= MAX_TICKET_TYPE_LEVEL
      );
    });
  }, [flatTypes, editing]);

  const toggleExpanded = useCallback((typeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      // `delete` devuelve si estaba: colapsa o expande en una sola pasada.
      if (!next.delete(typeId)) next.add(typeId);
      return next;
    });
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openAddChild = (parent: TicketTypeNode) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, parentId: parent.id });
    setShowDialog(true);
  };

  const openEdit = (node: TicketTypeNode) => {
    setEditing(node);
    setForm({
      name: node.name,
      slug: node.slug,
      isActive: node.isActive,
      parentId: node.parentId ?? ROOT_PARENT,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!orgId) return;
    const name = form.name.trim();
    const slug = form.slug.trim();
    const parentId = form.parentId === ROOT_PARENT ? null : form.parentId;
    const parent = parentId ? (flatTypes.find((type) => type.id === parentId) ?? null) : null;
    // Crear siempre "coloca" el tipo; editar solo mueve si el padre cambió.
    const moves = editing ? parentId !== editing.parentId : true;

    const errors: string[] = [];
    if (name.length < 2) errors.push('El nombre debe tener al menos 2 caracteres');
    if (name.length > 100) errors.push('El nombre no puede exceder 100 caracteres');
    if (slug && !SLUG_REGEX.test(slug)) {
      errors.push('El identificador solo admite minúsculas, números y guiones');
    }
    // Guardarraíles del árbol: el selector ya no ofrece estas opciones, pero el
    // catálogo puede haber cambiado en otra pestaña entre la carga y el guardado.
    if (parentId && !parent) {
      errors.push('El tipo padre elegido ya no existe: recargá la pantalla');
    }
    // Un padre inactivo solo molesta si el tipo va a quedar ACTIVO ahí (moverlo
    // bajo él, o reactivarlo estando ahí). Renombrar un hijo de una rama apagada
    // es legítimo y no se bloquea.
    if (parent && !parent.isActive && (moves || form.isActive)) {
      errors.push(
        `El tipo padre "${parent.name}" está inactivo: reactivalo antes de colgarle tipos activos`,
      );
    }
    if (moves && parent) {
      const movingHeight = editing ? branchHeight(editing) : 0;
      if (parent.level + 1 + movingHeight > MAX_TICKET_TYPE_LEVEL) {
        errors.push(
          `"${parent.name}" no admite más niveles por debajo: el árbol llega hasta ${MAX_TICKET_TYPE_DEPTH} niveles`,
        );
      }
      if (editing && parentId) {
        const blocked = new Set([editing.id, ...flattenTree(editing.children).map((n) => n.id)]);
        if (blocked.has(parentId)) {
          errors.push('Un tipo no puede depender de sí mismo ni de uno de sus descendientes');
        }
      }
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
          // `parentId` SOLO si cambió: el backend distingue ausente (no mueve)
          // de `null` (mover a raíz). Mandarlo siempre haría un recálculo de rama
          // en cada edición de nombre.
          ...(moves ? { parentId } : {}),
        });
        toast.success(
          'Actualizado',
          moves
            ? `Tipo "${name}" movido a ${parent ? parent.name : 'la raíz'}`
            : `Tipo "${name}" actualizado`,
        );
      } else {
        await slaService.createType(orgId, {
          name,
          ...(slug ? { slug } : {}),
          ...(parentId ? { parentId } : {}),
        });
        // El hijo recién creado tiene que quedar a la vista: se abre su padre.
        if (parentId) {
          setExpanded((prev) => new Set(prev).add(parentId));
        }
        toast.success(
          'Creado',
          parent ? `Tipo "${name}" creado dentro de "${parent.name}"` : `Tipo "${name}" creado`,
        );
      }
      setShowDialog(false);
      await load();
    } catch (err) {
      toast.error(
        errorTitle(err),
        getApiErrorMessage(err, 'No se pudo guardar el tipo de solicitud'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (node: TicketTypeNode) => {
    if (!orgId) return;
    const descendants = countBranch(node) - 1;
    const confirmed = confirm(
      descendants > 0
        ? `¿Desactivar "${node.name}" y TODA su rama?\n\nSe desactivarán también sus ${descendants} subtipo(s). Los tickets ya creados no se tocan.`
        : `¿Desactivar el tipo "${node.name}"? Los tickets ya creados no se tocan.`,
    );
    if (!confirmed) return;

    try {
      const res = await slaService.deactivateType(orgId, node.id);
      // El backend informa cuántos apagó DE VERDAD (los que ya estaban inactivos
      // no cuentan): se muestra ese número, no el que estimó la UI.
      const deactivated = res.data?.deactivated ?? 0;
      toast.success(
        'Desactivado',
        deactivated > 1
          ? `Se desactivaron ${deactivated} tipos (la rama completa)`
          : `Tipo "${node.name}" desactivado`,
      );
      await load();
    } catch (err) {
      toast.error(errorTitle(err), getApiErrorMessage(err, 'No se pudo desactivar el tipo'));
    }
  };

  const handleReactivate = async (node: TicketTypeNode) => {
    if (!orgId) return;
    try {
      // Si el padre está inactivo el backend responde TICKET_TYPE_PARENT_INACTIVE:
      // el mensaje dice qué padre hay que reactivar primero.
      await slaService.updateType(orgId, node.id, { isActive: true });
      toast.success('Reactivado', `Tipo "${node.name}" reactivado`);
      await load();
    } catch (err) {
      toast.error(errorTitle(err), getApiErrorMessage(err, 'No se pudo reactivar el tipo'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const editingLabel = editing ? ticketTypeFullLabel(ancestorNames, editing) : '';

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
          cada tipo de solicitud. Los tipos se organizan en un árbol de hasta {MAX_TICKET_TYPE_DEPTH}{' '}
          niveles.
        </p>

        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Los contratos son <strong>por tipo exacto</strong>: contratar un tipo padre NO cubre a
            sus hijos. Cada subtipo necesita su propio contrato en la matriz del proyecto.
          </span>
        </div>

        {tree.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay tipos todavía. Creá uno o importá la configuración actual desde la tab Políticas
            SLA.
          </p>
        ) : (
          <div className="space-y-2">
            {tree.map((node) => (
              <TypeNodeRow
                key={node.id}
                node={node}
                expanded={expanded}
                onToggle={toggleExpanded}
                onEdit={openEdit}
                onAddChild={openAddChild}
                onDeactivate={handleDeactivate}
                onReactivate={handleReactivate}
              />
            ))}
          </div>
        )}

        {flatTypes.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {flatTypes.length} tipo{flatTypes.length === 1 ? '' : 's'} en total ·{' '}
            {tree.length} en la raíz
          </p>
        )}
      </section>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar tipo' : 'Nuevo tipo de solicitud'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editing && editingLabel !== editing.name && (
              <p className="truncate text-[11px] text-muted-foreground">Ubicación actual: {editingLabel}</p>
            )}

            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Incidencia"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo padre</Label>
              <Select
                value={form.parentId}
                onValueChange={(value) => setForm({ ...form, parentId: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_PARENT}>— Sin padre (raíz) —</SelectItem>
                  {parentOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {/* Camino completo como prefijo (no sangría): Radix pinta el
                          ítem elegido dentro del trigger y ahí la sangría se pierde. */}
                      {ticketTypeFullLabel(ancestorNames, option)}
                      {option.isActive ? '' : ' (inactivo)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {editing
                  ? `Cambiar el padre MUEVE el tipo con toda su rama. Solo se ofrecen padres activos donde la rama entra dentro de los ${MAX_TICKET_TYPE_DEPTH} niveles.`
                  : `Opcional: si no elegís padre, el tipo queda en la raíz. Solo se ofrecen tipos activos que todavía admiten hijos (el árbol llega hasta ${MAX_TICKET_TYPE_DEPTH} niveles).`}
              </p>
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
                <div className="pr-3">
                  <p className="text-sm font-medium">Activo</p>
                  <p className="text-[11px] text-muted-foreground">
                    Un tipo inactivo no entra en la matriz de contratos ni en la cobertura.
                    Desactivarlo apaga también su rama.
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
