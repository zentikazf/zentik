// ─── Motor de SLA con políticas nombradas y cascada (#42 — Fase 1) ──────────
//
// Los shapes espejan EXACTAMENTE lo que devuelve `zentik-backend/src/modules/sla`
// (`sla-config.controller.ts` + los services). Las fechas viajan como string ISO
// porque el backend serializa a JSON.

import type { Criticality } from '@/lib/criticality';

/**
 * Criticidad, con el nombre que usa el módulo SLA. Es un **alias** de
 * `Criticality`: la unión (y su 4º valor `CRITICAL`, #42 Fase 3) vive en
 * `@/lib/criticality`, la única fuente de valores/labels/colores del frontend.
 */
export type SlaCriticality = Criticality;

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

/**
 * Tope de profundidad del árbol de tipos. **Espejo de `MAX_TICKET_TYPE_DEPTH`**
 * del backend (`ticket-type.service.ts`): 3 niveles ⇒ `level` 0, 1 y 2.
 *
 * Acá se duplica SOLO para no ofrecer en la UI un padre que el backend va a
 * rechazar con `TICKET_TYPE_MAX_DEPTH`. La autoridad sigue siendo el service.
 */
export const MAX_TICKET_TYPE_DEPTH = 3;
export const MAX_TICKET_TYPE_LEVEL = MAX_TICKET_TYPE_DEPTH - 1;

/**
 * Tipo de solicitud (modelo `TicketType` de Prisma).
 *
 * #42 Fase 3 (ÁRBOL): `parentId` / `path` / `level` son DERIVADOS — los calcula
 * el backend al crear, mover o renombrar, y NUNCA se mandan desde el front.
 * `path` son los **slugs** desde la raíz (`incidencia/error-del-sistema`), no los
 * nombres; para el camino legible se usa `@/lib/ticket-type-path`.
 *
 * `GET ticket-types` ya viene ordenado por `path`, así que la lista plana sale en
 * orden de árbol (cada padre inmediatamente antes de su rama) sin post-procesar.
 */
export interface TicketType {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  isActive: boolean;
  /** `null` = tipo raíz. */
  parentId: string | null;
  /** Slugs desde la raíz unidos por "/". */
  path: string;
  /** Profundidad: 0 = raíz, máximo `MAX_TICKET_TYPE_LEVEL`. */
  level: number;
  /**
   * El "ojito" (#48 R1). `false` = carpeta pura: agrupa y ordena, pero el cliente
   * no la ve ni la elige — sus hijos contratados se siguen ofreciendo.
   *
   * Es GLOBAL a la organización (del tipo, no del proyecto) y es solo
   * PRESENTACIÓN: no toca contratos ni la cascada, y no cascadea a los hijos.
   */
  clientVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Nodo de `GET ticket-types/tree`: el tipo + su rama anidada.
 * `children: []` = hoja (el backend siempre manda el array, nunca `undefined`).
 */
export interface TicketTypeNode extends TicketType {
  children: TicketTypeNode[];
}

/**
 * Respuesta de `DELETE ticket-types/:typeId`. La baja lógica es EN CASCADA:
 * `deactivated` cuenta los tipos que se apagaron **incluido el propio**, y es 0
 * si ya estaban todos inactivos (la operación es idempotente).
 */
export interface DeactivateTicketTypeResult {
  deactivated: number;
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
  // ── #48 T1b: la jerarquía viaja con la fila ────────────────────────────────
  // El centro de contratación agrupa por rama sin tener que pedir el catálogo de
  // tipos aparte. `path` ordena (la respuesta ya viene ordenada por él), `level`
  // indenta, `parentId` arma el árbol.
  /** `null` = tipo raíz. */
  parentId: string | null;
  /** Ruta de SLUGS desde la raíz. Para ordenar y agrupar, NUNCA para mostrar. */
  path: string;
  /** Profundidad: 0 = raíz. */
  level: number;
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

/**
 * Un tipo de solicitud ofrecible en el selector (subset de `TicketType`).
 *
 * ⚠️ `parentId`/`path`/`level` son OPCIONALES a propósito: los endpoints de
 * disponibilidad (`/portal/projects/:id/ticket-types` y su gemelo admin)
 * proyectan hoy `{ id, name, slug }`. El selector del portal muestra el camino
 * del padre **solo si viene** y degrada al nombre suelto si no — así el día que
 * el backend agregue la proyección no hay que tocar la UI, y mientras tanto el
 * cliente ve exactamente lo de siempre.
 */
export interface AvailableTicketType {
  id: string;
  name: string;
  slug: string;
  /**
   * Nombres de los ancestros, de la raíz hacia abajo y SIN el propio, ya
   * resueltos por el backend (#48 T4). Vacío = raíz, o todos sus ancestros están
   * ocultos para esta audiencia.
   *
   * ⚠️ NO derivar el camino en el cliente a partir de esta lista de tipos: solo
   * contiene los OFRECIDOS, y un ancestro oculto o sin contrato no viaja en ella
   * — la cadena se cortaría justo en el caso que importa. Por eso lo calcula el
   * backend, que además aplica la regla de la carpeta oculta (R3.1): un ancestro
   * con el ojito apagado no aporta su nombre al cliente.
   */
  ancestorNames: string[];
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
  /** Ausente o `null` = tipo raíz. Máximo `MAX_TICKET_TYPE_DEPTH` niveles. */
  parentId?: string | null;
  /** Ausente = `true`: un tipo nuevo nace visible para el cliente. */
  clientVisible?: boolean;
}

export interface UpdateTicketTypeInput {
  name?: string;
  slug?: string;
  isActive?: boolean;
  /**
   * Mover el tipo. Semántica de TRES estados (la del DTO del backend):
   * · ausente → no se mueve · `null` → se mueve a raíz · id → bajo ese padre.
   * Mover arrastra la rama completa (el backend recalcula `path`/`level`).
   */
  parentId?: string | null;
  /** El ojito. NO cascadea a los hijos: cada nodo tiene el suyo. */
  clientVisible?: boolean;
}

/** Una fila del upsert de la matriz. `isActive:false` desactiva el contrato. */
/**
 * Una fila del PUT de contratos.
 *
 * `slaPolicyId` es obligatoria salvo cuando la fila viene a DESCONTRATAR
 * (`isActive: false`), donde el backend no la exige ni la usa (#48 T1).
 */
export interface ProjectContractItemInput {
  ticketTypeId: string;
  slaPolicyId?: string;
  contractNotes?: string;
  isActive?: boolean;
}

/**
 * ⚠️ Es un upsert de las filas ENVIADAS, no un reemplazo de la matriz: lo que no
 * viaja en `items` queda intacto. Descontratar es explícito — hay que mandar la
 * fila con `isActive: false`.
 */
export interface UpsertProjectContractsInput {
  items: ProjectContractItemInput[];
}

/** `null` desasigna: la cascada sigue al paso siguiente. */
export interface AssignSlaPolicyInput {
  slaPolicyId: string | null;
}

// ─── Labels compartidos (UI) ────────────────────────────────────────────────
//
// Los labels/colores de criticidad se mudaron a `@/lib/criticality`
// (`CRITICALITY_LABEL`), la fuente única del frontend (#42 Fase 3, paso A).

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
