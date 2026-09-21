import { z } from "zod";
import {
  FORTALEZA_ACCOUNT_ID,
  previousMonth,
  type RawSnapshot,
} from "./billing-v2";

const value = z.number().finite().min(0).max(1e9);
const money = z.object({ total: value, currency: z.literal("USD") });
const product = z.object({
  productId: z.string().min(1).max(150),
  usage: value,
  totalSpend: z.union([money, z.array(money).min(1)]),
});
const account = z.object({
  accountId: z.literal(FORTALEZA_ACCOUNT_ID),
  productUsage: z.array(product).max(10000),
});

export class BillingSourceError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export function parseFortalezaSnapshot(
  input: unknown,
  period: string,
): RawSnapshot {
  const envelope = z
    .object({
      billingPeriod: z.literal(period),
      accounts: z.array(z.unknown()),
    })
    .safeParse(input);
  if (!envelope.success)
    throw new BillingSourceError(
      "Botmaker devolvió un período o formato inválido",
    );
  const candidates = envelope.data.accounts.filter(
    (a) =>
      typeof a === "object" &&
      a !== null &&
      "accountId" in a &&
      a.accountId === FORTALEZA_ACCOUNT_ID,
  );
  if (candidates.length !== 1)
    throw new BillingSourceError(
      "No hay una cuenta Fortaleza única para este mes",
      404,
    );
  const parsed = account.safeParse(candidates[0]);
  if (!parsed.success)
    throw new BillingSourceError(
      "Botmaker devolvió consumos o monedas inválidos",
    );
  return {
    billingPeriod: period,
    accounts: [
      {
        accountId: FORTALEZA_ACCOUNT_ID,
        productUsage: parsed.data.productUsage.map((p) => ({
          ...p,
          totalSpend: {
            currency: "USD",
            total: Array.isArray(p.totalSpend)
              ? p.totalSpend.reduce((s, m) => s + m.total, 0)
              : p.totalSpend.total,
          },
        })),
      },
    ],
  };
}

// Bounded, server-only cache. Retains only Fortaleza; never other accounts or credentials.
const cache = new Map<
  string,
  { expiresAt: number; value: Promise<RawSnapshot> }
>();
export async function fetchFortalezaSnapshot(
  period: string,
): Promise<RawSnapshot> {
  previousMonth(period);
  const token = process.env.BOTMAKER_ACCESS_TOKEN;
  if (!token)
    throw new BillingSourceError(
      "Falta configurar BOTMAKER_ACCESS_TOKEN en el servidor",
      503,
    );
  const cached = cache.get(period);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = (async () => {
    const response = await fetch(
      `https://api.botmaker.com/v2.0/billing/consumptions?billing-period=${period}`,
      {
        headers: { "access-token": token },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok)
      throw new BillingSourceError(
        response.status === 429
          ? "Botmaker alcanzó su límite de consultas. Intenta más tarde."
          : `Botmaker no pudo entregar el mes ${period}`,
        response.status === 429 ? 429 : 502,
      );
    return parseFortalezaSnapshot(await response.json(), period);
  })();
  if (cache.size >= 24) cache.delete(cache.keys().next().value!);
  cache.set(period, { expiresAt: Date.now() + 15 * 60 * 1000, value });
  try {
    return await value;
  } catch (error) {
    if (cache.get(period)?.value === value) cache.delete(period);
    throw error;
  }
}
