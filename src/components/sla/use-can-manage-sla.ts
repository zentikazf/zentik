'use client';

import { usePermissions } from '@/hooks/use-permissions';

/**
 * Espejo exacto del `@Roles('Owner', 'Project Manager')` de `SlaConfigController`
 * (backend). Los endpoints de configuración de SLA se gatean por ROL, no por
 * permiso, así que acá se compara el rol de la org activa.
 *
 * Sirve para no montar los selectores de SLA a un rol que el backend va a
 * rechazar con 403 (evita toasts de error en pantallas que ese rol sí puede ver).
 * NO es una medida de seguridad: la autoridad es el guard del backend.
 */
const SLA_ADMIN_ROLES = ['Owner', 'Project Manager'];

export function useCanManageSla(): boolean {
  const { roleName, isOwner } = usePermissions();
  return isOwner || SLA_ADMIN_ROLES.includes(roleName);
}
