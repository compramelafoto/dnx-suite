import "server-only";
import { prisma } from "@/lib/prisma";
import { parseExternalPreventaRefs } from "@/lib/canje-externo/external-preventa";
import { parseDesignV2Data } from "@/lib/design-v2/design-data";
import { INFO_PASOS, ubicarPedido, type UbicacionEnEmbudo } from "@/lib/schools/embudo-pedidos-escolares";
import { leerCodigoDeCanje, secretoDeEntrega } from "./codigo-de-canje";

/**
 * Lo que abre el QR de la etiqueta de un pedido escolar (`/escolar/entrega/[codigo]`).
 *
 * Hay dos clases de código:
 * - Tienda escolar: el `fulfillmentQrToken` guardado en el ítem.
 * - Canje de un pack cobrado por fuera (librito o copias sueltas): "c<pedido>.<firma>".
 *
 * Desde el QR se puede marcar el pedido "Listo para entregar" (sólo el fotógrafo dueño, con su
 * sesión) o "Entregado" (el fotógrafo, o quien lo recibe con el botón «Confirmar que lo recibí»).
 */

export type EntregaPorQr = {
  tipo: "TIENDA" | "CANJE";
  /** Ítem de la tienda escolar o pedido de canje. */
  id: number;
  albumId: number;
  /** Dueño del álbum (el fotógrafo). */
  fotografoId: number;
  alumno: string;
  curso: string | null;
  escuela: string | null;
  paso: UbicacionEnEmbudo;
  /** Fotos que van en el pedido, con el tipo de cada una ("13x18", "Digital"…). */
  fotos: Array<{ photoId: number; tipos: string[] }>;
  /** Libritos del pedido (para la vista previa del fotógrafo). */
  disenos: number[];
};

export type AccionDeEntrega = "LISTO" | "ENTREGADO";

const textoCurso = (nombre: string | null | undefined, division?: string | null) =>
  nombre?.trim() ? `${nombre.trim()}${division?.trim() ? ` ${division.trim()}` : ""}` : null;

function etiquetaDeItem(productType: string, size: string | null, quantity: number): string {
  const base = productType === "DIGITAL" ? "Digital" : size?.trim() || "Impresa";
  return quantity > 1 ? `${base} ×${quantity}` : base;
}

/** El pedido que corresponde a un código de QR, o null si el código no es válido. */
export async function cargarEntregaPorQr(codigo: string): Promise<EntregaPorQr | null> {
  const limpio = codigo.trim();
  if (!limpio) return null;
  const secreto = secretoDeEntrega();
  const canje = secreto ? leerCodigoDeCanje(limpio, secreto) : null;
  return canje ? cargarCanje(canje) : cargarItemDeTienda(limpio);
}

async function cargarCanje(orderId: number): Promise<EntregaPorQr | null> {
  const [pedido, pack, disenos, copias] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        albumId: true,
        album: { select: { userId: true, school: { select: { name: true } } } },
        items: { select: { photoId: true, productType: true, size: true, quantity: true }, orderBy: { id: "asc" } },
      },
    }),
    // El pack cobrado por fuera es el pedido de preventa; éste es su canje.
    prisma.order.findFirst({
      where: { redemptionOrderId: orderId },
      select: { buyerName: true, redemptionPaymentRefsJson: true },
    }),
    prisma.designProject.findMany({
      where: { albumOrderId: orderId },
      select: { id: true, status: true, sentToPrintAt: true, printedAt: true, deliveredAt: true },
      orderBy: { id: "asc" },
    }),
    prisma.schoolCopiesPrintJob.findUnique({ where: { orderId } }),
  ]);
  if (!pedido?.album || !pack) return null;
  const externo = parseExternalPreventaRefs(pack.redemptionPaymentRefsJson);

  const porFoto = new Map<number, string[]>();
  for (const it of pedido.items) {
    porFoto.set(it.photoId, [...(porFoto.get(it.photoId) ?? []), etiquetaDeItem(String(it.productType), it.size, it.quantity)]);
  }
  const tieneCopiasFisicas = pedido.items.some((it) => String(it.productType) !== "DIGITAL");
  const paso = ubicarPedido({
    kind: "PACK_EXTERNO",
    canjeado: true,
    disenos,
    tieneCopiasFisicas,
    copias:
      tieneCopiasFisicas && disenos.length === 0
        ? (copias ?? { printBatchName: null, sentToPrintAt: null, printedAt: null, deliveredAt: null })
        : null,
  });
  return {
    tipo: "CANJE",
    id: orderId,
    albumId: pedido.albumId,
    fotografoId: pedido.album.userId,
    alumno: externo?.studentName?.trim() || pack.buyerName?.trim() || "—",
    curso: textoCurso(externo?.courseName),
    escuela: pedido.album.school?.name?.trim() || externo?.schoolName?.trim() || null,
    paso,
    fotos: [...porFoto.entries()].map(([photoId, tipos]) => ({ photoId, tipos })),
    disenos: disenos.map((d) => d.id),
  };
}

async function cargarItemDeTienda(token: string): Promise<EntregaPorQr | null> {
  const item = await prisma.preCompraOrderItem.findUnique({
    where: { fulfillmentQrToken: token },
    select: {
      id: true,
      status: true,
      order: {
        select: {
          status: true,
          albumId: true,
          studentFirstName: true,
          studentLastName: true,
          schoolCourse: { select: { name: true, division: true } },
          album: { select: { userId: true, school: { select: { name: true } } } },
        },
      },
      designProject: {
        select: {
          id: true,
          status: true,
          sentToPrintAt: true,
          printedAt: true,
          deliveredAt: true,
          currentRevision: { select: { dataJson: true } },
        },
      },
    },
  });
  if (!item?.order.album) return null;
  const d = item.designProject;
  const paso = ubicarPedido({
    kind: "TIENDA_ESCOLAR",
    orderStatus: String(item.order.status),
    items: [{ status: String(item.status), diseno: d ? { status: d.status, sentToPrintAt: d.sentToPrintAt, printedAt: d.printedAt, deliveredAt: d.deliveredAt } : null }],
  });
  // En la tienda escolar las fotos que van son las del librito.
  const photoIds = d ? (parseDesignV2Data(d.currentRevision?.dataJson)?.photoIds ?? []) : [];
  return {
    tipo: "TIENDA",
    id: item.id,
    albumId: item.order.albumId,
    fotografoId: item.order.album.userId,
    alumno: [item.order.studentFirstName, item.order.studentLastName].filter(Boolean).join(" ").trim() || "—",
    curso: textoCurso(item.order.schoolCourse?.name, item.order.schoolCourse?.division),
    escuela: item.order.album.school?.name?.trim() || null,
    paso,
    fotos: [...new Set(photoIds)].map((photoId) => ({ photoId, tipos: ["Librito"] })),
    disenos: d ? [d.id] : [],
  };
}

/** Qué acciones tiene sentido ofrecer según el paso en que está el pedido. */
export function accionesPosibles(paso: UbicacionEnEmbudo): { listo: boolean; entregado: boolean } {
  const orden = ["POR_CANJEAR", "REVISAR_DISENO", "CAMBIOS_PEDIDOS", "PARA_IMPRIMIR", "EN_IMPRENTA", "PARA_ENTREGAR", "ENTREGADO"];
  const i = orden.indexOf(paso);
  // Desde que está aprobado ("Para imprimir") ya se puede embolsar y entregar.
  return { listo: i >= 3 && i < 5, entregado: i >= 3 && i < 6 };
}

export const TITULO_PASO = (paso: UbicacionEnEmbudo) =>
  paso in INFO_PASOS ? INFO_PASOS[paso as keyof typeof INFO_PASOS].titulo : paso === "CANCELADO" ? "Cancelado" : "Pago pendiente";

/**
 * Marca el pedido "Listo para entregar" (impreso y en la escuela) o "Entregado". Quién puede
 * hacerlo lo decide quien llama. Devuelve false si el pedido no está en un paso que lo permita.
 */
export async function marcarEntregaPorQr(e: EntregaPorQr, accion: AccionDeEntrega): Promise<boolean> {
  const posibles = accionesPosibles(e.paso);
  if (accion === "LISTO" ? !posibles.listo : !posibles.entregado) return false;
  const ahora = new Date();

  if (e.tipo === "TIENDA") {
    await prisma.$transaction([
      prisma.preCompraOrderItem.update({
        where: { id: e.id },
        data: { status: accion === "LISTO" ? "AT_SCHOOL" : "DELIVERED" },
      }),
      ...(e.disenos.length
        ? [
            prisma.designProject.updateMany({ where: { id: { in: e.disenos }, printedAt: null }, data: { printedAt: ahora } }),
            ...(accion === "ENTREGADO"
              ? [prisma.designProject.updateMany({ where: { id: { in: e.disenos } }, data: { deliveredAt: ahora } })]
              : []),
          ]
        : []),
    ]);
    return true;
  }

  // Canje: los libritos guardan su avance en el diseño; las copias sueltas, en su fila de avance.
  if (e.disenos.length) {
    await prisma.designProject.updateMany({ where: { id: { in: e.disenos }, printedAt: null }, data: { printedAt: ahora } });
    if (accion === "ENTREGADO") {
      await prisma.designProject.updateMany({ where: { id: { in: e.disenos } }, data: { deliveredAt: ahora } });
    }
    return true;
  }
  const actual = await prisma.schoolCopiesPrintJob.findUnique({ where: { orderId: e.id } });
  const fechas = {
    sentToPrintAt: actual?.sentToPrintAt ?? ahora,
    printedAt: actual?.printedAt ?? ahora,
    ...(accion === "ENTREGADO" ? { deliveredAt: ahora } : {}),
  };
  await prisma.schoolCopiesPrintJob.upsert({
    where: { orderId: e.id },
    create: { orderId: e.id, photographerUserId: e.fotografoId, ...fechas },
    update: fechas,
  });
  return true;
}
