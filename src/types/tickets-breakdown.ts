// ─── Tickets breakdown — contrato del endpoint dashboard/tickets-breakdown ──
//
// GET /organizations/:orgId/dashboard/tickets-breakdown
//
// Devuelve un breakdown 2D (categoria x estado) de los tickets activos del
// dashboard, con metricas SLA agregadas por bucket. Lo consume el drill-down
// de 2 modales (TicketsByTypeModal -> TicketsByStatusModal) en /dashboard.
//
// El contrato esta alineado al design.md de la feature #9 — cualquier cambio
// debe replicarse en backend (DashboardService.getTicketsBreakdown).

export type TicketStatusActive =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'RESOLVED';

export type TicketCategoryActive = 'SUPPORT_REQUEST' | 'NEW_DEVELOPMENT';

export interface StatusBucket {
  count: number;
  /** ClassifySlaOutcome === COMPLIED */
  complied: number;
  /** BREACHED_RESPONSE */
  breachedResponse: number;
  /** BREACHED_RESOLUTION */
  breachedResolution: number;
  /** BREACHED_BOTH (overlap intencional: suma a breachedResponse y breachedResolution) */
  breachedBoth: number;
  /** NO_SLA */
  noSla: number;
  /** null si no hay breaches con overshoot calculable */
  avgOvershootMin: number | null;
}

export interface CategorySlaSummary {
  complied: number;
  breachedResponse: number;
  breachedResolution: number;
  avgOvershootMin: number | null;
  /** null si total === 0 (evita mostrar "0%" misleading) */
  compliancePct: number | null;
  noSlaCount: number;
}

export interface CategoryBlock {
  total: number;
  byStatus: Record<TicketStatusActive, StatusBucket>;
  sla: CategorySlaSummary;
}

export interface TicketsBreakdownResponse {
  total: number;
  byCategory: Record<TicketCategoryActive, CategoryBlock>;
  period: { startDate: string | null; endDate: string | null };
}

// ─── Filtros del hook (compartidos con el dashboard managerial actual) ───────

export interface TicketsBreakdownFilters {
  startDate?: string;
  endDate?: string;
  clientId?: string;
  memberId?: string;
}
