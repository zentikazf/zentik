'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Users, UserPlus, X, Copy, Eye, EyeOff } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import { getInitials } from '@/lib/utils';

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
      toast.success('Miembro creado', `${name} ha sido agregado a la organización`);
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
              Se generará una contraseña temporal automáticamente. El usuario deberá cambiarla al iniciar sesión por primera vez.
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

export default function MembersSettingsPage() {
  const { orgId } = useOrg();
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

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

  const handleRemove = async (memberId: string) => {
    if (!confirm('¿Eliminar este miembro?')) return;
    if (!orgId) return;
    try {
      await api.delete(`/organizations/${orgId}/members/${memberId}`);
      toast.success('Miembro eliminado', 'El miembro ha sido removido de la organización');
      setMembers(members.filter((m) => m.id !== memberId));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al eliminar miembro';
      toast.error('Error', message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-[25px]" />
        ))}
      </div>
    );
  }

  const assignableRoles = roles.filter((r) => r.name !== 'Owner');

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Miembros</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Gestiona los miembros de tu organización</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <Users className="mr-1.5 h-3.5 w-3.5" />
            {members.length} miembros
          </Badge>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Agregar Miembro
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {members.map((member) => {
          const roleName = member.role?.name || 'Sin rol';
          const roleId = member.role?.id || '';
          const isOwner = roleName === 'Owner';
          const badgeColor = roleColorMap[roleName] || defaultBadgeColor;

          return (
            <div key={member.id} className="flex items-center gap-4 rounded-[25px] bg-white p-5 dark:bg-gray-900">
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
              {isOwner ? (
                <Badge className={badgeColor}>{roleName}</Badge>
              ) : (
                <Select value={roleId} onValueChange={(v) => handleRoleChange(member.id, v)}>
                  <SelectTrigger className="w-40 rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!isOwner && (
                <button
                  onClick={() => handleRemove(member.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="flex flex-col items-center rounded-[25px] bg-white py-16 text-center dark:bg-gray-900">
            <Users className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-400">No hay miembros en la organización</p>
          </div>
        )}
      </div>

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
