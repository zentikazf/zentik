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
import { PhaseBadge } from '@/components/ui/phase-badge';
import {
 Building,
 ArrowLeft,
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

 // Delete sub-user confirmation
 const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
 const [deleting, setDeleting] = useState(false);

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

 const handleDeleteSubUser = async () => {
 if (!orgId || !deleteConfirm) return;
 setDeleting(true);
 try {
 await api.delete(`/organizations/${orgId}/clients/${clientId}/users/${deleteConfirm.id}`);
 toast.success('Usuario eliminado');
 setDeleteConfirm(null);
 loadData();
 } catch (err) {
 toast.error('Error', err instanceof ApiError ? err.message : 'Error al eliminar sub-usuario');
 } finally {
 setDeleting(false);
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
 <div className="space-y-6 max-w-7xl">
 <Skeleton className="h-8 w-48 rounded-xl"/>
 <div className="grid gap-6 lg:grid-cols-3">
 <Skeleton className="h-64 rounded-xl"/>
 <Skeleton className="h-64 rounded-xl lg:col-span-2"/>
 </div>
 </div>
 );
 }

 if (!client) {
 return (
 <div className="text-center py-20">
 <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4"/>
 <p className="text-muted-foreground">Cliente no encontrado</p>
 </div>
 );
 }

 const available = hours?.availableHours ?? 0;
 const percentUsed = hours && hours.contractedHours > 0
 ? Math.min(Math.round((hours.usedHours / hours.contractedHours) * 100), 100)
 : 0;

 const statusBadge = (() => {
 if (percentUsed >= 100) return { label: 'Agotado', className: 'bg-destructive/15 text-destructive' };
 if (percentUsed >= 80) return { label: 'Advertencia', className: 'bg-warning/15 text-warning' };
 return { label: 'Activo', className: 'bg-success/15 text-success' };
 })();

 const TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
 PURCHASE: { label: 'Compra', color: 'text-success', icon: ArrowUpRight },
 USAGE: { label: 'Uso', color: 'text-primary', icon: ArrowDownRight },
 LOAN: { label: 'Prestamo', color: 'text-warning', icon: AlertTriangle },
 REFUND: { label: 'Reembolso', color: 'text-info', icon: ArrowUpRight },
 };

 return (
 <div className="space-y-6 max-w-7xl">
 {/* Back + header */}
 <div>
 <Link href="/clients"className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-3">
 <ArrowLeft className="h-4 w-4"/> Clientes
 </Link>
 <div className="rounded-xl border border-border bg-card p-5">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
 <Building className="h-5 w-5 text-primary"/>
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h1 className="text-xl font-semibold text-card-foreground">{client.name}</h1>
 <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge.className}`}>
 {statusBadge.label}
 </span>
 </div>
 {client.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Hours Widget - Full width */}
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-5">
 <h2 className="text-[15px] font-semibold text-card-foreground flex items-center gap-2">
 <Clock className="h-4 w-4 text-primary"/> Horas Contratadas
 </h2>
 <Button size="sm"onClick={() => setShowAddHours(true)}>
 <Plus className="mr-1 h-3 w-3"/> Agregar Horas
 </Button>
 </div>

 <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-5">
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
 </div>

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

 {/* Transactions */}
 {hours && hours.transactions.length > 0 && (
 <div>
 <Separator className="mb-4"/>
 <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Historial reciente</p>
 <div className="space-y-2 max-h-64 overflow-y-auto">
 {hours.transactions.map((tx) => {
 const conf = TYPE_LABELS[tx.type] || TYPE_LABELS.USAGE;
 const Icon = conf.icon;
 return (
 <div key={tx.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted transition-colors">
 <Icon className={`h-4 w-4 shrink-0 ${conf.color}`} />
 <div className="flex-1 min-w-0">
 <p className="text-sm text-foreground truncate">
 {tx.note || tx.task?.title || tx.type}
 </p>
 {tx.task?.project && (
 <p className="text-[11px] text-muted-foreground">{tx.task.project.name}</p>
 )}
 </div>
 <span className={`text-sm font-semibold ${tx.type === 'PURCHASE' || tx.type === 'REFUND' ? 'text-success' : conf.color}`}>
 {tx.type === 'PURCHASE' || tx.type === 'REFUND' ? '+' : '-'}{tx.hours.toFixed(2)}h
 </span>
 <span className="text-[10px] text-muted-foreground">
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
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-[15px] font-semibold text-card-foreground flex items-center gap-2">
 <Users className="h-4 w-4 text-primary"/> Usuarios del Portal
 </h2>
 <Button size="sm"variant="outline"onClick={() => setShowAddUser(true)}>
 <Plus className="mr-1 h-3 w-3"/> Agregar
 </Button>
 </div>

 {/* Owner */}
 {client.user && (
 <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 mb-3">
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
 <Mail className="h-3.5 w-3.5 text-primary"/>
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-card-foreground">{client.user.name}</p>
 <p className="text-xs text-muted-foreground">{client.user.email}</p>
 </div>
 <Badge className="bg-primary/15 text-primary text-[10px]">Owner</Badge>
 </div>
 )}

 {/* Sub-users */}
 {client.users.length > 0 ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
 {client.users.map((u) => (
 <div key={u.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
 {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-card-foreground">{u.name}</p>
 <p className="text-xs text-muted-foreground">{u.email}</p>
 </div>
 <button
 onClick={() => setDeleteConfirm({ id: u.id, name: u.name })}
 className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
 >
 <Trash2 className="h-3.5 w-3.5"/>
 </button>
 </div>
 ))}
 </div>
 ) : !client.user ? (
 <p className="text-sm text-muted-foreground text-center py-6">Sin usuarios de portal</p>
 ) : null}
 </div>

 {/* Projects */}
 <div className="rounded-xl border border-border bg-card p-6">
 <h2 className="text-[15px] font-semibold text-card-foreground flex items-center gap-2 mb-4">
 <FolderKanban className="h-4 w-4 text-primary"/> Proyectos ({client._count.projects})
 </h2>
 {client.projects.length > 0 ? (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {client.projects.map((p) => (
 <Link key={p.id} href={`/projects/${p.id}`}>
 <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors">
 <span className="text-sm font-medium text-foreground">{p.name}</span>
 <PhaseBadge phase={p.status} />
 </div>
 </Link>
 ))}
 </div>
 ) : (
 <p className="text-sm text-muted-foreground text-center py-6">Sin proyectos asignados</p>
 )}
 </div>
 </div>

 {/* Add Sub-User Dialog */}
 <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle>Agregar Sub-usuario</DialogTitle>
 </DialogHeader>
 <p className="text-sm text-muted-foreground">
 Crea un usuario adicional para <strong>{client.name}</strong> con acceso al portal.
 </p>
 <div className="space-y-4 py-2">
 <div className="space-y-2">
 <Label>Nombre *</Label>
 <Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="Nombre del usuario"/>
 </div>
 <div className="space-y-2">
 <Label>Email *</Label>
 <Input type="email"value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="usuario@empresa.com"/>
 </div>
 <div className="space-y-2">
 <Label>Contraseña *</Label>
 <Input type="password"value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Minimo 8 caracteres"/>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline"onClick={() => setShowAddUser(false)}>Cancelar</Button>
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
 <p className="text-sm text-muted-foreground">Carga horas contratadas para <strong>{client.name}</strong>.</p>
 <div className="space-y-4 py-2">
 <div className="space-y-2">
 <Label>Cantidad de horas *</Label>
 <Input type="number"value={hoursForm.hours} onChange={(e) => setHoursForm({ ...hoursForm, hours: e.target.value })} placeholder="Ej: 40"min={1} />
 </div>
 <div className="space-y-2">
 <Label>Nota (opcional)</Label>
 <Input value={hoursForm.note} onChange={(e) => setHoursForm({ ...hoursForm, note: e.target.value })} placeholder="Ej: Contrato marzo 2026"/>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline"onClick={() => setShowAddHours(false)}>Cancelar</Button>
 <Button onClick={handleAddHours} disabled={savingHours || !hoursForm.hours || Number(hoursForm.hours) <= 0}>
 {savingHours ? 'Agregando...' : 'Agregar'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Delete Sub-User Confirmation Dialog */}
 <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
 <DialogContent className="max-w-sm">
 <DialogHeader>
 <DialogTitle>Eliminar usuario</DialogTitle>
 </DialogHeader>
 <p className="text-sm text-muted-foreground">
 ¿Estas seguro de que deseas eliminar al usuario <strong>{deleteConfirm?.name}</strong>? Esta accion no se puede deshacer.
 </p>
 <DialogFooter>
 <Button variant="outline"onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancelar</Button>
 <Button variant="destructive"onClick={handleDeleteSubUser} disabled={deleting}>
 {deleting ? 'Eliminando...' : 'Eliminar'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
