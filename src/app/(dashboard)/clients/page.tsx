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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building, Plus, Search, Pencil, Trash2, FolderKanban, Mail, Phone, Globe, KeyRound, Clock, MoreHorizontal, Eye, EyeOff, Copy, X } from 'lucide-react';
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
  status?: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
  portalEnabled?: boolean;
  user?: { email: string };
  contractedHours?: number;
  usedHours?: number;
  loanedHours?: number;
  developmentHourlyRate?: number | null;
  supportHourlyRate?: number | null;
  currency?: string;
  _count?: { projects: number };
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Activo', color: 'bg-success/15 text-success' },
  DISABLED: { label: 'Deshabilitado', color: 'bg-warning/15 text-warning' },
  ARCHIVED: { label: 'Archivado', color: 'bg-muted text-muted-foreground' },
};

export default function ClientsPage() {
  const { orgId } = useOrg();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
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
  const [portalName, setPortalName] = useState('');
  const [savingPortal, setSavingPortal] = useState(false);
  const [portalResult, setPortalResult] = useState<{ temporaryPassword?: string } | null>(null);
  const [showPortalPassword, setShowPortalPassword] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [developmentHourlyRate, setDevelopmentHourlyRate] = useState('');
  const [supportHourlyRate, setSupportHourlyRate] = useState('');
  const [currency, setCurrency] = useState('PYG');

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
    setDevelopmentHourlyRate('');
    setSupportHourlyRate('');
    setCurrency('PYG');
    setDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    setName(client.name);
    setEmail(client.email || '');
    setPhone(client.phone || '');
    setNotes(client.notes || '');
    setDevelopmentHourlyRate(
      client.developmentHourlyRate != null ? String(client.developmentHourlyRate) : '',
    );
    setSupportHourlyRate(
      client.supportHourlyRate != null ? String(client.supportHourlyRate) : '',
    );
    setCurrency(client.currency || 'PYG');
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
        developmentHourlyRate: developmentHourlyRate.trim()
          ? Number(developmentHourlyRate)
          : undefined,
        supportHourlyRate: supportHourlyRate.trim()
          ? Number(supportHourlyRate)
          : undefined,
        currency,
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

  const [statusAction, setStatusAction] = useState<'DISABLED' | 'ARCHIVED' | 'ACTIVE' | null>(null);

  const confirmStatusChange = (client: Client, action: 'DISABLED' | 'ARCHIVED' | 'ACTIVE') => {
    setClientToDelete(client);
    setStatusAction(action);
    setDeleteDialogOpen(true);
  };

  const handleChangeStatus = async () => {
    if (!orgId || !clientToDelete || !statusAction) return;
    try {
      await api.patch(`/organizations/${orgId}/clients/${clientToDelete.id}/status`, { status: statusAction });
      const labels = { DISABLED: 'deshabilitado', ARCHIVED: 'archivado', ACTIVE: 'reactivado' };
      toast.success(`Cliente ${labels[statusAction]}`);
      loadClients();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al cambiar estado del cliente';
      toast.error('Error', message);
    } finally {
      setDeleteDialogOpen(false);
      setClientToDelete(null);
      setStatusAction(null);
    }
  };

  const openPortalDialog = (client: Client) => {
    setPortalClient(client);
    setPortalEmail(client.email || '');
    setPortalName(client.name);
    setPortalResult(null);
    setShowPortalPassword(false);
    setPortalDialogOpen(true);
  };

  const closePortalDialog = () => {
    setPortalDialogOpen(false);
    setPortalClient(null);
    setPortalEmail('');
    setPortalName('');
    setPortalResult(null);
    setShowPortalPassword(false);
  };

  const handleCreatePortalAccess = async () => {
    if (!orgId || !portalClient || !portalEmail.trim() || !portalName.trim()) return;
    setSavingPortal(true);
    try {
      const res = await api.post(`/organizations/${orgId}/clients/${portalClient.id}/create-user`, {
        email: portalEmail.trim(),
        name: portalName.trim(),
      });
      setPortalResult(res.data);
      toast.success('Acceso portal creado', `${portalName.trim()} ha sido agregado al portal`);
      loadClients();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al crear acceso portal';
      toast.error('Error', message);
    } finally {
      setSavingPortal(false);
    }
  };

  const copyPortalPassword = () => {
    if (portalResult?.temporaryPassword) {
      navigator.clipboard.writeText(portalResult.temporaryPassword);
      toast.success('Copiado', 'Contraseña temporal copiada al portapapeles');
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

  const filtered = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase());
    const matchesTab =
      activeTab === 'archived'
        ? c.status === 'ARCHIVED'
        : c.status !== 'ARCHIVED';
    return matchesSearch && matchesTab;
  });

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

      {/* Tabs + Search */}
      <div className="flex items-center gap-4">
        <div className="flex rounded-lg border border-border p-0.5 bg-muted/50">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'active' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Activos
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'archived' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Archivados
          </button>
        </div>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
                    {client.portalEnabled && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openPortalDialog(client); }}>
                        <KeyRound className="mr-2 h-4 w-4" />
                        Crear Acceso Portal
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {(client.status === 'ACTIVE' || !client.status) && (
                      <>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmStatusChange(client, 'DISABLED'); }}>
                          <Globe className="mr-2 h-4 w-4" />
                          Deshabilitar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmStatusChange(client, 'ARCHIVED'); }}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Archivar
                        </DropdownMenuItem>
                      </>
                    )}
                    {client.status === 'DISABLED' && (
                      <>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmStatusChange(client, 'ACTIVE'); }}>
                          <Globe className="mr-2 h-4 w-4" />
                          Reactivar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmStatusChange(client, 'ARCHIVED'); }}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Archivar
                        </DropdownMenuItem>
                      </>
                    )}
                    {client.status === 'ARCHIVED' && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmStatusChange(client, 'ACTIVE'); }}>
                        <Globe className="mr-2 h-4 w-4" />
                        Reactivar
                      </DropdownMenuItem>
                    )}
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

              {/* Badges + Status */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {(() => {
                  const sc = STATUS_CONFIG[client.status || 'ACTIVE'] || STATUS_CONFIG.ACTIVE;
                  return (
                    <Badge className={`${sc.color} border-transparent text-[10px]`}>
                      {sc.label}
                    </Badge>
                  );
                })()}
                <Badge variant="info" className="text-[10px]">
                  <FolderKanban className="mr-1 h-3 w-3" />
                  {client._count?.projects ?? 0} proyectos
                </Badge>
                <div className="flex items-center gap-1.5 ml-auto" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] text-muted-foreground">Portal</span>
                  <Switch
                    checked={!!client.portalEnabled}
                    onCheckedChange={(checked) => handleTogglePortal(client.id, checked)}
                    className="scale-75"
                  />
                </div>
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

      {/* Status Change Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {statusAction === 'DISABLED' && 'Deshabilitar cliente'}
              {statusAction === 'ARCHIVED' && 'Archivar cliente'}
              {statusAction === 'ACTIVE' && 'Reactivar cliente'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {statusAction === 'DISABLED' && (
              <>Se invalidaran las sesiones activas de <strong>{clientToDelete?.name}</strong>, se congelaran sus proyectos y se cerraran los tickets abiertos.</>
            )}
            {statusAction === 'ARCHIVED' && (
              <>Se archivara a <strong>{clientToDelete?.name}</strong>. Los datos se preservan pero el cliente no aparecera en el listado principal.</>
            )}
            {statusAction === 'ACTIVE' && (
              <>Se reactivara a <strong>{clientToDelete?.name}</strong>. Sus proyectos se descongelaran y el portal quedara habilitado.</>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant={statusAction === 'ACTIVE' ? 'default' : 'destructive'}
              onClick={handleChangeStatus}
            >
              {statusAction === 'DISABLED' && 'Deshabilitar'}
              {statusAction === 'ARCHIVED' && 'Archivar'}
              {statusAction === 'ACTIVE' && 'Reactivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Portal Access Dialog */}
      {portalDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {portalResult ? 'Acceso Creado' : 'Crear Acceso al Portal'}
              </h2>
              <button onClick={closePortalDialog} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4"/>
              </button>
            </div>

            {portalResult ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-success/10 p-4">
                  <p className="text-sm font-medium text-success">
                    Usuario creado exitosamente
                  </p>
                  <p className="mt-1 text-xs text-success">
                    El usuario podrá acceder al portal con estas credenciales
                  </p>
                </div>

                {portalResult.temporaryPassword && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Contraseña temporal</label>
                    <div className="flex items-center gap-2 rounded-xl bg-muted p-3">
                      <code className="flex-1 text-sm font-mono text-foreground">
                        {showPortalPassword ? portalResult.temporaryPassword : '••••••••••'}
                      </code>
                      <button
                        onClick={() => setShowPortalPassword(!showPortalPassword)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                      >
                        {showPortalPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                      </button>
                      <button
                        onClick={copyPortalPassword}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                      >
                        <Copy className="h-4 w-4"/>
                      </button>
                    </div>
                    <p className="text-xs text-warning">
                      Guarda esta contraseña. No se mostrará de nuevo.
                    </p>
                  </div>
                )}

                <button
                  onClick={closePortalDialog}
                  className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Crea credenciales para que <strong>{portalClient?.name}</strong> pueda acceder al portal de clientes.
                </p>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nombre completo</label>
                  <input
                    type="text"
                    value={portalName}
                    onChange={(e) => setPortalName(e.target.value)}
                    placeholder="Nombre del usuario"
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Correo electrónico</label>
                  <input
                    type="email"
                    value={portalEmail}
                    onChange={(e) => setPortalEmail(e.target.value)}
                    placeholder="cliente@empresa.com"
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Se generará una contraseña temporal automáticamente.
                </p>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closePortalDialog}
                    className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreatePortalAccess}
                    disabled={savingPortal || !portalEmail.trim() || !portalName.trim()}
                    className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {savingPortal ? 'Creando...' : 'Crear Acceso'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

            <div className="pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">
                Tarifas por hora
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Desarrollo</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={developmentHourlyRate}
                    onChange={(e) => setDevelopmentHourlyRate(e.target.value)}
                    placeholder="Ej: 250000"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Soporte</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={supportHourlyRate}
                    onChange={(e) => setSupportHourlyRate(e.target.value)}
                    placeholder="Ej: 300000"
                  />
                </div>
              </div>
              <div className="space-y-2 mt-3">
                <Label className="text-xs">Moneda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PYG">PYG - Guaraní</SelectItem>
                    <SelectItem value="USD">USD - Dólar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Las tarifas se aplican en facturación según el tipo de tarea (desarrollo o soporte).
              </p>
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
