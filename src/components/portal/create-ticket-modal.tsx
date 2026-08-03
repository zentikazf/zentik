'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Info } from 'lucide-react';
import { api } from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { toast } from '@/hooks/use-toast';
import type {
  AvailableTicketType,
  AvailableTicketTypes,
  ClientVisibleCriticality,
  SlaCriticality,
} from '@/types/sla.types';

export interface PortalProjectOption {
  id: string;
  name: string;
}

export interface PortalBusinessHours {
  start: string;
  end: string;
  days: string[];
  timezone: string;
}

/** Precarga desde un ticket previo (feature #11: "crear nueva consulta"). */
export interface CreateTicketPrefill {
  relatedTicketId: string;
  title?: string;
  description?: string;
  projectId?: string;
}

interface CreateTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: PortalProjectOption[];
  businessHours: PortalBusinessHours | null;
  /** Si viene, el modal arranca en la rama de soporte con los datos precargados. */
  prefill?: CreateTicketPrefill | null;
  /** Se llama tras crear el ticket o enviar la solicitud de proyecto. */
  onCreated: () => void | Promise<void>;
}

/**
 * Qué quiere el cliente. NO es el "tipo de solicitud" del SLA: es el interruptor
 * de flujo histórico del portal — `NEW_PROJECT` NO crea un ticket, postea a
 * `/portal/project-requests`. Se preserva tal cual (checklist de continuidad).
 */
type RequestMode = '' | 'SUPPORT_REQUEST' | 'NEW_PROJECT';

interface TicketForm {
  projectId: string;
  criticality: string;
  ticketTypeId: string;
  title: string;
  description: string;
  projectName: string;
  projectDescription: string;
  relatedTicketId: string;
}

const EMPTY_FORM: TicketForm = {
  projectId: '',
  criticality: '',
  ticketTypeId: '',
  title: '',
  description: '',
  projectName: '',
  projectDescription: '',
  relatedTicketId: '',
};

/**
 * Creación de tickets del portal (#42 Fase 2).
 *
 * Vive fuera de la página porque la lista ya ocupaba 642 líneas con el modal
 * adentro. El orden de campos es el del modelo OSD: **proyecto → criticidad →
 * tipo → asunto → descripción**, con criticidad y tipo encadenados.
 *
 * Dos propiedades del diseño que NO son detalles de implementación:
 * - Si `/portal/criticalities` devuelve `[]`, el selector de criticidad **no se
 *   renderiza** y no se manda `criticality`: el backend aplica la default de la
 *   organización. Es el modo 2B, y se activa desmarcando checkboxes en el admin
 *   — sin deploy.
 * - Ya no existe el selector de "Categoría" ni el prefijo `dynamic:`. La
 *   categoría pasó a ser clasificación INTERNA que tipifica el equipo.
 */
export function CreateTicketModal({
  open,
  onOpenChange,
  projects,
  businessHours,
  prefill,
  onCreated,
}: CreateTicketModalProps) {
  const [mode, setMode] = useState<RequestMode>('');
  const [form, setForm] = useState<TicketForm>(EMPTY_FORM);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  const [criticalities, setCriticalities] = useState<ClientVisibleCriticality[]>([]);
  const [criticalitiesLoaded, setCriticalitiesLoaded] = useState(false);

  const [types, setTypes] = useState<AvailableTicketType[]>([]);
  const [typesFallback, setTypesFallback] = useState(false);
  const [typesLoading, setTypesLoading] = useState(false);

  // Sembrar el form cada vez que se abre: con prefill (feature #11) arranca en la
  // rama de soporte con los datos del ticket anterior; sin prefill, vacío.
  useEffect(() => {
    if (!open) return;
    setMode(prefill ? 'SUPPORT_REQUEST' : '');
    setForm({
      ...EMPTY_FORM,
      projectId: prefill?.projectId ?? '',
      title: prefill?.title ?? '',
      description: prefill?.description ?? '',
      relatedTicketId: prefill?.relatedTicketId ?? '',
    });
    setAttachFile(null);
  }, [open, prefill]);

  // Criticidades visibles: una sola vez por sesión del modal. Si falla, se queda
  // en `[]` → el selector no se renderiza y entra la default (degradación segura).
  useEffect(() => {
    if (!open || criticalitiesLoaded) return;
    let cancelled = false;

    const loadCriticalities = async () => {
      try {
        const res = await api.get<ClientVisibleCriticality[]>('/portal/criticalities');
        if (cancelled) return;
        setCriticalities(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setCriticalities([]);
      } finally {
        if (!cancelled) setCriticalitiesLoaded(true);
      }
    };

    loadCriticalities();
    return () => {
      cancelled = true;
    };
  }, [open, criticalitiesLoaded]);

  // Select dependiente: el tipo se recarga al cambiar proyecto O criticidad
  // (mismo patrón que cliente → proyecto en el dashboard admin).
  useEffect(() => {
    if (!open || !form.projectId) {
      setTypes([]);
      setTypesFallback(false);
      return;
    }
    let cancelled = false;

    const loadTypes = async () => {
      setTypesLoading(true);
      try {
        const query = form.criticality ? `?criticality=${form.criticality}` : '';
        const res = await api.get<AvailableTicketTypes>(
          `/portal/projects/${form.projectId}/ticket-types${query}`,
        );
        if (cancelled) return;
        setTypes(res.data?.types ?? []);
        setTypesFallback(Boolean(res.data?.fallback));
      } catch {
        if (cancelled) return;
        setTypes([]);
        setTypesFallback(false);
      } finally {
        if (!cancelled) setTypesLoading(false);
      }
    };

    loadTypes();
    return () => {
      cancelled = true;
    };
  }, [open, form.projectId, form.criticality]);

  // Cambiar el padre resetea al hijo: un tipo elegido para otro proyecto (u otra
  // criticidad) puede no estar contratado, y el backend lo rechazaría.
  const handleProjectChange = (projectId: string) => {
    setForm((prev) => ({ ...prev, projectId, ticketTypeId: '' }));
  };

  const handleCriticalityChange = (criticality: string) => {
    setForm((prev) => ({ ...prev, criticality, ticketTypeId: '' }));
  };

  const submitProjectRequest = async () => {
    if (!form.projectName.trim()) {
      toast.error('Error', 'El nombre del proyecto es requerido');
      return;
    }
    setCreating(true);
    try {
      await api.post('/portal/project-requests', {
        name: form.projectName.trim(),
        description: form.projectDescription.trim() || undefined,
      });
      toast.success('Solicitud enviada', 'Tu solicitud de nuevo proyecto fue enviada al equipo');
      onOpenChange(false);
      await onCreated();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'Error al enviar la solicitud'));
    } finally {
      setCreating(false);
    }
  };

  const submitTicket = async () => {
    if (!form.projectId || !form.title.trim()) {
      toast.error('Error', 'Completa todos los campos requeridos');
      return;
    }
    // Si el campo se muestra, se exige (mismo criterio que tenía la categoría
    // dinámica). Si la lista vino vacía el campo no existe y no se valida.
    if (criticalities.length > 0 && !form.criticality) {
      toast.error('Error', 'Selecciona la criticidad');
      return;
    }
    if (types.length > 0 && !form.ticketTypeId) {
      toast.error('Error', 'Selecciona el tipo de solicitud');
      return;
    }

    setCreating(true);
    try {
      const res = await api.post<{ id: string; ticketNumber?: string; channel?: { id: string } }>(
        `/portal/projects/${form.projectId}/tickets`,
        {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          ticketTypeId: form.ticketTypeId || undefined,
          criticality: (form.criticality as SlaCriticality) || undefined,
          relatedTicketId: form.relatedTicketId || undefined,
        },
      );

      // Adjunto opcional: se sube al canal del ticket recién creado. Si algo falla
      // el ticket YA existe, así que no se revierte ni se muestra como error.
      const channelId = res.data?.channel?.id;
      if (attachFile && channelId) {
        const fd = new FormData();
        fd.append('file', attachFile);
        const uploadRes = await api
          .upload<{ id: string }>('/files/upload?category=ATTACHMENT', fd)
          .catch(() => null);
        const fileId = uploadRes?.data?.id;
        await api
          .post(`/channels/${channelId}/messages`, {
            content: `📎 ${attachFile.name}`,
            ...(fileId && { fileIds: [fileId] }),
          })
          .catch(() => {});
      }

      const ticketNum = res.data?.ticketNumber || res.data?.id?.slice(-8).toUpperCase();
      toast.success('Ticket creado', `Tu ticket #${ticketNum} fue enviado al equipo`);
      onOpenChange(false);
      await onCreated();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'Error al crear el ticket'));
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'NEW_PROJECT') {
      submitProjectRequest();
      return;
    }
    submitTicket();
  };

  const typePlaceholder = !form.projectId
    ? 'Elegí primero un proyecto'
    : typesLoading
      ? 'Cargando tipos...'
      : types.length === 0
        ? 'Sin tipos disponibles'
        : 'Selecciona el tipo';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Ticket</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-muted-foreground">¿Qué necesitas?</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as RequestMode)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una opcion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUPPORT_REQUEST">Soporte / Error</SelectItem>
                <SelectItem value="NEW_PROJECT">Nuevo Proyecto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'NEW_PROJECT' ? (
            <>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Nombre del proyecto</Label>
                <Input
                  value={form.projectName}
                  onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                  placeholder="Nombre del nuevo proyecto"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Descripcion del proyecto</Label>
                <Textarea
                  value={form.projectDescription}
                  onChange={(e) => setForm({ ...form, projectDescription: e.target.value })}
                  placeholder="Describe que necesitas en este proyecto..."
                  rows={4}
                />
              </div>
            </>
          ) : mode === 'SUPPORT_REQUEST' ? (
            <>
              {/* 1) Proyecto */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Proyecto</Label>
                <Select value={form.projectId} onValueChange={handleProjectChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un proyecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2) Criticidad — solo si la organizacion habilito alguna (modo 2A) */}
              {criticalities.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Criticidad</Label>
                  <Select value={form.criticality} onValueChange={handleCriticalityChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona la criticidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {criticalities.map((c) => (
                        <SelectItem key={c.criticality} value={c.criticality}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 3) Tipo — depende del proyecto y de la criticidad */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Tipo de solicitud</Label>
                <Select
                  value={form.ticketTypeId}
                  onValueChange={(v) => setForm({ ...form, ticketTypeId: v })}
                  disabled={!form.projectId || typesLoading || types.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={typePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {typesFallback && types.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Mostrando todos los tipos disponibles.
                  </p>
                )}
                {form.projectId && !typesLoading && types.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Este proyecto todavia no tiene tipos configurados. Podes enviar el ticket igual.
                  </p>
                )}
              </div>

              {/* 4) Asunto */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Asunto</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Describe brevemente tu solicitud"
                  required
                />
              </div>

              {/* 5) Descripcion */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Descripcion detallada</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Explica con mas detalle el problema o funcionalidad que necesitas..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Archivo adjunto <span className="text-muted-foreground/50">(opcional)</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    className="text-xs"
                    onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                  />
                  {attachFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs shrink-0"
                      onClick={() => setAttachFile(null)}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
                {attachFile && (
                  <p className="text-[10px] text-muted-foreground">
                    Se adjuntara al chat del ticket despues de crearlo.
                  </p>
                )}
              </div>
            </>
          ) : null}

          {mode && (
            <Button type="submit" className="w-full rounded-full" disabled={creating}>
              {creating
                ? 'Enviando...'
                : mode === 'NEW_PROJECT'
                  ? 'Solicitar Proyecto'
                  : 'Enviar Ticket'}
            </Button>
          )}

          {businessHours && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Horario de atencion: {businessHours.days.join(', ')} de {businessHours.start} a{' '}
                {businessHours.end} ({businessHours.timezone}). Los tickets fuera de horario seran
                atendidos en el siguiente dia habil.
              </span>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
