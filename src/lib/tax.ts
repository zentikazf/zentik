// #63 — IVA en facturación: helpers de PRESENTACIÓN.
//
// Dos cosas viven acá y son distintas a propósito:
//
//  1. `taxLabel` — la etiqueta que el portal le pone a un monto. NO calcula nada; traduce un modo a
//     tres palabras. Un solo helper para los tres lugares que #62 alineó (la card, el subtotal por
//     mes y el badge de fila): si se etiqueta uno solo, la pantalla se contradice sola.
//
//  2. `previewHourlyRateTax` — la línea viva del diálogo de cliente. Es la ÚNICA aritmética de IVA
//     del frontend, y es legítima porque no hay ningún monto del backend que mostrar: el usuario
//     está TIPEANDO la tarifa y la tasa, y lo que se le muestra es qué significa lo que acaba de
//     tipear. No es un monto de factura; ninguna factura sale de acá.
//
// ⚠️ Todo el resto de la plata con IVA sale calculada del backend (`computeTax`), como string, y no
// se toca en el cliente (§1.4). En el PORTAL no se calcula IVA en ningún lado: #63 sólo agrega
// etiquetas ahí, cero cambios numéricos.

export type TaxMode = 'EXCLUDED' | 'INCLUDED';

/**
 * La etiqueta de un monto según el modo de IVA. TRES estados, y el tercero es el que importa:
 *
 *   EXCLUDED  → '+ IVA'         (al monto todavía le falta el IVA)
 *   INCLUDED  → 'IVA incluido'  (el monto ya lo trae)
 *   null      → SIN ETIQUETA    (ese documento se emitió sin IVA)
 *
 * El `null` es lo que hace que la pantalla no mienta con el histórico: las facturas anteriores a
 * #63 no llevan etiqueta, en vez de heredar una que nunca tuvieron. Cualquier string desconocido
 * (deploy desfasado, dato raro) cae también en "sin etiqueta": inventar una sería peor.
 */
export function taxLabel(taxMode: string | null | undefined): string | null {
  if (taxMode === 'EXCLUDED') return '+ IVA';
  if (taxMode === 'INCLUDED') return 'IVA incluido';
  return null;
}

export interface HourlyRateTaxPreview {
  net: number;
  tax: number;
  total: number;
}

/**
 * Descompone una TARIFA POR HORA según el modo elegido, con la MISMA aritmética que
 * `computeTax` del backend: se redondea UN SOLO término a 2 decimales y el otro sale por resta,
 * así `net + tax === total` exacto. Si acá se redondearan los dos, la línea del diálogo mostraría
 * un total que no cierra con el de la factura — que es justo lo que esta línea viene a evitar.
 *
 *   EXCLUDED  net = tarifa            tax = round(net × rate)       total = net + tax
 *   INCLUDED  total = tarifa          net = round(total / (1+rate)) tax = total − net
 *
 * `taxRatePercent` viene en PORCENTAJE (lo que el usuario tipea: 10), no en fracción.
 */
export function previewHourlyRateTax(
  hourlyRate: number,
  taxRatePercent: number,
  mode: TaxMode,
): HourlyRateTaxPreview {
  const rate = taxRatePercent / 100;
  // `Math.round(x * 100) / 100` = HALF_UP a 2 decimales, la misma precisión que las columnas de
  // plata. Es el único redondeo del cálculo; el otro término sale por resta.
  const round2 = (n: number) => Math.round(n * 100) / 100;

  if (mode === 'EXCLUDED') {
    const net = hourlyRate;
    const tax = round2(net * rate);
    return { net, tax, total: net + tax }; // total por SUMA
  }
  const total = hourlyRate;
  const net = round2(total / (1 + rate));
  return { net, tax: total - net, total }; // tax por RESTA
}

/**
 * Número suelto con separadores es-PY, para la línea viva del diálogo (que ya lleva la moneda al
 * final: "90.000 + 9.000 IVA = 99.000 Gs/h"). PYG sin decimales, igual que `formatCurrency`; las
 * otras monedas CON dos, porque una tarifa de US$ 25 redondeada a entero mostraría "25 + 3 IVA"
 * y el desglose dejaría de leerse.
 */
export function formatRateNumber(value: number, currency: string): string {
  const digits = currency === 'PYG' ? 0 : 2;
  return new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Sufijo de moneda de la línea viva: 'Gs/h' para PYG, el código para el resto. */
export function rateCurrencySuffix(currency: string): string {
  return `${currency === 'PYG' ? 'Gs' : currency}/h`;
}
