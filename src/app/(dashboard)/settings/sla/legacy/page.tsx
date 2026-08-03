'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, Clock, Info, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Configuración SLA VIGENTE mientras el motor nuevo esté apagado: categorías de
// ticket + tiempos por criticidad. Movidas TAL CUAL desde el monolito
// `settings/sla/page.tsx` (#42 Fase 1) — mismos endpoints, mismo comportamiento.
// NO se borran: son el path activo hasta que se prenda `SLA_CASCADE_ENABLED`.

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

const critLabels: Record<string, { label: string; className: string }> = {
  HIGH: { label: 'Alta', className: 'bg-destructive/10 text-destructive' },
  MEDIUM: { label: 'Media', className: 'bg-warning/10 text-warning' },
  LOW: { label: 'Baja', className: 'bg-muted text-muted-foreground' },
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function SlaLegacyPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryConfig[]>([]);

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

  useEffect(() => {
    if (orgId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const loadAll = async () => {
    try {
      const [catRes, slaRes] = await Promise.all([
        api.get(`/organizations/${orgId}/ticket-categories`),
        api.get(`/organizations/${orgId}/sla-config`),
      ]);
      const cats = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data || [];
      setCategories(cats);

      const sla = Array.isArray(slaRes.data) ? slaRes.data : slaRes.data?.data || [];
      if (sla.length > 0) {
        setSlaForm(
          sla.map((s: SlaConfigItem) => ({
            criticality: s.criticality,
            responseTimeMinutes: s.responseTimeMinutes,
            resolutionTimeMinutes: s.resolutionTimeMinutes,
          })),
        );
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
      let detail = 'Error al guardar SLA';
      if (err instanceof ApiError) {
        const body = (err.details ?? {}) as { message?: unknown };
        if (Array.isArray(body.message)) detail = body.message.join(' · ');
        else if (typeof body.message === 'string') detail = body.message;
        else detail = err.message;
      }
      toast.error('Error', detail);
    } finally {
      setSavingSla(false);
    }
  };

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
      <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/5 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Esta es la configuración de SLA <strong>vigente hoy</strong>: la categoría del ticket define
          su criticidad y la criticidad define los tiempos. Cuando se active el motor de políticas con
          cascada, estas dos secciones quedan reemplazadas por <strong>Políticas SLA</strong> +{' '}
          <strong>Tipos de solicitud</strong>. Hasta entonces, seguí configurando acá.
        </p>
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
    </div>
  );
}
