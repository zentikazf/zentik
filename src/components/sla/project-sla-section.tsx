'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowRight, Eye, ShieldCheck } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { CRITICALITY_LABEL } from '@/lib/criticality';
import type { ProjectSlaContractsResponse, SlaPolicy } from '@/types/sla.types';
import { useCanManageSla } from './use-can-manage-sla';

/** Valor centinela del select: Radix no admite `value=""`. */
const NO_POLICY = 'NONE';

/**
 * SLA del proyecto, en la pantalla de settings del proyecto.
 *
 * ── Qué cambió en #48 (R7) ──────────────────────────────────────────────────
 * Dejó de ser un EDITOR. La matriz plana tipo → política se reemplazó por el
 * centro de contratación (`/settings/sla/cobertura/[projectId]`), en el MISMO
 * release y sin convivencia: dos editores del mismo `PUT .../sla-contracts` con
 * semánticas distintas son dos escritores del mismo dato. Además la matriz vieja
 * podía contratar carpetas ocultas sin ningún aviso.
 *
 * Lo que queda acá:
 *  · el **Select del SLA propio del proyecto** (paso 2 de la cascada). Se queda
 *    Y se duplica en el header del nivel 2 a propósito (R7.3): es un PATCH de un
 *    campo escalar, idempotente y sin borrador — dos escritores ahí es riesgo
 *    cero, y sin él el centro de contratación no sería el centro de nada;
 *  · un resumen READ-ONLY de qué ve el cliente;
 *  · el CTA al taller.
 *
 * Dos puertas (cobertura y settings del proyecto), un solo taller (decisión 6).
 */
export function ProjectSlaSection({ projectId }: { projectId: string }) {
  const { orgId } = useOrg();
  const router = useRouter();
  const canManageSla = useCanManageSla();

  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [contracts, setContracts] = useState<ProjectSlaContractsResponse | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const load = useCallback(async () => {
    if (!orgId || !canManageSla) return;
    try {
      // Dos fetches, no tres: el catálogo de tipos ya no hace falta — la matriz
      // trae la jerarquía en cada fila (#48 T1b) y acá ni siquiera se pinta.
      const [policiesRes, contractsRes] = await Promise.all([
        slaService.listPolicies(orgId),
        slaService.getProjectContracts(orgId, projectId),
      ]);
      setPolicies(policiesRes.data);
      setContracts(contractsRes.data);
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo cargar el SLA del proyecto'));
    } finally {
      setLoading(false);
    }
  }, [orgId, projectId, canManageSla]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Qué ve el cliente HOY en este proyecto — el mismo eje del índice de cobertura
   * (#48 R4.4), no el "N de M cubiertos" que se eliminó (decisión 5).
   *
   * Se cuenta contratado Y visible, que es el criterio del portal: un contrato
   * sobre una carpeta oculta no le suma ninguna opción al cliente. Sin contratos
   * aplicables el portal es permisivo y ofrece todos los tipos visibles.
   */
  const offered = useMemo(() => {
    const items = contracts?.items ?? [];
    const contracted = items.filter((row) => row.isActive && row.clientVisible).length;
    const visibleTotal = items.filter((row) => row.clientVisible).length;
    return {
      contracted,
      visibleTotal,
      permissive: contracted === 0,
    };
  }, [contracts]);

  // El backend gatea la configuración de SLA por rol: para el resto la sección no existe.
  if (!canManageSla) return null;

  const handleProjectPolicyChange = async (value: string) => {
    if (!orgId) return;
    setSavingPolicy(true);
    try {
      await slaService.assignProjectPolicy(orgId, projectId, {
        slaPolicyId: value === NO_POLICY ? null : value,
      });
      setContracts((prev) =>
        prev
          ? {
              ...prev,
              project: { ...prev.project, slaPolicyId: value === NO_POLICY ? null : value },
            }
          : prev,
      );
      toast.success(
        'SLA del proyecto actualizado',
        value === NO_POLICY
          ? 'El proyecto vuelve a heredar el SLA del cliente'
          : 'Se aplicará a los tickets sin contrato para su tipo',
      );
      router.refresh();
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudo asignar la política al proyecto'));
    } finally {
      setSavingPolicy(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">SLA del proyecto</h2>
          <p className="text-xs text-muted-foreground">
            Primero manda el contrato del tipo; si no hay, se usa el SLA propio del proyecto y luego
            el del cliente.
          </p>
        </div>
      </div>

      {policies.length === 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            La organización todavía no tiene políticas SLA activas. Creá al menos una en{' '}
            <Link href="/settings/sla/politicas" className="text-primary hover:underline">
              Configuración → SLA
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SLA propio del proyecto — el ÚNICO control que queda acá (R7.3). */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">SLA propio del proyecto</p>
            <Select
              value={contracts?.project.slaPolicyId ?? NO_POLICY}
              onValueChange={handleProjectPolicyChange}
              disabled={savingPolicy}
            >
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="Sin SLA propio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_POLICY}>Sin SLA propio (hereda del cliente)</SelectItem>
                {policies.map((policy) => (
                  <SelectItem key={policy.id} value={policy.id}>
                    {policy.name} · {CRITICALITY_LABEL[policy.criticality]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Se aplica a los tickets de este proyecto cuyo tipo no tenga contrato.
            </p>
          </div>

          {/* Resumen read-only + CTA al taller (R7.2). */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Contratos por tipo de solicitud</p>
                <p className="text-xs text-muted-foreground">
                  Qué tipos puede elegir el cliente en este proyecto y con qué política se atiende
                  cada uno.
                </p>
              </div>
              <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                <Eye className="h-3 w-3" />
                {offered.permissive
                  ? `Ve todos los tipos (${offered.visibleTotal})`
                  : `Ve ${offered.contracted} tipo${offered.contracted === 1 ? '' : 's'}`}
              </Badge>
            </div>

            {offered.permissive && (
              <p className="text-[11px] text-muted-foreground">
                Este proyecto no tiene contratos: el cliente ve todos los tipos y cada ticket
                resuelve su SLA por el proyecto, el cliente o su criticidad.
              </p>
            )}

            <Button asChild variant="outline" className="rounded-full">
              <Link href={`/settings/sla/cobertura/${projectId}`}>
                Configurar contratos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
