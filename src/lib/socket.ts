import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Cache de sockets por namespace para reusar conexiones
const sockets: Map<string, Socket> = new Map();

/**
 * Estado de conexion clasificado (#19 BAJO-2). Distingue un fallo de auth (la
 * sesion ya no es valida → hay que cerrar sesion) de uno transitorio (red caida →
 * reintentar). El backend emite `auth:error` como senal primaria; el
 * `'io server disconnect'` queda de respaldo.
 */
export type SocketConnState = 'connecting' | 'connected' | 'transient' | 'auth-error';

/**
 * Handler global de fallo de auth (#19 BAJO-2). useAuth lo cablea con `logout()`.
 * Se invoca cuando un socket recibe `auth:error` o un `'io server disconnect'`
 * (rechazo de auth server-side). El logout debe ser idempotente (lo dispara tanto
 * el auth-fail como el logout/revoke normal del #18).
 */
let onAuthFail: (() => void) | null = null;

export function setAuthFailHandler(fn: (() => void) | null): void {
  onAuthFail = fn;
}

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
 * Marca el socket de un namespace como auth-error (#19 BAJO-2 AC3).
 * - `disconnect()` corta la conexion (y detiene la auto-reconexion).
 * - `sockets.delete(namespace)` limpia el cache para que el proximo getSocket()
 *   cree uno fresco con token nuevo (evita reusar un socket con token stale).
 * - Invoca `onAuthFail()` (logout idempotente).
 *
 * NO usa `removeAllListeners()`: el socket `/chat` es COMPARTIDO (portal-sidebar,
 * chat-window, ticket-chat lo montan a la vez) y cada consumidor hace su propio
 * `socket.off` en cleanup. Borrar todos los listeners aca romperia a los demas.
 */
function markAuthError(namespace: string): void {
  const s = sockets.get(namespace);
  if (s) {
    s.disconnect();
    sockets.delete(namespace);
  }
  onAuthFail?.();
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

  // Listeners de clasificacion de auth (#19 BAJO-2). Registrados UNA sola vez en
  // la rama de CREACION (`!existing`) para no duplicarlos en sockets cacheados.
  // `auth:error` es la senal primaria (tipada, emitida por el backend antes del
  // disconnect); `'io server disconnect'` es el respaldo (rechazo de auth en el
  // handshake → el cliente no recibe connect_error, recibe ese reason).
  socket.on('auth:error', () => {
    markAuthError(namespace);
  });
  socket.on('disconnect', (reason: string) => {
    if (reason === 'io server disconnect') {
      markAuthError(namespace);
    }
  });
  // Al reintentar reconectar, refresca el token del handshake (fix token stale):
  // si la cookie cambio (re-login), el socket reconecta con el token vigente.
  socket.io.on('reconnect_attempt', () => {
    const fresh = getSessionToken();
    socket.auth = fresh ? { token: fresh } : {};
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
    if (s) s.disconnect();
    // Limpiar el cache (#19 BAJO-2 AC5): sin esto, un re-login reusa el socket
    // viejo con token stale. Quitamos tambien el guard `if (s.connected)` para
    // poder cerrar sockets en estado reconnecting.
    sockets.delete(namespace);
    return;
  }
  // Sin namespace → desconecta y limpia todos
  sockets.forEach((s) => {
    s.disconnect();
  });
  sockets.clear();
}
