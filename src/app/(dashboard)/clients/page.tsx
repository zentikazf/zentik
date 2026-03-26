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
import { Building, Plus, Search, Pencil, Trash2, FolderKanban, Mail, Phone, Globe, KeyRound } from 'lucide-react';
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
  user?: { email: string };
  _count?: { projects: number };
}

export default function ClientsPage() {
  const { orgId } = useOrg();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);

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

  const handleDelete = async (client: Client) => {
    if (!orgId || !confirm(`¿Eliminar el cliente "${client.name}"?`)) return;
    try {
      await api.delete(`/organizations/${orgId}/clients/${client.id}`);
      toast.success('Cliente eliminado');
      setClients(clients.filter((c) => c.id !== client.id));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al eliminar el cliente';
      toast.error('Error', message);
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

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-[25px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Clientes</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gestiona los clientes de tu organización
          </p>
        </div>
        <Button className="rounded-full" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Buscar clientes..."
          className="w-full rounded-full bg-white py-3 pl-11 pr-4 text-sm text-gray-600 placeholder:text-gray-400 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 dark:focus:ring-blue-800"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Client List */}
      <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
        <div className="space-y-3">
          {filtered.map((client) => (
            <div
              key={client.id}
              className="flex items-center gap-4 rounded-xl border border-gray-100 p-4 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
                <Building className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-gray-800 dark:text-white">
                  {client.name}
                </p>
                <div className="flex items-center gap-3 text-[13px] text-gray-400">
                  {client.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {client.email}
                    </span>
                  )}
                  {client.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {client.phone}
                    </span>
                  )}
                </div>
              </div>

              {client.userId ? (
                <Badge className="bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400">
                  <Globe className="mr-1 h-3 w-3" />
                  Portal activo
                </Badge>
              ) : (
                <button
                  onClick={() => openPortalDialog(client)}
                  className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400 dark:hover:bg-amber-900"
                >
                  <KeyRound className="h-3 w-3" />
                  Crear acceso portal
                </button>
              )}

              <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <FolderKanban className="mr-1 h-3 w-3" />
                {client._count?.projects ?? 0} proyectos
              </Badge>

              <button
                onClick={() => openEdit(client)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-blue-400"
              >
                <Pencil className="h-4 w-4" />
              </button>

              <button
                onClick={() => handleDelete(client)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <Building className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-400">
                {search ? 'No se encontraron clientes' : 'No hay clientes aún'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Portal Access Dialog */}
      <Dialog open={portalDialogOpen} onOpenChange={setPortalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Acceso al Portal</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 dark:text-gray-400">
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
