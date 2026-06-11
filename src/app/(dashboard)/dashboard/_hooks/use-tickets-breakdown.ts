'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  // Dedupe defensivo: aunque el padre memoize filters, en algunos casos React
  // dispara el effect varias veces seguidas (StrictMode, batches de setState
  // consecutivos). Comparamos el query serializado contra el ultimo ejecutado
  // y salimos early si es identico — previene 2-3 calls duplicados al mismo
  // endpoint en milisegundos sin afectar el refetch manual (que bumpea token).
  const lastQueryRef = useRef<string | null>(null);

  const refetch = useCallback(() => {
    // Limpiar ref para que el effect dispare aunque los filtros no cambien.
    lastQueryRef.current = null;
    setRefetchToken((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !orgId) return;

    let cancelled = false;

    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.clientId) params.set('clientId', filters.clientId);
    if (filters.memberId) params.set('memberId', filters.memberId);
    const qs = params.toString();
    const endpoint = `/organizations/${orgId}/dashboard/tickets-breakdown${qs ? `?${qs}` : ''}`;

    // Dedupe: misma query ya en flight o ya completada -> no re-fetch.
    if (lastQueryRef.current === endpoint) return;
    lastQueryRef.current = endpoint;

    setLoading(true);
    setError(null);

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
