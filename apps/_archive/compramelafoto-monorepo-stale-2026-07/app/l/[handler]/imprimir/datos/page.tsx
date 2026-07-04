import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LabDatosPage from "@/components/lab/LabDatosPage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LabDatosHandlerPage({
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
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
    },
  });

  if (!lab) {
    notFound();
  }

  return <LabDatosPage lab={lab} handler={handler} />;
}
