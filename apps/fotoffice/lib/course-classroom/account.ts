// lib/course-classroom/account.ts
import "server-only";
import { prisma } from "@repo/db";
import { createOpaqueToken, requireNormalizedIdentityEmail } from "@repo/auth";

/**
 * La cuenta de quien compra un curso.
 *
 * El curso se ve en el portal, así que el comprador necesita una cuenta. Se busca por el correo
 * de la inscripción; si no existe, se crea sin contraseña con `role: "CUSTOMER"`, igual que la
 * activación de socios (`app/actions/member-activation.ts`). Sin contraseña no hay login
 * posible: la cuenta no da acceso a nada hasta que su dueño elija una (o entre con Google).
 *
 * Si alguien compra con un correo ajeno, el enlace para crear la contraseña le llega al dueño
 * de ese correo: nadie se queda con la cuenta de otro.
 */

export const DIAS_ENLACE_CONTRASENA = 7;

export type CuentaDelAlumno = { userId: number; creada: boolean; puedeEntrar: boolean };

export type CuentaDeps = {
  buscar: (
    email: string,
  ) => Promise<{ id: number; password: string | null; googleId: string | null; isBlocked: boolean } | null>;
  crear: (email: string) => Promise<{ id: number }>;
};

function cuentaDepsPorDefecto(): CuentaDeps {
  return {
    buscar: (email) =>
      prisma.user.findUnique({
        where: { email },
        select: { id: true, password: true, googleId: true, isBlocked: true },
      }),
    // `upsert` y no `create`: dos avisos de pago simultáneos no pueden producir dos cuentas.
    crear: (email) =>
      prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, role: "CUSTOMER" },
        select: { id: true },
      }),
  };
}

export async function asegurarCuentaDelAlumno(
  emailCrudo: string,
  deps: CuentaDeps = cuentaDepsPorDefecto(),
): Promise<CuentaDelAlumno | null> {
  let email: string;
  try {
    email = requireNormalizedIdentityEmail(emailCrudo);
  } catch {
    return null;
  }

  const existente = await deps.buscar(email);
  if (existente) {
    if (existente.isBlocked) return null;
    return {
      userId: existente.id,
      creada: false,
      puedeEntrar: Boolean(existente.password) || Boolean(existente.googleId),
    };
  }
  const creada = await deps.crear(email);
  return { userId: creada.id, creada: true, puedeEntrar: false };
}

export type EnlaceDeps = {
  guardar: (fila: { userId: number; tokenHash: string; expiresAt: Date }) => Promise<void>;
};

function enlaceDepsPorDefecto(): EnlaceDeps {
  return {
    guardar: async (fila) => {
      await prisma.passwordResetToken.create({ data: fila });
    },
  };
}

/**
 * El enlace del correo de bienvenida para elegir la contraseña.
 *
 * No usa `requestPasswordReset` de `@repo/auth` por dos razones: manda su propio correo (y la
 * persona recibiría dos) y su enlace vence en una hora, que para una bienvenida no alcanza.
 * Crea la misma fila (`PasswordResetToken`) con 7 días: `/recuperar/[token]` la acepta igual.
 */
export async function crearEnlaceParaContrasena(
  userId: number,
  base: string,
  ahora: Date = new Date(),
  deps: EnlaceDeps = enlaceDepsPorDefecto(),
): Promise<string> {
  const { rawToken, tokenHash } = createOpaqueToken();
  const expiresAt = new Date(ahora.getTime() + DIAS_ENLACE_CONTRASENA * 24 * 60 * 60 * 1000);
  await deps.guardar({ userId, tokenHash, expiresAt });
  return `${base.replace(/\/+$/, "")}/recuperar/${rawToken}`;
}
