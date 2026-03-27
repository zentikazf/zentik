'use client';

import { useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Bell } from 'lucide-react';
import { useToastStore } from '@/hooks/use-toast';

export function Toaster() {
  const { toasts, addToast, dismissToast, subscribe } = useToastStore();

  useEffect(() => {
    return subscribe(addToast);
  }, [subscribe, addToast]);

  if (toasts.length === 0) return null;

  return (
    <>
      {/* Notification toasts — top-right, large and invasive */}
      {toasts.some((t) => t.variant === 'notification') && (
        <div className="fixed top-0 right-0 z-[200] flex w-full flex-col gap-3 p-4 sm:max-w-[440px]">
          {toasts
            .filter((t) => t.variant === 'notification')
            .map((t) => (
              <div
                key={t.id}
                className="pointer-events-auto relative flex w-full items-start gap-4 overflow-hidden rounded-2xl border border-blue-200 bg-white p-5 pr-10 shadow-2xl animate-in slide-in-from-top-5 fade-in duration-300 dark:border-blue-800 dark:bg-gray-900"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                  <Bell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{t.title}</p>
                  {t.description && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{t.description}</p>
                  )}
                  <p className="mt-2 text-[11px] text-gray-400">Justo ahora</p>
                </div>
                <button
                  onClick={() => dismissToast(t.id)}
                  className="absolute right-3 top-3 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Regular toasts — bottom-right */}
      <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[420px]">
        {toasts
          .filter((t) => t.variant !== 'notification')
          .map((t) => (
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
    </>
  );
}
