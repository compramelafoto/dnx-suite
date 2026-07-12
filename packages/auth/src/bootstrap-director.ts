import { resolveInfoSpotPublicationFields } from "@repo/db";
import { prisma } from "./prisma";
import { hashPassword } from "./password";

export type BootstrapInfoSpotDirectorResult = {
  userId: number;
  email: string;
  /** Rol global de suite (`User.role`). Nunca se modifica en usuarios existentes. */
  suiteRole: string;
  userCreated: boolean;
  membershipCreated: boolean;
  nameUpdated: boolean;
  passwordUpdated: boolean;
  activeDirectorsBefore: number;
};

/**
 * Bootstrap operativo del primer Director de Info Spot.
 *
 * Capas separadas:
 * - `User.role` = rol global de suite (p. ej. SUPER_ADMIN). En usuarios existentes
 *   **nunca** se escribe ni se degrada.
 * - `InfoSpotUserRole` = acceso de app Info Spot (INFOSPOT_DIRECTOR, etc.).
 *
 * Validaciones / hashing alineados con `acceptAppInvitation`.
 * Contraseña: obligatoria solo al crear User nuevo; en existentes, opcional
 * (si se omite, se conserva la actual).
 */
export async function bootstrapInfoSpotDirector(params: {
  name: string;
  email: string;
  password?: string;
}): Promise<BootstrapInfoSpotDirectorResult> {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const password = params.password;

  if (!email || !email.includes("@")) {
    throw new Error("Email inválido.");
  }
  if (name.length < 2) {
    throw new Error("El nombre es obligatorio.");
  }
  if (password !== undefined && password.length > 0 && password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  const activeDirectorsBefore = await prisma.infoSpotUserRole.count({
    where: { role: "INFOSPOT_DIRECTOR", status: "ACTIVE" },
  });

  let user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      isBlocked: true,
      password: true,
      role: true,
      name: true,
      emailVerifiedAt: true,
    },
  });

  if (user?.isBlocked) {
    throw new Error("Esa cuenta está bloqueada a nivel suite.");
  }

  let userCreated = false;
  let nameUpdated = false;
  let passwordUpdated = false;

  if (!user) {
    if (!password || password.length < 8) {
      throw new Error(
        "La contraseña es obligatoria (≥ 8) para crear un usuario nuevo.",
      );
    }
    const passwordHash = hashPassword(password);
    user = (await prisma.user.create({
      data: {
        email,
        name,
        password: passwordHash,
        // Solo usuarios nuevos: rol suite por defecto Identity (igual que acceptAppInvitation).
        // Nunca se usa para “promover” a Director Info Spot.
        role: "CUSTOMER",
        emailVerifiedAt: new Date(),
      },
      select: {
        id: true,
        isBlocked: true,
        password: true,
        role: true,
        name: true,
        emailVerifiedAt: true,
      },
    })) as typeof user & object;
    userCreated = true;
    nameUpdated = true;
    passwordUpdated = true;
  } else {
    // Usuario existente: preservar User.role (p. ej. SUPER_ADMIN). Solo perfil / password.
    const data: {
      name?: string;
      password?: string;
      emailVerifiedAt?: Date;
    } = {};

    if (name !== (user.name ?? "").trim()) {
      data.name = name;
      nameUpdated = true;
    }
    if (password && password.length >= 8) {
      data.password = hashPassword(password);
      passwordUpdated = true;
    }
    if (!user.emailVerifiedAt) {
      data.emailVerifiedAt = new Date();
    }

    if (Object.keys(data).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data,
      });
    }
  }

  const existingMembership = await prisma.infoSpotUserRole.findUnique({
    where: { userId: user!.id },
    select: { id: true },
  });

  const fields = resolveInfoSpotPublicationFields({
    role: "INFOSPOT_DIRECTOR",
  });

  await prisma.infoSpotUserRole.upsert({
    where: { userId: user!.id },
    create: {
      userId: user!.id,
      role: "INFOSPOT_DIRECTOR",
      canPublish: fields.canPublish,
      publicationPolicy: fields.publicationPolicy,
      status: "ACTIVE",
      assignedByUserId: user!.id,
      lastChangedByUserId: user!.id,
    },
    update: {
      role: "INFOSPOT_DIRECTOR",
      canPublish: fields.canPublish,
      publicationPolicy: fields.publicationPolicy,
      status: "ACTIVE",
      lastChangedByUserId: user!.id,
    },
  });

  const suiteRole =
    typeof user!.role === "string" ? user!.role : String(user!.role);

  return {
    userId: user!.id,
    email,
    suiteRole,
    userCreated,
    membershipCreated: !existingMembership,
    nameUpdated,
    passwordUpdated,
    activeDirectorsBefore,
  };
}
