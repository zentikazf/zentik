'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sliders, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatUsd } from '@/components/client-billing/types';

interface AccountOption {
  accountId: string;
  accountName: string;
  accountAlias: string;
  totalSpend: number;
  mappedTo: { clientId: string; clientName: string } | null;
}

interface Props {
  orgId: string;
  clientId: string;
  currentAccountId?: string | null;
  onMapped: () => void;
  onSkip?: () => void; // seguir sin mapear (variables 100% manuales)
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * #23 — Selector de cuenta Botmaker para mapear (fija Client.botmakerAccountId). Lista las cuentas del
 * período elegido, marca las ya mapeadas a otro cliente. Estética del sistema (cards/bordes).
 */
export function MappingSelect({ orgId, clientId, currentAccountId, onMapped, onSkip }: Props) {
  const [period, setPeriod] = useState(currentMonth());
  const [enabled, setEnabled] = useState(true);
  const [accounts, setAccounts] = useState<AccountOption[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setAccounts(null);
    try {
      const res = await api.get<{ enabled: boolean; accounts: AccountOption[] }>(
        `/organizations/${orgId}/billing/botmaker/accounts?period=${period}`,
      );
      setEnabled(res.data.enabled);
      setAccounts(res.data.accounts);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudieron cargar las cuentas de Botmaker');
      setAccounts([]);
    }
  }, [orgId, period]);

  useEffect(() => {
    load();
  }, [load]);

  const map = async (accountId: string) => {
    setSaving(accountId);
    try {
      await api.patch(`/organizations/${orgId}/clients/${clientId}`, { botmakerAccountId: accountId });
      toast.success('Cuenta mapeada', 'Ya podés cargar las variables por mes');
      onMapped();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo mapear la cuenta');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Sliders className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-[15px] font-semibold text-foreground">Mapeá la cuenta de Botmaker</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Elegí la cuenta del cliente para traer su consumo. Se guarda el identificador; podés recambiarlo cuando quieras.
        </p>

        <div className="mx-auto mt-4 flex max-w-xs items-end gap-2">
          <div className="flex-1 space-y-1 text-left">
            <Label className="text-xs">Período (para listar consumo)</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <Button variant="outline" size="icon" onClick={load} title="Recargar">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {onSkip && (
          <button
            onClick={onSkip}
            className="mt-3 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
          >
            Seguir sin mapear (cargar variables manuales)
          </button>
        )}
      </div>

      {accounts === null ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : !enabled ? (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            La facturación de Botmaker está deshabilitada. Configurá <code>BOTMAKER_BILLING_ENABLED=true</code> y el
            token en el backend para listar cuentas. Igual podés cargar variables manuales sin mapear.
          </span>
        </div>
      ) : accounts.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Sin cuentas con consumo en {period}. Probá otro período.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {accounts.map((a) => {
              const mappedElsewhere = a.mappedTo && a.mappedTo.clientId !== clientId;
              const isCurrent = a.accountId === currentAccountId;
              return (
                <button
                  key={a.accountId}
                  onClick={() => map(a.accountId)}
                  disabled={!!saving}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {a.accountAlias || a.accountName || a.accountId}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px] text-muted-foreground">{a.accountId}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                          Actual
                        </span>
                      )}
                      {mappedElsewhere && (
                        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                          Ya mapeada a {a.mappedTo!.clientName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{formatUsd(a.totalSpend)}</span>
                    {saving === a.accountId ? (
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <Check className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
