import type { PublicSiteContact } from "@/lib/website/public-site";
import type { WebsiteDesignPresets } from "@/lib/website/design-presets";
import type { SiteNavItem } from "@/lib/website/site-nav";

/**
 * El pie del sitio. Como el encabezado, NO es una sección: vive en el diseño global, no en
 * `sectionsJson`. Sus datos salen todos de `FotofficeWorkspaceBranding`, que es la misma fuente
 * que firma los correos — una sola fuente de verdad entre el sitio y los mails.
 *
 * `legalNote` es TEXTO PLANO por contrato del modelo: se renderiza como texto, nunca con
 * dangerouslySetInnerHTML.
 */
export function WebsiteFooterView({
  commercialName,
  logoUrl,
  contact,
  navItems,
  designPresets,
}: {
  commercialName: string;
  logoUrl: string | null;
  contact: PublicSiteContact;
  navItems: SiteNavItem[];
  designPresets: WebsiteDesignPresets;
}) {
  const preset = designPresets.footerPreset;
  const conColumnas = preset === "columns" || preset === "full";
  const completo = preset === "full";
  const anio = new Date().getFullYear();

  const lugar = [contact.city, contact.province].filter(Boolean).join(", ");
  const tieneContacto = Boolean(contact.email || contact.phone || contact.whatsapp || lugar);

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
                <img src={logoUrl} alt="" style={{ height: "var(--wsite-logo-size, 40px)", width: "auto" }} />
              ) : null}
              <p className="text-base font-semibold" style={{ fontFamily: "var(--wsite-heading-font)" }}>
                {commercialName}
              </p>
              {lugar ? <p className="text-sm opacity-70">{lugar}</p> : null}
            </div>

            {navItems.length > 1 ? (
              <nav className="space-y-2" aria-label="Pie del sitio">
                {navItems.map((item) => (
                  <a key={item.id} href={item.href} className="block text-sm opacity-80 hover:opacity-100">
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
                {contact.whatsapp ? (
                  <a
                    href={`https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block opacity-80 hover:opacity-100"
                  >
                    WhatsApp
                  </a>
                ) : null}
                {contact.instagram ? (
                  <a
                    href={`https://instagram.com/${contact.instagram.replace(/^@/, "")}`}
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
