'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import { Clock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { criticalityStyle, type Criticality } from '@/lib/criticality';

// Tiempos de SLA del modelo VIEJO: minutos de respuesta/resolución por criticidad
// (`SlaConfig`). Es el único path activo mientras `SLA_CASCADE_ENABLED` esté
// apagado, por eso NO se borra.
//
// #42 Fase 2.1: las "Categorías de Ticket" que vivían acá se mudaron a su tab
// propia (`/settings/sla/categorias-internas`). No son legacy: en el modelo nuevo
// son la clasificación interna que el equipo asigna al tipificar.

interface SlaConfigItem {
  criticality: Criticality;
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function SlaLegacyPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);

  const [slaForm, setSlaForm] = useState<SlaConfigItem[]>([
    { criticality: 'HIGH', responseTimeMinutes: 120, resolutionTimeMinutes: 480 },
    { criticality: 'MEDIUM', responseTimeMinutes: 240, resolutionTimeMinutes: 1440 },
    { criticality: 'LOW', responseTimeMinutes: 480, resolutionTimeMinutes: 4320 },
  ]);
  const [savingSla, setSavingSla] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const slaRes = await api.get(`/organizations/${orgId}/sla-config`);
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
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSla = async () => {
    setSavingSla(true);
    try {
      await api.patch(`/organizations/${orgId}/sla-config`, { configs: slaForm });
      toast.success('Guardado', 'Configuración de SLA actualizada');
      await load();
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
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/5 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Estos son los <strong>tiempos de SLA del modelo viejo</strong>: la criticidad del ticket
          define sus minutos de respuesta y resolución. Es lo que se aplica hoy, mientras el motor de
          políticas con cascada esté apagado. Cuando se active, esta sección queda reemplazada por{' '}
          <Link href="/settings/sla/politicas" className="text-primary hover:underline">
            Políticas SLA
          </Link>{' '}
          +{' '}
          <Link href="/settings/sla/tipos" className="text-primary hover:underline">
            Tipos de solicitud
          </Link>
          . Las categorías de ticket ya no están acá: se administran en{' '}
          <Link href="/settings/sla/categorias-internas" className="text-primary hover:underline">
            Categorías internas
          </Link>
          .
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Tiempos de SLA</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Define el tiempo máximo de respuesta y resolución por nivel de criticidad.
        </p>

        <div className="space-y-3">
          {slaForm.map((item, idx) => {
            const crit = criticalityStyle(item.criticality);
            return (
              <div key={item.criticality} className="grid grid-cols-[120px_1fr_1fr] items-center gap-3">
                <span
                  className={cn(
                    'inline-flex items-center justify-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                    crit.badgeClass,
                  )}
                >
                  {crit.label}
                </span>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Respuesta (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.responseTimeMinutes}
                    onChange={(e) => {
                      const next = [...slaForm];
                      next[idx] = { ...next[idx], responseTimeMinutes: Number(e.target.value) };
                      setSlaForm(next);
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {formatMinutes(item.responseTimeMinutes)}
                  </span>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Resolución (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.resolutionTimeMinutes}
                    onChange={(e) => {
                      const next = [...slaForm];
                      next[idx] = { ...next[idx], resolutionTimeMinutes: Number(e.target.value) };
                      setSlaForm(next);
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {formatMinutes(item.resolutionTimeMinutes)}
                  </span>
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
