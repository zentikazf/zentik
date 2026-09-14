const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  Module = require("node:module");
const filename = path.resolve("src/lib/billing-v2.ts"),
  mod = new Module(filename, module);
mod.paths = module.paths;
mod._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
  filename,
);
const { calculateMonthlyBilling, defaultRules, selectBillingSections } =
  mod.exports;
const consumption = require("../src/data/billing-v2/fortaleza-2026-08.json");
const fee = {
  billingPeriod: "2026-09",
  accounts: [
    {
      accountId: "IC0XXEN8LOZW38EW2XP2",
      productUsage: [
        {
          productId: "FEE",
          usage: 2,
          totalSpend: { total: 298, currency: "USD" },
        },
      ],
    },
  ],
};
test("calcula desde API sin Excel, fee del mes y variables del anterior", () => {
  const bill = calculateMonthlyBilling(
    consumption,
    fee,
    "2026-09",
    defaultRules,
    [],
  );
  assert.equal(bill.fixed.netCents, 59800);
  assert.equal(bill.fixed.supplierCents, 29800);
  assert.equal(bill.variable.netCents, 404792);
  assert.equal(
    bill.lines.find((l) => l.id === "AV_SCAN").commercialCents,
    5028,
  );
  assert.equal(bill.whatsapp.totalCents, 123035);
  assert.equal(bill.whatsapp.quantity, 21058);
  assert.equal(bill.phones, undefined);
  assert.equal(bill.source, "Botmaker API");
});
test("productos gratuitos conservan consumo comercial y ausentes son cero", () => {
  const raw = structuredClone(consumption);
  raw.accounts[0].productUsage = [
    {
      productId: "URL_SCAN",
      usage: 34,
      totalSpend: { total: 0, currency: "USD" },
    },
  ];
  const bill = calculateMonthlyBilling(raw, fee, "2026-09", defaultRules, []);
  assert.equal(bill.variable.netCents, 51);
});
test("valida períodos, cuenta, fee ausente y productos desconocidos con costo", () => {
  assert.throws(() =>
    calculateMonthlyBilling(consumption, fee, "2026-08", defaultRules, []),
  );
  assert.throws(() =>
    calculateMonthlyBilling(
      consumption,
      { ...fee, accounts: [] },
      "2026-09",
      defaultRules,
      [],
    ),
  );
  const other = structuredClone(consumption);
  other.accounts[0].productUsage.push({
    productId: "NEW_CHARGE",
    usage: 1,
    totalSpend: { total: 10, currency: "USD" },
  });
  assert.throws(
    () => calculateMonthlyBilling(other, fee, "2026-09", defaultRules, []),
    /NEW_CHARGE/,
  );
});
test("desarrollo manual por horas y switch sin mezclar monedas ni filtrar costos", () => {
  const entries = [
    {
      id: "manual1",
      label: "Integración",
      hours: 2.5,
      rate: 100000,
      workedOn: "2026-08-21",
      source: "MANUAL",
    },
  ];
  const bill = calculateMonthlyBilling(
    consumption,
    fee,
    "2026-09",
    defaultRules,
    entries,
  );
  const selected = selectBillingSections(bill, {
    fixed: false,
    variable: false,
    development: true,
  });
  assert.equal(selected.totalPyg, 275000);
  assert.equal(selected.totalUsdCents, 0);
  assert.equal(selected.variable, null);
  assert.equal(selected.fixed, null);
  assert.equal(
    /supplierCents|markupCents/.test(JSON.stringify(selected)),
    false,
  );
  assert.throws(() =>
    calculateMonthlyBilling(consumption, fee, "2026-09", defaultRules, [
      { ...entries[0], workedOn: "2026-07-21" },
    ]),
  );
  assert.throws(() =>
    calculateMonthlyBilling(consumption, fee, "2026-09", defaultRules, [
      entries[0],
      entries[0],
    ]),
  );
});

test("abril del HTML usa las reglas de septiembre y produce mayo 2901.21", () => {
  const raw = require("./fixtures/fortaleza-html-2026-04.json");
  const bill = calculateMonthlyBilling(
    raw,
    { ...raw, billingPeriod: "2026-05" },
    "2026-05",
    defaultRules,
    [],
  );
  assert.equal(bill.totalUsdCents, 290121);
  assert.equal(bill.variable.netCents, 233846);
  assert.equal(
    bill.lines.find((l) => l.id === "AGENTS").commercialCents,
    20000,
  );
  assert.equal(
    bill.lines.find((l) => l.id === "SESSIONS").commercialCents,
    106370,
  );
  assert.equal(
    bill.lines.find((l) => l.id === "NOTIFICATION_WA_FAILED").commercialCents,
    1907,
  );
});
