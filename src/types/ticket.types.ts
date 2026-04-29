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
  | 'COMMENT_ADDED';

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
  criticality?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
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

export interface TicketsListResponse {
  data: TicketListItem[];
  meta: { nextCursor: string | null; limit: number; hasNext: boolean };
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

export interface ListTicketsQuery {
  status?: TicketStatus;
  cursor?: string;
  limit?: number;
  clientId?: string;
  search?: string;
  assigneeId?: string;
  createdByUserId?: string;
  categoryConfigId?: string;
}
