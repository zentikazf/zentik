'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import type { MemberCard, MembersGroup } from '@/types/members-view';

interface RawTeamMember {
  id: string; // organizationMemberId
  userId: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    emailVerified?: boolean;
  };
  role: { id: string; name: string };
}

interface RawClientUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  emailVerified?: boolean;
  createdAt: string;
}

interface RawClient {
  id: string;
  name: string;
  user?: RawClientUser | null;
  users?: RawClientUser[];
}

export function useMembersData(orgId: string | undefined) {
  const [groups, setGroups] = useState<MembersGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);

    try {
      const [membersRes, clientsRes] = await Promise.all([
        api.get<RawTeamMember[]>(`/organizations/${orgId}/members`),
        api.get<{ data: RawClient[] }>(
          `/organizations/${orgId}/clients?withUsers=true&limit=200`,
        ),
      ]);

      const teamMembers: MemberCard[] = (membersRes.data ?? []).map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatarUrl: m.user.image ?? null,
        roleName: m.role.name,
        joinedAt: m.joinedAt,
        emailVerified: !!m.user.emailVerified,
        source: 'team' as const,
        membershipId: m.id,
      }));

      // Ordenar team por joinedAt desc (mas reciente primero)
      teamMembers.sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));

      const teamGroup: MembersGroup = {
        id: 'team',
        type: 'team',
        label: 'Team de la organización',
        members: teamMembers,
        count: teamMembers.length,
      };

      // Construir grupos de clientes solo para los que tienen sub-usuarios
      const clientGroups: MembersGroup[] = [];
      const clients = clientsRes.data?.data ?? [];

      for (const c of clients) {
        const subUsers: MemberCard[] = [];

        // Owner del cliente (Client.userId)
        if (c.user) {
          subUsers.push({
            id: c.user.id,
            name: c.user.name,
            email: c.user.email,
            avatarUrl: c.user.image ?? null,
            roleName: 'Owner del cliente',
            joinedAt: c.user.createdAt,
            emailVerified: !!c.user.emailVerified,
            source: 'client-sub' as const,
            clientId: c.id,
            clientName: c.name,
          });
        }

        // Sub-usuarios (User.clientId)
        for (const u of c.users ?? []) {
          // Evitar duplicar al owner si tambien aparece en users
          if (c.user?.id === u.id) continue;
          subUsers.push({
            id: u.id,
            name: u.name,
            email: u.email,
            avatarUrl: u.image ?? null,
            roleName: 'Sub-usuario',
            joinedAt: u.createdAt,
            emailVerified: !!u.emailVerified,
            source: 'client-sub' as const,
            clientId: c.id,
            clientName: c.name,
          });
        }

        if (subUsers.length === 0) continue;

        // Ordenar sub-usuarios por nombre asc
        subUsers.sort((a, b) => a.name.localeCompare(b.name));

        clientGroups.push({
          id: c.id,
          type: 'client',
          label: `Cliente: ${c.name}`,
          members: subUsers,
          count: subUsers.length,
        });
      }

      // Ordenar clientes por nombre asc
      clientGroups.sort((a, b) => a.label.localeCompare(b.label));

      setGroups([teamGroup, ...clientGroups]);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar los miembros',
      );
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { groups, isLoading, error, refetch: fetchData };
}
