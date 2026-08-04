'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Error boundary compartido por las rutas de `/settings/sla/*` (#42 Fase 1).
 * Cada `error.tsx` lo monta para no repetir el mismo bloque cinco veces.
 */
export function SlaRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-card p-8 text-center">
      <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
      <h2 className="text-base font-semibold text-foreground">No se pudo cargar esta sección</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {error.message || 'Ocurrió un error inesperado al cargar la configuración de SLA.'}
      </p>
      <Button onClick={reset} className="mt-6">
        Reintentar
      </Button>
    </div>
  );
}
