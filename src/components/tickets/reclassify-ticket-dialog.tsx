'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { buildTicketTypeAncestorNames, ticketTypeFullLabel } from '@/lib/ticket-type-path';
import { slaService } from '@/services/sla.service';
import { ticketService } from '@/services/ticket.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { CRITICALITY_LABEL, CRITICALITY_VALUES } from '@/lib/criticality';
import type { SlaCriticality, TicketType } from '@/types/sla.types';
import type {
  ReclassifyTicketInput,
  TicketCategoryConfigItem,
  TicketDetail,
} from '@/types/ticket.types';

/** #44: qué eje de la tipificación le falta al ticket (contrato con el backend). */
type MissingClassification = 'ticketType' | 'categoryConfig';

interface ReclassifyTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: TicketDetail;
  /**
   * En modo `reclassify` (default) se llama tras guardar para refrescar el ticket.
   * En modo `gate` (#44) el padre lo usa para **reintentar la resolución** una vez
   * completada la tipificación; puede ser async y lanzar (el diálogo lo muestra y
   * queda abierto, igual que el gate de horas).
   */
  onReclassified?: () => void | Promise<void>;
  /**
   * #44 — Modo "candado al resolver". Aditivo: sin esta prop el diálogo se comporta
   * exactamente igual que antes. En `gate` siembra el motivo, acepta confirmar
   * tras completar lo que falta, y resalta `missingFields`.
   */
  mode?: 'reclassify' | 'gate';
  /** #44 — Ejes que el backend reportó faltantes (`details.missing`), para resaltarlos. */
  missingFields?: MissingClassification[];
}

interface ReclassifyForm {
  ticketTypeId: string;
  criticality: string;
  categoryConfigId: string;
  reason: string;
}

/** #44 — Texto del motivo sembrado en modo gate (editable, sin debilitar la validación). */
const GATE_REASON_SEED = 'Tipificación al resolver';

function missingFieldsLabel(missing: MissingClassification[]): string {
  const labels = missing.map((f) =>
    f === 'ticketType' ? 'el tipo de solicitud' : 'la categoría interna',
  );
  return `Antes de resolver, completá ${labels.join(' y ')}.`;
}

/**
 * Tipificación interna de un ticket (#42 Fase 2).
 *
 * El cliente reporta con SU vocabulario; el equipo tipifica con el propio. Se
 * manda SOLO lo que cambió, y el **motivo es obligatorio**: sin él la
 * reclasificación no deja rastro auditable de por qué se cambió.
 *
 * ⚠️ Reclasificar NO recalcula los deadlines: quedan congelados con lo que se
 * resolvió al crear el ticket (misma regla que OSD). Se avisa en la UI para que
 * nadie espere lo contrario.
 */
export function ReclassifyTicketDialog({
  open,
  onOpenChange,
  ticket,
  onReclassified,
  mode = 'reclassify',
  missingFields,
}: ReclassifyTicketDialogProps) {
  const { orgId } = useOrg();
  const router = useRouter();

  const isGate = mode === 'gate';
  const needsType = isGate && (missingFields ?? []).includes('ticketType');
  const needsCategory = isGate && (missingFields ?? []).includes('categoryConfig');

  const [types, setTypes] = useState<TicketType[]>([]);
  const [typesBlocked, setTypesBlocked] = useState(false);
  const [categories, setCategories] = useState<TicketCategoryConfigItem[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ReclassifyForm>({
    ticketTypeId: '',
    criticality: '',
    categoryConfigId: '',
    reason: '',
  });

  // Sembrar el form con la clasificación ACTUAL cada vez que se abre: así el
  // usuario ve de dónde parte y solo toca lo que quiere cambiar.
  useEffect(() => {
    if (!open) return;
    setForm({
      ticketTypeId: ticket.ticketTypeId ?? '',
      criticality: ticket.criticality ?? '',
      categoryConfigId: ticket.categoryConfig?.id ?? '',
      // #44: en modo gate sembramos un motivo editable (la primera tipificación no
      // tiene un "porqué" natural). No debilita la validación del backend (MinLength 3).
      reason: isGate ? GATE_REASON_SEED : '',
    });
  }, [open, isGate, ticket.ticketTypeId, ticket.criticality, ticket.categoryConfig?.id]);

  useEffect(() => {
    if (!open || !orgId) return;
    let cancelled = false;

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        // `GET ticket-types` y `GET criticality-configs` tienen un @Roles de método
        // que incluye Developer (la ESCRITURA sigue siendo Owner/PM), así que los
        // tres roles que pueden reclasificar leen el catálogo completo. El
        // `.catch(() => null)` queda como defensa: si algún día un rol pierde la
        // lectura, el selector se deshabilita en vez de romper el diálogo — el PATCH
        // acepta cambios parciales.
        const [typesRes, categoriesRes] = await Promise.all([
          slaService.listTypes(orgId).catch(() => null),
          ticketService.categories(orgId).catch(() => null),
        ]);
        if (cancelled) return;

        setTypes(Array.isArray(typesRes?.data) ? typesRes.data : []);
        setTypesBlocked(typesRes === null);
        const rows = Array.isArray(categoriesRes?.data) ? categoriesRes.data : [];
        setCategories(rows.filter((row) => row.isActive !== false));
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    };

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [open, orgId]);

  /**
   * Contexto del padre para desambiguar tipos homónimos en distintas ramas
   * (#42 Fase 3): el selector muestra `Incidencia › Error del sistema`.
   * `listTypes` viene ordenado por el `path` del árbol, así que la lista ya sale
   * agrupada por rama y los nombres se derivan trepando por `parentId`.
   */
  const ancestorNames = useMemo(() => buildTicketTypeAncestorNames(types), [types]);

  const reason = form.reason.trim();

  const handleSubmit = async () => {
    if (!orgId) return;
    if (!reason) {
      toast.error('Error', 'El motivo de la reclasificación es obligatorio');
      return;
    }

    // Solo lo que cambió: mandar un valor idéntico no aporta y ensucia el diff
    // del evento.
    const input: ReclassifyTicketInput = { reason };
    if (form.ticketTypeId && form.ticketTypeId !== (ticket.ticketTypeId ?? '')) {
      input.ticketTypeId = form.ticketTypeId;
    }
    if (form.criticality && form.criticality !== (ticket.criticality ?? '')) {
      input.criticality = form.criticality as SlaCriticality;
    }
    if (form.categoryConfigId && form.categoryConfigId !== (ticket.categoryConfig?.id ?? '')) {
      input.categoryConfigId = form.categoryConfigId;
    }

    const hasChanges = !!(input.ticketTypeId || input.criticality || input.categoryConfigId);

    if (isGate) {
      // #44: lo que el backend marcó como faltante tiene que quedar completo. No se
      // exige "que algo cambie" (confirmar el tipo que ya eligió el cliente + agregar
      // la categoría es válido); se exige que no quede ningún eje vacío.
      const stillMissing = (missingFields ?? []).filter((f) =>
        f === 'ticketType' ? !form.ticketTypeId : !form.categoryConfigId,
      );
      if (stillMissing.length) {
        toast.error('Falta tipificar', missingFieldsLabel(stillMissing));
        return;
      }
    } else if (!hasChanges) {
      toast.error('Sin cambios', 'Cambiá el tipo, la criticidad o la categoría antes de guardar');
      return;
    }

    setSaving(true);
    try {
      // Puede no haber cambios en modo gate (confirmar valores ya presentes): en ese
      // caso no se escribe una reclasificación vacía, se pasa directo al reintento.
      if (hasChanges) {
        await ticketService.reclassify(orgId, ticket.id, input);
      }

      if (isGate) {
        // El padre reintenta la resolución con el ticket ya tipificado. Si lanza
        // (p.ej. gate de horas), lo mostramos y el diálogo queda abierto — mismo
        // molde que TaskHoursGateDialog.onLogged.
        await onReclassified?.();
        toast.success('Ticket tipificado', 'Se completó la tipificación y se resolvió el ticket');
        onOpenChange(false);
        router.refresh();
      } else {
        toast.success('Ticket reclasificado', 'El cambio quedó registrado en el historial');
        onOpenChange(false);
        onReclassified?.();
        router.refresh();
      }
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo completar la tipificación'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isGate ? 'Tipificá antes de resolver' : 'Reclasificar ticket'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {isGate
              ? 'Para resolver el ticket, el equipo tiene que tipificarlo. Completá lo que falta. Los plazos del SLA no se recalculan.'
              : 'Cambiá cómo el equipo tipifica este ticket. Los plazos del SLA no se recalculan: quedan como se fijaron al crearlo.'}
          </p>

          <div className="space-y-2">
            <Label>
              Tipo de solicitud
              {needsType && <span className="ml-1 text-destructive">*</span>}
            </Label>
            <Select
              value={form.ticketTypeId}
              onValueChange={(v) => setForm({ ...form, ticketTypeId: v })}
              disabled={loadingOptions || types.length === 0}
            >
              <SelectTrigger className={needsType ? 'ring-1 ring-destructive/50' : undefined}>
                <SelectValue
                  placeholder={
                    loadingOptions
                      ? 'Cargando...'
                      : typesBlocked
                        ? 'No disponible para tu rol'
                        : types.length === 0
                          ? 'No hay tipos configurados'
                          : 'Selecciona el tipo'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {/* `listTypes` sin `includeInactive` ya devuelve solo los activos.
                    Un hijo cuyo padre esté inactivo queda sin contexto (el padre
                    no vino en la lista) y se muestra con su nombre pelado. */}
                {types.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {ticketTypeFullLabel(ancestorNames, type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Criticidad</Label>
            <Select
              value={form.criticality}
              onValueChange={(v) => setForm({ ...form, criticality: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona la criticidad" />
              </SelectTrigger>
              <SelectContent>
                {CRITICALITY_VALUES.map((criticality) => (
                  <SelectItem key={criticality} value={criticality}>
                    {CRITICALITY_LABEL[criticality]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Categoría interna
              {needsCategory && <span className="ml-1 text-destructive">*</span>}
            </Label>
            <Select
              value={form.categoryConfigId}
              onValueChange={(v) => setForm({ ...form, categoryConfigId: v })}
              disabled={loadingOptions || categories.length === 0}
            >
              <SelectTrigger className={needsCategory ? 'ring-1 ring-destructive/50' : undefined}>
                <SelectValue
                  placeholder={
                    loadingOptions
                      ? 'Cargando...'
                      : categories.length === 0
                        ? 'No hay categorías configuradas'
                        : 'Selecciona la categoría'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Motivo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Ej: el cliente lo reportó como consulta pero es un error del sistema"
              rows={3}
              maxLength={500}
              className="resize-none text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Obligatorio. Queda visible en el historial del ticket.
            </p>
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={!reason || saving}>
            {saving
              ? 'Guardando...'
              : isGate
                ? 'Guardar y resolver'
                : 'Reclasificar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
