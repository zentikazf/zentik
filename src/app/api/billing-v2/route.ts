import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  developmentFromHours,
  hoursPageSchema,
} from "@/lib/billing-v2-development";
import {
  fetchFortalezaSnapshot,
  BillingSourceError,
} from "@/lib/billing-v2-source.server";

import {
  calculateMonthlyBilling,
  previousMonth,
  currentBillingMonth,
  defaultRules,
  FORTALEZA_CLIENT_ID,
} from "@/lib/billing-v2";

export const dynamic = "force-dynamic";
const price = z.number().finite().min(0).max(100000);
const count = z.number().int().min(0).max(1000000);
const rulesSchema = z
  .object({
    fixed: price,
    includedAgents: count,
    agents: price,
    includedSessions: count,
    sessions: price,
    includedLines: count,
    whatsappLine: price,
    urlScan: price,
    avScan: price,
    failedNotification: price,
    unansweredNotification: price,
  })
  .strict();
const entrySchema = z
  .object({
    id: z.string().min(1).max(150),
    label: z.string().trim().min(1).max(500),
    hours: z.number().finite().positive().max(100000),
    rate: z.number().finite().min(0).max(1e9),
    workedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source: z.enum(["MANUAL", "ZENTIK"]),
  })
  .strict();
const requestSchema = z
  .object({
    rules: rulesSchema,
    development: z.array(entrySchema).max(1000).default([]),
    version: z.number().int().nonnegative().optional(),
    visible: z.boolean().optional(),
    sections: z
      .object({
        fixed: z.boolean(),
        variable: z.boolean(),
        development: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict();
const respond = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const fail = (message: string, status: number) =>
  respond({ success: false, error: { message } }, status);

async function handle(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!orgId || !/^[a-zA-Z0-9_-]{1,100}$/.test(orgId))
    return fail("Organización inválida", 400);
  if (clientId !== FORTALEZA_CLIENT_ID)
    return fail("Este cliente no tiene una conciliación v2 disponible", 404);
  const period =
    req.nextUrl.searchParams.get("period") || currentBillingMonth();
  if (
    !/^20\d{2}-(0[1-9]|1[0-2])$/.test(period) ||
    period > currentBillingMonth()
  )
    return fail("Selecciona un mes válido, hasta el mes actual", 400);
  const authorization = req.headers.get("authorization");
  const cookie = req.headers.get("cookie");
  if (!authorization && !cookie) return fail("Sesión requerida", 401);
  const backend =
    process.env.NODE_ENV === "development" && process.env.DEV_BACKEND_URL
      ? process.env.DEV_BACKEND_URL
      : process.env.NEXT_PUBLIC_API_URL;
  if (!backend) return fail("Backend no configurado", 503);
  const headers = {
    ...(authorization ? { Authorization: authorization } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
  };
  try {
    const session = await fetch(`${backend}/api/v1/auth/me`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!session.ok) return fail("Sesión inválida", 401);
    const body = await session.json();
    const org = body?.data?.organizations?.find(
      (o: { id: string }) => o.id === orgId,
    );
    if (
      !org ||
      !(
        org.roleName === "Owner" ||
        org.permissions?.includes("*:*") ||
        org.permissions?.includes("manage:billing")
      )
    )
      return fail("Se requiere el permiso de gestionar facturación", 403);
    // Comprobar que el cliente pertenece a la organización autorizada.
    const client = await fetch(
      `${backend}/api/v1/organizations/${orgId}/clients/${clientId}`,
      { headers, cache: "no-store", signal: AbortSignal.timeout(15000) },
    );
    if (!client.ok)
      return fail(
        "No se pudo verificar el acceso al cliente",
        client.status === 403 ? 403 : 404,
      );
    const mode = req.nextUrl.searchParams.get("mode");
    const storageUrl =
      backend +
      "/api/v1/organizations/" +
      orgId +
      "/clients/" +
      clientId +
      "/billing-v2";
    const proxy = async (
      url: string,
      body?: unknown,
      missingAsEmpty = false,
    ) => {
      const response = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: {
          ...headers,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (response.status === 404 && missingAsEmpty)
        return respond({
          success: true,
          data: null,
          persistenceAvailable: false,
        });
      if (response.status === 404)
        return fail(
          "El guardado de Facturación v2 aún no está habilitado en el backend.",
          503,
        );
      return respond(await response.json(), response.status);
    };
    if (req.method === "GET" && mode === "stored")
      return proxy(storageUrl + "/" + period, undefined, true);
    if (req.method === "GET" && mode === "tasks") {
      const page = req.nextUrl.searchParams.get("page") ?? "1";
      if (!/^\d{1,5}$/.test(page)) return fail("Página inválida", 400);
      return proxy(storageUrl + "/tasks?page=" + page);
    }
    if (req.method === "POST" && mode === "publish") {
      const input = z
        .object({ version: z.number().int().positive() })
        .strict()
        .safeParse(await req.json().catch(() => null));
      if (!input.success)
        return fail("Guarda los cambios antes de publicar", 400);
      return proxy(storageUrl + "/" + period + "/publish", input.data);
    }
    if (
      req.method === "GET" &&
      req.nextUrl.searchParams.get("mode") === "development"
    ) {
      const pages: z.infer<typeof hoursPageSchema>[] = [];
      let received = 0;
      for (let page = 1; page <= 20; page++) {
        const response = await fetch(
          `${backend}/api/v1/organizations/${orgId}/clients/${clientId}/hours?page=${page}&limit=500`,
          {
            headers,
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok)
          return fail(
            "No se pudieron importar las horas de Zentik",
            response.status === 403 ? 403 : 502,
          );
        const result = hoursPageSchema.safeParse((await response.json())?.data);
        if (!result.success || result.data.page !== page)
          return fail("Zentik devolvió un registro de horas inválido", 502);
        pages.push(result.data);
        received += result.data.transactions.length;
        if (received >= result.data.transactionsTotal) {
          const imported = developmentFromHours(pages, previousMonth(period));
          if (imported.entries.length > 1000)
            return fail(
              "El mes supera las 1.000 tareas permitidas por borrador",
              422,
            );
          return respond({ success: true, data: imported });
        }
        if (!result.data.transactions.length) break;
      }
      return fail(
        "No se pudo obtener el registro completo de horas; no se importaron datos parciales",
        502,
      );
    }
    let rules = defaultRules;
    let development: z.infer<typeof entrySchema>[] = [];
    let saveInput: z.infer<typeof requestSchema> | null = null;
    if (req.method === "POST") {
      const parsed = requestSchema.safeParse(
        await req.json().catch(() => null),
      );
      if (!parsed.success)
        return fail("Revisa los precios y las cantidades incluidas", 400);
      saveInput = parsed.data;
      rules = parsed.data.rules;
      development = parsed.data.development;
    }
    const [consumption, fee] = await Promise.all([
      fetchFortalezaSnapshot(previousMonth(period)),
      fetchFortalezaSnapshot(period),
    ]);
    try {
      const bill = calculateMonthlyBilling(
        consumption,
        fee,
        period,
        rules,
        development,
      );
      if (mode === "save" && req.method === "POST") {
        if (
          saveInput?.version === undefined ||
          saveInput.visible === undefined ||
          !saveInput.sections
        )
          return fail("Faltan los datos de guardado", 400);
        return proxy(storageUrl + "/" + period, {
          version: saveInput.version,
          visible: saveInput.visible,
          sections: saveInput.sections,
          bill,
        });
      }
      return respond({ success: true, data: bill });
    } catch (error) {
      return fail(
        error instanceof Error
          ? error.message
          : "No se pudo calcular el borrador",
        422,
      );
    }
  } catch (error) {
    if (error instanceof BillingSourceError)
      return fail(error.message, error.status);
    return fail(
      "No se pudo preparar el borrador. Verifica el backend y los datos de origen.",
      502,
    );
  }
}
export const GET = handle;
export const POST = handle;
