'use client';

import { useCallback } from 'react';
import { useAuth } from './use-auth';
import { useOrg } from '@/providers/org-provider';

export function usePermissions() {
  const { organizations } = useAuth();
  const { orgId } = useOrg();

  // Resolvemos la org activa (no siempre es la primera del listado).
  const activeOrg = organizations.find((o) => o.id === orgId) ?? organizations[0];
  const roleName = activeOrg?.roleName ?? '';

  // Owner siempre tiene acceso total aunque el DB esté vacío.
  const permissions = roleName === 'Owner'
    ? ['*:*']
    : (activeOrg?.permissions ?? []);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (permissions.includes('*:*')) return true;
      if (permissions.includes(permission)) return true;

      // "manage:X" implícitamente otorga "read:X"
      const [action, resource] = permission.split(':');
      if (action === 'read') {
        return permissions.includes(`manage:${resource}`);
      }

      return false;
    },
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (...perms: string[]): boolean => perms.some((p) => hasPermission(p)),
    [hasPermission],
  );

  const hasAllPermissions = useCallback(
    (...perms: string[]): boolean => perms.every((p) => hasPermission(p)),
    [hasPermission],
  );

  return {
    permissions,
    roleName,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isOwner: permissions.includes('*:*'),
  };
}
