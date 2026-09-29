"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requestPasswordReset } from "@repo/auth";
import { acceptTeamInvitation, findTeamInvitationByTokenHash, TeamError } from "@repo/db/fotoffice-team";
import { getAuthUser } from "@/lib/auth";
import { FOTOFFICE_WORKSPACE_COOKIE } from "@/lib/courses-sales/constants";
import { hashInvitationToken } from "@/lib/members/invitation-tokens";
import { emailsMatch, invitationState } from "@/lib/members/invitations";
import { clearTeamInvitationContinuity, setTeamInvitationContinuity } from "@/lib/team/continuity";

const NO_DISPONIBLE = "Esta invitación ya no está disponible.";
const WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type AceptarEquipoState = { error: string | null };
export type ActivacionEquipoState = { error: string | null; sent?: boolean };

/**
 * Acepta una invitación al equipo. Revalida TODO en el servidor —vigencia y coincidencia de
 * email— sin confiar en lo que mostró la pantalla: entre que se renderizó y se confirmó, la
 * invitación pudo revocarse, vencer o aceptarse en otra pestaña.
 */
export async function acceptTeamInvitationAction(
  _prev: AceptarEquipoState | undefined,
  formData: FormData,
): Promise<AceptarEquipoState> {
  const user = await getAuthUser();
  if (!user) return { error: "Iniciá sesión para aceptar." };

  const invitationId = formData.get("invitationId")?.toString()?.trim();
  if (!invitationId) return { error: NO_DISPONIBLE };

  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { id: invitationId },
    select: { id: true, email: true, expiresAt: true, acceptedAt: true, revokedAt: true },
  });
  if (!invitation || invitationState(invitation) !== "PENDING") return { error: NO_DISPONIBLE };

  if (!emailsMatch(user.email, invitation.email)) {
    return { error: `Esta invitación es para ${invitation.email}. Entraste como ${user.email}.` };
  }

  let workspaceId: string;
  try {
    ({ workspaceId } = await acceptTeamInvitation(invitation.id, user.id));
  } catch (e) {
    // Otra pestaña la aceptó, o la revocaron justo ahora: para la persona es lo mismo.
    if (e instanceof TeamError) return { error: NO_DISPONIBLE };
    return { error: "No pudimos completar el ingreso. Intentá de nuevo." };
  }

  await clearTeamInvitationContinuity();

  // Que entre directo al espacio que la invitó, no al último que tenía abierto. La membresía
  // se acaba de crear en la misma transacción, así que la cookie apunta a un workspace propio.
  const store = await cookies();
  store.set(FOTOFFICE_WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/workspace");
}

/**
 * "Es mi primera vez": crea la cuenta sin contraseña y manda el correo para crearla.
 *
 * No da acceso a nada: sin contraseña no hay ingreso, y la membresía recién se crea al
 * aceptar con sesión iniciada. Todo sale del token; nada de lo que mande el navegador se cree.
 */
export async function startTeamActivationAction(
  _prev: ActivacionEquipoState | undefined,
  formData: FormData,
): Promise<ActivacionEquipoState> {
  const rawToken = formData.get("token")?.toString()?.trim();
  if (!rawToken) return { error: NO_DISPONIBLE };

  const invitation = await findTeamInvitationByTokenHash(hashInvitationToken(rawToken));
  if (!invitation || invitationState(invitation) !== "PENDING") {
    await clearTeamInvitationContinuity();
    return { error: NO_DISPONIBLE };
  }

  const appBaseUrl = process.env.APP_URL?.trim();
  if (!appBaseUrl || !/^https?:\/\//.test(appBaseUrl)) {
    return { error: "No pudimos continuar por una falta de configuración. Avisale a quien te invitó." };
  }

  // Búsqueda sin distinguir mayúsculas: una cuenta vieja escrita "Ana@..." es la misma persona.
  const existing = await prisma.user.findFirst({
    where: { email: { equals: invitation.email, mode: "insensitive" } },
    select: { id: true, email: true, password: true },
  });
  if (existing?.password) {
    return { error: "Ya tenés una cuenta con este correo. Entrá con “Ya tengo cuenta”." };
  }

  let email = invitation.email;
  if (existing) {
    email = existing.email;
  } else {
    // `upsert` y no `create`: dos clics simultáneos no producen dos cuentas.
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, role: "CUSTOMER" },
    });
  }

  // Antes de mandar el correo: si se guardara después y el envío fallara a medias, la persona
  // podría recibirlo igual y volver sin continuidad.
  await setTeamInvitationContinuity(rawToken, invitation.expiresAt);

  const reset = await requestPasswordReset({
    email,
    appBaseUrl,
    appLabel: "FotoOffice",
    resetPath: "/recuperar",
  });

  // `ok: true` es la respuesta neutra anti-enumeración; lo único confiable es `emailResult`.
  if (!reset.emailResult || !reset.emailResult.sent) {
    return { error: "No pudimos enviarte el correo. Intentá de nuevo en unos minutos." };
  }
  return { error: null, sent: true };
}
