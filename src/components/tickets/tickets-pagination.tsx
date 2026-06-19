'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TicketsPaginationProps {
  /** Página actual (1-based). */
  page: number;
  /** Total de páginas. Defensivo: acepta null/0 (se trata como sin páginas extra). */
  totalPages: number | null | undefined;
  /** Total de items (para "Mostrando X–Y de Z"). */
  total: number;
  /** Items por página (para calcular el rango mostrado). */
  limit: number;
  /** Callback al cambiar de página. Recibe la página destino (ya clampeada 1..totalPages). */
  onPageChange: (page: number) => void;
  /** Clases extra para el contenedor. */
  className?: string;
}

/**
 * Paginador numerado reutilizable para los listados de tickets (admin + portal).
 *
 * Render: "Mostrando X–Y de Z" + ‹ Anterior + números de página (con elipsis
 * si hay muchas) + Siguiente ›.
 *
 * Guards:
 *  - clamp de la página a 1..totalPages
 *  - prev disabled en página 1, next disabled en última
 *  - si totalPages <= 1 se ocultan los números (solo "Mostrando X de Z")
 *  - tolera totalPages null/0 sin romper (degrada a sin navegación)
 */
export function TicketsPagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  className,
}: TicketsPaginationProps) {
  // Normalización defensiva: totalPages null/0/NaN → 0.
  const safeTotalPages = Number.isFinite(totalPages) && (totalPages ?? 0) > 0 ? (totalPages as number) : 0;
  const safeLimit = limit > 0 ? limit : 1;

  // Página actual clampeada a 1..totalPages (mínimo 1 aunque no haya páginas).
  const currentPage = Math.min(Math.max(1, page), Math.max(1, safeTotalPages));

  // Rango "Mostrando X–Y de Z".
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * safeLimit + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(currentPage * safeLimit, total);

  // Genera la secuencia de páginas a mostrar con elipsis para listas largas.
  // Patrón: 1 … (p-1) p (p+1) … N. Siempre incluye primera y última.
  const pageItems = useMemo<(number | 'ellipsis')[]>(() => {
    if (safeTotalPages <= 1) return [];
    if (safeTotalPages <= 7) {
      return Array.from({ length: safeTotalPages }, (_, i) => i + 1);
    }

    const items: (number | 'ellipsis')[] = [];
    const left = Math.max(2, currentPage - 1);
    const right = Math.min(safeTotalPages - 1, currentPage + 1);

    items.push(1);
    if (left > 2) items.push('ellipsis');
    for (let p = left; p <= right; p++) items.push(p);
    if (right < safeTotalPages - 1) items.push('ellipsis');
    items.push(safeTotalPages);

    return items;
  }, [safeTotalPages, currentPage]);

  const goTo = (target: number) => {
    const clamped = Math.min(Math.max(1, target), Math.max(1, safeTotalPages));
    if (clamped !== currentPage) onPageChange(clamped);
  };

  // Si no hay items, no renderizamos nada (deja el empty state al consumidor).
  if (total === 0) return null;

  const showNumbers = safeTotalPages > 1;

  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4',
        className,
      )}
    >
      {/* "Mostrando X–Y de Z" */}
      <p className="text-[11px] sm:text-xs text-muted-foreground">
        {total === 1
          ? `Mostrando 1 de ${total}`
          : `Mostrando ${rangeStart}–${rangeEnd} de ${total}`}
      </p>

      {/* Navegación — solo si hay más de una página */}
      {showNumbers && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2 sm:px-3"
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>

          {pageItems.map((item, idx) =>
            item === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1.5 text-xs text-muted-foreground select-none"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === currentPage ? 'default' : 'outline'}
                size="sm"
                className="h-8 w-8 p-0 text-xs"
                onClick={() => goTo(item)}
                aria-label={`Página ${item}`}
                aria-current={item === currentPage ? 'page' : undefined}
              >
                {item}
              </Button>
            ),
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2 sm:px-3"
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage >= safeTotalPages}
            aria-label="Página siguiente"
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
