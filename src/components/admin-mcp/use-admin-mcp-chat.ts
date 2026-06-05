'use client';

import { useCallback, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

export type ChatStage = 'idle' | 'thinking' | 'querying' | 'responding' | 'error';

export interface ToolCallSummary {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  latencyMs?: number;
}

export interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallSummary[];
  createdAt: number;
}

interface ChatResponse {
  reply: string;
  toolCalls: ToolCallSummary[];
  traceId: string;
  iterations?: number;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Hook stateless del lado cliente. Mantiene el historial en memoria — NO
 * persiste en localStorage ni en DB (R14). Al cerrar el modal el state
 * sobrevive solo si el componente padre sigue montado.
 *
 * Cada turno re-envia el historial completo al backend (R3 design: stateless).
 */
export function useAdminMcpChat() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<ChatStage>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setMessages([]);
    setLoading(false);
    setStage('idle');
    setError(null);
  }, []);

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || loading) return;

      const userMsg: UiMessage = {
        id: makeId(),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      };

      // Capturamos el historial actual + el mensaje nuevo para mandarlo al backend.
      // El backend NO persiste estado: cada turno necesita el contexto completo.
      const nextHistory: UiMessage[] = [...messages, userMsg];

      setMessages(nextHistory);
      setLoading(true);
      setStage('thinking');
      setError(null);

      try {
        // Stage hint: backend responde batch JSON, pero los stages se simulan
        // localmente. Mostramos "Consultando datos..." mientras corre el await.
        // El backend orquesta tools/list + tools/call internamente.
        const hintTimer = setTimeout(() => {
          setStage('querying');
        }, 1500);

        const payload = {
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        };

        const res = await api.post<ChatResponse>('/admin/mcp/chat', payload);
        clearTimeout(hintTimer);

        setStage('responding');

        const assistantMsg: UiMessage = {
          id: makeId(),
          role: 'assistant',
          content: res.data.reply,
          toolCalls: res.data.toolCalls,
          createdAt: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setStage('idle');
      } catch (err) {
        setStage('error');

        // Mapeo defensivo de errores del backend (ya vienen sanitizados).
        // El api-client redirige a /login automaticamente en 401, asi que
        // aca solo manejamos 403/429/422/5xx.
        let message = 'Error del servicio. Reintenta en unos momentos.';
        if (err instanceof ApiError) {
          if (err.statusCode === 429) {
            message = err.message || 'Demasiadas consultas, espere un momento.';
            toast.error('Limite alcanzado', message);
          } else if (err.statusCode === 422) {
            message = err.message || 'Mensaje invalido.';
            toast.error('Mensaje invalido', message);
          } else if (err.statusCode === 403) {
            message = 'No tienes acceso a este recurso.';
            toast.error('Sin acceso', message);
          } else if (err.statusCode >= 500) {
            message = err.message || 'El servicio no esta disponible. Reintenta.';
            toast.error('Servicio no disponible', message);
          } else {
            message = err.message || message;
            toast.error('Error', message);
          }
        } else {
          toast.error('Error', message);
        }
        setError(message);
        // Removemos el mensaje user del historial para que el usuario pueda
        // reintentar sin que se dupliquen mensajes (mejor UX que dejar el
        // mensaje colgando sin respuesta).
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setLoading(false);
        // Volvemos a idle en el proximo tick para que la UI registre el cambio
        // de stage 'responding' antes de limpiarlo.
        setTimeout(() => setStage((s) => (s === 'error' ? 'error' : 'idle')), 200);
      }
    },
    [messages, loading],
  );

  return {
    messages,
    loading,
    stage,
    error,
    send,
    reset,
  };
}
