'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Building, Plus, Search, Pencil, Trash2, FolderKanban, Mail, Phone, Globe, KeyRound, Clock, MoreHorizontal, Eye } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  userId?: string;
  portalEnabled?: boolean;
  user?: { email: string };
  contractedHours?: number;
  usedHours?: number;
  loanedHours?: number;
  _count?: { projects: number };
}

export default function ClientsPage() {
  const { orgId } = useOrg();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  // Portal access dialog
  const [portalDialogOpen, setPortalDialogOpen] = useState(false);
  const [portalClient, setPortalClient] = useState<Client | null>(null);
  const [portalEmail, setPortalEmail] = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [portalName, setPortalName] = useState('');
  const [savingPortal, setSavingPortal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (orgId) loadClients();
  }, [orgId]);

  const loadClients = async () => {
    if (!orgId) return;
    try {
      const res = await api.get(`/organizations/${orgId}/clients?limit=200`);
      const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setClients(list);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al cargar clientes';
      toast.error('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    setName(client.name);
    setEmail(client.email || '');
    setPhone(client.phone || '');
    setNotes(client.notes || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!orgId || !name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (editing) {
        await api.patch(`/organizations/${orgId}/clients/${editing.id}`, payload);
        toast.success('Cliente actualizado');
      } else {
        await api.post(`/organizations/${orgId}/clients`, payload);
        toast.success('Cliente creado');
      }

      setDialogOpen(false);
      loadClients();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al guardar el cliente';
      toast.error('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (client: Client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!orgId || !clientToDelete) return;
    try {
      await api.delete(`/organizations/${orgId}/clients/${clientToDelete.id}`);
      toast.success('Cliente eliminado');
      setClients(clients.filter((c) => c.id !== clientToDelete.id));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al eliminar el cliente';
      toast.error('Error', message);
    } finally {
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const openPortalDialog = (client: Client) => {
    setPortalClient(client);
    setPortalEmail(client.email || '');
    setPortalPassword('');
    setPortalName(client.name);
    setPortalDialogOpen(true);
  };

  const handleCreatePortalAccess = async () => {
    if (!orgId || !portalClient || !portalEmail.trim() || !portalPassword.trim() || !portalName.trim()) return;
    setSavingPortal(true);
    try {
      await api.post(`/organizations/${orgId}/clients/${portalClient.id}/create-user`, {
        email: portalEmail.trim(),
        password: portalPassword.trim(),
        name: portalName.trim(),
      });
      toast.success('Acceso portal creado', `El cliente puede iniciar sesión con ${portalEmail.trim()}`);
      setPortalDialogOpen(false);
      loadClients();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al crear acceso portal';
      toast.error('Error', message);
    } finally {
      setSavingPortal(false);
    }
  };

  const handleTogglePortal = async (clientId: string, enabled: boolean) => {
    if (!orgId) return;
    try {
      await api.patch(`/organizations/${orgId}/clients/${clientId}/portal`, { enabled });
      setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, portalEnabled: enabled } : c));
      toast.success(enabled ? 'Portal habilitado' : 'Portal deshabilitado');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al cambiar estado del portal';
      toast.error('Error', message);
    }
  };

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona los clientes de tu organización
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar clientes..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Client Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((client) => {
          const contracted = client.contractedHours ?? 0;
          const used = client.usedHours ?? 0;
          const loaned = client.loanedHours ?? 0;
          const available = Math.max(contracted - used - loaned, 0);
          const percentUsed = contracted > 0 ? Math.min(Math.round((used / contracted) * 100), 100) : 0;
          const hasHours = contracted > 0;

          return (
            <div
              key={client.id}
              className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => router.push(`/clients/${client.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {client.name}
                    </p>
                    {client.email && (
                      <p className="text-[13px] text-muted-foreground flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 shrink-0" /> {client.email}
                      </p>
                    )}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/clients/${client.id}`); }}>
                      <Eye className="mr-2 h-4 w-4" />
                      Ver detalle
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(client); }}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => { e.stopPropagation(); confirmDelete(client); }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {client.phone && (
                <p className="mt-2 text-[13px] text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3 shrink-0" /> {client.phone}
                </p>
              )}

              {/* Hours Bar */}
              <div className="mt-4">
                {hasHours ? (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Horas contratadas
                      </span>
                      <span className={`font-semibold ${percentUsed >= 100 ? 'text-destructive' : percentUsed >= 80 ? 'text-warning' : 'text-foreground'}`}>
                        {available.toFixed(0)}h / {contracted}h
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          percentUsed >= 100 ? 'bg-destructive' : percentUsed >= 80 ? 'bg-warning' : 'bg-primary'
                        }`}
                        style={{ width: `${percentUsed}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
                    <Clock className="h-3 w-3" />
                    <span>Sin horas contratadas</span>
                  </div>
                )}
              </div>

              {/* Badges + Portal toggle */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Switch
                    checked={client.portalEnabled ?? false}
                    onCheckedChange={(checked) => handleTogglePortal(client.id, checked)}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {client.portalEnabled ? 'Portal activo' : 'Portal inactivo'}
                  </span>
                </div>

                <Badge variant="info" className="text-[10px]">
                  <FolderKanban className="mr-1 h-3 w-3" />
                  {client._count?.projects ?? 0} proyectos
                </Badge>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <Building className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {search ? 'No se encontraron clientes' : 'No hay clientes aún'}
          </p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar cliente?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se eliminara permanentemente a <strong>{clientToDelete?.name}</strong> y todos sus datos asociados. Esta accion no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Portal Access Dialog */}
      <Dialog open={portalDialogOpen} onOpenChange={setPortalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Acceso al Portal</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Crea credenciales para que <strong>{portalClient?.name}</strong> pueda acceder al portal de clientes y ver el progreso de sus proyectos.
          </p>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={portalName}
                onChange={(e) => setPortalName(e.target.value)}
                placeholder="Nombre del usuario"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={portalEmail}
                onChange={(e) => setPortalEmail(e.target.value)}
                placeholder="cliente@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña *</Label>
              <Input
                type="password"
                value={portalPassword}
                onChange={(e) => setPortalPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPortalDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreatePortalAccess}
              disabled={savingPortal || !portalEmail.trim() || !portalPassword.trim() || portalPassword.trim().length < 8}
            >
              {savingPortal ? 'Creando...' : 'Crear Acceso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del cliente"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+595 21 123456"
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas sobre el cliente..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
