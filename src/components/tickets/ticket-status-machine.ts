import type { TicketStatus } from '@/types/ticket.types';

/**
 * Mapping del estado del ticket → labels y colores en UI.
 * FUENTE ÚNICA (#43): mantener sincronizado con ALLOWED_TRANSITIONS del backend.
 *
 * 4 estados VIVOS: OPEN «Nuevo» · IN_PROGRESS «En curso» · RESOLVED «Resuelto» ·
 * CLOSED «Cancelado». `IN_REVIEW` quedó como TOMBSTONE (se retiró del ciclo: la
 * revisión vive en la task del kanban) — se muestra en tickets históricos pero
 * ninguna UI lo ofrece como destino.
 */
export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Nuevo',
  IN_PROGRESS: 'En curso',
  IN_REVIEW: 'En revisión', // tombstone: se muestra, no se elige
  RESOLVED: 'Resuelto',
  CLOSED: 'Cancelado',
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
 * State machine de transiciones válidas — espejo EXACTO de ALLOWED_TRANSITIONS
 * del backend (ticket.service.ts). El backend también valida; esto es solo UX.
 *
 * #43: CLOSED = «Cancelado», entra solo por la acción dedicada «Cancelar ticket»
 * (diálogo con comentario obligatorio), NUNCA por el Select → por eso CLOSED no
 * está en `SELECTABLE_STATUSES`. Desde RESOLVED no se cancela (se reabre a
 * IN_PROGRESS primero). CLOSED → OPEN reabre una cancelación.
 */
const ALLOWED: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'OPEN', 'CLOSED'],
  IN_REVIEW: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['IN_PROGRESS'],
  CLOSED: ['OPEN'],
};

/**
 * Estados que el Select de estado puede ofrecer directamente. «Cancelado»
 * (CLOSED) NO está: exige comentario → va por el diálogo «Cancelar ticket».
 * «En revisión» (IN_REVIEW) tampoco: es un tombstone.
 */
export const SELECTABLE_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];

/**
 * Transiciones que el Select ofrece: el estado actual (para mostrarlo, aunque
 * sea un tombstone) + los destinos permitidos que además son seleccionables.
 * CLOSED e IN_REVIEW quedan fuera como destino (cancelar = diálogo).
 */
export function getSelectableTransitions(current: TicketStatus): TicketStatus[] {
  const dests = ALLOWED[current].filter((s) => SELECTABLE_STATUSES.includes(s));
  return [current, ...dests];
}

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}

/**
 * ¿El ticket se puede CANCELAR (acción dedicada)? Desde OPEN/IN_PROGRESS/IN_REVIEW
 * sí; desde RESOLVED no (ya entregado) y desde CLOSED tampoco (ya cancelado).
 */
export function canCancel(current: TicketStatus): boolean {
  return current === 'OPEN' || current === 'IN_PROGRESS' || current === 'IN_REVIEW';
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
