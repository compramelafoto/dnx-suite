"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import {
  canCreateInfoSpotArticle,
  canManageInfoSpotSettings,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import {
  createArticleFromCoverage,
  syncPublicCoveragesFromClf,
} from "@/lib/coverage";

function revalidateCoveragePaths(coverageId?: string) {
  revalidatePath("/redaccion/coberturas");
  revalidatePath("/redaccion");
  if (coverageId) revalidatePath(`/redaccion/coberturas/${coverageId}`);
}

export async function syncCoveragesFormAction() {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canManageInfoSpotSettings(access.subject) && !canCreateInfoSpotArticle(access.subject)) {
    redirect("/redaccion/coberturas?error=Sin%20permiso%20para%20sincronizar");
  }

  const result = await syncPublicCoveragesFromClf({ take: 120 });
  if (!result.ok) {
    redirect(
      `/redaccion/coberturas?error=${encodeURIComponent(result.error || "No se pudo sincronizar")}`,
    );
  }

  revalidateCoveragePaths();
  const msg = `Sync OK: ${result.created} nuevas, ${result.updated} actualizadas, ${result.staleMarked} stale (${result.totalSeen} vistas).`;
  redirect(`/redaccion/coberturas?ok=${encodeURIComponent(msg)}`);
}

export async function createArticleFromCoverageFormAction(formData: FormData) {
  const coverageId = String(formData.get("coverageId") || "");
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    redirect("/redaccion/coberturas?error=Sin%20permiso");
  }
  if (!coverageId) {
    redirect("/redaccion/coberturas?error=Cobertura%20inv%C3%A1lida");
  }

  const result = await createArticleFromCoverage({
    coverageId,
    authorId: access.user.id,
  });
  if (!result.ok) {
    redirect(
      `/redaccion/coberturas/${coverageId}?error=${encodeURIComponent(result.error)}`,
    );
  }

  revalidateCoveragePaths(coverageId);
  redirect(`/redaccion/noticias/${result.articleId}/editar`);
}

export async function dismissCoverageFormAction(formData: FormData) {
  const coverageId = String(formData.get("coverageId") || "");
  const access = await requireInfoSpotRedaccionAccess();
  if (!canManageInfoSpotSettings(access.subject) && !canCreateInfoSpotArticle(access.subject)) {
    redirect(`/redaccion/coberturas/${coverageId}?error=Sin%20permiso`);
  }
  if (!coverageId) {
    redirect("/redaccion/coberturas?error=Cobertura%20inv%C3%A1lida");
  }

  await prisma.infoSpotCoverage.update({
    where: { id: coverageId },
    data: {
      discoveryStatus: "DISMISSED",
      dismissedAt: new Date(),
      dismissedReason: "Descartada desde el centro editorial",
    },
  });
  revalidateCoveragePaths(coverageId);
  redirect("/redaccion/coberturas?ok=Cobertura%20descartada");
}
