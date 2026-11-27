import { prisma } from "@repo/db";
import { contactoEmail } from "@/lib/contacto-publico";
import { sendPortalEmail } from "@/lib/correo";
import { EquipoError } from "@/lib/inventario/equipos";

/**
 * Bloqueo de cuentas del portal (sólo del portal: nunca toca `User.isBlocked` de CLF). Una cuenta
 * bloqueada no entra a las pantallas con nivel, no publica, no contacta, no pide «Busco», no
 * vende ni califica, y sus publicaciones desaparecen del catálogo. El motivo es interno: nunca se
 * le muestra ni se le manda a la persona.
 */

export const MENSAJE_CUENTA_SUSPENDIDA = "Tu cuenta está suspendida.";
export const MOTIVO_MIN = 10;
export const MOTIVO_MAX = 500;
export const MENSAJE_MOTIVO = `El motivo tiene que tener entre ${MOTIVO_MIN} y ${MOTIVO_MAX} caracteres.`;
export const MENSAJE_YA_BLOQUEADA = "Esta cuenta ya está bloqueada.";
export const MENSAJE_NO_BLOQUEADA = "Esta cuenta no está bloqueada.";
export const MENSAJE_BLOQUEO_PROPIO = "No podés bloquear tu propia cuenta.";

/**
 * Filtro de Prisma sobre `User`: sin un bloqueo vigente (sin fila, o con `liftedAt` cargado). Se
 * usa dentro de `seller: { ... }` en el catálogo y los favoritos.
 */
export const CUENTA_SIN_BLOQUEO = { NOT: { portalAccountBlock: { is: { liftedAt: null } } } } as const;

/** `true` si la persona tiene un bloqueo sin levantar. */
export async function isBlocked(userId: number): Promise<boolean> {
  const b = await prisma.portalAccountBlock.findUnique({
    where: { userId },
    select: { liftedAt: true },
  });
  return b != null && b.liftedAt == null;
}

/** Los ids con un bloqueo vigente (para los crons, que filtran muchas personas a la vez). */
export async function blockedUserIds(): Promise<number[]> {
  const rows = await prisma.portalAccountBlock.findMany({
    where: { liftedAt: null },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/** Motivo recortado y entre 10 y 500 caracteres; si no, error con el texto fijo. */
export function validarMotivo(reason: string): string {
  const motivo = (reason ?? "").trim();
  if (motivo.length < MOTIVO_MIN || motivo.length > MOTIVO_MAX) {
    throw new EquipoError("DATO_INVALIDO", MENSAJE_MOTIVO);
  }
  return motivo;
}

const esUnico = (err: unknown) => (err as { code?: string })?.code === "P2002";

/**
 * Bloquea la cuenta y le avisa a la persona (sin el motivo). `userId` es único en la tabla: si la
 * cuenta tuvo un bloqueo levantado, se reusa esa fila. Si el correo falla, el bloqueo igual queda.
 */
export async function blockAccount(adminId: number, userId: number, reason: string): Promise<void> {
  const motivo = validarMotivo(reason);
  if (adminId === userId) throw new EquipoError("DATO_INVALIDO", MENSAJE_BLOQUEO_PROPIO);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) throw new EquipoError("NO_ENCONTRADO", "No encontramos esa cuenta.");

  const actual = await prisma.portalAccountBlock.findUnique({
    where: { userId },
    select: { id: true, liftedAt: true },
  });
  if (actual && actual.liftedAt == null) throw new EquipoError("DATO_INVALIDO", MENSAJE_YA_BLOQUEADA);

  if (actual) {
    // Sólo si sigue levantado: dos admins a la vez no pisan el motivo del otro.
    const r = await prisma.portalAccountBlock.updateMany({
      where: { userId, liftedAt: { not: null } },
      data: { reason: motivo, blockedById: adminId, createdAt: new Date(), liftedAt: null },
    });
    if (r.count === 0) throw new EquipoError("DATO_INVALIDO", MENSAJE_YA_BLOQUEADA);
  } else {
    try {
      await prisma.portalAccountBlock.create({
        data: { userId, reason: motivo, blockedById: adminId },
        select: { id: true },
      });
    } catch (err) {
      if (esUnico(err)) throw new EquipoError("DATO_INVALIDO", MENSAJE_YA_BLOQUEADA);
      throw err;
    }
  }

  try {
    // Las respuestas van a la casilla de contacto (el remitente suele ser noreply). Sin ella, el
    // correo no invita a responder.
    const replyTo = contactoEmail();
    const r = await sendPortalEmail(
      user.email,
      "cuenta_bloqueada",
      { nombre: user.name?.trim().split(/\s+/)[0] ?? "", conRespuesta: replyTo ? "1" : "" },
      replyTo ? { replyTo } : undefined,
    );
    if (!r.success) console.error("[bloqueo] No salió el correo de cuenta bloqueada", userId);
  } catch (err) {
    console.error("[bloqueo] No se pudo enviar el correo de cuenta bloqueada", userId, err);
  }
}

/** Levanta el bloqueo vigente (la fila queda, con `liftedAt`, como historial). */
export async function unblockAccount(adminId: number, userId: number): Promise<void> {
  const r = await prisma.portalAccountBlock.updateMany({
    where: { userId, liftedAt: null },
    data: { liftedAt: new Date() },
  });
  if (r.count === 0) throw new EquipoError("DATO_INVALIDO", MENSAJE_NO_BLOQUEADA);
  console.info(`[bloqueo] Admin ${adminId} levantó el bloqueo de la cuenta ${userId}.`);
}

export type CuentaAdmin = { id: number; email: string; name: string | null; blocked: boolean };

/** Busca una cuenta por correo (sin distinguir mayúsculas). Sólo para el panel del admin. */
export async function findAccountByEmail(email: string): Promise<CuentaAdmin | null> {
  const correo = (email ?? "").trim().toLowerCase();
  if (!correo) return null;
  const u = await prisma.user.findFirst({
    where: { email: { equals: correo, mode: "insensitive" } },
    select: { id: true, email: true, name: true, portalAccountBlock: { select: { liftedAt: true } } },
  });
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    blocked: u.portalAccountBlock != null && u.portalAccountBlock.liftedAt == null,
  };
}

/** La cuenta por id, con su estado de bloqueo. Sólo para el panel del admin. */
export async function getAccountForAdmin(userId: number): Promise<CuentaAdmin | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, portalAccountBlock: { select: { liftedAt: true } } },
  });
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    blocked: u.portalAccountBlock != null && u.portalAccountBlock.liftedAt == null,
  };
}

export type BloqueoActivo = {
  userId: number;
  name: string | null;
  email: string;
  reason: string;
  createdAt: Date;
};

/** Bloqueos vigentes, los más nuevos primero (panel del admin: incluye el motivo interno). */
export async function listActiveBlocks(): Promise<BloqueoActivo[]> {
  const rows = await prisma.portalAccountBlock.findMany({
    where: { liftedAt: null },
    orderBy: { createdAt: "desc" },
    select: { userId: true, reason: true, createdAt: true, user: { select: { name: true, email: true } } },
  });
  return rows.map((r) => ({
    userId: r.userId,
    name: r.user.name,
    email: r.user.email,
    reason: r.reason,
    createdAt: r.createdAt,
  }));
}
