'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, ArrowLeft, Clock, AlertTriangle, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CategoryConfig {
  id: string;
  name: string;
  description?: string;
  criticality: 'HIGH' | 'MEDIUM' | 'LOW';
  isActive: boolean;
}

interface SlaConfigItem {
  criticality: 'HIGH' | 'MEDIUM' | 'LOW';
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
}

interface BusinessHours {
  businessHoursStart: string;
  businessHoursEnd: string;
  businessDays: string;
  timezone: string;
}

const critLabels: Record<string, { label: string; className: string }> = {
  HIGH: { label: 'Alta', className: 'bg-destructive/10 text-destructive' },
  MEDIUM: { label: 'Media', className: 'bg-warning/10 text-warning' },
  LOW: { label: 'Baja', className: 'bg-muted text-muted-foreground' },
};

const dayLabels: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' };

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function SlaSettingsPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [slaConfigs, setSlaConfigs] = useState<SlaConfigItem[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    businessHoursStart: '08:30', businessHoursEnd: '17:30', businessDays: '1,2,3,4,5', timezone: 'America/Asuncion',
  });

  // Category form
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryConfig | null>(null);
  const [catForm, setCatForm] = useState({ name: '', description: '', criticality: 'MEDIUM' });
  const [savingCat, setSavingCat] = useState(false);

  // SLA form
  const [slaForm, setSlaForm] = useState<SlaConfigItem[]>([
    { criticality: 'HIGH', responseTimeMinutes: 120, resolutionTimeMinutes: 480 },
    { criticality: 'MEDIUM', responseTimeMinutes: 240, resolutionTimeMinutes: 1440 },
    { criticality: 'LOW', responseTimeMinutes: 480, resolutionTimeMinutes: 4320 },
  ]);
  const [savingSla, setSavingSla] = useState(false);

  // BH form
  const [bhForm, setBhForm] = useState<BusinessHours>({
    businessHoursStart: '08:30', businessHoursEnd: '17:30', businessDays: '1,2,3,4,5', timezone: 'America/Asuncion',
  });
  const [savingBh, setSavingBh] = useState(false);

  useEffect(() => {
    if (orgId) loadAll();
  }, [orgId]);

  const loadAll = async () => {
    try {
      const [catRes, slaRes, bhRes] = await Promise.all([
        api.get(`/organizations/${orgId}/ticket-categories`),
        api.get(`/organizations/${orgId}/sla-config`),
        api.get(`/organizations/${orgId}/business-hours`),
      ]);
      const cats = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data || [];
      setCategories(cats);

      const sla = Array.isArray(slaRes.data) ? slaRes.data : slaRes.data?.data || [];
      if (sla.length > 0) {
        setSlaConfigs(sla);
        setSlaForm(sla.map((s: any) => ({
          criticality: s.criticality,
          responseTimeMinutes: s.responseTimeMinutes,
          resolutionTimeMinutes: s.resolutionTimeMinutes,
        })));
      }

      const bh = slaRes.data && !Array.isArray(bhRes.data) ? bhRes.data : bhRes.data?.data || bhRes.data;
      if (bh?.businessHoursStart) {
        setBusinessHours(bh);
        setBhForm(bh);
      }
    } catch {
      toast.error('Error', 'Error al cargar configuración de SLA');
    } finally {
      setLoading(false);
    }
  };

  // Category CRUD
  const openCreateCat = () => {
    setEditingCat(null);
    setCatForm({ name: '', description: '', criticality: 'MEDIUM' });
    setShowCatDialog(true);
  };

  const openEditCat = (cat: CategoryConfig) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, description: cat.description || '', criticality: cat.criticality });
    setShowCatDialog(true);
  };

  const saveCat = async () => {
    if (!catForm.name.trim()) { toast.error('Error', 'El nombre es requerido'); return; }
    setSavingCat(true);
    try {
      if (editingCat) {
        await api.patch(`/organizations/${orgId}/ticket-categories/${editingCat.id}`, catForm);
        toast.success('Actualizada', 'Categoría actualizada');
      } else {
        await api.post(`/organizations/${orgId}/ticket-categories`, catForm);
        toast.success('Creada', 'Categoría creada');
      }
      setShowCatDialog(false);
      await loadAll();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al guardar');
    } finally {
      setSavingCat(false);
    }
  };

  const deleteCat = async (catId: string) => {
    try {
      await api.delete(`/organizations/${orgId}/ticket-categories/${catId}`);
      toast.success('Desactivada', 'Categoría desactivada');
      await loadAll();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al eliminar');
    }
  };

  // SLA save
  const saveSla = async () => {
    setSavingSla(true);
    try {
      await api.patch(`/organizations/${orgId}/sla-config`, { configs: slaForm });
      toast.success('Guardado', 'Configuración de SLA actualizada');
      await loadAll();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al guardar SLA');
    } finally {
      setSavingSla(false);
    }
  };

  // Business hours save
  const saveBh = async () => {
    setSavingBh(true);
    try {
      await api.patch(`/organizations/${orgId}/business-hours`, bhForm);
      toast.success('Guardado', 'Horario hábil actualizado');
      await loadAll();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al guardar horario');
    } finally {
      setSavingBh(false);
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
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">SLA y Categorías de Ticket</h1>
          <p className="text-sm text-muted-foreground">Configura tiempos de respuesta, categorías y horario hábil</p>
        </div>
      </div>

      {/* Categories Section */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-base font-semibold">Categorías de Ticket</h2>
          </div>
          <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreateCat}><Plus className="mr-2 h-3.5 w-3.5" /> Nueva categoría</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>{editingCat ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Ej: Integración de API" />
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} placeholder="Descripción opcional" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Criticidad (mapea a SLA)</Label>
                  <Select value={catForm.criticality} onValueChange={(v) => setCatForm({ ...catForm, criticality: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH">Alta — Respuesta rápida</SelectItem>
                      <SelectItem value="MEDIUM">Media — Estándar</SelectItem>
                      <SelectItem value="LOW">Baja — Sin urgencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={saveCat} disabled={savingCat}>
                  {savingCat ? 'Guardando...' : editingCat ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No hay categorías configuradas. Las categorías permiten asignar SLA automáticamente.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className={cn('flex items-center justify-between rounded-lg border p-3', !cat.isActive && 'opacity-50')}>
                <div className="flex items-center gap-3">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', critLabels[cat.criticality]?.className)}>
                    <AlertTriangle className="h-3 w-3" /> {critLabels[cat.criticality]?.label}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{cat.name}</p>
                    {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                  </div>
                  {!cat.isActive && <Badge variant="secondary" className="text-[10px]">Inactiva</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCat(cat)}><Pencil className="h-3.5 w-3.5" /></Button>
                  {cat.isActive && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCat(cat.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SLA Config Section */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Tiempos de SLA</h2>
        </div>
        <p className="text-xs text-muted-foreground">Define el tiempo máximo de respuesta y resolución por nivel de criticidad.</p>

        <div className="space-y-3">
          {slaForm.map((item, idx) => {
            const crit = critLabels[item.criticality];
            return (
              <div key={item.criticality} className="grid grid-cols-[120px_1fr_1fr] gap-3 items-center">
                <span className={cn('inline-flex items-center justify-center gap-1 rounded-full px-2 py-1 text-xs font-medium', crit?.className)}>
                  {crit?.label}
                </span>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Respuesta (min)</Label>
                  <Input type="number" min={1} value={item.responseTimeMinutes} onChange={(e) => {
                    const next = [...slaForm];
                    next[idx] = { ...next[idx], responseTimeMinutes: Number(e.target.value) };
                    setSlaForm(next);
                  }} />
                  <span className="text-[10px] text-muted-foreground">{formatMinutes(item.responseTimeMinutes)}</span>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Resolución (min)</Label>
                  <Input type="number" min={1} value={item.resolutionTimeMinutes} onChange={(e) => {
                    const next = [...slaForm];
                    next[idx] = { ...next[idx], resolutionTimeMinutes: Number(e.target.value) };
                    setSlaForm(next);
                  }} />
                  <span className="text-[10px] text-muted-foreground">{formatMinutes(item.resolutionTimeMinutes)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <Button onClick={saveSla} disabled={savingSla} className="w-full sm:w-auto">
          {savingSla ? 'Guardando...' : 'Guardar SLA'}
        </Button>
      </section>

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
    </div>
  );
}
