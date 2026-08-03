'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SLA_FALLBACK_SOURCES, SLA_SOURCE_LABEL, type SlaSource } from '@/types/sla.types';

/** Por qué el origen indica configuración incompleta (tooltip del ⚠️). */
const FALLBACK_HINT: Partial<Record<SlaSource, string>> = {
  CRITICALITY:
    'Configuración incompleta: el ticket no tiene contrato para su tipo, ni el proyecto o el cliente tienen SLA propio. Se usó la política de su criticidad.',
  STANDARD:
    'Configuración incompleta: no hubo contrato, SLA de proyecto/cliente ni política para su criticidad. Se usó la política «Estándar».',
};

interface SlaSourceBadgeProps {
  /** Política congelada en el ticket al crearlo. */
  policyName?: string | null;
  /** Paso de la cascada que resolvió el SLA. */
  source?: SlaSource | null;
  className?: string;
}

/**
 * "Crítico 24/7 · por contrato" — política aplicada + origen legible (#42 Fase 1).
 *
 * Los tickets históricos (creados antes del motor de cascada) no traen `slaSource`:
 * en ese caso NO se renderiza nada, para no ensuciar su panel.
 */
export function SlaSourceBadge({ policyName, source, className }: SlaSourceBadgeProps) {
  if (!source) return null;

  const isFallback = SLA_FALLBACK_SOURCES.includes(source);
  const label =
    source === 'NONE' || !policyName
      ? SLA_SOURCE_LABEL[source]
      : `${policyName} · ${SLA_SOURCE_LABEL[source]}`;

  const badge = (
    <Badge
      variant={isFallback ? 'warning' : 'secondary'}
      className={cn('gap-1 text-[10px] font-medium', className)}
    >
      {label}
      {isFallback && <span aria-hidden>⚠️</span>}
    </Badge>
  );

  const hint = FALLBACK_HINT[source];
  if (!hint) return badge;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[260px] text-xs leading-relaxed">
          {hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
