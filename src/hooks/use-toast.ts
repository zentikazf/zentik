'use client';

import { sileo } from 'sileo';

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

/**
 * Shim: misma API que antes, delega a sileo.
 * Los 71+ archivos que importan { toast } siguen funcionando sin cambios.
 */
export function toast({
  title,
  description,
  variant = 'default',
  duration,
}: Omit<ToastData, 'id'>) {
  const opts = { title, description, ...(duration ? { duration } : {}) };
  switch (variant) {
    case 'success':
      return sileo.success(opts);
    case 'destructive':
      return sileo.error(opts);
    case 'notification':
      return sileo.info({ ...opts, duration: duration ?? 10000 });
    default:
      return sileo.info(opts);
  }
}

toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: 'success' });

toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: 'destructive' });

toast.info = (title: string, description?: string, options?: { duration?: number }) =>
  toast({ title, description, variant: 'default', duration: options?.duration });

toast.notification = (title: string, description?: string, notificationType?: NotificationType) =>
  toast({ title, description, variant: 'notification', duration: 10000 });
