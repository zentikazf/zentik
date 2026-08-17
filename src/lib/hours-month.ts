// ─── Agrupación por mes de los registros de horas (#53) ─────────────────────
//
// Estos tres helpers nacieron inline en el portal del cliente
// (`/portal/hours`). Al pasar la pantalla de staff (`/clients/[clientId]/tiempo`)
// de tabla plana a cards colapsables por mes, las dos pantallas necesitan
// EXACTAMENTE el mismo criterio de fecha — si no, staff y cliente vuelven a ver
// meses distintos para el mismo registro, que es justo el bug que #53 arregla.
//
// Regla: la fecha que manda es la **fecha efectiva** = `workedOn` con fallback a
// `createdAt`. `workedOn` es el día REAL de trabajo (el que se anota al cargar la
// hora) y desde H8a es la fecha canónica que corta la facturación; `createdAt` es
// la fecha de CARGA y solo sirve cuando no hay `workedOn` (las PURCHASE nacen con
// `workedOn` NULL por diseño: una compra de horas no tiene día trabajado).
//
// El parámetro se tipa ESTRUCTURALMENTE, no con la interface de ninguna de las
// dos pantallas: cada una declara la suya (con campos distintos) y las dos
// satisfacen esto sin acoplarse entre sí.

/** Lo mínimo que necesitan los helpers: lo cumplen las dos interfaces de registro de horas. */
export interface HoursDateLike {
  workedOn?: string | null;
  createdAt: string;
}

// Mes de trabajo real del registro (workedOn date-only, sin day-shift por TZ); fallback a la fecha de carga
// (createdAt, mes en Asunción). Devuelve la clave 'YYYY-MM'.
export function monthKeyOf(t: HoursDateLike): string {
  if (t.workedOn) return t.workedOn.slice(0, 7);
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(t.createdAt));
  const y = p.find((x) => x.type === 'year')?.value ?? '0000';
  const m = p.find((x) => x.type === 'month')?.value ?? '00';
  return `${y}-${m}`;
}

// Día efectivo del registro como clave comparable 'YYYY-MM-DD' (workedOn date-only; fallback al día de
// createdAt en Asunción). Existe para el filtro de rango de fechas del staff (#53): los inputs `type="date"`
// son date-only, así que se compara STRING contra STRING ('2026-08-01' <= '2026-08-14'). Comparar un `Date`
// construido desde un ISO con hora contra un date-only corre un día según la zona horaria.
// Invariante: `dayKeyOf(t).slice(0, 7) === monthKeyOf(t)` — el filtro y la agrupación nunca se contradicen.
export function dayKeyOf(t: HoursDateLike): string {
  if (t.workedOn) return t.workedOn.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(t.createdAt));
}

// 'YYYY-MM' → 'Julio de 2026' (es-PY, capitalizado). El "de" lo pone ICU: el patrón yMMMM en español
// es "MMMM 'de' y". La versión inline previa del portal producía exactamente lo mismo — el comentario
// que decía 'Julio 2026' siempre estuvo mal, no es una regresión. Cambiar el formato sería un cambio
// de UI visible en staff Y en portal, así que se corrige el comentario, no el código.
export function monthLabelEs(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  const s = new Intl.DateTimeFormat('es-PY', { month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, 15)),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Fecha corta del registro para la fila (día + mes; el año ya va en el header del mes).
//
// Dos ramas, un solo criterio de fecha:
//  - `workedOn`: es date-only, se parsea a medianoche LOCAL y se formatea en la zona del navegador.
//    Medianoche local + zona local nunca corre de día, así que esta rama YA es correcta.
//  - `createdAt`: es un instante UTC, y sus hermanas `monthKeyOf`/`dayKeyOf` lo resuelven fijando
//    `America/Asuncion`. Sin `timeZone` acá, la fecha PINTADA se calculaba en la zona del NAVEGADOR
//    y podía contradecir al mes que AGRUPA y al rango que FILTRA (ej.: createdAt
//    '2026-08-01T01:30:00Z' agrupa en Julio pero se pintaba "01 ago." con el reloj en UTC/Madrid).
//    Se fija Asunción para que las tres funciones hablen de la misma fecha.
//    Esta rama es el caso NORMAL en la pantalla de staff (toda PURCHASE tiene `workedOn` NULL por
//    diseño); en el portal del cliente sólo alcanza a filas legacy pre-H8a, donde también es una
//    corrección (antes se pintaban en la zona del navegador).
export function rowDateShort(t: HoursDateLike): string {
  if (t.workedOn) {
    return new Date(`${t.workedOn.slice(0, 10)}T00:00:00`).toLocaleDateString('es-PY', {
      day: '2-digit',
      month: 'short',
    });
  }
  return new Date(t.createdAt).toLocaleDateString('es-PY', {
    timeZone: 'America/Asuncion',
    day: '2-digit',
    month: 'short',
  });
}
