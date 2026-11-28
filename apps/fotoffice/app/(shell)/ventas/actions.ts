"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString, parseArsToMinor } from "@/lib/membership/money";
import { parseProductForm } from "@/lib/sales/product-form";
import { parseInsumoForm, type InsumoFormValues } from "@/lib/stock/insumo-form";
import { guardarInsumo, validarCambioDeTipo } from "@/lib/stock/insumo-guardas";
import { parseCategoryForm } from "@/lib/sales/category-form";
import { findGlobalByBarcode, upsertGlobalProduct } from "@/lib/sales/global-catalog";
import { globalFieldsFromProduct, prefillFromGlobal, type ProductPrefill } from "@/lib/sales/global-catalog-fields";
import { requireSalesAdmin, requireSalesStaff } from "@/lib/sales/access";
import { findProductByCode, listProducts, type ProductByCode, type ProductRow } from "@/lib/sales/repository";
import { MENSAJE_INSUMO_NO_SE_VENDE, esVendible } from "@/lib/sales/vendible";
import { ticketTotals, validateTicket } from "@/lib/sales/ticket";
import { confirmarUsoPagoMp, liberarPagoMp, reservarCobroMp } from "@/lib/sales/verificar-pago-servidor";
import { notaDePagoVerificado } from "@/lib/sales/verificar-pago";
import {
  buildTicketLines,
  resolveCheckoutClientInput,
  type CheckoutProductInfo,
  type CheckoutVariantInfo,
  type RawCheckoutClient,
  type RawCheckoutLine,
} from "@/lib/sales/checkout";
import { recordSale } from "@/lib/sales/record-sale";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { voidSale } from "@/lib/sales/void-sale";
import { SALE_PAYMENT_METHODS, type SalePaymentMethod } from "@/lib/sales/constants";
import { adjustmentQty, validateAdjustment, validateStockEntry } from "@/lib/sales/stock";
import { applyStockMovement } from "@/lib/sales/variant-stock";
import { lockStockRows } from "@/lib/sales/stock-lock";
import { asegurarKodak305, entradaEnUnidades } from "@/lib/stock/kodak305";
import { proponerEmbalaje } from "@/lib/stock/consumo-servidor";
import { EmbalajeInvalido, envoltoriosActivos, type EmbalajeElegido } from "@/lib/stock/embalaje-servidor";
import { calibrarMargenPct, margenValido } from "@/lib/precios-proveedor/margen";

const CATALOGO = "/ventas/catalogo";
const STOCK = "/ventas/stock";
const HISTORIAL = "/ventas/historial";

/**
 * Alta y edición de un producto.
 *
 * Cuando el formulario trae código de barras, la ficha del catálogo maestro se crea o se lee
 * DENTRO de la misma transacción que el alta o la edición del producto: si el producto no
 * llega a guardarse, tampoco tiene que quedar creada una ficha global huérfana. Los campos
 * que viajan al catálogo compartido salen exclusivamente de `globalFieldsFromProduct` —nunca
 * se arman a mano acá— para que un campo de plata no pueda colarse en una tabla que
 * comparten todos los negocios de la suite.
 */
export async function saveProductAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireSalesAdmin();

  const productId = String(formData.get("productId") ?? "").trim() || null;
  const destinoError = productId ? `${CATALOGO}/${productId}` : `${CATALOGO}/nuevo`;

  const parsed = parseProductForm(formData);
  if (!parsed.ok) redirect(`${destinoError}?error=${encodeURIComponent(parsed.error)}`);
  const v = parsed.values;

  // Los datos propios del insumo (unidad y presentación de compra) sólo se leen si es insumo.
  let insumo: InsumoFormValues | null = null;
  if (v.kind === "INSUMO") {
    const parsedInsumo = parseInsumoForm(formData);
    if (!parsedInsumo.ok) redirect(`${destinoError}?error=${encodeURIComponent(parsedInsumo.error)}`);
    insumo = parsedInsumo.values;
  }

  if (productId) {
    // El `where` de un update tiene que ser único, así que el workspace no puede viajar ahí.
    const propio = await prisma.product.count({ where: { id: productId, workspaceId: workspace.id } });
    if (propio === 0) redirect(`${CATALOGO}?error=${encodeURIComponent("Ese producto no existe.")}`);
  }

  // `ProductCategory` no tiene ninguna restricción que ate la categoría al workspace del
  // producto: sin este control, un `categoryId` de OTRO negocio se guarda sin problema, y
  // como `listProducts`/`getProduct` traen `category: { select: { name: true } }`, el nombre
  // de esa categoría ajena queda visible en la lista y en la ficha de este negocio. Vacío es
  // válido (un producto puede no tener categoría); lo que se rechaza es la categoría que
  // existe pero es de otro workspace.
  if (v.categoryId) {
    const propia = await prisma.productCategory.count({
      where: { id: v.categoryId, workspaceId: workspace.id },
    });
    if (propia === 0) redirect(`${destinoError}?error=${encodeURIComponent("Esa categoría no existe.")}`);
  }

  // Mismo control que la categoría: un proveedor de otro negocio no se puede colgar acá.
  if (v.preferredProveedorId) {
    const propio = await prisma.fotofficeProveedor.count({ where: { id: v.preferredProveedorId, workspaceId: workspace.id } });
    if (propio === 0) redirect(`${destinoError}?error=${encodeURIComponent("Ese proveedor no existe.")}`);
  }

  // Con margen guardado (Ventas → Costos y márgenes), la ficha manda precio y costo y el margen
  // los sigue: cambiar el precio a mano es recalibrar ese producto (spec de listas, §14).
  let marginPct: string | undefined;
  if (productId) {
    const previo = await prisma.product.findFirst({ where: { id: productId, workspaceId: workspace.id }, select: { marginPct: true } });
    const calibrado = previo?.marginPct != null ? calibrarMargenPct(v.priceMinor, v.costMinor) : null;
    if (calibrado !== null && !margenValido(calibrado)) {
      redirect(`${destinoError}?error=${encodeURIComponent(`Con ese precio y ese costo el margen daría ${calibrado} %: revisá el costo.`)}`);
    }
    if (calibrado !== null) marginPct = calibrado.toFixed(2);
  }

  // La base guarda `Decimal(12,2)`; el formulario trabaja en centavos enteros. `priceMinor`
  // y `costMinor` no son columnas de `Product` —lo son `priceArs` y `costArs`— así que no se
  // puede volcar `v` entero en el `data` de Prisma sin antes convertirlos.
  const { priceMinor, costMinor, ...camposProducto } = v;
  const datosProducto = {
    ...camposProducto,
    priceArs: minorToDecimalString(priceMinor),
    costArs: costMinor === null ? null : minorToDecimalString(costMinor),
    ...(marginPct !== undefined ? { marginPct } : {}),
  };

  try {
    // Todo en UNA transacción: el producto, su ficha del catálogo maestro (si trae código de
    // barras) y su ficha de insumo. Un producto que pasa a ser INSUMO no puede quedar sin
    // `FotofficeInsumo` (el consumo y el stock la leen), ni al revés.
    const errorDeTipo = await prisma.$transaction(async (tx) => {
      let kindAnterior: string | null = null;
      if (productId) {
        const actual = await tx.product.findFirst({
          where: { id: productId, workspaceId: workspace.id },
          select: { kind: true },
        });
        kindAnterior = actual?.kind ?? null;
        const bloqueo = await validarCambioDeTipo(tx, {
          workspaceId: workspace.id,
          productId,
          kindAnterior,
          kindNuevo: v.kind,
        });
        if (bloqueo) return bloqueo;
      }

      let data: typeof datosProducto & { globalProductId: string | null };
      if (v.barcode) {
        const global = await upsertGlobalProduct(tx, {
          barcode: v.barcode,
          ...globalFieldsFromProduct(v),
          workspaceId: workspace.id,
          userId: user.id,
        });
        data = { ...datosProducto, globalProductId: global.id };
      } else {
        // Sin código de barras no hay catálogo maestro que tocar. Si el producto tenía uno
        // antes y se lo borraron acá, `globalProductId` se limpia: no tiene sentido dejar
        // colgada la referencia a una ficha que este producto ya no reclama.
        data = { ...datosProducto, globalProductId: null };
      }

      let guardadoId: string;
      if (productId) {
        await tx.product.update({ where: { id: productId }, data });
        guardadoId = productId;
      } else {
        const creado = await tx.product.create({
          data: { ...data, workspaceId: workspace.id, createdByUserId: user.id },
          select: { id: true },
        });
        guardadoId = creado.id;
      }

      // Si el producto deja de ser insumo, su ficha queda (inofensiva) y la pantalla no la muestra.
      if (insumo) {
        await guardarInsumo(tx, { workspaceId: workspace.id, productId: guardadoId, values: insumo });
      }
      return null;
    });
    if (errorDeTipo) redirect(`${destinoError}?error=${encodeURIComponent(errorDeTipo)}`);
  } catch (e) {
    // P2002 = choque con un índice único. El único índice único de `Product` que un
    // formulario puede disparar es `[workspaceId, sku]`: el mensaje crudo de Prisma no le
    // dice nada a quien está cargando el producto.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(`${destinoError}?error=${encodeURIComponent("Ya tenés un producto con ese código.")}`);
    }
    throw e;
  }

  revalidatePath(CATALOGO);
  redirect(productId ? `${CATALOGO}/${productId}?ok=1` : `${CATALOGO}?ok=1`);
}

/**
 * Activar o desactivar un producto.
 *
 * Nunca lo borra: las ventas viejas lo siguen nombrando (`SaleItem` guarda su nombre y su
 * precio de ese momento, pero también el `productId`), y borrar la fila dejaría esos
 * renglones apuntando a un producto que ya no existe.
 */
export async function toggleProductActiveAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSalesAdmin();
  const productId = String(formData.get("productId") ?? "").trim();
  const activar = formData.get("active") === "on";

  await prisma.product.updateMany({
    where: { id: productId, workspaceId: workspace.id },
    data: { isActive: activar },
  });

  revalidatePath(CATALOGO);
  revalidatePath(`${CATALOGO}/${productId}`);
  redirect(`${CATALOGO}/${productId}?ok=${activar ? "activado" : "desactivado"}`);
}

/** Alta y edición de una categoría de productos. Igual que la de Caja, sin lado. */
export async function saveCategoryAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSalesAdmin();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;

  const parsed = parseCategoryForm(formData);
  if (!parsed.ok) redirect(`${CATALOGO}?error=${encodeURIComponent(parsed.error)}`);
  const v = parsed.values;

  if (categoryId) {
    const propia = await prisma.productCategory.count({
      where: { id: categoryId, workspaceId: workspace.id },
    });
    if (propia === 0) redirect(`${CATALOGO}?error=${encodeURIComponent("Esa categoría no existe.")}`);
    await prisma.productCategory.update({ where: { id: categoryId }, data: v });
  } else {
    try {
      await prisma.productCategory.create({ data: { ...v, workspaceId: workspace.id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        redirect(`${CATALOGO}?error=${encodeURIComponent("Ya existe una categoría con ese nombre.")}`);
      }
      throw e;
    }
  }

  revalidatePath(CATALOGO);
  redirect(`${CATALOGO}?ok=1`);
}

/**
 * Busca el código escaneado en el catálogo maestro, para precargar el alta.
 *
 * No es la acción de un `<form>`: la pantalla de alta la llama directo, al apretar Enter en
 * el campo de código de barras, para no perder el resto de lo que la persona ya tipeó. Sólo
 * lee —nunca crea ni modifica la ficha global—, así que alcanza con el nivel de acceso de
 * catálogo: se usa exclusivamente desde una pantalla que ya exige `requireSalesAdmin`.
 */
export async function lookupGlobalProductAction(formData: FormData): Promise<ProductPrefill> {
  await requireSalesAdmin();
  const barcode = String(formData.get("barcode") ?? "");
  const global = await findGlobalByBarcode(barcode);
  return prefillFromGlobal(global);
}

/**
 * Busca UN producto por código exacto —sku o código de barras—, para cuando el Enter del
 * lector no encontró nada entre los productos que `page.tsx` ya precargó en pantalla.
 *
 * `listProducts` corta en 200 (ver el comentario en `lib/sales/repository.ts`) y la pantalla
 * nunca vuelve a pedir el catálogo entero: con más de 200 productos activos, el resto es
 * invisible para la grilla y para el lector por igual. `findProductByCode` —la interfaz que
 * la Tarea 6 construyó exactamente para este caso, con la normalización del código de barras
 * ya adentro— es la puerta más chica posible para tapar ese agujero: una acción de servidor
 * que la pantalla llama sólo cuando de verdad hace falta (no encontró nada localmente), no un
 * endpoint nuevo ni un cambio de arquitectura.
 */
export async function findProductByCodeAction(code: string): Promise<ProductByCode | null> {
  const { workspace } = await requireSalesStaff();
  return findProductByCode(workspace.id, code);
}

/**
 * Busca productos por texto en el servidor, sin el techo de 200 de la precarga.
 *
 * Mismo motivo que `findProductByCodeAction`: un negocio con un catálogo mediano tiene
 * productos que la pantalla nunca llegó a traer. La pantalla dispara esto con lo que se va
 * tipeando (con una demora corta del lado del cliente, para no pegarle a la base en cada
 * tecla) y usa el resultado en vez de filtrar sólo el array precargado.
 */
export async function searchProductsAction(input: {
  search: string;
  categoryId?: string;
}): Promise<ProductRow[]> {
  const { workspace } = await requireSalesStaff();
  return listProducts(workspace.id, {
    search: input.search,
    categoryId: input.categoryId || undefined,
    onlyActive: true,
    onlyCounter: true,
  });
}

export type CheckoutInput = {
  lines: RawCheckoutLine[];
  discountMinor: number;
  paymentMethod: string;
  note: string;
  client: RawCheckoutClient;
  /** El cobro de Mercado Pago que "Verificar pago" encontró para este ticket (opcional). */
  mpPaymentId?: string | null;
  /** La order del QR del mostrador ya pagada (opcional). */
  mpOrderId?: string | null;
  /** Sobres y bolsas cambiados a mano en el Cobrador. Sin esto, los calcula el sistema. */
  embalaje?: EmbalajeElegido[] | null;
};

export type VistaEmbalaje = {
  propuesto: (EmbalajeElegido & { nombre: string; motivo: string })[];
  opciones: { insumoId: string; nombre: string }[];
};

/**
 * Lo que el Cobrador muestra como «Embalaje: …»: lo que el sistema descontaría con este ticket y
 * los envoltorios activos para cambiarlo. Sólo lee. Sin envoltorios, `opciones` viene vacío y la
 * línea no se muestra.
 */
export async function previsualizarEmbalajeAction(lineas: { productId: string | null; qty: number }[]): Promise<VistaEmbalaje> {
  const { workspace } = await requireSalesStaff();
  const limpias = (Array.isArray(lineas) ? lineas : [])
    .slice(0, 200)
    .map((l) => ({ productId: typeof l?.productId === "string" ? l.productId : null, qty: Number.isInteger(l?.qty) && l.qty > 0 ? l.qty : 0 }));
  const opciones = await envoltoriosActivos(prisma, workspace.id);
  if (opciones.length === 0) return { propuesto: [], opciones: [] };
  const nombre = new Map(opciones.map((o) => [o.insumoId, o.nombre]));
  const propuesto = await proponerEmbalaje(prisma, workspace.id, limpias);
  return {
    propuesto: propuesto.map((e) => ({ ...e, nombre: nombre.get(e.insumoId) ?? "" })),
    opciones: opciones.map((o) => ({ insumoId: o.insumoId, nombre: o.nombre })),
  };
}

export type CheckoutResult =
  | { ok: true; saleNumber: number; deposited: boolean }
  | { ok: false; error: string };

/**
 * Cobrar. Es el botón que cierra el ticket, con gente esperando del otro lado del mostrador:
 * por eso no redirige ni recarga la pantalla —se llama directo desde `pos.tsx`, no desde un
 * `<form>`— y devuelve un resultado que el ticket usa para mostrar el número de venta o el
 * error sin perder lo que ya se había cargado.
 *
 * Vender es STAFF+, no ADMIN+ (`requireSalesStaff`, no `requireSalesAdmin`): es lo que hace
 * el mostrador todo el día.
 */
export async function checkoutAction(input: CheckoutInput): Promise<CheckoutResult> {
  const { workspace, user } = await requireSalesStaff();

  const paymentMethod = input.paymentMethod as SalePaymentMethod;
  if (!SALE_PAYMENT_METHODS.includes(paymentMethod)) {
    return { ok: false, error: "Elegí un medio de pago." };
  }

  if (!Number.isInteger(input.discountMinor) || input.discountMinor < 0) {
    return { ok: false, error: "El descuento no se entiende." };
  }

  // Cada `productId` del ticket se verifica contra ESTE workspace antes de escribir nada:
  // la misma fuga que se coló con una categoría en la tarea anterior, ahora con productos.
  // De paso, esta lectura trae el nombre y el costo de verdad —el costo ni siquiera viaja
  // hasta el mostrador— para que `buildTicketLines` no tenga que confiar en lo que mandó el
  // navegador.
  const productIds = [...new Set(input.lines.map((l) => l.productId).filter((id): id is string => id !== null))];
  const productos =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, workspaceId: workspace.id },
          select: { id: true, name: true, priceArs: true, costArs: true, kind: true },
        })
      : [];
  // Un insumo se gasta, no se vende: aunque el navegador lo mande, el servidor no lo cobra.
  if (productos.some((p) => !esVendible(p.kind))) return { ok: false, error: MENSAJE_INSUMO_NO_SE_VENDE };
  // Los talles activos de esos productos, también filtrados por workspace: un `variantId`
  // que no vuelva acá (de otro producto, de otro negocio, o desactivado) hace que
  // `buildTicketLines` rechace el ticket entero, igual que un `productId` ajeno.
  const talles =
    productIds.length > 0
      ? await prisma.productVariant.findMany({
          where: { productId: { in: productIds }, workspaceId: workspace.id, isActive: true },
          select: { id: true, productId: true, name: true, priceArs: true },
        })
      : [];
  const tallesPorProducto = new Map<string, Map<string, CheckoutVariantInfo>>();
  for (const t of talles) {
    const delProducto = tallesPorProducto.get(t.productId) ?? new Map<string, CheckoutVariantInfo>();
    delProducto.set(t.id, {
      id: t.id,
      name: t.name,
      variantPriceMinor: t.priceArs === null ? null : decimalArsToMinor(t.priceArs),
    });
    tallesPorProducto.set(t.productId, delProducto);
  }
  const productMap = new Map<string, CheckoutProductInfo>(
    productos.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        priceMinor: decimalArsToMinor(p.priceArs),
        costMinor: p.costArs === null ? null : decimalArsToMinor(p.costArs),
        variants: tallesPorProducto.get(p.id),
      },
    ]),
  );

  const armado = buildTicketLines(input.lines, productMap);
  if (!armado.ok) return { ok: false, error: armado.error };

  const validacion = validateTicket(armado.lines, input.discountMinor);
  if (!validacion.ok) return { ok: false, error: validacion.error };

  // Foto carnet preparada en el Mostrador: se valida antes de cobrar y se ata al renglón dentro de
  // la misma transacción de la venta (el candado de `vincularConVenta` impide cobrarla dos veces).
  // `armado.lines[i]` es el renglón de `input.lines[i]`: `buildTicketLines` no junta ni saltea.
  // Las copias además exigen que la cantidad del renglón sea el total de copias armado (`qty`).
  const preparaciones = input.lines
    .map((l, i) => ({ i, preparacionId: l.preparacionId ?? null, productId: l.productId, qty: armado.lines[i]!.qty }))
    .filter((p): p is { i: number; preparacionId: string; productId: string | null; qty: number } => typeof p.preparacionId === "string");
  // Import dinámico: el motor de impresión (sharp) sólo se carga si el ticket trae una preparación.
  const impresion = preparaciones.length > 0 ? await import("@/lib/impresion/preparaciones") : null;
  if (impresion) {
    const v = await impresion.validarParaCobrar(workspace.id, preparaciones);
    if (!v.ok) return { ok: false, error: v.error };
  }

  const client = resolveCheckoutClientInput(input.client);
  let note = input.note.trim();

  // Pago verificado en Mercado Pago: se reserva antes de registrar (una transferencia, una venta).
  let reservaId: string | null = null;
  if (input.mpPaymentId || input.mpOrderId) {
    if (paymentMethod !== "TRANSFERENCIA" && paymentMethod !== "MERCADO_PAGO") {
      return { ok: false, error: "El pago verificado sólo vale para transferencia o Mercado Pago." };
    }
    const reserva = await reservarCobroMp(workspace.id, user.id, input, ticketTotals(armado.lines, input.discountMinor).totalMinor);
    if (!reserva) return { ok: false, error: "Falta el pago verificado." };
    if (!reserva.ok) return { ok: false, error: reserva.error };
    reservaId = reserva.reservaId;
    note = [note, notaDePagoVerificado(reserva.pago)].filter(Boolean).join(" — ");
  }

  try {
    // Sin nivel de aislamiento explícito: READ COMMITTED (el de Postgres). Si dos ventas se
    // disputan la misma preparación, la segunda espera el candado de la fila, relee
    // `saleItemId` ya escrito, su `updateMany` cuenta 0 y lanza `PreparacionNoVinculable`.
    const venta = await prisma.$transaction(async (tx) => {
      const v = await recordSale(tx, {
        workspaceId: workspace.id,
        createdByUserId: user.id,
        occurredAt: new Date(),
        paymentMethod,
        discountMinor: input.discountMinor,
        note: note === "" ? null : note,
        client,
        lines: armado.lines,
        embalaje: Array.isArray(input.embalaje) ? { modo: "manual", elegido: input.embalaje } : undefined,
      });
      if (impresion) {
        await impresion.vincularConVenta(
          tx,
          { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user) },
          preparaciones.map((p) => ({ preparacionId: p.preparacionId, saleItemId: v.itemIds[p.i]! })),
          v.clientId,
        );
      }
      return v;
    });
    revalidatePath("/ventas");
    if (reservaId) await confirmarUsoPagoMp(reservaId, `Venta #${venta.saleNumber}`);
    if (impresion) await despuesDeCobrarPreparaciones(workspace.id, user, preparaciones);
    return { ok: true, saleNumber: venta.saleNumber, deposited: venta.deposited };
  } catch (e) {
    if (reservaId) await liberarPagoMp(reservaId);
    if (impresion && e instanceof impresion.PreparacionNoVinculable) return { ok: false, error: e.message };
    if (e instanceof EmbalajeInvalido) return { ok: false, error: e.message };
    console.error("[fotoffice][ventas] error al cobrar", e);
    return { ok: false, error: "No se pudo registrar la venta. Probá de nuevo." };
  }
}

/**
 * Después de cobrar un ticket con foto carnet preparada: copia el original a la ficha del cliente
 * de la venta. La venta ya está registrada, así que nada de esto puede volverla atrás ni mostrar
 * "no se pudo registrar": si falla, queda en el log y se reintenta al asignar cliente.
 * Privada: en un archivo "use server" todo lo exportado es una acción.
 */
async function despuesDeCobrarPreparaciones(
  workspaceId: string,
  user: Parameters<typeof etiquetaDeUsuario>[0],
  preparaciones: { preparacionId: string }[],
): Promise<void> {
  const avisar = (e: unknown) =>
    console.error("[fotoffice][ventas] no se guardó la foto carnet en la ficha", { error: e instanceof Error ? e.name : "?" });
  try {
    // También sin cliente en la venta: la preparación puede conservar el suyo.
    const { guardarOriginalesEnFicha } = await import("@/lib/impresion/ficha-carnet");
    const ctx = { workspaceId, userId: user.id, userLabel: etiquetaDeUsuario(user) };
    for (const p of preparaciones) await guardarOriginalesEnFicha(ctx, p.preparacionId).catch(avisar);
    revalidatePath("/ventas/impresiones");
  } catch (e) {
    avisar(e);
  }
}

/**
 * Cargar una entrada de mercadería.
 *
 * Sólo suma (§regla 3 de la Tarea 8: la entrada nunca resta, para eso está el ajuste, que
 * deja la nota). Escribe el `StockMovement` con motivo `ENTRADA` y actualiza la copia en
 * `Product.stockQty` en la MISMA transacción: si se separaran, el catálogo mostraría un
 * número y el libro otro, y nadie sabría cuál creer.
 *
 * Vender STAFF+ ya carga y ajusta stock desde este mismo mostrador (`requireSalesStaff`, no
 * `requireSalesAdmin`): recibir mercadería y contar son tareas del día a día, no de
 * administración del catálogo.
 */
export async function recordStockEntryAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireSalesStaff();
  const productId = String(formData.get("productId") ?? "").trim();
  const qty = Number(formData.get("qty"));
  const costoTexto = String(formData.get("unitCostArs") ?? "").trim();
  const unitCostMinor = costoTexto === "" ? null : parseArsToMinor(costoTexto);
  if (costoTexto !== "" && unitCostMinor === null) {
    redirect(`${STOCK}?error=${encodeURIComponent("El costo no se entiende.")}`);
  }

  const check = validateStockEntry({ qty, unitCostMinor });
  if (!check.ok) redirect(`${STOCK}?error=${encodeURIComponent(check.error)}`);

  // El mismo `count` contra el workspace que ya usa `saveProductAction`: la fuga de
  // aislamiento que se coló en la Tarea 6 con una categoría ajena no se repite acá con un
  // producto ajeno.
  const destino = await resolverDestinoDeStock(workspace.id, productId, formData);
  if (!destino.ok) redirect(`${STOCK}?error=${encodeURIComponent(destino.error)}`);

  // Un insumo se compra en kits pero se descuenta en copias: si la casilla está marcada, la
  // cantidad y el costo se pasan a la unidad de uso con la ficha del servidor (no con lo que
  // diga el formulario).
  let qtyFinal = qty;
  let costoFinal = unitCostMinor;
  if (formData.get("enUnidadDeCompra") === "on") {
    const ficha = await prisma.fotofficeInsumo.findFirst({
      where: { productId, workspaceId: workspace.id },
      select: { unidadesPorCompra: true },
    });
    if (!ficha?.unidadesPorCompra) {
      redirect(`${STOCK}?error=${encodeURIComponent("Ese insumo no tiene unidad de compra cargada.")}`);
    }
    const conv = entradaEnUnidades({
      cantidad: qty,
      enUnidadDeCompra: true,
      unidadesPorCompra: ficha.unidadesPorCompra,
      costoMinor: unitCostMinor,
    });
    qtyFinal = conv.qty;
    costoFinal = conv.unitCostMinor;
  }

  await prisma.$transaction(async (tx) => {
    // Mismo orden de bloqueo que la tienda y que vender (ver `lib/sales/stock-lock.ts`).
    await lockStockRows(tx, {
      workspaceId: workspace.id,
      productIds: [productId],
      variantIds: destino.variantId === null ? [] : [destino.variantId],
    });
    await applyStockMovement(tx, {
      workspaceId: workspace.id,
      productId,
      variantId: destino.variantId,
      qty: qtyFinal,
      reason: "ENTRADA",
      sourceModule: "sales",
      sourceRef: null,
      note: null,
      unitCostArs: costoFinal === null ? null : minorToDecimalString(costoFinal),
      createdByUserId: user.id,
    });
  });

  revalidatePath(STOCK);
  redirect(`${STOCK}?ok=1`);
}

/**
 * "Configurar" la Kodak 305: crea (o reconoce) el insumo del kit y su consumo por tamaño.
 * Mismo permiso que el resto de la pantalla Stock (STAFF+). No toca la existencia: después
 * la persona carga lo que tiene con "Ajustar por conteo".
 */
export async function configurarKodak305Action(): Promise<void> {
  const { workspace } = await requireSalesStaff();
  const r = await asegurarKodak305(workspace.id);
  if (!r.ok) redirect(`${STOCK}?error=${encodeURIComponent(r.error)}`);
  revalidatePath(STOCK);
  redirect(`${STOCK}?kodak=1`);
}

/**
 * Anular una venta.
 *
 * No la borra ni la edita: `voidSale` marca la `Sale` como ANULADA, devuelve el stock y
 * escribe el contramovimiento en Caja, las tres cosas en una sola transacción. Esta acción
 * sólo junta el `FormData`, abre la transacción, y traduce el resultado —`{ ok: false }` no es
 * una excepción, es el mismo motivo por el que `reverseMovementAction` en Caja tampoco lanza
 * cuando el movimiento ya estaba anulado— en una redirección con el mensaje puesto.
 *
 * Vender es STAFF+, no ADMIN+ (`requireSalesStaff`): deshacer una venta es corregir un error
 * del mostrador, no administrar el catálogo, mismo criterio que `checkoutAction`.
 */
export async function voidSaleAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireSalesStaff();
  const saleId = String(formData.get("saleId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "");

  let resultado: Awaited<ReturnType<typeof voidSale>>;
  try {
    resultado = await prisma.$transaction((tx) =>
      voidSale(tx, { workspaceId: workspace.id, saleId, reason, userId: user.id }),
    );
  } catch (e) {
    console.error("[fotoffice][ventas] error al anular la venta", e);
    redirect(`${HISTORIAL}?error=${encodeURIComponent("No se pudo anular la venta. Probá de nuevo.")}`);
  }

  if (!resultado.ok) {
    redirect(`${HISTORIAL}?error=${encodeURIComponent(resultado.error)}`);
  }

  revalidatePath(HISTORIAL);
  revalidatePath(STOCK);
  redirect(`${HISTORIAL}?ok=1`);
}

/**
 * Ajustar la existencia después de un conteo.
 *
 * `adjustmentQty` calcula cuánto mover a partir de lo que el libro dice hoy y de lo que se
 * contó; el movimiento queda firmado (puede sumar o restar) con motivo `AJUSTE` y la nota
 * que `validateAdjustment` ya exigió (§regla 2: un ajuste sin explicación no se entiende tres
 * meses después). Se escribe siempre, incluso cuando el conteo coincide con el libro y el
 * movimiento resulta en cero: eso también es información —confirma que alguien contó ese
 * día y que estaba bien— y la nota queda de todos modos.
 */
export async function recordAdjustmentAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireSalesStaff();
  const productId = String(formData.get("productId") ?? "").trim();
  const countedQty = Number(formData.get("countedQty"));
  const note = String(formData.get("note") ?? "").trim() || null;

  const check = validateAdjustment({ countedQty, note });
  if (!check.ok) redirect(`${STOCK}?error=${encodeURIComponent(check.error)}`);

  // Además de confirmar que el producto (y el talle, si tiene) es de ESTE workspace, hace
  // falta la existencia actual para calcular cuánto mover: la del talle cuando el producto
  // tiene talles —lo que se contó es ese talle—, la del producto si no.
  const destino = await resolverDestinoDeStock(workspace.id, productId, formData);
  if (!destino.ok) redirect(`${STOCK}?error=${encodeURIComponent(destino.error)}`);

  const qty = adjustmentQty({ currentQty: destino.currentQty, countedQty });

  await prisma.$transaction(async (tx) => {
    // Mismo orden de bloqueo que la tienda y que vender (ver `lib/sales/stock-lock.ts`).
    await lockStockRows(tx, {
      workspaceId: workspace.id,
      productIds: [productId],
      variantIds: destino.variantId === null ? [] : [destino.variantId],
    });
    await applyStockMovement(tx, {
      workspaceId: workspace.id,
      productId,
      variantId: destino.variantId,
      qty,
      reason: "AJUSTE",
      sourceModule: "sales",
      sourceRef: null,
      note,
      unitCostArs: null,
      createdByUserId: user.id,
    });
  });

  revalidatePath(STOCK);
  redirect(`${STOCK}?ok=1`);
}

/**
 * A dónde va una entrada o un ajuste: al producto, o a uno de sus talles.
 *
 * Con talles activos, el stock vive en los talles (D4): una entrada "al producto" sumaría a
 * `Product.stockQty` sin que ningún talle la tenga, y la suma dejaría de cuadrar. Por eso se
 * exige elegir talle. El talle se verifica contra el producto Y el workspace —la misma fuga de
 * aislamiento que ya se cuidó con el producto— antes de escribir nada. Un talle desactivado
 * todavía se puede ajustar (por ejemplo, para dejarlo en cero antes de olvidarlo).
 */
async function resolverDestinoDeStock(
  workspaceId: string,
  productId: string,
  formData: FormData,
): Promise<{ ok: true; variantId: string | null; currentQty: number } | { ok: false; error: string }> {
  const producto = await prisma.product.findFirst({
    where: { id: productId, workspaceId },
    select: { stockQty: true, variants: { where: { isActive: true }, select: { id: true }, take: 1 } },
  });
  if (!producto) return { ok: false, error: "Ese producto no existe." };

  const variantId = String(formData.get("variantId") ?? "").trim() || null;
  if (variantId === null) {
    if (producto.variants.length > 0) return { ok: false, error: "Elegí el talle." };
    return { ok: true, variantId: null, currentQty: producto.stockQty };
  }

  const talle = await prisma.productVariant.findFirst({
    where: { id: variantId, productId, workspaceId },
    select: { id: true, stockQty: true },
  });
  if (!talle) return { ok: false, error: "Ese talle no existe." };
  return { ok: true, variantId: talle.id, currentQty: talle.stockQty };
}
