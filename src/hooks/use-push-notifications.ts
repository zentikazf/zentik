'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { isPushSupported, urlBase64ToUint8Array } from '@/lib/push-utils';

export interface UsePushNotificationsReturn {
  supported: boolean;
  permission: NotificationPermission | 'default';
  subscribed: boolean;
  loading: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'default'>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Detect support + current state
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

  const registerServiceWorker = useCallback(async () => {
    const existing = await navigator.serviceWorker.getRegistration('/sw.js');
    if (existing) return existing;
    return navigator.serviceWorker.register('/sw.js');
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        return false;
      }

      const keyRes = await api.get<{ publicKey: string | null }>('/notifications/push/vapid-public-key');
      const publicKey = keyRes.data?.publicKey;
      if (!publicKey) {
        console.warn('VAPID public key no disponible en el servidor');
        return false;
      }

      const registration = await registerServiceWorker();
      // Esperar a que el SW este listo
      await navigator.serviceWorker.ready;

      const existingSub = await registration.pushManager.getSubscription();
      const sub =
        existingSub ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
        }));

      const subJson = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      await api.post('/notifications/push/subscribe', {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        userAgent: navigator.userAgent,
      });

      setSubscribed(true);
      return true;
    } catch (err) {
      console.error('Error suscribiendo a push:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported, registerServiceWorker]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return false;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!registration) {
        setSubscribed(false);
        return true;
      }
      const sub = await registration.pushManager.getSubscription();
      if (!sub) {
        setSubscribed(false);
        return true;
      }
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      // api.delete no acepta body en este wrapper — usamos fetch directo
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        await fetch(`${apiUrl}/api/v1/notifications/push/unsubscribe`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      } catch {}
      setSubscribed(false);
      return true;
    } catch (err) {
      console.error('Error desuscribiendo push:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}
