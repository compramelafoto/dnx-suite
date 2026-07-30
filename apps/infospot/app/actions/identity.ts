"use server";

import { redirect } from "next/navigation";
import {
  acceptAppInvitation,
  getInvitationByRawToken,
  passwordResetNeutralMessage,
  requestPasswordReset,
  resetPasswordWithToken,
} from "@repo/auth";
import { prisma, infoSpotRoleLabel, resolveInfoSpotPublicationFields } from "@repo/db";
import { createInfoSpotSession } from "@/lib/session-cookie";
import { getSiteUrl } from "@/lib/settings";

export type IdentityFormState = { ok: boolean; message: string };

export async function acceptInvitationAction(
  _prev: IdentityFormState,
  formData: FormData,
): Promise<IdentityFormState> {
  const rawToken = formData.get("token")?.toString() ?? "";
  const name = formData.get("name")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const passwordConfirm = formData.get("passwordConfirm")?.toString() ?? "";

  if (!rawToken) return { ok: false, message: "Token inválido." };
  if (password !== passwordConfirm) {
    return { ok: false, message: "Las contraseñas no coinciden." };
  }

  try {
    const invitation = await getInvitationByRawToken(rawToken);
    if (!invitation || invitation.status !== "PENDING") {
      return { ok: false, message: "Invitación inválida, revocada o vencida." };
    }
    if (invitation.app !== "infospot") {
      return { ok: false, message: "Esta invitación no es para Info Spot." };
    }

    const result = await acceptAppInvitation({
      rawToken,
      name,
      password,
      onActivate: async (userId, inv) => {
        const fields = resolveInfoSpotPublicationFields({
          role: inv.appRole,
          canPublish:
            inv.appRole === "INFOSPOT_DIRECTOR"
              ? true
              : inv.appRole === "INFOSPOT_COLABORADOR"
                ? false
                : inv.canPublish,
        });
        await prisma.infoSpotUserRole.upsert({
          where: { userId },
          create: {
            userId,
            role: inv.appRole as
              | "INFOSPOT_DIRECTOR"
              | "INFOSPOT_REDACTOR"
              | "INFOSPOT_COLABORADOR",
            canPublish: fields.canPublish,
            publicationPolicy: fields.publicationPolicy,
            status: "ACTIVE",
            assignedByUserId: inv.invitedByUserId,
            lastChangedByUserId: inv.invitedByUserId,
          },
          update: {
            role: inv.appRole as
              | "INFOSPOT_DIRECTOR"
              | "INFOSPOT_REDACTOR"
              | "INFOSPOT_COLABORADOR",
            canPublish: fields.canPublish,
            publicationPolicy: fields.publicationPolicy,
            status: "ACTIVE",
            lastChangedByUserId: inv.invitedByUserId,
          },
        });
      },
    });

    await createInfoSpotSession(result.userId);
    await prisma.user.update({
      where: { id: result.userId },
      data: { lastLoginAt: new Date() },
    });
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    return {
      ok: false,
      message: err instanceof Error ? err.message : "No se pudo aceptar la invitación.",
    };
  }

  redirect("/redaccion");
}

function isNextRedirect(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function requestPasswordResetAction(
  _prev: IdentityFormState,
  formData: FormData,
): Promise<IdentityFormState> {
  const email = formData.get("email")?.toString()?.trim().toLowerCase() ?? "";
  if (!email) return { ok: false, message: "Email obligatorio." };

  await requestPasswordReset({
    email,
    appBaseUrl: getSiteUrl(),
    appLabel: "Info Spot",
    resetPath: "/recuperar",
  });

  return {
    ok: true,
    message: passwordResetNeutralMessage(),
  };
}

export async function resetPasswordAction(
  _prev: IdentityFormState,
  formData: FormData,
): Promise<IdentityFormState> {
  const rawToken = formData.get("token")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const passwordConfirm = formData.get("passwordConfirm")?.toString() ?? "";

  if (!rawToken) return { ok: false, message: "Token inválido." };
  if (password !== passwordConfirm) {
    return { ok: false, message: "Las contraseñas no coinciden." };
  }

  try {
    const { userId } = await resetPasswordWithToken({
      rawToken,
      newPassword: password,
    });
    await createInfoSpotSession(userId);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    return {
      ok: false,
      message: err instanceof Error ? err.message : "No se pudo restablecer la contraseña.",
    };
  }

  redirect("/redaccion");
}

export async function getInvitationPreview(rawToken: string) {
  const invitation = await getInvitationByRawToken(rawToken);
  if (!invitation) return null;
  return {
    email: invitation.email,
    app: invitation.app,
    roleLabel: infoSpotRoleLabel(invitation.appRole),
    status: invitation.status,
    expiresAt: invitation.expiresAt,
  };
}
