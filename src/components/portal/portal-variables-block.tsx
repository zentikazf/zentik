'use client';

// #23 — Bloque de variables (consumo Botmaker) para el portal del cliente. Separa VISUALMENTE el
// "Fee fijo" (ítem con label FEE) del resto del "Consumo" — se guarda igual, solo se discrimina al mostrar.
// Sin IVA. Montos en USD. Reusable en /portal/hours (sub-card por mes) y /portal/billing.

export interface PortalVariableItem {
  label: string;
  commercialValue: number;
}

const fmtUSD = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const isFee = (label: string) => label.trim().toUpperCase() === 'FEE';

export function splitVariables(items: PortalVariableItem[]) {
  const fee = items.filter((i) => isFee(i.label));
  const consumo = items.filter((i) => !isFee(i.label));
  const subtotalConsumo = round2(consumo.reduce((s, i) => s + i.commercialValue, 0));
  const subtotalFee = round2(fee.reduce((s, i) => s + i.commercialValue, 0));
  return { consumo, fee, subtotalConsumo, subtotalFee, total: round2(subtotalConsumo + subtotalFee) };
}

export function PortalVariablesBlock({ items }: { items: PortalVariableItem[] }) {
  const { consumo, fee, subtotalConsumo, subtotalFee, total } = splitVariables(items);

  return (
    <div className="space-y-4">
      {/* Consumo (todo menos el fee) */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-medium">Consumo</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {consumo.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-4 text-center text-xs text-muted-foreground">
                  Sin consumo en el período.
                </td>
              </tr>
            ) : (
              consumo.map((p, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs">{p.label}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmtUSD(p.commercialValue)}</td>
                </tr>
              ))
            )}
            <tr className="border-t-2 border-border bg-muted/30">
              <td className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Subtotal consumo
              </td>
              <td className="px-4 py-2.5 text-right font-mono font-medium">{fmtUSD(subtotalConsumo)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Fee fijo — siempre separado */}
      {fee.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Fee fijo</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {fee.map((p, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs">{p.label}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmtUSD(p.commercialValue)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-muted/30">
                <td className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Subtotal fee
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-medium">{fmtUSD(subtotalFee)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Total del período (sin IVA) */}
      <div className="flex items-baseline justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total del período</span>
        <span className="font-mono text-lg font-semibold text-foreground">{fmtUSD(total)}</span>
      </div>
    </div>
  );
}
