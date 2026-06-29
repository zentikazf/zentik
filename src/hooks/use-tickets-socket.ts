'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocket, connectSocket } from '@/lib/socket';

export type TicketsWsEvents = {
  'ticket:updated'?: (payload: { ticketId: string; status?: string; previousStatus?: string }) => void;
  'ticket:created'?: (payload: { ticketId: string; title?: string }) => void;
  'ticket:closed'?: (payload: { ticketId: string; reason?: string }) => void;
  'ticket:assigned'?: (payload: {
    ticketId: string;
    taskId?: string;
    previousAssigneeId?: string | null;
    newAssigneeId?: string | null;
  }) => void;
};

// 'auth-error' (#19 BAJO-2 AC6): estado TERMINAL — la sesion ya no es valida, el
// handler central de lib/socket.ts dispara el logout. La UI lo compara por
// igualdad (no switch exhaustivo), asi que extenderlo es backward-compatible.
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'auth-error';

/**
 * Hook que conecta al namespace /tickets, valida membership con join-org
 * y expone:
 *   - status de conexion para UI feedback
 *   - hint para activar polling fallback si WS lleva >30s desconectado
 *
 * Uso:
 *   const { status, shouldFallbackPoll } = useTicketsSocket(orgId, {
 *     'ticket:updated': (p) => loadTickets(),
 *   });
 */
export function useTicketsSocket(
  orgId: string | null | undefined,
  handlers: TicketsWsEvents = {},
): { status: ConnectionStatus; shouldFallbackPoll: boolean } {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [shouldFallbackPoll, setShouldFallbackPoll] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!orgId) return;

    const socket = getSocket('/tickets');
    connectSocket('/tickets');

    const onConnect = () => {
      setStatus('connected');
      setShouldFallbackPoll(false);
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      // Re-join org room (tambien al reconectar)
      socket.emit('tickets:join-org', { orgId });
    };

    const onDisconnect = (reason: string) => {
      // Rechazo de auth server-side (#19 BAJO-2 AC6): el backend invalido la sesion
      // (`disconnect(true)` → este reason, sin auto-reconexion). Estado TERMINAL,
      // NO armamos el timer de polling (no tiene sentido reintentar sin sesion).
      // El logout lo dispara el handler central de lib/socket.ts.
      if (reason === 'io server disconnect') {
        setStatus('auth-error');
        if (fallbackTimerRef.current) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        return;
      }
      // Resto de reasons (transport close / ping timeout / etc.) = transitorio.
      setStatus('disconnected');
      // Si WS sigue caido pasados 30s → activar polling fallback
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = setTimeout(() => {
        setShouldFallbackPoll(true);
      }, 30000);
    };

    // connect_error es SIEMPRE transitorio (#19 BAJO-2 AC6): mantiene reintento +
    // fallback, NUNCA logout. El auth-fail viaja por `disconnect` reason, no aca.
    const onConnectError = () => {
      setStatus('disconnected');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    // Subscribir a los eventos de tickets via wrappers que consultan handlersRef
    const wrappers: Record<string, (...args: unknown[]) => void> = {};
    const eventNames: (keyof TicketsWsEvents)[] = [
      'ticket:updated',
      'ticket:created',
      'ticket:closed',
      'ticket:assigned',
    ];
    for (const name of eventNames) {
      const wrapper = (...args: unknown[]) => {
        const h = handlersRef.current[name];
        if (h) (h as (...a: unknown[]) => void)(...args);
      };
      wrappers[name] = wrapper;
      socket.on(name, wrapper);
    }

    // Si ya estaba conectado antes de montar, dispara onConnect manual
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      for (const name of eventNames) {
        socket.off(name, wrappers[name]);
      }
      socket.emit('tickets:leave-org', { orgId });
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [orgId]);

  return { status, shouldFallbackPoll };
}
