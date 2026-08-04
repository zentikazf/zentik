// ─── Camino legible del árbol de tipos de solicitud (#42 Fase 3, paso C) ────
//
// El backend persiste `path` como ruta de SLUGS (`incidencia/error-del-sistema`):
// sirve para ordenar y para buscar por rama, pero NO para mostrarle a nadie. Lo
// que el usuario tiene que leer es el camino de NOMBRES
// (`Incidencia › Error del sistema`), y eso se arma acá — en un solo lugar — a
// partir de la lista plana que ya devuelve `GET ticket-types`.
//
// DECISIÓN: en los SELECTORES el contexto se muestra como **prefijo de camino**,
// no como indentación. Radix Select renderiza el ítem elegido dentro del trigger,
// así que un ítem indentado con espacios se ve torcido justo cuando importa (ya
// seleccionado) y encima los espacios se colapsan en HTML. El prefijo se lee
// igual de bien en el popup y en el trigger. La indentación se usa SOLO en la
// pantalla de administración, donde el árbol es la vista principal.

import { MAX_TICKET_TYPE_DEPTH } from '@/types/sla.types';

/** Separador visual del camino. No es el del backend ("/"): ese es de slugs. */
export const TICKET_TYPE_PATH_SEPARATOR = ' › ';

/** Lo mínimo que necesita el helper: lo cumplen `TicketType` y `TicketTypeNode`. */
interface TicketTypeLike {
  id: string;
  name: string;
  parentId?: string | null;
}

/**
 * Mapa `id → nombres de los ancestros` (de la raíz hacia abajo, SIN el propio).
 *
 * Degradación deliberada: si el padre de un tipo NO está en la lista recibida
 * —caso real cuando se listan solo los activos y el padre está dado de baja— la
 * cadena se corta y el tipo queda sin contexto en vez de desaparecer o de
 * mostrar un camino a medias con un hueco. El tope de saltos evita que un ciclo
 * ya persistido (imposible con las validaciones del service, pero barato de
 * cubrir) cuelgue el render.
 */
export function buildTicketTypeAncestorNames(types: TicketTypeLike[]): Map<string, string[]> {
  const byId = new Map(types.map((type) => [type.id, type]));
  const ancestorsById = new Map<string, string[]>();

  for (const type of types) {
    const ancestors: string[] = [];
    let parent = type.parentId ? byId.get(type.parentId) : undefined;
    let hops = 0;

    while (parent && hops < MAX_TICKET_TYPE_DEPTH) {
      ancestors.unshift(parent.name);
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
      hops++;
    }
    ancestorsById.set(type.id, ancestors);
  }

  return ancestorsById;
}

/**
 * Solo el CONTEXTO (los ancestros): `"Incidencia"`.
 * Cadena vacía para un tipo raíz — el llamador decide si renderiza la línea.
 */
export function ticketTypeContext(
  ancestorsById: Map<string, string[]>,
  typeId: string,
): string {
  const ancestors = ancestorsById.get(typeId);
  return ancestors && ancestors.length > 0 ? ancestors.join(TICKET_TYPE_PATH_SEPARATOR) : '';
}

/**
 * Camino completo, listo para un `SelectItem`: `"Incidencia › Error del sistema"`.
 * Un tipo raíz devuelve su nombre pelado (sin separador colgando).
 */
export function ticketTypeFullLabel(
  ancestorsById: Map<string, string[]>,
  type: { id: string; name: string },
): string {
  const context = ticketTypeContext(ancestorsById, type.id);
  return context ? `${context}${TICKET_TYPE_PATH_SEPARATOR}${type.name}` : type.name;
}
