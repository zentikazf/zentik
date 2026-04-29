import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Cache de sockets por namespace para reusar conexiones
const sockets: Map<string, Socket> = new Map();

function getSessionToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const cookies = document.cookie.split('; ');
  for (const cookie of cookies) {
    if (
      cookie.startsWith('zentik.session_token=') ||
      cookie.startsWith('better-auth.session_token=') ||
      cookie.startsWith('__Secure-better-auth.session_token=')
    ) {
      return cookie.split('=').slice(1).join('=');
    }
  }
  return undefined;
}

/**
 * Obtiene (o crea) el socket para un namespace dado.
 * Por defecto usa /chat para mantener compatibilidad con el codigo existente.
 */
export function getSocket(namespace: string = '/chat'): Socket {
  const existing = sockets.get(namespace);
  if (existing) return existing;

  const token = getSessionToken();
  const socket = io(`${SOCKET_URL}${namespace}`, {
    transports: ['websocket', 'polling'],
    autoConnect: false,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    auth: token ? { token } : undefined,
  });
  sockets.set(namespace, socket);
  return socket;
}

export function connectSocket(namespace: string = '/chat'): void {
  const s = getSocket(namespace);
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket(namespace?: string): void {
  if (namespace) {
    const s = sockets.get(namespace);
    if (s?.connected) s.disconnect();
    return;
  }
  // Sin namespace → desconecta todos
  sockets.forEach((s) => {
    if (s.connected) s.disconnect();
  });
}
