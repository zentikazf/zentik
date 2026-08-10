import { api } from '@/lib/api-client';
import type { Criticality } from '@/lib/criticality';
import type {
  CreateTicketCategoryConfigInput,
  ReclassifyTicketInput,
  TicketCategoryConfigItem,
  TicketClassification,
  UpdateTicketCategoryConfigInput,
  TicketDetail,
  TicketEvent,
  TicketsListResponse,
  TicketStats,
  UpdateTicketInput,
  ListTicketsQuery,
} from '@/types/ticket.types';

function buildQs(query: Record<string, unknown>): string {
  const entries = Object.entries(query).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  const params = new URLSearchParams();
  for (const [k, v] of entries) params.append(k, String(v));
  return '?' + params.toString();
}

export const ticketService = {
  list: (orgId: string, query: ListTicketsQuery = {}) => {
    return api.get<TicketsListResponse>(
      `/organizations/${orgId}/tickets${buildQs(query as Record<string, unknown>)}`,
    );
  },

  stats: (orgId: string) =>
    api.get<TicketStats>(`/organizations/${orgId}/tickets/stats`),

  openCount: (orgId: string) =>
    api.get<{ count: number }>(`/organizations/${orgId}/tickets/open-count`),

  // Counts para los badges del sidebar admin (#20). Centralizan la URL en el
  // service en vez de `api.get` inline en el store/sidebar. Ambos endpoints
  // devuelven `{ count }`; el de approvals esta gateado por `manage:projects`
  // (el caller lo invoca solo si el user tiene el permiso, para no disparar 403).
  approvalsCount: (orgId: string) =>
    api.get<{ count: number }>(`/organizations/${orgId}/approvals/count`),

  projectsPendingCount: (orgId: string) =>
    api.get<{ count: number }>(`/organizations/${orgId}/projects/pending-count`),

  detail: (ticketId: string) => api.get<TicketDetail>(`/tickets/${ticketId}`),

  events: (ticketId: string) => api.get<TicketEvent[]>(`/tickets/${ticketId}/events`),

  update: (ticketId: string, input: UpdateTicketInput) =>
    api.patch<TicketDetail>(`/tickets/${ticketId}`, input),

  /**
   * Cancelar ticket (#43). Reutiliza el estado CLOSED como «Cancelado» via el
   * endpoint dedicado (comentario obligatorio, solo staff). No pasa por el PATCH
   * de estado — el backend rechaza CLOSED por esa vía.
   */
  cancel: (ticketId: string, input: { reason: string; note: string }) =>
    api.post<TicketDetail>(`/tickets/${ticketId}/close`, input),

  /**
   * Categorías internas de la org (las tipifica el equipo, no el cliente).
   * El backend devuelve activas **e inactivas**: quien solo quiera las activas
   * (el diálogo de reclasificación) filtra por `isActive`.
   */
  categories: (orgId: string) =>
    api.get<TicketCategoryConfigItem[]>(`/organizations/${orgId}/ticket-categories`),

  createCategory: (orgId: string, input: CreateTicketCategoryConfigInput) =>
    api.post<TicketCategoryConfigItem>(`/organizations/${orgId}/ticket-categories`, input),

  updateCategory: (
    orgId: string,
    categoryId: string,
    input: UpdateTicketCategoryConfigInput,
  ) =>
    api.patch<TicketCategoryConfigItem>(
      `/organizations/${orgId}/ticket-categories/${categoryId}`,
      input,
    ),

  /** Baja lógica (`isActive: false`). Los tickets ya tipificados no se tocan. */
  deactivateCategory: (orgId: string, categoryId: string) =>
    api.delete<TicketCategoryConfigItem>(
      `/organizations/${orgId}/ticket-categories/${categoryId}`,
    ),

  /**
   * Tipificación interna (#42 Fase 2): cambia tipo / criticidad / categoría con
   * motivo obligatorio. Deja un evento `RECLASSIFIED` en el timeline y **NO**
   * recalcula los deadlines (quedan congelados con lo resuelto al crear).
   */
  reclassify: (orgId: string, ticketId: string, input: ReclassifyTicketInput) =>
    api.patch<TicketClassification>(
      `/organizations/${orgId}/tickets/${ticketId}/classification`,
      input,
    ),

  /**
   * Alta por STAFF. Espejo de `CreateAdminTicketDto`.
   *
   * `ticketTypeId` + `criticality` son la tipificación del equipo (#48 T10/T11):
   * el tipo se persiste con `SLA_CASCADE_ENABLED` prendido o apagado, y la
   * criticidad gana sobre la que derivaría de `categoryConfigId`.
   */
  create: (
    orgId: string,
    body: {
      title: string;
      description?: string;
      category: string;
      priority?: string;
      clientId: string;
      projectId: string;
      categoryConfigId?: string;
      ticketTypeId?: string;
      criticality?: Criticality;
    },
  ) => api.post<TicketDetail>(`/organizations/${orgId}/tickets`, body),
};
