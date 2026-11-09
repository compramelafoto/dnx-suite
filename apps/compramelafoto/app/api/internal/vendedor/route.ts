/**
 * Consultas internas del agente Vendedor de FOTOFFICE (atribuciones, ventas, campaña escolar y
 * conocimiento del DNX Bot). Protegida con el mismo secreto que la consulta de usuarios existentes:
 *   Authorization: Bearer <CLF_CONSULTA_USUARIOS_SECRET>
 *
 * La lógica vive en `lib/vendedor/consultas.ts`; acá sólo se conecta Prisma.
 */
import { prisma } from "@/lib/prisma";
import {
  CAMPANA_ESCOLAR,
  manejarConsultaVendedor,
  type BuscarAtribuciones,
  type BuscarEmailsCampana,
  type BuscarPedidos,
} from "@/lib/vendedor/consultas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const buscarAtribuciones: BuscarAtribuciones = (tokens) =>
  prisma.dnxVendedorAtribucion.findMany({
    where: { token: { in: tokens } },
    select: { token: true, userId: true, rol: true, creadoEn: true },
  });

/**
 * Un solo `findMany`: pedidos pagados del período cuyo álbum es de alguno de los usuarios, o está
 * en un evento que creó alguno, o en una escuela donde alguno es organizador activo. El resto de
 * las reglas (Mercado Pago, fecha de registro, ARS) se aplica en `ventasDelPeriodo`.
 */
const buscarPedidos: BuscarPedidos = async ({ desde, hasta, userIds }) => {
  const pedidos = await prisma.order.findMany({
    where: {
      status: "PAID",
      isTest: false,
      createdAt: { gte: desde, lt: hasta },
      album: {
        OR: [
          { userId: { in: userIds } },
          { event: { creatorId: { in: userIds } } },
          { school: { organizers: { some: { userId: { in: userIds }, status: "ACTIVE" } } } },
        ],
      },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      totalCents: true,
      currency: true,
      checkoutPaymentSource: true,
      isTest: true,
      album: {
        select: {
          userId: true,
          event: { select: { creatorId: true } },
          school: { select: { organizers: { where: { status: "ACTIVE" }, select: { userId: true } } } },
        },
      },
    },
  });
  return pedidos.map((p) => ({
    id: p.id,
    status: String(p.status),
    createdAt: p.createdAt,
    totalCents: p.totalCents,
    currency: p.currency,
    checkoutPaymentSource: String(p.checkoutPaymentSource),
    isTest: p.isTest,
    userIds: [
      p.album.userId,
      ...(p.album.event ? [p.album.event.creatorId] : []),
      ...(p.album.school?.organizers.map((o) => o.userId) ?? []),
    ],
  }));
};

const buscarEmailsCampana: BuscarEmailsCampana = async () =>
  (
    await prisma.schoolOutreachProspect.findMany({
      where: { campaignKey: CAMPANA_ESCOLAR },
      select: { email: true },
    })
  ).map((p) => p.email);

export async function POST(req: Request) {
  return manejarConsultaVendedor(req, {
    secreto: process.env.CLF_CONSULTA_USUARIOS_SECRET,
    buscarAtribuciones,
    buscarPedidos,
    buscarEmailsCampana,
  });
}
