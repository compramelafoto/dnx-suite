import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LabImprimirPage from "@/components/lab/LabImprimirPage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LabImprimirHandlerPage({
  params,
}: {
  params: { handler: string } | Promise<{ handler: string }>;
}) {
  const { handler } = await Promise.resolve(params);

  if (!handler || typeof handler !== "string") {
    notFound();
  }

  // Buscar laboratorio por handler
  const lab = await prisma.lab.findFirst({
    where: {
      publicPageHandler: handler.toLowerCase(),
      isPublicPageEnabled: true,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
      tertiaryColor: true,
      fontColor: true,
      showCarnetPrints: true,
      showPolaroidPrints: true,
    },
  });

  if (!lab || !lab.email) {
    notFound();
  }

  return <LabImprimirPage lab={{
    id: lab.id,
    name: lab.name,
    email: lab.email,
    logoUrl: lab.logoUrl,
    primaryColor: lab.primaryColor,
    secondaryColor: lab.secondaryColor,
    tertiaryColor: lab.tertiaryColor ?? undefined,
    fontColor: lab.fontColor ?? undefined,
  }} handler={handler} />;
}
