import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isReservedPhotographerSlug } from "@/lib/photographer-slugs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Redirige /f/[handler] → /[handler] (301) solo si el fotógrafo existe; si no, notFound. */
export default async function PhotographerLegacyRedirect({
  params,
}: {
  params: { handler: string } | Promise<{ handler: string }>;
}) {
  const { handler } = await Promise.resolve(params);
  if (!handler || typeof handler !== "string") {
    notFound();
  }

  const normalizedHandler = handler.toLowerCase();
  if (isReservedPhotographerSlug(normalizedHandler)) {
    notFound();
  }

  const photographer = await prisma.user.findFirst({
    where: {
      publicPageHandler: normalizedHandler,
      isPublicPageEnabled: true,
      role: "PHOTOGRAPHER",
    },
    select: { id: true },
  });

  if (!photographer) {
    notFound();
  }

  permanentRedirect(`/${normalizedHandler}`);
}
