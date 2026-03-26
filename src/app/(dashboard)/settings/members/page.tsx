'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Users } from 'lucide-react';
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
};

const defaultBadgeColor = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

export default function MembersSettingsPage() {
  const { orgId } = useOrg();
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Filter out Owner from assignable roles (cannot change someone TO owner)
  const assignableRoles = roles.filter((r) => r.name !== 'Owner');

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Miembros</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Gestiona los miembros de tu organización</p>
        </div>
        <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
          <Users className="mr-1.5 h-3.5 w-3.5" />
          {members.length} miembros
        </Badge>
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
    </div>
  );
}
