'use client';

import { useCallback } from 'react';
import { useAuth } from './use-auth';

export function usePermissions() {
  const { organizations } = useAuth();
  const org = organizations[0];
  const roleName = org?.roleName ?? '';
  // Owner always gets full access even if DB permissions are empty
  const permissions = roleName === 'Owner'
    ? ['*:*']
    : (org?.permissions ?? []);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (permissions.includes('*:*')) return true;
      if (permissions.includes(permission)) return true;

      // "manage:X" implicitly grants "read:X"
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
