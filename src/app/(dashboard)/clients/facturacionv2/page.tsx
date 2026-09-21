"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Send,
  Eye,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useOrg } from "@/providers/org-provider";
import { usePermissions } from "@/hooks/use-permissions";
import { getToken } from "@/lib/api-client";
import {
  currentBillingMonth,
  previousMonth,
  nextMonth,
  defaultRules,
  defaultSections,
  selectBillingSections,
  FORTALEZA_CLIENT_ID,
} from "@/lib/billing-v2";
import type {
  BillingV2Preview,
  BillingV2Rules,
  BillingV2Sections,
  DevelopmentEntry,
} from "@/lib/billing-v2";
import { BillingTaskPicker } from "@/components/billing-v2-task-picker";
import { DevelopmentEditor } from "@/components/billing-v2-development-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

const usd = (cents: number) =>
  new Intl.NumberFormat("es-PY", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
const pyg = (amount: number) =>
  new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    maximumFractionDigits: 0,
  }).format(amount);
const number = (amount: number) =>
  new Intl.NumberFormat("es-PY", { maximumFractionDigits: 6 }).format(amount);
const month = (period: string) =>
  new Intl.DateTimeFormat("es-PY", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(period + "-01T12:00:00Z"));
const fields: Array<[keyof BillingV2Rules, string]> = [
  ["fixed", "Plan fijo por proyecto · USD"],
  ["includedAgents", "Agentes incluidos"],
  ["agents", "Precio por agente · USD"],
  ["includedSessions", "Sesiones incluidas"],
  ["sessions", "Precio por sesión · USD"],
  ["includedLines", "Líneas incluidas"],
  ["whatsappLine", "Precio por línea · USD"],
  ["urlScan", "Análisis de URL · USD"],
  ["avScan", "Escaneo de virus · USD"],
  ["failedNotification", "Notificación no recibida · USD"],
  ["unansweredNotification", "Notificación no respondida · USD"],
];
type Draft = {
  rules: BillingV2Rules;
  entries: DevelopmentEntry[];
  sections: BillingV2Sections;
  visible: boolean;
};
const emptyDraft = (): Draft => ({
  rules: { ...defaultRules },
  entries: [],
  sections: { ...defaultSections },
  visible: false,
});

export default function BillingV2Page() {
  const { orgId } = useOrg();
  const { hasPermission } = usePermissions();
  const allowed = hasPermission("manage:billing");
  const [period, setPeriod] = useState(currentBillingMonth);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const saved = useRef<Record<string, Draft>>({});
  const [record, setRecord] = useState<{
    version: number;
    publishedVersion: number | null;
    publishedAt: string | null;
    visible: boolean;
    draft: { bill: BillingV2Preview; sections: BillingV2Sections };
  } | null>(null);
  const [saving, setSaving] = useState(false),
    [publishing, setPublishing] = useState(false),
    [pickerOpen, setPickerOpen] = useState(false);
  const [bill, setBill] = useState<BillingV2Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientView, setClientView] = useState(false),
    [dirty, setDirty] = useState(false);
  const requestId = useRef(0);
  const selected = bill ? selectBillingSections(bill, draft.sections) : null;
  const key = orgId + ":" + period;
  const endpoint =
    "/api/billing-v2?" +
    new URLSearchParams({
      orgId: orgId ?? "",
      clientId: FORTALEZA_CLIENT_ID,
      period,
    });
  const headers = () => {
    const token = getToken();
    return {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      "Content-Type": "application/json",
    };
  };
  const load = useCallback(
    async (input: Draft, signal?: AbortSignal) => {
      if (!orgId || !allowed) return;
      const id = ++requestId.current;
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          "/api/billing-v2?" +
            new URLSearchParams({
              orgId,
              clientId: FORTALEZA_CLIENT_ID,
              period,
            }),
          {
            method: "POST",
            credentials: "include",
            headers: headers(),
            body: JSON.stringify({
              rules: input.rules,
              development: input.entries,
            }),
            signal,
          },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error?.message || "No se pudo cargar la facturación",
          );
        if (id !== requestId.current || signal?.aborted) return;
        setBill(result.data);
        setDirty(false);
      } catch (e) {
        if (id === requestId.current && !signal?.aborted) {
          setBill(null);
          setError(
            e instanceof Error ? e.message : "No se pudo consultar el mes",
          );
        }
      } finally {
        if (id === requestId.current && !signal?.aborted) setLoading(false);
      }
    },
    [orgId, allowed, period],
  );
  useEffect(() => {
    const controller = new AbortController();
    const initial = saved.current[orgId + ":" + period] ?? emptyDraft();
    setDraft(initial);
    setBill(null);
    setRecord(null);
    setDirty(false);
    setError("");
    setClientView(false);
    setPickerOpen(false);
    if (orgId && allowed) {
      setLoading(true);
      fetch(endpoint + "&mode=stored", {
        credentials: "include",
        headers: headers(),
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok)
            throw new Error(
              body.error?.message || "No se pudo cargar el mes guardado",
            );
          return {
            row: body.data,
            persistenceAvailable: body.persistenceAvailable !== false,
          };
        })
        .then(({ row, persistenceAvailable }) => {
          if (controller.signal.aborted) return;
          if (row) {
            setRecord(row);
            setBill(row.draft.bill);
            const stored = {
              rules: row.draft.bill.rules,
              entries: row.draft.bill.development.lines.map(
                ({ amount, ...entry }: DevelopmentEntry & { amount: number }) =>
                  entry,
              ),
              sections: row.draft.sections,
              visible: row.visible,
            };
            const pending = saved.current[orgId + ":" + period];
            setDraft(pending ?? stored);
            setDirty(
              !!pending && JSON.stringify(pending) !== JSON.stringify(stored),
            );
            setLoading(false);
          } else
            void load(initial, controller.signal).then(() => {
              if (!controller.signal.aborted) {
                setDirty(true);
                if (!persistenceAvailable)
                  setError(
                    "La consulta está disponible. Para guardar o publicar, primero hay que desplegar la actualización preparada del backend.",
                  );
              }
            });
        })
        .catch(async () => {
          if (!controller.signal.aborted) {
            await load(initial, controller.signal);
          }
        });
    }
    return () => {
      controller.abort();
      requestId.current++;
    };
    // The selected period determines the document; edits do not reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, period, load]);
  function updateDraft(next: Draft, recalculate = true) {
    if (saving || publishing) return;
    saved.current[key] = next;
    setDraft(next);
    if (recalculate) {
      requestId.current++;
      setLoading(false);
      setDirty(true);
    }
  }
  async function saveChanges() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(endpoint + "&mode=save", {
        method: "POST",
        credentials: "include",
        headers: headers(),
        body: JSON.stringify({
          rules: draft.rules,
          development: draft.entries,
          sections: draft.sections,
          visible: draft.visible,
          version: record?.version ?? 0,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message || "No se pudieron guardar los cambios",
        );
      setRecord(result.data);
      setBill(result.data.draft.bill);
      setDirty(false);
      delete saved.current[key];
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }
  async function publish() {
    if (!record || dirty) return;
    setPublishing(true);
    setError("");
    try {
      const response = await fetch(endpoint + "&mode=publish", {
        method: "POST",
        credentials: "include",
        headers: headers(),
        body: JSON.stringify({ version: record.version }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message || "No se pudo publicar el mes");
      setRecord(result.data);
      setDraft((current) => ({ ...current, visible: true }));
      delete saved.current[key];
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo publicar");
    } finally {
      setPublishing(false);
    }
  }
  if (!allowed)
    return (
      <div className="rounded-xl border bg-card p-8">
        <ShieldCheck className="mb-3 h-7 w-7" />
        <h1 className="text-xl font-semibold">Facturación v2</h1>
        <p>
          Esta sección requiere gestionar facturación en la organización activa.
        </p>
      </div>
    );
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <Link
        href={"/clients/" + FORTALEZA_CLIENT_ID}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Fortaleza
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="outline">
            {clientView
              ? "Vista previa"
              : record?.publishedAt
                ? record.publishedVersion === record.version
                  ? "Publicado"
                  : "Cambios sin publicar"
                : "Borrador"}
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Facturación v2
          </h1>
          <p className="mt-1 text-muted-foreground">Fortaleza Inmuebles SAE</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!bill || dirty || loading}
            onClick={() => setClientView(!clientView)}
          >
            <Eye className="mr-2 h-4 w-4" />
            {clientView ? "Volver a edición" : "Vista previa cliente"}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <Button
          variant="outline"
          aria-label="Mes anterior"
          disabled={saving || publishing || period <= "2000-02"}
          onClick={() => setPeriod(previousMonth(period))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <label className="space-y-1 text-sm">
          Mes de facturación
          <Input
            aria-label="Mes de facturación"
            disabled={saving || publishing}
            type="month"
            min="2000-02"
            max={currentBillingMonth()}
            value={period}
            onChange={(e) => {
              const value = e.target.value;
              if (
                /^20\d{2}-(0[1-9]|1[0-2])$/.test(value) &&
                value >= "2000-02" &&
                value <= currentBillingMonth()
              )
                setPeriod(value);
            }}
          />
        </label>
        <Button
          variant="outline"
          aria-label="Mes siguiente"
          disabled={saving || publishing || period >= currentBillingMonth()}
          onClick={() => setPeriod(nextMonth(period))}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="pb-2 text-sm text-muted-foreground">
          Plan fijo: {month(period)} · Variables y desarrollo:{" "}
          {month(previousMonth(period))}
        </p>
        {!clientView && (
          <label className="ml-auto flex items-center gap-3 self-center text-sm">
            <span>
              {draft.visible
                ? "Visible para el cliente"
                : "Oculto para el cliente"}
            </span>
            <Switch
              aria-label="Visibilidad del mes"
              checked={draft.visible}
              disabled={saving || publishing}
              onCheckedChange={(visible) => updateDraft({ ...draft, visible })}
            />
          </label>
        )}
      </div>
      {loading && (
        <p role="status" className="flex items-center gap-2 p-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Consultando Botmaker…
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-sm"
        >
          <p>{error}</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => void load(draft)}
          >
            Reintentar consulta
          </Button>
        </div>
      )}
      {!clientView && (
        <details className="rounded-xl border bg-card p-5">
          <summary className="cursor-pointer font-semibold">
            Reglas comerciales
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Reglas de septiembre aplicadas a todos los meses. IA y WhatsApp al
            costo real. Los ajustes afectan este borrador.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map(([field, label]) => (
              <label key={field} className="space-y-1 text-sm">
                {label}
                <Input
                  type="number"
                  min="0"
                  max={field.startsWith("included") ? 1000000 : 100000}
                  step={field.startsWith("included") ? 1 : 0.001}
                  value={draft.rules[field]}
                  onChange={(e) =>
                    updateDraft({
                      ...draft,
                      rules: {
                        ...draft.rules,
                        [field]: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </details>
      )}
      {bill && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {(
              [
                {
                  key: "fixed",
                  title: "Plan fijo",
                  amount: usd(bill.fixed.netCents),
                  foot: month(period),
                },
                {
                  key: "variable",
                  title: "Plan variable",
                  amount: usd(bill.variable.netCents),
                  foot: month(bill.consumptionPeriod),
                },
                {
                  key: "development",
                  title: "Desarrollo",
                  amount: pyg(bill.development.net),
                  foot: month(bill.consumptionPeriod),
                },
              ] as const
            )
              .filter((card) => !clientView || draft.sections[card.key])
              .map((card) => (
                <div key={card.key} className="rounded-xl border bg-card p-5">
                  <h2 className="font-semibold">{card.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.foot}
                  </p>
                  {!clientView && (
                    <label className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span>
                        {draft.sections[card.key]
                          ? "Incluido en el borrador"
                          : "Excluido del cobro"}
                      </span>
                      <Switch
                        aria-label={"Incluir " + card.title}
                        checked={draft.sections[card.key]}
                        onCheckedChange={(checked) =>
                          updateDraft({
                            ...draft,
                            sections: {
                              ...draft.sections,
                              [card.key]: checked,
                            },
                          })
                        }
                      />
                    </label>
                  )}
                  <p className="mt-5 text-2xl font-semibold tabular-nums">
                    {card.amount}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Antes de IVA
                  </p>
                </div>
              ))}
          </div>
          {(!clientView || draft.sections.variable) && (
            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold">
                  Plan variable · {month(bill.consumptionPeriod)}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Concepto</th>
                      <th className="px-3 py-3 text-right">
                        {clientView ? "Cantidad" : "Uso / incluidos"}
                      </th>
                      {!clientView && (
                        <th className="px-3 py-3 text-right">Botmaker</th>
                      )}
                      <th className="px-3 py-3 text-right">Cliente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bill.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-5 py-3">
                          <p className="font-medium">{line.label}</p>
                          {line.id==='AI'&&!clientView&&<details className="mt-2 text-xs"><summary className="cursor-pointer text-muted-foreground">Ver consumo</summary><ul className="mt-2 space-y-1">{bill.aiDetails?.map(item=><li key={item.id}>{item.id==='GENERATIVE_ADMINISTRATIVE_COSTS'?'Cargo administrativo':item.id.replace('GENERATIVE_','').replaceAll('_',' ').toLowerCase()}: {item.id==='GENERATIVE_ADMINISTRATIVE_COSTS'?'':number(item.quantity)+' tokens · '}{usd(item.supplierCents)}</li>)}</ul></details>}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {line.mode === "DIRECT"
                              ? clientView
                                ? "Según consumo"
                                : "Traspaso directo"
                              : number(line.billableQuantity) +
                                " × USD " +
                                number(line.unitPrice ?? 0)}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {line.id === "AI"
                            ? number(line.quantity) + " tokens"
                            : clientView
                              ? number(line.billableQuantity)
                              : number(line.quantity) +
                                " / " +
                                number(line.included)}
                        </td>
                        {!clientView && (
                          <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                            {usd(line.supplierCents)}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">
                          {usd(line.commercialCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
      {(!clientView || draft.sections.development) && (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">
            Desarrollo · {month(previousMonth(period))}
          </h2>
          {!clientView && (
            <DevelopmentEditor
              key={key}
              entries={draft.entries}
              period={previousMonth(period)}
              onChange={(entries) => updateDraft({ ...draft, entries })}
              onSelectTasks={() => setPickerOpen(true)}
            />
          )}
          {clientView &&
            bill?.development.lines.map((line) => (
              <div
                key={line.id}
                className="flex justify-between gap-4 border-b py-3 text-sm"
              >
                <span>
                  {line.label} · {number(line.hours)} h
                </span>
                <span>{pyg(line.amount)}</span>
              </div>
            ))}
          {!draft.entries.length && (
            <p className="text-sm text-muted-foreground">
              No hay tareas agregadas para este mes.
            </p>
          )}
        </section>
      )}
      {bill && selected && (
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Total de {month(period)}</h2>
            <span className="text-xs text-muted-foreground">IVA incluido</span>
          </div>
          <dl className="space-y-3 text-sm">
            {selected.fixed && (
              <div className="flex justify-between">
                <dt>Plan fijo</dt>
                <dd>{usd(selected.fixed.totalCents)}</dd>
              </div>
            )}
            {selected.variable && (
              <div className="flex justify-between">
                <dt>Variables</dt>
                <dd>{usd(selected.variable.totalCents)}</dd>
              </div>
            )}
            {(selected.fixed || selected.variable) && (
              <div className="flex justify-between border-t pt-3 text-xl font-semibold">
                <dt>Total USD</dt>
                <dd>{usd(selected.totalUsdCents)}</dd>
              </div>
            )}
            {selected.development && (
              <div className="flex justify-between border-t pt-3 text-xl font-semibold">
                <dt>Desarrollo · Total Gs.</dt>
                <dd>{pyg(selected.totalPyg)}</dd>
              </div>
            )}
            {!Object.values(draft.sections).some(Boolean) && (
              <p className="text-muted-foreground">
                No hay secciones incluidas.
              </p>
            )}
          </dl>
        </section>
      )}
      {!clientView &&
        record &&
        !dirty &&
        record.publishedVersion !== record.version && (
          <div className="flex justify-end">
            <Button
              onClick={() => void publish()}
              disabled={
                publishing || !Object.values(draft.sections).some(Boolean)
              }
            >
              <Send className="mr-2 h-4 w-4" />
              {publishing
                ? "Publicando…"
                : record.publishedAt
                  ? "Publicar cambios"
                  : "Publicar mes"}
            </Button>
          </div>
        )}
      <BillingTaskPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        endpoint={endpoint}
        period={previousMonth(period)}
        existing={draft.entries}
        onImport={(entries) => {
          const ids = new Set(draft.entries.map((e) => e.id));
          updateDraft({
            ...draft,
            entries: [
              ...draft.entries,
              ...entries.filter((e) => !ids.has(e.id)),
            ],
          });
        }}
      />
      {!clientView && dirty && (
        <footer className="sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur">
          <span className="text-sm">Cambios sin guardar</span>
          <Button
            disabled={saving || loading}
            onClick={() => void saveChanges()}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </footer>
      )}
    </div>
  );
}
