import type { ContactBlockConfig, ContactSocialNetwork } from "@/lib/website/blocks";
import { isHttpsUrl, resolveContactConfig, whatsappHref } from "@/lib/website/contact";
import type { WebsiteDynamicData } from "@/lib/website/dynamic-data";
import { levelStyle } from "@/lib/website/typography";

const NETWORK_LABEL: Record<ContactSocialNetwork, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  vimeo: "Vimeo",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  x: "X",
};

const LINK_CLASS = "underline-offset-4 hover:underline";

/**
 * Datos de contacto. Con `useWorkspaceData` completa lo vacío con el contacto de la institución
 * (`data.contact`, que sólo llega en el sitio publicado). En la vista previa del builder no llega
 * nada: si todavía no hay nada escrito se muestra un aviso en vez de una sección en blanco.
 * Todo enlace se arma acá a partir de valores validados: mailto/tel con el texto escapado por
 * React, WhatsApp por `whatsappHref`, mapa y redes sólo https.
 */
export function ContactBlockView({ config, data }: { config: ContactBlockConfig; data?: WebsiteDynamicData }) {
  const c = resolveContactConfig(config, data?.contact);
  const wa = c.whatsapp ? whatsappHref(c.whatsapp, c.whatsappText) : null;
  const socials = c.socials.filter((s) => isHttpsUrl(s.url));
  const mapsUrl = c.mapsUrl && isHttpsUrl(c.mapsUrl) ? c.mapsUrl : null;
  const isEmpty = !c.email && !c.phone && !wa && !c.address && !mapsUrl && socials.length === 0;

  if (isEmpty && data !== undefined) return null;

  return (
    <section className="px-6 py-14">
      <div className="mx-auto max-w-3xl space-y-4">
        {c.title ? (
          <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{c.title}</h2>
        ) : null}
        {isEmpty ? (
          <p className="opacity-50" style={levelStyle("body", { color: true })}>
            {config.useWorkspaceData
              ? "Acá van los datos de contacto de tu institución. Cargalos en Configuración o escribilos en esta sección."
              : "Sin datos de contacto todavía."}
          </p>
        ) : (
          <ul className="space-y-2" style={levelStyle("body", { color: true })}>
            {c.email ? (
              <li>
                <a className={LINK_CLASS} href={`mailto:${c.email}`}>
                  {c.email}
                </a>
              </li>
            ) : null}
            {c.phone ? (
              <li>
                <a className={LINK_CLASS} href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>
                  {c.phone}
                </a>
              </li>
            ) : null}
            {wa ? (
              <li>
                <a className={LINK_CLASS} href={wa} target="_blank" rel="noopener noreferrer">
                  Escribinos por WhatsApp
                </a>
              </li>
            ) : null}
            {c.address ? <li>{c.address}</li> : null}
            {mapsUrl ? (
              <li>
                <a className={LINK_CLASS} href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  Ver en el mapa
                </a>
              </li>
            ) : null}
            {socials.length > 0 ? (
              <li className="flex flex-wrap gap-x-4 gap-y-1 pt-2">
                {socials.map((s, i) => (
                  <a key={`${s.network}-${i}`} className={LINK_CLASS} href={s.url.trim()} target="_blank" rel="noopener noreferrer">
                    {NETWORK_LABEL[s.network]}
                  </a>
                ))}
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </section>
  );
}
