'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import type {
  TicketsBreakdownFilters,
  TicketsBreakdownResponse,
} from '@/types/tickets-breakdown';

interface UseTicketsBreakdownResult {
  data: TicketsBreakdownResponse | null;
  loading: boolean;
  error: ApiError | Error | null;
  /** Re-fetch manual (usado por el boton "Reintentar" del modal). */
  refetch: () => void;
}

/**
 * Hook de fetch lazy del breakdown de tickets (drill-down del dashboard).
 *
 * - `enabled`: cuando es `false`, NO dispara el fetch. Util para fetch lazy
 *   on-open del modal (asi no penalizamos el load inicial del dashboard).
 * - Re-fetcha cuando cambian los filtros relevantes (startDate, endDate,
 *   clientId, memberId).
 * - Usa flag `cancelled` para evitar setState despues de unmount o re-fetch
 *   (patron estandar del repo: ver `loadDashboard` en `dashboard/page.tsx`).
 *
 * Sigue el patron de `useEffect + api.get` del dashboard actual. No introduce
 * react-query porque el dashboard tampoco lo usa todavia (consistencia).
 */
export function useTicketsBreakdown(
  orgId: string | undefined,
  filters: TicketsBreakdownFilters,
  enabled: boolean,
): UseTicketsBreakdownResult {
  const [data, setData] = useState<TicketsBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  // refetchToken bump = nuevo ciclo del effect sin cambiar filters (retry).
  const [refetchToken, setRefetchToken] = useState(0);

  const refetch = useCallback(() => {
    setRefetchToken((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !orgId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.clientId) params.set('clientId', filters.clientId);
    if (filters.memberId) params.set('memberId', filters.memberId);
    const qs = params.toString();
    const endpoint = `/organizations/${orgId}/dashboard/tickets-breakdown${qs ? `?${qs}` : ''}`;

    api
      .get<TicketsBreakdownResponse>(endpoint)
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Error desconocido'));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    orgId,
    enabled,
    filters.startDate,
    filters.endDate,
    filters.clientId,
    filters.memberId,
    refetchToken,
  ]);

  return { data, loading, error, refetch };
}
