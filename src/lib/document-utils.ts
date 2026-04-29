/**
 * Helpers visuales para documentos.
 *
 * NOTA: las categorias (DOCUMENT_CATEGORY_*) y el versionado se eliminaron
 * de la UI. La data legacy queda en la DB pero no se usa.
 */

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Devuelve true si el documento fue editado despues de su creacion.
 * Tolerancia de 30s para evitar marcar "Actualizado" por la diferencia
 * minima entre INSERT y UPDATE de auditoria.
 */
export function isUpdated(createdAt: string, updatedAt: string): boolean {
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 30_000;
}
