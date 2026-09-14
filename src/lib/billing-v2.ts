// Reglas comerciales puras; la consulta a Botmaker vive exclusivamente en el servidor.
export const FORTALEZA_CLIENT_ID = "cmo021f9s002zg9gfwgl97ue9";
export const FORTALEZA_ACCOUNT_ID = "IC0XXEN8LOZW38EW2XP2";
export const defaultRules = {
  fixed: 299,
  includedAgents: 10,
  agents: 10,
  includedSessions: 3000,
  sessions: 0.11,
  includedLines: 1,
  whatsappLine: 100,
  urlScan: 0.015,
  avScan: 0.024,
  failedNotification: 0.006,
  unansweredNotification: 0.1,
};
export type BillingV2Rules = typeof defaultRules;

export interface RawProduct {
  productId: string;
  usage: number;
  totalSpend: { total: number; currency: string };
}
export interface RawSnapshot {
  billingPeriod: string;
  accounts: Array<{ accountId: string; productUsage: RawProduct[] }>;
}
export interface DevelopmentEntry {
  id: string;
  label: string;
  hours: number;
  rate: number;
  workedOn: string;
  source: "MANUAL" | "ZENTIK";
}
export interface BillingV2Line {
  id: string;
  label: string;
  quantity: number;
  included: number;
  billableQuantity: number;
  unitPrice: number | null;
  supplierCents: number;
  commercialCents: number;
  markupCents: number;
  mode: "DIRECT" | "UNIT";
}
export function previousMonth(period: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
    throw new Error("Período inválido");
  const [y, m] = period.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
function micros(value: number): bigint {
  if (!Number.isFinite(value) || value < 0 || value > 1e9)
    throw new Error("Importe o cantidad inválido");
  return BigInt(value.toFixed(6).replace(".", ""));
}
// Multiplica decimales usando enteros y redondeo comercial por renglón.
function roundedProduct(
  quantity: number,
  unitPrice: number,
  denominator: bigint,
): number {
  const result = Number(
    (micros(quantity) * micros(unitPrice) + denominator / BigInt(2)) /
      denominator,
  );
  if (!Number.isSafeInteger(result))
    throw new Error("El importe supera el límite de precisión");
  return result;
}
export const lineCents = (quantity: number, unitPrice: number) =>
  roundedProduct(quantity, unitPrice, BigInt(10000000000));
export const linePyg = (quantity: number, unitPrice: number) =>
  roundedProduct(quantity, unitPrice, BigInt(1000000000000));
const cents = (value: number) => lineCents(1, value);
const tax = (netCents: number) => Math.floor((netCents + 5) / 10);
const waIds = [
  "WA_BUSINESS_MKT_INITIATED_CONVERSATIONS",
  "WA_BUSINESS_UTIL_INITIATED_CONVERSATIONS",
  "WA_USER_INITIATED_CONVERSATIONS",
];

export function currentBillingMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Asuncion",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return (
    parts.find((p) => p.type === "year")!.value +
    "-" +
    parts.find((p) => p.type === "month")!.value
  );
}
export function nextMonth(period: string) {
  previousMonth(period);
  const [y, m] = period.split("-").map(Number);
  return m === 12
    ? String(y + 1) + "-01"
    : String(y) + "-" + String(m + 1).padStart(2, "0");
}
export function calculateDevelopment(
  entries: DevelopmentEntry[],
  period: string,
) {
  const seen = new Set<string>();
  const lines = entries.map((entry) => {
    if (
      !entry.id ||
      seen.has(entry.id) ||
      !entry.label.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.workedOn) ||
      entry.workedOn.slice(0, 7) !== period ||
      new Date(entry.workedOn + "T12:00:00Z").toISOString().slice(0, 10) !==
        entry.workedOn
    )
      throw new Error("Revisa la tarea y su fecha de trabajo");
    seen.add(entry.id);
    if (entry.hours <= 0) throw new Error("Las horas deben ser mayores a cero");
    // PYG se redondea a unidades enteras, por renglón.
    const amount = linePyg(entry.hours, entry.rate);
    return { ...entry, amount };
  });
  const net = lines.reduce((s, l) => s + l.amount, 0);
  if (
    !Number.isSafeInteger(net) ||
    !Number.isSafeInteger(net + Math.floor((net + 5) / 10))
  )
    throw new Error("El importe supera el límite de precisión");
  const iva = Math.floor((net + 5) / 10);
  return {
    currency: "PYG" as const,
    net,
    tax: iva,
    total: net + iva,
    lines,
    hoursConsumed: lines.reduce((s, l) => s + l.hours, 0),
  };
}
export function calculateMonthlyBilling(
  consumption: RawSnapshot,
  feeSnapshot: RawSnapshot,
  billingPeriod: string,
  rules: BillingV2Rules,
  development: DevelopmentEntry[] = [],
) {
  Object.values(rules).forEach(micros);
  for (const key of [
    "includedAgents",
    "includedSessions",
    "includedLines",
  ] as const)
    if (!Number.isInteger(rules[key]))
      throw new Error("Los incluidos deben ser enteros");
  const consumptionPeriod = previousMonth(billingPeriod);
  if (
    consumption.billingPeriod !== consumptionPeriod ||
    feeSnapshot.billingPeriod !== billingPeriod
  )
    throw new Error("La respuesta no corresponde al período solicitado");
  const account = (raw: RawSnapshot) => {
    const value = raw.accounts.find(
      (a) => a.accountId === FORTALEZA_ACCOUNT_ID,
    );
    if (!value) throw new Error("No hay datos de Fortaleza para el período");
    return value.productUsage;
  };
  const products = account(consumption),
    feeProducts = account(feeSnapshot).filter((p) => p.productId === "FEE");
  const aggregate = (rows: RawProduct[]) =>
    rows.reduce(
      (s, p) => {
        micros(p.usage);
        if (p.totalSpend.currency !== "USD")
          throw new Error("Moneda de Botmaker no soportada");
        return {
          quantity: s.quantity + p.usage,
          supplierCents: s.supplierCents + cents(p.totalSpend.total),
        };
      },
      { quantity: 0, supplierCents: 0 },
    );
  if (!feeProducts.length)
    throw new Error("Botmaker no devolvió el FEE del mes");
  const fee = aggregate(feeProducts);
  const lines: BillingV2Line[] = [];
  const covered = new Set(["FEE"]);
  const add = (
    id: string,
    label: string,
    included: number,
    unitPrice: number | null,
    ids = [id],
  ) => {
    ids.forEach((product) => covered.add(product));
    const source = aggregate(products.filter((p) => ids.includes(p.productId)));
    const billableQuantity = Math.max(0, source.quantity - included);
    const commercialCents =
      unitPrice === null
        ? source.supplierCents
        : lineCents(billableQuantity, unitPrice);
    lines.push({
      id,
      label,
      ...source,
      included,
      billableQuantity,
      unitPrice,
      commercialCents,
      markupCents: commercialCents - source.supplierCents,
      mode: unitPrice === null ? "DIRECT" : "UNIT",
    });
  };
  add("AGENTS", "Agentes adicionales", rules.includedAgents, rules.agents);
  add("URL_SCAN", "Análisis de URL", 0, rules.urlScan);
  add("AI", "Inteligencia artificial", 0, null, [
    ...new Set(
      products
        .filter((p) => p.productId.startsWith("GENERATIVE_"))
        .map((p) => p.productId),
    ),
  ]);
  // El cargo administrativo informa la misma base de tokens; no duplicarla.
  const tokenProducts = products.filter(
    (p) =>
      p.productId.startsWith("GENERATIVE_") &&
      p.productId !== "GENERATIVE_ADMINISTRATIVE_COSTS",
  );
  const aiLine = lines.find((line) => line.id === "AI")!;
  aiLine.quantity = tokenProducts.reduce(
    (sum, product) => sum + product.usage,
    0,
  );
  aiLine.billableQuantity = aiLine.quantity;
  waIds.forEach((id, i) =>
    add(
      id,
      [
        "WhatsApp · Marketing",
        "WhatsApp · Utilidad",
        "WhatsApp · Iniciadas por usuario",
      ][i],
      0,
      null,
    ),
  );
  add("AV_SCAN", "Escaneo de virus", 0, rules.avScan);
  add(
    "WHATSAPP_LINE",
    "Líneas de WhatsApp adicionales",
    rules.includedLines,
    rules.whatsappLine,
  );
  add(
    "NOTIFICATION_WA_FAILED",
    "Notificaciones no recibidas",
    0,
    rules.failedNotification,
  );
  add(
    "NOTIFICATION_WA_NOT_ANSWERED",
    "Notificaciones no respondidas",
    0,
    rules.unansweredNotification,
  );
  add(
    "SESSIONS",
    "Sesiones adicionales",
    rules.includedSessions,
    rules.sessions,
  );
  const unmapped = products.filter(
    (p) => !covered.has(p.productId) && cents(p.totalSpend.total) > 0,
  );
  if (unmapped.length)
    throw new Error(
      "Productos sin regla comercial: " +
        unmapped.map((p) => p.productId).join(", "),
    );
  const netCents = lines.reduce((sum, line) => sum + line.commercialCents, 0);
  const fixedNet = lineCents(fee.quantity, rules.fixed);
  const fixed = {
    period: billingPeriod,
    quantity: fee.quantity,
    netCents: fixedNet,
    taxCents: tax(fixedNet),
    totalCents: fixedNet + tax(fixedNet),
    supplierCents: fee.supplierCents,
  };
  const variable = {
    period: consumptionPeriod,
    netCents,
    taxCents: tax(netCents),
    totalCents: netCents + tax(netCents),
  };
  if (!Number.isSafeInteger(fixed.totalCents + variable.totalCents))
    throw new Error("El importe supera el límite de precisión");
  const whatsappLines = lines.filter((l) => waIds.includes(l.id));
  return {
    status: "DRAFT" as const,
    clientId: FORTALEZA_CLIENT_ID,
    clientName: "Fortaleza Inmuebles SAE",
    billingPeriod,
    consumptionPeriod,
    rules,
    lines,
    fixed,
    variable,
    totalUsdCents: fixed.totalCents + variable.totalCents,
    development: calculateDevelopment(development, consumptionPeriod),
    source: "Botmaker API",
    aiDetails: [...new Set(products.filter(p=>p.productId.startsWith("GENERATIVE_")).map(p=>p.productId))].map(id=>({
      id, ...aggregate(products.filter(p=>p.productId===id)),
    })),
    whatsapp: {
      quantity: whatsappLines.reduce((s, l) => s + l.quantity, 0),
      totalCents: whatsappLines.reduce((s, l) => s + l.commercialCents, 0),
    },
  };
}
export type BillingV2Preview = ReturnType<typeof calculateMonthlyBilling>;
export const defaultSections = {
  fixed: true,
  variable: true,
  development: false,
};
export type BillingV2Sections = typeof defaultSections;

/** Client-safe draft: excluded sections never contribute amounts or details. */
export function selectBillingSections(
  bill: BillingV2Preview,
  sections: BillingV2Sections,
) {
  const { period, netCents, taxCents, totalCents } = bill.fixed;
  return {
    status: "DRAFT" as const,
    clientName: bill.clientName,
    billingPeriod: bill.billingPeriod,
    fixed: sections.fixed ? { period, netCents, taxCents, totalCents } : null,
    variable: sections.variable
      ? {
          ...bill.variable,
          lines: bill.lines.map(
            ({ id, label, billableQuantity, commercialCents }) => ({
              label,
              quantity: billableQuantity,
              amountCents: commercialCents,
            }),
          ),
        }
      : null,
    development: sections.development
      ? {
          period: bill.consumptionPeriod,
          currency: "PYG",
          net: bill.development.net,
          tax: bill.development.tax,
          total: bill.development.total,
          lines: bill.development.lines.map(
            ({ label, hours, rate, workedOn, amount }) => ({
              label,
              hours,
              rate,
              workedOn,
              amount,
            }),
          ),
        }
      : null,
    totalUsdCents:
      (sections.fixed ? bill.fixed.totalCents : 0) +
      (sections.variable ? bill.variable.totalCents : 0),
    taxUsdCents:
      (sections.fixed ? bill.fixed.taxCents : 0) +
      (sections.variable ? bill.variable.taxCents : 0),
    totalPyg: sections.development ? bill.development.total : 0,
  };
}
