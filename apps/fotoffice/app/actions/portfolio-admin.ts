"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { auditActorFrom } from "@/lib/members/audit";
import { normalizeReason } from "@/lib/members/audit";
import { resolvePortfolioAdminContext } from "@/lib/portfolio/admin-access";

/**
 * Lo que la institución puede hacer con el portfolio de alguien.
 *
 * Tres acciones, y las tres comparten las mismas tres reglas:
 *
 * 1. **El motivo es obligatorio.** Sacar la obra de alguien de la web —o perdonarle una deuda—
 *    tiene consecuencias, y un historial que no dice por qué no sirve de nada. Es el mismo criterio
 *    que ya rige para suspender y dar de baja a un socio.
 * 2. **El cambio y su registro van en la misma transacción.** Una bajada sin su auditoría es peor
 *    que no haberla hecho: queda una obra desaparecida y nadie sabe quién la sacó.
 * 3. **Todo filtra por el workspace de la sesión.** Un id de otra institución no encuentra fila.
 *
 * Lo que la institución **nunca** puede hacer desde acá: editar o borrar las fotos de alguien.
 * Puede sacarlas de la vista; la obra es de quien la hizo.
 */

export type PortfolioAdminResult = { ok: true } | { ok: false; error: string };

const SIN_PERMISO = "No tenés permiso para administrar los portfolios de esta institución.";
const SIN_MOTIVO = "Escribí el motivo: queda en el historial de la persona.";
const NO_ENCONTRADO = "No encontramos ese portfolio en esta institución.";

async function contexto(portfolioId: string, reason: string) {
  const ctx = await resolvePortfolioAdminContext();
  if (!ctx) return { ok: false as const, error: SIN_PERMISO };

  const motivo = normalizeReason(reason);
  if (!motivo) return { ok: false as const, error: SIN_MOTIVO };

  const fila = await prisma.fotofficeMemberPortfolio.findFirst({
    where: { id: portfolioId, workspaceId: ctx.workspace.id },
    select: { id: true, memberId: true, hiddenByAdminAt: true, adminForcePublish: true },
  });
  if (!fila) return { ok: false as const, error: NO_ENCONTRADO };

  return { ok: true as const, ctx, motivo, fila };
}

function refrescar(): void {
  revalidatePath("/portfolios");
}

/** Escribe el cambio y su registro en el historial, juntos o ninguno. */
async function aplicar(params: {
  portfolioId: string;
  memberId: string;
  workspaceId: string;
  actor: { userId: number; label: string };
  data: Record<string, unknown>;
  action: "PORTFOLIO_HIDDEN" | "PORTFOLIO_RESTORED";
  reason: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.fotofficeMemberPortfolio.update({
      where: { id: params.portfolioId },
      data: params.data,
    });
    await tx.memberAudit.create({
      data: {
        workspaceId: params.workspaceId,
        memberId: params.memberId,
        action: params.action,
        // MANUAL: lo decide una persona desde el panel. SYSTEM es para procesos sin actor.
        source: "MANUAL",
        actorUserId: params.actor.userId,
        actorLabel: params.actor.label,
        reason: params.reason,
      },
    });
  });
}

/** Saca el portfolio del sitio. Las fotos quedan intactas. */
export async function hidePortfolioAction(input: {
  portfolioId: string;
  reason: string;
}): Promise<PortfolioAdminResult> {
  const previo = await contexto(input.portfolioId, input.reason);
  if (!previo.ok) return previo;
  const { ctx, motivo, fila } = previo;

  await aplicar({
    portfolioId: fila.id,
    memberId: fila.memberId,
    workspaceId: ctx.workspace.id,
    actor: auditActorFrom(ctx.user),
    data: {
      hiddenByAdminAt: new Date(),
      hiddenByAdminUserId: ctx.user.id,
      hiddenReason: motivo,
    },
    action: "PORTFOLIO_HIDDEN",
    reason: motivo,
  });

  refrescar();
  return { ok: true };
}

/** Deshace la bajada. Los tres campos se limpian juntos: una bajada a medias no es un estado. */
export async function restorePortfolioAction(input: {
  portfolioId: string;
  reason: string;
}): Promise<PortfolioAdminResult> {
  const previo = await contexto(input.portfolioId, input.reason);
  if (!previo.ok) return previo;
  const { ctx, motivo, fila } = previo;

  await aplicar({
    portfolioId: fila.id,
    memberId: fila.memberId,
    workspaceId: ctx.workspace.id,
    actor: auditActorFrom(ctx.user),
    data: { hiddenByAdminAt: null, hiddenByAdminUserId: null, hiddenReason: null },
    action: "PORTFOLIO_RESTORED",
    reason: motivo,
  });

  refrescar();
  return { ok: true };
}

/**
 * El perdón de deuda.
 *
 * **No toca la deuda ni el interruptor del socio: sólo saltea esa condición.** Existe porque la
 * migración del historial de pagos está incompleta y hay gente al día que figura debiendo; una
 * regla automática sin forma humana de contradecirla es una trampa.
 */
export async function forcePublishPortfolioAction(input: {
  portfolioId: string;
  reason: string;
  force: boolean;
}): Promise<PortfolioAdminResult> {
  const previo = await contexto(input.portfolioId, input.reason);
  if (!previo.ok) return previo;
  const { ctx, motivo, fila } = previo;

  await aplicar({
    portfolioId: fila.id,
    memberId: fila.memberId,
    workspaceId: ctx.workspace.id,
    actor: auditActorFrom(ctx.user),
    data: { adminForcePublish: input.force },
    action: "PORTFOLIO_RESTORED",
    // El historial tiene que decir que esto fue un perdón de deuda y no una restauración común:
    // son dos decisiones distintas y el enum no las distingue.
    reason: input.force
      ? `Publicado pese a la deuda: ${motivo}`
      : `Se dio de baja la publicación pese a la deuda: ${motivo}`,
  });

  refrescar();
  return { ok: true };
}
