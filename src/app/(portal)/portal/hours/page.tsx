'use client';

import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Clock, DollarSign, TrendingUp, CheckCircle2, Circle, ChevronDown, ChevronRight, Receipt, Sliders } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { monthKeyOf, monthLabelEs, rowDateShort } from '@/lib/hours-month';
import { invoiceRangeLabel, invoiceDateShort } from '@/lib/invoice-period';
import { PortalVariablesBlock, PortalVariableItem, splitVariables } from '@/components/portal/portal-variables-block';

interface HoursTransaction {
 id: string;
 type: 'USAGE' | 'LOAN';
 hours: number;
 note: string | null;
 createdAt: string;
 priceAmount: string | null;
 priceRate: string | null;
 priceCurrency: string | null;
 billedCycleId: string | null;
 // #62 — El ESTADO REAL de facturación de la fila, que lo decide el backend mirando el ciclo al
 // que apunta `billedCycleId`. Reemplaza a `billedCycleId ? 'Facturado' : 'Pendiente'`, que era
 // el mismo bug del KPI: el estampado ocurre al EMITIR y el ciclo nace en BORRADOR, así que
 // tener ciclo NO significa estar facturado. Un movimiento en un borrador sigue pendiente.
 //
 // OPCIONAL a propósito, misma razón que `creditNoteNumber` (ver abajo): front y backend son
 // deploys independientes y el front sube antes. Sin el campo se cae al criterio viejo, que es
 // exactamente lo que la pantalla hacía hasta hoy — nunca a un estado inventado.
 billingState?: BillingState;
 workedOn: string | null;
 // Sólo lo trae la COPIA que genera una nota de crédito con devolución de horas: apunta al
 // movimiento original que quedó acreditado. Null en cualquier registro normal.
 // (El backend ya lo devuelve: el findMany de getMyHours usa `include` sin `select`, así que
 // vienen todos los campos escalares del movimiento.)
 // OJO: sirve para EMPAREJAR original y copia (quién reemplaza a quién), NUNCA para saber si el
 // movimiento está acreditado — para eso está `creditNoteNumber`.
 rebilledFromTransactionId: string | null;
 // #55 — Acreditado sí/no lo decide el BACKEND, no el front.
 //
 // Antes se deducía de la existencia de la fila copia (`rebilledFromTransactionId`), y esa
 // inferencia fallaba por los dos lados: la copia sólo nace si el staff dejó activada la
 // devolución de horas al emitir la nota, y además se puede borrar (es la salida oficial para una
 // nota emitida por error). En los dos casos el cargo acreditado volvía a pintarse "Facturado" al
 // precio completo mientras /portal/invoices ya le mostraba al cliente la nota en negativo.
 // Ahora el backend lo resuelve contra la línea de la nota de crédito, que existe siempre y es
 // única por movimiento.
 //
 // OPCIONALES A PROPÓSITO, aunque el backend actual siempre los mande. `zentik` (Vercel) y
 // `zentik-backend` (Railway) son deploys INDEPENDIENTES, y el backend arranca corriendo
 // `prisma migrate deploy` dentro del container: el front sube minutos antes. En esa ventana
 // /portal/hours responde movimientos SIN estos campos. `api-client` devuelve `response.json()`
 // crudo (sin zod ni defaults), así que el hueco es real en runtime — declararlos obligatorios
 // sólo lograba que el compilador no lo viera. Marcados opcionales, TS obliga a tratar el caso
 // ausente y todo el manejo queda fail-closed: sin dato, la fila se pinta como siempre.
 creditNoteNumber?: string | null;
 // Concepto CONGELADO al emitir la nota de crédito. Sobrevive al borrado de la tarea y es texto
 // seguro para el cliente (a diferencia del `note`, que puede ser jerga interna del staff).
 creditedDescription?: string | null;
 task?: {
  id: string;
  title: string;
  type: 'SUPPORT' | 'PROJECT' | null;
  project?: { id: string; name: string } | null;
 } | null;
}

// #62 — Los tres estados de la plata del cliente.
type BillingState = 'PENDING' | 'INVOICED' | 'PAID';

// Una factura que compone una card. El `amount` es lo que sale DE ESTAS HORAS, no el total del
// documento: es lo que hace que las filas sumen la card. Si la factura además cobra Variables
// (#23), el gran total se ve al abrirla.
interface PortalBucketInvoice {
 id: string;
 invoiceNumber: string;
 kind: 'MONTH' | 'ACCUMULATED';
 periodStart: string;
 periodEnd: string;
 cutoffDate: string | null;
 currency: string;
 /** Fecha de PAGO en la card de Cobrado; de ENVÍO en la de Facturado. */
 date: string | null;
 hours: number;
 amount: string;
}

interface HoursBilling {
 pending: { amount: string };
 invoiced: { amount: string; invoices: PortalBucketInvoice[] };
 paid: { amount: string; invoices: PortalBucketInvoice[] };
}

interface HoursResponse {
 contractedHours: number;
 usedHours: number;
 loanedHours: number;
 availableHours: number;
 percentUsed: number;
 currency: string;
 developmentHourlyRate: string | null;
 supportHourlyRate: string | null;
 totalAmount: number;
 // #62 — OPCIONAL por la ventana de deploy (front en Vercel, backend en Railway: el front sube
 // primero). Sin esto, la pantalla vuelve sola al KPI único de siempre en vez de pintar tres
 // cards en cero, que diría "Cobrado: Gs. 0" a un cliente que sí pagó facturas.
 billing?: HoursBilling;
 transactions: HoursTransaction[];
}

// #23 — statement de variables del portal (solo comerciales, scopeado por cliente).
interface PortalVariableStatement {
 period: string;
 items: PortalVariableItem[];
 total: number;
}

const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Una fila está ACREDITADA cuando el backend le adjuntó el número de su nota de crédito.
//
// `Boolean(...)` y no `!== null`: si el campo NO viene (front desplegado antes que el backend,
// ver la interface), `undefined !== null` es TRUE y TODA la tabla del cliente saldría tachada,
// con badge "Acreditado" en vez de "Facturado"/"Pendiente" y los meses en "0.00h". Falta de dato
// = fila normal.
const isCredited = (t: HoursTransaction): boolean => Boolean(t.creditNoteNumber);

// #62 — Estado de facturación de una fila, con el criterio VIEJO como red de seguridad.
//
// El backend lo manda resuelto (mira el estado del ciclo, no su mera existencia). Si no viene
// —front desplegado antes que el backend— se cae a lo que la pantalla hacía hasta hoy: tener
// ciclo = facturado. Es el comportamiento previo, con su bug del borrador incluido, y dura lo
// que dura el deploy; inventar un estado sería peor.
const billingStateOf = (t: HoursTransaction): BillingState =>
 t.billingState ?? (t.billedCycleId ? 'INVOICED' : 'PENDING');

// #62 — Una de las tres cards de plata.
//
// Las dos que tienen facturas detrás se ABREN (mismo mecanismo, distinta lista). "Pendiente" no
// enlaza a nada a propósito: todavía no existe ninguna factura, y su detalle ya vive en el
// listado de horas de esta misma pantalla.
//
// La leyenda no es decorativa: el número solo no dice si ya se cobró o no, que es justamente lo
// que hoy confunde al cliente.
function BucketCard({
 icon: Icon,
 label,
 legend,
 amount,
 currency,
 tone,
 open,
 onToggle,
}: {
 icon: typeof DollarSign;
 label: string;
 legend: string;
 amount: string;
 currency: string;
 tone: { border: string; icon: string; amount: string };
 open?: boolean;
 onToggle?: () => void;
}) {
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
   <p className={cn('text-2xl font-bold', tone.amount)}>{formatCurrency(amount, currency)}</p>
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

// Las facturas que COMPONEN una card. Cada una enlaza a su detalle en /portal/billing, que ya
// existe: el link lleva ?invoice=<id> y esa página abre sola el acordeón de esa factura.
function BucketInvoices({ title, invoices, dateLabel }: {
 title: string;
 invoices: PortalBucketInvoice[];
 dateLabel: string;
}) {
 return (
  <div className="overflow-hidden rounded-xl border border-border bg-card animate-fade-in">
   <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
    <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{title}</p>
    <p className="text-[11px] text-muted-foreground">
     {invoices.length} {invoices.length === 1 ? 'factura' : 'facturas'}
    </p>
   </div>
   <ul className="divide-y divide-border">
    {invoices.map((inv) => (
     <li key={inv.id}>
      <Link
       href={`/portal/billing?invoice=${inv.id}`}
       className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
      >
       <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
         <span className="font-mono text-sm font-medium text-foreground">{inv.invoiceNumber}</span>
         {inv.kind === 'ACCUMULATED' && <span className="text-[10px] text-muted-foreground">Acumulada</span>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
         {invoiceRangeLabel(inv)}
         {inv.date && ` · ${dateLabel} el ${invoiceDateShort(inv.date)}`}
        </p>
       </div>
       <div className="flex items-center gap-3">
        <div className="text-right">
         <p className="font-mono text-sm font-semibold text-foreground">{formatCurrency(inv.amount, inv.currency)}</p>
         <p className="font-mono text-[11px] text-muted-foreground">{inv.hours.toFixed(2)}h</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
       </div>
      </Link>
     </li>
    ))}
   </ul>
  </div>
 );
}

export default function PortalHoursPage() {
 // #62 — El MISMO gate que usan el sidebar y /portal/billing. Sin él las cards enlazarían a una
 // puerta cerrada: /portal/billing rebota a /portal cuando el cliente no tiene el flag.
 //
 // ⚠️ No alcanza con que el backend haya mandado las facturas. Un usuario DUEÑO de cliente (el
 // que crea `createClientUser`, que sella `Client.userId`) queda con `user.clientId` en null, así
 // que `user.client` le llega null y no ve la sección Facturación aunque su cliente tenga el flag
 // prendido. Es un desfasaje viejo del armado de la sesión, ajeno a #62; acá sólo se respeta.
 const { user } = useAuth();
 const canOpenBilling = user?.client?.portalBillingEnabled === true;
 const [data, setData] = useState<HoursResponse | null>(null);
 const [vars, setVars] = useState<Map<string, PortalVariableStatement>>(new Map());
 const [loading, setLoading] = useState(true);

 const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
 // #62: cuál de las dos cards navegables está abierta (una a la vez; "Pendiente" no se abre).
 const [openBucket, setOpenBucket] = useState<'invoiced' | 'paid' | null>(null);
 // #23: sub-card de variables COLAPSADAS (default = todas abiertas → el consumo se ve al abrir el mes).
 const [collapsedVars, setCollapsedVars] = useState<Set<string>>(new Set());

 // ── Notas de crédito con devolución de horas: por qué el cliente ve DOS filas de un mismo trabajo ──
 //
 // Al emitir una nota de crédito que devuelve las horas al pool facturable, el backend NO borra el
 // movimiento original: lo deja tal cual (conserva su `billedCycleId`, o sea que ya se facturó) y
 // crea una COPIA con `rebilledFromTransactionId` apuntando al original y `billedCycleId` en null,
 // para que el trabajo vuelva a entrar en la próxima factura. Quedan dos filas vivas, un solo trabajo:
 //
 //  - la ORIGINAL → se facturó y después se acreditó: ya NO se le cobra al cliente.
 //  - la COPIA    → es la deuda viva, pendiente de facturar.
 //
 // Se muestran las DOS, pero se tacha la ORIGINAL, que es la que quedó sin efecto. Esconder la copia
 // fue el primer intento y se descartó: dejaba el KPI "Pendiente de facturar" sin ninguna fila que lo
 // respaldara (un cobro fantasma) y hacía que el pendiente del mes quedara corto. La copia, en
 // cambio, se pinta como un registro pendiente cualquiera: para el cliente es simplemente su trabajo
 // por facturar, sin marcas ni vocabulario interno.
 //
 // El acreditado NO se deduce acá: lo dice el backend (`creditNoteNumber`, ver la interface). Cuando
 // se infería desde la existencia de la copia, apagar el switch de devolución de horas o borrar la
 // copia dejaba el cargo acreditado pintado "Facturado" al precio completo mientras
 // /portal/invoices ya le mostraba al cliente la nota en negativo.
 //
 // OJO: "acreditado" y "el trabajo se mudó a otra fila" son DOS COSAS DISTINTAS, y por eso hay dos
 // predicados. La copia es OPCIONAL: sólo nace con "devolver horas al pool" encendido y se puede
 // borrar. Sin copia, lo único que cae es el COBRO (`isCredited` → costo tachado); las HORAS se
 // trabajaron, nadie las devolvió al cupo y siguen contando (`movedToRebill` → false).

 // Índice por id, para poder emparejar una copia con su original (y viceversa).
 //
 // Ojo con el alcance: getMyHours trae sólo los últimos 100 movimientos. Si la copia entró en esa
 // ventana pero su original no (o al revés), el par queda partido: la fila que sobra se muestra
 // sola, con su propia marca de acreditada si la tiene, y sin la frase que la vincula a la otra.
 const txById = useMemo(
  () => new Map((data?.transactions ?? []).map((t) => [t.id, t])),
  [data],
 );

 // Índice INVERSO: id del ORIGINAL → la copia que lo reemplaza, si esa copia sigue viva.
 //
 // Es la única prueba de que el trabajo "se mudó" a otra fila. La copia sólo nace si el staff dejó
 // encendido "devolver horas al pool" al emitir la nota, y además se puede borrar (la salida
 // oficial para una nota emitida por error). Si no está acá, no existe: las horas no se mudaron a
 // ningún lado y tampoco volvieron al cupo (la nota de crédito nunca toca `usedHours`).
 //
 // GLOBAL, no por mes, a propósito: con `workedOn` en null cada fila cae en el mes de su
 // `createdAt`, así que original y copia pueden quedar en meses DISTINTOS. Un índice por mes las
 // daría por separadas y volvería a descontar horas que nadie devolvió.
 const rebilledByOriginalId = useMemo(() => {
  const m = new Map<string, HoursTransaction>();
  for (const t of data?.transactions ?? []) {
   if (t.rebilledFromTransactionId) m.set(t.rebilledFromTransactionId, t);
  }
  return m;
 }, [data]);

 // ¿Las HORAS de esta fila se mudaron a otra? Sólo si está acreditada Y su copia sigue viva.
 //
 // Es lo que separa las dos columnas: el COSTO se tacha con `isCredited` a secas (acreditado =
 // no se cobra, exista o no la copia), pero las HORAS sólo se tachan y se sacan del total si hay
 // otra fila que las esté contando. Si no, la fila quedaría tachada en horas y a la vez sumando
 // en el total del mes: se contradiría con su propio encabezado.
 const movedToRebill = (t: HoursTransaction): boolean =>
  isCredited(t) && rebilledByOriginalId.has(t.id);

 // Final de la cadena de copias: la ÚNICA fila del trabajo que sigue viva (no acreditada), o sea la
 // que de verdad se le va a facturar al cliente.
 //
 // ITERATIVO, no la copia inmediata: con dos notas de crédito sobre el mismo trabajo la cadena es
 // A→B→C, y B también está acreditada y tachada. Mirando sólo un salto, A mandaba al cliente a
 // "el registro de abajo" y ahí leía "no se te cobra" — la frase lo llevaba a una fila que la
 // contradecía. La que se factura es C. Guarda de ciclo por `id` + tope de saltos igual que
 // `conceptOf`: los ids vienen de otro deploy y una cadena corrupta no puede colgar el render.
 const liveRebillOf = (t: HoursTransaction): HoursTransaction | undefined => {
  const seen = new Set<string>([t.id]);
  let node: HoursTransaction | undefined = rebilledByOriginalId.get(t.id);
  for (let hops = 0; node && hops < 10 && !seen.has(node.id); hops++) {
   if (!isCredited(node)) return node;
   seen.add(node.id);
   node = rebilledByOriginalId.get(node.id);
  }
  return undefined;
 };

 // Concepto que se muestra en la columna "Tarea", con una regla dura: el `note` de una fila NUNCA
 // llega al cliente si esa fila nació de una nota de crédito (`rebilledFromTransactionId`), porque
 // el backend la crea con "Re-facturable por NC-…", que es vocabulario del staff. Para esas filas el
 // concepto sale de la tarea, y si la tarea se borró en duro, de la `creditedDescription` congelada
 // al emitir la nota. Si nada de eso existe, '—' antes que filtrar jerga interna.
 const safeConceptOf = (t: HoursTransaction | undefined): string | null => {
  if (!t) return null;
  if (t.task?.title) return t.task.title;
  if (t.rebilledFromTransactionId) return null; // su `note` es interno: no se muestra ni se hereda
  return t.creditedDescription ?? t.note ?? null;
 };

 // Sube por la cadena `rebilledFromTransactionId` hasta el primer concepto seguro.
 //
 // ITERATIVO, no un solo salto: con dos notas de crédito sobre el mismo trabajo la cadena es
 // A→B→C, y mirando sólo al padre inmediato la fila VIVA (C, la que se le va a cobrar) se quedaba
 // con monto y sin concepto ('—'). Guarda de ciclo por `id` + tope de saltos: los ids vienen de
 // otro deploy y una cadena corrupta no puede colgar el render del portal.
 const conceptOf = (t: HoursTransaction): string => {
  const seen = new Set<string>();
  let node: HoursTransaction | undefined = t;
  for (let hops = 0; node && hops < 10 && !seen.has(node.id); hops++) {
   seen.add(node.id);
   const concept = safeConceptOf(node);
   if (concept) return concept;
   const parentId: string | null = node.rebilledFromTransactionId;
   node = parentId ? txById.get(parentId) : undefined;
  }
  return '—';
 };

 // Registros de horas agrupados por mes.
 //
 // Dentro del mes se conserva EL ORDEN DEL BACKEND (createdAt desc) y sólo se corrige la CADENA
 // acreditada→copia: el trabajo se dibuja de arriba hacia abajo, del cargo más viejo al que sigue
 // vivo, como en el mockup aprobado. La copia nace después que el original, así que sin esto el
 // cliente leía primero un cargo vivo sin ningún contexto y la explicación le quedaba colgada de la
 // fila de abajo. No se re-ordena por fecha ni por ningún otro criterio: cambiaría la pantalla de
 // los clientes que no tienen ninguna nota de crédito, que hoy son todos.
 //
 // Se ordena por CADENA COMPLETA y no adelantando el padre inmediato. Con dos notas de crédito
 // sobre el mismo trabajo (A→B→C) adelantar de a un salto empujaba a la raíz al FONDO del mes:
 // entrada [C, B, A] salía [B, C, A]. Acá, en cambio, al toparse con cualquier fila se sube hasta
 // la raíz de su cadena DENTRO del mes y se emite la cadena entera hacia abajo → [A, B, C].
 // Los dos recorridos llevan guarda de ciclo, y al final se fuerza la emisión de la fila: pase lo
 // que pase con los punteros, `ordered` tiene exactamente las mismas filas que `rows`, sin
 // duplicados y sin perder ninguna (una fila perdida acá es plata que el cliente no ve).
 const txsByMonth = useMemo(() => {
  const map = new Map<string, HoursTransaction[]>();
  for (const t of data?.transactions ?? []) {
   const k = monthKeyOf(t);
   const arr = map.get(k);
   if (arr) arr.push(t);
   else map.set(k, [t]);
  }
  for (const [k, rows] of map) {
   const byId = new Map(rows.map((r) => [r.id, r]));
   const seen = new Set<string>();
   const ordered: HoursTransaction[] = [];
   const push = (r: HoursTransaction) => {
    if (seen.has(r.id)) return;
    seen.add(r.id);
    ordered.push(r);
   };
   for (const r of rows) {
    if (seen.has(r.id)) continue;
    // Subir hasta la raíz de la cadena (la fila más vieja del mismo trabajo presente en el mes).
    let root = r;
    const climbed = new Set<string>([r.id]);
    for (;;) {
     const parentId = root.rebilledFromTransactionId;
     if (!parentId || climbed.has(parentId)) break;
     const parent = byId.get(parentId);
     if (!parent) break;
     climbed.add(parentId);
     root = parent;
    }
    // Bajar emitiendo la cadena: raíz → su copia → la copia de la copia…
    let node: HoursTransaction | undefined = root;
    while (node && !seen.has(node.id)) {
     push(node);
     const next = rebilledByOriginalId.get(node.id);
     node = next && byId.has(next.id) ? next : undefined;
    }
    push(r); // red de seguridad: `r` siempre sale, aunque su cadena no lo alcance
   }
   map.set(k, ordered);
  }
  return map;
 }, [data, rebilledByOriginalId]);

 // Meses a mostrar = unión de meses con horas + meses con variables, desc (más reciente primero).
 const monthKeys = useMemo(() => {
  const set = new Set<string>([...txsByMonth.keys(), ...vars.keys()]);
  return [...set].sort((a, b) => b.localeCompare(a));
 }, [txsByMonth, vars]);

 // Default: abrir el mes más reciente cuando llegan los datos.
 useEffect(() => {
  if (monthKeys.length > 0) setOpenMonths(new Set([monthKeys[0]]));
 }, [monthKeys.length]);

 const toggleMonth = (key: string) =>
  setOpenMonths((prev) => {
   const next = new Set(prev);
   if (next.has(key)) next.delete(key);
   else next.add(key);
   return next;
  });

 const toggleVars = (key: string) =>
  setCollapsedVars((prev) => {
   const next = new Set(prev);
   if (next.has(key)) next.delete(key);
   else next.add(key);
   return next;
  });

 useEffect(() => {
  Promise.all([
   api.get<HoursResponse>('/portal/hours'),
   api.get<{ statements: PortalVariableStatement[] }>('/portal/variables').catch(() => ({ data: { statements: [] } })),
  ])
   .then(([hoursRes, varsRes]) => {
    setData(hoursRes.data);
    setVars(new Map((varsRes.data.statements ?? []).map((s) => [s.period, s])));
   })
   .catch((err) => {
    const msg = err instanceof ApiError ? err.message : 'Error al cargar horas';
    toast.error('Error', msg);
   })
   .finally(() => setLoading(false));
 }, []);

 if (loading) {
  return (
   <div className="space-y-6">
    <Skeleton className="h-8 w-64"/>
    {/* Dos filas de cards: las dos de horas + las tres de plata (#62). */}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
     {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl"/>)}
    </div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
     {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl"/>)}
    </div>
    <Skeleton className="h-96 rounded-xl"/>
   </div>
  );
 }

 if (!data) {
  return (
   <div className="py-16 text-center">
    <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50"/>
    <p className="text-muted-foreground">No hay datos disponibles.</p>
   </div>
  );
 }

 return (
  <div className="space-y-6">
   <div>
    <h1 className="text-2xl font-bold tracking-tight text-foreground">Mis horas</h1>
    <p className="mt-1 text-sm text-muted-foreground">
     Detalle de consumo y tiempo registrado por mes.
    </p>
   </div>

   {/* KPI de HORAS */}
   <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div className="rounded-xl border border-border bg-card p-5">
     <div className="flex items-center gap-2 mb-2">
      <TrendingUp className="h-4 w-4 text-success"/>
      <p className="text-xs text-muted-foreground">Disponibles</p>
     </div>
     <p className="text-2xl font-bold text-foreground">{data.availableHours.toFixed(1)}h</p>
     {data.loanedHours > 0 && (
      <p className="text-[11px] text-warning">+{data.loanedHours.toFixed(1)}h en préstamo</p>
     )}
    </div>
    <div className="rounded-xl border border-border bg-card p-5">
     <div className="flex items-center gap-2 mb-2">
      <Clock className="h-4 w-4 text-primary"/>
      <p className="text-xs text-muted-foreground">Consumidas</p>
     </div>
     <p className="text-2xl font-bold text-foreground">{data.usedHours.toFixed(1)}h</p>
     <p className="text-[11px] text-muted-foreground">de {data.contractedHours.toFixed(1)}h contratadas</p>
    </div>
   </div>

   {/* #62 — Los tres estados de la PLATA. Antes había un KPI único ("Total facturable") y el
       cliente no tenía forma de saber si ese número ya se facturó, ya se cobró, o ninguna de las
       dos. Peor: como el filtro miraba si el movimiento tenía ciclo y el ciclo nace en BORRADOR,
       generar un borrador —que el cliente ni ve— le hacía bajar el total sin que existiera
       ninguna factura para él. */}
   {data.billing ? (
    <div className="space-y-3">
     <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <BucketCard
       icon={DollarSign}
       label="Pendiente de facturar"
       legend="trabajo sin facturar aún"
       amount={data.billing.pending.amount}
       currency={data.currency}
       tone={{ border: 'border-primary/30 bg-primary/5', icon: 'text-primary', amount: 'text-primary' }}
      />
      <BucketCard
       icon={Receipt}
       label="Facturado (sin cobrar)"
       legend="ya en una factura enviada"
       amount={data.billing.invoiced.amount}
       currency={data.currency}
       tone={{ border: 'border-info/30 bg-info/5', icon: 'text-info', amount: 'text-info' }}
       open={openBucket === 'invoiced'}
       onToggle={
        canOpenBilling && data.billing.invoiced.invoices.length > 0
         ? () => setOpenBucket((b) => (b === 'invoiced' ? null : 'invoiced'))
         : undefined
       }
      />
      <BucketCard
       icon={CheckCircle2}
       label="Cobrado"
       legend="facturas pagadas"
       amount={data.billing.paid.amount}
       currency={data.currency}
       tone={{ border: 'border-success/30 bg-success/5', icon: 'text-success', amount: 'text-success' }}
       open={openBucket === 'paid'}
       onToggle={
        canOpenBilling && data.billing.paid.invoices.length > 0
         ? () => setOpenBucket((b) => (b === 'paid' ? null : 'paid'))
         : undefined
       }
      />
     </div>
     {openBucket === 'invoiced' && (
      <BucketInvoices
       title="Facturas enviadas, todavía sin cobrar"
       invoices={data.billing.invoiced.invoices}
       dateLabel="Enviada"
      />
     )}
     {openBucket === 'paid' && (
      <BucketInvoices title="Facturas pagadas" invoices={data.billing.paid.invoices} dateLabel="Pagada" />
     )}
    </div>
   ) : (
    /* Backend anterior a #62 (ventana de deploy): el KPI único de siempre, tal cual estaba. */
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
     <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
      <div className="flex items-center gap-2 mb-2">
       <DollarSign className="h-4 w-4 text-primary"/>
       <p className="text-xs text-muted-foreground">Total facturable</p>
      </div>
      <p className="text-2xl font-bold text-primary">
       {formatCurrency(data.totalAmount, data.currency)}
      </p>
      <p className="text-[11px] text-muted-foreground">Pendiente de facturar</p>
     </div>
    </div>
   )}

   {/* Acordeón por mes: consumo (variables) + registros de horas */}
   {monthKeys.length === 0 ? (
    <div className="rounded-xl border border-border bg-card py-12 text-center">
     <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50"/>
     <p className="text-sm text-muted-foreground">No hay registros aún</p>
    </div>
   ) : (
    <div className="space-y-3">
     {monthKeys.map((key) => {
      const txs = txsByMonth.get(key) ?? [];
      const statement = vars.get(key);
      const open = openMonths.has(key);
      const varsOpen = !collapsedVars.has(key);
      // Las horas de una fila acreditada se descuentan SÓLO si existe la copia viva que las
      // representa: contar las dos mostraría 10h sobre un trabajo de 5h.
      //
      // Sin copia (el staff apagó "devolver horas al pool", o la copia se borró) las horas no se
      // mudaron a ninguna otra fila. Descontarlas igual las hacía DESAPARECER: la misma pantalla
      // decía "Consumidas 5.0h de 100.0h" arriba y "1 registro · 0.00h" en el mes. Tampoco vuelven
      // al cupo — la nota de crédito no toca `usedHours` —, así que esas horas se trabajaron, se
      // consumieron y siguen contando. Lo que la nota borra es el COBRO, no el tiempo.
      const monthHours = txs.reduce((s, t) => (movedToRebill(t) ? s : s + t.hours), 0);
      // El pendiente del mes tiene que usar EL MISMO criterio que la card de arriba, o el total de
      // la página y el de cada mes se contradicen. Por eso mira `billingStateOf` y no
      // `billedCycleId === null`: con el estampado al emitir, un movimiento en un BORRADOR tiene
      // ciclo y sigue pendiente — era el mismo bug de #62, replicado acá abajo.
      //
      // La cadena de la nota de crédito sigue saliendo bien sola: la original quedó facturada (o
      // cobrada) y la copia nace sin ciclo, así que sólo la copia cuenta como pendiente.
      const monthPending = txs
       .filter((t) => t.priceAmount !== null && billingStateOf(t) === 'PENDING')
       .reduce((s, t) => s + parseFloat(t.priceAmount!), 0);
      const varsTotal = statement ? splitVariables(statement.items).total : 0;
      return (
       <div key={key} className="rounded-xl border border-border bg-card overflow-hidden">
        <button
         type="button"
         onClick={() => toggleMonth(key)}
         aria-expanded={open}
         className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/30"
        >
         <div className="flex items-center gap-3">
          <ChevronDown
           className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
          />
          <div>
           <p className="text-sm font-semibold text-foreground">{monthLabelEs(key)}</p>
           <p className="text-[11px] text-muted-foreground">
            {txs.length} {txs.length === 1 ? 'registro' : 'registros'} · {monthHours.toFixed(2)}h
            {statement && ` · ${statement.items.length} variable(s)`}
           </p>
          </div>
         </div>
         <div className="flex items-center gap-4 text-right">
          {varsTotal > 0 && (
           <div>
            <p className="font-mono text-sm font-semibold text-foreground">{fmtUSD(varsTotal)}</p>
            <p className="text-[10px] text-muted-foreground">consumo</p>
           </div>
          )}
          {monthPending > 0 && (
           <div>
            <p className="font-mono text-sm font-semibold text-primary">
             {formatCurrency(monthPending, data.currency)}
            </p>
            <p className="text-[10px] text-muted-foreground">pendiente</p>
           </div>
          )}
         </div>
        </button>

        {open && (
         <div className="border-t border-border animate-fade-in">
          {/* #23 — Sub-card de consumo (variables) PRIMERO, colapsable hacia abajo */}
          {statement && statement.items.length > 0 && (
           <div className="border-b border-border bg-muted/10 px-4 py-3">
            <button
             type="button"
             onClick={() => toggleVars(key)}
             aria-expanded={varsOpen}
             className="flex w-full items-center gap-2 text-left"
            >
             <ChevronDown
              className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200', varsOpen && 'rotate-180')}
             />
             <Sliders className="h-3.5 w-3.5 text-primary" />
             <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Consumo del período</span>
             <span className="ml-auto font-mono text-xs font-semibold text-foreground">{fmtUSD(varsTotal)}</span>
            </button>
            {varsOpen && (
             <div className="mt-3">
              <PortalVariablesBlock items={statement.items} />
             </div>
            )}
           </div>
          )}

          {/* Registros de horas */}
          {txs.length > 0 ? (
           <div className="overflow-x-auto">
            <table className="w-full text-sm">
             <thead className="bg-muted/30 text-xs">
              <tr>
               <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Fecha</th>
               <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tarea</th>
               <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tipo</th>
               <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Horas</th>
               <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Estado</th>
               <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Costo</th>
              </tr>
             </thead>
             <tbody className="divide-y divide-border">
              {txs.map((t, idx) => {
               // Fila ACREDITADA = el backend le adjuntó el número de su nota de crédito.
               // Manda sobre el COSTO: acreditado = no se cobra.
               const credited = isCredited(t);
               // ¿Este trabajo se vuelve a facturar en otra fila (la copia)? Manda sobre las HORAS:
               // sólo se tachan si otra fila las está contando (ver `movedToRebill`).
               const moved = movedToRebill(t);
               // Posición REAL en el mes ya ordenado de la fila que SÍ se factura. La frase manda al
               // cliente a mirar "abajo", así que sólo puede salir si esa fila está efectivamente MÁS
               // ABAJO: con la copia en otro mes apuntaba a la nada.
               // Se apunta al FINAL de la cadena (`liveRebillOf`), no a la copia inmediata: en una
               // cadena de dos notas la copia inmediata también está acreditada y tachada, y la frase
               // terminaba mandando al cliente a una fila que le dice "no se te cobra".
               const rebilledRow = credited ? liveRebillOf(t) : undefined;
               const rebilledIsBelow = rebilledRow ? txs.indexOf(rebilledRow) > idx : false;
               // La fila viva: dice de dónde viene, para que no parezca un cargo nuevo.
               const replacesRow = t.rebilledFromTransactionId ? txById.get(t.rebilledFromTransactionId) : undefined;
               const costLabel = formatCurrency(t.priceAmount, t.priceCurrency ?? data.currency);
               return (
               <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{rowDateShort(t)}</td>
                <td className="px-4 py-3">
                 <p className="text-sm text-foreground truncate max-w-xs">
                  {conceptOf(t)}
                 </p>
                 {t.task?.project && (
                  <p className="text-[11px] text-muted-foreground">{t.task.project.name}</p>
                 )}
                 {/* Explicación en el idioma del cliente: se le facturó, se le acreditó, no se le cobra.
                     Nunca "espejo" ni "re-facturable" — eso es vocabulario del staff. */}
                 {credited && (
                  <p className="text-[11px] text-muted-foreground">
                   {`Acreditado por ${t.creditNoteNumber} — no se te cobra`}
                   {rebilledIsBelow && '. El mismo trabajo se factura en el registro de abajo'}
                   {/* Sin copia, las horas no se mudaron a ningún lado y tampoco volvieron a tu
                       cupo: siguen sumando en el total del mes aunque el cargo esté acreditado.
                       Decirlo evita que la fila se contradiga con su propio encabezado. */}
                   {!moved && '. Las horas trabajadas siguen contando en tu consumo'}
                  </p>
                 )}
                 {/* La fila viva, sola, es idéntica en fecha, concepto y monto a la de arriba: sin
                     esta línea se lee como un segundo cobro del mismo trabajo. */}
                 {!credited && replacesRow?.creditNoteNumber && (
                  <p className="text-[11px] text-muted-foreground">
                   {`Reemplaza al cargo acreditado por ${replacesRow.creditNoteNumber}`}
                  </p>
                 )}
                </td>
                <td className="px-4 py-3">
                 {t.task?.type === 'SUPPORT' && (
                  <Badge className="bg-warning/15 text-warning text-[10px]">Soporte</Badge>
                 )}
                 {t.task?.type === 'PROJECT' && (
                  <Badge className="bg-info/10 text-info text-[10px]">Desarrollo</Badge>
                 )}
                 {!t.task?.type && <span className="text-xs text-muted-foreground">—</span>}
                </td>
                {/* Horas y costo TACHADOS cuando ya no cuentan, con criterios DISTINTOS a propósito:
                    el costo se tacha si la fila está acreditada (no se cobra, punto), y las horas
                    sólo si además existe la copia que las cuenta. Tachar horas que igual suman en
                    el total del mes era contradecir el encabezado del propio mes.
                    Se siguen viendo (el cliente tiene derecho a ver qué se le acreditó).
                    El tachado va en <del>, que los lectores de pantalla anuncian como supresión:
                    `line-through` es decoración CSS y no se anuncia, y el `title` no se dispara en
                    táctil — que es donde el cliente abre el portal. Sin esto, quien no ve el tachado
                    lee dos veces las mismas horas y el mismo importe y entiende que le cobran doble,
                    justo el bug que esto vino a arreglar. El texto explícito va en un sr-only; el
                    `title` queda como extra, nunca como único portador del mensaje.
                    Se atenúa con `text-muted-foreground` (token con contraste garantizado) en vez de
                    `opacity-50` sobre `text-foreground`, que bajaba el contraste real por debajo del
                    mínimo legible. */}
                <td
                 className="px-4 py-3 text-right font-mono text-sm text-foreground"
                 title={moved ? `${t.hours.toFixed(2)}h acreditadas — no se te cobran` : undefined}
                >
                 {moved ? (
                  <>
                   <del className="line-through text-muted-foreground">{t.hours.toFixed(2)}h</del>
                   <span className="sr-only">{` ${t.hours.toFixed(2)}h acreditadas — no se te cobran`}</span>
                  </>
                 ) : (
                  `${t.hours.toFixed(2)}h`
                 )}
                </td>
                {/* #62 — Tres estados, los MISMOS que las cards de arriba: si la card dice
                    "Cobrado", el cliente tiene que poder ver qué filas la componen. Y "Facturado"
                    ya no sale de tener `billedCycleId`: un movimiento estampado en un BORRADOR
                    sigue Pendiente, que es el bug que #62 vino a arreglar. */}
                <td className="px-4 py-3">
                 {credited ? (
                  <Badge className="inline-flex items-center gap-1 bg-muted text-muted-foreground text-[10px]">
                   <CheckCircle2 className="h-3 w-3" /> Acreditado
                  </Badge>
                 ) : billingStateOf(t) === 'PAID' ? (
                  <Badge className="inline-flex items-center gap-1 bg-success/15 text-success text-[10px]">
                   <CheckCircle2 className="h-3 w-3" /> Cobrado
                  </Badge>
                 ) : billingStateOf(t) === 'INVOICED' ? (
                  <Badge className="inline-flex items-center gap-1 bg-info/10 text-info text-[10px]">
                   <Receipt className="h-3 w-3" /> Facturado
                  </Badge>
                 ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                   <Circle className="h-3 w-3" /> Pendiente
                  </span>
                 )}
                </td>
                <td
                 className="px-4 py-3 text-right font-mono text-sm font-semibold text-foreground"
                 title={
                  credited && t.priceAmount !== null
                   ? `${costLabel} acreditados — no se te cobran`
                   : undefined
                 }
                >
                 {credited ? (
                  <>
                   <del className="line-through text-muted-foreground">{costLabel}</del>
                   <span className="sr-only">{` ${costLabel} acreditados — no se te cobran`}</span>
                  </>
                 ) : (
                  costLabel
                 )}
                </td>
               </tr>
               );
              })}
             </tbody>
            </table>
           </div>
          ) : (
           <p className="px-5 py-4 text-xs text-muted-foreground">Sin registros de horas en este mes.</p>
          )}
         </div>
        )}
       </div>
      );
     })}
    </div>
   )}

   <p className="text-[11px] text-muted-foreground italic">
    Acá podés ver el consumo del período y el detalle del tiempo que el equipo dedicó a tus proyectos.
   </p>
  </div>
 );
}
