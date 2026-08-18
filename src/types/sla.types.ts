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
  /**
   * El ojito del TIPO (#48 R5.8). Es GLOBAL a la organización, no de este
   * proyecto: apagarlo desde el centro de contratación lo apaga en todos.
   */
  clientVisible: boolean;
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
  project: {
    id: string;
    name: string;
    slaPolicyId: string | null;
    /** #48 R5.3: el header del centro de contratación dice de qué cliente es. */
    client: { id: string; name: string } | null;
  };
  items: ProjectSlaContract[];
  coverage: ProjectSlaCoverage;
}

/**
 * Una card del índice de cobertura (un proyecto activo).
 *
 * #48 T6: salieron `isComplete`, `coveredTypes` y `missingTypes`. "Cobertura
 * completa" nunca fue una meta y el ✅/⚠️ binario empujaba a perseguir un 100%
 * que nadie quiere. Entró en su lugar el eje que faltaba: qué ve el cliente.
 */
export interface SlaCoverageItem {
  projectId: string;
  projectName: string;
  clientId: string | null;
  clientName: string | null;
  hasProjectPolicy: boolean;
  hasClientPolicy: boolean;
  /** Modo permisivo: el proyecto no tiene contratos aplicables. */
  clientSeesAllTypes: boolean;
  /** Cuántos tipos puede elegir HOY el cliente en este proyecto. */
  clientVisibleTypeCount: number;
}

/** Respuesta de `GET sla-coverage`. */
export interface SlaCoverage {
  totalProjects: number;
  /** Tipos activos y visibles al cliente en la organización. */
  totalVisibleTypes: number;
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

// ─── Paquetes de contratos default (#58) ────────────────────────────────────
//
// Un paquete es un grupo con nombre de pares tipo → política, reutilizable.
// ⛔ Aplicarlo es una COPIA, no un vínculo: crea las filas de contrato del
// proyecto y ahí se corta la relación. Editar el paquete NO cambia ningún
// proyecto — para eso está el re-aplicar, siempre explícito.

/** Cuántos tipos aporta cada rama raíz. Es el resumen del listado. */
export interface ContractPackageBranch {
  name: string;
  count: number;
}

/** Una fila del listado de paquetes. */
export interface ContractPackageListItem {
  id: string;
  name: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  branches: ContractPackageBranch[];
  /** Proyectos DISTINTOS que recibieron este paquete (log de aplicaciones). */
  usedInProjects: number;
}

/** La cabecera del paquete en el detalle. */
export interface ContractPackageSummary {
  id: string;
  name: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  usedInProjects: number;
}

/**
 * Respuesta de `GET sla-packages/:packageId`.
 *
 * `items` es el catálogo COMPLETO de tipos con la asignación del paquete encima
 * — **el mismo shape que la matriz del proyecto** (#58 R2.5). Por eso lo consume
 * el MISMO `ContractTreeEditor` sin adaptadores: en un paquete, `isActive`
 * significa "el paquete trae este tipo" y `contractNotes` siempre viaja en null.
 */
export interface ContractPackageDetail {
  package: ContractPackageSummary;
  items: ProjectSlaContract[];
}

export interface CreateContractPackageInput {
  name: string;
  notes?: string;
}

export interface UpdateContractPackageInput {
  name?: string;
  /** String vacío limpia la nota. */
  notes?: string;
  isActive?: boolean;
}

/**
 * ⚠️ Misma forma que el PUT de contratos, pero `isActive: false` **BORRA** el
 * ítem en vez de desactivarlo (#58 R3.4). Lo omitido sigue sin tocarse.
 */
export interface UpsertContractPackageItemsInput {
  items: ProjectContractItemInput[];
}

/**
 * Un proyecto que recibió el paquete. Es la lista del re-aplicar (#58 R6): el
 * dueño pidió elección explícita caso por caso, no un batch.
 *
 * El log es append-only, así que un proyecto que lo recibió tres veces aparece
 * UNA vez con `timesApplied: 3` y la fecha de la última.
 */
export interface ContractPackageApplicationRow {
  projectId: string;
  projectName: string;
  /** Un proyecto archivado no recibe tickets nuevos: la UI lo marca. */
  projectIsActive: boolean;
  lastAppliedAt: string;
  lastAppliedByName: string;
  timesApplied: number;
}

/** Por qué un ítem del paquete no se pudo aplicar. */
export type PackageItemSkipReason = 'POLICY_INACTIVE' | 'TYPE_INACTIVE';

/** Un ítem que el apply salta y reporta, en vez de fallar entero (#58 R4.5). */
export interface SkippedPackageItem {
  ticketTypeId: string;
  ticketTypeName: string;
  reason: PackageItemSkipReason;
  /** Frase lista para mostrar: `la política "Crítico 2h" está desactivada`. */
  detail: string;
}

/** Una fila del preview: qué trae el paquete vs. qué tiene hoy el proyecto. */
export interface PackagePreviewRow {
  ticketTypeId: string;
  ticketTypeName: string;
  packagePolicyId: string;
  packagePolicyName: string;
  /** `null` = el proyecto no tiene contrato activo para ese tipo. */
  currentPolicyId: string | null;
  currentPolicyName: string | null;
  /**
   * El contrato existe pero está APAGADO: aplicar lo reactiva. Cae en "nuevo",
   * nunca en "ya igual", aunque la política coincida (#58 R4.3).
   */
  reactivates: boolean;
}

/** Las 3 categorías del preview + los ítems podridos. Lo calcula el backend. */
export interface ApplyPackagePreview {
  package: { id: string; name: string; itemCount: number };
  project: { id: string; name: string };
  /** ✚ se van a crear (incluye reactivar). */
  toCreate: PackagePreviewRow[];
  /** ✓ ya configurados igual: no se tocan. */
  alreadySame: PackagePreviewRow[];
  /** ⚠ configurados distinto: NO se tocan salvo checkbox explícito. */
  different: PackagePreviewRow[];
  skipped: SkippedPackageItem[];
  /** El paquete no tiene ni un tipo: aplicarlo sería un no-op. */
  isEmpty: boolean;
}

/**
 * La decisión del usuario para UN tipo. Solo tiene efecto sobre los "distinto".
 *
 * ⛔ Se manda la DECISIÓN, nunca el resultado del preview: el backend recalcula
 * las categorías al escribir, así un preview viejo no puede pisar un estado que
 * el usuario no vio.
 */
export interface ApplyPackageDecision {
  ticketTypeId: string;
  overwrite?: boolean;
}

export interface ApplyContractPackageInput {
  packageId: string;
  /** Omitir la lista = no pisar nada (el default del dueño). */
  items?: ApplyPackageDecision[];
}

/** Respuesta del apply: qué pasó, qué se salteó y la matriz ya actualizada. */
export interface ApplyPackageResult {
  packageId: string;
  packageName: string;
  createdCount: number;
  overwrittenCount: number;
  skippedSameCount: number;
  skippedDifferentCount: number;
  skipped: SkippedPackageItem[];
  /** Se aplicó pero no había nada que escribir. La aplicación se registró igual. */
  isNoop: boolean;
  applicationId: string;
  contracts: ProjectSlaContractsResponse;
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
