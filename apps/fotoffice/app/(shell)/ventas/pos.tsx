"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  ArrowLeftRight,
  Banknote,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Ellipsis,
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
import { ticketTotals, validateTicket, type TicketLine } from "@/lib/sales/ticket";
import { normalizeBarcode } from "@/lib/sales/barcode";
import { SALE_PAYMENT_METHODS, type SalePaymentMethod } from "@/lib/sales/constants";
import { calcularVuelto, montosSugeridos } from "@/lib/sales/vuelto";
import type { DatosTransferencia } from "@/lib/cobro-ajustes/datos";
import type { ProductCategoryRow, ProductRow, ProductVariantRow } from "@/lib/sales/repository";
import type { ClientRow } from "@/lib/clients/repository";
import { checkoutAction, findProductByCodeAction, searchProductsAction, type CheckoutInput } from "./actions";

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
  TRANSFERENCIA: "Transfer.",
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

type ClienteModo = "ninguno" | "existente" | "nuevo";

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
  clients,
  cashEnabled,
  datosTransferencia,
}: {
  products: ProductRow[];
  categories: ProductCategoryRow[];
  clientsEnabled: boolean;
  clients: ClientRow[];
  cashEnabled: boolean;
  /** Alias y CVU del negocio (Configuración → Presupuestos), para mostrar al elegir Transferencia. */
  datosTransferencia: DatosTransferencia;
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<TicketRow[]>([]);
  const [discountText, setDiscountText] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>("EFECTIVO");

  const [clienteModo, setClienteModo] = useState<ClienteModo>("ninguno");
  const [clientId, setClientId] = useState("");
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  // El producto con talles al que se le está eligiendo el talle, antes de agregarlo.
  const [eligiendoTalle, setEligiendoTalle] = useState<ProductRow | null>(null);

  const [mostrarSuelto, setMostrarSuelto] = useState(false);
  const [sueltoDescripcion, setSueltoDescripcion] = useState("");
  const [sueltoPrecio, setSueltoPrecio] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [ultimaVenta, setUltimaVenta] = useState<{
    saleNumber: number;
    deposited: boolean;
    vueltoMinor: number | null;
  } | null>(null);
  // Efectivo: con cuánto paga, para calcular el vuelto. No viaja como dato propio: queda en la nota.
  const [recibidoText, setRecibidoText] = useState("");
  const [editandoPrecio, setEditandoPrecio] = useState<string | null>(null);
  // Buscador rápido: el desplegable de coincidencias y cuál está marcado para Enter.
  const [desplegableAbierto, setDesplegableAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);

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
  const MAX_SUGERENCIAS = 8;
  const sugerencias = search.trim() === "" ? [] : filtrados.slice(0, MAX_SUGERENCIAS);
  const mostrarDesplegable = desplegableAbierto && search.trim() !== "";

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
    if (talle === null && p.variants.length > 0) {
      setEligiendoTalle(p);
      return;
    }
    setEligiendoTalle(null);
    const variantId = talle?.id ?? null;
    const precio = talle?.priceMinor ?? p.priceMinor;
    const existente = rowsRef.current.find((r) => r.productId === p.id && r.variantId === variantId);
    const key = existente?.key ?? nuevaKey();
    cambiarRenglones((prev) => {
      const ya = prev.find((r) => r.productId === p.id && r.variantId === variantId);
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

  function deshacer() {
    const anterior = historialRef.current.pop();
    if (!anterior) {
      avisar("No hay nada para deshacer.");
      return;
    }
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
      setDesplegableAbierto(true);
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

  function actualizarCantidad(key: string, qty: number) {
    if (!Number.isFinite(qty) || qty < 1) return;
    cambiarRenglones((prev) => prev.map((r) => (r.key === key ? { ...r, qty: Math.floor(qty) } : r)));
  }

  function actualizarPrecio(key: string, texto: string) {
    const minor = parseArsToMinor(texto);
    if (minor === null) return;
    cambiarRenglones((prev) =>
      prev.map((r) =>
        r.key === key
          ? { ...r, unitPriceMinor: minor, priceWasOverridden: r.catalogPriceMinor !== null && minor !== r.catalogPriceMinor }
          : r,
      ),
    );
  }

  function quitarRenglon(key: string) {
    cambiarRenglones((prev) => prev.filter((r) => r.key !== key));
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

  function reiniciarTicket() {
    setRows([]);
    setDiscountText("");
    setNote("");
    setPaymentMethod("EFECTIVO");
    setRecibidoText("");
    setEditandoPrecio(null);
    setClienteModo("ninguno");
    setClientId("");
    setClientFirstName("");
    setClientLastName("");
    setClientPhone("");
    setClientEmail("");
  }

  function cobrar() {
    limpiarAviso();
    const validacion = validateTicket(rows, discountMinor);
    if (!validacion.ok) {
      setError(validacion.error);
      return;
    }
    const recibidoMinor = paymentMethod === "EFECTIVO" ? parseArsToMinor(recibidoText) : null;
    const vueltoAlCobrar = calcularVuelto(totals.totalMinor, recibidoMinor);
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
      })),
      discountMinor,
      paymentMethod,
      note: notaFinal,
      client:
        clienteModo === "existente"
          ? { mode: "existing", clientId }
          : clienteModo === "nuevo"
            ? { mode: "new", firstName: clientFirstName, lastName: clientLastName, phone: clientPhone, email: clientEmail }
            : { mode: "none" },
    };

    startTransition(async () => {
      const resultado = await checkoutAction(input);
      if (resultado.ok) {
        setUltimaVenta({
          saleNumber: resultado.saleNumber,
          deposited: resultado.deposited,
          vueltoMinor: vueltoAlCobrar.estado === "ok" ? vueltoAlCobrar.vueltoMinor : null,
        });
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
        : rowsRef.current.find((r) => r.productId === objetivo.id && r.variantId === null)?.key;
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
      const enTicket = rowsRef.current.find((r) => r.productId === objetivo.id && r.variantId === null);
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
    setDesplegableAbierto(true);
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

  const vuelto = calcularVuelto(totals.totalMinor, paymentMethod === "EFECTIVO" ? parseArsToMinor(recibidoText) : null);
  const unidades = rows.reduce((acc, r) => acc + r.qty, 0);
  const cantidadEnTicket = (productId: string) =>
    rows.filter((r) => r.productId === productId).reduce((acc, r) => acc + r.qty, 0);
  const extrasCargados = discountMinor > 0 || note.trim() !== "" || clienteModo !== "ninguno";

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-0">
      {/* Catálogo: buscar y tocar para sumar */}
      <section className="min-w-0 space-y-4">
        {!cashEnabled ? (
          <div className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-3 text-sm text-[var(--fo-warning)]">
            El módulo de Caja está apagado. Las ventas se registran igual, pero el dinero no
            entra al libro de caja.
          </div>
        ) : null}

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--fo-muted)]"
            aria-hidden
          />
          <input
            ref={searchRef}
            autoFocus
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setResaltado(0);
              setDesplegableAbierto(true);
            }}
            onFocus={() => setDesplegableAbierto(true)}
            onBlur={() => setDesplegableAbierto(false)}
            onKeyDown={onSearchKeyDown}
            className="fo-input h-14 !pl-12 text-base"
            placeholder="Buscá por nombre o código de barras"
            aria-label="Buscar producto o servicio"
            role="combobox"
            aria-expanded={mostrarDesplegable}
            aria-controls="pos-sugerencias"
            aria-activedescendant={mostrarDesplegable && sugerencias[resaltado] ? `pos-sug-${sugerencias[resaltado].id}` : undefined}
            autoComplete="off"
          />
          {buscando ? (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[var(--fo-muted)]">Buscando…</span>
          ) : null}

          {mostrarDesplegable ? (
            <div
              id="pos-sugerencias"
              role="listbox"
              aria-label="Coincidencias"
              className="absolute inset-x-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] py-1 shadow-xl"
              // Sin esto, el clic le saca el foco al buscador y el desplegable se cierra antes.
              onMouseDown={(e) => e.preventDefault()}
            >
              {sugerencias.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[var(--fo-muted)]">
                  {buscando ? "Buscando en todo el catálogo…" : "Nada coincide. Si no está en el catálogo, usá «+ Otro importe» en el ticket."}
                </div>
              ) : (
                sugerencias.map((p, i) => {
                  const marcada = i === resaltado;
                  const codigo = p.barcode ?? p.sku;
                  const sinStock = p.tracksStock && p.stockQty <= 0;
                  return (
                    <div
                      key={p.id}
                      id={`pos-sug-${p.id}`}
                      role="option"
                      aria-selected={marcada}
                      onMouseEnter={() => setResaltado(i)}
                      onClick={() => elegirSugerencia(p)}
                      className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${marcada ? "bg-[var(--fo-accent-muted)]" : ""}`}
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg)] text-[var(--fo-muted)]">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Package className="size-4" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--fo-text)]">{p.name}</p>
                        <p className="truncate text-xs text-[var(--fo-muted)]">
                          {[codigo, p.kind === "SERVICIO" ? "Servicio" : null, p.variants.length > 0 ? `${p.variants.length} talles` : null]
                            .filter(Boolean)
                            .join(" · ")}
                          {sinStock ? <span className="font-semibold text-[var(--fo-danger)]"> · Sin existencia</span> : null}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMinorArs(p.priceMinor)}</span>
                    </div>
                  );
                })
              )}
              {sugerencias.length > 0 ? (
                <p className="hidden border-t border-[var(--fo-border)] px-3 pt-2 pb-1 text-[11px] text-[var(--fo-muted)] sm:block">
                  ↑ ↓ para moverte · Enter para sumar · Esc para borrar
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--fo-muted)] lg:flex" aria-label="Atajos de teclado">
          <span>
            <Tecla>+</Tecla> <Tecla>−</Tecla> cantidad
          </span>
          <span>
            <Tecla>10</Tecla> fija 10 unidades
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
          <span>Escribí en cualquier lado para buscar</span>
        </p>

        {categories.length > 0 ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Categorías">
            {[{ id: "", name: "Todo" }, ...categories].map((c) => {
              const activa = categoryId === c.id;
              return (
                <button
                  key={c.id || "todo"}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  onClick={() => setCategoryId(c.id)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${
                    activa
                      ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white"
                      : "border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
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

        {filtrados.length === 0 ? (
          <div className="fo-card flex flex-col items-center gap-3 px-6 py-12 text-center">
            <Package className="size-8 text-[var(--fo-muted)]" aria-hidden />
            <p className="text-sm font-medium">Ningún producto coincide con esa búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filtrados.map((p) => {
              // Vender nunca se bloquea por falta de existencia, pero el mostrador avisa.
              const sinStock = p.tracksStock && p.stockQty <= 0;
              const enTicket = cantidadEnTicket(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => agregarProducto(p)}
                  onMouseEnter={() => setApuntado({ tipo: "producto", id: p.id })}
                  onMouseLeave={() => setApuntado(null)}
                  onFocus={() => setApuntado({ tipo: "producto", id: p.id })}
                  onBlur={() => setApuntado(null)}
                  className={`group relative flex flex-col overflow-hidden rounded-[var(--fo-radius)] border bg-[var(--fo-bg-elevated)] text-left transition active:scale-[0.98] ${
                    enTicket > 0
                      ? "border-[var(--fo-accent)] ring-2 ring-[var(--fo-accent-muted)]"
                      : "border-[var(--fo-border)] hover:border-[var(--fo-accent)]"
                  }`}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--fo-bg)]">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[var(--fo-muted)]">
                        <Package className="size-7" aria-hidden />
                      </div>
                    )}
                  </div>
                  {enTicket > 0 ? (
                    <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-[var(--fo-accent)] text-sm font-semibold text-white shadow">
                      {enTicket}
                    </span>
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3">
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-[var(--fo-text)]">{p.name}</p>
                    <p className="mt-auto pt-1 text-base font-semibold tabular-nums text-[var(--fo-text)]">
                      {formatMinorArs(p.priceMinor)}
                    </p>
                    {p.variants.length > 0 ? (
                      <p className="truncate text-xs text-[var(--fo-muted)]">{p.variants.length} talles</p>
                    ) : null}
                    {sinStock ? <p className="text-xs font-semibold text-[var(--fo-danger)]">Sin existencia</p> : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/*
        El ticket, en dos tarjetas: arriba el total, cómo paga y el botón de cobrar; abajo la
        lista completa de lo que lleva, siempre a la vista. Antes la lista vivía en un recuadro
        con barra propia entre el encabezado y el total, y con tres artículos ya quedaba tapada.
      */}
      <div id="ticket" className="flex h-fit min-w-0 flex-col gap-4">
        <section className="fo-card overflow-hidden p-0" aria-label="Cobro">
          <div className="space-y-4 p-4">
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
                <span className="text-3xl font-bold tabular-nums tracking-tight">{formatMinorArs(totals.totalMinor)}</span>
              </div>
            </div>

            {/* Medio de pago */}
            <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Medio de pago">
              {SALE_PAYMENT_METHODS.map((m) => {
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
                    className={`flex flex-col items-center gap-1 rounded-[var(--fo-radius-sm)] border px-1 py-2.5 text-[11px] font-medium leading-tight transition ${
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
                            ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white"
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

            {paymentMethod === "TRANSFERENCIA" && totals.totalMinor > 0 ? (
              <DatosParaTransferir datos={datosTransferencia} totalMinor={totals.totalMinor} />
            ) : null}
            {paymentMethod === "MERCADO_PAGO" && totals.totalMinor > 0 ? (
              <p className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] p-3 text-sm text-[var(--fo-muted)]">
                Que escanee el QR de Mercado Pago del mostrador y pague{" "}
                <strong className="text-[var(--fo-text)]">{formatMinorArs(totals.totalMinor)}</strong>. Cobrá cuando veas
                el pago acreditado.
              </p>
            ) : null}

            {/* Lo que casi nunca se usa, plegado */}
            <details className="group text-sm" open={extrasCargados || undefined}>
              <summary className="flex cursor-pointer list-none items-center justify-between text-[var(--fo-muted)] hover:text-[var(--fo-text)]">
                <span>
                  Descuento, cliente o nota
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
                {clientsEnabled ? (
                  <div className="space-y-2">
                    <select
                      value={clienteModo}
                      onChange={(e) => setClienteModo(e.target.value as ClienteModo)}
                      className="fo-input"
                      aria-label="Cliente"
                    >
                      <option value="ninguno">Sin cliente</option>
                      <option value="existente">Cliente ya cargado</option>
                      <option value="nuevo">Cliente nuevo</option>
                    </select>
                    {clienteModo === "existente" ? (
                      <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="fo-input" aria-label="Elegir cliente">
                        <option value="">Elegí uno…</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.displayName}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {clienteModo === "nuevo" ? (
                      <div className="grid grid-cols-2 gap-2">
                        <input value={clientFirstName} onChange={(e) => setClientFirstName(e.target.value)} placeholder="Nombre" className="fo-input" />
                        <input value={clientLastName} onChange={(e) => setClientLastName(e.target.value)} placeholder="Apellido" className="fo-input" />
                        <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Teléfono" className="fo-input" />
                        <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="Correo" className="fo-input" />
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
                  <p className="font-semibold text-[var(--fo-success)]">Venta #{ultimaVenta.saleNumber} cobrada</p>
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
              onClick={cobrar}
              disabled={procesando || rows.length === 0 || vuelto.estado === "falta"}
              className="fo-btn fo-btn-primary h-14 w-full text-lg font-semibold"
            >
              {procesando ? "Cobrando…" : rows.length === 0 ? "Cobrar" : `Cobrar ${formatMinorArs(totals.totalMinor)}`}
            </button>
          </div>
        </section>

        <section className="fo-card overflow-hidden p-0" aria-label="Lo que lleva">
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
              <button
                type="button"
                onClick={() => setMostrarSuelto((v) => !v)}
                className="fo-btn fo-btn-ghost whitespace-nowrap px-2 text-xs"
              >
                + Otro importe
              </button>
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
                  return (
                    <li
                      key={r.key}
                      onMouseEnter={() => setApuntado({ tipo: "renglon", key: r.key })}
                      onMouseLeave={() => setApuntado(null)}
                      onClick={() => setActivo(r.key)}
                      className={`-mx-4 flex items-center gap-3 px-4 py-2.5 transition-colors ${marcado ? "bg-[var(--fo-accent-muted)]" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--fo-text)]">{r.description}</p>
                        {editandoPrecio === r.key ? (
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
                      </div>
                      <div className="flex shrink-0 items-center rounded-full border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)]">
                        <button
                          type="button"
                          onClick={() => (r.qty > 1 ? actualizarCantidad(r.key, r.qty - 1) : quitarRenglon(r.key))}
                          className="flex size-7 items-center justify-center rounded-full text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]"
                          aria-label={r.qty > 1 ? `Uno menos de ${r.description}` : `Quitar ${r.description}`}
                        >
                          {r.qty > 1 ? <Minus className="size-3.5" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />}
                        </button>
                        <span className="w-7 text-center text-sm font-semibold tabular-nums">{r.qty}</span>
                        <button
                          type="button"
                          onClick={() => actualizarCantidad(r.key, r.qty + 1)}
                          className="flex size-7 items-center justify-center rounded-full text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]"
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
              </ul>
            )}
          </div>

        </section>
      </div>

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
          className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-full bg-[var(--fo-accent)] px-5 py-3.5 text-white shadow-lg lg:hidden"
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
      <p className="text-xs text-[var(--fo-muted)]">Cobrá cuando veas la transferencia acreditada.</p>
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
