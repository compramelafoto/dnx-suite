"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Package } from "lucide-react";
import { formatMinorArs, parseArsToMinor } from "@/lib/membership/money";
import { ticketTotals, validateTicket, type TicketLine } from "@/lib/sales/ticket";
import { normalizeBarcode } from "@/lib/sales/barcode";
import { SALE_PAYMENT_METHODS, type SalePaymentMethod } from "@/lib/sales/constants";
import type { ProductCategoryRow, ProductRow } from "@/lib/sales/repository";
import type { ClientRow } from "@/lib/clients/repository";
import { checkoutAction, findProductByCodeAction, searchProductsAction, type CheckoutInput } from "./actions";

const ETIQUETA_PAGO: Record<SalePaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  MERCADO_PAGO: "Mercado Pago",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  OTRO: "Otro",
};

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

  const [mostrarSuelto, setMostrarSuelto] = useState(false);
  const [sueltoDescripcion, setSueltoDescripcion] = useState("");
  const [sueltoPrecio, setSueltoPrecio] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [ultimaVenta, setUltimaVenta] = useState<{ saleNumber: number; deposited: boolean } | null>(null);
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

  function agregarProducto(p: ProductRow) {
    limpiarAviso();
    setRows((prev) => {
      const existente = prev.find((r) => r.productId === p.id);
      if (existente) {
        return prev.map((r) => (r.key === existente.key ? { ...r, qty: r.qty + 1 } : r));
      }
      return [
        ...prev,
        {
          key: nuevaKey(),
          productId: p.id,
          description: p.name,
          qty: 1,
          unitPriceMinor: p.priceMinor,
          unitCostMinor: null,
          priceWasOverridden: false,
          catalogPriceMinor: p.priceMinor,
          tracksStock: p.tracksStock,
          stockQty: p.stockQty,
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
        agregarProducto(encontrado);
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

    const input: CheckoutInput = {
      // `priceWasOverridden` no viaja: lo recalcula el servidor comparando contra el precio
      // de catálogo (ver el comentario de `buildTicketLines`). Lo que se ve acá en pantalla
      // (`r.priceWasOverridden`) es sólo el aviso inmediato del mostrador, con el precio que
      // ya llegó cargado — no la fuente de verdad de la auditoría.
      lines: rows.map((r) => ({
        productId: r.productId,
        description: r.description,
        qty: r.qty,
        unitPriceMinor: r.unitPriceMinor,
      })),
      discountMinor,
      paymentMethod,
      note,
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
        setUltimaVenta({ saleNumber: resultado.saleNumber, deposited: resultado.deposited });
        reiniciarTicket();
        searchRef.current?.focus();
      } else {
        setError(resultado.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      {/* Buscar y agregar */}
      <section className="space-y-4">
        {!cashEnabled ? (
          <div className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-3 text-sm text-[var(--fo-warning)]">
            El módulo de Caja está apagado. Las ventas se registran igual, pero el dinero no
            entra al libro de caja.
          </div>
        ) : null}
        <div className="fo-card space-y-3 p-4">
          <input
            ref={searchRef}
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKeyDown}
            className="fo-input text-base"
            placeholder="Escaneá un código, o buscá por nombre…"
          />
          {buscando ? <p className="fo-helper">Buscando en todo el catálogo…</p> : null}
          {categories.length > 0 ? (
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="fo-input">
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {filtrados.length === 0 ? (
          <div className="fo-card flex flex-col items-center gap-3 px-6 py-12 text-center">
            <Package className="size-8 text-[var(--fo-muted)]" aria-hidden />
            <p className="text-sm font-medium">Ningún producto coincide con esa búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filtrados.map((p) => {
              // §2.6 y §4.3 del diseño: vender nunca se bloquea por falta de existencia,
              // pero el mostrador tiene que avisar. Antes de este arreglo la pantalla no
              // leía `tracksStock` ni `stockQty` una sola vez, aunque los dos ya viajaban.
              const sinStock = p.tracksStock && p.stockQty <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => agregarProducto(p)}
                  className="fo-card flex flex-col gap-2 p-3 text-left transition hover:border-[var(--fo-accent)] hover:shadow-sm"
                >
                  <div className="aspect-square w-full overflow-hidden rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg)]">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[var(--fo-muted)]">
                        <Package className="size-6" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--fo-text)]">{p.name}</p>
                    <p className="text-sm font-semibold text-[var(--fo-accent)]">{formatMinorArs(p.priceMinor)}</p>
                    {p.tracksStock ? (
                      <p className={`text-xs ${sinStock ? "font-semibold text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"}`}>
                        {sinStock ? "Sin existencia" : `Existencia: ${p.stockQty}`}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* El ticket */}
      <section className="fo-card sticky top-4 flex h-fit flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Ticket</h2>
          <button
            type="button"
            onClick={() => setMostrarSuelto((v) => !v)}
            className="fo-btn fo-btn-ghost text-xs"
          >
            + Renglón suelto
          </button>
        </div>

        {mostrarSuelto ? (
          <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-dashed border-[var(--fo-border)] p-3">
            <p className="fo-helper">Para lo que se vende una vez y no merece estar en el catálogo. No mueve stock.</p>
            <input
              value={sueltoDescripcion}
              onChange={(e) => setSueltoDescripcion(e.target.value)}
              placeholder="Descripción"
              className="fo-input"
            />
            <input
              value={sueltoPrecio}
              onChange={(e) => setSueltoPrecio(e.target.value)}
              placeholder="Precio"
              className="fo-input"
              inputMode="decimal"
            />
            <button type="button" onClick={agregarSuelto} className="fo-btn fo-btn-secondary w-full text-sm">
              Agregar al ticket
            </button>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <p className="fo-helper py-6 text-center">Todavía no agregaste nada.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.key} className="space-y-1.5 border-b border-[var(--fo-border)] pb-3 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fo-text)]">{r.description}</p>
                  <button
                    type="button"
                    onClick={() => quitarRenglon(r.key)}
                    className="text-xs text-[var(--fo-muted)] hover:text-[var(--fo-danger)]"
                  >
                    Quitar
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={r.qty}
                    onChange={(e) => actualizarCantidad(r.key, Number(e.target.value))}
                    className="fo-input w-16 text-sm"
                  />
                  <span className="text-[var(--fo-muted)]">×</span>
                  <input
                    defaultValue={formatMinorArs(r.unitPriceMinor).replace("$", "").trim()}
                    onBlur={(e) => actualizarPrecio(r.key, e.target.value)}
                    className="fo-input flex-1 text-sm"
                    inputMode="decimal"
                  />
                  <span className="w-24 shrink-0 text-right text-sm font-semibold">
                    {formatMinorArs(r.qty * r.unitPriceMinor)}
                  </span>
                </div>
                {r.priceWasOverridden ? <p className="fo-helper text-[var(--fo-accent)]">Precio pisado a mano.</p> : null}
                {r.tracksStock && r.stockQty !== null && r.stockQty <= 0 ? (
                  <p className="fo-helper font-semibold text-[var(--fo-danger)]">
                    Sin existencia: se vende igual, pero no queda nada cargado.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-1 border-t border-[var(--fo-border)] pt-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--fo-muted)]">Subtotal</span>
            <span>{formatMinorArs(totals.subtotalMinor)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--fo-muted)]">Descuento</span>
            <input
              value={discountText}
              onChange={(e) => setDiscountText(e.target.value)}
              placeholder="0"
              className="fo-input w-28 text-right text-sm"
              inputMode="decimal"
            />
          </div>
          <div className="flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatMinorArs(totals.totalMinor)}</span>
          </div>
        </div>

        {clientsEnabled ? (
          <div className="space-y-2 border-t border-[var(--fo-border)] pt-3">
            <label className="fo-label">Cliente</label>
            <select
              value={clienteModo}
              onChange={(e) => setClienteModo(e.target.value as ClienteModo)}
              className="fo-input"
            >
              <option value="ninguno">Sin cliente</option>
              <option value="existente">Cliente ya cargado</option>
              <option value="nuevo">Cliente nuevo</option>
            </select>
            {clienteModo === "existente" ? (
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="fo-input">
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
                <input
                  value={clientFirstName}
                  onChange={(e) => setClientFirstName(e.target.value)}
                  placeholder="Nombre"
                  className="fo-input col-span-2"
                />
                <input
                  value={clientLastName}
                  onChange={(e) => setClientLastName(e.target.value)}
                  placeholder="Apellido"
                  className="fo-input"
                />
                <input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="Teléfono"
                  className="fo-input"
                />
                <input
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="Correo"
                  className="fo-input col-span-2"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2 border-t border-[var(--fo-border)] pt-3">
          <label className="fo-label">Medio de pago</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as SalePaymentMethod)}
            className="fo-input"
          >
            {SALE_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {ETIQUETA_PAGO[m]}
              </option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (opcional)"
            className="fo-input"
          />
        </div>

        {error ? (
          <p className="fo-card p-3 text-sm text-[var(--fo-danger)]" role="alert">
            {error}
          </p>
        ) : null}
        {ultimaVenta !== null ? (
          <div className="fo-card space-y-1 p-3 text-sm">
            <p className="text-[var(--fo-success)]">Venta #{ultimaVenta.saleNumber} registrada.</p>
            {!ultimaVenta.deposited ? (
              <p className="text-[var(--fo-warning)]">
                No se depositó en Caja: este ingreso no va a aparecer en el libro.
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={cobrar}
          disabled={procesando || rows.length === 0}
          className="fo-btn fo-btn-primary w-full text-base"
        >
          {procesando ? "Cobrando…" : `Cobrar ${formatMinorArs(totals.totalMinor)}`}
        </button>
      </section>
    </div>
  );
}
