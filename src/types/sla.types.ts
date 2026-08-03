// ─── Motor de SLA con políticas nombradas y cascada (#42 — Fase 1) ──────────
//
// Los shapes espejan EXACTAMENTE lo que devuelve `zentik-backend/src/modules/sla`
// (`sla-config.controller.ts` + los services). Las fechas viajan como string ISO
// porque el backend serializa a JSON.

export type SlaCriticality = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Paso de la cascada en el que se resolvió el SLA del ticket.
 * `CRITICALITY` y `STANDARD` son fallbacks: indican configuración incompleta.
 */
export type SlaSource = 'CONTRACT' | 'PROJECT' | 'CLIENT' | 'CRITICALITY' | 'STANDARD' | 'NONE';

/** Política SLA con nombre (modelo `SlaPolicy` de Prisma). */
export interface SlaPolicy {
  id: string;
  organizationId: string;
  name: string;
  criticality: SlaCriticality;
  firstResponseHours: number;
  resolutionHours: number;
  pausesOnWaiting: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Tipo de solicitud (modelo `TicketType` de Prisma — plano en Fase 1). */
export interface TicketType {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Una fila de la matriz tipo → política de un proyecto.
 * `slaPolicyId` es null cuando el tipo NO tiene contrato activo (el hueco).
 */
export interface ProjectSlaContract {
  ticketTypeId: string;
  ticketTypeName: string;
  contractId: string | null;
  slaPolicyId: string | null;
  slaPolicyName: string | null;
  contractNotes: string | null;
  isActive: boolean;
}

/** Cobertura de contratos de UN proyecto (viene dentro de la matriz). */
export interface ProjectSlaCoverage {
  totalTypes: number;
  coveredTypes: number;
  missingTypes: { id: string; name: string }[];
  isComplete: boolean;
}

/** Respuesta de `GET projects/:projectId/sla-contracts`. */
export interface ProjectSlaContractsResponse {
  project: { id: string; name: string; slaPolicyId: string | null };
  items: ProjectSlaContract[];
  coverage: ProjectSlaCoverage;
}

/** Una fila del checklist global de cobertura (un proyecto activo). */
export interface SlaCoverageItem {
  projectId: string;
  projectName: string;
  clientId: string | null;
  clientName: string | null;
  hasProjectPolicy: boolean;
  hasClientPolicy: boolean;
  totalTypes: number;
  coveredTypes: number;
  missingTypes: { id: string; name: string }[];
  isComplete: boolean;
}

/** Respuesta de `GET sla-coverage`. */
export interface SlaCoverage {
  totalProjects: number;
  totalTypes: number;
  completeProjects: number;
  items: SlaCoverageItem[];
}

/**
 * Respuesta de `GET sla-readiness`. `canEnable=false` ⇒ falta la política
 * "Estándar" y el motor NO se puede activar (guardarraíl del feature flag).
 */
export interface SlaReadiness {
  hasStandardPolicy: boolean;
  policiesCount: number;
  typesCount: number;
  canEnable: boolean;
}

/** Respuesta de `POST sla-seed/import-current` (idempotente). */
export interface SlaSeedResult {
  policiesCreated: number;
  typesCreated: number;
  alreadyExisting: number;
}

// ─── Criticidad: presentación y visibilidad (#42 — Fase 2) ──────────────────

/**
 * Config de UNA criticidad de la organización (modelo `TicketCriticalityConfig`).
 * NO es una criticidad nueva: el enum sigue siendo la fuente. Esta fila solo dice
 * cómo se ve, si el cliente la puede elegir, en qué orden y cuál es la default.
 */
export interface CriticalityConfig {
  id: string;
  organizationId: string;
  criticality: SlaCriticality;
  /** Nombre interno (lo ve el equipo). */
  displayName: string;
  /** Cómo lo ve el cliente. `null` ⇒ se muestra el `displayName`. */
  clientLabel: string | null;
  clientVisible: boolean;
  /** Orden de urgencia: mayor = más urgente. */
  level: number;
  /** La que entra si el cliente no elige. Es EXCLUYENTE en toda la organización. */
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** PATCH parcial. `clientLabel: null` limpia la etiqueta y vuelve al nombre interno. */
export interface UpdateCriticalityConfigInput {
  displayName?: string;
  clientLabel?: string | null;
  clientVisible?: boolean;
  level?: number;
  isDefault?: boolean;
}

/**
 * Criticidad tal como la ve el CLIENTE (`GET /portal/criticalities`).
 * Un array vacío es un estado válido: significa "el cliente no elige" (modo 2B)
 * y el portal NO renderiza el selector.
 */
export interface ClientVisibleCriticality {
  criticality: SlaCriticality;
  label: string;
  level: number;
}

/** Un tipo de solicitud ofrecible en el selector (subset de `TicketType`). */
export interface AvailableTicketType {
  id: string;
  name: string;
  slug: string;
}

/**
 * Respuesta de los endpoints de disponibilidad (portal y admin).
 * `fallback: true` ⇒ el proyecto no tiene contratos aplicables y se devolvieron
 * TODOS los tipos activos (modo permisivo): la UI lo avisa con una nota discreta.
 */
export interface AvailableTicketTypes {
  types: AvailableTicketType[];
  fallback: boolean;
}

// ─── Inputs (espejo de los DTOs del backend) ────────────────────────────────

export interface CreateSlaPolicyInput {
  name: string;
  criticality: SlaCriticality;
  firstResponseHours: number;
  resolutionHours: number;
  pausesOnWaiting?: boolean;
}

export interface UpdateSlaPolicyInput {
  name?: string;
  criticality?: SlaCriticality;
  firstResponseHours?: number;
  resolutionHours?: number;
  pausesOnWaiting?: boolean;
  isActive?: boolean;
}

export interface CreateTicketTypeInput {
  name: string;
  /** Si no viene, el backend lo genera del nombre (sin tildes). */
  slug?: string;
}

export interface UpdateTicketTypeInput {
  name?: string;
  slug?: string;
  isActive?: boolean;
}

/** Una fila del upsert de la matriz. `isActive:false` desactiva el contrato. */
export interface ProjectContractItemInput {
  ticketTypeId: string;
  slaPolicyId: string;
  contractNotes?: string;
  isActive?: boolean;
}

export interface UpsertProjectContractsInput {
  items: ProjectContractItemInput[];
}

/** `null` desasigna: la cascada sigue al paso siguiente. */
export interface AssignSlaPolicyInput {
  slaPolicyId: string | null;
}

// ─── Labels compartidos (UI) ────────────────────────────────────────────────

export const SLA_CRITICALITY_LABEL: Record<SlaCriticality, string> = {
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

/** Cómo se lee el origen del SLA en el panel del ticket. */
export const SLA_SOURCE_LABEL: Record<SlaSource, string> = {
  CONTRACT: 'por contrato',
  PROJECT: 'por proyecto',
  CLIENT: 'por cliente',
  CRITICALITY: 'por criticidad',
  STANDARD: 'por defecto',
  NONE: 'sin SLA',
};

/** Los fallbacks de la cascada: se muestran con ⚠️ (configuración incompleta). */
export const SLA_FALLBACK_SOURCES: SlaSource[] = ['CRITICALITY', 'STANDARD'];
