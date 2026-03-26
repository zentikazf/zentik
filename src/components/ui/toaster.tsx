'use client';

import { useEffect } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToastStore } from '@/hooks/use-toast';

export function Toaster() {
  const { toasts, addToast, dismissToast, subscribe } = useToastStore();

  useEffect(() => {
    return subscribe(addToast);
  }, [subscribe, addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[420px]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-md border p-4 pr-8 shadow-lg animate-in slide-in-from-bottom-5 ${
            t.variant === 'destructive'
              ? 'border-red-200 bg-red-50 text-red-900'
              : t.variant === 'success'
                ? 'border-green-200 bg-green-50 text-green-900'
                : 'border bg-background text-foreground'
          }`}
        >
          {t.variant === 'destructive' && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
          {t.variant === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description && <p className="mt-1 text-sm opacity-80">{t.description}</p>}
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            className="absolute right-2 top-2 rounded-md p-1 opacity-50 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
