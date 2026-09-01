'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Building,
  ArrowLeft,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  Pencil,
  Lock,
  DollarSign,
  CalendarRange,
  Info,
  X,
  type LucideIcon,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { monthKeyOf, monthLabelEs, rowDateShort, dayKeyOf } from '@/lib/hours-month';

interface HoursTransaction {
  id: string;
  type: string;
  hours: number;
  note: string | null;
  createdAt: string;
  // Fecha REAL de trabajo (la que se anota al cargar la hora) y, desde H8a, la que corta la
  // facturación. Es NULL por diseño en las PURCHASE (una compra de horas no tiene día trabajado),
  // por eso toda la pantalla usa la "fecha efectiva" = workedOn con fallback a createdAt.
  // El dato ya viajaba del backend; acá solo faltaba declararlo, y por eso el staff venía
  // mostrando createdAt (fecha de CARGA) mientras el portal del cliente mostraba workedOn.
  workedOn: string | null;
  priceAmount: string | null;
  priceRate: string | null;
  priceCurrency: string | null;
  billedCycleId: string | null;
  // H9b: si NO es null, esta fila es la ESPEJO que generó una nota de crédito con devolución de
  // horas a facturable. La espejo repite type, hours, priceAmount y workedOn del original, y el
  // original NO se borra: las dos caen en el mismo mes aunque el cupo se movió UNA sola vez. Se
  // muestran las dos (el ledger tiene que ser auditable) pero sólo una suma en los totales.
  rebilledFromTransactionId: string | null;
  task?: { id: string; title: string; type?: 'SUPPORT' | 'PROJECT' | null; project?: { id: string; name: string } } | null;
}

interface HoursSummary {
  contractedHours: number;
  usedHours: number;
  loanedHours: number;
  availableHours: number;
  developmentHourlyRate: number | null;
  supportHourlyRate: number | null;
  currency: string;
  totalAmount: number;
  transactions: HoursTransaction[];
  transactionsTotal: number;
  page: number;
  limit: number;
}

interface ClientHeader {
  id: string;
  name: string;
  email?: string;
  contractedHours: number;
  usedHours: number;
}

// Las cards por mes agrupan EN EL CLIENTE, así que necesitan el ledger completo en una sola
// respuesta: agrupar sobre una página parcial daría totales que mienten (la card mostraría solo
// la porción del mes que cayó en esa página). El backend capea el limit en 500 — si algún cliente
// se acercara a ese techo hay que pasar a paginación POR MES agrupada en SQL, no subir el número.
//
// OJO: esto es lo que la pantalla PIDE, NO el techo. El techo real vive en el backend
// (`HOURS_SUMMARY_MAX_LIMIT` en client.service.ts) y capea este pedido: subir este número acá no
// sube el techo, solo pide de más. Por eso el umbral de aviso NO se deriva de esta constante
// (ver `umbralDeAviso` abajo).
const HOURS_FETCH_LIMIT = 500;

// #56: umbral de aviso preventivo (80%). Se DERIVA del techo, nunca es un literal suelto: si el
// techo se mueve, el umbral lo sigue solo. La entrada es el `limit` EFECTIVO que devuelve la
// respuesta — el backend ya lo capeó contra su propio techo — y no `HOURS_FETCH_LIMIT`, que es
// apenas lo que esta pantalla pide. Derivarlo del pedido dejaba un hueco silencioso: subiendo solo
// `HOURS_FETCH_LIMIT` a 2000 el backend igual devuelve 500, un cliente con 450 movimientos no
// trunca (450 filas de 450) y el umbral pasa a 1600, así que el aviso NO aparece estando al 90%
// del techo real. Con el limit de la RESPUESTA, el umbral sigue al techo aunque alguien toque el
// pedido.
const umbralDeAviso = (techoEfectivo: number) => Math.floor(techoEfectivo * 0.8);

type MovementFilter = 'ACUMULADAS' | 'DESCUENTO' | null;

const MOVEMENT_FILTERS: { label: string; value: MovementFilter }[] = [
  { label: 'Todas', value: null },
  { label: 'Acumuladas', value: 'ACUMULADAS' },
  { label: 'Descuento', value: 'DESCUENTO' },
];

const TYPE_LABELS: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  PURCHASE: { label: 'Compra', color: 'text-success', icon: ArrowUpRight },
  USAGE: { label: 'Uso', color: 'text-primary', icon: ArrowDownRight },
  LOAN: { label: 'Prestamo', color: 'text-warning', icon: AlertTriangle },
  REFUND: { label: 'Reembolso', color: 'text-info', icon: ArrowUpRight },
  INTERNAL: { label: 'Interno', color: 'text-muted-foreground', icon: Clock },
};

// SIGNO DE LA FILA: qué carácter se pinta al lado de las horas. INTERNAL se pinta con "−" porque
// es tiempo consumido por el equipo. Esto NO define en qué total del header entra el movimiento.
const esCredito = (type: string) => type === 'PURCHASE' || type === 'REFUND';

// BUCKET DEL HEADER: qué mueve realmente el CUPO del cliente, que es lo que el header afirma.
// Deliberadamente separado del signo de la fila, porque son dos preguntas distintas:
//  - "acumuladas" = PURCHASE|REFUND y "descuento" = USAGE|LOAN son los buckets del backend
//    (MOVEMENT_BUCKETS en client.service.ts) — los mismos que aplican las píldoras de filtro.
//  - INTERNAL no pertenece a ninguno: `recordHoursUsage` crea la fila sin tocar `usedHours` ni
//    `loanedHours` y sin precio. Meterlo en "descuento" hacía que la card afirmara un consumo de
//    cupo que nunca ocurrió, y que el MISMO mes mostrara un número con "Todas" y otro con
//    "Descuento". Va como tercer número neutro y explícito ("internas").
type HeaderBucket = 'ACUMULADA' | 'DESCUENTO' | 'INTERNA';
const bucketDeHeader = (type: string): HeaderBucket => {
  if (type === 'PURCHASE' || type === 'REFUND') return 'ACUMULADA';
  if (type === 'USAGE' || type === 'LOAN') return 'DESCUENTO';
  return 'INTERNA';
};

// Las horas se persisten con 4 decimales (`parseFloat((durationMinutes / 60).toFixed(4))`) pero cada
// fila se muestra con 2. El header acumula sobre el valor YA redondeado para que sea literalmente la
// suma de las celdas visibles: tres cargas de 25' (0.4167 c/u) se ven como −0.42h y el header dice
// −1.26h, no −1.25h.
//
// Se redondea con `toFixed(2)` y NO con `Math.round(n * 100) / 100`: la celda pinta
// `tx.hours.toFixed(2)`, y los dos métodos difieren cuando el 3er decimal es 5 (multiplicar por 100
// arrastra error de punto flotante hacia arriba mientras `toFixed` lee el double hacia abajo: 2.505
// da 2.51 contra 2.50). Por el camino automático no pasa —los time entries dan minutos enteros— pero
// la carga MANUAL acepta cualquier decimal. Usar la MISMA función que pinta la celda hace que el
// header cuadre por construcción, no por aproximación.
const r2 = (n: number) => Number(n.toFixed(2));

// Hermano de `r2` para la columna COSTO, que es la otra mitad del header y sufría exactamente el
// mismo problema: el header acumulaba `Number(tx.priceAmount)` CRUDO y formateaba UNA sola vez al
// final, mientras cada celda formatea (y por lo tanto redondea) individualmente. `formatCurrency`
// fuerza `maximumFractionDigits: 0` para TODA moneda (ver src/lib/utils.ts), así que cada fila ya se
// ve redondeada a entero antes de que el usuario pueda sumarla con la vista: tres filas de 18751.5 Gs
// se pintan "Gs. 18.752" c/u (suma visible 56.256) contra un header que decía "Gs. 56.255". En
// guaraníes el desvío es de unos pocos; en USD deja de ser cosmético (tres filas de 16.67 pintan
// "USD 17" c/u ⇒ 51 visible contra un header de "USD 50", y un mes de 20 filas se va 10 USD).
//
// `Math.round` coincide BYTE A BYTE con lo que pinta la celda: Intl redondea con halfExpand y
// `priceAmount` es siempre >= 0, así que half-up y half-away-from-zero son la misma cosa acá. Igual
// que con `r2`, el header cuadra por construcción y no por aproximación.
//
// CONSECUENCIA ACEPTADA: esto puede separar el header de la card del KPI "Total facturable" del
// cartel de arriba en unos pocos guaraníes. Está bien, porque son DOS PROMESAS DISTINTAS: el cartel
// ya está rotulado como histórico y no filtrado (lo calcula el backend sobre todo el ledger, sin
// pasar por estas celdas), mientras que el header de la card promete cuadrar con SUS filas visibles.
// Cuando las dos promesas chocan, manda la regla anti-mentira de la card.
const rMoneda = (n: number) => Math.round(n);

interface MonthGroup {
  key: string;
  txs: HoursTransaction[];
  creditos: number;
  debitos: number;
  internas: number;
  // Cuántas de las filas de `txs` son ESPEJO de una nota de crédito: se renderizan pero NO entran en
  // ningún total de arriba. El header lo declara para no invitar a leer "estos N registros producen
  // estos números" cuando algunos no producen ninguno.
  espejos: number;
  // Costo desglosado POR MONEDA: `priceCurrency` queda congelada por fila y la moneda del cliente es
  // editable, así que un mes puede mezclar monedas y no existe un único importe honesto.
  costos: [string, number][];
}

export default function ClientTiempoPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { orgId } = useOrg();
  const { hasPermission } = usePermissions();
  const canEditHours = hasPermission('manage:projects');

  const [client, setClient] = useState<ClientHeader | null>(null);
  const [hours, setHours] = useState<HoursSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingHours, setLoadingHours] = useState(false);
  const [movementFilter, setMovementFilter] = useState<MovementFilter>(null);

  // Rango de fechas (client-side, sobre la fecha efectiva). Convive con el filtro de movimiento,
  // que es SERVER-SIDE (re-fetch con ?movement=): los dos pueden estar activos a la vez.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Meses desplegados del acordeón.
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  // Add hours dialog
  const [showAddHours, setShowAddHours] = useState(false);
  const [hoursForm, setHoursForm] = useState({ hours: '', note: '' });
  const [savingHours, setSavingHours] = useState(false);

  // Delete hours transaction
  // `esEspejo` viaja en el state porque el borrado del backend es ASIMÉTRICO (#54): la fila espejo
  // de una NC se borra con soft-delete + auditoría y NO revierte el cupo del cliente (nunca lo movió),
  // mientras que el resto de las filas sí lo revierten. Sin este dato el diálogo no puede bifurcar
  // los textos y le prometería al admin una reversión de horas que no va a ocurrir.
  const [deleteTxConfirm, setDeleteTxConfirm] = useState<{ id: string; type: string; hours: number; note: string | null; esEspejo: boolean } | null>(null);
  const [deleteTxReason, setDeleteTxReason] = useState('');
  const [deletingTx, setDeletingTx] = useState(false);

  // Edit hours transaction (solo USAGE/LOAN, gateado por manage:projects)
  const [editTxConfirm, setEditTxConfirm] = useState<HoursTransaction | null>(null);
  const [editTxHours, setEditTxHours] = useState('');
  const [editTxRate, setEditTxRate] = useState('');
  const [editingTx, setEditingTx] = useState(false);

  const loadClient = useCallback(async () => {
    if (!orgId || !clientId) return;
    try {
      const res = await api.get<ClientHeader>(`/organizations/${orgId}/clients/${clientId}`);
      setClient(res.data);
    } catch {
      toast.error('Error', 'No se pudo cargar el cliente');
    } finally {
      setLoading(false);
    }
  }, [orgId, clientId]);

  const loadHours = useCallback(
    async (movement: MovementFilter) => {
      if (!orgId || !clientId) return;
      setLoadingHours(true);
      try {
        // Sin `page`: se pide el ledger completo de una y el corte por mes lo hace la UI.
        const qs = new URLSearchParams({ limit: String(HOURS_FETCH_LIMIT) });
        if (movement) qs.set('movement', movement);
        const res = await api.get<HoursSummary>(
          `/organizations/${orgId}/clients/${clientId}/hours?${qs.toString()}`,
        );
        setHours(res.data);
      } catch {
        toast.error('Error', 'No se pudieron cargar las horas');
      } finally {
        setLoadingHours(false);
      }
    },
    [orgId, clientId],
  );

  useEffect(() => {
    if (orgId && clientId) {
      loadClient();
      loadHours(movementFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, clientId]);

  const allTxs = useMemo(() => hours?.transactions ?? [], [hours]);
  const currency = hours?.currency ?? 'PYG';

  // Defensa en profundidad: hoy el limit de 500 cubre de sobra el ledger de cualquier cliente, así
  // que esto no se activa. Si algún día se activara, la UI tiene que DECIRLO en vez de mostrar
  // callada un mes al que le faltan filas.
  //
  // El aviso es GLOBAL a propósito, no un badge en "el mes parcial": el backend trunca por
  // `createdAt` desc (fecha de CARGA) pero la agrupación es por fecha EFECTIVA (`workedOn`). Una
  // carga retroactiva (workedOn viejo, createdAt reciente) hace que el mes más antiguo recibido
  // esté COMPLETO mientras el mes realmente cortado queda sin marcar — señalar el mes equivocado es
  // peor que no señalar ninguno. Bajo truncado, ningún total mensual es confiable.
  const truncated = hours != null && hours.transactionsTotal > allTxs.length;

  // Techo REAL de la respuesta: el backend capea el `limit` pedido contra `HOURS_SUMMARY_MAX_LIMIT`
  // y devuelve el valor ya capeado. La constante local queda SOLO como fallback defensivo por si la
  // respuesta no lo trae (o trae algo no usable), nunca como fuente del umbral.
  const techoEfectivo =
    typeof hours?.limit === 'number' && hours.limit > 0 ? hours.limit : HOURS_FETCH_LIMIT;

  // #56: aviso PREVENTIVO — todavía funciona todo y los totales son correctos, pero el ledger de
  // este cliente se está acercando al techo. Es EXCLUYENTE con el de truncado: bajo truncado ya se
  // está perdiendo información, ese aviso es más grave y este sería ruido al lado.
  //
  // `transactionsTotal` es el conteo DE ESTA VISTA: con una píldora de movimiento activa el backend
  // cuenta con el mismo `where.type` que filtra las filas, así que no es "lo que tiene el cliente"
  // sino lo que tiene el bucket elegido. Por eso el aviso se redacta en términos de la vista. NO se
  // pide un conteo total aparte a propósito: sería una query extra en el camino caliente de una
  // pantalla que se abre para facturar, y el aviso igual cumple su función (sin filtro —el estado
  // por defecto al abrir— la vista ES el ledger completo).
  const nearCeiling =
    hours != null && !truncated && hours.transactionsTotal > umbralDeAviso(techoEfectivo);

  const rangeActive = dateFrom !== '' || dateTo !== '';

  // Filtro de rango sobre la FECHA EFECTIVA. Los inputs son date-only, por eso se compara la clave
  // 'YYYY-MM-DD' como string: construir un Date desde un ISO con hora y compararlo contra un
  // date-only corre un día según la zona horaria.
  const filteredTxs = useMemo(() => {
    if (!rangeActive) return allTxs;
    return allTxs.filter((tx) => {
      const d = dayKeyOf(tx);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [allTxs, dateFrom, dateTo, rangeActive]);

  // Agrupación por mes de fecha efectiva + totales de cada card.
  //
  // REGLA ANTI-MENTIRA: todo número del header sale de `filteredTxs`, o sea de las filas que el
  // usuario ve al desplegar esa card. Con un rango activo el header refleja lo filtrado, no el mes
  // completo. Un header que no cuadra con sus filas es un bug grave acá.
  //
  // La regla tiene DOS excepciones deliberadas, y las dos se DECLARAN en la UI (no se aplican en
  // silencio, porque excluir callado miente igual que duplicar):
  //  1. las filas ESPEJO de H9b no suman en ningún total → el contador de registros dice cuántas
  //     hay, la card lleva un chip visible sin desplegar y las celdas Horas/Costo van tachadas;
  //  2. el costo sólo acumula el bucket DESCUENTO (ver abajo) → lo dice la leyenda de cierre.
  const months = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, HoursTransaction[]>();
    for (const tx of filteredTxs) {
      const k = monthKeyOf(tx);
      const arr = map.get(k);
      if (arr) arr.push(tx);
      else map.set(k, [tx]);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0])) // meses desc: el más reciente primero
      .map(([key, txs]) => {
        // El backend ordena por createdAt desc (no puede ordenar por workedOn sin comerse las
        // PURCHASE, que lo tienen NULL); el orden por fecha efectiva se hace acá.
        const ordenadas = [...txs].sort(
          (a, b) => dayKeyOf(b).localeCompare(dayKeyOf(a)) || b.createdAt.localeCompare(a.createdAt),
        );
        // Acumuladas / descuento / internas van SEPARADOS a propósito: en esta pantalla conviven
        // compras y reembolsos (suman cupo) con usos y préstamos (lo restan) y con tiempo interno
        // (que no mueve cupo). Un único neto sería engañoso — el portal no tiene el problema porque
        // sólo muestra USAGE/LOAN.
        let creditos = 0;
        let debitos = 0;
        let internas = 0;
        let espejos = 0;
        const costos = new Map<string, number>();
        for (const tx of ordenadas) {
          // H9b: la fila ESPEJO de una nota de crédito repite horas y costo del original, que sigue
          // vivo en el mismo mes. Se muestra en la tabla pero NO se agrega: si no, la card duplica
          // un trabajo que ocurrió una sola vez. El KPI "Total facturable" del cartel de arriba las
          // excluye igual (client.service.ts, `rebilledFromTransactionId: null`).
          if (tx.rebilledFromTransactionId) {
            espejos++;
            continue;
          }
          const bucket = bucketDeHeader(tx.type);
          if (bucket === 'ACUMULADA') creditos += r2(tx.hours);
          else if (bucket === 'DESCUENTO') debitos += r2(tx.hours);
          else internas += r2(tx.hours);
          // Costo: SÓLO el bucket DESCUENTO (USAGE|LOAN), espejando el predicado del KPI del backend
          // (`type: { in: ['USAGE','LOAN'] }` en client.service.ts). La leyenda de esta pantalla
          // promete que "las recargas y reembolsos no suman al costo": hoy eso se cumpliría igual sin
          // la condición, pero sólo porque PURCHASE/REFUND/INTERNAL nacen sin precio — o sea que lo
          // sostiene LA DATA, no el código. El día que una PURCHASE lleve importe (un paquete de
          // horas con precio es natural acá) el header sumaría plata que el KPI no suma y la leyenda
          // pasaría a mentir sin que nada falle. Con la condición, la invariante la sostiene el código.
          // Agrupado por la moneda CONGELADA de cada fila — la misma con la que se pinta la celda.
          // Y acumulado YA REDONDEADO POR FILA (`rMoneda`), porque el usuario suma lo que ve, no el
          // crudo: sumar primero y redondear después daba un header que no era la suma de sus filas.
          if (bucket === 'DESCUENTO' && tx.priceAmount) {
            const m = tx.priceCurrency ?? currency;
            costos.set(m, (costos.get(m) ?? 0) + rMoneda(Number(tx.priceAmount) || 0));
          }
        }
        return { key, txs: ordenadas, creditos, debitos, internas, espejos, costos: [...costos.entries()] };
      });
  }, [filteredTxs, currency]);

  // Default: el mes más reciente arranca abierto, el resto cerrados (mismo patrón que el portal).
  //
  // Se RECONCILIA contra los meses VISIBLES en vez de keyear por `months[0]`: al mover el rango de
  // fechas, la primera key puede no cambiar mientras desaparece el mes que el usuario tenía abierto
  // (quedaban cero cards abiertas), y cuando sí cambiaba se pisaba de un saque todo lo que el
  // usuario había desplegado. Acá se podan las keys que ya no se renderizan y sólo se abre el mes
  // más reciente si la intersección quedó vacía.
  const monthKeysSig = months.map((m) => m.key).join('|');
  useEffect(() => {
    const visibles = monthKeysSig === '' ? [] : monthKeysSig.split('|');
    setOpenMonths((prev) => {
      // Sin meses visibles no se renderiza NINGUNA card, así que no hay nada que podar: las keys
      // "muertas" no molestan a nadie. Podar acá borraba lo que el usuario tenía desplegado cada vez
      // que el rango dejaba el listado vacío, y al limpiar el rango volvía todo cerrado menos el
      // primer mes — un ida y vuelta que no cambió ningún dato no debe pisar el estado de apertura.
      if (visibles.length === 0) return prev;
      const next = new Set(visibles.filter((k) => prev.has(k)));
      if (next.size === 0 && visibles[0]) next.add(visibles[0]);
      // Misma composición ⇒ devolver el Set anterior para no re-renderizar en vano.
      if (next.size === prev.size && [...next].every((k) => prev.has(k))) return prev;
      return next;
    });
  }, [monthKeysSig]);

  const toggleMonth = (key: string) =>
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const clearRange = () => {
    setDateFrom('');
    setDateTo('');
  };

  const handleFilterChange = (next: MovementFilter) => {
    setMovementFilter(next);
    loadHours(next);
  };

  const handleDeleteTransaction = async () => {
    // Ya no se chequea `authUser?.id`: el actor lo pone el backend (#65 C2.1). Pedirlo acá
    // dejaba el botón mudo mientras la sesión todavía estaba cargando.
    if (!orgId || !deleteTxConfirm || !deleteTxReason.trim()) return;
    setDeletingTx(true);
    try {
      // #65 C2.1: `deletedById` ya NO se manda. El backend sella el autor con el usuario de la
      // sesión (`@CurrentUser()`); mandarlo desde acá era dejar que el cliente firmara la auditoría
      // con el id que quisiera. El DTO todavía lo acepta y lo descarta, así que un frontend viejo
      // en la ventana de deploy no se rompe — pero el nuevo no tiene por qué mandarlo.
      await api.post(`/organizations/${orgId}/clients/${clientId}/hours/${deleteTxConfirm.id}/delete`, {
        reason: deleteTxReason.trim(),
      });
      // Textos distintos por la asimetría del backend: `deleteHoursTransaction` sólo revierte
      // contadores para PURCHASE/USAGE/LOAN/REFUND. La fila espejo de una NC (#54) y los INTERNAL
      // nunca movieron el cupo, así que su borrado es soft-delete + auditoría y nada más. El toast
      // bifurca igual que el diálogo: no puede prometer una reversión que no ocurrió.
      toast.success(
        'Transacción eliminada',
        deleteTxConfirm.esEspejo
          ? 'Se quitó del pool re-facturable de la nota de crédito. Las horas del cliente no cambian.'
          : deleteTxConfirm.type === 'INTERNAL'
            ? 'Se eliminó el registro interno. Las horas del cliente no cambian.'
            : 'Se revirtió el efecto en las horas del cliente',
      );
      setDeleteTxConfirm(null);
      setDeleteTxReason('');
      loadHours(movementFilter);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al eliminar transacción');
    } finally {
      setDeletingTx(false);
    }
  };

  const handleEditTransaction = async () => {
    if (!orgId || !editTxConfirm) return;
    const newHours = Number(editTxHours);
    const newRate = editTxRate.trim() === '' ? null : Number(editTxRate);

    if (Number.isNaN(newHours) || newHours <= 0) {
      toast.error('Error', 'Las horas deben ser un número mayor a 0');
      return;
    }
    if (newRate !== null && (Number.isNaN(newRate) || newRate < 0)) {
      toast.error('Error', 'La tarifa debe ser un número mayor o igual a 0');
      return;
    }

    setEditingTx(true);
    try {
      await api.post(`/organizations/${orgId}/clients/${clientId}/hours/${editTxConfirm.id}/edit`, {
        hours: newHours,
        priceRate: newRate,
      });
      toast.success('Transacción editada', 'Datos actualizados y cupo del cliente ajustado');
      setEditTxConfirm(null);
      setEditTxHours('');
      setEditTxRate('');
      loadHours(movementFilter);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al editar transacción');
    } finally {
      setEditingTx(false);
    }
  };

  const handleAddHours = async () => {
    if (!orgId || !hoursForm.hours) return;
    setSavingHours(true);
    try {
      await api.post(`/organizations/${orgId}/clients/${clientId}/hours`, {
        hours: Number(hoursForm.hours),
        note: hoursForm.note.trim() || undefined,
      });
      toast.success('Horas agregadas', `Se cargaron ${hoursForm.hours} horas al cliente`);
      setShowAddHours(false);
      setHoursForm({ hours: '', note: '' });
      loadHours(movementFilter);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al agregar horas');
    } finally {
      setSavingHours(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Cliente no encontrado</p>
      </div>
    );
  }

  const available = hours?.availableHours ?? 0;
  const percentUsed = hours && hours.contractedHours > 0
    ? Math.min(Math.round((hours.usedHours / hours.contractedHours) * 100), 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link href={`/clients/${clientId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-3">
          <ArrowLeft className="h-4 w-4" /> Volver al cliente
        </Link>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-card-foreground">Tiempo</h1>
              <p className="text-sm text-muted-foreground">{client.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Hours Widget - Full width */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold text-card-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Horas Contratadas
          </h2>
          {/* #65 C1: la ruta POST :clientId/hours pasó a exigir `manage:projects`. Sin este
              gate el botón queda visible para todo el mundo y falla con 403 recién después de
              abrir el diálogo y escribir las horas — el mismo anti-patrón que A1.3 condena. */}
          {canEditHours && (
            <Button size="sm" onClick={() => setShowAddHours(true)}>
              <Plus className="mr-1 h-3 w-3" /> Agregar Horas
            </Button>
          )}
        </div>

        {/*
          Estos KPIs son del CLIENTE y salen del backend sobre TODO el historial, así que se rotulan
          como HISTÓRICO: no reflejan los filtros de abajo. Fuentes legítimas de diferencia contra la
          suma de las cards, todas esperadas:
            - el rango de fechas y el filtro de movimiento recortan las cards, no los KPIs;
            - "Consumidas"/"Disponibles" salen del cupo del cliente, que INTERNAL no mueve;
            - bajo truncado las cards ven sólo los movimientos traídos.
          Lo que YA NO diverge es el "Total facturable": el backend excluye las filas espejo de H9b
          (rebilledFromTransactionId) y las cards de abajo hacen lo mismo.
        */}
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Totales históricos del cliente
          <span className="ml-1 font-normal normal-case tracking-normal">
            — no reflejan los filtros del historial
          </span>
        </p>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 mb-5">
          <div className="rounded-xl bg-primary/10 p-4">
            <p className="text-xs text-primary font-medium">Contratadas (histórico)</p>
            <p className="text-2xl font-bold text-primary">{hours?.contractedHours ?? 0}h</p>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <p className="text-xs text-muted-foreground font-medium">Consumidas (histórico)</p>
            <p className="text-2xl font-bold text-foreground">{(hours?.usedHours ?? 0).toFixed(1)}h</p>
          </div>
          <div className={`rounded-xl p-4 ${available > 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
            <p className={`text-xs font-medium ${available > 0 ? 'text-success' : 'text-destructive'}`}>Disponibles (histórico)</p>
            <p className={`text-2xl font-bold ${available > 0 ? 'text-success' : 'text-destructive'}`}>{available.toFixed(1)}h</p>
          </div>
          <div className="rounded-xl bg-warning/10 p-4">
            <p className="text-xs text-warning font-medium">Prestamo (histórico)</p>
            <p className="text-2xl font-bold text-warning">{(hours?.loanedHours ?? 0).toFixed(1)}h</p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 col-span-2 lg:col-span-1">
            <p className="text-xs text-primary font-medium flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Total facturable (histórico)
            </p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(hours?.totalAmount ?? 0, currency)}
            </p>
          </div>
        </div>

        {/* Tarifas por hora */}
        {hours && (hours.developmentHourlyRate != null || hours.supportHourlyRate != null) && (
          <div className="mb-5 rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">
              Tarifas por hora ({hours.currency || 'PYG'})
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Desarrollo</p>
                <p className="text-lg font-bold text-foreground">
                  {hours.developmentHourlyRate != null
                    ? new Intl.NumberFormat('es-PY').format(Number(hours.developmentHourlyRate))
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Soporte</p>
                <p className="text-lg font-bold text-foreground">
                  {hours.supportHourlyRate != null
                    ? new Intl.NumberFormat('es-PY').format(Number(hours.supportHourlyRate))
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {hours && hours.contractedHours > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">{percentUsed}% consumido</span>
              <span className="text-muted-foreground">{hours.usedHours.toFixed(1)} / {hours.contractedHours}h</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  percentUsed >= 100 ? 'bg-destructive' : percentUsed >= 80 ? 'bg-warning' : 'bg-primary'
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>
        )}

        {/* Historial detallado + filtro de movimiento */}
        <Separator className="mb-4" />
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            Historial detallado de horas
          </p>
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 p-1">
            {MOVEMENT_FILTERS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => handleFilterChange(opt.value)}
                disabled={loadingHours}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                  movementFilter === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro de rango de fechas (client-side, sobre la fecha efectiva). Convive con el de
            movimiento, que es server-side: los dos pueden estar activos al mismo tiempo. */}
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/20 p-3">
          <CalendarRange className="mt-1 h-4 w-4 text-muted-foreground" />
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Desde</label>
            <Input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-36 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Hasta</label>
            <Input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-36 text-xs"
            />
          </div>
          {rangeActive && (
            <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={clearRange}>
              <X className="mr-1 h-3 w-3" /> Limpiar rango
            </Button>
          )}
          <p className="ml-auto max-w-xs text-[11px] text-muted-foreground">
            Filtra por <strong>fecha de trabajo</strong> (no de registro). Los totales de cada mes
            reflejan sólo lo que entra en el rango.
          </p>
        </div>

        {/* Aviso de truncado: sólo si el backend tenía más movimientos de los que mandó.
            Redactado sobre LA VISTA y no sobre el cliente, igual que su hermano de #56 (abajo):
            `transactionsTotal` es el count CON el `where.type` de la píldora de movimiento, así que
            con "Descuento" activa el número es el del bucket y no el del cliente. Decir "del
            cliente" hacía que el total cambiara al filtrar y quien lo leyera concluyera que el
            cartel miente. Los dos carteles hablan el mismo idioma a propósito. */}
        {truncated && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-[11px] text-warning">
              De esta vista se trajeron los últimos <strong>{allTxs.length}</strong> de{' '}
              <strong>{hours?.transactionsTotal}</strong> movimientos. El corte se hace por fecha de
              registro y los meses se agrupan por fecha de trabajo, así que puede faltar información
              en <strong>cualquier</strong> mes: ningún total de abajo es confiable.
            </p>
          </div>
        )}

        {/* #56: aviso preventivo, nunca junto al de truncado (ver `nearCeiling`). Dice qué pasa y
            qué hacer: la salida NO es subir el techo, es paginar por MES agrupando en SQL.
            Redactado sobre LA VISTA y no sobre el cliente: con una píldora de movimiento activa el
            conteo es el del bucket filtrado (ver `nearCeiling`). Decir "este cliente tiene N" hacía
            que el número bajara —y el aviso desapareciera— al filtrar, y el staff concluía que el
            aviso había sido un error. */}
        {nearCeiling && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-info/30 bg-info/10 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <p className="text-[11px] text-info">
              Esta vista ya trae <strong>{hours?.transactionsTotal}</strong> movimientos y se
              acerca al techo de <strong>{techoEfectivo}</strong> que devuelve el servidor. Los
              totales de abajo <strong>todavía son correctos</strong>, pero al pasar el techo dejarán
              de serlo sin avisar: los meses se suman en el navegador y necesitan el ledger completo.
              La solución <strong>no es subir el techo</strong> (solo mueve el problema y agranda la
              respuesta), es <strong>paginar por mes agrupando en SQL</strong>. Avisale al equipo de
              desarrollo antes de llegar al límite.
            </p>
          </div>
        )}

        {allTxs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {loadingHours ? 'Cargando movimientos...' : 'No hay movimientos para este filtro.'}
          </p>
        ) : months.length === 0 ? (
          // Distinto del vacío de arriba: hay movimientos, pero NINGUNO cae en el rango elegido.
          <div className="rounded-xl border border-border bg-muted/10 py-10 text-center">
            <CalendarRange className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            {/* Bajo truncado no se puede afirmar que no existan: sólo que no están entre los
                movimientos que se trajeron. */}
            <p className="text-sm text-muted-foreground">
              {truncated
                ? 'Ninguno de los movimientos traídos cae en el rango de fechas seleccionado (pueden existir otros fuera de los traídos).'
                : 'Ningún movimiento cae en el rango de fechas seleccionado.'}
            </p>
            <Button variant="outline" size="sm" className="mt-3 rounded-full text-xs" onClick={clearRange}>
              <X className="mr-1 h-3 w-3" /> Limpiar rango
            </Button>
          </div>
        ) : (
          <div className={loadingHours ? 'opacity-60' : ''}>
            <div className="mb-3 flex items-center justify-end">
              <p className="text-[11px] text-muted-foreground">
                {rangeActive ? 'En el rango: ' : 'Total: '}
                <span className="font-semibold text-foreground">{filteredTxs.length}</span>{' '}
                {filteredTxs.length === 1 ? 'movimiento' : 'movimientos'} en {months.length}{' '}
                {months.length === 1 ? 'mes' : 'meses'}
              </p>
            </div>

            <div className="space-y-3">
              {months.map((mes) => {
                const open = openMonths.has(mes.key);
                // Mes 100% interno: mostrar "+0.00h / −0.00h" hace que se lea como un mes vacío
                // cuando en realidad el equipo sí trabajó, y los dos ceros obligatorios dominan
                // visualmente al único número con contenido. Se muestran sólo las internas.
                const soloInternas = mes.creditos === 0 && mes.debitos === 0 && mes.internas > 0;
                return (
                  <div key={mes.key} className="rounded-xl border border-border bg-card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleMonth(mes.key)}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                            open && 'rotate-180',
                          )}
                        />
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            {monthLabelEs(mes.key)}
                            {/* El chip va EN EL HEADER, no sólo en la fila: la card se lee colapsada
                                y el chip de la fila recién aparece al desplegar. Que el mes contenga
                                filas que no suman tiene que verse antes de abrir. */}
                            {mes.espejos > 0 && (
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                {mes.espejos === 1 ? 'Con fila espejo' : `Con ${mes.espejos} filas espejo`}
                              </span>
                            )}
                          </p>
                          {/* Computadas vs. totales: el contador cuenta TODAS las filas renderizadas,
                              así que tiene que aclarar cuántas de ellas no producen los números de
                              al lado. Si no, invita a leer "estos N registros dan estos totales". */}
                          <p className="text-[11px] text-muted-foreground">
                            {mes.txs.length} {mes.txs.length === 1 ? 'registro' : 'registros'}
                            {mes.espejos > 0 &&
                              ` (${mes.espejos} ${mes.espejos === 1 ? 'espejo, no computado' : 'espejos, no computados'})`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        {/* Acumuladas y descuento separados: sumarlos en un neto escondería que un
                            mes con una recarga grande y mucho consumo "no movió nada". Las internas
                            van aparte (bucket propio, no mueven cupo) pero con el MISMO signo "−"
                            que pinta su fila: el color muted y el title ya dicen que no descuentan
                            cupo, y que header y fila usen signos distintos para el mismo movimiento
                            no se lee como matiz, se lee como error. */}
                        <div>
                          <p className="font-mono text-sm font-semibold">
                            {!soloInternas && (
                              <>
                                <span className="text-success">+{mes.creditos.toFixed(2)}h</span>
                                <span className="mx-1 text-muted-foreground/50">/</span>
                                <span className="text-primary">−{mes.debitos.toFixed(2)}h</span>
                              </>
                            )}
                            {mes.internas > 0 && (
                              <>
                                {!soloInternas && <span className="mx-1 text-muted-foreground/50">·</span>}
                                <span
                                  className="text-muted-foreground"
                                  title="Tiempo interno (tareas no facturables): queda registrado pero no descuenta cupo ni tiene costo."
                                >
                                  −{mes.internas.toFixed(2)}h
                                </span>
                              </>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {soloInternas
                              ? 'internas'
                              : `acumuladas / descuento${mes.internas > 0 ? ' · internas' : ''}`}
                          </p>
                        </div>
                        <div>
                          <p className="font-mono text-sm font-semibold text-foreground">
                            {mes.costos.length === 0
                              ? (
                                // "—" y NO "Gs. 0": cero y "sin importe registrado" no son lo mismo.
                                // Si ninguna fila computada del mes tiene importe (cliente sin tarifas
                                // configuradas ⇒ el backend deja `priceAmount` null), al desplegar TODAS
                                // las celdas de Costo dicen "—" y un header con "Gs. 0" sería la única
                                // celda del bloque que inventa un número donde no hay ninguno: el mes se
                                // leería como trabajo sin costo en vez de trabajo sin tarifa cargada. Es
                                // además la convención que la propia pantalla ya usa en los otros dos
                                // lugares sin valor honesto: `formatCurrency(null)` (src/lib/utils.ts) y
                                // el caso multi-moneda de acá al lado.
                                <span title="Ninguna fila computada de este mes tiene importe registrado (no significa costo cero).">
                                  —
                                </span>
                              )
                              : mes.costos.length === 1
                                ? formatCurrency(mes.costos[0][1], mes.costos[0][0])
                                : (
                                  // Cada fila lleva su moneda CONGELADA y la del cliente es editable:
                                  // sumar importes de monedas distintas inventaría un número. El
                                  // desglose sale del MISMO acumulador redondeado por fila, así que
                                  // cada importe del tooltip también cuadra con sus filas visibles.
                                  <span
                                    title={`El mes mezcla monedas, no hay un único importe: ${mes.costos
                                      .map(([m, v]) => formatCurrency(v, m))
                                      .join(' · ')}`}
                                  >
                                    —
                                  </span>
                                )}
                          </p>
                          <p className="text-[10px] text-muted-foreground">costo</p>
                        </div>
                      </div>
                    </button>

                    {open && (
                      <div className="border-t border-border animate-fade-in overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/30 text-xs">
                            <tr>
                              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Fecha</th>
                              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Concepto</th>
                              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Proyecto</th>
                              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Movimiento</th>
                              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Horas</th>
                              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Tarifa</th>
                              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Costo</th>
                              <th className="px-3 py-2.5 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {mes.txs.map((tx) => {
                              const conf = TYPE_LABELS[tx.type] || TYPE_LABELS.USAGE;
                              const Icon = conf.icon;
                              const isCredit = esCredito(tx.type);
                              // Fila espejo de una NC (H9b): se renderiza pero no entra en ningún
                              // total del header. Si sus celdas se pintan igual que las de una fila
                              // que sí suma, quien reconcilia la columna a mano obtiene el doble y no
                              // encuentra la diferencia.
                              const esEspejo = tx.rebilledFromTransactionId != null;
                              const noComputaTitle =
                                'No se suma en los totales del mes: repite las horas y el costo del movimiento original de la nota de crédito.';
                              return (
                                <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                                  {/* Fecha EFECTIVA (workedOn con fallback a createdAt): es la que ve
                                      el cliente en su portal y la que corta la facturación. */}
                                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                    {rowDateShort(tx)}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <p className="text-sm text-foreground truncate max-w-[220px]">
                                      {tx.task?.title ?? tx.note ?? conf.label}
                                    </p>
                                    {tx.task && tx.note && tx.note !== tx.task.title && (
                                      <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">{tx.note}</p>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[140px]">
                                    {tx.task?.project?.name ?? '—'}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      tx.type === 'PURCHASE' ? 'bg-success/15 text-success' :
                                      tx.type === 'REFUND' ? 'bg-info/15 text-info' :
                                      tx.type === 'LOAN' ? 'bg-warning/15 text-warning' :
                                      tx.type === 'INTERNAL' ? 'bg-muted text-muted-foreground' :
                                      tx.task?.type === 'SUPPORT' ? 'bg-warning/15 text-warning' :
                                      tx.task?.type === 'PROJECT' ? 'bg-info/15 text-info' :
                                      'bg-primary/15 text-primary'
                                    }`}>
                                      <Icon className="h-3 w-3" />
                                      {tx.type === 'USAGE' && tx.task?.type === 'SUPPORT' ? 'Soporte' :
                                        tx.type === 'USAGE' && tx.task?.type === 'PROJECT' ? 'Desarrollo' :
                                        conf.label}
                                    </span>
                                    {/* Fila espejo de una nota de crédito (H9b): se muestra para que
                                        el ledger sea auditable, pero no suma en el header. */}
                                    {tx.rebilledFromTransactionId && (
                                      <span
                                        className="ml-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                                        title="Fila espejo de una nota de crédito: repite las horas y el costo del movimiento original, por eso no se suma en los totales del mes."
                                      >
                                        Espejo
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    className={cn(
                                      'px-3 py-2.5 text-right font-mono text-sm font-semibold whitespace-nowrap',
                                      isCredit ? 'text-success' : conf.color,
                                      esEspejo && 'line-through opacity-50',
                                    )}
                                    title={
                                      esEspejo
                                        ? `${isCredit ? '+' : '−'}${tx.hours.toFixed(2)}h — ${noComputaTitle}`
                                        : undefined
                                    }
                                  >
                                    {isCredit ? '+' : '−'}{tx.hours.toFixed(2)}h
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                                    {tx.priceRate
                                      ? formatCurrency(tx.priceRate, tx.priceCurrency ?? currency)
                                      : '—'}
                                  </td>
                                  <td
                                    className={cn(
                                      'px-3 py-2.5 text-right font-mono text-sm font-semibold text-foreground whitespace-nowrap',
                                      esEspejo && 'line-through opacity-50',
                                    )}
                                    title={
                                      esEspejo && tx.priceAmount
                                        ? `${formatCurrency(tx.priceAmount, tx.priceCurrency ?? currency)} — ${noComputaTitle}`
                                        : undefined
                                    }
                                  >
                                    {tx.priceAmount
                                      ? formatCurrency(tx.priceAmount, tx.priceCurrency ?? currency)
                                      : '—'}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-1 justify-end">
                                      {/* Movimiento facturado (#25): TODO bloqueado hasta reabrir el ciclo. */}
                                      {tx.billedCycleId ? (
                                        <span
                                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40"
                                          title="Movimiento facturado (solo lectura). Reabrí el ciclo para editarlo."
                                        >
                                          <Lock className="h-3.5 w-3.5" />
                                        </span>
                                      ) : (
                                        <>
                                          {/* Fila espejo de una NC (H9b): el candado tapa SOLO el editar.
                                              Editarla la desincroniza del movimiento original que copia
                                              (y movería un contador que ella nunca tocó), pero eliminarla
                                              es la única forma de deshacer una devolución de horas emitida
                                              por error — no hay anulación ni reemisión de NC. El backend
                                              la borra sin revertir cupo (#54, deleteHoursTransaction). */}
                                          {esEspejo ? (
                                            <span
                                              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40"
                                              title="Fila espejo de una nota de crédito: es una copia derivada del movimiento original y no se edita. Si la devolución de horas fue un error, eliminá la fila."
                                            >
                                              <Lock className="h-3.5 w-3.5" />
                                            </span>
                                          ) : (
                                            canEditHours && (tx.type === 'USAGE' || tx.type === 'LOAN') && (
                                              <button
                                                onClick={() => {
                                                  setEditTxConfirm(tx);
                                                  setEditTxHours(String(tx.hours));
                                                  setEditTxRate(tx.priceRate ? String(tx.priceRate) : '');
                                                }}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 hover:bg-primary/10 hover:text-primary transition-colors"
                                                title="Editar horas / tarifa"
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                              </button>
                                            )
                                          )}
                                          <button
                                            onClick={() => setDeleteTxConfirm({ id: tx.id, type: tx.type, hours: tx.hours, note: tx.note, esEspejo })}
                                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                            title={esEspejo ? 'Eliminar fila espejo (deshace la devolución de horas)' : 'Eliminar transacción'}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground italic">
              Las fechas y los meses son por <strong>fecha de trabajo</strong> (la misma que ve el
              cliente en su portal). El monto facturable refleja únicamente el tiempo trabajado con
              tarifa vigente al momento del descuento. Las recargas y reembolsos de horas no suman al
              costo, y las filas marcadas como <strong>Espejo</strong> (nota de crédito) tampoco suman
              a los totales del mes: repiten las horas y el costo del movimiento original, que sigue
              listado.
            </p>
          </div>
        )}
      </div>

      {/* Add Hours Dialog */}
      <Dialog open={showAddHours} onOpenChange={setShowAddHours}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar Horas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Carga horas contratadas para <strong>{client.name}</strong>.</p>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Cantidad de horas *</Label>
              <Input type="number" value={hoursForm.hours} onChange={(e) => setHoursForm({ ...hoursForm, hours: e.target.value })} placeholder="Ej: 40" min={1} />
            </div>
            <div className="space-y-2">
              <Label>Nota (opcional)</Label>
              <Input value={hoursForm.note} onChange={(e) => setHoursForm({ ...hoursForm, note: e.target.value })} placeholder="Ej: Contrato marzo 2026" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddHours(false)}>Cancelar</Button>
            <Button onClick={handleAddHours} disabled={savingHours || !hoursForm.hours || Number(hoursForm.hours) <= 0}>
              {savingHours ? 'Agregando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Hours Transaction Dialog */}
      <Dialog open={!!deleteTxConfirm} onOpenChange={(open) => { if (!open) { setDeleteTxConfirm(null); setDeleteTxReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar transacción de horas</DialogTitle>
          </DialogHeader>
          {/* La fila espejo de una NC se borra por una rama distinta del backend (#54): solo soft-delete
              + auditoría, sin tocar el cupo del cliente, porque esa fila nunca lo movió (el movimiento
              original sigue vivo y es el que consumió las horas). Prometer acá una reversión de cupo
              haría que el admin vea el KPI "Consumidas" sin moverse y crea que el borrado falló. */}
          {deleteTxConfirm?.esEspejo ? (
            <p className="text-sm text-muted-foreground">
              Esta fila espejo (<strong>-{deleteTxConfirm?.hours.toFixed(2)}h</strong> — {deleteTxConfirm?.note || deleteTxConfirm?.type}) se quitará del pool re-facturable de la nota de crédito.
              {' '}<strong>Las horas del cliente no se modifican</strong>: esta fila nunca movió el cupo, solo copia el movimiento original.
            </p>
          ) : deleteTxConfirm?.type === 'INTERNAL' ? (
            /* Misma bifurcación que la fila espejo, por el mismo motivo: `deleteHoursTransaction`
               tiene ramas de contadores para PURCHASE/USAGE/LOAN/REFUND y NINGUNA para INTERNAL, así
               que acá sólo ocurre el soft-delete. Un INTERNAL nace de una tarea SUPPORT con
               billable=false: `recordHoursUsage` crea la fila SIN tocar `usedHours` (por eso el
               header la cuenta como "internas", fuera de los buckets). Prometer una reversión de
               cupo dejaría al admin esperando que "Consumidas" se mueva y creyendo que el borrado
               falló. */
            <p className="text-sm text-muted-foreground">
              Se eliminará este registro interno (<strong>-{deleteTxConfirm?.hours.toFixed(2)}h</strong> — {deleteTxConfirm?.note || deleteTxConfirm?.type}).
              {' '}<strong>Las horas del cliente no se modifican</strong>: un movimiento interno nunca consumió cupo (es tiempo no facturable del equipo).
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {/* El signo sale de `esCredito`, el MISMO helper que pinta la fila de la tabla, no de
                  comparar contra 'PURCHASE' a mano. Comparando solo con PURCHASE, un REFUND —que el
                  backend crea de verdad al rechazar o reabrir un ticket (hours.listener.ts)— se
                  pintaba "+2.00h" en la tabla y "-2.00h" en este diálogo: el admin leía lo CONTRARIO
                  de lo que iba a pasar (ese REFUND SUMÓ horas, borrarlo las RESTA) y el diálogo se
                  contradecía con la fila que tenía arriba. */}
              Se revertirá el efecto de esta transacción (<strong>{esCredito(deleteTxConfirm?.type ?? '') ? '+' : '-'}{deleteTxConfirm?.hours.toFixed(2)}h</strong> — {deleteTxConfirm?.note || deleteTxConfirm?.type}) sobre las horas del cliente.
            </p>
          )}
          <div className="space-y-2 pt-2">
            <Label>Motivo de eliminación *</Label>
            <Textarea
              value={deleteTxReason}
              onChange={(e) => setDeleteTxReason(e.target.value)}
              placeholder="Ej: Carga duplicada, error de cálculo..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTxConfirm(null); setDeleteTxReason(''); }} disabled={deletingTx}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteTransaction} disabled={deletingTx || !deleteTxReason.trim()}>
              {deletingTx ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Hours Transaction Dialog (solo PO/PM/Owner, solo USAGE/LOAN) */}
      <Dialog open={!!editTxConfirm} onOpenChange={(open) => { if (!open) { setEditTxConfirm(null); setEditTxHours(''); setEditTxRate(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar transacción de horas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Editás <strong>{editTxConfirm?.task?.title ?? editTxConfirm?.note ?? editTxConfirm?.type}</strong>.
            El costo se recalcula como Horas × Tarifa y el cupo del cliente se ajusta atómicamente.
          </p>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Horas *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={editTxHours}
                onChange={(e) => setEditTxHours(e.target.value)}
              />
              {editTxConfirm && editTxHours !== '' && !Number.isNaN(Number(editTxHours)) && Number(editTxHours) !== editTxConfirm.hours && (
                <p className="text-[11px] text-warning">
                  Delta: {(Number(editTxHours) - editTxConfirm.hours).toFixed(2)}h se {Number(editTxHours) > editTxConfirm.hours ? 'descontarán del' : 'devolverán al'} cupo disponible del cliente.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tarifa por hora ({editTxConfirm?.priceCurrency ?? currency})</Label>
              <Input
                type="number"
                step="1"
                min="0"
                placeholder="0 = sin tarifa"
                value={editTxRate}
                onChange={(e) => setEditTxRate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Dejar vacío o 0 para limpiar la tarifa (el costo quedará como —).
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">Nuevo costo calculado</p>
              <p className="font-mono font-semibold text-foreground">
                {(() => {
                  const h = Number(editTxHours);
                  const r = Number(editTxRate);
                  if (Number.isNaN(h) || h <= 0 || Number.isNaN(r) || r <= 0) return '—';
                  return formatCurrency(h * r, editTxConfirm?.priceCurrency ?? currency);
                })()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditTxConfirm(null); setEditTxHours(''); setEditTxRate(''); }} disabled={editingTx}>
              Cancelar
            </Button>
            <Button onClick={handleEditTransaction} disabled={editingTx}>
              {editingTx ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
