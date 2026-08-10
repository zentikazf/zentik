'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, Eye, ListChecks, Search, ShieldCheck } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import type { SlaCoverage, SlaCoverageItem } from '@/types/sla.types';

/**
 * NIVEL 1 del centro de contratación (#48 R4).
 *
 * Es un ÍNDICE: elegís un proyecto y entrás a configurarlo. Nada más.
 *
 * Antes era una tabla-checklist con "N/M con contrato", la lista de tipos sin
 * contrato y un ✅/⚠️ binario. Se fue entero (decisión 5 del dueño: *"saber
 * cuánto están cubiertos hoy día no importa"*). Contratar los 40 tipos en los 30
 * proyectos nunca fue la meta, y el semáforo empujaba a perseguir un 100% que
 * nadie quiere.
 *
 * Lo que sí quedó es el eje que faltaba y que la tabla vieja mezclaba con el
 * estado del SLA: **qué ve el cliente**. Por eso una fila podía contradecirse
 * sola — "0 de 12 con contrato" mientras el portal le ofrecía los 12, justamente
 * PORQUE no hay contratos (modo permisivo).
 */
export default function SlaCoveragePage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [coverage, setCoverage] = useState<SlaCoverage | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await slaService.getCoverage(orgId);
      setCoverage(res.data);
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo cargar la cobertura de contratos'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const items = coverage?.items ?? [];
    if (!query) return items;
    // Se busca por proyecto Y por cliente: con muchos proyectos, "cliente X" es
    // la forma natural de llegar.
    return items.filter((item) =>
      `${item.projectName} ${item.clientName ?? ''}`.toLowerCase().includes(query),
    );
  }, [coverage, search]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!coverage) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No hay datos de cobertura para mostrar.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Contratación por proyecto</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Entrá a un proyecto para elegir qué tipos de solicitud tiene contratados y con qué
          política. Un tipo sin contrato no rompe nada: el ticket cae al SLA del proyecto, al del
          cliente o al fallback por criticidad.
        </p>

        {coverage.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay proyectos activos en la organización.
          </p>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por proyecto o cliente..."
                className="h-9 pl-8 text-sm"
                aria-label="Buscar proyecto"
              />
            </div>

            {visibleItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Ningún proyecto coincide con la búsqueda.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visibleItems.map((item) => (
                  <ProjectCoverageCard key={item.projectId} item={item} />
                ))}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              {visibleItems.length} de {coverage.totalProjects} proyecto
              {coverage.totalProjects === 1 ? '' : 's'} activo
              {coverage.totalProjects === 1 ? '' : 's'} · {coverage.totalVisibleTypes} tipo
              {coverage.totalVisibleTypes === 1 ? '' : 's'} visible
              {coverage.totalVisibleTypes === 1 ? '' : 's'} para clientes en la organización
            </p>
          </>
        )}
      </section>
    </div>
  );
}

/**
 * La card del nivel 1: **solo proyecto + cliente** (#48 R4.2), más los dos ejes
 * que sí se leen de un vistazo y que antes estaban mezclados en una sola columna:
 *
 *  · qué VE el cliente (permisivo vs. N tipos);
 *  · si hay RED DE CONTENCIÓN (SLA propio del proyecto o del cliente) para los
 *    tipos sin contrato.
 *
 * Sin números de cobertura y sin ✅/⚠️ (decisión 5).
 */
function ProjectCoverageCard({ item }: { item: SlaCoverageItem }) {
  const safetyNet = item.hasProjectPolicy
    ? 'SLA propio del proyecto'
    : item.hasClientPolicy
      ? 'SLA del cliente'
      : null;

  return (
    <Link
      href={`/settings/sla/cobertura/${item.projectId}`}
      className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="min-w-0 space-y-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{item.projectName}</p>
          <p className="truncate text-xs text-muted-foreground">{item.clientName ?? 'Sin cliente'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {/* Qué ve el cliente. En permisivo el número NO es una carencia: es el
              comportamiento definido (proyecto sin contratos = ve todo). */}
          <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
            <Eye className="h-3 w-3" />
            {item.clientSeesAllTypes
              ? `Ve todos los tipos (${item.clientVisibleTypeCount})`
              : `Ve ${item.clientVisibleTypeCount} tipo${item.clientVisibleTypeCount === 1 ? '' : 's'}`}
          </Badge>
          {safetyNet && (
            <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
              <ShieldCheck className="h-3 w-3" />
              {safetyNet}
            </Badge>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
