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
  // Senal fina de invalidacion del badge de aprobaciones (#20). El backend la
  // emite a `org:{orgId}` ante cualquier transicion de aprobacion; el cliente
  // refetchea el count() real. Reusa la misma room/conexion que los ticket:*.
  'approvals:updated'?: (payload: { orgId: string }) => void;
};

/**
 * Ref-count de joins por orgId a nivel de MODULO (#20, decision D-leave).
 *
 * El socket `/tickets` es UNO solo, cacheado por namespace (lib/socket.ts), y
 * Socket.IO NO hace ref-count de rooms por consumidor: `leave-org` saca a TODA
 * la conexion de la room. Hoy hay 2 consumidores del hook sobre esa conexion:
 * `tickets/page.tsx` (efimero) y el `sidebar.tsx` (montado permanente). Sin este
 * ref-count, navegar fuera de `/tickets` dispararia el `leave-org` del cleanup
 * de la pagina → el sidebar, aun montado, quedaria mudo el resto de la sesion
 * (solo lo salvaria el poll 60s, degradando "realtime" a "cada 60s" en silencio).
 *
 * Con el ref-count: `join-org` se emite solo en la transicion 0→1 (primer
 * consumidor de ese orgId) y `leave-org` solo en 1→0 (ultimo consumidor sale).
 * El re-join en `connect` (reconexion) sigue siendo incondicional e idempotente:
 * Socket.IO re-aplica el join a la nueva conexion para TODOS los consumidores.
 */
const orgJoinCounts: Map<string, number> = new Map();

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

    // Ref-count: registramos a este consumidor para el orgId (#20 D-leave). Si es
    // el PRIMERO (0→1) y el socket ya esta conectado, emitimos el join aca (si no
    // esta conectado aun, el `onConnect` re-join incondicional lo cubrira). Para
    // consumidores 2..N el join ya esta vigente sobre la conexion compartida.
    const prevCount = orgJoinCounts.get(orgId) ?? 0;
    orgJoinCounts.set(orgId, prevCount + 1);
    if (prevCount === 0 && socket.connected) {
      socket.emit('tickets:join-org', { orgId });
    }

    // Subscribir a los eventos de tickets via wrappers que consultan handlersRef
    const wrappers: Record<string, (...args: unknown[]) => void> = {};
    const eventNames: (keyof TicketsWsEvents)[] = [
      'ticket:updated',
      'ticket:created',
      'ticket:closed',
      'ticket:assigned',
      'approvals:updated',
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
      // Ref-count leave (#20 D-leave): solo emitimos `leave-org` cuando ESTE es el
      // ULTIMO consumidor del orgId (1→0). Si quedan otros (p.ej. el sidebar
      // persistente cuando la pagina /tickets desmonta), NO sacamos a la conexion
      // compartida de la room — esos consumidores seguirian mudos si lo hicieramos.
      const remaining = (orgJoinCounts.get(orgId) ?? 1) - 1;
      if (remaining <= 0) {
        orgJoinCounts.delete(orgId);
        socket.emit('tickets:leave-org', { orgId });
      } else {
        orgJoinCounts.set(orgId, remaining);
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [orgId]);

  return { status, shouldFallbackPoll };
}
