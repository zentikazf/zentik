'use client';

import { useState, useCallback } from 'react';

export type ToastVariant = 'default' | 'destructive' | 'success' | 'notification';

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

let toastListeners: Array<(toast: ToastData) => void> = [];
let toastCount = 0;

export function toast({
  title,
  description,
  variant = 'default',
  duration = 4000,
}: Omit<ToastData, 'id'>) {
  const id = String(++toastCount);
  const data: ToastData = { id, title, description, variant, duration };
  toastListeners.forEach((listener) => listener(data));
  return id;
}

toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: 'success' });

toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: 'destructive' });

toast.info = (title: string, description?: string, options?: { duration?: number }) =>
  toast({ title, description, variant: 'default', duration: options?.duration });

toast.notification = (title: string, description?: string) =>
  toast({ title, description, variant: 'notification', duration: 8000 });

export function useToastStore() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((data: ToastData) => {
    setToasts((prev) => [...prev, data]);
    if (data.duration && data.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== data.id));
      }, data.duration);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const subscribe = useCallback(
    (listener: (toast: ToastData) => void) => {
      toastListeners.push(listener);
      return () => {
        toastListeners = toastListeners.filter((l) => l !== listener);
      };
    },
    [],
  );

  return { toasts, addToast, dismissToast, subscribe };
}
