"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import type { selectBillingSections } from "@/lib/billing-v2";

export type PublishedBilling = Omit<
  ReturnType<typeof selectBillingSections>,
  "status"
> & { status: "PUBLISHED" };
export interface PublishedMonth {
  period: string;
  publishedAt: string;
  document: PublishedBilling;
}
export const billingUsd = (cents: number) =>
  new Intl.NumberFormat("es-PY", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export const billingPyg = (amount: number) =>
  new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    maximumFractionDigits: 0,
  }).format(amount);
export const billingMonth = (period: string) =>
  new Intl.DateTimeFormat("es-PY", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(period + "-01T12:00:00Z"));
export function PublishedBillingList({
  onLoaded,
}: {
  onLoaded: (count: number) => void;
}) {
  const [months, setMonths] = useState<PublishedMonth[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api
      .get<PublishedMonth[]>("/portal/billing-v2")
      .then((response) => {
        if (active) {
          setMonths(response.data);
          onLoaded(response.data.length);
        }
      })
      .catch(() => {
        if (active) setError("No se pudo cargar la facturación publicada.");
      });
    return () => {
      active = false;
    };
  }, [onLoaded]);
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  return (
    <div className="space-y-3">
      {months.map((row) => (
        <Link
          key={row.period}
          href={"/portal/facturacionv2/" + row.period}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5 hover:bg-muted/30"
        >
          <div>
            <p className="font-semibold capitalize">
              {billingMonth(row.period)}
            </p>
            <p className="text-xs text-muted-foreground">
              Publicado · IVA incluido
            </p>
          </div>
          <div className="text-right font-semibold">
            {(row.document.fixed || row.document.variable) && (
              <p>{billingUsd(row.document.totalUsdCents)}</p>
            )}
            {row.document.development && (
              <p>{billingPyg(row.document.totalPyg)}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
export function PublishedBillingDetail({
  document: doc,
}: {
  document: PublishedBilling;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold capitalize">
        Facturación · {billingMonth(doc.billingPeriod)}
      </h1>
      {doc.fixed && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">
            Plan fijo · {billingMonth(doc.fixed.period)}
          </h2>
          <p className="mt-3 text-xl">{billingUsd(doc.fixed.totalCents)}</p>
          <p className="text-xs text-muted-foreground">IVA incluido</p>
        </section>
      )}
      {doc.variable && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">
            Variables · {billingMonth(doc.variable.period)}
          </h2>
          {doc.variable.lines.map((line, i) => (
            <div
              key={i}
              className="flex justify-between gap-4 border-b py-3 text-sm"
            >
              <span>
                {line.label}
                {line.quantity !== null
                  ? " · " + line.quantity.toLocaleString("es-PY")
                  : ""}
              </span>
              <span>{billingUsd(line.amountCents)}</span>
            </div>
          ))}
          <p className="mt-4 text-right font-semibold">
            IVA incluido · {billingUsd(doc.variable.totalCents)}
          </p>
        </section>
      )}
      {doc.development && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">
            Desarrollo · {billingMonth(doc.development.period)}
          </h2>
          {doc.development.lines.map((line, i) => (
            <div
              key={i}
              className="flex justify-between gap-4 border-b py-3 text-sm"
            >
              <span>
                {line.label} · {line.hours} h
              </span>
              <span>{billingPyg(line.amount)}</span>
            </div>
          ))}
          <p className="mt-4 text-right font-semibold">
            IVA incluido · {billingPyg(doc.development.total)}
          </p>
        </section>
      )}
      <div className="space-y-2 rounded-xl border bg-card p-5 text-xl font-semibold">
        {(doc.fixed || doc.variable) && (
          <p className="flex justify-between">
            <span>Total USD</span>
            <span>{billingUsd(doc.totalUsdCents)}</span>
          </p>
        )}
        {doc.development && (
          <p className="flex justify-between">
            <span>Total Gs.</span>
            <span>{billingPyg(doc.totalPyg)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
