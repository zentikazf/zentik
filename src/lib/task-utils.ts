/**
 * Helpers visuales para tareas (labels, opciones de UI).
 * El backend usa los enums del schema Prisma directamente — esto es solo presentación.
 */

export const TASK_TYPE_LABELS: Record<string, string> = {
  PROJECT: 'Interno',
  SUPPORT: 'Soporte',
};

export const TASK_TYPE_OPTIONS = [
  { value: 'PROJECT', label: 'Interno' },
  { value: 'SUPPORT', label: 'Soporte' },
];

export function formatTaskType(type: string | null | undefined): string {
  if (!type) return 'Interno';
  return TASK_TYPE_LABELS[type] ?? type;
}
