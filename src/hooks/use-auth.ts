'use client';

import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearToken } from '@/lib/api-client';
import { disconnectSocket, setAuthFailHandler } from '@/lib/socket';

interface AuthClient {
  id: string;
  name: string;
  portalEnabled: boolean;
  portalBillingEnabled: boolean;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  onboardingCompleted?: boolean;
  mustChangePassword?: boolean;
  createdAt?: string;
  // Cliente al que pertenece (solo cuando el usuario es portal-user de un Client).
  // Null para usuarios internos (staff de la organizacion). Expone feature flags
  // por cliente para gating multitenant (portalBillingEnabled, etc).
  client?: AuthClient | null;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  roleId: string;
  roleName: string;
  permissions: string[];
}

interface SessionResponse {
  user: AuthUser;
  organizations: Organization[];
}

interface AuthState {
  user: AuthUser | null;
  organizations: Organization[];
  loading: boolean;
}

// ────────────────────────────────────────────────────────────────────
// Module-level singleton store — UNA sola fuente de verdad para todo el
// arbol. Antes useAuth era un hook con state local: cada componente que
// lo llamaba disparaba su propio GET /auth/me, generando bombardeo al
// backend (rate limit Throttler). Ahora hay un solo fetch deduplicado y
// todos los consumidores se suscriben al mismo estado via
// useSyncExternalStore.
// ────────────────────────────────────────────────────────────────────

let state: AuthState = {
  user: null,
  organizations: [],
  loading: true,
};

let fetchPromise: Promise<void> | null = null;
// Guard re-entrante del logout (#19 BAJO-2 AC4). El logout puede dispararse desde
// el boton de UI Y desde el handler de auth-fail del socket (`'io server
// disconnect'` lo produce tanto el auth-fail como el logout/revoke normal del
// #18). Sin este guard habria doble POST /auth/logout + doble router.push.
let loggingOut = false;
const listeners = new Set<() => void>();

function setState(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthState {
  return state;
}

function fetchSession(): Promise<void> {
  // Deduplicacion: si ya hay un fetch en curso, devolverlo en lugar de disparar otro.
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const response = await api.get<SessionResponse>('/auth/me');
      setState({
        user: response.data.user,
        organizations: response.data.organizations,
        loading: false,
      });
    } catch {
      setState({
        user: null,
        organizations: [],
        loading: false,
      });
    } finally {
      // Liberar la promesa para permitir refetch manual (ej: tras logout/login)
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

// Forzar un refetch despues de cambios externos en la sesion (login/register/reset).
// El store es module-level: sin esto, el state cacheado durante /login queda con
// user=null incluso despues del POST /auth/login, y la navegacion a /dashboard
// te rebota a /login (solo Ctrl+Shift+R lo arreglaba porque resetea el modulo).
//
// IMPORTANTE: NO resetear el state a null/loading=true antes del fetch — eso
// hace que cualquier layout protegido muestre flash de loading durante el
// redirect post-login (efecto "refresh visible" que el user reporto). En vez
// de eso, hacemos fetch en background y updateamos cuando llega.
export async function refreshSession(): Promise<void> {
  fetchPromise = null;
  await fetchSession();
}

export function useAuth() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const router = useRouter();

  useEffect(() => {
    // Solo el primer consumidor que monta dispara el fetch. Los siguientes
    // se suscriben al state existente y no hacen request adicional.
    if (state.loading && !fetchPromise) {
      fetchSession();
    }
  }, []);

  const logout = useCallback(async () => {
    // Idempotente (#19 BAJO-2 AC4): si ya hay un logout en curso o el usuario ya
    // se deslogueo, no repetir. Evita doble POST /auth/logout + doble push cuando
    // el auth-fail del socket y el boton de UI se disparan casi simultaneos.
    if (loggingOut || state.user == null) return;
    loggingOut = true;
    try {
      await api.post('/auth/logout');
    } finally {
      // Cerrar los sockets /chat y /tickets del lado cliente (R4 AC4). Sin esto,
      // aunque el backend invalide la sesion, el socket-client intentaria
      // reconectar tras el disconnect del servidor. Sin namespace → cierra ambos.
      disconnectSocket();
      // Limpiar Bearer token de localStorage (auth mobile cross-domain).
      clearToken();
      // Reset completo del store para que la siguiente sesion arranque limpia
      fetchPromise = null;
      setState({
        user: null,
        organizations: [],
        loading: false,
      });
      router.push('/login');
      loggingOut = false;
    }
  }, [router]);

  // Cablear el handler global de auth-fail del socket (#19 BAJO-2 AC4): cuando un
  // socket recibe `auth:error` o un `'io server disconnect'` de rechazo, hace
  // logout. El guard idempotente lo protege de disparos duplicados.
  useEffect(() => {
    setAuthFailHandler(() => {
      void logout();
    });
    return () => {
      setAuthFailHandler(null);
    };
  }, [logout]);

  return {
    user: snapshot.user,
    organizations: snapshot.organizations,
    loading: snapshot.loading,
    logout,
    isAuthenticated: !!snapshot.user,
  };
}
