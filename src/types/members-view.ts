/**
 * Tipos para la vista unificada de miembros de la organizacion.
 * Feature #7 del harness: rediseno-vista-miembros-organizacion (Variante A: Library).
 */

export interface MemberCard {
  /** userId */
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  /** Nombre del rol (ej: "Owner", "Developer", "Cliente") */
  roleName: string;
  /** ISO timestamp del joined/created */
  joinedAt: string;
  emailVerified: boolean;
  /** Origen del miembro: team de la org o sub-usuario de cliente */
  source: 'team' | 'client-sub';
  /** Solo si source = 'client-sub': id del cliente al que pertenece */
  clientId?: string;
  /** Solo si source = 'client-sub': nombre del cliente */
  clientName?: string;
  /** Solo para team: organizationMemberId, util para acciones */
  membershipId?: string;
}

export interface MembersGroup {
  /** 'team' o el clientId */
  id: string;
  type: 'team' | 'client';
  /** Etiqueta a mostrar en el header de la seccion */
  label: string;
  members: MemberCard[];
  /** Cantidad total de miembros en el grupo (independiente de filtros) */
  count: number;
}

export type MembersFilter = 'all' | 'team' | 'pending' | 'active';
