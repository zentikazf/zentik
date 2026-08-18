import { api } from '@/lib/api-client';
import type {
  ApplyContractPackageInput,
  ApplyPackagePreview,
  ApplyPackageResult,
  AssignSlaPolicyInput,
  AvailableTicketTypes,
  ContractPackageApplicationRow,
  ContractPackageDetail,
  ContractPackageListItem,
  CreateContractPackageInput,
  CreateSlaPolicyInput,
  CreateTicketTypeInput,
  CriticalityConfig,
  DeactivateTicketTypeResult,
  ProjectSlaContractsResponse,
  SlaCoverage,
  SlaCriticality,
  SlaPolicy,
  SlaReadiness,
  SlaSeedResult,
  TicketType,
  TicketTypeNode,
  UpdateContractPackageInput,
  UpdateCriticalityConfigInput,
  UpdateSlaPolicyInput,
  UpdateTicketTypeInput,
  UpsertContractPackageItemsInput,
  UpsertProjectContractsInput,
} from '@/types/sla.types';

/**
 * Motor de SLA — capa de datos (#42 Fase 1).
 *
 * Todas las rutas cuelgan de `organizations/:orgId` (el prefijo `/api/v1` lo pone
 * el api-client). El backend las gatea con `Owner` / `Project Manager`.
 */
export const slaService = {
  // ── Políticas SLA ────────────────────────────────────────────────────────

  listPolicies: (orgId: string, includeInactive = false) =>
    api.get<SlaPolicy[]>(
      `/organizations/${orgId}/sla-policies${includeInactive ? '?includeInactive=true' : ''}`,
    ),

  createPolicy: (orgId: string, input: CreateSlaPolicyInput) =>
    api.post<SlaPolicy>(`/organizations/${orgId}/sla-policies`, input),

  updatePolicy: (orgId: string, policyId: string, input: UpdateSlaPolicyInput) =>
    api.patch<SlaPolicy>(`/organizations/${orgId}/sla-policies/${policyId}`, input),

  /** Baja lógica. 409 `SLA_POLICY_IN_USE` si algún contrato/proyecto/cliente la usa. */
  deactivatePolicy: (orgId: string, policyId: string) =>
    api.delete<SlaPolicy>(`/organizations/${orgId}/sla-policies/${policyId}`),

  // ── Tipos de solicitud ───────────────────────────────────────────────────

  /**
   * Catálogo PLANO, ya ordenado por el `path` del árbol (cada padre justo antes
   * de su rama). Es el que alimenta los SELECTORES: se recorre una sola vez y el
   * camino legible se arma con `@/lib/ticket-type-path`.
   */
  listTypes: (orgId: string, includeInactive = false) =>
    api.get<TicketType[]>(
      `/organizations/${orgId}/ticket-types${includeInactive ? '?includeInactive=true' : ''}`,
    ),

  /**
   * La MISMA lectura, anidada (`children[]` recursivo) — #42 Fase 3.
   * Es la que alimenta la pantalla de administración del árbol; para un selector
   * conviene `listTypes` (plano y ya ordenado).
   */
  listTypeTree: (orgId: string, includeInactive = false) =>
    api.get<TicketTypeNode[]>(
      `/organizations/${orgId}/ticket-types/tree${includeInactive ? '?includeInactive=true' : ''}`,
    ),

  createType: (orgId: string, input: CreateTicketTypeInput) =>
    api.post<TicketType>(`/organizations/${orgId}/ticket-types`, input),

  updateType: (orgId: string, typeId: string, input: UpdateTicketTypeInput) =>
    api.patch<TicketType>(`/organizations/${orgId}/ticket-types/${typeId}`, input),

  /**
   * Baja lógica EN CASCADA: apaga el tipo y TODA su rama. Devuelve
   * `{ deactivated }` (no el tipo), así que la UI puede informar cuántos cayeron.
   */
  deactivateType: (orgId: string, typeId: string) =>
    api.delete<DeactivateTicketTypeResult>(`/organizations/${orgId}/ticket-types/${typeId}`),

  // ── Criticidades: etiqueta / visibilidad / orden (#42 Fase 2) ────────────

  /** Config completa (incluye las NO visibles): es la vista del admin. */
  listCriticalityConfigs: (orgId: string) =>
    api.get<CriticalityConfig[]>(`/organizations/${orgId}/criticality-configs`),

  /**
   * Upsert de UNA criticidad: si la org no tiene la fila, el backend la crea.
   * `isDefault: true` es excluyente — desmarca las demás en la misma transacción.
   */
  updateCriticalityConfig: (
    orgId: string,
    criticality: SlaCriticality,
    input: UpdateCriticalityConfigInput,
  ) =>
    api.patch<CriticalityConfig>(
      `/organizations/${orgId}/criticality-configs/${criticality}`,
      input,
    ),

  // ── Contratos por proyecto ───────────────────────────────────────────────

  getProjectContracts: (orgId: string, projectId: string) =>
    api.get<ProjectSlaContractsResponse>(
      `/organizations/${orgId}/projects/${projectId}/sla-contracts`,
    ),

  /** Upsert de la matriz completa (todo o nada, en una transacción del backend). */
  upsertProjectContracts: (
    orgId: string,
    projectId: string,
    input: UpsertProjectContractsInput,
  ) =>
    api.put<ProjectSlaContractsResponse>(
      `/organizations/${orgId}/projects/${projectId}/sla-contracts`,
      input,
    ),

  /**
   * Tipos ofrecibles en un proyecto: los CONTRATADOS, o todos los activos con
   * `fallback: true` si el proyecto no tiene contratos. Es la vista admin del
   * mismo dato que consume el portal.
   */
  getAvailableTicketTypes: (orgId: string, projectId: string, criticality?: SlaCriticality) =>
    api.get<AvailableTicketTypes>(
      `/organizations/${orgId}/projects/${projectId}/available-ticket-types` +
        (criticality ? `?criticality=${criticality}` : ''),
    ),

  /** Paso 2 de la cascada. `slaPolicyId: null` desasigna. */
  assignProjectPolicy: (orgId: string, projectId: string, input: AssignSlaPolicyInput) =>
    api.patch<{ id: string; name: string; slaPolicyId: string | null }>(
      `/organizations/${orgId}/projects/${projectId}/sla-policy`,
      input,
    ),

  /** Paso 3 de la cascada. `slaPolicyId: null` desasigna. */
  assignClientPolicy: (orgId: string, clientId: string, input: AssignSlaPolicyInput) =>
    api.patch<{ id: string; name: string; defaultSlaPolicyId: string | null }>(
      `/organizations/${orgId}/clients/${clientId}/sla-policy`,
      input,
    ),

  // ── Paquetes de contratos default (#58) ──────────────────────────────────

  listPackages: (orgId: string, includeInactive = false) =>
    api.get<ContractPackageListItem[]>(
      `/organizations/${orgId}/sla-packages${includeInactive ? '?includeInactive=true' : ''}`,
    ),

  createPackage: (orgId: string, input: CreateContractPackageInput) =>
    api.post<ContractPackageListItem>(`/organizations/${orgId}/sla-packages`, input),

  /**
   * El paquete + el catálogo COMPLETO de tipos con su asignación encima. Mismo
   * shape que la matriz del proyecto: alimenta al MISMO editor de árbol.
   */
  getPackage: (orgId: string, packageId: string) =>
    api.get<ContractPackageDetail>(`/organizations/${orgId}/sla-packages/${packageId}`),

  /** Proyectos que ya recibieron el paquete. Alimenta el re-aplicar (#58 R6). */
  listPackageApplications: (orgId: string, packageId: string) =>
    api.get<ContractPackageApplicationRow[]>(
      `/organizations/${orgId}/sla-packages/${packageId}/applications`,
    ),

  updatePackage: (orgId: string, packageId: string, input: UpdateContractPackageInput) =>
    api.patch<ContractPackageListItem>(
      `/organizations/${orgId}/sla-packages/${packageId}`,
      input,
    ),

  /** ⚠️ `isActive: false` BORRA el ítem (en un paquete "no está" es fila ausente). */
  upsertPackageItems: (
    orgId: string,
    packageId: string,
    input: UpsertContractPackageItemsInput,
  ) =>
    api.put<ContractPackageDetail>(
      `/organizations/${orgId}/sla-packages/${packageId}/items`,
      input,
    ),

  /** Dry-run: las 3 categorías salen del backend, no se calculan acá. */
  previewContractPackage: (orgId: string, projectId: string, packageId: string) =>
    api.post<ApplyPackagePreview>(
      `/organizations/${orgId}/projects/${projectId}/sla-contracts/apply-package/preview`,
      { packageId },
    ),

  /**
   * Escribe los contratos y registra la aplicación en UNA llamada (#58 R4.1): el
   * front no orquesta la operación con un PUT y un POST por separado.
   */
  applyContractPackage: (orgId: string, projectId: string, input: ApplyContractPackageInput) =>
    api.post<ApplyPackageResult>(
      `/organizations/${orgId}/projects/${projectId}/sla-contracts/apply-package`,
      input,
    ),

  // ── Cobertura / seed / readiness ─────────────────────────────────────────

  getCoverage: (orgId: string) => api.get<SlaCoverage>(`/organizations/${orgId}/sla-coverage`),

  /** Importa la configuración SLA actual. Idempotente y NO destructivo. */
  importCurrentConfig: (orgId: string) =>
    api.post<SlaSeedResult>(`/organizations/${orgId}/sla-seed/import-current`),

  getReadiness: (orgId: string) =>
    api.get<SlaReadiness>(`/organizations/${orgId}/sla-readiness`),
};
