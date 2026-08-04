'use client';

import { usePermissions } from '@/hooks/use-permissions';

/**
 * Espejo exacto del `@Roles('Owner', 'Project Manager', 'Developer')` que gatea
 * `PATCH organizations/:orgId/tickets/:ticketId/classification` (#42 Fase 2).
 *
 * El cliente reporta; el equipo tipifica. Por eso la lista incluye a Developer
 * pero NO a los sub-usuarios cliente del portal.
 *
 * Sirve para no ofrecer una acción que el backend va a rechazar con 403. NO es
 * una medida de seguridad: la autoridad es el guard del backend.
 */
const RECLASSIFY_ROLES = ['Owner', 'Project Manager', 'Developer'];

export function useCanReclassifyTicket(): boolean {
  const { roleName, isOwner } = usePermissions();
  return isOwner || RECLASSIFY_ROLES.includes(roleName);
}
