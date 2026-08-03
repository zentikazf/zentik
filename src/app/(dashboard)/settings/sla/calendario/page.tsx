'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import { CalendarDays, Clock, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Horario hábil + feriados. Movidos TAL CUAL desde el monolito
// `settings/sla/page.tsx` al partirlo en tabs (#42 Fase 1): mismo endpoint,
// misma validación previa, mismos mensajes. Sin cambios funcionales.

interface BusinessHours {
  businessHoursStart: string;
  businessHoursEnd: string;
  businessDays: string;
  timezone: string;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  recurring: boolean;
}

const dayLabels: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
  7: 'Dom',
};

const DEFAULT_BH: BusinessHours = {
  businessHoursStart: '08:30',
  businessHoursEnd: '17:30',
  businessDays: '1,2,3,4,5',
  timezone: 'America/Asuncion',
};

export default function SlaCalendarPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);

  const [bhForm, setBhForm] = useState<BusinessHours>(DEFAULT_BH);
  const [savingBh, setSavingBh] = useState(false);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '', recurring: false });
  const [savingHoliday, setSavingHoliday] = useState(false);

  useEffect(() => {
    if (orgId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const loadAll = async () => {
    try {
      const [bhRes, holRes] = await Promise.all([
        api.get(`/organizations/${orgId}/business-hours`),
        api.get(`/organizations/${orgId}/holidays`).catch(() => ({ data: [] })),
      ]);

      // El backend puede devolver el objeto directo, un array o {data}.
      const bhRaw = bhRes.data;
      const bh = Array.isArray(bhRaw)
        ? bhRaw[0]
        : bhRaw && typeof bhRaw === 'object' && 'data' in (bhRaw as object)
        ? (bhRaw as { data: BusinessHours }).data
        : bhRaw;
      if (bh?.businessHoursStart) {
        setBhForm({
          businessHoursStart: bh.businessHoursStart,
          businessHoursEnd: bh.businessHoursEnd,
          businessDays: bh.businessDays,
          timezone: bh.timezone ?? 'America/Asuncion',
        });
      }

      const hols = Array.isArray(holRes.data) ? holRes.data : holRes.data?.data || [];
      setHolidays(hols);
    } catch {
      toast.error('Error', 'Error al cargar el calendario de SLA');
    } finally {
      setLoading(false);
    }
  };

  const saveBh = async () => {
    // Validacion previa client-side para evitar 400 silencioso del backend
    // y dar feedback claro al usuario sobre que campo esta mal.
    const errors: string[] = [];
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(bhForm.businessHoursStart)) errors.push('Hora de inicio debe tener formato HH:MM (ej. 08:30)');
    if (!timeRegex.test(bhForm.businessHoursEnd)) errors.push('Hora de fin debe tener formato HH:MM (ej. 17:30)');
    if (!/^[1-7](,[1-7])*$/.test(bhForm.businessDays)) errors.push('Debes seleccionar al menos un dia laboral');
    if (bhForm.businessHoursStart >= bhForm.businessHoursEnd) errors.push('La hora de inicio debe ser anterior a la de fin');
    if (errors.length > 0) {
      toast.error('Datos invalidos', errors.join(' · '));
      return;
    }
    setSavingBh(true);
    try {
      // Mandamos solo los campos del DTO para evitar que forbidNonWhitelisted
      // del ValidationPipe rechace con 400 si el form arrastra propiedades extra.
      const payload = {
        businessHoursStart: bhForm.businessHoursStart,
        businessHoursEnd: bhForm.businessHoursEnd,
        businessDays: bhForm.businessDays,
        timezone: bhForm.timezone || 'America/Asuncion',
      };
      await api.patch(`/organizations/${orgId}/business-hours`, payload);
      toast.success('Guardado', 'Horario hábil actualizado');
      await loadAll();
    } catch (err) {
      // Mejor mensaje de error: si el backend devuelve detalles de validacion
      // (NestJS ValidationPipe los manda en err.body.message como array),
      // los mostramos en el toast para que el usuario sepa que arreglar.
      let detail = 'Error al guardar horario';
      if (err instanceof ApiError) {
        const body = (err.details ?? {}) as { message?: unknown };
        if (Array.isArray(body.message)) detail = body.message.join(' · ');
        else if (typeof body.message === 'string') detail = body.message;
        else detail = err.message;
      }
      toast.error('Error', detail);
    } finally {
      setSavingBh(false);
    }
  };

  const saveHoliday = async () => {
    if (!holidayForm.name.trim() || !holidayForm.date) {
      toast.error('Error', 'Nombre y fecha son requeridos');
      return;
    }
    setSavingHoliday(true);
    try {
      await api.post(`/organizations/${orgId}/holidays`, holidayForm);
      toast.success('Creado', 'Feriado agregado');
      setHolidayForm({ name: '', date: '', recurring: false });
      await loadAll();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al crear feriado');
    } finally {
      setSavingHoliday(false);
    }
  };

  const deleteHoliday = async (id: string) => {
    try {
      await api.delete(`/organizations/${orgId}/holidays/${id}`);
      toast.success('Eliminado', 'Feriado eliminado');
      await loadAll();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al eliminar');
    }
  };

  const toggleDay = (day: number) => {
    const current = bhForm.businessDays.split(',').map(Number).filter(Boolean);
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
    setBhForm({ ...bhForm, businessDays: next.join(',') });
  };

  const activeDays = bhForm.businessDays.split(',').map(Number);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Business Hours Section */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Horario Hábil</h2>
        </div>
        <p className="text-xs text-muted-foreground">El SLA solo cuenta minutos dentro del horario hábil configurado.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Hora inicio</Label>
            <Input type="time" value={bhForm.businessHoursStart} onChange={(e) => setBhForm({ ...bhForm, businessHoursStart: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Hora fin</Label>
            <Input type="time" value={bhForm.businessHoursEnd} onChange={(e) => setBhForm({ ...bhForm, businessHoursEnd: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input value={bhForm.timezone} onChange={(e) => setBhForm({ ...bhForm, timezone: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Días laborales</Label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <button key={day} type="button" onClick={() => toggleDay(day)} className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                activeDays.includes(day)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted',
              )}>
                {dayLabels[day]}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={saveBh} disabled={savingBh} className="w-full sm:w-auto">
          {savingBh ? 'Guardando...' : 'Guardar horario'}
        </Button>
      </section>

      {/* Holidays Section */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Feriados</h2>
        </div>
        <p className="text-xs text-muted-foreground">Los feriados se excluyen del cálculo de SLA (no cuentan como días hábiles).</p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input
              value={holidayForm.name}
              onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
              placeholder="Ej: Navidad"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fecha</Label>
            <Input
              type="date"
              value={holidayForm.date}
              onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer pb-1">
            <input
              type="checkbox"
              checked={holidayForm.recurring}
              onChange={(e) => setHolidayForm({ ...holidayForm, recurring: e.target.checked })}
              className="rounded"
            />
            Anual
          </label>
          <Button size="sm" onClick={saveHoliday} disabled={savingHoliday}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
          </Button>
        </div>

        {holidays.length > 0 && (
          <div className="space-y-1 pt-2">
            {holidays.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{h.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.date).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  {h.recurring && <Badge variant="secondary" className="text-[10px]">Anual</Badge>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteHoliday(h.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
