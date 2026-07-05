import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PhotographerImprimirPage from "@/components/photographer/PhotographerImprimirPage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PhotographerImprimirHandlerPage({
  params,
}: {
  params: { handler: string } | Promise<{ handler: string }>;
}) {
  const { handler } = await Promise.resolve(params);

  if (!handler || typeof handler !== "string") {
    notFound();
  }

  // Buscar fotógrafo por handler
  let photographer: any;
  
  try {
    // Intentar con tertiaryColor primero
    photographer = await prisma.user.findFirst({
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
        tertiaryColor: true,
        showCarnetPrints: true,
        showPolaroidPrints: true,
        preferredLabId: true,
        profitMarginPercent: true,
      },
    });
  } catch (err: any) {
    // Si falla por campo desconocido, intentar sin tertiaryColor
    const errorMsg = String(err?.message ?? "");
    if (errorMsg.includes("tertiaryColor") || errorMsg.includes("showCarnetPrints") || errorMsg.includes("showPolaroidPrints") || errorMsg.includes("Unknown field")) {
      console.warn("GET /[handler]/imprimir: tertiaryColor no existe. Ejecutá: npx prisma db push && npx prisma generate");
      photographer = await prisma.user.findFirst({
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
      // Agregar valor por defecto si no existe
      if (photographer) {
        photographer.tertiaryColor = photographer.primaryColor || null;
        photographer.showCarnetPrints = false;
        photographer.showPolaroidPrints = false;
      }
    } else {
      throw err;
    }
  }

  if (!photographer) {
    notFound();
  }

  return <PhotographerImprimirPage photographer={photographer} handler={handler} />;
}
