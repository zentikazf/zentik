'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, ExternalLink, ListChecks } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import type { SlaCoverage } from '@/types/sla.types';

/**
 * Checklist de cobertura: por cada proyecto ACTIVO, qué tipos de solicitud ya
 * tienen contrato (✅) y cuáles caerían al fallback de la cascada (⚠️).
 */
export default function SlaCoveragePage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [coverage, setCoverage] = useState<SlaCoverage | null>(null);

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

  const incomplete = coverage.items.filter((item) => !item.isComplete).length;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Proyectos activos</p>
          <p className="text-xl font-semibold text-foreground">{coverage.totalProjects}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Con todos los tipos cubiertos</p>
          <p className="text-xl font-semibold text-success">{coverage.completeProjects}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Con tipos sin contrato</p>
          <p className="text-xl font-semibold text-warning">{incomplete}</p>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Cobertura de contratos</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Un tipo sin contrato no rompe nada: el ticket cae al SLA del proyecto, al del cliente o al
          fallback por criticidad. Este checklist muestra dónde el SLA todavía no es explícito.
        </p>

        {coverage.totalTypes === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Todavía no hay tipos de solicitud activos. Creá al menos uno en la tab Tipos de solicitud.
          </p>
        ) : coverage.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay proyectos activos en la organización.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proyecto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="w-[110px]">Cobertura</TableHead>
                <TableHead>Tipos sin contrato</TableHead>
                <TableHead className="w-[70px] text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coverage.items.map((item) => (
                <TableRow key={item.projectId}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/projects/${item.projectId}/settings`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {item.projectName}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.clientName ?? '—'}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {item.coveredTypes}/{item.totalTypes}
                  </TableCell>
                  <TableCell>
                    {item.isComplete ? (
                      <span className="text-xs text-muted-foreground">Todos cubiertos</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {item.missingTypes.map((type) => (
                          <Badge key={type.id} variant="warning" className="text-[10px]">
                            {type.name}
                          </Badge>
                        ))}
                        {/* Red de contención: si el proyecto o el cliente tienen SLA propio,
                            el hueco no cae al fallback por criticidad. */}
                        {(item.hasProjectPolicy || item.hasClientPolicy) && (
                          <Badge variant="secondary" className="text-[10px]">
                            {item.hasProjectPolicy ? 'Cubierto por SLA de proyecto' : 'Cubierto por SLA de cliente'}
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.isComplete ? (
                      <CheckCircle2
                        className="ml-auto h-4 w-4 text-success"
                        aria-label="Cobertura completa"
                      />
                    ) : (
                      <AlertTriangle
                        className="ml-auto h-4 w-4 text-warning"
                        aria-label="Faltan contratos"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
