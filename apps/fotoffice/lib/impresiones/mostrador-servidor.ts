import "server-only";
import { randomBytes } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { calidadDeCopia } from "@/lib/impresion/geometria";
import { medidaEnMm, type RenglonLab } from "@/lib/impresion/laboratorio";
import { renglonesDeLaPreparacion } from "@/lib/impresion/laboratorio-servidor";
import { validarReceta } from "@/lib/impresion/receta";

/**
 * El «Pedido para laboratorio» del Mostrador, del lado del cobro. Antes de crear el pedido se
 * comprueba que el ticket siga diciendo lo mismo que las fotos preparadas; después, cada foto se
 * vuelve un ítem de un `FotofficePrintOrder` de mostrador, ya pagado, atado al trabajo de su
 * renglón: el cron de impresiones (`prepararPedido`) arma el ZIP y se lo manda al laboratorio.
 */

type Linea = { productId: string | null; qty: number; unitPriceMinor: number };

const FOTOS_CAMBIARON = "Las fotos cambiaron: tocá el pedido para laboratorio y volvé a cobrar.";

/** El primer renglón sin laboratorio, con su mensaje; null si todos tienen. */
export function laboratorioFaltante(renglones: readonly RenglonLab[], nombres: ReadonlyMap<string, string>): string | null {
  const r = renglones.find((x) => !x.proveedorId);
  return r ? `${nombres.get(r.productId) ?? "Un producto"} no tiene laboratorio asignado: cargá el proveedor en el catálogo.` : null;
}

export const mensajeFlujoQueNoSirve = (producto: string) => `El flujo de ${producto} no sirve: revisalo en el catálogo antes de cobrar.`;

/**
 * Los nombres de los productos con regla en «Proyecto que genera» cuyo flujo se saltearía al crear
 * el pedido (no existe, no es de trabajo, está archivado o no tiene etapas: las mismas condiciones
 * con las que `planificarProyectos` deja su aviso): sin trabajo no hay a qué atar las fotos. Un
 * producto SIN regla no está acá: su trabajo se crea igual, en «Para retirar».
 */
export async function flujosQueNoSirven(workspaceId: string, productIds: readonly string[]): Promise<string[]> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return [];
  const reglas = await prisma.fotofficeProductoProyecto.findMany({ where: { workspaceId, productId: { in: ids } }, select: { productId: true, circuitId: true } });
  if (reglas.length === 0) return [];
  const circuitIds = [...new Set(reglas.map((r) => r.circuitId))];
  const [circuitos, etapas] = await Promise.all([
    prisma.fotofficeCircuit.findMany({ where: { workspaceId, id: { in: circuitIds } }, select: { id: true, kind: true, isActive: true } }),
    prisma.fotofficeStage.findMany({ where: { circuit: { workspaceId }, circuitId: { in: circuitIds }, archivedAt: null }, select: { circuitId: true } }),
  ]);
  const conEtapas = new Set(etapas.map((e) => e.circuitId));
  const sirve = new Set(circuitos.filter((c) => c.kind === "TRABAJO" && c.isActive && conEtapas.has(c.id)).map((c) => c.id));
  const rotos = ids.filter((id) => reglas.some((r) => r.productId === id && !sirve.has(r.circuitId)));
  if (rotos.length === 0) return [];
  const productos = await prisma.product.findMany({ where: { workspaceId, id: { in: rotos } }, select: { id: true, name: true } });
  const nombre = new Map(productos.map((p) => [p.id, p.name]));
  return rotos.map((id) => nombre.get(id) ?? "un producto");
}

/**
 * Si el pedido de impresión no se pudo crear después de cobrar, cada trabajo de laboratorio del
 * pedido queda con una nota que nombra la preparación: así se puede retomar sin perderla.
 */
export async function anotarFalloDeLaboratorio(d: { workspaceId: string; pedidoId: string; preparacionId: string; itemIndexes: readonly number[]; error: string }): Promise<void> {
  if (d.itemIndexes.length === 0) return;
  const trabajos = await prisma.fotofficeProyecto.findMany({
    where: { workspaceId: d.workspaceId, pedidoId: d.pedidoId, pedidoItemIndex: { in: [...d.itemIndexes] } },
    select: { id: true },
  });
  if (trabajos.length === 0) return;
  const body = `No se pudo preparar el pedido para laboratorio (preparación ${d.preparacionId}): ${d.error.trim().replace(/\.$/, "")}. Avisá a sistemas.`;
  await prisma.fotofficeProyectoNota.createMany({ data: trabajos.map((t) => ({ workspaceId: d.workspaceId, proyectoId: t.id, body, authorUserId: null })) });
}

/**
 * Las líneas del grupo de laboratorio del ticket tienen que ser exactamente los renglones de la
 * preparación (producto, cantidad y precio en centavos), y cada renglón tiene que tener laboratorio.
 */
export async function comprobarTicketDeLaboratorio(
  workspaceId: string,
  preparacionId: string,
  lineas: readonly Linea[],
): Promise<{ ok: true; renglones: RenglonLab[] } | { ok: false; error: string }> {
  const r = await renglonesDeLaPreparacion(workspaceId, preparacionId);
  if (!r.ok) return r;
  const clave = (productId: string | null, qty: number, minor: number) => `${productId}|${qty}|${minor}`;
  const esperado = r.renglones.map((x) => clave(x.productId, x.cantidad, Math.round(x.precioUnitario * 100))).sort();
  const recibido = lineas.map((l) => clave(l.productId, l.qty, l.unitPriceMinor)).sort();
  if (esperado.length !== recibido.length || esperado.some((x, i) => x !== recibido[i])) return { ok: false, error: FOTOS_CAMBIARON };
  const sinLab = laboratorioFaltante(r.renglones, r.nombres);
  if (sinLab) return { ok: false, error: sinLab };
  return { ok: true, renglones: r.renglones };
}

/** La medida nominal en cm («10x15» → 10 y 15), como los pedidos del bot: así la leen el ZIP y el resumen del laboratorio. */
function medidaNominalCm(medida: string): { widthCm: number; heightCm: number } | null {
  const m = medida.match(/^(\d{1,3})x(\d{1,3})$/);
  return m ? { widthCm: Number(m[1]), heightCm: Number(m[2]) } : null;
}

async function nombresDeLaboratorios(workspaceId: string, ids: readonly (string | null)[]): Promise<string[]> {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))];
  if (unicos.length === 0) return [];
  const filas = await prisma.fotofficeProveedor.findMany({ where: { workspaceId, id: { in: unicos } }, select: { name: true } });
  return [...new Set(filas.map((f) => f.name))].sort((a, b) => a.localeCompare(b, "es"));
}

/** El pedido de mostrador que ya salió de esta preparación (dentro de la transacción o afuera). */
function pedidoDeLaPreparacion(cliente: Pick<Prisma.TransactionClient, "fotofficePrintOrder">, workspaceId: string, preparacionId: string) {
  return cliente.fotofficePrintOrder.findFirst({
    where: { workspaceId, pricingSnapshot: { path: ["preparacionId"], equals: preparacionId } },
    select: { id: true, number: true },
  });
}

/**
 * La preparación ya se cobró: quedó LISTA o ya tiene su pedido de mostrador. Con un cobro repetido
 * es lo único que justifica no volver a comprobar el ticket (la comprobación la rechazaría).
 */
export async function preparacionYaCobrada(workspaceId: string, preparacionId: string): Promise<boolean> {
  const prep = await prisma.fotofficePreparacionImpresion.findFirst({ where: { workspaceId, id: preparacionId }, select: { estado: true } });
  if (prep?.estado === "LISTA") return true;
  return (await pedidoDeLaPreparacion(prisma, workspaceId, preparacionId)) !== null;
}

async function respuestaDe(workspaceId: string, pedido: { id: string; number: number }) {
  const items = await prisma.fotofficePrintOrderItem.findMany({ where: { orderId: pedido.id, order: { workspaceId } }, select: { proveedorId: true } });
  return { ok: true as const, numero: pedido.number, laboratorios: await nombresDeLaboratorios(workspaceId, items.map((i) => i.proveedorId)) };
}

/**
 * Después de crear el pedido (con sus trabajos): un `FotofficePrintOrder` de mostrador, PAGADO, con
 * un ítem por foto. Cada ítem va al trabajo de su renglón (el ítem del pedido de ese producto) y
 * cada trabajo queda con el laboratorio del renglón. La preparación queda LISTA. Idempotente por
 * preparación: si ya hay un pedido con esa `preparacionId`, devuelve ése.
 */
export async function crearPedidoDeMostrador(d: {
  workspaceId: string;
  preparacionId: string;
  pedidoId: string;
  clientId: string;
  nombreCliente: string;
  lineasDelPedido: { productId: string | null; itemIndex: number }[];
}): Promise<{ ok: true; numero: number; laboratorios: string[] } | { ok: false; error: string }> {
  const { workspaceId } = d;
  const ya = await pedidoDeLaPreparacion(prisma, workspaceId, d.preparacionId);
  if (ya) return respuestaDe(workspaceId, ya);

  const r = await renglonesDeLaPreparacion(workspaceId, d.preparacionId);
  if (!r.ok) return r;
  const sinLab = laboratorioFaltante(r.renglones, r.nombres);
  if (sinLab) return { ok: false, error: sinLab };

  // El renglón de cada producto, con el ítem del pedido y su trabajo (el primero, si la regla dio varios).
  const indices = r.renglones.map((x) => d.lineasDelPedido.find((l) => l.productId === x.productId)?.itemIndex ?? null);
  const trabajos = await prisma.fotofficeProyecto.findMany({
    where: { workspaceId, pedidoId: d.pedidoId, pedidoItemIndex: { in: indices.filter((i): i is number => i !== null) } },
    orderBy: { createdAt: "asc" },
    select: { id: true, pedidoItemIndex: true },
  });
  const porRenglon: { renglon: RenglonLab; itemIndex: number; proyectoId: string }[] = [];
  for (const [i, renglon] of r.renglones.entries()) {
    const itemIndex = indices[i];
    const trabajo = itemIndex === null ? undefined : trabajos.find((t) => t.pedidoItemIndex === itemIndex);
    if (itemIndex === null || !trabajo) {
      return { ok: false, error: `No se creó el trabajo de ${r.nombres.get(renglon.productId) ?? "un producto"}: revisá su flujo en el catálogo.` };
    }
    porRenglon.push({ renglon, itemIndex, proyectoId: trabajo.id });
  }

  const [originales, recetas] = await Promise.all([
    prisma.fotofficeOriginalImpresion.findMany({
      where: { workspaceId, preparacionId: d.preparacionId, id: { in: r.piezas.map((p) => p.originalId) } },
      select: { id: true, key: true, nombre: true, anchoPx: true, altoPx: true },
    }),
    prisma.fotofficePiezaImpresion.findMany({ where: { workspaceId, id: { in: r.piezas.map((p) => p.id) } }, select: { id: true, receta: true } }),
  ]);

  const items: Prisma.FotofficePrintOrderItemCreateManyInput[] = [];
  for (const p of r.piezas) {
    const original = originales.find((o) => o.id === p.originalId);
    // Los mm reales sólo sirven para medir la calidad (y para el render, que lo hace desde la pieza).
    const papelMm = medidaEnMm(p.medida);
    const nominal = medidaNominalCm(p.medida);
    const plazo = r.plazoFinal.get(p.originalId);
    const destino = plazo ? porRenglon.find((x) => x.renglon.claves.includes(`${p.medida}|${plazo}`)) : undefined;
    if (!original || !papelMm || !nominal || !plazo || !destino) return { ok: false, error: FOTOS_CAMBIARON };
    const receta = validarReceta(recetas.find((x) => x.id === p.id)?.receta);
    const pixelada = receta !== null && calidadDeCopia({ ancho: original.anchoPx, alto: original.altoPx }, receta, papelMm).aviso === "PIXELADA";
    items.push({
      orderId: "",
      sourceKey: original.key,
      sourceName: original.nombre,
      widthCm: nominal.widthCm,
      heightCm: nominal.heightCm,
      quantity: p.cantidad,
      unitPriceArs: 0,
      unitCostArs: 0,
      cropX: 0,
      cropY: 0,
      cropW: 1,
      cropH: 1,
      paper: p.papel,
      plazo,
      proveedorId: destino.renglon.proveedorId,
      proyectoId: destino.proyectoId,
      piezaId: p.id,
      calidadBaja: pixelada,
    });
  }

  const ahora = new Date();
  const pedido = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-impresion-numero:${workspaceId}`}))`;
    // Otra vuelta del mismo cobro pudo haberlo creado mientras se armaban los ítems.
    const otro = await pedidoDeLaPreparacion(tx, workspaceId, d.preparacionId);
    if (otro) return otro;
    const max = await tx.fotofficePrintOrder.aggregate({ where: { workspaceId }, _max: { number: true } });
    const creado = await tx.fotofficePrintOrder.create({
      data: {
        workspaceId,
        number: (max._max.number ?? 0) + 1,
        source: "MOSTRADOR",
        status: "PAGADO",
        paidAt: ahora,
        clientId: d.clientId,
        nombre: d.nombreCliente.trim().slice(0, 120) || "Cliente del mostrador",
        email: null,
        paper: r.piezas[0]!.papel,
        delivery: "RETIRO",
        subtotalArs: 0,
        shippingArs: 0,
        totalArs: 0,
        costTotalArs: 0,
        pricingSnapshot: { origen: "mostrador", preparacionId: d.preparacionId, pedidoId: d.pedidoId } as Prisma.InputJsonObject,
        trackingToken: randomBytes(18).toString("base64url"),
      },
      select: { id: true, number: true },
    });
    await tx.fotofficePrintOrderItem.createMany({ data: items.map((i) => ({ ...i, orderId: creado.id })) });
    for (const x of porRenglon) {
      // El costo del laboratorio, si el catálogo lo sabe; si no, el del trabajo queda como estaba.
      const costo = x.renglon.costoUnitario;
      await tx.fotofficeProyecto.updateMany({
        where: { workspaceId, pedidoId: d.pedidoId, pedidoItemIndex: x.itemIndex },
        data: {
          proveedorId: x.renglon.proveedorId,
          ...(typeof costo === "number" && Number.isFinite(costo) ? { proveedorCostoArs: Math.round(costo * x.renglon.cantidad * 100) / 100 } : {}),
        },
      });
    }
    await tx.fotofficePreparacionImpresion.updateMany({ where: { workspaceId, id: d.preparacionId }, data: { estado: "LISTA" } });
    return creado;
  });
  return respuestaDe(workspaceId, pedido);
}
