'use client';

import { useEffect } from 'react';

const VERSION_STORAGE_KEY = 'zentikk-app-version';
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min entre chequeos

/**
 * Provider invisible que chequea /version.json y fuerza una recarga si la version
 * cacheada no coincide con la actual. Previene que clientes con cache vieja (sobre
 * todo mobile con Service Worker viejo) queden trabados en una version anterior.
 *
 * Tambien intenta forzar update del Service Worker registrado al detectar cambio.
 */
export function AppVersionChecker() {
  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        if (!data.version) return;

        const stored = localStorage.getItem(VERSION_STORAGE_KEY);

        if (!stored) {
          localStorage.setItem(VERSION_STORAGE_KEY, data.version);
          return;
        }

        if (stored !== data.version) {
          // Nueva version detectada — guardar y forzar update del SW + recarga
          localStorage.setItem(VERSION_STORAGE_KEY, data.version);
          try {
            const reg = await navigator.serviceWorker?.getRegistration();
            await reg?.update().catch(() => {});
          } catch {
            // ignore
          }
          if (mounted) {
            window.location.reload();
          }
        }
      } catch {
        // silencioso — no romper si la red falla
      }
    }

    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
