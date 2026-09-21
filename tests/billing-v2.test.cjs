const { test } = require("node:test");
const assert = require("node:assert/strict");
const loader = require("./load-typescript.cjs");
const engine = loader()("src/lib/billing-v2.ts");
const source = loader()("src/lib/billing-v2-source.server.ts");
const dev = loader()("src/lib/billing-v2-development.ts");
const raw = require("../src/data/billing-v2/fortaleza-2026-08.json");
const fee = { ...raw, billingPeriod: "2026-09" };
const route = loader({
  "@/lib/billing-v2-source.server": {
    ...source,
    fetchFortalezaSnapshot: async (period) =>
      period === "2026-08" ? raw : fee,
  },
})("src/app/api/billing-v2/route.ts");
const { NextRequest } = require("next/server");
const endpoint =
  "http://localhost:3002/api/billing-v2?orgId=org-a&clientId=" +
  engine.FORTALEZA_CLIENT_ID +
  "&period=2026-09";
const request = (url = endpoint, options = {}) =>
  new NextRequest(url, {
    headers: { authorization: "Bearer test-only" },
    ...options,
  });
const session = (role = "PO", org = "org-a") => ({
  data: {
    organizations: [
      {
        id: org,
        roleName: role,
        permissions: role === "PO" ? ["manage:billing"] : ["read:billing"],
      },
    ],
  },
});
function allow(t, rest) {
  process.env.NEXT_PUBLIC_API_URL = "https://backend.example.test";
  t.mock.method(global, "fetch", async (url) =>
    url.endsWith("/auth/me")
      ? Response.json(session())
      : rest
        ? rest(url)
        : Response.json({ data: { id: engine.FORTALEZA_CLIENT_ID } }),
  );
}
test("meses y redondeo decimal", () => {
  assert.equal(engine.previousMonth("2027-01"), "2026-12");
  assert.equal(engine.nextMonth("2026-12"), "2027-01");
  assert.throws(() => engine.previousMonth("2026-13"));
  assert.equal(engine.lineCents(2095, 0.024), 5028);
  assert.equal(engine.lineCents(201, 0.015), 302);
});
test("API rechaza sin sesión sin consultar upstream", async (t) => {
  const mock = t.mock.method(global, "fetch", async () => {
    throw Error("No consultar");
  });
  assert.equal((await route.GET(new NextRequest(endpoint))).status, 401);
  assert.equal(mock.mock.callCount(), 0);
});
test("API rechaza rol de cliente aun con bypass antiguo", async (t) => {
  process.env.NEXT_PUBLIC_API_URL = "https://backend.example.test";
  process.env.BILLING_DEV_SKIP_AUTH = "1";
  t.mock.method(global, "fetch", async () => Response.json(session("Cliente")));
  assert.equal((await route.GET(request())).status, 403);
  delete process.env.BILLING_DEV_SKIP_AUTH;
});
test("API rechaza otra organización y otro cliente", async (t) => {
  process.env.NEXT_PUBLIC_API_URL = "https://backend.example.test";
  t.mock.method(global, "fetch", async () =>
    Response.json(session("Owner", "other")),
  );
  assert.equal((await route.GET(request())).status, 403);
  assert.equal(
    (
      await route.GET(
        request(endpoint.replace(engine.FORTALEZA_CLIENT_ID, "other")),
      )
    ).status,
    404,
  );
});
test("API valida pertenencia del cliente en backend", async (t) => {
  allow(t, () => new Response(null, { status: 403 }));
  assert.equal((await route.GET(request())).status, 403);
});
test("API responde privado con fee y consumo de sus respectivos meses", async (t) => {
  allow(t);
  const response = await route.GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const data = (await response.json()).data;
  assert.equal(data.totalUsdCents, 478161);
  assert.equal(data.fixed.period, "2026-09");
  assert.equal(data.variable.period, "2026-08");
});
test("API valida mes, precios y desarrollo", async (t) => {
  allow(t);
  assert.equal(
    (await route.GET(request(endpoint.replace("2026-09", "2026-13")))).status,
    400,
  );
  assert.equal(
    (
      await route.POST(
        request(endpoint, {
          method: "POST",
          body: JSON.stringify({
            rules: { ...engine.defaultRules, sessions: -1 },
          }),
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await route.POST(
        request(endpoint, {
          method: "POST",
          body: JSON.stringify({
            rules: engine.defaultRules,
            development: [
              {
                id: "m1",
                label: "Trabajo",
                hours: 2,
                rate: 100,
                workedOn: "2026-07-01",
                source: "MANUAL",
              },
            ],
          }),
        }),
      )
    ).status,
    422,
  );
});
test("parser selecciona Fortaleza y conserva productos de costo cero", () => {
  const payload = structuredClone(raw);
  payload.accounts.push({
    accountId: "other",
    productUsage: [{ secret: "other client" }],
  });
  const parsed = source.parseFortalezaSnapshot(payload, "2026-08");
  assert.equal(parsed.accounts.length, 1);
  assert.equal(
    parsed.accounts[0].productUsage.length,
    raw.accounts[0].productUsage.length,
  );
  assert.throws(() => source.parseFortalezaSnapshot(raw, "2026-07"));
  const wrong = structuredClone(raw);
  wrong.accounts[0].productUsage[0].totalSpend.currency = "PYG";
  assert.throws(() => source.parseFortalezaSnapshot(wrong, "2026-08"));
});
const tx = {
  id: "tx1",
  type: "USAGE",
  hours: 2,
  workedOn: "2026-08-21",
  createdAt: "2026-09-02T12:00:00Z",
  priceRate: "100000",
  priceCurrency: "PYG",
  billedCycleId: null,
  rebilledFromTransactionId: null,
  task: { id: "task1", title: "Integración", type: "PROJECT" },
};
const page = (transactions) =>
  dev.hoursPageSchema.parse({
    currency: "PYG",
    developmentHourlyRate: 100000,
    transactions,
    transactionsTotal: transactions.length,
    page: 1,
    limit: 500,
  });
test("importación usa fecha trabajada y excluye facturados, internos, espejos, soporte y otras monedas", () => {
  const input = page([
    tx,
    { ...tx, id: "billed", billedCycleId: "cycle" },
    { ...tx, id: "internal", type: "INTERNAL" },
    { ...tx, id: "mirror", rebilledFromTransactionId: "tx1" },
    { ...tx, id: "usd", priceCurrency: "USD" },
    { ...tx, id: "support", task: { ...tx.task, type: "SUPPORT" } },
    { ...tx, id: "july", workedOn: "2026-07-31" },
  ]);
  const result = dev.developmentFromHours([input, input], "2026-08");
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].id, "zentik:tx1");
  assert.equal(result.entries[0].rate, 100000);
  assert.equal(result.skipped, 4);
});
test("API pagina todas las horas antes de importar", async (t) => {
  allow(t, (url) =>
    url.includes("/hours?")
      ? Response.json({
          data: {
            ...page([{ ...tx, id: url.includes("page=2") ? "tx2" : "tx1" }]),
            page: url.includes("page=2") ? 2 : 1,
            transactionsTotal: 2,
            limit: 1,
          },
        })
      : Response.json({ data: { id: engine.FORTALEZA_CLIENT_ID } }),
  );
  const response = await route.GET(request(endpoint + "&mode=development"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.entries.length, 2);
});
test("API no devuelve horas parciales", async (t) => {
  allow(t, (url) =>
    url.includes("/hours?")
      ? Response.json({ data: { ...page([]), transactionsTotal: 2 } })
      : Response.json({ data: { id: engine.FORTALEZA_CLIENT_ID } }),
  );
  assert.equal(
    (await route.GET(request(endpoint + "&mode=development"))).status,
    502,
  );
});

test("API trata un endpoint de guardado aún no desplegado como mes nuevo", async (t) => {
  allow(t, (url) =>
    url.includes("/billing-v2/2026-09")
      ? new Response(null, { status: 404 })
      : Response.json({ data: { id: engine.FORTALEZA_CLIENT_ID } }),
  );
  const response = await route.GET(request(endpoint + "&mode=stored"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    data: null,
    persistenceAvailable: false,
  });
});

test("PYG redondea una sola vez y rechaza importes fuera de precisión segura", () => {
  assert.equal(engine.linePyg(1, 1.499), 1);
  assert.equal(engine.linePyg(1, 1.5), 2);
  assert.throws(() => engine.lineCents(1e9, 1e9));
});
test("consulta Botmaker deduplica, usa solo token proveedor y no cachea errores", async (t) => {
  const old = process.env.BOTMAKER_ACCESS_TOKEN;
  process.env.BOTMAKER_ACCESS_TOKEN = "test-provider-token";
  t.after(() => {
    if (old === undefined) delete process.env.BOTMAKER_ACCESS_TOKEN;
    else process.env.BOTMAKER_ACCESS_TOKEN = old;
  });
  let attempts = 0;
  const mock = t.mock.method(global, "fetch", async (url, options) => {
    attempts++;
    assert.deepEqual(options.headers, {
      "access-token": "test-provider-token",
    });
    if (url.endsWith("2026-07")) return new Response(null, { status: 429 });
    return Response.json(raw);
  });
  await Promise.all([
    source.fetchFortalezaSnapshot("2026-08"),
    source.fetchFortalezaSnapshot("2026-08"),
  ]);
  assert.equal(mock.mock.callCount(), 1);
  await assert.rejects(() => source.fetchFortalezaSnapshot("2026-07"));
  await assert.rejects(() => source.fetchFortalezaSnapshot("2026-07"));
  assert.equal(attempts, 3);
});
