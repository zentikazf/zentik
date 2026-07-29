'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sliders } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from '@/hooks/use-toast';
import { MappingSelect } from '@/components/client-variables/mapping-select';
import { MonthList } from '@/components/client-variables/month-list';
import { VariablesEditor } from '@/components/client-variables/variables-editor';

interface ClientLite {
  id: string;
  name: string;
  botmakerAccountId?: string | null;
}

export default function ClientVariablesPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { orgId } = useOrg();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('manage:billing');

  const [client, setClient] = useState<ClientLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [openPeriod, setOpenPeriod] = useState<string | null>(null);
  const [forceMapping, setForceMapping] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const loadClient = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await api.get<ClientLite>(`/organizations/${orgId}/clients/${clientId}`);
      setClient(res.data);
    } catch {
      toast.error('Error', 'No se pudo cargar el cliente');
    } finally {
      setLoading(false);
    }
  }, [orgId, clientId]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  const header = (
    <div className="flex items-center justify-between">
      <Link
        href={`/clients/${clientId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Cliente
      </Link>
      <h1 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
        <Sliders className="h-4 w-4 text-primary" /> Variables{client ? ` — ${client.name}` : ''}
      </h1>
    </div>
  );

  if (!canManage) {
    return (
      <div className="space-y-4">
        {header}
        <p className="py-16 text-center text-sm text-muted-foreground">
          No tenés permiso para gestionar las variables de facturación.
        </p>
      </div>
    );
  }

  if (loading || !client) {
    return (
      <div className="space-y-4">
        {header}
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  const mapped = !!client.botmakerAccountId;
  const showMapping = forceMapping || (!mapped && !manualMode);

  return (
    <div className="space-y-5">
      {header}

      {openPeriod ? (
        <VariablesEditor
          orgId={orgId!}
          clientId={clientId}
          period={openPeriod}
          accountId={client.botmakerAccountId ?? null}
          onBack={() => setOpenPeriod(null)}
          onSaved={() => setOpenPeriod(null)}
        />
      ) : showMapping ? (
        <MappingSelect
          orgId={orgId!}
          clientId={clientId}
          currentAccountId={client.botmakerAccountId}
          onMapped={() => {
            setForceMapping(false);
            setManualMode(false);
            loadClient();
          }}
          onSkip={() => {
            setForceMapping(false);
            setManualMode(true);
          }}
        />
      ) : (
        <MonthList
          orgId={orgId!}
          clientId={clientId}
          accountId={client.botmakerAccountId ?? null}
          onOpenMonth={(period) => setOpenPeriod(period)}
          onChangeAccount={() => setForceMapping(true)}
        />
      )}
    </div>
  );
}
