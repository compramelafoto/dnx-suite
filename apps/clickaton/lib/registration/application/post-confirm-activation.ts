import { requestPasswordReset } from "@repo/auth";
import { prisma } from "@repo/db";
import { linkRegistrationIdentity } from "@/lib/registration/application/link-registration-identity";

export type PostConfirmActivationState = {
  userId: number | null;
  existingUser: boolean;
  activationRequired: boolean;
  setPasswordEmailRequested: boolean;
};

/**
 * Tras CONFIRMED: vincula identidad y, si hace falta activar, dispara set-password DNX
 * (email canónico, sin password temporal).
 */
export async function ensurePostConfirmActivation(input: {
  registrationId: string;
  appBaseUrl: string;
}): Promise<PostConfirmActivationState> {
  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: input.registrationId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      userId: true,
      user: { select: { id: true, password: true, googleId: true } },
    },
  });
  if (!reg || reg.status !== "CONFIRMED") {
    return {
      userId: reg?.userId ?? null,
      existingUser: Boolean(reg?.userId),
      activationRequired: false,
      setPasswordEmailRequested: false,
    };
  }

  let userId = reg.userId;
  let activationRequired = false;
  let existingUser = false;

  if (!userId) {
    const linked = await linkRegistrationIdentity({
      registrationId: reg.id,
      email: reg.email,
      name: `${reg.firstName} ${reg.lastName}`.trim(),
      sourceApplication: "clickaton",
    });
    userId = linked.userId;
    activationRequired = linked.activationRequired;
    existingUser = !linked.created;
  } else if (reg.user) {
    activationRequired = !reg.user.password && !reg.user.googleId;
    existingUser = true;
  }

  let setPasswordEmailRequested = false;
  if (activationRequired && userId) {
    const result = await requestPasswordReset({
      email: reg.email,
      appBaseUrl: input.appBaseUrl,
      appLabel: "Clickatón",
      resetPath: "/recuperar",
    });
    setPasswordEmailRequested = result.created;
  }

  return {
    userId,
    existingUser,
    activationRequired,
    setPasswordEmailRequested,
  };
}

export async function resolveActivationFlags(registrationId: string): Promise<{
  activationRequired: boolean;
  existingUserWithCredentials: boolean;
  userId: number | null;
}> {
  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: {
      userId: true,
      status: true,
      user: { select: { password: true, googleId: true } },
    },
  });
  if (!reg || reg.status !== "CONFIRMED") {
    return { activationRequired: false, existingUserWithCredentials: false, userId: null };
  }
  if (!reg.userId || !reg.user) {
    return {
      activationRequired: true,
      existingUserWithCredentials: false,
      userId: reg.userId,
    };
  }
  const hasCreds = Boolean(reg.user.password || reg.user.googleId);
  return {
    activationRequired: !hasCreds,
    existingUserWithCredentials: hasCreds,
    userId: reg.userId,
  };
}
