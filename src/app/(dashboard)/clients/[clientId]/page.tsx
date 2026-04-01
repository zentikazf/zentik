'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Building,
  ChevronLeft,
  Users,
  Plus,
  Trash2,
  Clock,
  TrendingDown,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  FolderKanban,
  Mail,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';

interface SubUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface HoursTransaction {
  id: string;
  type: string;
  hours: number;
  note: string | null;
  createdAt: string;
  task?: { id: string; title: string; project?: { id: string; name: string } } | null;
}

interface HoursSummary {
  contractedHours: number;
  usedHours: number;
  loanedHours: number;
  availableHours: number;
  transactions: HoursTransaction[];
}

interface ClientDetail {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  userId?: string;
  contractedHours: number;
  usedHours: number;
  loanedHours: number;
  user?: { id: string; name: string; email: string } | null;
  users: SubUser[];
  projects: { id: string; name: string; status: string }[];
  _count: { projects: number; users: number };
}

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { orgId } = useOrg();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [hours, setHours] = useState<HoursSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Add sub-user dialog
  const [showAddUser, setShowAddUser] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '' });
  const [savingUser, setSavingUser] = useState(false);

  // Add hours dialog
  const [showAddHours, setShowAddHours] = useState(false);
  const [hoursForm, setHoursForm] = useState({ hours: '', note: '' });
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    if (orgId && clientId) loadData();
  }, [orgId, clientId]);

  const loadData = async () => {
    if (!orgId) return;
    try {
      const [clientRes, hoursRes] = await Promise.all([
        api.get<any>(`/organizations/${orgId}/clients/${clientId}`),
        api.get<any>(`/organizations/${orgId}/clients/${clientId}/hours`),
      ]);
      setClient(clientRes.data);
      setHours(hoursRes.data);
    } catch {
      toast.error('Error', 'No se pudo cargar el cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubUser = async () => {
    if (!orgId || !userForm.name.trim() || !userForm.email.trim() || !userForm.password.trim()) return;
    setSavingUser(true);
    try {
      await api.post(`/organizations/${orgId}/clients/${clientId}/users`, {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        password: userForm.password.trim(),
      });
      toast.success('Usuario creado', 'El sub-usuario fue creado exitosamente');
      setShowAddUser(false);
      setUserForm({ name: '', email: '', password: '' });
      loadData();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al crear sub-usuario');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteSubUser = async (userId: string, userName: string) => {
    if (!orgId || !confirm(`¿Eliminar al usuario "${userName}"?`)) return;
    try {
      await api.delete(`/organizations/${orgId}/clients/${clientId}/users/${userId}`);
      toast.success('Usuario eliminado');
      loadData();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al eliminar sub-usuario');
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
      loadData();
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
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-[25px]" />
          <Skeleton className="h-64 rounded-[25px] lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <Building className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Cliente no encontrado</p>
      </div>
    );
  }

  const available = hours?.availableHours ?? 0;
  const percentUsed = hours && hours.contractedHours > 0
    ? Math.min(Math.round((hours.usedHours / hours.contractedHours) * 100), 100)
    : 0;

  const TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
    PURCHASE: { label: 'Compra', color: 'text-green-600', icon: ArrowUpRight },
    USAGE: { label: 'Uso', color: 'text-blue-600', icon: ArrowDownRight },
    LOAN: { label: 'Prestamo', color: 'text-orange-600', icon: AlertTriangle },
    REFUND: { label: 'Reembolso', color: 'text-purple-600', icon: ArrowUpRight },
  };

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link href="/clients" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue-600 transition-colors mb-3">
          <ChevronLeft className="h-4 w-4" /> Volver a Clientes
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
              <Building className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-white">{client.name}</h1>
              {client.email && <p className="text-sm text-gray-400">{client.email}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Hours Widget - Full width, premium */}
      <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" /> Horas Contratadas
          </h2>
          <Button size="sm" className="rounded-full" onClick={() => setShowAddHours(true)}>
            <Plus className="mr-1 h-3 w-3" /> Agregar Horas
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-5">
          <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/30">
            <p className="text-xs text-blue-500 font-medium">Contratadas</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{hours?.contractedHours ?? 0}h</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <p className="text-xs text-gray-500 font-medium">Consumidas</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{(hours?.usedHours ?? 0).toFixed(1)}h</p>
          </div>
          <div className={`rounded-xl p-4 ${available > 0 ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
            <p className={`text-xs font-medium ${available > 0 ? 'text-green-500' : 'text-red-500'}`}>Disponibles</p>
            <p className={`text-2xl font-bold ${available > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{available.toFixed(1)}h</p>
          </div>
          <div className="rounded-xl bg-orange-50 p-4 dark:bg-orange-950/30">
            <p className="text-xs text-orange-500 font-medium">Prestamo</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{(hours?.loanedHours ?? 0).toFixed(1)}h</p>
          </div>
        </div>

        {/* Progress bar */}
        {hours && hours.contractedHours > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-500">{percentUsed}% consumido</span>
              <span className="text-gray-400">{hours.usedHours.toFixed(1)} / {hours.contractedHours}h</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  percentUsed > 90 ? 'bg-red-500' : percentUsed > 70 ? 'bg-orange-500' : 'bg-blue-500'
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>
        )}

        {/* Transactions */}
        {hours && hours.transactions.length > 0 && (
          <div>
            <Separator className="mb-4" />
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Historial reciente</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {hours.transactions.map((tx) => {
                const conf = TYPE_LABELS[tx.type] || TYPE_LABELS.USAGE;
                const Icon = conf.icon;
                return (
                  <div key={tx.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <Icon className={`h-4 w-4 shrink-0 ${conf.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {tx.note || tx.task?.title || tx.type}
                      </p>
                      {tx.task?.project && (
                        <p className="text-[11px] text-gray-400">{tx.task.project.name}</p>
                      )}
                    </div>
                    <span className={`text-sm font-semibold ${tx.type === 'PURCHASE' || tx.type === 'REFUND' ? 'text-green-600' : conf.color}`}>
                      {tx.type === 'PURCHASE' || tx.type === 'REFUND' ? '+' : '-'}{tx.hours.toFixed(2)}h
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(tx.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sub-users */}
        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" /> Usuarios del Portal
            </h2>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setShowAddUser(true)}>
              <Plus className="mr-1 h-3 w-3" /> Agregar
            </Button>
          </div>

          {/* Owner */}
          {client.user && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <Mail className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-white">{client.user.name}</p>
                <p className="text-xs text-gray-400">{client.user.email}</p>
              </div>
              <Badge className="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400 text-[10px]">Owner</Badge>
            </div>
          )}

          {/* Sub-users */}
          {client.users.length > 0 ? (
            <div className="space-y-2">
              {client.users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                    <Users className="h-3.5 w-3.5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteSubUser(u.id, u.name)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : !client.user ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin usuarios de portal</p>
          ) : null}
        </div>

        {/* Projects */}
        <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
          <h2 className="text-[15px] font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            <FolderKanban className="h-4 w-4 text-blue-500" /> Proyectos ({client._count.projects})
          </h2>
          {client.projects.length > 0 ? (
            <div className="space-y-2">
              {client.projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{p.name}</span>
                    <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[10px]">{p.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Sin proyectos asignados</p>
          )}
        </div>
      </div>

      {/* Add Sub-User Dialog */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Sub-usuario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Crea un usuario adicional para <strong>{client.name}</strong> con acceso al portal.
          </p>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="Nombre del usuario" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="usuario@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>Contraseña *</Label>
              <Input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Minimo 8 caracteres" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)}>Cancelar</Button>
            <Button onClick={handleAddSubUser} disabled={savingUser || !userForm.name.trim() || !userForm.email.trim() || userForm.password.length < 8}>
              {savingUser ? 'Creando...' : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Hours Dialog */}
      <Dialog open={showAddHours} onOpenChange={setShowAddHours}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar Horas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">Carga horas contratadas para <strong>{client.name}</strong>.</p>
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
    </div>
  );
}
