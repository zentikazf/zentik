import { io, Socket } from 'socket.io-client';
import { getToken } from '@/lib/api-client';

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

/**
 * Token para el handshake del socket. DOS fuentes, en este orden.
 *
 * 1) Bearer de localStorage — el MISMO fallback que ya usa `api-client.ts` para el
 *    HTTP. Es el que hace falta cuando el navegador bloquea la cookie cross-domain
 *    (frontend Vercel ↔ backend Railway): third-party cookies desactivadas, Safari/
 *    iOS por defecto, modo estricto de Chrome.
 * 2) Cookie legible — sirve sólo si NO es httpOnly y es same-site.
 *
 * ⚠️ Por qué el orden importa, y por qué esto era un bug de producción: el socket
 * miraba ÚNICAMENTE la cookie. Con la cookie bloqueada, el HTTP seguía andando
 * (tiene su Bearer) pero el handshake salía sin token → el backend lo rechazaba con
 * NO_TOKEN → `'io server disconnect'` → `markAuthError()` → `onAuthFail()` →
 * **logout**. O sea: el usuario entraba, el dashboard cargaba entero con 200, y un
 * segundo después lo devolvía al login. Sin fallback acá, un canal secundario
 * (el WS) tiraba abajo una sesión HTTP perfectamente válida.
 *
 * La lista de nombres de cookie replica la que acepta el backend
 * (`tickets.gateway.ts` / `chat.gateway.ts`) — incluido `__Host-`, que faltaba.
 */
function getSessionToken(): string | undefined {
  const bearer = getToken();
  if (bearer) return bearer;

  if (typeof document === 'undefined') return undefined;
  const cookies = document.cookie.split('; ');
  for (const cookie of cookies) {
    for (const name of [
      '__Host-zentik.session_token',
      'zentik.session_token',
      'better-auth.session_token',
      '__Secure-better-auth.session_token',
    ]) {
      if (cookie.startsWith(`${name}=`)) {
        return cookie.slice(name.length + 1);
      }
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
