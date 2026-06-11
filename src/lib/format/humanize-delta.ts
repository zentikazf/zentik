/**
 * Formatea una diferencia en minutos a texto humano corto.
 *
 * Reglas:
 * - <= 0 minutos → "+0" (caso borde: timestamps invertidos).
 * - <1h → "Xm".
 * - <1d con minutos > 0 → "Xh Ym".
 * - <1d sin minutos → "Xh".
 * - >=1d con horas > 0 → "Xd Yh".
 * - >=1d sin horas → "Xd".
 *
 * Ejemplos:
 * humanizeDelta(15) → "15m"
 * humanizeDelta(75) → "1h 15m"
 * humanizeDelta(120) → "2h"
 * humanizeDelta(1440) → "1d"
 * humanizeDelta(1500) → "1d 1h"
 * humanizeDelta(2880) → "2d"
 */
export function humanizeDelta(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '+0';
  const totalMinutes = Math.floor(minutes);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const mins = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}

/**
 * Diferencia en minutos entre dos ISO timestamps (o Date).
 * Retorna 0 si alguno es invalido.
 */
export function diffMin(from: string | Date | null | undefined, to: string | Date | null | undefined): number {
  if (!from || !to) return 0;
  const a = typeof from === 'string' ? new Date(from) : from;
  const b = typeof to === 'string' ? new Date(to) : to;
  const ta = a.getTime();
  const tb = b.getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
  return Math.max(0, Math.floor((tb - ta) / 60000));
}
