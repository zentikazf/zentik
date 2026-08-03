import { ApiError } from '@/lib/api-client';

/**
 * Mensaje legible de un error del backend, para el `toast.error`.
 *
 * El `GlobalExceptionFilter` devuelve `error.message` como STRING para las
 * `AppException` de negocio (ya vienen en español), pero como ARRAY cuando el
 * `ValidationPipe` de class-validator rechaza el body. En ese caso `new Error(array)`
 * deja el mensaje como "a,b,c" — acá se une con " · " (patrón que ya usaba a mano
 * `settings/sla/page.tsx` para el horario hábil) y se lee también de `details.message`.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;

  const fromDetails = (err.details as { message?: unknown } | undefined)?.message;
  if (Array.isArray(fromDetails) && fromDetails.length > 0) return fromDetails.join(' · ');
  if (typeof fromDetails === 'string' && fromDetails) return fromDetails;

  return err.message || fallback;
}
