import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { criticalityStyle } from '@/lib/criticality';

interface CriticalityBadgeProps {
  /**
   * Criticidad del ticket. Se acepta `string` a propósito: el listado la arma con
   * `criticality || categoryConfig.criticality || priority`, y ese último es el
   * campo heredado del modelo viejo. Un valor desconocido se pinta crudo y neutro
   * (fallback único de `criticalityStyle`), nunca como "Media".
   */
  value: string | null | undefined;
  className?: string;
}

/**
 * Badge de criticidad. Reemplaza los 2 badges idénticos que vivían duplicados en
 * `ticket-resolved-badges.tsx` y en el listado `/tickets` (#42 Fase 3, paso A).
 *
 * Sin `'use client'`: no tiene estado ni handlers, así que sirve tanto en Server
 * como en Client Components.
 */
export function CriticalityBadge({ value, className }: CriticalityBadgeProps) {
  if (!value) return null;
  const { label, badgeClass } = criticalityStyle(value);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
        badgeClass,
        className,
      )}
    >
      <AlertTriangle className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}
