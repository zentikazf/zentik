'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Search, Shield, Eye } from 'lucide-react';
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

export default function TeamPage() {
  const { orgId } = useOrg();
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

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
      if (err instanceof ApiError) {
        toast.error('Error al cargar miembros', err.message);
      } else {
        toast.error('Error al cargar miembros', 'Ocurrió un error inesperado');
      }
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
      // Set default role for invite (first non-Owner, preferably isDefault)
      const defaultRole = list.find((r: any) => r.isDefault) || list.find((r: any) => r.name !== 'Owner');
      if (defaultRole) setInviteRoleId(defaultRole.id);
    } catch {
      // silent
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !inviteRoleId) return;
    try {
      await api.post(`/organizations/${orgId}/invites`, { email: inviteEmail, roleId: inviteRoleId });
      toast.success('Invitación enviada', `Se ha enviado una invitación a ${inviteEmail}`);
      setShowInvite(false);
      setInviteEmail('');
      loadMembers();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error('Error al enviar invitación', err.message);
      } else {
        toast.error('Error al enviar invitación', 'Ocurrió un error inesperado');
      }
    }
  };

  const filtered = members.filter((m) =>
    (m.user?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.user?.email || '').toLowerCase().includes(search.toLowerCase()),
  );

  // Roles available for invitation (exclude Owner)
  const inviteRoles = roles.filter((r) => r.name !== 'Owner');

  if (loading) {
    return (
      <div className="space-y-4">
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
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Gestiona los miembros de tu organización</p>
        </div>
        <Dialog open={showInvite} onOpenChange={setShowInvite}>
          <DialogTrigger asChild>
            <Button className="rounded-full">
              <UserPlus className="mr-2 h-4 w-4" /> Invitar Miembro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invitar Miembro del Equipo</DialogTitle></DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
              </div>
              <div>
                <Label>Rol</Label>
                <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger>
                  <SelectContent>
                    {inviteRoles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full rounded-full" disabled={!inviteRoleId}>Enviar Invitación</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Buscar miembros..."
          className="w-full rounded-full bg-white py-3 pl-11 pr-4 text-sm text-gray-600 placeholder:text-gray-400 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 dark:focus:ring-blue-800"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Members List */}
      <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
        <div className="space-y-3">
          {filtered.map((member) => {
            const roleName = member.role?.name || 'Sin rol';
            const badgeColor = roleColorMap[roleName] || defaultBadgeColor;

            return (
              <div
                key={member.id}
                className="flex items-center gap-4 rounded-xl border border-gray-100 p-4 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5"
              >
                <Avatar className="h-11 w-11">
                  <AvatarImage src={member.user?.image} />
                  <AvatarFallback className="bg-blue-100 text-sm text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                    {getInitials(member.user?.name || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-gray-800 dark:text-white">{member.user?.name}</p>
                  <p className="text-[13px] text-gray-400">{member.user?.email}</p>
                </div>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-blue-400"
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
                <Badge className={badgeColor}>
                  <Shield className="mr-1 h-3 w-3" />{roleName}
                </Badge>
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
    </div>
  );
}
