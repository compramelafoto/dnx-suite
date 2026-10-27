import type { PublicSiteContact } from "@/lib/website/public-site";
import type { WebsiteDesignPresets } from "@/lib/website/design-presets";
import type { SiteNavItem } from "@/lib/website/site-nav";
import { SITE_SOCIAL_LABELS, type SiteSocialLink } from "@/lib/website/site-settings";
import { isHttpsUrl } from "@/lib/website/contact";
import { SocialIcon } from "./social-icons";

/**
 * El pie del sitio. Como el encabezado, NO es una sección: vive en el diseño global, no en
 * `sectionsJson`. Sus datos salen todos de `FotofficeWorkspaceBranding`, que es la misma fuente
 * que firma los correos — una sola fuente de verdad entre el sitio y los mails.
 *
 * `legalNote` es TEXTO PLANO por contrato del modelo: se renderiza como texto, nunca con
 * dangerouslySetInnerHTML.
 *
 * `socialLinks` (Sitio web → Ajustes) se dibuja como una fila de íconos en cualquier estilo de
 * pie. Sin redes cargadas, el pie queda exactamente como antes.
 */
export function WebsiteFooterView({
  commercialName,
  logoUrl,
  contact,
  navItems,
  designPresets,
  socialLinks = [],
}: {
  commercialName: string;
  logoUrl: string | null;
  contact: PublicSiteContact;
  navItems: SiteNavItem[];
  designPresets: WebsiteDesignPresets;
  socialLinks?: SiteSocialLink[];
}) {
  const preset = designPresets.footerPreset;
  const conColumnas = preset === "columns" || preset === "full";
  const completo = preset === "full";
  const anio = new Date().getFullYear();

  const lugar = [contact.city, contact.province].filter(Boolean).join(", ");
  // Sólo lo que se dibuja DENTRO de la columna de contacto cuenta acá. `lugar` va en la primera
  // columna, así que incluirlo dibujaría una columna vacía; omitir `instagram` escondería un
  // dato que la institución sí cargó.
  const whatsappDigitos = (contact.whatsapp ?? "").replace(/[^0-9]/g, "");
  const redes = socialLinks.filter((r) => isHttpsUrl(r.url));
  // Con Instagram entre los íconos, no se repite como texto en la columna de contacto.
  const instagramTexto = redes.some((r) => r.network === "instagram") ? null : contact.instagram;
  const tieneContacto = Boolean(contact.email || contact.phone || whatsappDigitos || instagramTexto);

  return (
    <footer
      style={{
        backgroundColor: "var(--wsite-bg)",
        color: "var(--wsite-text)",
        borderTop: "1px solid rgba(127,127,127,0.2)",
        fontFamily: "var(--wsite-body-font)",
      }}
    >
      <div className="mx-auto max-w-6xl px-6 py-10">
        {conColumnas ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-3">
              {completo && logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- el logo vive en R2
                <img src={logoUrl} alt="" style={{ height: "min(var(--wsite-logo-size, 40px), 56px)", width: "auto" }} />
              ) : null}
              <p className="text-base font-semibold" style={{ fontFamily: "var(--wsite-heading-font)" }}>
                {commercialName}
              </p>
              {lugar ? <p className="text-sm opacity-70">{lugar}</p> : null}
            </div>

            {navItems.length > 1 ? (
              <nav className="space-y-2" aria-label="Pie del sitio">
                {navItems.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    target={item.newTab ? "_blank" : undefined}
                    rel={item.newTab ? "noopener noreferrer" : undefined}
                    className="block text-sm opacity-80 hover:opacity-100"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            ) : null}

            {tieneContacto ? (
              <div className="space-y-2 text-sm">
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="block opacity-80 hover:opacity-100">
                    {contact.email}
                  </a>
                ) : null}
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="block opacity-80 hover:opacity-100">
                    {contact.phone}
                  </a>
                ) : null}
                {whatsappDigitos ? (
                  <a
                    href={`https://wa.me/${whatsappDigitos}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block opacity-80 hover:opacity-100"
                  >
                    WhatsApp
                  </a>
                ) : null}
                {instagramTexto ? (
                  <a
                    href={`https://instagram.com/${instagramTexto.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block opacity-80 hover:opacity-100"
                  >
                    Instagram
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {redes.length > 0 ? (
          <ul className={`flex flex-wrap items-center gap-3 ${conColumnas ? "mt-8" : "mb-4"}`} aria-label="Redes sociales">
            {redes.map((r, i) => (
              <li key={`${r.network}-${i}`}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={SITE_SOCIAL_LABELS[r.network]}
                  title={SITE_SOCIAL_LABELS[r.network]}
                  className="flex h-10 w-10 items-center justify-center rounded-full opacity-75 transition-opacity hover:opacity-100"
                  style={{ border: "1px solid rgba(127,127,127,0.35)" }}
                >
                  <SocialIcon network={r.network} className="h-5 w-5" />
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {completo && contact.legalNote ? (
          <p className="mt-8 whitespace-pre-line text-xs leading-relaxed opacity-60">{contact.legalNote}</p>
        ) : null}

        <div
          className={`flex flex-wrap items-center justify-between gap-3 text-xs opacity-60 ${
            conColumnas ? "mt-8 border-t pt-6" : ""
          }`}
          style={conColumnas ? { borderColor: "rgba(127,127,127,0.2)" } : undefined}
        >
          <span>
            © {anio} {commercialName}
          </span>
          <span className="flex gap-4">
            <a href="/terminos" className="hover:opacity-100">
              Términos
            </a>
            <a href="/privacidad" className="hover:opacity-100">
              Privacidad
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
