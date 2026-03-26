'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Clock,
  Trash2,
  Pencil,
  Users,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const EVENT_COLORS: Record<string, { bg: string; text: string }> = {
  task: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-600 dark:text-blue-400' },
  sprint_start: { bg: 'bg-green-50 dark:bg-green-950', text: 'text-green-600 dark:text-green-400' },
  sprint_end: { bg: 'bg-green-50 dark:bg-green-950', text: 'text-green-600 dark:text-green-400' },
  meeting: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600 dark:text-amber-400' },
};

interface MeetingForm {
  title: string;
  description: string;
  date: string;
  endDate: string;
  location: string;
  notifyClient: boolean;
}

const emptyForm: MeetingForm = {
  title: '',
  description: '',
  date: '',
  endDate: '',
  location: '',
  notifyClient: false,
};

export default function ProjectCalendarPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<any>(null);
  const [form, setForm] = useState<MeetingForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const loadData = useCallback(async () => {
    setLoading(true);
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const results = await Promise.allSettled([
      api.get(`/calendar/events?projectId=${projectId}&startDate=${startDate}&endDate=${endDate}`),
      api.get(`/projects/${projectId}/meetings?startDate=${startDate}&endDate=${endDate}`),
    ]);

    if (results[0].status === 'fulfilled') {
      setEvents(Array.isArray(results[0].value.data) ? results[0].value.data : []);
    }
    if (results[1].status === 'fulfilled') {
      setMeetings(Array.isArray(results[1].value.data) ? results[1].value.data : []);
    }
    setLoading(false);
  }, [projectId, year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allEvents = [
    ...events,
    ...meetings.map((m: any) => ({
      id: `meeting-${m.id}`,
      title: m.title,
      type: 'meeting',
      startDate: m.date,
      metadata: { meetingId: m.id, location: m.location },
      _raw: m,
    })),
  ];

  const getEventsForDay = (day: number) => {
    return allEvents.filter((e) => {
      const d = new Date(e.date || e.dueDate || e.startDate);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  };

  const prev = () => setCurrentDate(new Date(year, month - 1, 1));
  const next = () => setCurrentDate(new Date(year, month + 1, 1));
  const todayBtn = () => setCurrentDate(new Date());

  const isToday = (day: number) => {
    const now = new Date();
    return day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const openNewMeeting = (day?: number) => {
    setEditingMeeting(null);
    const dateStr = day
      ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T10:00`
      : '';
    setForm({ ...emptyForm, date: dateStr });
    setDialogOpen(true);
  };

  const openEditMeeting = (meeting: any) => {
    setEditingMeeting(meeting);
    setForm({
      title: meeting.title || '',
      description: meeting.description || '',
      date: meeting.date ? new Date(meeting.date).toISOString().slice(0, 16) : '',
      endDate: meeting.endDate ? new Date(meeting.endDate).toISOString().slice(0, 16) : '',
      location: meeting.location || '',
      notifyClient: meeting.notifyClient || false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Error', 'El título es obligatorio');
      return;
    }
    if (!form.date) {
      toast.error('Error', 'La fecha es obligatoria');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        date: new Date(form.date).toISOString(),
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        location: form.location || undefined,
        notifyClient: form.notifyClient,
      };

      if (editingMeeting) {
        await api.patch(`/meetings/${editingMeeting.id}`, payload);
        toast.success('Reunión actualizada');
      } else {
        await api.post(`/projects/${projectId}/meetings`, payload);
        toast.success('Reunión creada', form.notifyClient ? 'Se notificará al cliente' : undefined);
      }
      setDialogOpen(false);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al guardar reunión';
      toast.error('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (meetingId: string) => {
    try {
      await api.delete(`/meetings/${meetingId}`);
      toast.success('Reunión eliminada');
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al eliminar';
      toast.error('Error', message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>
    );
  }

  const dayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  return (
    <div className="space-y-5">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prev} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[160px] text-center text-[15px] font-semibold text-gray-800 dark:text-white">
            {MONTHS[month]} {year}
          </span>
          <button onClick={next} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={todayBtn} className="ml-2 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
            Hoy
          </button>
        </div>
        <Button className="rounded-full" onClick={() => openNewMeeting()}>
          <Plus className="mr-1.5 h-4 w-4" /> Nueva Reunión
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Tareas</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Sprints</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Reuniones</span>
      </div>

      <div className="flex gap-5">
        {/* Calendar Grid */}
        <div className="flex-1 rounded-2xl bg-white p-5 dark:bg-gray-900">
          <div className="grid grid-cols-7 gap-px">
            {DAYS.map((day) => (
              <div key={day} className="p-2 text-center text-xs font-medium text-gray-400">{day}</div>
            ))}
            {cells.map((day, i) => {
              const dayEvts = day ? getEventsForDay(day) : [];
              return (
                <div
                  key={i}
                  onClick={() => day && setSelectedDay(day)}
                  className={cn(
                    'min-h-[80px] cursor-pointer rounded-lg border border-gray-100 p-1.5 transition-colors dark:border-gray-800',
                    day ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50' : 'bg-gray-50/50 dark:bg-gray-950/30',
                    selectedDay === day && day && 'ring-2 ring-blue-500 ring-inset',
                  )}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                          isToday(day) ? 'bg-blue-600 text-white font-bold' : 'text-gray-700 dark:text-gray-300',
                        )}>{day}</span>
                        {dayEvts.length > 0 && (
                          <span className="text-[9px] text-gray-400">{dayEvts.length}</span>
                        )}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {dayEvts.slice(0, 2).map((ev, j) => {
                          const colors = EVENT_COLORS[ev.type] || EVENT_COLORS.task;
                          return (
                            <div key={j} className={cn('truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium', colors.bg, colors.text)}>
                              {ev.title}
                            </div>
                          );
                        })}
                        {dayEvts.length > 2 && (
                          <span className="text-[9px] text-gray-400">+{dayEvts.length - 2} más</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Detail Sidebar */}
        <div className="w-72 shrink-0 rounded-2xl bg-white p-5 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
              {selectedDay ? `${selectedDay} de ${MONTHS[month]}` : 'Selecciona un día'}
            </h3>
            {selectedDay && (
              <button
                onClick={() => openNewMeeting(selectedDay)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>

          {selectedDay && dayEvents.length === 0 && (
            <p className="py-8 text-center text-xs text-gray-400">Sin eventos este día</p>
          )}

          <div className="space-y-2">
            {dayEvents.map((ev) => {
              const colors = EVENT_COLORS[ev.type] || EVENT_COLORS.task;
              const isMeeting = ev.type === 'meeting';
              const rawMeeting = ev._raw;
              return (
                <div
                  key={ev.id}
                  className={cn('rounded-xl p-3 text-sm', colors.bg)}
                >
                  <div className="flex items-start justify-between">
                    <p className={cn('font-medium', colors.text)}>{ev.title}</p>
                    {isMeeting && rawMeeting && (
                      <div className="flex gap-1">
                        <button onClick={() => openEditMeeting(rawMeeting)} className="text-gray-400 hover:text-gray-600">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => handleDelete(rawMeeting.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {isMeeting && rawMeeting?.location && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                      <MapPin className="h-3 w-3" /> {rawMeeting.location}
                    </p>
                  )}
                  {isMeeting && rawMeeting?.date && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {new Date(rawMeeting.date).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                      {rawMeeting.endDate && ` — ${new Date(rawMeeting.endDate).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  )}
                  {!isMeeting && (
                    <p className="mt-0.5 text-xs text-gray-400 capitalize">
                      {ev.type === 'task' ? `Tarea · ${ev.metadata?.priority || ''}` : ev.type.replace('_', ' ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Meeting Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMeeting ? 'Editar Reunión' : 'Nueva Reunión'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ej: Revisión de alcance con cliente"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Descripción</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalles de la reunión..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Fecha y hora *</Label>
                <Input
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Fin (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Ubicación</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Google Meet / Oficina / Zoom"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Notificar al cliente</p>
                  <p className="text-xs text-gray-400">El cliente recibirá una notificación en su dashboard</p>
                </div>
              </div>
              <Switch
                checked={form.notifyClient}
                onCheckedChange={(checked) => setForm({ ...form, notifyClient: checked })}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              {editingMeeting && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  onClick={() => handleDelete(editingMeeting.id)}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Eliminar
                </Button>
              )}
              <div className={cn('flex gap-2', !editingMeeting && 'ml-auto')}>
                <Button variant="outline" className="rounded-full" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button className="rounded-full" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : editingMeeting ? 'Actualizar' : 'Crear Reunión'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
