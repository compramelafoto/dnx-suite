/**
 * Consulta interna de FOTOFFICE: ¿cuáles de estos correos o teléfonos ya son usuarios de CLF?
 * Responde sólo `{ coincidencias: [{ clave, userId, rol, creadoEn, baja }] }`, sin nombres ni otros datos.
 *
 * Protegida con su propio secreto (no el de los crons):
 *   Authorization: Bearer <CLF_CONSULTA_USUARIOS_SECRET>
 *
 * Body: `{ "emails": string[], "telefonos": string[] }`, hasta 200 claves en total.
 * La lógica vive en `lib/usuarios-existentes.ts`; acá sólo se conecta Prisma.
 */
import { prisma } from "@/lib/prisma";
import { consultarUsuariosExistentes, type BuscarUsuarios } from "@/lib/usuarios-existentes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Filtro grueso: correo exacto (sin mayúsculas) o teléfono/WhatsApp que contenga la cola. */
const buscar: BuscarUsuarios = async ({ emails, colas }) => {
  const o = [
    ...(emails.length > 0 ? [{ email: { in: emails, mode: "insensitive" as const } }] : []),
    ...colas.flatMap((c) => [{ phone: { contains: c } }, { whatsapp: { contains: c } }]),
  ];
  if (o.length === 0) return [];
  return prisma.user.findMany({
    where: { OR: o },
    select: { id: true, email: true, phone: true, whatsapp: true, role: true, createdAt: true, unsubscribedAt: true },
  });
};

export async function POST(req: Request) {
  return consultarUsuariosExistentes(req, { secreto: process.env.CLF_CONSULTA_USUARIOS_SECRET, buscar });
}
