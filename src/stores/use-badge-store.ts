import { create } from 'zustand';
import { ticketService } from '@/services/ticket.service';

/**
 * Store de los badges del sidebar admin en vivo (#20).
 *
 * Principio: SEÑAL FINA, NO contador autoritativo. El badge se deriva SIEMPRE
 * del refetch contra el endpoint `count()` (DB = fuente de verdad), NUNCA del
 * `length` de la lista optimista de la pagina. Las paginas que mutan llaman
 * `refetch(kind, orgId)`; el WS de otros usuarios tambien dispara `refetch`.
 *
 * Espejo de `use-notification-store.ts` (mismo patron Zustand) + debounce.
 */

export type BadgeKind = 'approvals' | 'tickets' | 'projects';

interface BadgeStore {
  approvalsCount: number;
  ticketsCount: number;
  projectsPendingCount: number;
  /** Setters directos (los usa el debounce tras resolver el count). */
  setCount: (kind: BadgeKind, count: number) => void;
  /**
   * Refetch del count de un kind contra el endpoint REST, con debounce
   * trailing-edge ~300ms GLOBAL por kind. El badge sale de aca, no del length.
   */
  refetch: (kind: BadgeKind, orgId: string | null | undefined) => void;
  /**
   * Refetch de los 3 kinds (poll / montaje / foco). El caller decide si incluir
   * approvals segun permiso (`includeApprovals`) para no disparar un 403.
   */
  refetchAll: (
    orgId: string | null | undefined,
    opts?: { includeApprovals?: boolean; includeProjects?: boolean },
  ) => void;
}

/**
 * Debounce trailing-edge GLOBAL por kind: una sola key por `'approvals'` /
 * `'tickets'` / `'projects'` (NO por orgId ni por evento). Justificacion (lente
 * recursos): cerrar UN ticket emite 2 eventos WS que el sidebar escucha ambos
 * (`ticket:closed` + `ticket:updated`); sin debounce serian 2 refetch por
 * cierre, x M admins. Con el debounce global por-kind, una rafaga colapsa a 1
 * query por kind. El timer vive a nivel de modulo (no en el estado) para que
 * sobreviva re-renders y sea compartido por todos los consumidores del store.
 */
const DEBOUNCE_MS = 300;
const debounceTimers: Partial<Record<BadgeKind, ReturnType<typeof setTimeout>>> = {};

/** Mapeo kind → service call. El service centraliza la URL (no `api.get` inline). */
function fetchCount(
  kind: BadgeKind,
  orgId: string,
): Promise<{ data: { count: number } }> {
  switch (kind) {
    case 'approvals':
      return ticketService.approvalsCount(orgId);
    case 'tickets':
      return ticketService.openCount(orgId);
    case 'projects':
      return ticketService.projectsPendingCount(orgId);
  }
}

export const useBadgeStore = create<BadgeStore>((set) => ({
  approvalsCount: 0,
  ticketsCount: 0,
  projectsPendingCount: 0,

  setCount: (kind, count) =>
    set(
      kind === 'approvals'
        ? { approvalsCount: count }
        : kind === 'tickets'
          ? { ticketsCount: count }
          : { projectsPendingCount: count },
    ),

  refetch: (kind, orgId) => {
    if (!orgId) return;
    if (debounceTimers[kind]) clearTimeout(debounceTimers[kind]);
    debounceTimers[kind] = setTimeout(() => {
      fetchCount(kind, orgId)
        .then((res) => {
          // setState directo: el badge se deriva del count REAL del endpoint.
          set(
            kind === 'approvals'
              ? { approvalsCount: res.data?.count ?? 0 }
              : kind === 'tickets'
                ? { ticketsCount: res.data?.count ?? 0 }
                : { projectsPendingCount: res.data?.count ?? 0 },
          );
        })
        // Silencioso a proposito: un fallo del count es secundario (el badge
        // mantiene su ultimo valor; el poll 60s reconvergira). No spameamos toasts.
        .catch(() => {});
    }, DEBOUNCE_MS);
  },

  refetchAll: (orgId, opts) => {
    if (!orgId) return;
    const includeApprovals = opts?.includeApprovals ?? true;
    const includeProjects = opts?.includeProjects ?? true;
    // Llamamos al propio refetch para reusar el debounce por-kind.
    const { refetch } = useBadgeStore.getState();
    refetch('tickets', orgId);
    if (includeProjects) refetch('projects', orgId);
    if (includeApprovals) refetch('approvals', orgId);
  },
}));
