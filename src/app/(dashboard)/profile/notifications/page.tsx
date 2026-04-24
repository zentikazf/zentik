'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/use-push-notifications';

interface PreferenceItem {
  eventType: string;
  label: string;
  description: string;
  enabled: boolean;
}

export default function NotificationsPage() {
  const push = usePushNotifications();
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!push.subscribed) {
      setLoadingPrefs(false);
      return;
    }
    api
      .get<PreferenceItem[]>('/notifications/push/preferences')
      .then((res) => setPreferences(res.data || []))
      .catch(() => toast.error('Error', 'No se pudieron cargar las preferencias'))
      .finally(() => setLoadingPrefs(false));
  }, [push.subscribed]);

  const handleTogglePref = async (eventType: string, enabled: boolean) => {
    const previous = preferences;
    setPreferences((prev) =>
      prev.map((p) => (p.eventType === eventType ? { ...p, enabled } : p)),
    );
    setSaving(true);
    try {
      await api.patch('/notifications/push/preferences', {
        preferences: [{ eventType, channel: 'PUSH', enabled }],
      });
    } catch (err) {
      setPreferences(previous);
      toast.error(
        'Error',
        err instanceof ApiError ? err.message : 'No se pudo guardar la preferencia',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    const ok = await push.subscribe();
    if (ok) {
      toast.success('Notificaciones activadas', 'Ahora recibirás avisos del navegador');
    } else {
      if (push.permission === 'denied') {
        toast.error(
          'Permiso denegado',
          'Activalas desde la configuración del navegador y volvé a intentarlo',
        );
      }
    }
  };

  const handleDeactivate = async () => {
    const ok = await push.unsubscribe();
    if (ok) {
      toast.success('Notificaciones desactivadas');
      setPreferences([]);
    }
  };

  if (!push.supported) {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-warning shrink-0" />
          <div>
            <h2 className="font-semibold text-foreground">Tu navegador no soporta notificaciones push</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Usá Chrome, Firefox o Edge desde una pestaña en HTTPS para activar notificaciones.
              En iOS Safari requiere instalar la app como PWA (iOS 16.4+).
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estado + boton principal */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                push.subscribed ? 'bg-success/10' : 'bg-muted'
              }`}
            >
              {push.subscribed ? (
                <Bell className="h-5 w-5 text-success" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-foreground">
                Notificaciones del navegador
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {push.subscribed
                  ? 'Activas. Vas a recibir avisos aunque la app esté cerrada.'
                  : 'Activá las notificaciones para enterarte cuando un cliente escribe o llega un ticket urgente.'}
              </p>
            </div>
          </div>
          {push.subscribed ? (
            <Button
              variant="outline"
              onClick={handleDeactivate}
              disabled={push.loading}
            >
              Desactivar
            </Button>
          ) : (
            <Button onClick={handleActivate} disabled={push.loading}>
              {push.loading ? 'Activando...' : 'Activar notificaciones'}
            </Button>
          )}
        </div>
      </div>

      {/* Preferencias granulares */}
      {push.subscribed && (
        <div className="rounded-xl border bg-card p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-foreground">Tipos de notificación</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Elegí qué eventos querés recibir por el navegador. Los cambios se guardan al instante.
            </p>
          </div>

          <Separator className="mb-4" />

          {loadingPrefs ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {preferences.map((p, i) => (
                <div key={p.eventType}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium text-foreground">{p.label}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </div>
                    <Switch
                      checked={p.enabled}
                      onCheckedChange={(checked) => handleTogglePref(p.eventType, checked)}
                      disabled={saving}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <span>
              Las notificaciones del navegador son un espejo de la campanita interna. Todo lo que ves ahí, también llega por push si está activado.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
