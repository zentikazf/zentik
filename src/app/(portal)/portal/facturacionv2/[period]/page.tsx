"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import {
  PublishedBillingDetail,
  type PublishedMonth,
} from "@/components/portal/published-billing-v2";
export default function PublishedMonthPage() {
  const { period } = useParams<{ period: string }>();
  const [month, setMonth] = useState<PublishedMonth | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setMonth(null);
    setError("");
    api
      .get<PublishedMonth[]>("/portal/billing-v2/" + encodeURIComponent(period))
      .then((response) => {
        if (active) {
          if (response.data[0]) setMonth(response.data[0]);
          else setError("Este mes no está disponible.");
        }
      })
      .catch(() => {
        if (active) setError("Este mes no está disponible.");
      });
    return () => {
      active = false;
    };
  }, [period]);
  return (
    <div className="space-y-6">
      <Link href="/portal/billing" className="text-sm text-muted-foreground">
        ← Volver a facturación
      </Link>
      {error ? (
        <p role="alert">{error}</p>
      ) : month ? (
        <PublishedBillingDetail document={month.document} />
      ) : (
        <p role="status">Cargando facturación…</p>
      )}
    </div>
  );
}
