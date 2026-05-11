'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/use-push-notifications';

type Channel = 'PUSH' | 'EMAIL';

interface PreferenceItem {
  eventType: string;
  label: string;
  description: string;
  push: boolean;
  email: boolean;
}

export default function NotificationsPage() {
  const push = usePushNotifications();
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<PreferenceItem[]>('/notifications/preferences')
      .then((res) => setPreferences(res.data || []))
      .catch(() => toast.error('Error', 'No se pudieron cargar las preferencias'))
      .finally(() => setLoadingPrefs(false));
  }, []);

  const handleTogglePref = async (eventType: string, channel: Channel, enabled: boolean) => {
    const previous = preferences;
    setPreferences((prev) =>
      prev.map((p) =>
        p.eventType === eventType
          ? { ...p, [channel === 'PUSH' ? 'push' : 'email']: enabled }
          : p,
      ),
    );
    setSaving(true);
    try {
      await api.patch('/notifications/preferences', {
        preferences: [{ eventType, channel, enabled }],
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
    const res = await push.subscribe();
    if (res.ok) {
      toast.success('Notificaciones activadas', 'Ahora recibirás avisos del navegador');
      return;
    }
    switch (res.error) {
      case 'permission_default':
        toast.error(
          'Cerraste el diálogo',
          'Tocá Activar de nuevo y elegí Permitir en el aviso del navegador.',
        );
        break;
      case 'permission_denied':
        toast.error(
          'Permiso denegado',
          'Activalas desde la configuración del navegador y volvé a intentarlo.',
        );
        break;
      case 'vapid_unavailable':
        toast.error(
          'Servicio no disponible',
          'Las notificaciones del navegador no están configuradas en el servidor.',
        );
        break;
      case 'network_error':
        toast.error(
          'Error de conexión',
          res.message ?? 'No se pudo conectar con el servidor. Reintentá en unos segundos.',
        );
        break;
      case 'sw_error':
        toast.error(
          'Error del navegador',
          'No se pudo registrar el service worker. Recargá la página y reintentá.',
        );
        break;
      case 'unsupported':
        toast.error('No soportado', 'Tu navegador no soporta notificaciones push.');
        break;
    }
  };

  const handleDeactivate = async () => {
    const res = await push.unsubscribe();
    if (res.ok) {
      toast.success('Notificaciones desactivadas');
      return;
    }
    if (res.error === 'network_error') {
      toast.error(
        'No se pudo desactivar',
        res.message ?? 'Verificá tu conexión y reintentá.',
      );
    } else {
      toast.error('Error', 'No se pudieron desactivar las notificaciones.');
    }
  };

  if (!push.supported) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-warning shrink-0" />
            <div>
              <h2 className="font-semibold text-foreground">Tu navegador no soporta notificaciones push</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Igual podés activar notificaciones por email abajo. Para push en el navegador, usá Chrome,
                Firefox o Edge desde una pestaña en HTTPS. En iOS Safari requiere instalar la app como PWA (iOS 16.4+).
              </p>
            </div>
          </div>
        </div>
        {renderPreferencesCard({
          preferences,
          loadingPrefs,
          saving,
          pushDisabled: true,
          handleTogglePref,
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                  : 'Activá el push del navegador para enterarte en tiempo real. Las notificaciones por email funcionan aparte.'}
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
              {push.loading ? 'Activando...' : 'Activar push'}
            </Button>
          )}
        </div>
      </div>

      {renderPreferencesCard({
        preferences,
        loadingPrefs,
        saving,
        pushDisabled: !push.subscribed,
        handleTogglePref,
      })}
    </div>
  );
}

function renderPreferencesCard(args: {
  preferences: PreferenceItem[];
  loadingPrefs: boolean;
  saving: boolean;
  pushDisabled: boolean;
  handleTogglePref: (eventType: string, channel: Channel, enabled: boolean) => void;
}) {
  const { preferences, loadingPrefs, saving, pushDisabled, handleTogglePref } = args;
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4">
        <h3 className="font-semibold text-foreground">Tipos de notificación</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Elegí por qué canal querés recibir cada tipo de evento. Los cambios se guardan al instante.
        </p>
      </div>

      <Separator className="mb-3" />

      {/* Header de canales */}
      <div className="flex items-center justify-end gap-6 pb-2 pr-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <div className="flex items-center gap-1.5 w-14 justify-center">
          <Bell className="h-3.5 w-3.5" />
          <span>Push</span>
        </div>
        <div className="flex items-center gap-1.5 w-14 justify-center">
          <Mail className="h-3.5 w-3.5" />
          <span>Email</span>
        </div>
      </div>

      <Separator className="mb-2" />

      {loadingPrefs ? (
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {preferences.map((p, i) => (
            <div key={p.eventType}>
              {i > 0 && <Separator />}
              <div className="flex items-center justify-between gap-4 py-3">
                <div className="flex-1 pr-4">
                  <p className="text-sm font-medium text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-14 flex justify-center">
                    <Switch
                      checked={p.push}
                      onCheckedChange={(checked) => handleTogglePref(p.eventType, 'PUSH', checked)}
                      disabled={saving || pushDisabled}
                    />
                  </div>
                  <div className="w-14 flex justify-center">
                    <Switch
                      checked={p.email}
                      onCheckedChange={(checked) => handleTogglePref(p.eventType, 'EMAIL', checked)}
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
        <span>
          {pushDisabled
            ? 'Activá el push del navegador arriba para habilitar la columna de Push. Los emails funcionan aparte.'
            : 'Push y email son canales independientes. Podés activar uno, ambos o ninguno por tipo de evento.'}
        </span>
      </div>
    </div>
  );
}
