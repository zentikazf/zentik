import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy', { locale: es });
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy HH:mm', { locale: es });
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string | null | undefined = 'PYG',
): string {
  if (amount === null || amount === undefined) return '—';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(num)) return '—';

  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: currency || 'PYG',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// H4 — Horas con coma decimal es-PY: 90 → "1,5 h" (toFixed daría punto).
export function formatHoursFromMinutes(minutes: number): string {
  const value = new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(minutes / 60);
  return `${value} h`;
}

// H4 — Fecha de trabajo corta es-PY: '2026-07-20' → "dom 20/07". Parseo date-only
// (medianoche LOCAL) para no correr un día por la zona horaria en el display.
export function formatWorkedOn(date: string): string {
  return format(new Date(`${date.slice(0, 10)}T00:00:00`), 'EEE dd/MM', { locale: es });
}
