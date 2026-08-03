'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { slaService } from '@/services/sla.service';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { SLA_CRITICALITY_LABEL, type SlaPolicy } from '@/types/sla.types';
import { useCanManageSla } from './use-can-manage-sla';

/** Valor centinela del select: Radix no admite `value=""`. */
const NO_POLICY = 'NONE';

interface ClientSlaCardProps {
  clientId: string;
  /** Valor actual del cliente (`Client.defaultSlaPolicyId`). */
  defaultSlaPolicyId?: string | null;
}

/**
 * SLA por defecto del cliente (#42 Fase 1) — paso 3 de la cascada.
 * Se usa cuando el ticket no tiene contrato para su tipo ni el proyecto tiene
 * SLA propio.
 */
export function ClientSlaCard({ clientId, defaultSlaPolicyId }: ClientSlaCardProps) {
  const { orgId } = useOrg();
  const router = useRouter();
  const canManageSla = useCanManageSla();
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [value, setValue] = useState<string>(defaultSlaPolicyId ?? NO_POLICY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(defaultSlaPolicyId ?? NO_POLICY);
  }, [defaultSlaPolicyId]);

  const load = useCallback(async () => {
    if (!orgId || !canManageSla) return;
    try {
      const res = await slaService.listPolicies(orgId);
      setPolicies(res.data);
    } catch (err) {
      toast.error('Error', getApiErrorMessage(err, 'No se pudieron cargar las políticas SLA'));
    } finally {
      setLoading(false);
    }
  }, [orgId, canManageSla]);

  useEffect(() => {
    load();
  }, [load]);

  // El backend gatea la configuración de SLA por rol: para el resto la card no existe.
  if (!canManageSla) return null;

  const handleChange = async (next: string) => {
    if (!orgId) return;
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      await slaService.assignClientPolicy(orgId, clientId, {
        slaPolicyId: next === NO_POLICY ? null : next,
      });
      toast.success(
        'SLA del cliente actualizado',
        next === NO_POLICY
          ? 'Sus tickets caen al fallback por criticidad'
          : 'Se aplica a los tickets sin contrato ni SLA de proyecto',
      );
      router.refresh();
    } catch (err) {
      setValue(previous); // rollback visual: el backend no aceptó el cambio
      toast.error('Error', getApiErrorMessage(err, 'No se pudo asignar la política al cliente'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-card-foreground">SLA por defecto</p>
          <p className="text-sm text-muted-foreground">
            Se aplica a los tickets de este cliente cuando el proyecto no define uno
          </p>
        </div>
        <div className="w-full max-w-[260px] shrink-0">
          {loading ? (
            <Skeleton className="h-10 w-full rounded-md" />
          ) : policies.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sin políticas activas.{' '}
              <Link href="/settings/sla/politicas" className="text-primary hover:underline">
                Crear una
              </Link>
            </p>
          ) : (
            <Select value={value} onValueChange={handleChange} disabled={saving}>
              <SelectTrigger>
                <SelectValue placeholder="Sin SLA por defecto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_POLICY}>Sin SLA por defecto</SelectItem>
                {policies.map((policy) => (
                  <SelectItem key={policy.id} value={policy.id}>
                    {policy.name} · {SLA_CRITICALITY_LABEL[policy.criticality]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  );
}
