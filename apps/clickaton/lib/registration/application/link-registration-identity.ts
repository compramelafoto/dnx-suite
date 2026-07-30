import { resolveOrCreateUser } from "@repo/auth";
import { prisma } from "@repo/db";

/**
 * Vincula (o crea sin password) la Cuenta DNX de una inscripción confirmada.
 * Idempotente: si ya hay userId, no recrea.
 * Nunca genera password silencioso.
 */
export async function linkRegistrationIdentity(input: {
  registrationId: string;
  email: string;
  name: string;
  sourceApplication?: string;
}): Promise<{
  userId: number;
  created: boolean;
  alreadyLinked: boolean;
  activationRequired: boolean;
}> {
  const existing = await prisma.clickatonRegistration.findUnique({
    where: { id: input.registrationId },
    select: {
      userId: true,
      user: { select: { id: true, password: true, googleId: true } },
    },
  });
  if (!existing) {
    throw new Error("REGISTRATION_NOT_FOUND");
  }

  if (existing.userId && existing.user) {
    return {
      userId: existing.userId,
      created: false,
      alreadyLinked: true,
      activationRequired: !existing.user.password && !existing.user.googleId,
    };
  }

  const resolved = await resolveOrCreateUser({
    email: input.email,
    name: input.name,
    sourceApplication: input.sourceApplication ?? "clickaton",
    createRole: "CUSTOMER",
  });

  await prisma.clickatonRegistration.update({
    where: { id: input.registrationId },
    data: { userId: resolved.user.id },
  });

  return {
    userId: resolved.user.id,
    created: resolved.created,
    alreadyLinked: false,
    activationRequired: !resolved.user.hasPassword && !resolved.user.googleId,
  };
}

