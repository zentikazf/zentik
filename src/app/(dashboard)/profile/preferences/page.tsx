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
 <Skeleton className="h-48 rounded-xl"/>
 <Skeleton className="h-48 rounded-xl"/>
 <Skeleton className="h-48 rounded-xl"/>
 </div>
 );
 }

 return (
 <div className="space-y-7">
 <div>
 <h1 className="text-[22px] font-semibold text-foreground">Preferencias</h1>
 <p className="mt-1 text-sm text-muted-foreground">Personaliza tu experiencia en Zentik</p>
 </div>

 {/* Theme */}
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="mb-5 flex items-center gap-2">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
 <Sun className="h-5 w-5 text-warning"/>
 </div>
 <h3 className="text-lg font-semibold text-foreground">Apariencia</h3>
 </div>
 <Label className="mb-3 block text-sm text-muted-foreground">Tema</Label>
 <div className="grid grid-cols-3 gap-3">
 {themeOptions.map((option) => (
 <button
 key={option.value}
 onClick={() => setPrefs({ ...prefs, theme: option.value })}
 className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
 prefs.theme === option.value
 ? 'border-primary bg-primary/10'
 : 'border-border hover:border-border'
 }`}
 >
 <option.icon className={`h-6 w-6 ${prefs.theme === option.value ? 'text-primary' : 'text-muted-foreground'}`} />
 <span className={`text-sm font-medium ${prefs.theme === option.value ? 'text-primary' : 'text-muted-foreground'}`}>
 {option.label}
 </span>
 </button>
 ))}
 </div>
 </div>

 {/* Language & Timezone */}
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="mb-5 flex items-center gap-2">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
 <Globe className="h-5 w-5 text-primary"/>
 </div>
 <h3 className="text-lg font-semibold text-foreground">Regional</h3>
 </div>
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label className="text-muted-foreground">Idioma</Label>
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
 <Label className="flex items-center gap-1.5 text-muted-foreground">
 <Clock className="h-3.5 w-3.5"/> Zona horaria
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
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="mb-5 flex items-center gap-2">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
 <Bell className="h-5 w-5 text-destructive"/>
 </div>
 <h3 className="text-lg font-semibold text-foreground">Notificaciones</h3>
 </div>
 <div className="space-y-5">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-[15px] font-medium text-foreground">Notificaciones por email</p>
 <p className="text-[13px] text-muted-foreground">Recibe notificaciones importantes en tu correo</p>
 </div>
 <Switch checked={prefs.emailNotifications} onCheckedChange={(v) => setPrefs({ ...prefs, emailNotifications: v })} />
 </div>
 <div className="flex items-center justify-between">
 <div>
 <p className="text-[15px] font-medium text-foreground">Notificaciones push</p>
 <p className="text-[13px] text-muted-foreground">Recibe notificaciones en tiempo real en el navegador</p>
 </div>
 <Switch checked={prefs.pushNotifications} onCheckedChange={(v) => setPrefs({ ...prefs, pushNotifications: v })} />
 </div>
 <div className="flex items-center justify-between">
 <div>
 <p className="text-[15px] font-medium text-foreground">Resumen semanal</p>
 <p className="text-[13px] text-muted-foreground">Recibe un resumen de actividad cada lunes</p>
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
