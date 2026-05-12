/**
 * Convierte una clave pública VAPID en base64 URL-safe a Uint8Array,
 * formato que requiere `PushManager.subscribe({ applicationServerKey })`.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// ── Detección de browser ────────────────────────────────────────────────

export type BrowserKind =
  | 'chrome'
  | 'edge'
  | 'firefox'
  | 'safari-desktop'
  | 'safari-ios'
  | 'samsung'
  | 'unknown';

export interface BrowserSupportInfo {
  supported: boolean;
  browser: BrowserKind;
  reason?:
    | 'not-supported'
    | 'ios-needs-pwa'
    | 'safari-old-version'
    | 'unknown-browser';
  hint?: string;
}

/** Detecta el navegador y su soporte para Web Push */
export function getBrowserSupportInfo(): BrowserSupportInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, browser: 'unknown', reason: 'unknown-browser' };
  }

  const ua = navigator.userAgent;
  const browser = detectBrowser(ua);

  // iOS Safari requiere PWA instalada (iOS 16.4+)
  if (browser === 'safari-ios') {
    const isPWA =
      (window.matchMedia?.('(display-mode: standalone)').matches ?? false) ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (!isPWA) {
      return {
        supported: false,
        browser,
        reason: 'ios-needs-pwa',
        hint:
          'En iPhone tenés que agregar esta app a tu pantalla de inicio para activar notificaciones. Tocá el botón Compartir y elegí "Agregar a inicio".',
      };
    }
    // PWA instalada: dependerá de iOS 16.4+. Confiamos en isPushSupported() como gate real.
  }

  // Safari desktop: requiere Safari 16+ en macOS 13+
  if (browser === 'safari-desktop') {
    const match = ua.match(/Version\/(\d+)/);
    const major = match ? parseInt(match[1], 10) : 0;
    if (major < 16) {
      return {
        supported: false,
        browser,
        reason: 'safari-old-version',
        hint: 'Necesitás Safari 16 o superior. Actualizá macOS o usá Chrome/Firefox.',
      };
    }
  }

  if (!isPushSupported()) {
    return {
      supported: false,
      browser,
      reason: 'not-supported',
      hint: 'Tu navegador no soporta notificaciones push. Probá Chrome, Firefox o Edge.',
    };
  }

  return { supported: true, browser };
}

function detectBrowser(ua: string): BrowserKind {
  // Orden importa: Edge antes que Chrome porque Edge contiene "Chrome" en UA
  if (/Edg\//.test(ua)) return 'edge';
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  if (/Firefox/.test(ua)) return 'firefox';
  // iOS: Chrome/Firefox en iOS son Safari por dentro (mismo motor WebKit)
  if (/iPhone|iPad|iPod/.test(ua)) return 'safari-ios';
  if (/Chrome\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua)) return 'safari-desktop';
  return 'unknown';
}

/** Instrucciones específicas por navegador cuando el permiso está denegado */
export function getPermissionDeniedInstructions(browser: BrowserKind): string {
  switch (browser) {
    case 'chrome':
      return 'Hacé clic en el ícono de candado al lado de la URL → Permisos → Notificaciones → Permitir. Después recargá la página.';
    case 'edge':
      return 'Hacé clic en el ícono de candado al lado de la URL → Permisos del sitio → Notificaciones → Permitir. Recargá la página.';
    case 'firefox':
      return 'Hacé clic en el ícono de candado al lado de la URL → Más información → Permisos → Notificaciones → quitar la marca de "Usar valor por defecto" y elegir Permitir.';
    case 'safari-desktop':
      return 'Abrí Safari → Configuración → Sitios web → Notificaciones, buscá este sitio y cambialo a Permitir.';
    case 'safari-ios':
      return 'En iPhone, abrí Configuración del iPhone → Notificaciones → Safari → Permitir notificaciones. Y asegurate de tener la app agregada a la pantalla de inicio.';
    case 'samsung':
      return 'Tocá el ícono de candado en la URL → Permisos del sitio → Notificaciones → Permitir.';
    default:
      return 'Buscá el ícono de candado o configuración al lado de la URL y permití notificaciones para este sitio.';
  }
}
