'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[activate] error', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Algo salió mal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No pudimos cargar la página de activación. Probá recargar o volver al login.
        </p>
        <div className="mt-6 flex gap-2">
          <Button onClick={reset} variant="outline" className="flex-1">
            Reintentar
          </Button>
          <Button
            onClick={() => (window.location.href = '/login')}
            className="flex-1"
          >
            Ir al login
          </Button>
        </div>
      </div>
    </div>
  );
}
