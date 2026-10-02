import { Globe, Instagram, Facebook, Linkedin, Youtube, Music2, MessageCircle } from "lucide-react";
import { etiquetaEspecialidad } from "@/lib/membership/specialties";
import type { PublicPortfolio } from "@/lib/portfolio/public-queries";
import { PortfolioGallery } from "./portfolio-gallery";
import { InstagramStrip } from "./instagram-strip";

/**
 * La ficha de un socio, de la cabecera al último posteo.
 *
 * Vive aparte de la página pública porque la **vista previa del portal muestra exactamente esto**.
 * Si fueran dos armados distintos, la vista previa mentiría apenas uno de los dos cambiara — y una
 * vista previa que miente es peor que no tenerla.
 *
 * Es un componente de servidor: lo único que necesita cliente son la galería y la franja.
 */
export function PortfolioShowcase({
  portfolio,
  /**
   * Dónde manda el botón de WhatsApp. Es una ruta nuestra que redirige, no un `wa.me` directo: así
   * el teléfono no queda en el código fuente de la página. La vista previa no lo pasa, porque ahí
   * el botón no tendría a dónde ir.
   */
  contactHref = null,
}: {
  portfolio: PublicPortfolio;
  contactHref?: string | null;
}) {
  const instagramHandle = portfolio.links.instagram
    ? limpiarUsuario(portfolio.links.instagram)
    : null;

  return (
    <div className="space-y-14">
      <header className="flex flex-col gap-7 sm:flex-row sm:items-start">
        {portfolio.profilePhotoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={portfolio.profilePhotoUrl}
            alt={portfolio.displayName}
            width={160}
            height={160}
            className="h-28 w-28 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5"
          />
        ) : null}

        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              {portfolio.displayName}
            </h1>

            {portfolio.businessName || portfolio.businessLogoUrl ? (
              /*
               * El logo acompaña al nombre del estudio, chico y al lado — no compite con la foto de
               * perfil ni con la obra. En un portfolio manda lo que la persona fotografió.
               *
               * Fondo blanco como en el portal: casi todos los logos son PNG con transparencia
               * hechos para fondo claro, y sobre un sitio oscuro desaparecerían.
               */
              <div className="flex min-w-0 items-center gap-2">
                {portfolio.businessLogoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={portfolio.businessLogoUrl}
                    alt={portfolio.businessName ?? `Logo de ${portfolio.displayName}`}
                    className="h-8 w-auto max-w-28 shrink-0 rounded bg-white object-contain"
                    loading="lazy"
                  />
                ) : null}
                {portfolio.businessName ? (
                  <p className="truncate text-lg opacity-80">{portfolio.businessName}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {portfolio.specialties.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {portfolio.specialties.map((id) => (
                <li
                  key={id}
                  className="rounded-full px-3 py-1 text-xs"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--wsite-primary) 12%, transparent)",
                    color: "var(--wsite-text)",
                  }}
                >
                  {etiquetaEspecialidad(id)}
                </li>
              ))}
            </ul>
          ) : null}

          {portfolio.bio ? (
            <p className="max-w-prose whitespace-pre-line leading-relaxed opacity-90">
              {portfolio.bio}
            </p>
          ) : null}

          {contactHref && portfolio.canContactByWhatsapp ? (
            <p className="pt-1">
              <a
                href={contactHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-transform duration-200 hover:scale-[1.02]"
                style={{ backgroundColor: "#25D366", color: "#07301c" }}
              >
                <MessageCircle size={17} aria-hidden />
                Escribirle por WhatsApp
              </a>
            </p>
          ) : null}

          <EnlacesDeContacto links={portfolio.links} />
        </div>
      </header>

      <PortfolioGallery photos={portfolio.photos} authorName={portfolio.displayName} />

      {portfolio.instagramPosts.length > 0 ? (
        <InstagramStrip posts={portfolio.instagramPosts} handle={instagramHandle} />
      ) : null}
    </div>
  );
}

const ICONOS = {
  Sitio: Globe,
  Instagram,
  TikTok: Music2,
  Facebook,
  YouTube: Youtube,
  LinkedIn: Linkedin,
} as const;

/**
 * Los enlaces que la persona cargó. Todos con `rel="noopener noreferrer"`: son direcciones que
 * escribió alguien de afuera del equipo, y una pestaña abierta con `window.opener` vivo puede
 * redirigir la nuestra.
 */
function EnlacesDeContacto({ links }: { links: PublicPortfolio["links"] }) {
  const items: { etiqueta: keyof typeof ICONOS; href: string }[] = [];
  if (links.website) items.push({ etiqueta: "Sitio", href: normalizarUrl(links.website) });
  if (links.instagram)
    items.push({
      etiqueta: "Instagram",
      href: `https://instagram.com/${limpiarUsuario(links.instagram)}`,
    });
  if (links.tiktok)
    items.push({ etiqueta: "TikTok", href: `https://tiktok.com/@${limpiarUsuario(links.tiktok)}` });
  if (links.facebook) items.push({ etiqueta: "Facebook", href: normalizarUrl(links.facebook) });
  if (links.youtube) items.push({ etiqueta: "YouTube", href: normalizarUrl(links.youtube) });
  if (links.linkedin) items.push({ etiqueta: "LinkedIn", href: normalizarUrl(links.linkedin) });

  if (items.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2 pt-1">
      {items.map((i) => {
        const Icono = ICONOS[i.etiqueta];
        return (
          <li key={i.etiqueta}>
            <a
              href={i.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors duration-200 hover:opacity-70"
              style={{ borderColor: "color-mix(in srgb, var(--wsite-text) 25%, transparent)" }}
            >
              <Icono size={15} aria-hidden />
              {i.etiqueta}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Quien escribe "miestudio.com" sin `https://` igual tiene que terminar en su sitio. */
function normalizarUrl(valor: string): string {
  const limpio = valor.trim();
  return /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
}

/** Acepta "@usuario", "usuario" o la URL completa pegada en el campo. */
export function limpiarUsuario(valor: string): string {
  return valor
    .trim()
    .replace(/^https?:\/\/(www\.)?[^/]+\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
}
