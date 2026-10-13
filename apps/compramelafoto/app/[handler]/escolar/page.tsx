import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import EscolarLanding from "@/components/dnx/escolar/EscolarLanding";
import { buildPhotographerEscolarBrand, sanitizePhotographerHandler } from "@/lib/dnx-escolar/landing-brand";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl, urlToR2Key } from "@/lib/r2-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE_URL = "https://www.compramelafoto.com";

function normalizeLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
    if (!logoUrl.includes("localhost") && !logoUrl.includes("127.0.0.1")) return logoUrl;
    return getR2PublicUrl(urlToR2Key(logoUrl));
  }
  return getR2PublicUrl(logoUrl.replace(/^\//, ""));
}

/**
 * Landing escolar del fotógrafo: se sirve con las mismas condiciones que su página pública
 * (handler, página pública encendida y rol PHOTOGRAPHER). `cache` evita repetir la consulta
 * entre generateMetadata y la página.
 */
const getEscolarBrand = cache(async (rawHandler: string) => {
  const handler = sanitizePhotographerHandler(rawHandler);
  if (!handler) return null;
  const photographer = await prisma.user.findFirst({
    where: { publicPageHandler: handler, isPublicPageEnabled: true, role: "PHOTOGRAPHER" },
    select: {
      publicPageHandler: true,
      name: true,
      companyName: true,
      logoUrl: true,
      whatsapp: true,
      phone: true,
      companyAddress: true,
      city: true,
      primaryColor: true,
    },
  });
  if (!photographer?.publicPageHandler) return null;
  return buildPhotographerEscolarBrand({
    ...photographer,
    publicPageHandler: photographer.publicPageHandler,
    logoUrl: normalizeLogoUrl(photographer.logoUrl),
  });
});

type Params = { params: Promise<{ handler: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handler } = await params;
  const brand = await getEscolarBrand(handler);
  if (!brand) return {};
  const title = `Fotografía escolar | ${brand.nombre}`;
  const description = `${brand.nombre} hace las fotos del colegio; las familias eligen, pagan online y reciben sus imágenes. Sin cobros ni pedidos en la secretaría, y con beneficio acordado para la institución.`;
  const canonical = `${SITE_URL}/${brand.photographerHandler}/escolar`;
  const images = brand.logoUrl ? [{ url: brand.logoUrl, alt: `Logo ${brand.nombre}` }] : undefined;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", locale: "es_AR", images },
    twitter: { card: "summary", title, description, images: brand.logoUrl ? [brand.logoUrl] : undefined },
  };
}

export default async function PhotographerEscolarLandingPage({ params }: Params) {
  const { handler } = await params;
  const brand = await getEscolarBrand(handler);
  if (!brand) notFound();
  return <EscolarLanding brand={brand} />;
}
