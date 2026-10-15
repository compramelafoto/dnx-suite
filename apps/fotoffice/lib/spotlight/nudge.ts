import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { SPOTLIGHT_NUDGE_EMAIL_KEY } from "@/lib/communications/constants";
import { inviteOneMember } from "@/lib/members/invite-member";
import { answeredQuestions } from "./about";
import {
  buildSpotlightNudgeEmail,
  missingProfileItems,
  needsNudge,
  type ProfileFacts,
} from "./nudge-email";
import { spotlightWeekLabel } from "./week";

/**
 * Le avisa al Socio de la semana que complete su perfil, una sola vez por semana destacada.
 *
 * - Si no tiene cuenta, el aviso **es** su invitación: se emite una nueva (la anterior se revoca)
 *   y el botón lo lleva a activarla. Sin cuenta no puede cargar nada, así que mandarlo a «Más
 *   sobre mí» sería mandarlo a un login que no sabe pasar.
 * - Si tiene cuenta, el botón lo lleva a «Más sobre mí».
 * - Si su tarjeta ya está razonablemente completa, no se le escribe.
 *
 * La marca `nudgeSentAt` se toma ANTES de enviar, con una actualización condicional: si la tarea
 * de la hora y alguien desde el panel llegan a la vez, sólo uno manda. Si el envío falla, la marca
 * se devuelve para que la próxima pasada lo reintente.
 */

export type NudgeOutcome =
  | { status: "SENT"; to: string; viaInvitation: boolean }
  | { status: "NOT_NEEDED" | "ALREADY_SENT" | "NO_EMAIL" | "NOT_FOUND" }
  | { status: "FAILED"; error: string };

async function hechos(workspaceId: string, memberId: string) {
  const socio = await prisma.member.findFirst({
    where: { id: memberId, workspaceId },
    select: {
      id: true,
      firstName: true,
      email: true,
      userId: true,
      phone: true,
      city: true,
      studioCity: true,
      avatarUrl: true,
      profilePhotoUrl: true,
      specialties: true,
      bio: true,
      instagram: true,
      website: true,
      aboutMe: true,
    },
  });
  if (!socio) return null;
  const [fotosPortfolio, portfolioEnabled] = await Promise.all([
    prisma.fotofficeMemberPortfolioPhoto.count({ where: { portfolio: { memberId } } }),
    isModuleEnabledForWorkspace(workspaceId, PORTFOLIO_MODULE_KEY),
  ]);
  const facts: ProfileFacts = {
    hasAccount: socio.userId !== null,
    hasPhoto: Boolean(socio.profilePhotoUrl?.trim() || socio.avatarUrl?.trim()),
    aboutAnswers: answeredQuestions(socio.aboutMe).length,
    featuredPhotos: socio.aboutMe?.featuredPhotoUrls.length ?? 0,
    hasProfessionalProfile:
      socio.specialties.length > 0 || Boolean(socio.bio?.trim() || socio.instagram?.trim() || socio.website?.trim()),
    portfolioPhotos: fotosPortfolio,
    portfolioEnabled,
    hasPhone: Boolean(socio.phone?.trim()),
    hasCity: Boolean(socio.city?.trim() || socio.studioCity?.trim()),
  };
  return { socio, facts };
}

/** Qué le falta al socio, para mostrarlo en Comunicación. */
export async function spotlightProfileGaps(workspaceId: string, memberId: string) {
  const h = await hechos(workspaceId, memberId);
  if (!h) return null;
  return { missing: missingProfileItems(h.facts), needsNudge: needsNudge(h.facts) };
}

export async function sendSpotlightNudge(input: {
  workspaceId: string;
  spotlightId: string;
  /** Desde el panel se puede volver a mandar aunque ya haya salido. */
  force?: boolean;
}): Promise<NudgeOutcome> {
  const destacado = await prisma.memberSpotlight.findFirst({
    where: { id: input.spotlightId, workspaceId: input.workspaceId, skippedAt: null },
    select: { id: true, memberId: true, weekStart: true, nudgeSentAt: true },
  });
  if (!destacado) return { status: "NOT_FOUND" };
  if (destacado.nudgeSentAt && !input.force) return { status: "ALREADY_SENT" };

  const h = await hechos(input.workspaceId, destacado.memberId);
  if (!h) return { status: "NOT_FOUND" };
  if (!needsNudge(h.facts)) return { status: "NOT_NEEDED" };
  const email = h.socio.email?.trim().toLowerCase();
  if (!email) return { status: "NO_EMAIL" };

  // Tomar la marca antes de mandar: sólo uno de dos envíos simultáneos sigue.
  const tomada = await prisma.memberSpotlight.updateMany({
    where: input.force
      ? { id: destacado.id }
      : { id: destacado.id, nudgeSentAt: null },
    data: { nudgeSentAt: new Date() },
  });
  if (tomada.count === 0) return { status: "ALREADY_SENT" };

  const devolverMarca = () =>
    prisma.memberSpotlight.update({ where: { id: destacado.id }, data: { nudgeSentAt: destacado.nudgeSentAt } });

  const faltan = missingProfileItems(h.facts);
  const semana = spotlightWeekLabel(destacado.weekStart);

  try {
    if (!h.facts.hasAccount) {
      const r = await inviteOneMember(
        { id: input.workspaceId },
        { kind: "SYSTEM", label: "Aviso del Socio de la semana" },
        destacado.memberId,
        {
          buildBody: (ctx) =>
            buildSpotlightNudgeEmail({
              firstName: ctx.memberFirstName,
              institution: ctx.institution,
              weekLabel: semana,
              missing: faltan,
              hasAccount: false,
              ctaUrl: ctx.invitationUrl,
              signature: ctx.signature,
            }),
        },
      );
      if (!r.ok) {
        await devolverMarca();
        return { status: "FAILED", error: r.error };
      }
      return { status: "SENT", to: r.sentTo, viaInvitation: true };
    }

    const { organizationName, signature } = await loadWorkspaceEmailContext(input.workspaceId);
    const outcome = await sendAndLogEmail({
      workspaceId: input.workspaceId,
      to: email,
      templateKey: SPOTLIGHT_NUDGE_EMAIL_KEY,
      userId: h.socio.userId,
      body: buildSpotlightNudgeEmail({
        firstName: h.socio.firstName,
        institution: organizationName,
        weekLabel: semana,
        missing: faltan,
        hasAccount: true,
        ctaUrl: `${appUrl().replace(/\/$/, "")}/portal/perfil/sobre-mi`,
        signature,
      }),
    });
    if (outcome.status !== "SENT") {
      await devolverMarca();
      return { status: "FAILED", error: "El correo no salió; quedó registrado para revisarlo." };
    }
    return { status: "SENT", to: email, viaInvitation: false };
  } catch (error) {
    await devolverMarca().catch(() => undefined);
    return { status: "FAILED", error: error instanceof Error ? error.message : "error desconocido" };
  }
}
