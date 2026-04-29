import type { TicketStatus } from '@/types/ticket.types';

/**
 * Mapping del estado del ticket → labels y colores en UI.
 * Mantener sincronizado con el backend (ALLOWED_TRANSITIONS en ticket.service.ts)
 */
export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En progreso',
  IN_REVIEW: 'En revision',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
};

export const STATUS_DOT: Record<TicketStatus, string> = {
  OPEN: 'bg-destructive',
  IN_PROGRESS: 'bg-warning',
  IN_REVIEW: 'bg-info',
  RESOLVED: 'bg-success',
  CLOSED: 'bg-muted-foreground',
};

export const STATUS_BADGE: Record<TicketStatus, string> = {
  OPEN: 'bg-destructive/10 text-destructive border-transparent',
  IN_PROGRESS: 'bg-warning/10 text-warning border-transparent',
  IN_REVIEW: 'bg-info/10 text-info border-transparent',
  RESOLVED: 'bg-success/10 text-success border-transparent',
  CLOSED: 'bg-muted text-muted-foreground border-transparent',
};

export const STATUS_ORDER: TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'IN_REVIEW',
  'RESOLVED',
  'CLOSED',
];

/**
 * State machine de transiciones validas.
 * IMPORTANTE: debe coincidir EXACTAMENTE con ALLOWED_TRANSITIONS del backend.
 * El backend tambien valida — esto es solo para UX (filtrar el dropdown).
 */
const ALLOWED: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'IN_REVIEW', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['IN_REVIEW', 'RESOLVED', 'OPEN', 'CLOSED'],
  IN_REVIEW: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['IN_PROGRESS'],
};

export function getValidTransitions(current: TicketStatus): TicketStatus[] {
  return [current, ...ALLOWED[current]];
}

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}

// ─── Mapping del kanban ─────────────────────────
export const KANBAN_STATUS_LABEL: Record<string, string> = {
  BACKLOG: 'Nuevo',
  TODO: 'Pendiente',
  IN_PROGRESS: 'En desarrollo',
  IN_REVIEW: 'En revision',
  DONE: 'Completada',
  CANCELLED: 'Cancelada',
};
