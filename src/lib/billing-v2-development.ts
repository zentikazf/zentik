import { z } from "zod";
import type { DevelopmentEntry } from "./billing-v2";

const numeric = z
  .union([z.number(), z.string().min(1)])
  .pipe(z.coerce.number().finite().min(0).max(1e9));
const transaction = z.object({
  id: z.string().min(1),
  type: z.string(),
  hours: numeric,
  workedOn: z.string().nullable(),
  createdAt: z.string(),
  priceRate: numeric.nullable(),
  priceCurrency: z.string().nullable(),
  billedCycleId: z.string().nullable(),
  rebilledFromTransactionId: z.string().nullable(),
  task: z
    .object({
      id: z.string(),
      title: z.string(),
      type: z.string().nullable().optional(),
    })
    .nullable(),
});
export const hoursPageSchema = z.object({
  currency: z.string(),
  developmentHourlyRate: numeric.nullable(),
  transactions: z.array(transaction),
  transactionsTotal: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

export function developmentFromHours(
  pages: z.infer<typeof hoursPageSchema>[],
  period: string,
) {
  const entries: DevelopmentEntry[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const page of pages)
    for (const tx of page.transactions) {
      if (seen.has(tx.id)) continue;
      seen.add(tx.id);
      const date = tx.workedOn ?? tx.createdAt;
      // workedOn is a DATE in the backend; createdAt is an instant in Asunción.
      const workedOn = tx.workedOn
        ? date.slice(0, 10)
        : new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Asuncion",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(date));
      if (workedOn.slice(0, 7) !== period || tx.task?.type !== "PROJECT")
        continue;
      const rate = tx.priceRate ?? page.developmentHourlyRate;
      if (
        !["USAGE", "LOAN"].includes(tx.type) ||
        tx.billedCycleId ||
        tx.rebilledFromTransactionId ||
        tx.hours <= 0 ||
        (tx.priceCurrency ?? page.currency) !== "PYG" ||
        rate === null
      ) {
        skipped++;
        continue;
      }
      entries.push({
        id: `zentik:${tx.id}`,
        label: tx.task.title,
        hours: tx.hours,
        rate,
        workedOn,
        source: "ZENTIK",
      });
    }
  return { entries, skipped };
}
