import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PhotographerResumenPage from "@/components/photographer/PhotographerResumenPage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PhotographerResumenHandlerPage({
  params,
}: {
  params: { handler: string } | Promise<{ handler: string }>;
}) {
  const { handler } = await Promise.resolve(params);

  if (!handler || typeof handler !== "string") {
    notFound();
  }

  // Buscar fotógrafo por handler
  const photographer = await prisma.user.findFirst({
    where: {
      publicPageHandler: handler.toLowerCase(),
      isPublicPageEnabled: true,
      role: "PHOTOGRAPHER",
    },
    select: {
      id: true,
      name: true,
      email: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
      preferredLabId: true,
      profitMarginPercent: true,
    },
  });

  if (!photographer) {
    notFound();
  }

  return <PhotographerResumenPage photographer={photographer} handler={handler} />;
}
