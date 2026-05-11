'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { isPushSupported, urlBase64ToUint8Array } from '@/lib/push-utils';

export type PushErrorCode =
  | 'unsupported'
  | 'permission_default'
  | 'permission_denied'
  | 'vapid_unavailable'
  | 'network_error'
  | 'sw_error';

export type PushResult =
  | { ok: true }
  | { ok: false; error: PushErrorCode; message?: string };

export interface UsePushNotificationsReturn {
  supported: boolean;
  permission: NotificationPermission | 'default';
  subscribed: boolean;
  loading: boolean;
  subscribe: () => Promise<PushResult>;
  unsubscribe: () => Promise<PushResult>;
  refresh: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'default'>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ok = isPushSupported();
    setSupported(ok);
    if (!ok) return;

    setPermission(Notification.permission);

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => setSubscribed(false));
  }, []);

  const refresh = useCallback(async () => {
    if (!isPushSupported()) return;
    setPermission(Notification.permission);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setSubscribed(!!sub);
    } catch {
      setSubscribed(false);
    }
  }, []);

  const subscribe = useCallback(async (): Promise<PushResult> => {
    if (!supported) return { ok: false, error: 'unsupported' };
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === 'default') return { ok: false, error: 'permission_default' };
      if (perm === 'denied') return { ok: false, error: 'permission_denied' };

      let publicKey: string | null = null;
      try {
        const keyRes = await api.get<{ publicKey: string | null }>(
          '/notifications/push/vapid-public-key',
        );
        publicKey = keyRes.data?.publicKey ?? null;
      } catch (err) {
        return {
          ok: false,
          error: 'network_error',
          message: err instanceof ApiError ? err.message : undefined,
        };
      }
      if (!publicKey) return { ok: false, error: 'vapid_unavailable' };

      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
      } catch {
        return { ok: false, error: 'sw_error' };
      }

      // Limpiar cualquier sub zombie residual antes de crear una nueva.
      // Desbloquea casos donde un unsubscribe anterior dejo estado inconsistente.
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe().catch(() => {});
      }

      let sub: PushSubscription;
      try {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
        });
      } catch {
        return { ok: false, error: 'sw_error' };
      }

      const subJson = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      try {
        await api.post('/notifications/push/subscribe', {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          userAgent: navigator.userAgent,
        });
      } catch (err) {
        await sub.unsubscribe().catch(() => {});
        return {
          ok: false,
          error: 'network_error',
          message: err instanceof ApiError ? err.message : undefined,
        };
      }

      setSubscribed(true);
      return { ok: true };
    } catch {
      return { ok: false, error: 'sw_error' };
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async (): Promise<PushResult> => {
    if (!supported) return { ok: false, error: 'unsupported' };
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setSubscribed(false);
        return { ok: true };
      }
      const sub = await registration.pushManager.getSubscription();
      if (!sub) {
        setSubscribed(false);
        return { ok: true };
      }
      const endpoint = sub.endpoint;

      // Invalidar en backend primero; solo si OK, invalidar local.
      try {
        await api.delete(
          `/notifications/push/unsubscribe?endpoint=${encodeURIComponent(endpoint)}`,
        );
      } catch (err) {
        return {
          ok: false,
          error: 'network_error',
          message: err instanceof ApiError ? err.message : undefined,
        };
      }

      await sub.unsubscribe().catch(() => {});
      setSubscribed(false);
      return { ok: true };
    } catch {
      return { ok: false, error: 'sw_error' };
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe, refresh };
}
