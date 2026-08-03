'use client';

import { useEffect, useState } from 'react';
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
import { slaService } from '@/services/sla.service';
import { ticketService } from '@/services/ticket.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { SLA_CRITICALITY_LABEL, type SlaCriticality, type TicketType } from '@/types/sla.types';
import type {
  ReclassifyTicketInput,
  TicketCategoryConfigItem,
  TicketDetail,
} from '@/types/ticket.types';

const CRITICALITIES: SlaCriticality[] = ['HIGH', 'MEDIUM', 'LOW'];

interface ReclassifyTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: TicketDetail;
  /** Se llama tras reclasificar, para refrescar el ticket y su timeline. */
  onReclassified?: () => void;
}

interface ReclassifyForm {
  ticketTypeId: string;
  criticality: string;
  categoryConfigId: string;
  reason: string;
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
}: ReclassifyTicketDialogProps) {
  const { orgId } = useOrg();
  const router = useRouter();

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
      reason: '',
    });
  }, [open, ticket.ticketTypeId, ticket.criticality, ticket.categoryConfig?.id]);

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

    if (!input.ticketTypeId && !input.criticality && !input.categoryConfigId) {
      toast.error('Sin cambios', 'Cambiá el tipo, la criticidad o la categoría antes de guardar');
      return;
    }

    setSaving(true);
    try {
      await ticketService.reclassify(orgId, ticket.id, input);
      toast.success('Ticket reclasificado', 'El cambio quedó registrado en el historial');
      onOpenChange(false);
      onReclassified?.();
      router.refresh();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo reclasificar el ticket'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reclasificar ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Cambiá cómo el equipo tipifica este ticket. Los plazos del SLA no se recalculan: quedan
            como se fijaron al crearlo.
          </p>

          <div className="space-y-2">
            <Label>Tipo de solicitud</Label>
            <Select
              value={form.ticketTypeId}
              onValueChange={(v) => setForm({ ...form, ticketTypeId: v })}
              disabled={loadingOptions || types.length === 0}
            >
              <SelectTrigger>
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
                {/* `listTypes` sin `includeInactive` ya devuelve solo los activos. */}
                {types.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
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
                {CRITICALITIES.map((criticality) => (
                  <SelectItem key={criticality} value={criticality}>
                    {SLA_CRITICALITY_LABEL[criticality]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Categoría interna</Label>
            <Select
              value={form.categoryConfigId}
              onValueChange={(v) => setForm({ ...form, categoryConfigId: v })}
              disabled={loadingOptions || categories.length === 0}
            >
              <SelectTrigger>
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
            {saving ? 'Guardando...' : 'Reclasificar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
