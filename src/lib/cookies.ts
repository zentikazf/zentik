/**
 * Helpers minimos para cookies del cliente.
 *
 * Sin dependencias externas (no js-cookie) — usa document.cookie directo.
 * Uso principal: persistir el ultimo query string de filtros en /tickets
 * para que cuando el usuario vuelva a entrar a la pagina, se restauren.
 *
 * Notas de seguridad:
 * - SameSite=Lax por default (mitiga CSRF moderado).
 * - El path se pasa explicito para no contaminar otras rutas.
 * - No setea Secure flag — el browser lo agrega solo si la pagina es HTTPS.
 * - encodeURIComponent en el valor para soportar `=`, `&`, `;` en QS.
 */

export interface SetCookieOptions {
  /** Path donde la cookie es valida. Default: `/` */
  path?: string;
  /** Duracion en dias. Default: 30. */
  days?: number;
}

export function setCookie(name: string, value: string, days = 30, options: Omit<SetCookieOptions, 'days'> = {}): void {
  if (typeof document === 'undefined') return;
  const { path = '/' } = options;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=${path}; SameSite=Lax`;
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const rows = document.cookie.split('; ');
  const match = rows.find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return null;
  }
}

export function deleteCookie(name: string, path = '/'): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
}
