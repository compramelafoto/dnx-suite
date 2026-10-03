import type { Metadata } from "next";
import { appUrl } from "@/lib/app-url";
import {
  direccionEnUnaLinea,
  sonCoordenadasValidas,
  tieneUbicacionPublicable,
} from "@/lib/membership/studio-location";
import { etiquetaEspecialidad } from "@/lib/membership/specialties";
import { urlsDeRedes } from "./social-links";
import { PORTFOLIO_PUBLIC_SEGMENT } from "./constants";
import type { PublicPortfolio } from "./public-queries";

/**
 * Metadata y datos estructurados de la ficha pública de un fotógrafo.
 *
 * ── Qué cambia esto para el fotógrafo ──
 *
 * Una ficha sin datos estructurados es, para Google, una página con fotos. Con ellos es **un
 * negocio con nombre, rubro y dirección**, y puede aparecer cuando alguien busca "fotógrafo de 15
 * en Funes". Las coordenadas son lo que lo vuelve concreto: hay una calle San Martín en cada
 * ciudad del país, pero un solo punto en el mapa.
 *
 * ── Por qué el editor es la INSTITUCIÓN y el negocio es el SOCIO ──
 *
 * Es el mismo criterio del blog (`lib/blog/public-seo.ts`): la página la publica la Sociedad, pero
 * el negocio del que habla es el del fotógrafo. Mezclarlos haría que Google le atribuyera a la
 * institución el domicilio de cada socio.
 */

function absoluta(path: string): string {
  const base = appUrl().replace(/\/$/, "");
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function portfolioPath(workspaceSlug: string, portfolioSlug: string): string {
  return `/w/${workspaceSlug}/${PORTFOLIO_PUBLIC_SEGMENT}/${portfolioSlug}`;
}

/**
 * La imagen que se ve al compartir el enlace.
 *
 * **El logo primero, la foto destacada si no hay logo.** Es lo que pidió el estudio: compartir la
 * ficha tiene que mostrar la marca. Vale saber el precio: un logo suele ser chico y con fondo
 * transparente, y WhatsApp o Facebook lo recortan a un rectángulo ancho, así que casi siempre se
 * ve peor que una foto. Cambiar el orden de estas dos líneas es todo lo que hace falta para
 * volver atrás.
 */
export function miniaturaDeFicha(p: PublicPortfolio): string | null {
  return p.businessLogoUrl ?? p.coverUrl ?? p.profilePhotoUrl ?? null;
}

/** Una descripción que sirva de resumen en Google, aunque el socio no haya escrito presentación. */
export function descripcionDeFicha(p: PublicPortfolio, institucion: string): string {
  const rubros = p.specialties.map((id) => etiquetaEspecialidad(id)).join(", ");
  const donde = p.studio.city
    ? `${p.studio.city}${p.studio.province ? `, ${p.studio.province}` : ""}`
    : null;

  const escrita = p.bio?.trim();
  if (escrita) return escrita;

  // Sin presentación, se arma una con lo que sí hay. Dejar la descripción vacía le entrega a
  // Google la decisión de qué texto mostrar, y suele elegir mal.
  const partes = [
    p.businessName ?? p.displayName,
    rubros || null,
    donde ? `en ${donde}` : null,
    `Socio de ${institucion}.`,
  ].filter(Boolean);
  return partes.join(" · ");
}

export function buildPortfolioMetadata(input: {
  portfolio: PublicPortfolio;
  institucion: string;
  workspaceSlug: string;
}): Metadata {
  const { portfolio: p, institucion, workspaceSlug } = input;
  const url = absoluta(portfolioPath(workspaceSlug, p.publicSlug));
  const descripcion = descripcionDeFicha(p, institucion).slice(0, 300);
  const imagen = miniaturaDeFicha(p);
  const donde = p.studio.city ? ` · ${p.studio.city}` : "";
  const titulo = `${p.displayName}${p.businessName ? ` · ${p.businessName}` : ""}${donde}`;

  return {
    title: titulo,
    description: descripcion,
    // Sin canonical, cada dominio por el que se llegue (el propio, el de Vercel) cuenta como una
    // página distinta, y Google reparte el crédito entre todas.
    alternates: { canonical: url },
    openGraph: {
      title: titulo,
      description: descripcion,
      url,
      siteName: institucion,
      type: "profile",
      locale: "es_AR",
      images: imagen ? [{ url: absoluta(imagen) }] : undefined,
    },
    twitter: {
      card: imagen ? "summary_large_image" : "summary",
      title: titulo,
      description: descripcion,
      images: imagen ? [absoluta(imagen)] : undefined,
    },
  };
}

/**
 * El negocio del fotógrafo, en el vocabulario de schema.org.
 *
 * `ProfessionalService` en vez de `LocalBusiness` a secas: es más preciso y hereda todo lo que
 * Google necesita (dirección, coordenadas, rubro). Sin dirección publicable se cae a `Person`,
 * porque declarar un negocio local sin lugar es justo lo que Google desconfía.
 */
export function buildPortfolioJsonLd(input: {
  portfolio: PublicPortfolio;
  institucion: string;
  workspaceSlug: string;
}): Record<string, unknown> {
  const { portfolio: p, institucion, workspaceSlug } = input;
  const url = absoluta(portfolioPath(workspaceSlug, p.publicSlug));
  const imagenes = [
    ...(p.coverUrl ? [absoluta(p.coverUrl)] : []),
    ...p.photos.slice(0, 6).map((f) => absoluta(f.url)),
  ];
  // Direcciones absolutas: `sameAs` con un usuario suelto ("juanfoto") Google lo descarta.
  const redes = urlsDeRedes(p.links);

  const esNegocio = tieneUbicacionPublicable(p.studio);

  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": esNegocio ? "ProfessionalService" : "Person",
    name: esNegocio ? (p.businessName ?? p.displayName) : p.displayName,
    url,
    ...(p.bio?.trim() ? { description: p.bio.trim() } : {}),
    ...(imagenes.length > 0 ? { image: [...new Set(imagenes)] } : {}),
    ...(p.businessLogoUrl ? { logo: absoluta(p.businessLogoUrl) } : {}),
    ...(redes.length > 0 ? { sameAs: redes } : {}),
    // Quién lo respalda. Para Google, pertenecer a una sociedad profesional es una señal real.
    memberOf: { "@type": "Organization", name: institucion },
  };

  if (!esNegocio) {
    return {
      ...base,
      jobTitle: "Fotógrafo",
      ...(p.businessName ? { worksFor: { "@type": "Organization", name: p.businessName } } : {}),
    };
  }

  const { street, city, province, postalCode, lat, lng } = p.studio;

  return {
    ...base,
    // Quién atiende, cuando el nombre del negocio no es el de la persona.
    founder: { "@type": "Person", name: p.displayName },
    address: {
      "@type": "PostalAddress",
      ...(street ? { streetAddress: street } : {}),
      ...(city ? { addressLocality: city } : {}),
      ...(province ? { addressRegion: province } : {}),
      ...(postalCode ? { postalCode } : {}),
      addressCountry: "AR",
    },
    ...(lat !== null && lng !== null && sonCoordenadasValidas(lat, lng)
      ? { geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } }
      : {}),
    ...(p.specialties.length > 0
      ? {
          // Los rubros, como el catálogo de lo que ofrece. Es la forma que Google entiende para
          // "qué hace este negocio", más allá del nombre.
          knowsAbout: p.specialties.map((id) => etiquetaEspecialidad(id)),
        }
      : {}),
    ...(direccionEnUnaLinea(p.studio)
      ? { areaServed: { "@type": "Place", name: p.studio.city ?? direccionEnUnaLinea(p.studio) } }
      : {}),
  };
}
