'use client';

import { useState, useCallback } from 'react';

export type ToastVariant = 'default' | 'destructive' | 'success' | 'notification';

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'TASK_COMPLETED'
  | 'TASK_APPROVAL_REQUESTED'
  | 'TASK_APPROVAL_APPROVED'
  | 'TASK_APPROVAL_REJECTED'
  | 'MENTION'
  | 'SPRINT_STARTED'
  | 'SPRINT_COMPLETED'
  | 'ALCANCE_SUBMITTED'
  | 'ALCANCE_APPROVED'
  | 'ALCANCE_REJECTED'
  | 'MEETING_SCHEDULED'
  | 'SUGGESTION_RECEIVED'
  | 'MEMBER_JOINED'
  | 'MEMBER_REMOVED'
  | 'COMMENT_ADDED'
  | 'default';

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  notificationType?: NotificationType;
}

let toastListeners: Array<(toast: ToastData) => void> = [];
let toastCount = 0;

export function toast({
  title,
  description,
  variant = 'default',
  duration = 4000,
  notificationType,
}: Omit<ToastData, 'id'>) {
  const id = String(++toastCount);
  const data: ToastData = { id, title, description, variant, duration, notificationType };
  toastListeners.forEach((listener) => listener(data));
  return id;
}

toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: 'success' });

toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: 'destructive' });

toast.info = (title: string, description?: string, options?: { duration?: number }) =>
  toast({ title, description, variant: 'default', duration: options?.duration });

toast.notification = (title: string, description?: string, notificationType?: NotificationType) =>
  toast({ title, description, variant: 'notification', duration: 10000, notificationType: notificationType || 'default' });

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
