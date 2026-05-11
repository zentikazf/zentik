'use client';

import { useEffect, useState } from 'react';
import { Mail, Settings, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

type Channel = 'PUSH' | 'EMAIL';

interface PreferenceItem {
  eventType: string;
  label: string;
  description: string;
  push: boolean;
  email: boolean;
}

interface ProfileData {
  id: string;
  email: string;
  name: string;
  notificationEmail: string | null;
}

const CLIENT_EVENT_WHITELIST = new Set<string>([
  'chat.message',
  'ticket.status_changed',
  'alcance.submitted',
  'client.document.shared',
]);

export default function PortalSettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPref, setSavingPref] = useState(false);
  const [notifEmail, setNotifEmail] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<ProfileData>('/users/me'),
      api.get<PreferenceItem[]>('/notifications/preferences'),
    ])
      .then(([profRes, prefRes]) => {
        const p = profRes.data;
        setProfile(p);
        setNotifEmail(p.notificationEmail ?? '');
        const filtered = (prefRes.data ?? []).filter((it) =>
          CLIENT_EVENT_WHITELIST.has(it.eventType),
        );
        setPreferences(filtered);
      })
      .catch((err) => {
        toast.error(
          'Error',
          err instanceof ApiError ? err.message : 'No se pudieron cargar los ajustes',
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveEmail = async () => {
    setSavingEmail(true);
    try {
      const value = notifEmail.trim();
      await api.patch('/users/me', {
        notificationEmail: value === '' ? null : value,
      });
      setProfile((prev) =>
        prev ? { ...prev, notificationEmail: value === '' ? null : value } : prev,
      );
      toast.success(
        'Email guardado',
        value
          ? `Recibirás notificaciones en ${value}`
          : `Recibirás notificaciones en ${profile?.email}`,
      );
    } catch (err) {
      toast.error(
        'Error',
        err instanceof ApiError ? err.message : 'No se pudo guardar el email',
      );
    } finally {
      setSavingEmail(false);
    }
  };

  const handleTogglePref = async (eventType: string, channel: Channel, enabled: boolean) => {
    const previous = preferences;
    setPreferences((prev) =>
      prev.map((p) =>
        p.eventType === eventType
          ? { ...p, [channel === 'PUSH' ? 'push' : 'email']: enabled }
          : p,
      ),
    );
    setSavingPref(true);
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
      setSavingPref(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const effectiveEmail = profile?.notificationEmail ?? profile?.email;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Ajustes</h1>
          <p className="text-xs text-muted-foreground">
            Configurá dónde recibís las notificaciones y qué eventos te interesan.
          </p>
        </div>
      </div>

      {/* Card: email de notificaciones */}
      <div className="rounded-xl border bg-card p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Mail className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">Email de notificaciones</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Por defecto recibís todo en <strong>{profile?.email}</strong>. Podés indicar otro email si
              preferís separar tu correo principal del de soporte.
            </p>
          </div>
        </div>

        <Separator className="mb-4" />

        <div className="space-y-3">
          <div>
            <Label htmlFor="notificationEmail" className="text-xs font-medium">
              Email alternativo (opcional)
            </Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id="notificationEmail"
                type="email"
                placeholder={profile?.email}
                value={notifEmail}
                onChange={(e) => setNotifEmail(e.target.value)}
                disabled={savingEmail}
              />
              <Button
                onClick={handleSaveEmail}
                disabled={savingEmail || notifEmail === (profile?.notificationEmail ?? '')}
              >
                <Save className="mr-1.5 h-4 w-4" />
                {savingEmail ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Dejalo vacío para usar tu email principal de la cuenta.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <span>
              Email activo:{' '}
              <strong className="text-foreground">{effectiveEmail}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Card: preferencias de notificacion */}
      <div className="rounded-xl border bg-card p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground">Tipos de notificación</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Elegí por qué eventos querés recibir un correo. Los cambios se guardan automáticamente.
          </p>
        </div>

        <Separator className="mb-3" />

        {/* Header de canal */}
        <div className="flex items-center justify-end pb-2 pr-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <div className="flex w-14 items-center justify-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            <span>Email</span>
          </div>
        </div>

        <Separator className="mb-2" />

        {preferences.length === 0 ? (
          <div className="flex items-start gap-2 rounded-md bg-warning/5 border border-warning/30 p-3 text-xs text-muted-foreground">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <span>
              No hay preferencias disponibles para este usuario. Si pensás que es un error, contactá al
              equipo de soporte.
            </span>
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
                  <div className="w-14 flex justify-center">
                    <Switch
                      checked={p.email}
                      onCheckedChange={(checked) => handleTogglePref(p.eventType, 'EMAIL', checked)}
                      disabled={savingPref}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-md bg-muted/50 p-3 text-[11px] text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          <span>
            Cada email incluye un link para administrar estas preferencias. También podés volver a esta
            página cuando quieras.
          </span>
        </div>
      </div>
    </div>
  );
}
