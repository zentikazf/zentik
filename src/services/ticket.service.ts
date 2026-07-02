import { api } from '@/lib/api-client';
import type {
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
    },
  ) => api.post<TicketDetail>(`/organizations/${orgId}/tickets`, body),
};
