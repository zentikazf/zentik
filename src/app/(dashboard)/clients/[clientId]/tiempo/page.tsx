'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Building,
  ArrowLeft,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Lock,
  DollarSign,
  type LucideIcon,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

interface HoursTransaction {
  id: string;
  type: string;
  hours: number;
  note: string | null;
  createdAt: string;
  priceAmount: string | null;
  priceRate: string | null;
  priceCurrency: string | null;
  billedCycleId: string | null;
  task?: { id: string; title: string; type?: 'SUPPORT' | 'PROJECT' | null; project?: { id: string; name: string } } | null;
}

interface HoursSummary {
  contractedHours: number;
  usedHours: number;
  loanedHours: number;
  availableHours: number;
  developmentHourlyRate: number | null;
  supportHourlyRate: number | null;
  currency: string;
  totalAmount: number;
  transactions: HoursTransaction[];
  transactionsTotal: number;
  page: number;
  limit: number;
}

interface ClientHeader {
  id: string;
  name: string;
  email?: string;
  contractedHours: number;
  usedHours: number;
}

const HOURS_PAGE_SIZE = 20;

type MovementFilter = 'ACUMULADAS' | 'DESCUENTO' | null;

const MOVEMENT_FILTERS: { label: string; value: MovementFilter }[] = [
  { label: 'Todas', value: null },
  { label: 'Acumuladas', value: 'ACUMULADAS' },
  { label: 'Descuento', value: 'DESCUENTO' },
];

export default function ClientTiempoPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { orgId } = useOrg();
  const { user: authUser } = useAuth();
  const { hasPermission } = usePermissions();
  const canEditHours = hasPermission('manage:projects');

  const [client, setClient] = useState<ClientHeader | null>(null);
  const [hours, setHours] = useState<HoursSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingHours, setLoadingHours] = useState(false);
  const [hoursPage, setHoursPage] = useState(1);
  const [movementFilter, setMovementFilter] = useState<MovementFilter>(null);

  // Add hours dialog
  const [showAddHours, setShowAddHours] = useState(false);
  const [hoursForm, setHoursForm] = useState({ hours: '', note: '' });
  const [savingHours, setSavingHours] = useState(false);

  // Delete hours transaction
  const [deleteTxConfirm, setDeleteTxConfirm] = useState<{ id: string; type: string; hours: number; note: string | null } | null>(null);
  const [deleteTxReason, setDeleteTxReason] = useState('');
  const [deletingTx, setDeletingTx] = useState(false);

  // Edit hours transaction (solo USAGE/LOAN, gateado por manage:projects)
  const [editTxConfirm, setEditTxConfirm] = useState<HoursTransaction | null>(null);
  const [editTxHours, setEditTxHours] = useState('');
  const [editTxRate, setEditTxRate] = useState('');
  const [editingTx, setEditingTx] = useState(false);

  const loadClient = useCallback(async () => {
    if (!orgId || !clientId) return;
    try {
      const res = await api.get<ClientHeader>(`/organizations/${orgId}/clients/${clientId}`);
      setClient(res.data);
    } catch {
      toast.error('Error', 'No se pudo cargar el cliente');
    } finally {
      setLoading(false);
    }
  }, [orgId, clientId]);

  const loadHours = useCallback(
    async (page: number, movement: MovementFilter) => {
      if (!orgId || !clientId) return;
      setLoadingHours(true);
      try {
        const qs = new URLSearchParams({ page: String(page), limit: String(HOURS_PAGE_SIZE) });
        if (movement) qs.set('movement', movement);
        const res = await api.get<HoursSummary>(
          `/organizations/${orgId}/clients/${clientId}/hours?${qs.toString()}`,
        );
        setHours(res.data);
      } catch {
        toast.error('Error', 'No se pudieron cargar las horas');
      } finally {
        setLoadingHours(false);
      }
    },
    [orgId, clientId],
  );

  useEffect(() => {
    if (orgId && clientId) {
      loadClient();
      loadHours(1, movementFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, clientId]);

  useEffect(() => {
    if (orgId && clientId && !loading) loadHours(hoursPage, movementFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoursPage]);

  const handleFilterChange = (next: MovementFilter) => {
    setMovementFilter(next);
    setHoursPage(1);
    loadHours(1, next);
  };

  const handleDeleteTransaction = async () => {
    if (!orgId || !deleteTxConfirm || !deleteTxReason.trim() || !authUser?.id) return;
    setDeletingTx(true);
    try {
      await api.post(`/organizations/${orgId}/clients/${clientId}/hours/${deleteTxConfirm.id}/delete`, {
        reason: deleteTxReason.trim(),
        deletedById: authUser.id,
      });
      toast.success('Transacción eliminada', 'Se revirtió el efecto en las horas del cliente');
      setDeleteTxConfirm(null);
      setDeleteTxReason('');
      loadHours(hoursPage, movementFilter);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al eliminar transacción');
    } finally {
      setDeletingTx(false);
    }
  };

  const handleEditTransaction = async () => {
    if (!orgId || !editTxConfirm) return;
    const newHours = Number(editTxHours);
    const newRate = editTxRate.trim() === '' ? null : Number(editTxRate);

    if (Number.isNaN(newHours) || newHours <= 0) {
      toast.error('Error', 'Las horas deben ser un número mayor a 0');
      return;
    }
    if (newRate !== null && (Number.isNaN(newRate) || newRate < 0)) {
      toast.error('Error', 'La tarifa debe ser un número mayor o igual a 0');
      return;
    }

    setEditingTx(true);
    try {
      await api.post(`/organizations/${orgId}/clients/${clientId}/hours/${editTxConfirm.id}/edit`, {
        hours: newHours,
        priceRate: newRate,
      });
      toast.success('Transacción editada', 'Datos actualizados y cupo del cliente ajustado');
      setEditTxConfirm(null);
      setEditTxHours('');
      setEditTxRate('');
      loadHours(hoursPage, movementFilter);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al editar transacción');
    } finally {
      setEditingTx(false);
    }
  };

  const handleAddHours = async () => {
    if (!orgId || !hoursForm.hours) return;
    setSavingHours(true);
    try {
      await api.post(`/organizations/${orgId}/clients/${clientId}/hours`, {
        hours: Number(hoursForm.hours),
        note: hoursForm.note.trim() || undefined,
      });
      toast.success('Horas agregadas', `Se cargaron ${hoursForm.hours} horas al cliente`);
      setShowAddHours(false);
      setHoursForm({ hours: '', note: '' });
      loadHours(hoursPage, movementFilter);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al agregar horas');
    } finally {
      setSavingHours(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Cliente no encontrado</p>
      </div>
    );
  }

  const available = hours?.availableHours ?? 0;
  const percentUsed = hours && hours.contractedHours > 0
    ? Math.min(Math.round((hours.usedHours / hours.contractedHours) * 100), 100)
    : 0;

  const TYPE_LABELS: Record<string, { label: string; color: string; icon: LucideIcon }> = {
    PURCHASE: { label: 'Compra', color: 'text-success', icon: ArrowUpRight },
    USAGE: { label: 'Uso', color: 'text-primary', icon: ArrowDownRight },
    LOAN: { label: 'Prestamo', color: 'text-warning', icon: AlertTriangle },
    REFUND: { label: 'Reembolso', color: 'text-info', icon: ArrowUpRight },
    INTERNAL: { label: 'Interno', color: 'text-muted-foreground', icon: Clock },
  };

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link href={`/clients/${clientId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-3">
          <ArrowLeft className="h-4 w-4" /> Volver al cliente
        </Link>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-card-foreground">Tiempo</h1>
              <p className="text-sm text-muted-foreground">{client.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Hours Widget - Full width */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold text-card-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Horas Contratadas
          </h2>
          <Button size="sm" onClick={() => setShowAddHours(true)}>
            <Plus className="mr-1 h-3 w-3" /> Agregar Horas
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 mb-5">
          <div className="rounded-xl bg-primary/10 p-4">
            <p className="text-xs text-primary font-medium">Contratadas</p>
            <p className="text-2xl font-bold text-primary">{hours?.contractedHours ?? 0}h</p>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <p className="text-xs text-muted-foreground font-medium">Consumidas</p>
            <p className="text-2xl font-bold text-foreground">{(hours?.usedHours ?? 0).toFixed(1)}h</p>
          </div>
          <div className={`rounded-xl p-4 ${available > 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
            <p className={`text-xs font-medium ${available > 0 ? 'text-success' : 'text-destructive'}`}>Disponibles</p>
            <p className={`text-2xl font-bold ${available > 0 ? 'text-success' : 'text-destructive'}`}>{available.toFixed(1)}h</p>
          </div>
          <div className="rounded-xl bg-warning/10 p-4">
            <p className="text-xs text-warning font-medium">Prestamo</p>
            <p className="text-2xl font-bold text-warning">{(hours?.loanedHours ?? 0).toFixed(1)}h</p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 col-span-2 lg:col-span-1">
            <p className="text-xs text-primary font-medium flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Total facturable
            </p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(hours?.totalAmount ?? 0, hours?.currency ?? 'PYG')}
            </p>
          </div>
        </div>

        {/* Tarifas por hora */}
        {hours && (hours.developmentHourlyRate != null || hours.supportHourlyRate != null) && (
          <div className="mb-5 rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">
              Tarifas por hora ({hours.currency || 'PYG'})
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Desarrollo</p>
                <p className="text-lg font-bold text-foreground">
                  {hours.developmentHourlyRate != null
                    ? new Intl.NumberFormat('es-PY').format(Number(hours.developmentHourlyRate))
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Soporte</p>
                <p className="text-lg font-bold text-foreground">
                  {hours.supportHourlyRate != null
                    ? new Intl.NumberFormat('es-PY').format(Number(hours.supportHourlyRate))
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {hours && hours.contractedHours > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">{percentUsed}% consumido</span>
              <span className="text-muted-foreground">{hours.usedHours.toFixed(1)} / {hours.contractedHours}h</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  percentUsed >= 100 ? 'bg-destructive' : percentUsed >= 80 ? 'bg-warning' : 'bg-primary'
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>
        )}

        {/* Historial detallado + filtro de movimiento */}
        <Separator className="mb-4" />
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            Historial detallado de horas
          </p>
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 p-1">
            {MOVEMENT_FILTERS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => handleFilterChange(opt.value)}
                disabled={loadingHours}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                  movementFilter === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {hours && hours.transactions.length > 0 ? (
          <div>
            <div className="flex items-center justify-end mb-3">
              <p className="text-[11px] text-muted-foreground">
                {(() => {
                  const total = hours.transactionsTotal ?? hours.transactions.length;
                  const page = hours.page ?? 1;
                  const limit = hours.limit ?? hours.transactions.length;
                  const from = hours.transactions.length === 0 ? 0 : (page - 1) * limit + 1;
                  const to = (page - 1) * limit + hours.transactions.length;
                  return (
                    <>
                      Mostrando {from}–{to} de{' '}
                      <span className="font-semibold text-foreground">{total}</span> transacciones
                    </>
                  );
                })()}
              </p>
            </div>
            <div className={`rounded-xl border border-border overflow-hidden ${loadingHours ? 'opacity-60' : ''}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Fecha</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Concepto</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Proyecto</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Movimiento</th>
                      <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Horas</th>
                      <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Tarifa</th>
                      <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Costo</th>
                      <th className="px-3 py-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {hours.transactions.map((tx) => {
                      const conf = TYPE_LABELS[tx.type] || TYPE_LABELS.USAGE;
                      const Icon = conf.icon;
                      const isCredit = tx.type === 'PURCHASE' || tx.type === 'REFUND';
                      return (
                        <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleDateString('es-PY', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="text-sm text-foreground truncate max-w-[220px]">
                              {tx.task?.title ?? tx.note ?? conf.label}
                            </p>
                            {tx.task && tx.note && tx.note !== tx.task.title && (
                              <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">{tx.note}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[140px]">
                            {tx.task?.project?.name ?? '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              tx.type === 'PURCHASE' ? 'bg-success/15 text-success' :
                              tx.type === 'REFUND' ? 'bg-info/15 text-info' :
                              tx.type === 'LOAN' ? 'bg-warning/15 text-warning' :
                              tx.type === 'INTERNAL' ? 'bg-muted text-muted-foreground' :
                              tx.task?.type === 'SUPPORT' ? 'bg-warning/15 text-warning' :
                              tx.task?.type === 'PROJECT' ? 'bg-info/15 text-info' :
                              'bg-primary/15 text-primary'
                            }`}>
                              <Icon className="h-3 w-3" />
                              {tx.type === 'USAGE' && tx.task?.type === 'SUPPORT' ? 'Soporte' :
                                tx.type === 'USAGE' && tx.task?.type === 'PROJECT' ? 'Desarrollo' :
                                conf.label}
                            </span>
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono text-sm font-semibold whitespace-nowrap ${
                            isCredit ? 'text-success' : conf.color
                          }`}>
                            {isCredit ? '+' : '−'}{tx.hours.toFixed(2)}h
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {tx.priceRate
                              ? formatCurrency(tx.priceRate, tx.priceCurrency ?? hours.currency)
                              : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-sm font-semibold text-foreground whitespace-nowrap">
                            {tx.priceAmount
                              ? formatCurrency(tx.priceAmount, tx.priceCurrency ?? hours.currency)
                              : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1 justify-end">
                              {/* Movimiento facturado (#25): inmutable, read-only. */}
                              {tx.billedCycleId ? (
                                <span
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40"
                                  title="Movimiento facturado (solo lectura). Reabrí el ciclo para editarlo."
                                >
                                  <Lock className="h-3.5 w-3.5" />
                                </span>
                              ) : (
                                <>
                                  {canEditHours && (tx.type === 'USAGE' || tx.type === 'LOAN') && (
                                    <button
                                      onClick={() => {
                                        setEditTxConfirm(tx);
                                        setEditTxHours(String(tx.hours));
                                        setEditTxRate(tx.priceRate ? String(tx.priceRate) : '');
                                      }}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 hover:bg-primary/10 hover:text-primary transition-colors"
                                      title="Editar horas / tarifa"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setDeleteTxConfirm({ id: tx.id, type: tx.type, hours: tx.hours, note: tx.note })}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                    title="Eliminar transacción"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination — solo si el backend devuelve datos paginados */}
            {hours.transactionsTotal != null && hours.limit != null && hours.transactionsTotal > hours.limit && (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">
                  Página {hours.page} de {Math.max(1, Math.ceil(hours.transactionsTotal / hours.limit))}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setHoursPage((p) => Math.max(1, p - 1))}
                    disabled={hours.page <= 1 || loadingHours}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() =>
                      setHoursPage((p) =>
                        Math.min(Math.ceil(hours.transactionsTotal / hours.limit), p + 1),
                      )
                    }
                    disabled={hours.page >= Math.ceil(hours.transactionsTotal / hours.limit) || loadingHours}
                  >
                    Siguiente <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <p className="mt-2 text-[11px] text-muted-foreground italic">
              El monto facturable refleja únicamente el tiempo trabajado con tarifa vigente al momento del descuento.
              Las recargas y reembolsos de horas no suman al costo.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            {loadingHours ? 'Cargando movimientos...' : 'No hay movimientos para este filtro.'}
          </p>
        )}
      </div>

      {/* Add Hours Dialog */}
      <Dialog open={showAddHours} onOpenChange={setShowAddHours}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar Horas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Carga horas contratadas para <strong>{client.name}</strong>.</p>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Cantidad de horas *</Label>
              <Input type="number" value={hoursForm.hours} onChange={(e) => setHoursForm({ ...hoursForm, hours: e.target.value })} placeholder="Ej: 40" min={1} />
            </div>
            <div className="space-y-2">
              <Label>Nota (opcional)</Label>
              <Input value={hoursForm.note} onChange={(e) => setHoursForm({ ...hoursForm, note: e.target.value })} placeholder="Ej: Contrato marzo 2026" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddHours(false)}>Cancelar</Button>
            <Button onClick={handleAddHours} disabled={savingHours || !hoursForm.hours || Number(hoursForm.hours) <= 0}>
              {savingHours ? 'Agregando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Hours Transaction Dialog */}
      <Dialog open={!!deleteTxConfirm} onOpenChange={(open) => { if (!open) { setDeleteTxConfirm(null); setDeleteTxReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar transacción de horas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se revertirá el efecto de esta transacción (<strong>{deleteTxConfirm?.type === 'PURCHASE' ? '+' : '-'}{deleteTxConfirm?.hours.toFixed(2)}h</strong> — {deleteTxConfirm?.note || deleteTxConfirm?.type}) sobre las horas del cliente.
          </p>
          <div className="space-y-2 pt-2">
            <Label>Motivo de eliminación *</Label>
            <Textarea
              value={deleteTxReason}
              onChange={(e) => setDeleteTxReason(e.target.value)}
              placeholder="Ej: Carga duplicada, error de cálculo..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTxConfirm(null); setDeleteTxReason(''); }} disabled={deletingTx}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteTransaction} disabled={deletingTx || !deleteTxReason.trim()}>
              {deletingTx ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Hours Transaction Dialog (solo PO/PM/Owner, solo USAGE/LOAN) */}
      <Dialog open={!!editTxConfirm} onOpenChange={(open) => { if (!open) { setEditTxConfirm(null); setEditTxHours(''); setEditTxRate(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar transacción de horas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Editás <strong>{editTxConfirm?.task?.title ?? editTxConfirm?.note ?? editTxConfirm?.type}</strong>.
            El costo se recalcula como Horas × Tarifa y el cupo del cliente se ajusta atómicamente.
          </p>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Horas *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={editTxHours}
                onChange={(e) => setEditTxHours(e.target.value)}
              />
              {editTxConfirm && editTxHours !== '' && !Number.isNaN(Number(editTxHours)) && Number(editTxHours) !== editTxConfirm.hours && (
                <p className="text-[11px] text-warning">
                  Delta: {(Number(editTxHours) - editTxConfirm.hours).toFixed(2)}h se {Number(editTxHours) > editTxConfirm.hours ? 'descontarán del' : 'devolverán al'} cupo disponible del cliente.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tarifa por hora ({editTxConfirm?.priceCurrency ?? hours?.currency ?? 'PYG'})</Label>
              <Input
                type="number"
                step="1"
                min="0"
                placeholder="0 = sin tarifa"
                value={editTxRate}
                onChange={(e) => setEditTxRate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Dejar vacío o 0 para limpiar la tarifa (el costo quedará como —).
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">Nuevo costo calculado</p>
              <p className="font-mono font-semibold text-foreground">
                {(() => {
                  const h = Number(editTxHours);
                  const r = Number(editTxRate);
                  if (Number.isNaN(h) || h <= 0 || Number.isNaN(r) || r <= 0) return '—';
                  return formatCurrency(h * r, editTxConfirm?.priceCurrency ?? hours?.currency ?? 'PYG');
                })()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditTxConfirm(null); setEditTxHours(''); setEditTxRate(''); }} disabled={editingTx}>
              Cancelar
            </Button>
            <Button onClick={handleEditTransaction} disabled={editingTx}>
              {editingTx ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
