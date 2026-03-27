'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Search, Shield, Trash2, Users, Eye, Settings2, X, Copy, EyeOff } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from '@/hooks/use-toast';
import { getInitials } from '@/lib/utils';
import Link from 'next/link';

const roleColorMap: Record<string, string> = {
  'Owner': 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  'Product Owner': 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400',
  'Project Manager': 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  'Tech Lead': 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400',
  'Developer': 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  'QA Engineer': 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  'Designer': 'bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-400',
  'DevOps': 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
  'Soporte': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  'Cliente': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const defaultBadgeColor = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

function CreateMemberDialog({
  open,
  onClose,
  orgId,
  roles,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  roles: any[];
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ temporaryPassword?: string; member?: any } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const assignableRoles = roles.filter((r) => r.name !== 'Owner');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !roleId) return;

    setSaving(true);
    try {
      const res = await api.post(`/organizations/${orgId}/members`, { name, email, roleId });
      setResult(res.data);
      toast.success('Miembro creado', `${name} ha sido agregado al equipo`);
      onCreated();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al crear miembro';
      toast.error('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setRoleId('');
    setResult(null);
    setShowPassword(false);
    onClose();
  };

  const copyPassword = () => {
    if (result?.temporaryPassword) {
      navigator.clipboard.writeText(result.temporaryPassword);
      toast.success('Copiado', 'Contraseña temporal copiada al portapapeles');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            {result ? 'Miembro Creado' : 'Agregar Miembro'}
          </h2>
          <button onClick={handleClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-50 p-4 dark:bg-green-950/30">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Usuario creado exitosamente
              </p>
              <p className="mt-1 text-xs text-green-600 dark:text-green-500">
                El usuario deberá cambiar su contraseña en el primer inicio de sesión
              </p>
            </div>

            {result.temporaryPassword && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Contraseña temporal</label>
                <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                  <code className="flex-1 text-sm font-mono text-gray-800 dark:text-gray-200">
                    {showPassword ? result.temporaryPassword : '••••••••••'}
                  </code>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={copyPassword}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Guarda esta contraseña. No se mostrará de nuevo.
                </p>
              </div>
            )}

            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Nombre completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Pérez"
                required
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@empresa.com"
                required
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Rol</label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-gray-400">
              Se generará una contraseña temporal. El usuario deberá cambiarla al iniciar sesión por primera vez.
            </p>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !name || !email || !roleId}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { orgId } = useOrg();
  const { hasPermission } = usePermissions();
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  const canManage = hasPermission('manage:members');

  useEffect(() => {
    if (orgId) {
      loadMembers();
      loadRoles();
    }
  }, [orgId]);

  const loadMembers = async () => {
    if (!orgId) return;
    try {
      const res = await api.get(`/organizations/${orgId}/members`);
      setMembers(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al cargar miembros';
      toast.error('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    if (!orgId) return;
    try {
      const res = await api.get(`/organizations/${orgId}/roles`);
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setRoles(list);
    } catch {
      // silent
    }
  };

  const handleRoleChange = async (memberId: string, roleId: string) => {
    if (!orgId) return;
    try {
      await api.patch(`/organizations/${orgId}/members/${memberId}`, { roleId });
      toast.success('Rol actualizado', 'El rol del miembro ha sido actualizado');
      loadMembers();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al actualizar rol';
      toast.error('Error', message);
    }
  };

  const handleRemove = async (memberId: string, memberName: string) => {
    if (!confirm(`¿Eliminar a ${memberName} del equipo?`)) return;
    if (!orgId) return;
    try {
      await api.delete(`/organizations/${orgId}/members/${memberId}`);
      toast.success('Miembro eliminado', `${memberName} ha sido removido del equipo`);
      setMembers(members.filter((m) => m.id !== memberId));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al eliminar miembro';
      toast.error('Error', message);
    }
  };

  const filtered = members.filter((m) =>
    (m.user?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.user?.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.role?.name || '').toLowerCase().includes(search.toLowerCase()),
  );

  const assignableRoles = roles.filter((r) => r.name !== 'Owner');

  const totalMembers = members.length;
  const roleDistribution = roles
    .map((r) => ({
      name: r.name,
      count: members.filter((m) => m.role?.name === r.name).length,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[25px]" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
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
          <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Equipo</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gestiona los miembros, roles y permisos de tu organización
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Link href="/settings/roles">
              <Button variant="outline" className="rounded-full">
                <Shield className="mr-2 h-4 w-4" /> Roles y Permisos
              </Button>
            </Link>
          )}
          {canManage && (
            <Button className="rounded-full" onClick={() => setShowCreate(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Agregar Miembro
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards — Blue theme */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-[20px] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 dark:border-blue-900/40 dark:from-blue-950/30 dark:to-gray-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{totalMembers}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Miembros</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-[20px] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 dark:border-blue-900/40 dark:from-blue-950/30 dark:to-gray-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{roles.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Roles activos</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-[20px] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 dark:border-blue-900/40 dark:from-blue-950/30 dark:to-gray-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50">
            <Settings2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="flex flex-wrap gap-1">
              {roleDistribution.slice(0, 3).map((r) => (
                <span key={r.name} className="text-xs text-gray-500 dark:text-gray-400">
                  {r.name} ({r.count})
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Distribución</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Buscar por nombre, email o rol..."
          className="w-full rounded-full bg-white py-3 pl-11 pr-4 text-sm text-gray-600 placeholder:text-gray-400 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 dark:focus:ring-blue-800"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Members List */}
      <div className="rounded-[25px] border border-blue-100 bg-white p-6 dark:border-blue-900/30 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white">
            {filtered.length} miembro{filtered.length !== 1 ? 's' : ''}
          </h2>
        </div>
        <div className="space-y-2">
          {filtered.map((member) => {
            const roleName = member.role?.name || 'Sin rol';
            const roleId = member.role?.id || '';
            const isOwner = roleName === 'Owner';
            const badgeColor = roleColorMap[roleName] || defaultBadgeColor;

            return (
              <div
                key={member.id}
                className="flex items-center gap-4 rounded-xl border border-gray-100 p-4 transition-colors hover:bg-blue-50/50 dark:border-gray-800 dark:hover:bg-blue-950/20"
              >
                <Avatar className="h-11 w-11">
                  <AvatarImage src={member.user?.image} />
                  <AvatarFallback className="bg-blue-100 text-sm font-semibold text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                    {getInitials(member.user?.name || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-gray-800 dark:text-white">{member.user?.name}</p>
                  <p className="text-[13px] text-gray-400">{member.user?.email}</p>
                </div>

                <button
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-500 transition-colors hover:bg-blue-100 hover:text-blue-600 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 dark:hover:text-blue-400"
                  onClick={async () => {
                    const userId = member.userId || member.user?.id;
                    if (!userId) return;
                    setViewingUser(member);
                    try {
                      const res = await api.get(`/users/${userId}`);
                      setUserProfile(res.data);
                    } catch {
                      setUserProfile(null);
                    }
                  }}
                >
                  <Eye className="h-4 w-4" />
                </button>

                {canManage && !isOwner ? (
                  <Select value={roleId} onValueChange={(v) => handleRoleChange(member.id, v)}>
                    <SelectTrigger className="w-40 rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={badgeColor}>
                    <Shield className="mr-1 h-3 w-3" />{roleName}
                  </Badge>
                )}

                {canManage && !isOwner && (
                  <button
                    onClick={() => handleRemove(member.id, member.user?.name || 'este miembro')}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">No se encontraron miembros</p>
          )}
        </div>
      </div>

      {/* User Profile Dialog */}
      <Dialog open={!!viewingUser} onOpenChange={() => { setViewingUser(null); setUserProfile(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Perfil del Miembro</DialogTitle>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={userProfile?.image || viewingUser.user?.image} />
                  <AvatarFallback className="bg-blue-100 text-lg text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                    {getInitials(userProfile?.name || viewingUser.user?.name || '')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">{userProfile?.name || viewingUser.user?.name}</p>
                  <p className="text-sm text-gray-400">{userProfile?.email || viewingUser.user?.email}</p>
                  <Badge className={`mt-1 ${roleColorMap[viewingUser.role?.name] || defaultBadgeColor}`}>
                    {viewingUser.role?.name || 'Sin rol'}
                  </Badge>
                </div>
              </div>
              {userProfile?.bio && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{userProfile.bio}</p>
              )}
              {userProfile?.timezone && (
                <p className="text-xs text-gray-400">Zona horaria: {userProfile.timezone}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CreateMemberDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        orgId={orgId || ''}
        roles={roles}
        onCreated={loadMembers}
      />
    </div>
  );
}
