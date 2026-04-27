/**
 * Helpers visuales para documentos del proyecto.
 */

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  SCOPE: 'Alcance',
  BUDGET: 'Presupuesto',
  MOCKUP: 'Mockup',
  DOCUMENTATION: 'Documentación',
  OTHER: 'Otro',
};

export const DOCUMENT_CATEGORY_OPTIONS = [
  { value: 'SCOPE', label: 'Alcance' },
  { value: 'BUDGET', label: 'Presupuesto' },
  { value: 'MOCKUP', label: 'Mockup' },
  { value: 'DOCUMENTATION', label: 'Documentación' },
  { value: 'OTHER', label: 'Otro' },
];

export const DOCUMENT_CATEGORY_COLORS: Record<string, string> = {
  SCOPE: 'bg-primary/10 text-primary',
  BUDGET: 'bg-success/10 text-success',
  MOCKUP: 'bg-info/10 text-info',
  DOCUMENTATION: 'bg-muted text-muted-foreground',
  OTHER: 'bg-muted text-muted-foreground',
};

export function formatDocumentCategory(category: string | null | undefined): string {
  if (!category) return 'Sin categoría';
  return DOCUMENT_CATEGORY_LABELS[category] ?? category;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
