'use client';

import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { taxLabel } from '@/lib/tax';

// #72 A4.1 — Extraído de `app/(portal)/portal/hours/page.tsx`, donde nació con #62. Lo usan las
// DOS pantallas: la del cliente (portal) y la de tiempos del staff.
//
// Se comparte el COMPONENTE, no los números: cada pantalla trae los suyos y miden cosas distintas
// a propósito (el staff, cuánto puede facturar; el cliente, cuánto va a pagar). Por eso la
// `legend` es una prop y no está cableada adentro — es donde cada pantalla declara qué está
// midiendo, que es lo único que vuelve legible que los dos números difieran.

// #63 — La etiqueta de IVA de un monto. `null` no dibuja nada: los documentos anteriores a #63 no
// llevan etiqueta en vez de heredar una que nunca tuvieron.
export function TaxTag({ taxMode, className }: { taxMode: string | null | undefined; className?: string }) {
  const label = taxLabel(taxMode);
  if (!label) return null;
  return (
    <span className={cn('shrink-0 text-[10px] font-medium text-muted-foreground', className)}>{label}</span>
  );
}

/** Paleta de una card. Se pasa entera para que cada pantalla elija el tono sin que el componente
 *  tenga que conocer los buckets por nombre. */
export interface BucketTone {
  border: string;
  icon: string;
  amount: string;
}

export interface BucketCardProps {
  icon: LucideIcon;
  label: string;
  /** La leyenda NO es decorativa: el número solo no dice si ya se cobró o no, y es donde cada
   *  pantalla declara QUÉ está midiendo. */
  legend: string;
  amount: string;
  currency: string;
  tone: BucketTone;
  open?: boolean;
  /** Sin `onToggle` la card no se abre: se renderiza como un div y no invita al click. */
  onToggle?: () => void;
  // #63 — Lo pasa sólo la card de Pendiente, con el modo del CLIENTE. Facturado y Cobrado NO se
  // etiquetan: son agregados de varias facturas que pueden tener modos distintos entre sí (y
  // alguna sin ninguno), así que una sola etiqueta arriba mentiría sobre parte de lo que suma. La
  // etiqueta de esas dos va POR FACTURA, en la lista que se abre.
  taxMode?: string | null;
}

// #62 — Una de las tres cards de plata.
//
// Las que tienen facturas detrás se ABREN (mismo mecanismo, distinta lista). "Pendiente" no
// enlaza a nada a propósito: todavía no existe ninguna factura.
export function BucketCard({
  icon: Icon,
  label,
  legend,
  amount,
  currency,
  tone,
  open,
  onToggle,
  taxMode,
}: BucketCardProps) {
  const body = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4 shrink-0', tone.icon)} />
        <p className="text-xs text-muted-foreground">{label}</p>
        {onToggle && (
          <ChevronDown
            className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
          />
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className={cn('text-2xl font-bold', tone.amount)}>{formatCurrency(amount, currency)}</p>
        <TaxTag taxMode={taxMode} />
      </div>
      <p className="text-[11px] text-muted-foreground">{legend}</p>
    </>
  );
  const shell = cn('rounded-xl border p-5 text-left', tone.border);
  return onToggle ? (
    <button type="button" onClick={onToggle} aria-expanded={open} className={cn(shell, 'w-full transition-colors hover:bg-muted/30')}>
      {body}
    </button>
  ) : (
    <div className={shell}>{body}</div>
  );
}
