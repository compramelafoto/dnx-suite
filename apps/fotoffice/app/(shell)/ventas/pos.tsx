"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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

let contador = 0;
function nuevaKey(): string {
  contador += 1;
  return `r${contador}-${Date.now()}`;
}

type ClienteModo = "ninguno" | "existente" | "nuevo";

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
}: {
  products: ProductRow[];
  categories: ProductCategoryRow[];
  clientsEnabled: boolean;
  clients: ClientRow[];
  cashEnabled: boolean;
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
  function agregarProducto(p: ProductRow, talle: ProductVariantRow | null = null) {
    limpiarAviso();
    if (talle === null && p.variants.length > 0) {
      setEligiendoTalle(p);
      return;
    }
    setEligiendoTalle(null);
    const variantId = talle?.id ?? null;
    const precio = talle?.priceMinor ?? p.priceMinor;
    setRows((prev) => {
      const existente = prev.find((r) => r.productId === p.id && r.variantId === variantId);
      if (existente) {
        return prev.map((r) => (r.key === existente.key ? { ...r, qty: r.qty + 1 } : r));
      }
      return [
        ...prev,
        {
          key: nuevaKey(),
          productId: p.id,
          variantId,
          description: talle ? `${p.name} — ${talle.name}` : p.name,
          qty: 1,
          unitPriceMinor: precio,
          unitCostMinor: null,
          priceWasOverridden: false,
          catalogPriceMinor: precio,
          tracksStock: p.tracksStock,
          stockQty: talle?.stockQty ?? p.stockQty,
        },
      ];
    });
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
  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const texto = search.trim();
    if (texto === "") return;
    const codigoBarras = normalizeBarcode(texto);
    const coincideCodigo = (p: ProductRow) =>
      p.sku === texto || (codigoBarras !== null && p.barcode === codigoBarras);

    const local = products.find(coincideCodigo) ?? serverResults?.find(coincideCodigo);
    if (local) {
      agregarProducto(local);
      setSearch("");
      searchRef.current?.focus();
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
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, qty: Math.floor(qty) } : r)));
  }

  function actualizarPrecio(key: string, texto: string) {
    const minor = parseArsToMinor(texto);
    if (minor === null) return;
    setRows((prev) =>
      prev.map((r) =>
        r.key === key
          ? { ...r, unitPriceMinor: minor, priceWasOverridden: r.catalogPriceMinor !== null && minor !== r.catalogPriceMinor }
          : r,
      ),
    );
  }

  function quitarRenglon(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function agregarSuelto() {
    const descripcion = sueltoDescripcion.trim();
    const precio = parseArsToMinor(sueltoPrecio);
    if (descripcion === "" || precio === null) return;
    limpiarAviso();
    setRows((prev) => [
      ...prev,
      {
        key: nuevaKey(),
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
        searchRef.current?.focus();
      } else {
        setError(resultado.error);
      }
    });
  }

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
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKeyDown}
            className="fo-input h-14 !pl-12 text-base"
            placeholder="Buscá un producto o escaneá el código"
            aria-label="Buscar producto"
          />
          {buscando ? (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[var(--fo-muted)]">Buscando…</span>
          ) : null}
        </div>

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

      {/* El ticket */}
      <section
        id="ticket"
        className="fo-card flex h-fit flex-col overflow-hidden p-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]"
      >
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
                onClick={() => {
                  reiniciarTicket();
                  searchRef.current?.focus();
                }}
                className="flex size-8 items-center justify-center rounded-full text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-danger)]"
                aria-label="Vaciar el ticket"
                title="Vaciar el ticket"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
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
              {rows.map((r) => (
                <li key={r.key} className="py-3">
                  <div className="flex items-start gap-3">
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
                    <p className="shrink-0 text-sm font-semibold tabular-nums">{formatMinorArs(r.qty * r.unitPriceMinor)}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center rounded-full border border-[var(--fo-border)]">
                      <button
                        type="button"
                        onClick={() => (r.qty > 1 ? actualizarCantidad(r.key, r.qty - 1) : quitarRenglon(r.key))}
                        className="flex size-8 items-center justify-center rounded-full text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]"
                        aria-label={r.qty > 1 ? `Uno menos de ${r.description}` : `Quitar ${r.description}`}
                      >
                        {r.qty > 1 ? <Minus className="size-4" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
                      </button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">{r.qty}</span>
                      <button
                        type="button"
                        onClick={() => actualizarCantidad(r.key, r.qty + 1)}
                        className="flex size-8 items-center justify-center rounded-full text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]"
                        aria-label={`Uno más de ${r.description}`}
                      >
                        <Plus className="size-4" aria-hidden />
                      </button>
                    </div>
                    {r.qty > 1 ? (
                      <button
                        type="button"
                        onClick={() => quitarRenglon(r.key)}
                        className="text-xs text-[var(--fo-muted)] hover:text-[var(--fo-danger)]"
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4 border-t border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-4">
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
                      ? "border-[var(--fo-accent)] bg-[var(--fo-accent-muted)] text-[var(--fo-text)]"
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
