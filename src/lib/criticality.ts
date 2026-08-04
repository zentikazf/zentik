// ─── Criticidad — fuente ÚNICA del frontend (#42 Fase 3, paso A) ────────────
//
// Antes de este archivo el par label/color de criticidad estaba duplicado en 11
// lugares (types, hook de filtros, listado, panel del ticket, badges, facetas,
// las 4 pantallas de /settings/sla y el detalle del portal). Agregar un valor
// obligaba a tocar los 11 y olvidarse de uno pasaba desapercibido.
//
// Regla: TODO lo que sepa de criticidades vive acá. Sumar una quinta debería ser
// editar solo este archivo — los `Record<Criticality, …>` hacen que `tsc` marque
// lo que falte.

/**
 * Las criticidades, ordenadas por **urgencia DESC**.
 *
 * ⚠️ El orden del enum del backend (`TicketCriticality`) NO define urgencia: la
 * define `TicketCriticalityConfig.level` (ver `CRITICALITY_DEFAULT_CONFIG`).
 * Este array replica ese orden por nivel (4 → 1), que es el que ve el usuario.
 */
export const CRITICALITY_VALUES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

export type Criticality = (typeof CRITICALITY_VALUES)[number];

/** Nombre interno (lo ve el equipo). El cliente puede ver otro: `clientLabel`. */
export const CRITICALITY_LABEL: Record<Criticality, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

/**
 * Clases del badge (fondo + texto). Es el set que ya usaban 4 de las 6 copias
 * (`bg-<token>/10 text-<token>`), así que unificar no cambió ningún color
 * existente. `CRITICAL` estrena el rojo sólido del `Badge variant="destructive"`
 * para leerse por encima de "Alta".
 */
export const CRITICALITY_BADGE_CLASS: Record<Criticality, string> = {
  CRITICAL: 'bg-destructive text-destructive-foreground',
  HIGH: 'bg-destructive/10 text-destructive',
  MEDIUM: 'bg-warning/10 text-warning',
  LOW: 'bg-muted text-muted-foreground',
};

/** Variante solo-texto, para dropdowns y checkboxes donde el fondo estorba. */
export const CRITICALITY_TEXT_CLASS: Record<Criticality, string> = {
  CRITICAL: 'text-destructive',
  HIGH: 'text-destructive',
  MEDIUM: 'text-warning',
  LOW: 'text-muted-foreground',
};

/**
 * Espejo de `CRITICALITY_DEFAULTS` + `CRITICALITY_HIDDEN_BY_DEFAULT` del backend
 * (`sla/criticality-config.service.ts`). Se usa SOLO para pintar la fila de una
 * criticidad que la organización todavía no configuró: el PATCH es un upsert,
 * así que editarla la crea.
 *
 * `CRITICAL` nace **oculta al cliente** (decisión de producto): la criticidad más
 * urgente no se ofrece en el portal por defecto, se habilita a mano.
 */
export const CRITICALITY_DEFAULT_CONFIG: Record<
  Criticality,
  { level: number; clientVisible: boolean }
> = {
  CRITICAL: { level: 4, clientVisible: false },
  HIGH: { level: 3, clientVisible: true },
  MEDIUM: { level: 2, clientVisible: true },
  LOW: { level: 1, clientVisible: true },
};

/** La que entra si la organización no marcó ninguna (espejo de `FALLBACK_CRITICALITY`). */
export const FALLBACK_CRITICALITY: Criticality = 'MEDIUM';

/** Type guard — única puerta de entrada para valores que llegan como string suelto. */
export function isCriticality(value: unknown): value is Criticality {
  return (
    typeof value === 'string' && (CRITICALITY_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Parsea el CSV de criticidades de la URL (`?criticality=HIGH,LOW`).
 *
 * Descarta lo desconocido —tolerancia a basura en la query string— y este es el
 * **único** lugar donde ese descarte ocurre: antes vivía en `VALID_CRITICALITIES`
 * dentro del hook de filtros, mezclado con los otros facets.
 */
export function parseCriticalityCsv(value: string | null | undefined): Criticality[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(isCriticality);
}

/**
 * Presentación de una criticidad que llega **sin tipar** (respuestas viejas, el
 * `priority` heredado, un query param).
 *
 * Es el ÚNICO fallback del frontend. Antes cada sitio caía en silencio a
 * `MEDIUM`, y eso disfrazaba de "Media" cualquier valor que la UI no conociera
 * —justo el bug que este paso viene a destapar—. Ahora un valor desconocido se
 * muestra crudo y con estilo neutro: se ve que algo no cuadra, sin romper la
 * pantalla.
 *
 * Con un valor ya tipado como `Criticality` no hace falta: usá los `Record`
 * directamente.
 */
export function criticalityStyle(value: string | null | undefined): {
  label: string;
  badgeClass: string;
  textClass: string;
} {
  if (isCriticality(value)) {
    return {
      label: CRITICALITY_LABEL[value],
      badgeClass: CRITICALITY_BADGE_CLASS[value],
      textClass: CRITICALITY_TEXT_CLASS[value],
    };
  }
  return {
    label: value ?? '',
    badgeClass: 'bg-muted text-muted-foreground',
    textClass: 'text-muted-foreground',
  };
}
