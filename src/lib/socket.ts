import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

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

export function getSocket(): Socket {
  if (!socket) {
    const token = getSessionToken();
    socket = io(`${SOCKET_URL}/chat`, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      withCredentials: true,
      auth: token ? { token } : undefined,
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
