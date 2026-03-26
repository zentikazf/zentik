'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sun, Moon, Monitor, Globe, Clock, Bell } from 'lucide-react';
import { useTheme } from 'next-themes';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

interface Preferences {
  language: string;
  timezone: string;
  theme: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
}

const defaultPreferences: Preferences = {
  language: 'es',
  timezone: 'America/Mexico_City',
  theme: 'system',
  emailNotifications: true,
  pushNotifications: true,
  weeklyDigest: true,
};

const languages = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
];

const timezones = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
  { value: 'America/New_York', label: 'Nueva York (GMT-5)' },
  { value: 'America/Chicago', label: 'Chicago (GMT-6)' },
  { value: 'America/Denver', label: 'Denver (GMT-7)' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
  { value: 'Europe/London', label: 'Londres (GMT+0)' },
  { value: 'UTC', label: 'UTC' },
];

const themeOptions = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

export default function PreferencesPage() {
  const { setTheme } = useTheme();
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Preferences>('/users/me/preferences')
      .then((res) => {
        setPrefs({ ...defaultPreferences, ...res.data });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/users/me/preferences', prefs);
      setTheme(prefs.theme);
      toast.success('Preferencias guardadas', 'Tus preferencias han sido actualizadas');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al guardar preferencias';
      toast.error('Error', message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-48 rounded-[25px]" />
        <Skeleton className="h-48 rounded-[25px]" />
        <Skeleton className="h-48 rounded-[25px]" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Preferencias</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Personaliza tu experiencia en Zentik</p>
      </div>

      {/* Theme */}
      <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50 dark:bg-yellow-950">
            <Sun className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Apariencia</h3>
        </div>
        <Label className="mb-3 block text-sm text-gray-500 dark:text-gray-400">Tema</Label>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setPrefs({ ...prefs, theme: option.value })}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                prefs.theme === option.value
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-100 hover:border-gray-200 dark:border-gray-800 dark:hover:border-gray-700'
              }`}
            >
              <option.icon className={`h-6 w-6 ${prefs.theme === option.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${prefs.theme === option.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'}`}>
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Language & Timezone */}
      <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
            <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Regional</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-gray-500 dark:text-gray-400">Idioma</Label>
            <Select value={prefs.language} onValueChange={(v) => setPrefs({ ...prefs, language: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <Clock className="h-3.5 w-3.5" /> Zona horaria
            </Label>
            <Select value={prefs.timezone} onValueChange={(v) => setPrefs({ ...prefs, timezone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
            <Bell className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Notificaciones</h3>
        </div>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-medium text-gray-800 dark:text-white">Notificaciones por email</p>
              <p className="text-[13px] text-gray-400">Recibe notificaciones importantes en tu correo</p>
            </div>
            <Switch checked={prefs.emailNotifications} onCheckedChange={(v) => setPrefs({ ...prefs, emailNotifications: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-medium text-gray-800 dark:text-white">Notificaciones push</p>
              <p className="text-[13px] text-gray-400">Recibe notificaciones en tiempo real en el navegador</p>
            </div>
            <Switch checked={prefs.pushNotifications} onCheckedChange={(v) => setPrefs({ ...prefs, pushNotifications: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-medium text-gray-800 dark:text-white">Resumen semanal</p>
              <p className="text-[13px] text-gray-400">Recibe un resumen de actividad cada lunes</p>
            </div>
            <Switch checked={prefs.weeklyDigest} onCheckedChange={(v) => setPrefs({ ...prefs, weeklyDigest: v })} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="rounded-full">
          {saving ? 'Guardando...' : 'Guardar Preferencias'}
        </Button>
      </div>
    </div>
  );
}
