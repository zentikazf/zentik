import type { SlaCriticality, SlaSource } from '@/types/sla.types';

// ─── Tickets — tipos compartidos ──────────────────────────

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';

export type TicketCloseReason =
  | 'RESOLVED_BY_SUPPORT'
  | 'RESOLVED_BY_CLIENT'
  | 'DUPLICATE'
  | 'SPAM'
  | 'OTHER';

export type TicketEventType =
  | 'STATUS_CHANGE'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'KANBAN_MOVE'
  | 'CLOSED'
  | 'REOPENED'
  | 'COMMENT_ADDED'
  | 'FIRST_RESPONSE'
  | 'RESOLVED'
  | 'SLA_WARNING'
  | 'SLA_BREACH_RESPONSE'
  | 'SLA_BREACH_RESOLUTION'
  // Tipificación interna (#42 Fase 2): el equipo cambió tipo / criticidad /
  // categoría del ticket. El motivo viaja en `metadata.reason`.
  | 'RECLASSIFIED';

export type TicketEventSource = 'TICKET' | 'KANBAN' | 'SYSTEM';

export type KanbanTaskStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DONE'
  | 'CANCELLED';

export interface TicketAssignee {
  id: string;
  name: string;
  email?: string;
  image?: string | null;
}

export interface KanbanColumnRef {
  id: string;
  name: string;
  color: string | null;
  mappedStatus: KanbanTaskStatus | null;
}

export interface TicketTaskRef {
  id: string;
  title: string;
  status: KanbanTaskStatus;
  priority?: string;
  boardColumn?: KanbanColumnRef | null;
  assignments?: { user: TicketAssignee }[];
}

export interface TicketListItem {
  id: string;
  ticketNumber: string | null;
  title: string;
  description?: string | null;
  status: TicketStatus;
  category: string;
  priority: string;
  criticality?: SlaCriticality | null;
  slaResponseBreached?: boolean;
  slaResolutionBreached?: boolean;
  responseDeadline?: string | null;
  resolutionDeadline?: string | null;
  closeReason?: TicketCloseReason | null;
  closedAt?: string | null;
  client?: { id: string; name: string; email?: string } | null;
  project?: { id: string; name: string; slug?: string } | null;
  task?: TicketTaskRef | null;
  channel?: { id: string; name: string; _count?: { messages: number } } | null;
  categoryConfig?: { id: string; name: string; criticality: string } | null;
  createdByUser?: { id: string; name: string } | null;
  createdAt: string;

  // Tipo de solicitud VIGENTE del ticket (#42 Fase 2): arranca con lo que eligió
  // el cliente y el equipo lo puede cambiar al reclasificar. El detalle devuelve
  // el escalar; la relación puede no venir en respuestas viejas → siempre opcional.
  ticketTypeId?: string | null;
  ticketType?: { id: string; name: string } | null;

  // Declaración CONGELADA del cliente (#42 Fase 2.1). Se graba una sola vez al
  // crear el ticket desde el portal y NO se toca al reclasificar: es "qué reportó
  // el cliente". Null en tickets creados por admin y en todo lo histórico, así que
  // la UI solo pinta la línea cuando existe Y difiere de lo vigente.
  reportedTicketTypeId?: string | null;
  reportedTicketType?: { id: string; name: string } | null;
  reportedCriticality?: SlaCriticality | null;

  // Motor de SLA con cascada (#42 Fase 1). Se congelan al crear el ticket y
  // NUNCA se recalculan. Ausentes en los tickets históricos y mientras el flag
  // `SLA_CASCADE_ENABLED` esté apagado → la UI no muestra el badge.
  slaPolicy?: { id: string; name: string; criticality: SlaCriticality } | null;
  slaSource?: SlaSource | null;
}

export interface TicketDetail extends TicketListItem {
  adminNotes?: string | null;
  closeNote?: string | null;
  closedByUser?: { id: string; name: string } | null;
}

export interface TicketEvent {
  id: string;
  ticketId: string;
  type: TicketEventType;
  fromValue: string | null;
  toValue: string | null;
  source: TicketEventSource;
  metadata: Record<string, unknown> | null;
  userId: string | null;
  user?: { id: string; name: string; image: string | null } | null;
  createdAt: string;
}

export interface TicketStats {
  OPEN: number;
  IN_PROGRESS: number;
  IN_REVIEW: number;
  RESOLVED: number;
  CLOSED: number;
  TOTAL: number;
}

export interface TicketsListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface TicketsListResponse {
  data: TicketListItem[];
  meta: TicketsListMeta;
}

export interface UpdateTicketInput {
  status?: TicketStatus;
  adminNotes?: string;
  assigneeId?: string | null;
}

export interface CloseTicketInput {
  reason: TicketCloseReason;
  note?: string;
}

/**
 * Categoría interna configurable (`TicketCategoryConfig` del backend).
 *
 * En el modelo nuevo NO es lo que elige el cliente: es la clasificación que el
 * equipo asigna al tipificar el ticket. Se administra en
 * `/settings/sla/categorias-internas` (#42 Fase 2.1).
 */
export interface TicketCategoryConfigItem {
  id: string;
  name: string;
  description?: string | null;
  criticality: SlaCriticality;
  isActive?: boolean;
}

/** Alta de categoría interna (espejo de `CreateCategoryConfigDto`). */
export interface CreateTicketCategoryConfigInput {
  name: string;
  description?: string;
  criticality: SlaCriticality;
}

/** PATCH parcial de categoría interna (`isActive: true` la reactiva). */
export interface UpdateTicketCategoryConfigInput {
  name?: string;
  description?: string;
  criticality?: SlaCriticality;
  isActive?: boolean;
}

/**
 * Tipificación interna (#42 Fase 2). Los tres campos de clasificación son
 * opcionales (se manda solo lo que cambia) pero el `reason` es OBLIGATORIO:
 * sin él la reclasificación no deja rastro auditable.
 */
export interface ReclassifyTicketInput {
  ticketTypeId?: string;
  criticality?: SlaCriticality;
  categoryConfigId?: string;
  reason: string;
}

/**
 * Respuesta del endpoint de clasificación. Incluye los deadlines a propósito:
 * reclasificar NO los recalcula y así se puede verificar que no se movieron.
 */
export interface TicketClassification {
  id: string;
  ticketTypeId: string | null;
  criticality: SlaCriticality | null;
  categoryConfigId: string | null;
  responseDeadline: string | null;
  resolutionDeadline: string | null;
  slaPolicyId: string | null;
  slaSource: SlaSource | null;
  ticketType: { id: string; name: string } | null;
  categoryConfig: { id: string; name: string; criticality: SlaCriticality } | null;
}

export interface ListTicketsQuery {
  status?: TicketStatus;
  page?: number;
  limit?: number;
  clientId?: string;
  projectId?: string;
  search?: string;
  assigneeId?: string;
  createdByUserId?: string;
  categoryConfigId?: string;

  // Feature #10: facets extendidos para tab RESOLVED + panel "Mas filtros".
  // El backend (zentik-backend) los acepta como CSV / single value.
  criticality?: string;        // "CRITICAL,HIGH,MEDIUM,LOW"
  category?: string;           // "SUPPORT_REQUEST,NEW_DEVELOPMENT"
  slaOutcome?: string;         // "COMPLIED" | "BREACHED_RESPONSE" | "BREACHED_RESOLUTION" | "BREACHED_BOTH" | "NO_SLA" (csv)
  overshootBucket?: string;    // "LT_1H" | "BETWEEN_1_4H" | "BETWEEN_4_24H" | "GT_24H"
  resolvedFrom?: string;       // ISO date YYYY-MM-DD
  resolvedTo?: string;         // ISO date YYYY-MM-DD
  sortBy?: string;             // "resolvedAt" | "overshoot" | "createdAt"
  sortOrder?: string;          // "asc" | "desc"
}
