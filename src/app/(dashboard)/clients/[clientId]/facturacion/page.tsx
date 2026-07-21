'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from '@/hooks/use-toast';
import { BillingCyclesList } from '@/components/client-billing/billing-cycles-list';
import { BillingCycleBuilder } from '@/components/client-billing/billing-cycle-builder';
import { CycleBuilder, MonthSummary } from '@/components/client-billing/types';

export default function ClientBillingPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { orgId } = useOrg();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('manage:billing');

  const [months, setMonths] = useState<MonthSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string | null>(null);
  const [builder, setBuilder] = useState<CycleBuilder | null>(null);
  const [loadingBuilder, setLoadingBuilder] = useState(false);

  const loadCycles = useCallback(async () => {
    if (!orgId || !clientId) return;
    setLoading(true);
    try {
      const res = await api.get<MonthSummary[]>(
        `/organizations/${orgId}/clients/${clientId}/billing/cycles`,
      );
      setMonths(res.data);
    } catch {
      toast.error('Error', 'No se pudieron cargar los meses de facturación');
    } finally {
      setLoading(false);
    }
  }, [orgId, clientId]);

  const loadBuilder = useCallback(
    async (p: string) => {
      if (!orgId || !clientId) return;
      setLoadingBuilder(true);
      try {
        const res = await api.get<CycleBuilder>(
          `/organizations/${orgId}/clients/${clientId}/billing/cycles/${p}`,
        );
        setBuilder(res.data);
      } catch {
        toast.error('Error', 'No se pudo cargar el detalle del mes');
      } finally {
        setLoadingBuilder(false);
      }
    },
    [orgId, clientId],
  );

  useEffect(() => {
    loadCycles();
  }, [loadCycles]);

  useEffect(() => {
    if (period) loadBuilder(period);
    else setBuilder(null);
  }, [period, loadBuilder]);

  const handleChanged = () => {
    loadCycles();
    if (period) loadBuilder(period);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    );
  }

  if (period) {
    if (loadingBuilder && !builder) {
      return <Skeleton className="h-[400px] rounded-xl" />;
    }
    if (builder) {
      return (
        <BillingCycleBuilder
          orgId={orgId ?? ''}
          clientId={clientId}
          builder={builder}
          canManage={canManage}
          onBack={() => setPeriod(null)}
          onChanged={handleChanged}
        />
      );
    }
  }

  return <BillingCyclesList months={months} onSelect={setPeriod} />;
}
