"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  ArrowLeftRight,
  ClipboardList,
  ArrowUpRight,
  BadgePercent,
  Banknote,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Ellipsis,
  Images,
  IdCard,
  Minus,
  Package,
  Plus,
  QrCode,
  Search,
  ShoppingCart,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { InputMoneda } from "@/components/campos/input-moneda";
import { formatMinorArs, parseArsToMinor } from "@/lib/membership/money";
import { importeSinCentavos } from "@/lib/pedidos/candado-saldo-puro";
import { ticketTotals, validateTicket, type TicketLine } from "@/lib/sales/ticket";
import { normalizeBarcode } from "@/lib/sales/barcode";
import { SALE_PAYMENT_METHODS, type SalePaymentMethod } from "@/lib/sales/constants";
import { calcularVuelto, montosSugeridos } from "@/lib/sales/vuelto";
import type { DatosTransferencia } from "@/lib/cobro-ajustes/datos";
import type { ProductCategoryRow, ProductRow, ProductVariantRow } from "@/lib/sales/repository";
import { ClienteBuscador } from "./cliente-buscador";
import {
  cobrarConPedidoAction,
  cobrarSaldoAction,
  pedidosParaRetirarAction,
  type PedidoParaRetirar,
} from "./pedido-actions";
import { aCobrarAhora, PLAZO_SIN_REGLA_DIAS, repartirDescuento, senaSugerida, separarTicket, sugerirEntrega } from "@/lib/sales/pedido-mostrador";
import { useOcultarMenuEnEstaPantalla } from "@/components/shell/shell-frame";
import { EgresoDialogo, type DatosEgreso } from "./egreso-dialogo";
import { VerificarPago } from "./verificar-pago";
import { CobroQr } from "./cobro-qr";
import type { PagoCandidato } from "@/lib/sales/verificar-pago";
import type { ClienteBuscado } from "./mostrador-actions";
import { checkoutAction, findProductByCodeAction, searchProductsAction, type CheckoutInput } from "./actions";
import { anularPreparacionAction, crearPreparacionAction, crearPreparacionLaboratorioAction, produccionDeProductosAction } from "./impresion/actions";
import { DialogoPreparar, copiasTerminadas } from "./dialogo-preparar";
import { DialogoLaboratorio } from "./dialogo-laboratorio";
import type { RenglonTicketLab } from "@/components/copias/editor-laboratorio";
import { avisoLaboratorios, deshacerConLab, reemplazarGrupoLab } from "@/lib/sales/ticket-laboratorio";
import { CalculadoraFotolibro, type FotolibroAgregado, type LineaFotolibro } from "@/components/fotolibro/calculadora-fotolibro";
import type { CatalogoFotolibro, TipoTapa } from "@/lib/fotolibro/cotizar";
import { esSkuCajaFotolibro, tipoTapaDeSku, type FotolibroVendido } from "@/lib/fotolibro/venta";
import { crearFotolibroDesdeCobradorAction } from "@/app/actions/fotolibro";
import { miComisionAction } from "./comisiones/actions";
import type { MiComision } from "@/lib/comisiones/calculo";
import type { AgregarAlAbrir } from "@/lib/sales/agregar-al-abrir";

const ETIQUETA_PAGO: Record<SalePaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  MERCADO_PAGO: "Mercado Pago",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  OTRO: "Otro",
};

/** Para los botones del ticket, que son angostos: cinco entran en una sola fila. */
const ETIQUETA_CORTA_PAGO: Record<SalePaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  MERCADO_PAGO: "Mercado Pago",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  OTRO: "Otro",
};

const ICONO_PAGO: Record<SalePaymentMethod, LucideIcon> = {
  EFECTIVO: Banknote,
  MERCADO_PAGO: QrCode,
  TRANSFERENCIA: ArrowLeftRight,
  TARJETA: CreditCard,
  OTRO: Ellipsis,
};

/** Hoy en Argentina, "aaaa-mm-dd". */
function hoyEnArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

/** A texto plano, sin el símbolo: lo que espera `parseArsToMinor` en el campo. */
function minorATexto(minor: number): string {
  return formatMinorArs(minor).replace("$", "").trim();
}

/**
 * Un renglón del ticket en pantalla. `catalogPriceMinor` es null en un renglón suelto: no
 * hay contra qué comparar para saber si se pisó el precio. `tracksStock`/`stockQty` viajan
 * desde el `ProductRow` con el que se agregó —igual que `catalogPriceMinor`—: un renglón
 * suelto no tiene producto detrás, así que nunca controla existencia.
 */
type TicketRow = TicketLine & {
  key: string;
  catalogPriceMinor: number | null;
  tracksStock: boolean;
  stockQty: number | null;
};

/** El sistema operativo no cambia mientras la pantalla está abierta: no hay a qué suscribirse. */
function sinSuscripcion() {
  return () => {};
}

let contador = 0;
function nuevaKey(): string {
  contador += 1;
  return `r${contador}-${Date.now()}`;
}

/** Sobre qué actúan los atajos de cantidad: un renglón del ticket o una tarjeta del catálogo. */
type Objetivo = { tipo: "renglon"; key: string } | { tipo: "producto"; id: string };

/** Hasta tres cifras es una cantidad; más, es un código que viene del lector. */
const MAX_CIFRAS_CANTIDAD = 3;
const ESPERA_CANTIDAD_MS = 800;
const MAX_HISTORIAL = 50;

/**
 * La caja de kiosco.
 *
 * Corre entera en el navegador porque tiene que responder al clic y al lector de códigos sin
 * ida y vuelta al servidor: el catálogo ya llegó armado desde `page.tsx`, y sólo se toca el
 * servidor una vez, al cobrar.
 */
export function Pos({
  products,
  categories,
  clientsEnabled,
  cashEnabled,
  egresos,
  datosTransferencia,
  procesos,
  senaHabilitada = false,
  qrActivo = false,
  permisosCarnet = { puedeBuscarClientes: false, puedeAltaCliente: false },
  fotolibro = null,
  comision = null,
  agregarAlAbrir = [],
  hayCopiasLab = false,
}: {
  products: ProductRow[];
  categories: ProductCategoryRow[];
  clientsEnabled: boolean;
  /** Cuentas y categorías para anotar un egreso; null si no puede operar la caja. */
  egresos: DatosEgreso | null;
  cashEnabled: boolean;
  /** Alias y CVU del negocio (Configuración → Presupuestos), para mostrar al elegir Transferencia. */
  datosTransferencia: DatosTransferencia;
  /**
   * Productos que llevan proceso (generan un trabajo): id → plazo sugerido en días (null = sin
   * plazo cargado). Si el ticket tiene alguno, esa parte se cobra como pedido con seña.
   */
  procesos: Record<string, number | null>;
  /**
   * Puede dejar un renglón sin proceso señado para retirar (interruptor «Seña»): hace falta poder
   * crear pedidos y tener Clientes, porque el pedido va a nombre de alguien. Si no, no se ofrece.
   */
  senaHabilitada?: boolean;
  /** El QR fijo de Mercado Pago está activado (Configuración → Cobros). */
  qrActivo?: boolean;
  /** Qué puede hacer con Clientes dentro del editor de foto carnet (como en Ventas → Foto carnet). */
  permisosCarnet?: { puedeBuscarClientes: boolean; puedeAltaCliente: boolean };
  /** Calculadora de fotolibros: null si no hay ninguna lista de proveedor con tapas y hojas. */
  fotolibro?: { catalogo: CatalogoFotolibro; verCostos: boolean } | null;
  /**
   * Comisión de venta (fotolibros): los productos que la dan, el porcentaje para el cartel verde y,
   * si quien vende cobra comisión, lo suyo acumulado. null si nadie del equipo cobra comisión.
   */
  comision?: { porcentaje: number; productIds: string[]; mia: MiComision | null } | null;
  /** Productos que otra pantalla manda a cobrar (`?agregar=`): se suman al ticket al abrir. */
  agregarAlAbrir?: AgregarAlAbrir[];
  /** Hay copias de laboratorio en el catálogo: se ofrece «Pedido para laboratorio». */
  hayCopiasLab?: boolean;
}) {
  // El mostrador necesita el ancho: el menú lateral se oculta mientras está abierto.
  useOcultarMenuEnEstaPantalla();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<TicketRow[]>([]);
  const [discountText, setDiscountText] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>("EFECTIVO");
  // El pago que "Verificar pago" encontró en Mercado Pago (sólo vale para su monto exacto).
  const [pagoVerificado, setPagoVerificado] = useState<PagoCandidato | null>(null);
  // La order del QR del mostrador ya pagada para este ticket.
  const [pagoQr, setPagoQr] = useState<{ id: string; montoMinor: number } | null>(null);
  const conVerificar = paymentMethod === "TRANSFERENCIA" || paymentMethod === "MERCADO_PAGO";
  const verificadoPara = (montoMinor: number) =>
    conVerificar && pagoVerificado && pagoVerificado.montoMinor === montoMinor ? pagoVerificado.id : null;

  // El cliente de la venta: se busca por cualquier dato o se da de alta en una ventana.
  const [cliente, setCliente] = useState<ClienteBuscado | null>(null);
  const [egresoAbierto, setEgresoAbierto] = useState(false);
  // La foto grande que aparece al pasar el mouse por una miniatura del catálogo.
  const [fotoGrande, setFotoGrande] = useState<{ src: string; x: number; y: number } | null>(null);

  // El producto con talles al que se le está eligiendo el talle, antes de agregarlo.
  const [eligiendoTalle, setEligiendoTalle] = useState<ProductRow | null>(null);

  const [mostrarSuelto, setMostrarSuelto] = useState(false);
  // La calculadora abierta: la del botón «+ Fotolibro» (sin producto) o la de un producto de fotolibro.
  const [calculadora, setCalculadora] = useState<{ productId: string | null; tipo: TipoTapa | null; titulo: string; proveedorInicial: string | null } | null>(null);
  // Lo elegido para cada renglón de libro (por key, aparte de `rows` como las preparaciones) y su fotolibro.
  const [fotolibros, setFotolibros] = useState<Record<string, FotolibroVendido & { url?: string }>>({});
  const [creandoFotolibro, setCreandoFotolibro] = useState<string | null>(null);
  const [sueltoDescripcion, setSueltoDescripcion] = useState("");
  const [sueltoPrecio, setSueltoPrecio] = useState("");

  const [error, setError] = useState<string | null>(null);
  // Impresión (foto carnet y copias): qué productos se preparan, la preparación de cada renglón (por key,
  // aparte de `rows` para que deshacer no la pierda) y el renglón que se está preparando.
  const [produccion, setProduccion] = useState<Record<string, { tipoPieza: string; salida: string; hoja: string; digital: boolean }>>({});
  const [preparaciones, setPreparaciones] = useState<Record<string, string>>({});
  // Renglones sin proceso que el cajero marcó «Seña» (por key, como las preparaciones, para que
  // deshacer no pierda la marca): quedan en el pedido para retirar.
  const [paraRetirar, setParaRetirar] = useState<Record<string, boolean>>({});
  const conProceso = useMemo(() => new Set(Object.keys(procesos)), [procesos]);
  const tieneProceso = (r: TicketRow) => r.productId !== null && conProceso.has(r.productId);
  const [preparando, setPreparando] = useState<{ key: string; preparacionId: string } | null>(null);
  // Renglones de copias cuyo editor se cerró sin terminar: el ticket lo avisa (cobrarlas exige terminarlas).
  const [copiasSinTerminar, setCopiasSinTerminar] = useState<ReadonlySet<string>>(new Set());
  const [abriendoPreparacion, setAbriendoPreparacion] = useState<string | null>(null);
  // «Pedido para laboratorio»: la preparación y las keys de su grupo de renglones (bloqueados: se
  // cambian sólo desde el editor y se quitan todos juntos). `todasLabRef` guarda toda key que alguna
  // vez fue del grupo, para que deshacer no deje sueltos renglones de una versión vieja o quitada.
  const [laboratorio, setLaboratorio] = useState<{ preparacionId: string; keys: string[] } | null>(null);
  const [labAbierto, setLabAbierto] = useState(false);
  const [abriendoLab, setAbriendoLab] = useState(false);
  const todasLabRef = useRef<Set<string>>(new Set());
  const keysLab = useMemo(() => new Set(laboratorio?.keys ?? []), [laboratorio]);
  // Lo que manda a cobrar otra pantalla (el diseñador de polaroids): se suma una sola vez y la
  // dirección se limpia, para que recargar no lo vuelva a agregar. El precio es el del catálogo.
  const agregadoAlAbrirRef = useRef(false);
  useEffect(() => {
    if (agregadoAlAbrirRef.current || agregarAlAbrir.length === 0) return;
    agregadoAlAbrirRef.current = true;
    const faltan: string[] = [];
    for (const { sku, cantidad } of agregarAlAbrir) {
      const p = products.find((x) => x.sku === sku);
      if (p) agregarProducto(p, null, cantidad);
      else faltan.push(sku);
    }
    if (faltan.length > 0) setError(`No están en el catálogo: ${faltan.join(", ")}. Cargalos en Ventas → Catálogo.`);
    window.history.replaceState(null, "", "/ventas");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una sola vez, al abrir.
  }, []);
  useEffect(() => {
    // Si falla (p. ej. Impresión sin configurar), el Mostrador sigue igual, sin "Preparar".
    produccionDeProductosAction()
      .then(setProduccion)
      .catch(() => undefined);
  }, []);
  const conComision = useMemo(() => new Set(comision?.productIds ?? []), [comision]);
  const [miComision, setMiComision] = useState<MiComision | null>(comision?.mia ?? null);
  /** Lo que gana quien vende con un renglón (null si no da comisión o no cobra comisión). */
  const comisionDelRenglon = (r: { productId: string | null; qty: number; unitPriceMinor: number }) =>
    miComision && r.productId !== null && conComision.has(r.productId) ? Math.round((r.qty * r.unitPriceMinor * miComision.porcentaje) / 100) : null;
  /** Después de cada cobro: lo acumulado al día (un saldo cobrado completa comisiones). */
  function refrescarComision() {
    if (!miComision) return;
    miComisionAction()
      .then((m) => m && setMiComision(m))
      .catch(() => undefined);
  }
  const [ultimaVenta, setUltimaVenta] = useState<{
    saleNumber: number | null;
    deposited: boolean;
    vueltoMinor: number | null;
    /** Lo que ganó quien vendió con este cobro; `ganada` = ya cobrado entero. */
    comision?: { minor: number; ganada: boolean } | null;
    /** `grabar`: los trabajos de digitalización del pedido, con su «Ir a grabar». */
    pedido?: {
      numero: string;
      cobradoMinor: number;
      saldoMinor: number;
      aviso: string | null;
      grabar: { proyectoId: string; numero: string; nombre: string }[];
      /** A qué laboratorios sale solo el pedido para laboratorio (vacío si no hubo). */
      laboratorios: string[];
    };
  } | null>(null);
  // Pedido para retirar (cuando el ticket tiene trabajos con proceso).
  const [entregaElegida, setEntregaElegida] = useState<string | null>(null);
  const [conSena, setConSena] = useState(true);
  const [senaText, setSenaText] = useState("");
  const claveCobroRef = useRef<string | null>(null);
  // Pedidos abiertos del cliente elegido: para cobrar el saldo cuando viene a retirar.
  const [pedidosCliente, setPedidosCliente] = useState<PedidoParaRetirar[]>([]);
  const [avisoSaldo, setAvisoSaldo] = useState<{ ok: boolean; texto: string } | null>(null);
  // Efectivo: con cuánto paga, para calcular el vuelto. No viaja como dato propio: queda en la nota.
  const [recibidoText, setRecibidoText] = useState("");
  const [editandoPrecio, setEditandoPrecio] = useState<string | null>(null);
  // Buscador: cuál de los productos filtrados del catálogo queda marcado para Enter.
  const [resaltado, setResaltado] = useState(0);

  // Al elegir un cliente se ven sus pedidos abiertos, con el saldo para cobrar al retirar.
  useEffect(() => {
    if (!cliente) return;
    let vigente = true;
    pedidosParaRetirarAction(cliente.id).then((p) => {
      if (vigente) setPedidosCliente(p);
    });
    return () => {
      vigente = false;
      setPedidosCliente([]);
      setAvisoSaldo(null);
    };
  }, [cliente]);

  function cobrarSaldo(p: PedidoParaRetirar) {
    setAvisoSaldo(null);
    const clave = `sal-${crypto.randomUUID()}`;
    startTransition(async () => {
      const r = await cobrarSaldoAction(p.id, paymentMethod, clave, verificadoPara(p.saldoMinor));
      setAvisoSaldo(r.ok ? { ok: true, texto: r.mensaje } : { ok: false, texto: r.error });
      if (r.ok) setPagoVerificado(null);
      if (r.ok && cliente) setPedidosCliente(await pedidosParaRetirarAction(cliente.id));
      if (r.ok) refrescarComision();
    });
  }

  // Atajos de teclado (ver `manejarAtajo`): deshacer, el renglón activo, lo que tiene el puntero
  // encima y la cantidad que se está tipeando.
  const historialRef = useRef<TicketRow[][]>([]);
  const rowsRef = useRef<TicketRow[]>(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  const [activo, setActivo] = useState<string | null>(null);
  const [apuntado, setApuntado] = useState<Objetivo | null>(null);
  const [cantidadTipeada, setCantidadTipeada] = useState<{ texto: string; nombre: string } | null>(null);
  const tipeoRef = useRef<{ texto: string; objetivo: Objetivo; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const [avisoAtajo, setAvisoAtajo] = useState<string | null>(null);
  const avisoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ⌘ en Mac, Ctrl en el resto. En el servidor no se sabe: dice Ctrl hasta que hidrata.
  const esMac = useSyncExternalStore(
    sinSuscripcion,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
  const [procesando, startTransition] = useTransition();

  // `products` es sólo lo que `page.tsx` precargó —como mucho 200, ver el comentario de
  // `listProducts` en `lib/sales/repository.ts`— y la pantalla nunca lo vuelve a pedir
  // completo. `serverResults` es la respuesta AUTORITATIVA del servidor para el texto
  // actual, sin ese techo: mientras no llega (o no hay texto tipeado), se muestra el
  // filtro local, que es instantáneo pero puede no tener el producto 250.
  const [serverResults, setServerResults] = useState<ProductRow[] | null>(null);
  const [buscando, startSearchTransition] = useTransition();

  const discountMinor = parseArsToMinor(discountText) ?? 0;
  const totals = ticketTotals(rows, discountMinor);

  const filtradosLocal = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId && p.categoryId !== categoryId) return false;
      if (q === "") return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ? p.sku.toLowerCase().includes(q) : false) ||
        (p.barcode ? p.barcode.includes(q) : false)
      );
    });
  }, [products, search, categoryId]);

  const filtrados = search.trim() === "" ? filtradosLocal : (serverResults ?? filtradosLocal);

  /** Las primeras coincidencias del texto tipeado, para el desplegable. */
  // Con el catálogo en una columna, la lista filtrada hace de desplegable: ↑ ↓ la recorren
  // y Enter suma la marcada. Sin tope: se puede bajar por todo lo que coincide.
  const MAX_SUGERENCIAS = Number.POSITIVE_INFINITY;
  const sugerencias = search.trim() === "" ? [] : filtrados.slice(0, MAX_SUGERENCIAS);

  // Búsqueda en el servidor, con una demora corta para no pegarle a la base en cada tecla.
  // Corre siempre que hay texto —no sólo cuando el filtro local viene vacío— porque un
  // catálogo de 350 productos puede tener coincidencias locales Y coincidencias más allá del
  // producto 200 al mismo tiempo, y las dos tienen que verse.
  useEffect(() => {
    const q = search.trim();
    // Con el campo vacío no hace falta pedir ni limpiar nada: `filtrados` ya ignora
    // `serverResults` cuando no hay texto (ver más arriba), así que un resultado viejo acá
    // sentado no se llega a mostrar.
    if (q === "") return;
    const id = setTimeout(() => {
      startSearchTransition(async () => {
        const resultados = await searchProductsAction({ search: q, categoryId: categoryId || undefined });
        setServerResults(resultados);
      });
    }, 250);
    return () => clearTimeout(id);
  }, [search, categoryId]);

  function limpiarAviso() {
    setError(null);
    setUltimaVenta(null);
  }

  /**
   * Agrega un producto al ticket. Si tiene talles y todavía no se sabe cuál (el clic en la
   * grilla, o un código que era el del producto y no el de un talle), primero se abre el
   * selector de talle: con talles, el stock vive en cada talle (D4) y el servidor rechaza un
   * renglón sin talle. Cada talle es su propio renglón: "Remera — M" y "Remera — L" no se suman.
   */
  function agregarProducto(p: ProductRow, talle: ProductVariantRow | null = null, fijarCantidad: number | null = null) {
    limpiarAviso();
    // Fotolibro tapa flexible / rígida: el precio sale de la calculadora (fotos → hojas → precio).
    const tipo = tipoTapaDeSku(p.sku);
    if (tipo && fotolibro) {
      setCalculadora({ productId: p.id, tipo, titulo: p.name, proveedorInicial: p.preferredProveedorId ?? null });
      return;
    }
    if (talle === null && p.variants.length > 0) {
      setEligiendoTalle(p);
      return;
    }
    setEligiendoTalle(null);
    const variantId = talle?.id ?? null;
    const precio = talle?.priceMinor ?? p.priceMinor;
    // Un renglón del pedido para laboratorio no suma: el producto suelto va en su propio renglón.
    const mismo = (r: TicketRow) => r.productId === p.id && r.variantId === variantId && !esRenglonLab(r.key);
    const existente = rowsRef.current.find(mismo);
    const key = existente?.key ?? nuevaKey();
    cambiarRenglones((prev) => {
      const ya = prev.find(mismo);
      if (ya) {
        return prev.map((r) => (r.key === ya.key ? { ...r, qty: fijarCantidad ?? r.qty + 1 } : r));
      }
      return [
        ...prev,
        {
          key,
          productId: p.id,
          variantId,
          description: talle ? `${p.name} — ${talle.name}` : p.name,
          qty: fijarCantidad ?? 1,
          unitPriceMinor: precio,
          unitCostMinor: null,
          priceWasOverridden: false,
          catalogPriceMinor: precio,
          tracksStock: p.tracksStock,
          stockQty: talle?.stockQty ?? p.stockQty,
        },
      ];
    });
    setActivo(key);
  }

  /** Todo cambio del ticket pasa por acá: guarda cómo estaba para poder deshacerlo (Ctrl/⌘+Z). */
  function cambiarRenglones(cambio: (prev: TicketRow[]) => TicketRow[]) {
    historialRef.current.push(rowsRef.current);
    if (historialRef.current.length > MAX_HISTORIAL) historialRef.current.shift();
    setRows(cambio);
  }

  function avisar(texto: string) {
    setAvisoAtajo(texto);
    if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    avisoTimerRef.current = setTimeout(() => setAvisoAtajo(null), 3000);
  }

  /** Un renglón del pedido para laboratorio (en callbacks; al dibujar se usa `keysLab`). */
  function esRenglonLab(key: string): boolean {
    return todasLabRef.current.has(key);
  }

  function deshacer() {
    const popped = historialRef.current.pop();
    if (!popped) {
      avisar("No hay nada para deshacer.");
      return;
    }
    // Nunca quedan renglones del laboratorio sueltos; si se vuelve a un ticket sin el grupo, el grupo
    // sale pero la preparación queda (el botón vuelve a ella; si no se usa, se anula al cobrar).
    const { rows: anterior, laboratorio: labDeshecho } = deshacerConLab(popped, laboratorio, todasLabRef.current);
    if (labDeshecho !== laboratorio) setLaboratorio(labDeshecho);
    setRows(anterior);
    setActivo(anterior.at(-1)?.key ?? null);
    avisar("Deshecho.");
  }

  /** Vaciar a mano (botón o Esc): se puede deshacer. Después de cobrar no: ver `cobrar`. */
  function vaciarTicket() {
    if (rowsRef.current.length === 0) return;
    cambiarRenglones(() => []);
    setActivo(null);
    avisar(`Ticket vaciado. ${esMac ? "⌘" : "Ctrl"}+Z para deshacer.`);
    searchRef.current?.focus();
  }

  /** El renglón o la tarjeta sobre la que está parado: lo que tiene el puntero o el foco, si no el último tocado. */
  function objetivoActual(): Objetivo | null {
    if (apuntado) return apuntado;
    const filas = rowsRef.current;
    const renglon = filas.find((r) => r.key === activo) ?? filas.at(-1);
    return renglon ? { tipo: "renglon", key: renglon.key } : null;
  }

  function nombreDe(objetivo: Objetivo): string {
    if (objetivo.tipo === "renglon") return rowsRef.current.find((r) => r.key === objetivo.key)?.description ?? "";
    return products.find((p) => p.id === objetivo.id)?.name ?? "";
  }


  /**
   * El lector de códigos es sólo un teclado que tipea y manda Enter. Si el texto coincide
   * EXACTO con un `sku` o un `barcode`, el producto se agrega directo, el campo se limpia y
   * vuelve a enfocarse, listo para el siguiente escaneo. Si no coincide exacto, no pasa nada
   * más: la grilla de abajo ya está filtrando en vivo con lo que se tipeó.
   *
   * El código de barras se normaliza antes de comparar (`normalizeBarcode`, igual que al
   * guardar en `product-form.ts`): la base sólo guarda dígitos, pero el lector —o una persona
   * que copia el código a mano— puede mandar un espacio o un guión de más, y sin normalizar
   * ninguno de los dos lados coincide nunca.
   *
   * Primero se busca LOCAL —en `products` (los primeros 200) y en `serverResults` (lo que ya
   * trajo la búsqueda en vivo, si el texto también coincide por nombre)—, porque no tiene
   * demora. Si no hay nada ahí, el producto puede seguir existiendo más allá del tope de 200:
   * se le pregunta directo al servidor con `findProductByCodeAction`, que envuelve
   * `findProductByCode` (Tarea 6) y ya normaliza el código de barras adentro. Sin este último
   * paso, escanear el producto 201 no hacía nada, en silencio.
   */
  /** Suma lo elegido en el desplegable y deja el buscador listo para el siguiente. */
  function elegirSugerencia(p: ProductRow) {
    agregarProducto(p);
    setSearch("");
    setResaltado(0);
    searchRef.current?.focus();
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Flechas y Escape mueven el desplegable; Enter decide abajo.
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (sugerencias.length === 0) return;
      e.preventDefault();
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setResaltado((i) => (i + paso + sugerencias.length) % sugerencias.length);
      return;
    }
    if (e.key === "Escape") {
      if (search === "") return; // buscador vacío: Esc lo maneja el atajo (vacía el ticket)
      e.preventDefault();
      setSearch("");
      setResaltado(0);
      return;
    }
    if (e.key !== "Enter") return;
    const texto = search.trim();
    if (texto === "") return;
    e.preventDefault();
    const codigoBarras = normalizeBarcode(texto);
    const coincideCodigo = (p: ProductRow) =>
      p.sku === texto || (codigoBarras !== null && p.barcode === codigoBarras);

    // Primero el código exacto: es lo que manda el lector, y tiene que ganarle a cualquier
    // coincidencia por nombre que esté marcada en el desplegable.
    const local = products.find(coincideCodigo) ?? serverResults?.find(coincideCodigo);
    if (local) {
      elegirSugerencia(local);
      return;
    }
    // Si no es un código, Enter suma la coincidencia marcada del desplegable.
    const marcada = sugerencias[resaltado] ?? sugerencias[0];
    if (marcada) {
      elegirSugerencia(marcada);
      return;
    }

    startSearchTransition(async () => {
      const encontrado = await findProductByCodeAction(texto);
      if (encontrado) {
        // Si el código era el de un talle, ese talle se agrega directo, sin preguntar.
        const talle = encontrado.variant
          ? (encontrado.variants.find((v) => v.id === encontrado.variant?.id) ?? null)
          : null;
        agregarProducto(encontrado, talle);
        setSearch("");
      }
      searchRef.current?.focus();
    });
  }

  // Los renglones del pedido para laboratorio no se tocan de a uno: cantidad y precio salen del editor.
  function actualizarCantidad(key: string, qty: number) {
    if (!Number.isFinite(qty) || qty < 1 || esRenglonLab(key)) return;
    cambiarRenglones((prev) => prev.map((r) => (r.key === key ? { ...r, qty: Math.floor(qty) } : r)));
  }

  function actualizarPrecio(key: string, texto: string) {
    const minor = parseArsToMinor(texto);
    if (minor === null || esRenglonLab(key)) return;
    cambiarRenglones((prev) =>
      prev.map((r) =>
        r.key === key
          ? { ...r, unitPriceMinor: minor, priceWasOverridden: r.catalogPriceMinor !== null && minor !== r.catalogPriceMinor }
          : r,
      ),
    );
  }

  function quitarRenglon(key: string) {
    if (esRenglonLab(key)) return;
    cambiarRenglones((prev) => prev.filter((r) => r.key !== key));
  }

  /** «Pedido para laboratorio»: el primer toque crea la preparación; los siguientes reabren la misma. */
  async function abrirLaboratorio() {
    if (abriendoLab || procesando) return;
    if (laboratorio) {
      setLabAbierto(true);
      return;
    }
    limpiarAviso();
    setAbriendoLab(true);
    try {
      const c = await crearPreparacionLaboratorioAction({ clientId: cliente?.id ?? null });
      if (!c.ok) return setError(c.error);
      setLaboratorio({ preparacionId: c.id, keys: [] });
      setLabAbierto(true);
    } catch {
      setError("No se pudo abrir el pedido para laboratorio. Probá de nuevo.");
    } finally {
      setAbriendoLab(false);
    }
  }

  /**
   * «Listo» del editor: los renglones del grupo se reemplazan por los nuevos. La primera vez es un
   * cambio más del ticket (se puede deshacer); después, el reemplazo también se aplica al historial,
   * así deshacer otra cosa no trae de vuelta una versión vieja del grupo.
   */
  function alListoLab(renglones: RenglonTicketLab[]) {
    if (!laboratorio) return;
    const nuevos: TicketRow[] = renglones.map((x) => ({
      key: nuevaKey(),
      productId: x.productId,
      variantId: null,
      description: x.nombre,
      qty: x.cantidad,
      unitPriceMinor: x.precioUnitarioMinor,
      unitCostMinor: null,
      priceWasOverridden: false,
      catalogPriceMinor: x.precioUnitarioMinor,
      tracksStock: false,
      stockQty: null,
    }));
    for (const n of nuevos) todasLabRef.current.add(n.key);
    const viejas = laboratorio.keys;
    const tiene = (filas: readonly TicketRow[]) => filas.some((r) => viejas.includes(r.key));
    if (tiene(rowsRef.current)) {
      historialRef.current = historialRef.current.map((h) => (tiene(h) ? reemplazarGrupoLab(h, viejas, nuevos) : h));
      setRows((prev) => reemplazarGrupoLab(prev, viejas, nuevos));
    } else {
      cambiarRenglones((prev) => reemplazarGrupoLab(prev, viejas, nuevos));
    }
    setLaboratorio({ preparacionId: laboratorio.preparacionId, keys: nuevos.map((n) => n.key) });
    setLabAbierto(false);
    setEditandoPrecio(null);
    if (nuevos[0]) setActivo(nuevos[0].key);
  }

  /** «Quitar pedido para laboratorio»: saca todo el grupo y anula la preparación. */
  function quitarLaboratorio() {
    if (!laboratorio || procesando) return;
    const { preparacionId, keys } = laboratorio;
    cambiarRenglones((prev) => prev.filter((r) => !keys.includes(r.key)));
    setLaboratorio(null);
    setLabAbierto(false);
    anularPreparacionAction(preparacionId)
      .then((r) => {
        if (!r.ok) setError(r.error);
      })
      .catch(() => setError("No se pudo anular el pedido para laboratorio. Revisá la conexión."));
  }

  /**
   * El libro entra con el producto que abrió la calculadora (o suelto, desde «+ Fotolibro») y la caja
   * en su propio renglón: el producto "Caja para fotolibro" si está en el catálogo. La caja queda
   * marcada «Seña» para que viaje en el pedido junto con el libro.
   */
  function agregarFotolibro(f: FotolibroAgregado) {
    limpiarAviso();
    const productId = calculadora?.productId ?? null;
    const renglon = (l: LineaFotolibro, pid: string | null): TicketRow => ({
      key: nuevaKey(),
      productId: pid,
      variantId: null,
      description: l.descripcion,
      qty: 1,
      unitPriceMinor: l.precioMinor,
      unitCostMinor: l.costoMinor,
      priceWasOverridden: false,
      catalogPriceMinor: null,
      tracksStock: false,
      stockQty: null,
    });
    const libro = renglon(f.libro, productId);
    const caja = f.caja ? renglon(f.caja, products.find((p) => esSkuCajaFotolibro(p.sku))?.id ?? null) : null;
    setActivo(libro.key);
    cambiarRenglones((prev) => [...prev, libro, ...(caja ? [caja] : [])]);
    if (productId) setFotolibros((m) => ({ ...m, [libro.key]: { ...f.eleccion, templateId: null } }));
    if (caja && senaHabilitada) setParaRetirar((m) => ({ ...m, [caja.key]: true }));
    setCalculadora(null);
  }

  /** «Crear fotolibro»: el fotolibro vacío con lo elegido, abierto en otra pestaña. Si no, se crea al cobrar. */
  async function crearFotolibroDelRenglon(key: string) {
    const f = fotolibros[key];
    if (!f || creandoFotolibro) return;
    // La pestaña se abre ya, con el clic: después de esperar al servidor el navegador la bloquea.
    const pestana = window.open("", "_blank");
    setCreandoFotolibro(key);
    try {
      const r = await crearFotolibroDesdeCobradorAction({ eleccion: f, cliente: cliente?.nombre ?? null });
      if (!r.ok) {
        pestana?.close();
        return setError(r.error);
      }
      setFotolibros((m) => (m[key] ? { ...m, [key]: { ...m[key], templateId: r.templateId, url: r.url } } : m));
      if (pestana) pestana.location.href = r.url;
      else window.open(r.url, "_blank");
    } catch {
      pestana?.close();
      setError("No se pudo crear el fotolibro. Probá de nuevo: si no, se crea solo al cobrar.");
    } finally {
      setCreandoFotolibro(null);
    }
  }

  function agregarSuelto() {
    const descripcion = sueltoDescripcion.trim();
    const precio = parseArsToMinor(sueltoPrecio);
    if (descripcion === "" || precio === null) return;
    limpiarAviso();
    const key = nuevaKey();
    setActivo(key);
    cambiarRenglones((prev) => [
      ...prev,
      {
        key,
        productId: null,
        variantId: null,
        description: descripcion,
        qty: 1,
        unitPriceMinor: precio,
        unitCostMinor: null,
        priceWasOverridden: false,
        catalogPriceMinor: null,
        tracksStock: false,
        stockQty: null,
      },
    ]);
    setSueltoDescripcion("");
    setSueltoPrecio("");
    setMostrarSuelto(false);
  }

  /** Abre el editor (foto carnet o copias) de un renglón; la preparación se crea la primera vez. */
  async function abrirPreparacion(r: TicketRow) {
    // Mientras se cobra no se abre: el ticket está por reiniciarse.
    if (!r.productId || abriendoPreparacion || procesando) return;
    let id = preparaciones[r.key] ?? null;
    if (!id) {
      setAbriendoPreparacion(r.key);
      try {
        const c = await crearPreparacionAction({ productId: r.productId, clientId: cliente?.id ?? null });
        if (!c.ok) return setError(c.error);
        id = c.id;
        const nuevo = id;
        setPreparaciones((ps) => ({ ...ps, [r.key]: nuevo }));
      } catch {
        return setError("No se pudo abrir la preparación. Probá de nuevo.");
      } finally {
        setAbriendoPreparacion(null);
      }
    }
    // Si el renglón se borró (o se cobró el ticket) mientras se creaba la preparación, no se abre.
    if (!rowsRef.current.some((x) => x.key === r.key)) return;
    setPreparando({ key: r.key, preparacionId: id });
  }

  function marcarCopiasSinTerminar(key: string, sinTerminar: boolean) {
    setCopiasSinTerminar((s) => {
      if (s.has(key) === sinTerminar) return s;
      const n = new Set(s);
      if (sinTerminar) n.add(key);
      else n.delete(key);
      return n;
    });
  }

  /**
   * Copias cerradas sin "Listo": se vuelve a leer lo guardado. Si quedó completa, el renglón toma el
   * total de copias; si no, conserva su cantidad y avisa "Copias sin terminar".
   */
  async function alCerrarCopias(key: string, preparacionId: string) {
    const total = await copiasTerminadas(preparacionId);
    // Si el renglón se borró (o se cobró el ticket) mientras se leía, no se toca nada.
    const renglon = rowsRef.current.find((x) => x.key === key);
    if (!renglon) return;
    marcarCopiasSinTerminar(key, total === null);
    if (total !== null && renglon.qty !== total) actualizarCantidad(key, total);
  }

  function reiniciarTicket() {
    setRows([]);
    setPreparaciones({});
    setFotolibros({});
    setParaRetirar({});
    setPreparando(null);
    setCopiasSinTerminar(new Set());
    setLaboratorio(null);
    setLabAbierto(false);
    todasLabRef.current = new Set();
    setDiscountText("");
    setNote("");
    setPaymentMethod("EFECTIVO");
    setRecibidoText("");
    setEditandoPrecio(null);
    setCliente(null);
    setEntregaElegida(null);
    setConSena(true);
    setSenaText("");
    setPagoVerificado(null);
    setPagoQr(null);
  }

  /**
   * La parte del ticket que queda como pedido: los renglones de productos con proceso y los
   * marcados «Seña» (misma separación que hace el servidor). Lo demás se lleva en el momento y se
   * paga entero. El descuento se reparte en proporción.
   */
  function calcularPedido() {
    const filas = separarTicket(
      // Los renglones del pedido para laboratorio van siempre al pedido (como los marcados «Seña»).
      rows.map((r) => ({ ...r, paraRetirar: paraRetirar[r.key] === true || keysLab.has(r.key) })),
      conProceso,
    ).delPedido;
    const subPedido = filas.reduce((a, r) => a + r.qty * r.unitPriceMinor, 0);
    const subVenta = totals.subtotalMinor - subPedido;
    const desc = repartirDescuento(subPedido, subVenta, discountMinor);
    const totalPedido = subPedido - desc.pedido;
    const totalVenta = subVenta - desc.venta;
    // Con regla, su plazo (7 si no tiene cargado); marcado «Seña» sin regla, el plazo estándar.
    const plazo = filas.reduce(
      (max, r) => Math.max(max, tieneProceso(r) ? (procesos[r.productId as string] ?? 7) : PLAZO_SIN_REGLA_DIAS),
      0,
    );
    const entrega = entregaElegida ?? sugerirEntrega(hoyEnArgentina(), plazo);
    const senaTipeada = parseArsToMinor(senaText);
    const sena = conSena ? Math.min(senaTipeada ?? senaSugerida(totalPedido), totalPedido) : null;
    return {
      hay: filas.length > 0,
      filas: filas.length,
      totalPedido,
      totalVenta,
      entrega,
      sena,
      aCobrar: filas.length > 0 ? aCobrarAhora(totalVenta, totalPedido, sena) : totals.totalMinor,
    };
  }

  function cobrar(qr?: { id: string; montoMinor: number }) {
    limpiarAviso();
    // Con los valores de este instante (no los del último dibujo).
    const pedido = calcularPedido();
    const validacion = validateTicket(rows, discountMinor);
    if (!validacion.ok) {
      setError(validacion.error);
      return;
    }
    if (pedido.hay && !cliente) {
      setError("Elegí el cliente: hay trabajos que quedan como pedido para retirar.");
      return;
    }
    // Etapa 1: el cobro con pedido no ata preparaciones; se cobran en un ticket aparte.
    if (pedido.hay && rows.some((r) => preparaciones[r.key])) {
      setError("Las fotos preparadas se cobran solas: sacá los trabajos de pedido a otro ticket.");
      return;
    }
    // Pagado con el QR del mostrador: la order viaja y el servidor la vuelve a leer en Mercado Pago.
    const qrDelTicket = qr ?? pagoQr;
    const mpOrderId =
      paymentMethod === "MERCADO_PAGO" && qrDelTicket && qrDelTicket.montoMinor === pedido.aCobrar ? qrDelTicket.id : null;
    const recibidoMinor = paymentMethod === "EFECTIVO" ? parseArsToMinor(recibidoText) : null;
    const vueltoAlCobrar = calcularVuelto(pedido.aCobrar, recibidoMinor);
    if (vueltoAlCobrar.estado === "falta") {
      setError(`Con lo que entregó faltan ${formatMinorArs(vueltoAlCobrar.faltaMinor)}.`);
      return;
    }
    // Con cuánto pagó y el vuelto quedan en la nota de la venta: ayudan a explicar una
    // diferencia en el arqueo sin agregar columnas a la base.
    const notaDePago =
      vueltoAlCobrar.estado === "ok" && recibidoMinor !== null
        ? `Pagó con ${formatMinorArs(recibidoMinor)} · vuelto ${formatMinorArs(vueltoAlCobrar.vueltoMinor)}`
        : "";
    const notaFinal = [note.trim(), notaDePago].filter((t) => t !== "").join(" — ");
    const comisionDelTicket = rows.reduce((s, r) => s + (comisionDelRenglon(r) ?? 0), 0);
    // El pedido para laboratorio viaja sólo con su grupo entero en el ticket. Una preparación que
    // quedó sin renglones (se vació el ticket) se anula al cobrar: si no, quedaría colgada.
    const lab = laboratorio;
    const labVigente = lab !== null && lab.keys.length > 0 && lab.keys.every((k) => rows.some((r) => r.key === k));
    const labSinUsar = lab !== null && !labVigente ? lab.preparacionId : null;
    const soltarLabSinUsar = () => {
      if (labSinUsar) void anularPreparacionAction(labSinUsar).catch(() => undefined);
    };

    const input: CheckoutInput = {
      // `priceWasOverridden` no viaja: lo recalcula el servidor comparando contra el precio
      // de catálogo (ver el comentario de `buildTicketLines`). Lo que se ve acá en pantalla
      // (`r.priceWasOverridden`) es sólo el aviso inmediato del mostrador, con el precio que
      // ya llegó cargado — no la fuente de verdad de la auditoría.
      lines: rows.map((r) => ({
        productId: r.productId,
        variantId: r.variantId,
        description: r.description,
        qty: r.qty,
        unitPriceMinor: r.unitPriceMinor,
        preparacionId: preparaciones[r.key] ?? null,
      })),
      discountMinor,
      paymentMethod,
      note: notaFinal,
      client: cliente ? { mode: "existing", clientId: cliente.id } : { mode: "none" },
      mpPaymentId: mpOrderId ? null : verificadoPara(pedido.aCobrar),
      mpOrderId,
    };

    if (pedido.hay && cliente) {
      if (!claveCobroRef.current) claveCobroRef.current = `mos-${crypto.randomUUID()}`;
      const clave = claveCobroRef.current;
      startTransition(async () => {
        const r = await cobrarConPedidoAction({
          lines: rows.map((r) => ({
            productId: r.productId,
            variantId: r.variantId ?? null,
            description: r.description,
            qty: r.qty,
            unitPriceMinor: r.unitPriceMinor,
            paraRetirar: !tieneProceso(r) && paraRetirar[r.key] === true,
            fotolibro: fotolibros[r.key] ? { ...fotolibros[r.key], url: undefined } : undefined,
            ...(labVigente && keysLab.has(r.key) ? { paraLaboratorio: true } : {}),
          })),
          discountMinor,
          paymentMethod,
          note: notaFinal,
          clientId: cliente.id,
          entrega: pedido.entrega,
          senaMinor: pedido.sena,
          clave,
          mpPaymentId: mpOrderId ? null : verificadoPara(pedido.aCobrar),
          mpOrderId,
          laboratorio: labVigente ? { preparacionId: lab.preparacionId } : null,
        });
        // Una respuesta que llega tarde, de un cobro que ya se cerró (la clave cambió o se limpió),
        // no toca el ticket que se está armando ahora: ese cobro ya mostró su resultado.
        if (claveCobroRef.current !== clave) return;
        if (r.ok) {
          claveCobroRef.current = null;
          setUltimaVenta({
            saleNumber: r.saleNumber,
            deposited: true,
            vueltoMinor: vueltoAlCobrar.estado === "ok" ? vueltoAlCobrar.vueltoMinor : null,
            pedido: {
              numero: r.pedidoNumero,
              cobradoMinor: r.cobradoMinor,
              saldoMinor: r.saldoMinor,
              aviso: r.aviso,
              grabar: r.grabar ?? [],
              laboratorios: r.laboratorios ?? [],
            },
            comision: comisionDelTicket > 0 ? { minor: comisionDelTicket, ganada: r.saldoMinor <= 0 } : null,
          });
          refrescarComision();
          soltarLabSinUsar();
          reiniciarTicket();
          historialRef.current = [];
          setActivo(null);
          searchRef.current?.focus();
        } else {
          setError(r.error);
        }
      });
      return;
    }

    startTransition(async () => {
      const resultado = await checkoutAction(input);
      if (resultado.ok) {
        setUltimaVenta({
          saleNumber: resultado.saleNumber,
          deposited: resultado.deposited,
          vueltoMinor: vueltoAlCobrar.estado === "ok" ? vueltoAlCobrar.vueltoMinor : null,
          comision: comisionDelTicket > 0 ? { minor: comisionDelTicket, ganada: true } : null,
        });
        refrescarComision();
        soltarLabSinUsar();
        reiniciarTicket();
        // Lo cobrado no se deshace con Ctrl/⌘+Z: para eso está anular la venta.
        historialRef.current = [];
        setActivo(null);
        searchRef.current?.focus();
      } else {
        setError(resultado.error);
      }
    });
  }

  /** + / − sobre el objetivo. Un producto del catálogo que todavía no está en el ticket se agrega. */
  function sumarUno(objetivo: Objetivo, delta: 1 | -1) {
    const key =
      objetivo.tipo === "renglon"
        ? objetivo.key
        : rowsRef.current.find((r) => r.productId === objetivo.id && r.variantId === null && !esRenglonLab(r.key))?.key;
    if (!key) {
      if (objetivo.tipo === "producto" && delta > 0) {
        const p = products.find((x) => x.id === objetivo.id);
        if (p) agregarProducto(p);
      }
      return;
    }
    const renglon = rowsRef.current.find((r) => r.key === key);
    if (!renglon) return;
    if (renglon.qty + delta < 1) quitarRenglon(key);
    else actualizarCantidad(key, renglon.qty + delta);
    setActivo(key);
  }

  /** Un número tipeado sobre el objetivo: esa es la cantidad (0 lo quita). */
  function fijarCantidad(objetivo: Objetivo, cantidad: number) {
    if (objetivo.tipo === "producto") {
      const enTicket = rowsRef.current.find((r) => r.productId === objetivo.id && r.variantId === null && !esRenglonLab(r.key));
      if (enTicket) {
        fijarCantidad({ tipo: "renglon", key: enTicket.key }, cantidad);
        return;
      }
      const p = products.find((x) => x.id === objetivo.id);
      if (p && cantidad > 0) agregarProducto(p, null, cantidad);
      return;
    }
    if (cantidad === 0) quitarRenglon(objetivo.key);
    else actualizarCantidad(objetivo.key, cantidad);
    setActivo(objetivo.key);
  }

  function terminarTipeo(aplicar: boolean) {
    const tipeo = tipeoRef.current;
    tipeoRef.current = null;
    setCantidadTipeada(null);
    if (!tipeo) return;
    if (tipeo.timer) clearTimeout(tipeo.timer);
    if (aplicar) fijarCantidad(tipeo.objetivo, Number(tipeo.texto));
  }

  /** Lo que se tipeó pasa al buscador (letras, o un código largo que manda el lector). */
  function escribirEnBuscador(texto: string) {
    const input = searchRef.current;
    input?.focus();
    setSearch((prev) => prev + texto);
    setResaltado(0);
  }

  /**
   * Atajos del mostrador, en toda la pantalla:
   * - + o = suman uno, − resta uno, al renglón o tarjeta donde está parado (o al último tocado).
   * - Un número (hasta 3 cifras) fija esa cantidad. Más cifras seguidas son un código de barras:
   *   van al buscador, así el lector sigue funcionando aunque el puntero esté sobre un producto.
   * - Letras: van directo al buscador.
   * - Esc: cierra lo abierto o vacía el ticket (se puede deshacer).
   * - Ctrl/⌘+Z deshace; Ctrl/⌘+Enter cobra.
   * Dentro de un campo (precio, descuento, "paga con"…) el teclado es del campo, salvo el
   * buscador vacío, que es donde queda el cursor casi siempre.
   */
  function manejarAtajo(e: KeyboardEvent) {
    if (e.defaultPrevented || procesando) return;
    // Con una ventana abierta (cliente nuevo, egreso), el teclado es de la ventana.
    if (document.querySelector("[data-mostrador-modal]")) return;
    const t = e.target as HTMLElement | null;
    const enBuscador = t !== null && t === searchRef.current;
    const enCampo =
      t !== null && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    const buscadorVacio = (searchRef.current?.value ?? "") === "";
    const libre = !enCampo || (enBuscador && buscadorVacio);
    const mod = e.metaKey || e.ctrlKey;

    if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
      if (!libre) return;
      e.preventDefault();
      terminarTipeo(false);
      deshacer();
      return;
    }
    if (mod && e.key === "Enter") {
      e.preventDefault();
      terminarTipeo(true);
      cobrar();
      return;
    }
    if (mod || e.altKey || !libre) return;

    const tipeo = tipeoRef.current;
    if (/^[0-9]$/.test(e.key)) {
      const objetivo = tipeo?.objetivo ?? objetivoActual();
      if (!objetivo) return; // sin nada en el ticket, el número va al buscador como siempre
      e.preventDefault();
      const texto = (tipeo?.texto ?? "") + e.key;
      if (tipeo?.timer) clearTimeout(tipeo.timer);
      if (texto.length > MAX_CIFRAS_CANTIDAD) {
        terminarTipeo(false);
        escribirEnBuscador(texto);
        return;
      }
      tipeoRef.current = { texto, objetivo, timer: setTimeout(() => terminarTipeo(true), ESPERA_CANTIDAD_MS) };
      setCantidadTipeada({ texto, nombre: nombreDe(objetivo) });
      return;
    }
    if (e.key === "Enter" && tipeo) {
      e.preventDefault();
      terminarTipeo(true);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (tipeo) terminarTipeo(false);
      else if (eligiendoTalle) setEligiendoTalle(null);
      else vaciarTicket();
      return;
    }
    if (e.key === "+" || e.key === "=" || e.key === "-") {
      const objetivo = objetivoActual();
      if (!objetivo) return;
      e.preventDefault();
      terminarTipeo(true);
      sumarUno(objetivo, e.key === "-" ? -1 : 1);
      return;
    }
    if (e.key.length === 1 && /\S/.test(e.key)) {
      // Una letra con una cantidad a medio tipear: era una búsqueda ("10x15"), no una cantidad.
      const previo = tipeo?.texto ?? "";
      if (tipeo) terminarTipeo(false);
      if (enBuscador && previo === "") return; // el buscador ya la escribe solo
      e.preventDefault();
      escribirEnBuscador(previo + e.key);
    }
  }

  const atajoRef = useRef(manejarAtajo);
  useEffect(() => {
    atajoRef.current = manejarAtajo;
  });
  useEffect(() => {
    const escuchar = (e: KeyboardEvent) => atajoRef.current(e);
    window.addEventListener("keydown", escuchar);
    return () => window.removeEventListener("keydown", escuchar);
  }, []);

  const pedido = calcularPedido();
  const vuelto = calcularVuelto(pedido.aCobrar, paymentMethod === "EFECTIVO" ? parseArsToMinor(recibidoText) : null);
  const unidades = rows.reduce((acc, r) => acc + r.qty, 0);
  const cantidadEnTicket = (productId: string) =>
    rows.filter((r) => r.productId === productId).reduce((acc, r) => acc + r.qty, 0);
  const extrasCargados = discountMinor > 0 || note.trim() !== "";

  return (
    <div className="grid gap-4 pb-24 lg:grid-cols-[300px_minmax(0,1fr)] lg:pb-0 xl:grid-cols-[minmax(300px,1fr)_minmax(0,1.15fr)_330px]">
      {/* Catálogo: una columna angosta. Escribir filtra; ↑ ↓ y Enter la recorren. */}
      <section className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:row-span-2 lg:max-h-[calc(100vh-2rem)] lg:self-start xl:row-span-1">
        {!cashEnabled ? (
          <div className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-3 text-xs text-[var(--fo-warning)]">
            La Caja está apagada: las ventas se registran, pero el dinero no entra al libro.
          </div>
        ) : null}

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fo-muted)]"
            aria-hidden
          />
          <input
            ref={searchRef}
            autoFocus
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setResaltado(0);
            }}
            onKeyDown={onSearchKeyDown}
            className="fo-input h-11 !pl-9 text-sm"
            placeholder="Nombre o código de barras"
            aria-label="Buscar producto o servicio"
            aria-controls="pos-catalogo"
            autoComplete="off"
          />
          {buscando ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--fo-muted)]">Buscando…</span>
          ) : null}
        </div>

        {categories.length > 0 ? (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="fo-input h-9 text-sm"
            aria-label="Categoría"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}

        {eligiendoTalle ? (
          <SelectorDeTalle
            product={eligiendoTalle}
            onElegir={(talle) => {
              agregarProducto(eligiendoTalle, talle);
              searchRef.current?.focus();
            }}
            onCancelar={() => {
              setEligiendoTalle(null);
              searchRef.current?.focus();
            }}
          />
        ) : null}

        <div
          id="pos-catalogo"
          className="fo-card min-h-0 flex-1 overflow-y-auto p-1"
          role="listbox"
          aria-label="Catálogo"
        >
          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-[var(--fo-muted)]">
              <Package className="size-6" aria-hidden />
              {buscando ? "Buscando en todo el catálogo…" : "Nada coincide. Si no está, usá «+ Otro importe»."}
            </div>
          ) : (
            filtrados.map((p, i) => {
              const sinStock = p.tracksStock && p.stockQty <= 0;
              const enTicket = cantidadEnTicket(p.id);
              const marcadaPorTeclado = search.trim() !== "" && i === resaltado;
              const codigo = p.barcode ?? p.sku;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={marcadaPorTeclado}
                  onClick={() => agregarProducto(p)}
                  onMouseEnter={() => setApuntado({ tipo: "producto", id: p.id })}
                  onMouseLeave={() => setApuntado(null)}
                  onFocus={() => setApuntado({ tipo: "producto", id: p.id })}
                  onBlur={() => setApuntado(null)}
                  ref={marcadaPorTeclado ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-[var(--fo-radius-sm)] px-2 py-1.5 text-left transition ${
                    marcadaPorTeclado ? "bg-[var(--fo-accent-muted)]" : "hover:bg-[var(--fo-surface-hover)]"
                  }`}
                >
                  <span
                    className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg)] text-[var(--fo-muted)]"
                    onMouseEnter={
                      p.imageUrl
                        ? (e) => {
                            // A la derecha de la columna del catálogo, para no tapar los nombres de la lista.
                            const r = e.currentTarget.getBoundingClientRect();
                            const columna = e.currentTarget.closest("#pos-catalogo")?.getBoundingClientRect();
                            setFotoGrande({ src: p.imageUrl!, x: (columna?.right ?? r.right) + 12, y: r.top + r.height / 2 });
                          }
                        : undefined
                    }
                    onMouseLeave={() => setFotoGrande(null)}
                  >
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="size-4" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[13px] font-medium leading-snug text-[var(--fo-text)]">{p.name}</span>
                    {codigo || p.variants.length > 0 || sinStock ? (
                      <span className="block truncate text-[11px] text-[var(--fo-muted)]">
                        {[codigo, p.variants.length > 0 ? `${p.variants.length} talles` : null].filter(Boolean).join(" · ")}
                        {sinStock ? <span className="font-semibold text-[var(--fo-danger)]"> Sin existencia</span> : null}
                      </span>
                    ) : null}
                    {comision && conComision.has(p.id) ? (
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] px-1.5 text-[11px] font-semibold text-[var(--fo-success)]">
                        <BadgePercent className="size-3" aria-hidden />
                        Comisión de venta {String(comision.porcentaje).replace(".", ",")} %
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[13px] font-semibold tabular-nums">{formatMinorArs(p.priceMinor).replace(",00", "")}</span>
                    {enTicket > 0 ? (
                      <span className="rounded-full bg-[var(--fo-accent)] px-1.5 text-[11px] font-semibold text-[var(--fo-on-accent,#fff)]">
                        ×{enTicket}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Centro: el carrito, siempre a la vista. */}
      <section className="fo-card h-fit min-w-0 overflow-hidden p-0" aria-label="Lo que lleva">
        {miComision ? (
          <a
            href="/ventas/comisiones"
            className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] px-4 py-2 text-sm"
          >
            <span className="flex items-center gap-1.5 font-semibold text-[var(--fo-success)]">
              <BadgePercent className="size-4" aria-hidden />
              Tus comisiones este mes: {formatMinorArs(miComision.resumen.mesMinor).replace(/,00$/, "")}
            </span>
            {miComision.resumen.aCobrarMinor > 0 ? (
              <span className="text-xs text-[var(--fo-muted)]">
                + {formatMinorArs(miComision.resumen.aCobrarMinor).replace(/,00$/, "")} cuando se cobren los saldos
              </span>
            ) : null}
          </a>
        ) : null}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--fo-border)] px-4 py-3">
          <h2 className="flex items-baseline gap-2 whitespace-nowrap text-base font-semibold">
            Ticket
            {unidades > 0 ? (
              <span className="text-sm font-normal text-[var(--fo-muted)]">
                · {unidades} {unidades === 1 ? "artículo" : "artículos"}
              </span>
            ) : null}
          </h2>
          <div className="flex items-center gap-1">
            {egresos ? (
              <button
                type="button"
                onClick={() => setEgresoAbierto(true)}
                className="fo-btn fo-btn-ghost gap-1 whitespace-nowrap px-2 text-xs text-[var(--fo-danger)]"
                title="Anotar algo que sale de la caja: insumos, un pago, un retiro"
              >
                <ArrowUpRight className="size-3.5" aria-hidden />
                Egreso
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setMostrarSuelto((v) => !v)}
              className="fo-btn fo-btn-ghost whitespace-nowrap px-2 text-xs"
            >
              + Otro
            </button>
            {hayCopiasLab ? (
              <button
                type="button"
                onClick={() => void abrirLaboratorio()}
                disabled={abriendoLab || procesando}
                className="fo-btn fo-btn-ghost gap-1 whitespace-nowrap px-2 text-xs"
                title={laboratorio ? "Volver a abrir las fotos del pedido para laboratorio" : "Subir fotos que se mandan a imprimir al laboratorio"}
              >
                <Images className="size-3.5" aria-hidden />
                {abriendoLab ? "Abriendo…" : "Pedido para laboratorio"}
              </button>
            ) : null}
            {fotolibro ? (
              <button
                type="button"
                onClick={() => setCalculadora((c) => (c ? null : { productId: null, tipo: null, titulo: "Fotolibro", proveedorInicial: null }))}
                className="fo-btn fo-btn-ghost whitespace-nowrap px-2 text-xs"
              >
                + Fotolibro
              </button>
            ) : null}
            {rows.length > 0 ? (
              <button
                type="button"
                onClick={vaciarTicket}
                className="flex size-8 items-center justify-center rounded-full text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-danger)]"
                aria-label="Vaciar el ticket"
                title="Vaciar el ticket"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        <div className="px-4">
          {calculadora && fotolibro ? (
            <div className="my-3">
              <CalculadoraFotolibro
                key={calculadora.productId ?? "libre"}
                catalogo={fotolibro.catalogo}
                verCostos={fotolibro.verCostos}
                onAgregar={agregarFotolibro}
                onCerrar={() => setCalculadora(null)}
                textoAgregar="Agregar al ticket"
                tipo={calculadora.tipo}
                titulo={calculadora.titulo}
                proveedorInicial={calculadora.proveedorInicial}
              />
            </div>
          ) : null}
          {mostrarSuelto ? (
            <div className="my-3 space-y-2 rounded-[var(--fo-radius-sm)] border border-dashed border-[var(--fo-border)] p-3">
              <p className="fo-helper">Algo que no está en el catálogo. No mueve stock.</p>
              <input
                value={sueltoDescripcion}
                onChange={(e) => setSueltoDescripcion(e.target.value)}
                placeholder="Qué es"
                className="fo-input"
                autoFocus
              />
              <div className="flex gap-2">
                <InputMoneda
                  value={sueltoPrecio}
                  onChange={setSueltoPrecio}
                  placeholder="Precio"
                  aria-label="Precio"
                  wrapperClassName="min-w-0 flex-1"
                />
                <button type="button" onClick={agregarSuelto} className="fo-btn fo-btn-secondary text-sm">
                  Agregar
                </button>
              </div>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-[var(--fo-muted)]">
              <ShoppingCart className="size-8" aria-hidden />
              <p className="text-sm">Tocá un producto para sumarlo.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--fo-border)]">
              {rows.map((r) => {
                const marcado =
                  apuntado?.tipo === "renglon"
                    ? apuntado.key === r.key
                    : apuntado === null && r.key === (activo ?? rows.at(-1)?.key);
                // Del pedido para laboratorio: bloqueado (se cambia desde el editor, que abre al tocarlo).
                const delLab = keysLab.has(r.key);
                return (
                  <li
                    key={r.key}
                    onMouseEnter={() => setApuntado({ tipo: "renglon", key: r.key })}
                    onMouseLeave={() => setApuntado(null)}
                    onClick={() => {
                      setActivo(r.key);
                      if (delLab) void abrirLaboratorio();
                    }}
                    title={delLab ? "Tocá para ver o cambiar las fotos del pedido para laboratorio" : undefined}
                    className={`-mx-4 flex items-center gap-3 px-4 py-2.5 transition-colors ${delLab ? "cursor-pointer" : ""} ${marcado ? "bg-[var(--fo-accent-muted)]" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      {/* Las etiquetas van en su propia línea: dentro del texto recortado a dos líneas,
                          en pantallas angostas tapaban el nombre del producto. */}
                      {tieneProceso(r) || paraRetirar[r.key] || delLab ? (
                        <div className="mb-0.5 flex flex-wrap gap-1.5">
                          <span className="inline-flex rounded-full bg-[var(--fo-accent-muted)] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[var(--fo-text-secondary)]">
                            Pedido
                          </span>
                          {delLab ? (
                            <span className="inline-flex rounded-full border border-[var(--fo-border)] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[var(--fo-text-secondary)]">
                              Laboratorio
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-[var(--fo-text)]">{r.description}</p>
                      {/* Un producto con proceso ya es un pedido: muestra «Seña» prendido y fijo, para
                          que todos los renglones se vean igual. Uno sin proceso puede quedar señado. */}
                      {delLab ? null : tieneProceso(r) ? (
                        <span
                          title="Este producto se produce después: siempre va como pedido. Seña o pago total se eligen abajo."
                          className="mt-1 inline-flex h-6 cursor-default items-center rounded-full border border-[var(--fo-accent)] bg-[var(--fo-accent-muted)] px-2 text-[11px] font-medium text-[var(--fo-text)]"
                        >
                          Seña
                        </span>
                      ) : senaHabilitada ? (
                        <button
                          type="button"
                          aria-pressed={paraRetirar[r.key] === true}
                          title="Deja seña y lo retira después"
                          disabled={procesando}
                          onClick={(e) => {
                            e.stopPropagation();
                            setParaRetirar((m) => ({ ...m, [r.key]: !m[r.key] }));
                          }}
                          className={`mt-1 inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-medium transition-colors ${
                            paraRetirar[r.key]
                              ? "border-[var(--fo-accent)] bg-[var(--fo-accent-muted)] text-[var(--fo-text)]"
                              : "border-[var(--fo-border)] text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
                          }`}
                        >
                          Seña
                        </button>
                      ) : null}
                      {!delLab && r.productId !== null && (produccion[r.productId]?.tipoPieza === "CARNET" || produccion[r.productId]?.tipoPieza === "COPIA") ? (
                        <button
                          type="button"
                          className="fo-btn fo-btn-secondary mt-1 h-7 px-2 text-xs"
                          disabled={abriendoPreparacion !== null || procesando}
                          onClick={(e) => {
                            e.stopPropagation();
                            void abrirPreparacion(r);
                          }}
                        >
                          {produccion[r.productId]?.tipoPieza === "COPIA" ? <Images className="size-3.5" aria-hidden /> : <IdCard className="size-3.5" aria-hidden />}
                          {abriendoPreparacion === r.key ? "Abriendo…" : preparaciones[r.key] ? "Editar fotos" : "Preparar"}
                        </button>
                      ) : null}
                      {fotolibros[r.key] ? (
                        <button
                          type="button"
                          className="fo-btn fo-btn-secondary mt-1 h-7 px-2 text-xs"
                          disabled={creandoFotolibro !== null || procesando}
                          title={fotolibros[r.key]!.templateId ? "El fotolibro ya está creado: se ata al trabajo al cobrar." : "Crea el fotolibro con esta medida y estas hojas. Si no, se crea solo al cobrar."}
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = fotolibros[r.key]!.url;
                            if (url) window.open(url, "_blank");
                            else void crearFotolibroDelRenglon(r.key);
                          }}
                        >
                          <BookOpen className="size-3.5" aria-hidden />
                          {creandoFotolibro === r.key ? "Creando…" : fotolibros[r.key]!.templateId ? "Abrir fotolibro" : "Crear fotolibro"}
                        </button>
                      ) : null}
                      {copiasSinTerminar.has(r.key) ? <span className="ml-2 text-xs font-medium text-[var(--fo-warning)]">Copias sin terminar</span> : null}
                      {delLab ? (
                        <p className="text-xs text-[var(--fo-muted)]">{formatMinorArs(r.unitPriceMinor)} c/u</p>
                      ) : editandoPrecio === r.key ? (
                        <InputMoneda
                          autoFocus
                          defaultValue={formatMinorArs(r.unitPriceMinor).replace("$", "").trim()}
                          onBlur={(e) => {
                            actualizarPrecio(r.key, e.target.value);
                            setEditandoPrecio(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                          className="fo-input h-8 text-sm"
                          wrapperClassName="mt-1 w-32"
                          aria-label={`Precio unitario de ${r.description}`}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditandoPrecio(r.key)}
                          className="text-xs text-[var(--fo-muted)] underline-offset-2 hover:text-[var(--fo-accent)] hover:underline"
                          title="Cambiar el precio"
                        >
                          {formatMinorArs(r.unitPriceMinor)} c/u
                          {r.priceWasOverridden ? " · precio cambiado" : ""}
                        </button>
                      )}
                      {r.tracksStock && r.stockQty !== null && r.stockQty <= 0 ? (
                        <p className="text-xs font-semibold text-[var(--fo-danger)]">Sin existencia cargada</p>
                      ) : null}
                      {comisionDelRenglon(r) ? (
                        <p className="text-xs font-semibold text-[var(--fo-success)]">
                          Ganás {formatMinorArs(comisionDelRenglon(r)!).replace(/,00$/, "")} cuando se cobre el total
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center rounded-full border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)]">
                      <button
                        type="button"
                        disabled={delLab}
                        onClick={() => (r.qty > 1 ? actualizarCantidad(r.key, r.qty - 1) : quitarRenglon(r.key))}
                        className="flex size-7 items-center justify-center rounded-full text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)] disabled:pointer-events-none disabled:opacity-30"
                        aria-label={r.qty > 1 ? `Uno menos de ${r.description}` : `Quitar ${r.description}`}
                      >
                        {r.qty > 1 ? <Minus className="size-3.5" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />}
                      </button>
                      <span className="w-7 text-center text-sm font-semibold tabular-nums">{r.qty}</span>
                      <button
                        type="button"
                        disabled={delLab}
                        onClick={() => actualizarCantidad(r.key, r.qty + 1)}
                        className="flex size-7 items-center justify-center rounded-full text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)] disabled:pointer-events-none disabled:opacity-30"
                        aria-label={`Uno más de ${r.description}`}
                      >
                        <Plus className="size-3.5" aria-hidden />
                      </button>
                    </div>
                    <p className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">
                      {formatMinorArs(r.qty * r.unitPriceMinor)}
                    </p>
                  </li>
                );
              })}
              {rows.some((r) => keysLab.has(r.key)) ? (
                <li className="-mx-4 px-4 py-2">
                  <button
                    type="button"
                    onClick={quitarLaboratorio}
                    disabled={procesando}
                    className="fo-btn fo-btn-ghost gap-1 px-2 text-xs text-[var(--fo-danger)]"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Quitar pedido para laboratorio
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </div>
        <p
          className="hidden flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--fo-border)] px-4 py-2.5 text-[11px] text-[var(--fo-muted)] lg:flex"
          aria-label="Atajos de teclado"
        >
          <span>
            <Tecla>+</Tecla> <Tecla>−</Tecla> cantidad
          </span>
          <span>
            <Tecla>10</Tecla> fija 10
          </span>
          <span>
            <Tecla>↑</Tecla> <Tecla>↓</Tecla> <Tecla>Enter</Tecla> catálogo
          </span>
          <span>
            <Tecla>Esc</Tecla> vaciar
          </span>
          <span>
            <Tecla>{esMac ? "⌘" : "Ctrl"}</Tecla>+<Tecla>Z</Tecla> deshacer
          </span>
          <span>
            <Tecla>{esMac ? "⌘" : "Ctrl"}</Tecla>+<Tecla>Enter</Tecla> cobrar
          </span>
        </p>

      </section>

      {/* Derecha: cliente, total, cómo paga y cobrar. */}
      <section
        id="ticket"
        className="fo-card h-fit min-w-0 overflow-visible p-0 lg:col-start-2 xl:sticky xl:top-4 xl:col-start-3 xl:row-start-1"
        aria-label="Cobro"
      >
        <div className="space-y-4 p-4">
          {clientsEnabled ? (
            <ClienteBuscador cliente={cliente} onElegir={setCliente} puedeAlta={clientsEnabled} />
          ) : null}

          {/* Pedidos abiertos del cliente: viene a retirar y paga lo que falta. */}
          {cliente && pedidosCliente.length > 0 ? (
            <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-accent)] bg-[var(--fo-accent-soft)] p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fo-text-secondary)]">
                <ClipboardList className="size-3.5" aria-hidden />
                Tiene {pedidosCliente.length === 1 ? "un pedido" : `${pedidosCliente.length} pedidos`} en curso
              </p>
              {pedidosCliente.map((p) => (
                <div key={p.id} className="space-y-1 rounded-[var(--fo-radius-sm)] bg-[var(--fo-bg-elevated)] p-2.5 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <a href={`/pedidos/${p.id}`} className="font-semibold hover:underline">
                      Pedido {p.numero}
                    </a>
                    <span className={`tabular-nums ${p.saldoMinor > 0 ? "font-semibold" : "text-[var(--fo-success)]"}`}>
                      {p.saldoMinor > 0 ? `Debe ${formatMinorArs(p.saldoMinor)}` : "Pagado"}
                    </span>
                  </div>
                  {p.trabajos.map((t, i) => (
                    <p key={i} className="truncate text-xs text-[var(--fo-muted)]">
                      {t.nombre}
                      {t.etapa ? ` · ${t.etapa}` : ""}
                    </p>
                  ))}
                  {p.saldoMinor > 0 && p.trabajos.some((t) => t.listo) ? (
                    <p className="text-xs font-semibold text-[var(--fo-danger)]">Debe {importeSinCentavos(p.saldoMinor)} · retenido hasta pagar</p>
                  ) : null}
                  {p.saldoMinor > 0 ? (
                    <button
                      type="button"
                      onClick={() => cobrarSaldo(p)}
                      disabled={procesando}
                      className="fo-btn fo-btn-secondary mt-1 w-full text-xs"
                    >
                      Cobrar saldo {formatMinorArs(p.saldoMinor)} ({ETIQUETA_PAGO[paymentMethod]})
                    </button>
                  ) : null}
                  {p.saldoMinor > 0 && conVerificar && rows.length === 0 ? (
                    <VerificarPago montoMinor={p.saldoMinor} verificado={pagoVerificado} onVerificado={setPagoVerificado} compacto />
                  ) : null}
                </div>
              ))}
              {avisoSaldo ? (
                <p className={`text-xs ${avisoSaldo.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}`}>{avisoSaldo.texto}</p>
              ) : null}
            </div>
          ) : null}

          {/* Trabajos con proceso en el ticket: quedan como pedido para retirar. */}
          {pedido.hay ? (
            <div className="space-y-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg)] p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fo-text-secondary)]">
                <ClipboardList className="size-3.5" aria-hidden />
                Pedido para retirar · {pedido.filas} {pedido.filas === 1 ? "trabajo" : "trabajos"}
              </p>
              <label className="flex items-center justify-between gap-2 text-sm">
                <span className="text-[var(--fo-muted)]">Entrega</span>
                <input
                  type="date"
                  value={pedido.entrega}
                  min={hoyEnArgentina()}
                  onChange={(e) => setEntregaElegida(e.target.value || null)}
                  className="fo-input h-9 w-40 text-sm"
                  aria-label="Fecha de entrega"
                />
              </label>
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Cómo paga el pedido">
                {[
                  { v: true, t: "Deja seña" },
                  { v: false, t: "Paga todo" },
                ].map((o) => (
                  <button
                    key={o.t}
                    type="button"
                    role="radio"
                    aria-checked={conSena === o.v}
                    onClick={() => setConSena(o.v)}
                    className={`rounded-[var(--fo-radius-sm)] border px-2 py-1.5 text-xs font-medium ${
                      conSena === o.v
                        ? "border-[var(--fo-accent)] bg-[var(--fo-accent-muted)] text-[var(--fo-text)]"
                        : "border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]"
                    }`}
                  >
                    {o.t}
                  </button>
                ))}
              </div>
              {conSena ? (
                <label className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-[var(--fo-muted)]">Seña</span>
                  <InputMoneda
                    value={senaText}
                    onChange={setSenaText}
                    placeholder={minorATexto(senaSugerida(pedido.totalPedido)).replace(",00", "")}
                    className="fo-input h-9 text-right text-sm"
                    wrapperClassName="w-40"
                    aria-label="Seña"
                  />
                </label>
              ) : null}
              <p className="text-xs text-[var(--fo-muted)]">
                Se cobra ahora <strong className="text-[var(--fo-text)]">{formatMinorArs(pedido.aCobrar)}</strong>
                {pedido.sena !== null && pedido.totalPedido - pedido.sena > 0 ? (
                  <>
                    {" "}· al retirar <strong className="text-[var(--fo-text)]">{formatMinorArs(pedido.totalPedido - pedido.sena)}</strong>
                  </>
                ) : null}
              </p>
              {!cliente ? <p className="text-xs font-medium text-[var(--fo-warning)]">Elegí el cliente para poder cobrar.</p> : null}
            </div>
          ) : null}

          {/* Total */}
          <div>
            {discountMinor > 0 ? (
              <div className="flex justify-between text-sm text-[var(--fo-muted)]">
                <span>Subtotal {formatMinorArs(totals.subtotalMinor)}</span>
                <span>Descuento −{formatMinorArs(discountMinor)}</span>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-[var(--fo-muted)]">Total</span>
              <span className="whitespace-nowrap text-[26px] font-bold tabular-nums tracking-tight 2xl:text-3xl">{formatMinorArs(totals.totalMinor)}</span>
            </div>
          </div>

          {/* Medio de pago */}
          <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Medio de pago">
            {SALE_PAYMENT_METHODS.map((m, i) => {
              const Icono = ICONO_PAGO[m];
              const activo = paymentMethod === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  title={ETIQUETA_PAGO[m]}
                  onClick={() => setPaymentMethod(m)}
                  className={`flex flex-col items-center gap-1 rounded-[var(--fo-radius-sm)] border px-1 py-2 text-[11px] font-medium leading-tight transition ${
                    // Dos filas parejas: tres arriba y dos abajo, del mismo ancho total.
                    i < 3 ? "col-span-2" : "col-span-3"
                  } ${
                    activo
                      ? "border-[var(--fo-accent)] bg-[var(--fo-accent-muted)] font-semibold text-[var(--fo-text)] ring-1 ring-[var(--fo-accent)]"
                      : "border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
                  }`}
                >
                  <Icono className="size-5" aria-hidden />
                  {ETIQUETA_CORTA_PAGO[m]}
                </button>
              );
            })}
          </div>

          {/* Efectivo: con cuánto paga y el vuelto */}
          {paymentMethod === "EFECTIVO" && totals.totalMinor > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">Paga con</p>
              <div className="flex flex-wrap gap-2">
                {montosSugeridos(totals.totalMinor).map((monto, i) => {
                  const texto = minorATexto(monto);
                  const activo = recibidoText !== "" && parseArsToMinor(recibidoText) === monto;
                  return (
                    <button
                      key={monto}
                      type="button"
                      onClick={() => setRecibidoText(texto)}
                      className={`rounded-full border px-3 py-1.5 text-sm tabular-nums transition ${
                        activo
                          ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-[var(--fo-on-accent,#fff)]"
                          : "border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] hover:border-[var(--fo-accent)]"
                      }`}
                    >
                      {i === 0 ? "Justo" : formatMinorArs(monto).replace(",00", "")}
                    </button>
                  );
                })}
              </div>
              <InputMoneda
                value={recibidoText}
                onChange={setRecibidoText}
                placeholder="Otro monto"
                aria-label="Con cuánto paga"
                className="fo-input text-base"
              />
              {vuelto.estado === "ok" ? (
                <div className="flex items-baseline justify-between rounded-[var(--fo-radius-sm)] bg-[var(--fo-success-soft)] px-3 py-2.5">
                  <span className="text-sm font-medium text-[var(--fo-success)]">Vuelto</span>
                  <span className="text-2xl font-bold tabular-nums text-[var(--fo-success)]">
                    {formatMinorArs(vuelto.vueltoMinor)}
                  </span>
                </div>
              ) : vuelto.estado === "falta" ? (
                <p className="rounded-[var(--fo-radius-sm)] bg-[var(--fo-danger-soft)] px-3 py-2.5 text-sm font-medium text-[var(--fo-danger)]">
                  Faltan {formatMinorArs(vuelto.faltaMinor)}
                </p>
              ) : null}
            </div>
          ) : null}

          {paymentMethod === "TRANSFERENCIA" && pedido.aCobrar > 0 ? (
            <DatosParaTransferir datos={datosTransferencia} totalMinor={pedido.aCobrar} />
          ) : null}
          {paymentMethod === "MERCADO_PAGO" && pedido.aCobrar > 0 && qrActivo ? (
            pedido.hay && !cliente ? (
              <p className="text-xs text-[var(--fo-muted)]">Elegí el cliente antes de mostrar el monto en el QR.</p>
            ) : (
              <CobroQr
                montoMinor={pedido.aCobrar}
                descripcion="Venta en el mostrador"
                pagadoId={pagoQr && pagoQr.montoMinor === pedido.aCobrar ? pagoQr.id : null}
                onPagado={(o) => {
                  setPagoQr(o);
                  cobrar(o);
                }}
              />
            )
          ) : null}
          {paymentMethod === "MERCADO_PAGO" && pedido.aCobrar > 0 && !qrActivo ? (
            <p className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] p-3 text-sm text-[var(--fo-muted)]">
              Que escanee el QR de Mercado Pago del mostrador y pague{" "}
              <strong className="text-[var(--fo-text)]">{formatMinorArs(pedido.aCobrar)}</strong>.
            </p>
          ) : null}
          {conVerificar && pedido.aCobrar > 0 && !(paymentMethod === "MERCADO_PAGO" && qrActivo) ? (
            <VerificarPago montoMinor={pedido.aCobrar} verificado={pagoVerificado} onVerificado={setPagoVerificado} />
          ) : null}

          {/* Lo que casi nunca se usa, plegado */}
          <details className="group text-sm" open={extrasCargados || undefined}>
            <summary className="flex cursor-pointer list-none items-center justify-between text-[var(--fo-muted)] hover:text-[var(--fo-text)]">
              <span>
                Descuento o nota
                {extrasCargados ? <span className="ml-1 text-[var(--fo-accent)]">●</span> : null}
              </span>
              <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--fo-muted)]">Descuento</span>
                <InputMoneda
                  value={discountText}
                  onChange={setDiscountText}
                  placeholder="0"
                  className="fo-input text-right text-sm"
                  wrapperClassName="w-36"
                  aria-label="Descuento"
                />
              </div>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" className="fo-input" />
            </div>
          </details>

          {error ? (
            <p className="rounded-[var(--fo-radius-sm)] bg-[var(--fo-danger-soft)] p-3 text-sm text-[var(--fo-danger)]" role="alert">
              {error}
            </p>
          ) : null}
          {ultimaVenta !== null ? (
            <div className="flex items-start gap-3 rounded-[var(--fo-radius-sm)] bg-[var(--fo-success-soft)] p-3 text-sm" role="status">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--fo-success)]" aria-hidden />
              <div>
                {ultimaVenta.pedido ? (
                  <>
                    <p className="font-semibold text-[var(--fo-success)]">Pedido {ultimaVenta.pedido.numero} creado</p>
                    <p className="text-[var(--fo-text)]">
                      Cobrado {formatMinorArs(ultimaVenta.pedido.cobradoMinor)}
                      {ultimaVenta.pedido.saldoMinor > 0 ? ` · queda ${formatMinorArs(ultimaVenta.pedido.saldoMinor)} al retirar` : " · pagado"}
                    </p>
                    {ultimaVenta.saleNumber !== null ? <p className="text-[var(--fo-text)]">Y la venta #{ultimaVenta.saleNumber}.</p> : null}
                    {ultimaVenta.pedido.aviso ? <p className="text-[var(--fo-warning)]">{ultimaVenta.pedido.aviso}</p> : null}
                    {ultimaVenta.pedido.laboratorios.length > 0 ? (
                      <p className="text-[var(--fo-text)]">{avisoLaboratorios(ultimaVenta.pedido.laboratorios)}</p>
                    ) : null}
                    {ultimaVenta.pedido.grabar.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ultimaVenta.pedido.grabar.map((t) => (
                          <a
                            key={t.proyectoId}
                            href={`/digitalizacion/grabar?proyecto=${encodeURIComponent(t.proyectoId)}`}
                            className="fo-btn fo-btn-primary text-xs"
                            title={`${t.numero} · ${t.nombre}`}
                          >
                            ● Ir a grabar{ultimaVenta.pedido!.grabar.length > 1 ? ` ${t.numero} · ${t.nombre}` : ""}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="font-semibold text-[var(--fo-success)]">Venta #{ultimaVenta.saleNumber} cobrada</p>
                )}
                {ultimaVenta.comision ? (
                  <p className="font-semibold text-[var(--fo-success)]">
                    {ultimaVenta.comision.ganada
                      ? `Ganaste ${formatMinorArs(ultimaVenta.comision.minor).replace(/,00$/, "")} de comisión.`
                      : `Tu comisión: ${formatMinorArs(ultimaVenta.comision.minor).replace(/,00$/, "")}. Se suma cuando se cobre el saldo.`}
                  </p>
                ) : null}
                {ultimaVenta.vueltoMinor !== null && ultimaVenta.vueltoMinor > 0 ? (
                  <p className="text-[var(--fo-text)]">Dar de vuelto {formatMinorArs(ultimaVenta.vueltoMinor)}</p>
                ) : null}
                {!ultimaVenta.deposited ? (
                  <p className="text-[var(--fo-warning)]">No se depositó en Caja: no va a aparecer en el libro.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => cobrar()}
            disabled={procesando || rows.length === 0 || vuelto.estado === "falta" || (pedido.hay && !cliente)}
            className="fo-btn fo-btn-primary h-14 w-full text-lg font-semibold"
          >
            {procesando
              ? "Cobrando…"
              : rows.length === 0
                ? "Cobrar"
                : pedido.hay && pedido.sena !== null && pedido.sena < pedido.totalPedido
                  ? `Cobrar seña ${formatMinorArs(pedido.aCobrar)}`
                  : `Cobrar ${formatMinorArs(pedido.aCobrar)}`}
          </button>
        </div>
      </section>

      {/*
        La miniatura agrandada: fija en la pantalla (la lista del catálogo tiene su propia barra
        y la recortaría) y sin eventos del mouse, para no taparle el clic a la fila.
      */}
      {fotoGrande ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fotoGrande.src}
          alt=""
          className="pointer-events-none fixed z-50 size-56 -translate-y-1/2 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] object-contain p-1 shadow-2xl"
          style={{ left: fotoGrande.x, top: Math.min(Math.max(fotoGrande.y, 124), window.innerHeight - 124) }}
        />
      ) : null}

      {preparando
        ? (() => {
            const pid = rows.find((x) => x.key === preparando.key)?.productId;
            const p = pid ? produccion[pid] : undefined;
            // Sin renglón (o sin producto de impresión) no se abre: el editor equivocado no puede tocar la preparación.
            if (!p) return null;
            return (
              <DialogoPreparar
                preparacionId={preparando.preparacionId}
                tipoPieza={p.tipoPieza === "COPIA" ? "COPIA" : "CARNET"}
                cliente={cliente}
                produccion={{ salida: p.salida, hoja: p.hoja, digital: p.digital }}
                permisos={permisosCarnet}
                onListo={({ cantidad }) => {
                  // La cantidad del renglón: planchas (carnet) o el total de copias (se puede deshacer como cualquier cambio).
                  actualizarCantidad(preparando.key, cantidad);
                  marcarCopiasSinTerminar(preparando.key, false);
                  setPreparando(null);
                }}
                onCerrar={() => {
                  setPreparando(null);
                  if (p.tipoPieza === "COPIA") void alCerrarCopias(preparando.key, preparando.preparacionId);
                }}
              />
            );
          })()
        : null}

      {labAbierto && laboratorio ? (
        <DialogoLaboratorio preparacionId={laboratorio.preparacionId} onListo={alListoLab} onCerrar={() => setLabAbierto(false)} />
      ) : null}

      {egresos && egresoAbierto ? (
        <EgresoDialogo
          datos={egresos}
          onCerrar={() => setEgresoAbierto(false)}
          onListo={(mensaje) => {
            setEgresoAbierto(false);
            avisar(mensaje);
          }}
        />
      ) : null}

      {cantidadTipeada || avisoAtajo ? (
        <div
          role="status"
          className="pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[var(--fo-text)] px-5 py-2.5 text-sm text-[var(--fo-bg-elevated)] shadow-lg lg:bottom-8"
        >
          {cantidadTipeada ? (
            <>
              Cantidad <strong className="tabular-nums">{cantidadTipeada.texto}</strong>
              {cantidadTipeada.nombre ? ` · ${cantidadTipeada.nombre}` : ""}
            </>
          ) : (
            avisoAtajo
          )}
        </div>
      ) : null}

      {/* En el teléfono el ticket queda abajo: esta barra lo tiene siempre a mano. */}
      {rows.length > 0 ? (
        <a
          href="#ticket"
          className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-full bg-[var(--fo-accent)] px-5 py-3.5 text-[var(--fo-on-accent,#fff)] shadow-lg lg:hidden"
        >
          <span className="text-sm font-medium">
            Ver ticket · {unidades} {unidades === 1 ? "artículo" : "artículos"}
          </span>
          <span className="text-base font-bold tabular-nums">{formatMinorArs(totals.totalMinor)}</span>
        </a>
      ) : null}
    </div>
  );
}

function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] px-1.5 py-0.5 font-sans text-[11px] text-[var(--fo-text)]">
      {children}
    </kbd>
  );
}

/**
 * Alias y CVU para que el cliente transfiera desde su celular, con botón de copiar. Si el negocio
 * todavía no los cargó, dice dónde se cargan en vez de mostrar una tarjeta vacía.
 */
function DatosParaTransferir({ datos, totalMinor }: { datos: DatosTransferencia; totalMinor: number }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  if (!datos.alias && !datos.cbuCvu) {
    return (
      <p className="rounded-[var(--fo-radius-sm)] border border-dashed border-[var(--fo-border)] p-3 text-sm text-[var(--fo-muted)]">
        Todavía no cargaste el alias ni el CVU del negocio. Se cargan en Configuración → Presupuestos, en
        «Datos para transferir».
      </p>
    );
  }
  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(texto);
      setTimeout(() => setCopiado((c) => (c === texto ? null : c)), 1500);
    } catch {
      // Sin permiso de portapapeles el dato igual se ve en pantalla para dictarlo.
    }
  }
  const filas = [
    { etiqueta: "Alias", valor: datos.alias },
    { etiqueta: "CBU / CVU", valor: datos.cbuCvu },
    { etiqueta: "Monto", valor: minorATexto(totalMinor), mostrar: formatMinorArs(totalMinor) },
  ].filter((f): f is { etiqueta: string; valor: string; mostrar?: string } => Boolean(f.valor));
  return (
    <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] p-3">
      {filas.map((f) => (
        <div key={f.etiqueta} className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-[var(--fo-muted)]">{f.etiqueta}</p>
            <p className="break-all font-mono text-sm font-semibold text-[var(--fo-text)]">{f.mostrar ?? f.valor}</p>
          </div>
          <button
            type="button"
            onClick={() => copiar(f.valor)}
            className="shrink-0 rounded-full border border-[var(--fo-border)] px-3 py-1 text-xs text-[var(--fo-muted)] hover:border-[var(--fo-accent)] hover:text-[var(--fo-text)]"
          >
            {copiado === f.valor ? "Copiado" : "Copiar"}
          </button>
        </div>
      ))}
      {datos.titular || datos.banco ? (
        <p className="text-xs text-[var(--fo-muted)]">
          {[datos.titular, datos.banco].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Elegir el talle antes de agregar un producto que tiene talles. Un botón por talle con su
 * precio y su existencia. Un talle sin existencia se puede elegir igual —vender nunca se
 * bloquea por stock en el mostrador (D6)—, sólo se marca.
 */
function SelectorDeTalle({
  product,
  onElegir,
  onCancelar,
}: {
  product: ProductRow;
  onElegir: (talle: ProductVariantRow) => void;
  onCancelar: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label={`Elegí el talle de ${product.name}`}
      className="fo-card space-y-3 border-2 border-[var(--fo-accent)] p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancelar();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--fo-text)]">Elegí el talle de {product.name}</p>
        <button type="button" onClick={onCancelar} className="fo-btn fo-btn-ghost text-xs">
          Cancelar
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {product.variants.map((v, i) => {
          const sinStock = product.tracksStock && v.stockQty <= 0;
          return (
            <button
              key={v.id}
              type="button"
              autoFocus={i === 0}
              onClick={() => onElegir(v)}
              className="fo-card flex flex-col items-start gap-0.5 p-3 text-left transition hover:border-[var(--fo-accent)]"
            >
              <span className="text-base font-semibold text-[var(--fo-text)]">{v.name}</span>
              <span className="text-sm text-[var(--fo-accent)]">{formatMinorArs(v.priceMinor)}</span>
              {product.tracksStock ? (
                <span
                  className={`text-xs ${sinStock ? "font-semibold text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"}`}
                >
                  {sinStock ? "Sin existencia" : `Existencia: ${v.stockQty}`}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
