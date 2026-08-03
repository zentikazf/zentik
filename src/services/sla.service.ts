import { api } from '@/lib/api-client';
import type {
  AssignSlaPolicyInput,
  AvailableTicketTypes,
  CreateSlaPolicyInput,
  CreateTicketTypeInput,
  CriticalityConfig,
  ProjectSlaContractsResponse,
  SlaCoverage,
  SlaCriticality,
  SlaPolicy,
  SlaReadiness,
  SlaSeedResult,
  TicketType,
  UpdateCriticalityConfigInput,
  UpdateSlaPolicyInput,
  UpdateTicketTypeInput,
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

  listTypes: (orgId: string, includeInactive = false) =>
    api.get<TicketType[]>(
      `/organizations/${orgId}/ticket-types${includeInactive ? '?includeInactive=true' : ''}`,
    ),

  createType: (orgId: string, input: CreateTicketTypeInput) =>
    api.post<TicketType>(`/organizations/${orgId}/ticket-types`, input),

  updateType: (orgId: string, typeId: string, input: UpdateTicketTypeInput) =>
    api.patch<TicketType>(`/organizations/${orgId}/ticket-types/${typeId}`, input),

  deactivateType: (orgId: string, typeId: string) =>
    api.delete<TicketType>(`/organizations/${orgId}/ticket-types/${typeId}`),

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

  // ── Cobertura / seed / readiness ─────────────────────────────────────────

  getCoverage: (orgId: string) => api.get<SlaCoverage>(`/organizations/${orgId}/sla-coverage`),

  /** Importa la configuración SLA actual. Idempotente y NO destructivo. */
  importCurrentConfig: (orgId: string) =>
    api.post<SlaSeedResult>(`/organizations/${orgId}/sla-seed/import-current`),

  getReadiness: (orgId: string) =>
    api.get<SlaReadiness>(`/organizations/${orgId}/sla-readiness`),
};
