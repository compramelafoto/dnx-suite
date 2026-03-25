import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PhotographerConfirmacionPage from "@/components/photographer/PhotographerConfirmacionPage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PhotographerConfirmacionHandlerPage({
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
    },
  });

  if (!photographer) {
    notFound();
  }

  return <PhotographerConfirmacionPage photographer={photographer} handler={handler} />;
}
