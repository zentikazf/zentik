'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getCookie, setCookie } from '@/lib/cookies';
import type { TicketStatus } from '@/types/ticket.types';

// ─── Tipos ────────────────────────────────────────────────────────────────

export type StatusTab = 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'RESOLVED' | 'all';

export type CriticalityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type TicketCategoryType = 'SUPPORT_REQUEST' | 'NEW_DEVELOPMENT';

export type SlaOutcome =
  | 'COMPLIED'
  | 'BREACHED_RESPONSE'
  | 'BREACHED_RESOLUTION'
  | 'BREACHED_BOTH'
  | 'NO_SLA';

export type OvershootBucket = 'LT_1H' | 'BETWEEN_1_4H' | 'BETWEEN_4_24H' | 'GT_24H';

export type SortBy = 'resolvedAt' | 'overshoot' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface TicketsFilters {
  status: StatusTab;
  search: string;
  clientId: string | null;
  projectId: string | null;
  categoryConfigId: string | null;
  assigneeId: string | null;

  // Multi-select facets
  criticality: CriticalityLevel[];
  category: TicketCategoryType[];

  // Facets RESOLVED
  slaOutcome: SlaOutcome[];
  overshootBucket: OvershootBucket | null;
  resolvedFrom: string | null; // YYYY-MM-DD
  resolvedTo: string | null;   // YYYY-MM-DD

  sortBy: SortBy | null;
  sortOrder: SortOrder | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────

const COOKIE_KEY = 'zentikk.last_tickets_query';
const COOKIE_MAX_BYTES = 4096;
const COOKIE_PATH = '/tickets';
const COOKIE_DAYS = 30;

/**
 * Params del listing que NO son filtros pero viven en la misma URL.
 * Cuando el hook serializa los filtros, preserva estos params del searchParams
 * actual para no pisar el panel lateral ni el ticket seleccionado.
 */
const PRESERVED_PARAMS = ['ticket', 'panel'] as const;

const VALID_TABS: StatusTab[] = ['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'RESOLVED', 'all'];
const VALID_CRITICALITIES: CriticalityLevel[] = ['HIGH', 'MEDIUM', 'LOW'];
const VALID_CATEGORIES: TicketCategoryType[] = ['SUPPORT_REQUEST', 'NEW_DEVELOPMENT'];
const VALID_SLA_OUTCOMES: SlaOutcome[] = [
  'COMPLIED',
  'BREACHED_RESPONSE',
  'BREACHED_RESOLUTION',
  'BREACHED_BOTH',
  'NO_SLA',
];
const VALID_OVERSHOOT_BUCKETS: OvershootBucket[] = ['LT_1H', 'BETWEEN_1_4H', 'BETWEEN_4_24H', 'GT_24H'];
const VALID_SORT_BY: SortBy[] = ['resolvedAt', 'overshoot', 'createdAt'];
const VALID_SORT_ORDER: SortOrder[] = ['asc', 'desc'];

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseEnum<T extends string>(value: string | null, allowed: T[]): T | null {
  if (!value) return null;
  return (allowed as string[]).includes(value) ? (value as T) : null;
}

function parseEnumArray<T extends string>(value: string | null, allowed: T[]): T[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v): v is T => (allowed as string[]).includes(v));
}

/**
 * Source of truth: URL. Esto parsea el SearchParams y produce filters
 * tolerantes a basura (valores no permitidos se descartan).
 */
export function parseFiltersFromSearchParams(sp: URLSearchParams): TicketsFilters {
  const rawStatus = sp.get('status');
  // Legacy: ?status=CLOSED → degrada a OPEN (feature #10)
  const status: StatusTab =
    rawStatus && VALID_TABS.includes(rawStatus as StatusTab)
      ? (rawStatus as StatusTab)
      : 'OPEN';

  return {
    status,
    search: sp.get('search') ?? '',
    clientId: sp.get('clientId'),
    projectId: sp.get('projectId'),
    categoryConfigId: sp.get('categoryConfigId'),
    assigneeId: sp.get('assigneeId'),
    criticality: parseEnumArray(sp.get('criticality'), VALID_CRITICALITIES),
    category: parseEnumArray(sp.get('category'), VALID_CATEGORIES),
    slaOutcome: parseEnumArray(sp.get('slaOutcome'), VALID_SLA_OUTCOMES),
    overshootBucket: parseEnum(sp.get('overshootBucket'), VALID_OVERSHOOT_BUCKETS),
    resolvedFrom: sp.get('resolvedFrom'),
    resolvedTo: sp.get('resolvedTo'),
    sortBy: parseEnum(sp.get('sortBy'), VALID_SORT_BY),
    sortOrder: parseEnum(sp.get('sortOrder'), VALID_SORT_ORDER),
  };
}

/**
 * Serializa los filtros a URLSearchParams. Omite valores vacios / default
 * para mantener la URL limpia.
 */
export function serializeFilters(filters: Partial<TicketsFilters>): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== 'OPEN') params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.clientId) params.set('clientId', filters.clientId);
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.categoryConfigId) params.set('categoryConfigId', filters.categoryConfigId);
  if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
  if (filters.criticality && filters.criticality.length > 0) {
    params.set('criticality', filters.criticality.join(','));
  }
  if (filters.category && filters.category.length > 0) {
    params.set('category', filters.category.join(','));
  }
  if (filters.slaOutcome && filters.slaOutcome.length > 0) {
    params.set('slaOutcome', filters.slaOutcome.join(','));
  }
  if (filters.overshootBucket) params.set('overshootBucket', filters.overshootBucket);
  if (filters.resolvedFrom) params.set('resolvedFrom', filters.resolvedFrom);
  if (filters.resolvedTo) params.set('resolvedTo', filters.resolvedTo);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

  return params;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

/**
 * Hook senior que centraliza el manejo de filtros del listing /tickets.
 *
 * Source of truth: URL search params. Cada cambio se refleja en URL via
 * router.replace + persistencia en cookie para que la proxima visita
 * restaure el ultimo estado.
 *
 * Limites:
 * - Cookie max 4KB (sino se ignora silenciosamente).
 * - Cookie path=/tickets para no contaminar el resto de la app.
 * - Valores invalidos en URL/cookie se filtran a default sin romper.
 */
export function useTicketsFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Solo restauramos cookie en la primera render (entry "limpio").
  const cookieRestoredRef = useRef(false);

  const filters = useMemo<TicketsFilters>(
    () => parseFiltersFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  /**
   * Aplica un patch a los filtros actuales y actualiza la URL + cookie.
   * Pasar `null` o `[]` para limpiar un campo.
   *
   * Preserva los params del listing que NO son filtros (ej. `ticket`, `panel`).
   */
  const applyFilters = useCallback(
    (patch: Partial<TicketsFilters>) => {
      const next: TicketsFilters = { ...filters, ...patch };
      const params = serializeFilters(next);

      // Restaurar params no-filtros del searchParams actual.
      for (const key of PRESERVED_PARAMS) {
        const value = searchParams.get(key);
        if (value !== null) params.set(key, value);
      }

      const qs = params.toString();

      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });

      // Persist cookie solo con los filtros (sin params preservados).
      // El cookie restaura filtros, no estado UI (panel/ticket).
      const filtersOnly = serializeFilters(next).toString();
      if (filtersOnly.length <= COOKIE_MAX_BYTES) {
        setCookie(COOKIE_KEY, filtersOnly, COOKIE_DAYS, { path: COOKIE_PATH });
      }
    },
    [filters, pathname, router, searchParams],
  );

  /**
   * Limpia todos los filtros (vuelve a estado default).
   * Preserva params no-filtros del listing.
   */
  const resetFilters = useCallback(() => {
    const params = new URLSearchParams();
    for (const key of PRESERVED_PARAMS) {
      const value = searchParams.get(key);
      if (value !== null) params.set(key, value);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    setCookie(COOKIE_KEY, '', COOKIE_DAYS, { path: COOKIE_PATH });
  }, [pathname, router, searchParams]);

  // Effect: en la primera carga, si la URL viene vacia y existe cookie,
  // restaurar el ultimo query string guardado.
  useEffect(() => {
    if (cookieRestoredRef.current) return;
    cookieRestoredRef.current = true;

    if (searchParams.toString() !== '') return;

    const saved = getCookie(COOKIE_KEY);
    if (!saved || saved.length > COOKIE_MAX_BYTES) return;

    try {
      const trimmed = saved.trim();
      if (trimmed.length === 0) return;
      // Sanity check: que parsee como URLSearchParams valido
      const parsed = new URLSearchParams(trimmed);
      const status = parsed.get('status');
      // Defensa: cookie con ?status=CLOSED (legacy) → ignorar el param
      if (status === 'CLOSED') parsed.delete('status');
      const cleanedQs = parsed.toString();
      if (cleanedQs.length === 0) return;
      router.replace(`${pathname}?${cleanedQs}`, { scroll: false });
    } catch {
      // cookie corrupta → ignorar
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { filters, applyFilters, resetFilters };
}

// ─── Helpers de uso externo ────────────────────────────────────────────────

/**
 * Construye un objeto plano de query params listo para mandar al backend.
 * Filtra los nulls/vacios. Util para el ticketService.list().
 */
export function buildBackendQuery(filters: TicketsFilters): Record<string, string | number | undefined> {
  const out: Record<string, string | number | undefined> = {};

  if (filters.status !== 'all') {
    out.status = filters.status as TicketStatus;
  }
  if (filters.search) out.search = filters.search;
  if (filters.clientId) out.clientId = filters.clientId;
  if (filters.projectId) out.projectId = filters.projectId;
  if (filters.categoryConfigId) out.categoryConfigId = filters.categoryConfigId;
  if (filters.assigneeId) out.assigneeId = filters.assigneeId;
  if (filters.criticality.length > 0) out.criticality = filters.criticality.join(',');
  if (filters.category.length > 0) out.category = filters.category.join(',');
  if (filters.slaOutcome.length > 0) out.slaOutcome = filters.slaOutcome.join(',');
  if (filters.overshootBucket) out.overshootBucket = filters.overshootBucket;
  if (filters.resolvedFrom) out.resolvedFrom = filters.resolvedFrom;
  if (filters.resolvedTo) out.resolvedTo = filters.resolvedTo;
  if (filters.sortBy) out.sortBy = filters.sortBy;
  if (filters.sortOrder) out.sortOrder = filters.sortOrder;

  return out;
}
