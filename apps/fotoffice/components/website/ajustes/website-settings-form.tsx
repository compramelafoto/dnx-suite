"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveWebsiteSettingsAction, type WebsiteDraftSaveState } from "@/app/actions/website";
import { ImageUploadField } from "@/components/image-upload-field";
import { whatsappHref } from "@/lib/website/contact";
import {
  GA4_ID_RE,
  GOOGLE_VERIFICATION_RE,
  keywordsFromText,
  MAX_KEYWORDS,
  MAX_SOCIAL_LINKS,
  META_PIXEL_ID_RE,
  SITE_SOCIAL_LABELS,
  SITE_SOCIAL_NETWORKS,
  type SiteSocialLink,
  type SiteSocialNetwork,
  type WebsiteSiteSettings,
} from "@/lib/website/site-settings";
import type { PageSettingsInput } from "@/lib/website/page-settings";

type PageRow = { key: string; title: string; slug: string; shareImageUrl: string | null; hideFromSearch: boolean };

const initialState: WebsiteDraftSaveState = { error: null };

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="fo-card space-y-5">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="fo-helper">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[var(--fo-danger)]">{children}</p>;
}

/**
 * Sitio web → Ajustes. Un solo formulario y un solo botón de guardar (como SEO): todo va al
 * borrador en una escritura y se ve en el sitio al publicar. Los formatos se avisan mientras se
 * escribe y el servidor los vuelve a validar (`validateSiteSettingsInput`).
 */
export function WebsiteSettingsForm({
  initial,
  pages,
  canEdit,
  draftUpdatedAt,
}: {
  initial: WebsiteSiteSettings;
  pages: PageRow[];
  canEdit: boolean;
  draftUpdatedAt: string;
}) {
  const [state, action, pending] = useActionState(saveWebsiteSettingsAction, initialState);

  const [keywordsText, setKeywordsText] = useState(initial.seo.keywords.join(", "));
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(initial.seo.shareImageUrl);
  const [googleVerification, setGoogleVerification] = useState(initial.seo.googleVerification ?? "");
  const [ga4Id, setGa4Id] = useState(initial.analytics.ga4Id ?? "");
  const [metaPixelId, setMetaPixelId] = useState(initial.analytics.metaPixelId ?? "");
  const [wa, setWa] = useState(initial.whatsappButton);
  const [socials, setSocials] = useState<SiteSocialLink[]>(initial.socialLinks);
  const [photoProtection, setPhotoProtection] = useState(initial.photoProtection.enabled);
  const [pageRows, setPageRows] = useState(pages);

  const keywords = keywordsFromText(keywordsText);
  const gvClean = googleVerification.trim();
  const gvInvalid = gvClean !== "" && !GOOGLE_VERIFICATION_RE.test(gvClean);
  const gaInvalid = ga4Id.trim() !== "" && !GA4_ID_RE.test(ga4Id.trim().toUpperCase());
  const pixelInvalid = metaPixelId.trim() !== "" && !META_PIXEL_ID_RE.test(metaPixelId.trim());
  const waLink = wa.number.trim() ? whatsappHref(wa.number, wa.chatText) : null;
  const waInvalid = wa.enabled && !waLink;

  const settingsJson = JSON.stringify({
    seo: { keywords, shareImageUrl, googleVerification: gvClean || null },
    analytics: { ga4Id: ga4Id.trim().toUpperCase() || null, metaPixelId: metaPixelId.trim() || null },
    whatsappButton: wa,
    socialLinks: socials,
    photoProtection: { enabled: photoProtection },
  });
  const pageSettings: PageSettingsInput = Object.fromEntries(
    pageRows.map((p) => [p.key, { shareImageUrl: p.shareImageUrl, hideFromSearch: p.hideFromSearch }]),
  );

  const usadas = new Set(socials.map((s) => s.network));
  const libre = SITE_SOCIAL_NETWORKS.find((n) => !usadas.has(n));

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="draftUpdatedAt" value={state.updatedAt ?? draftUpdatedAt} />
      <input type="hidden" name="settingsJson" value={settingsJson} />
      <input type="hidden" name="pageSettingsJson" value={JSON.stringify(pageSettings)} />

      <p className="fo-helper">
        Todo lo de esta pantalla se guarda en el borrador y aparece en tu sitio cuando lo publicás.
      </p>

      <fieldset disabled={!canEdit} className="space-y-6 border-0">
        <Section
          title="Buscadores y vista previa al compartir"
          description="El título y la descripción se cargan en la pestaña SEO. Acá va lo demás."
        >
          <label className="block space-y-2">
            <span className="fo-label">Palabras clave</span>
            <input
              className="fo-input"
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="fotografía, bodas, quince años, Rosario"
            />
            <p className="fo-helper">
              Separadas por coma, hasta {MAX_KEYWORDS}. Google casi no las usa hoy, pero otros buscadores sí. Llevás {keywords.length}.
            </p>
          </label>

          <div className="space-y-2">
            <ImageUploadField
              name="_shareImage"
              presetKey="websiteShareImage"
              label="Imagen al compartir"
              description="La que aparece cuando alguien comparte tu sitio por WhatsApp, Facebook o X. Si no elegís ninguna, se usa tu logo (o la portada)."
              initialUrl={shareImageUrl}
              onUploaded={(url) => setShareImageUrl(url)}
            />
          </div>

          <label className="block space-y-2">
            <span className="fo-label">Código de verificación de Google</span>
            <input
              className="fo-input font-mono text-sm"
              value={googleVerification}
              onChange={(e) => setGoogleVerification(e.target.value)}
              placeholder="ej. aBcD1234efGH5678ijKL"
              maxLength={100}
            />
            <p className="fo-helper">
              Lo pide Google Search Console para confirmar que el sitio es tuyo (método «Etiqueta HTML»). Pegá sólo el código que
              está entre las comillas de <code>content=&quot;…&quot;</code>, no la etiqueta entera.
            </p>
            {gvInvalid ? <Aviso>Ese código no parece válido: sólo letras, números, guiones y guiones bajos (10 a 100).</Aviso> : null}
          </label>
        </Section>

        <Section
          title="Medición de visitas"
          description="Para ver cuánta gente entra a tu sitio y medir tus publicidades. Sólo se carga en el sitio público, nunca en este panel."
        >
          <label className="block space-y-2">
            <span className="fo-label">ID de Google Analytics 4</span>
            <input
              className="fo-input font-mono text-sm"
              value={ga4Id}
              onChange={(e) => setGa4Id(e.target.value)}
              placeholder="G-XXXXXXXXXX"
              maxLength={30}
            />
            <p className="fo-helper">Lo encontrás en Google Analytics → Administrar → Flujos de datos. Empieza con «G-».</p>
            {gaInvalid ? <Aviso>Tiene que empezar con G- y seguir con letras y números (por ejemplo, G-ABC123XYZ).</Aviso> : null}
          </label>
          <label className="block space-y-2">
            <span className="fo-label">Píxel de Meta (Facebook e Instagram)</span>
            <input
              className="fo-input font-mono text-sm"
              value={metaPixelId}
              onChange={(e) => setMetaPixelId(e.target.value)}
              placeholder="1234567890123456"
              inputMode="numeric"
              maxLength={20}
            />
            <p className="fo-helper">Sólo el número del píxel, sin el código. Lo ves en el Administrador de eventos de Meta.</p>
            {pixelInvalid ? <Aviso>El píxel es sólo un número (entre 6 y 20 cifras).</Aviso> : null}
          </label>
        </Section>

        <Section
          title="Botón flotante de WhatsApp"
          description="Un botón verde que queda siempre a la vista, en todas las páginas del sitio, para que te escriban con un toque."
        >
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={wa.enabled} onChange={(e) => setWa({ ...wa, enabled: e.target.checked })} />
            <span className="fo-label">Mostrar el botón de WhatsApp</span>
          </label>
          <label className="block space-y-2">
            <span className="fo-label">Número de WhatsApp</span>
            <input
              className="fo-input"
              value={wa.number}
              onChange={(e) => setWa({ ...wa, number: e.target.value })}
              placeholder="341 341-9869"
              inputMode="tel"
              maxLength={60}
            />
            <p className="fo-helper">Con código de área. Si es de otro país, empezalo con + y el código del país.</p>
            {waInvalid ? <Aviso>Cargá un número válido para mostrar el botón.</Aviso> : null}
          </label>
          <label className="block space-y-2">
            <span className="fo-label">Mensaje de bienvenida (opcional)</span>
            <input
              className="fo-input"
              value={wa.welcomeMessage}
              onChange={(e) => setWa({ ...wa, welcomeMessage: e.target.value })}
              placeholder="¡Hola! ¿Cómo podemos ayudarte?"
              maxLength={200}
            />
            <p className="fo-helper">Aparece en un globito al lado del botón. Quien visita lo puede cerrar.</p>
          </label>
          <label className="block space-y-2">
            <span className="fo-label">Texto inicial del chat (opcional)</span>
            <input
              className="fo-input"
              value={wa.chatText}
              onChange={(e) => setWa({ ...wa, chatText: e.target.value })}
              placeholder="Hola, vi tu sitio y quería consultar…"
              maxLength={300}
            />
            <p className="fo-helper">Lo que ya aparece escrito en WhatsApp cuando la persona abre el chat. Lo puede cambiar antes de mandarlo.</p>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="fo-label">Lado de la pantalla</span>
              <select className="fo-input" value={wa.side} onChange={(e) => setWa({ ...wa, side: e.target.value as typeof wa.side })}>
                <option value="right">Derecha</option>
                <option value="left">Izquierda</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span className="fo-label">Tamaño</span>
              <select className="fo-input" value={wa.size} onChange={(e) => setWa({ ...wa, size: e.target.value as typeof wa.size })}>
                <option value="sm">Chico</option>
                <option value="md">Mediano</option>
                <option value="lg">Grande</option>
              </select>
            </label>
          </div>
          {waLink ? (
            <p className="fo-helper">
              Probalo:{" "}
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="underline">
                abrir el chat
              </a>
            </p>
          ) : null}
        </Section>

        <Section
          title="Redes sociales en el pie"
          description="Aparecen como íconos al pie de todas las páginas. Pegá el enlace completo de cada perfil (empieza con https://)."
        >
          {socials.length === 0 ? <p className="fo-helper">Todavía no cargaste ninguna red.</p> : null}
          <ul className="space-y-3">
            {socials.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <select
                  className="fo-input sm:w-44"
                  aria-label="Red"
                  value={s.network}
                  onChange={(e) =>
                    setSocials(socials.map((x, j) => (j === i ? { ...x, network: e.target.value as SiteSocialNetwork } : x)))
                  }
                >
                  {SITE_SOCIAL_NETWORKS.map((n) => (
                    <option key={n} value={n}>
                      {SITE_SOCIAL_LABELS[n]}
                    </option>
                  ))}
                </select>
                <input
                  className="fo-input min-w-0 flex-1"
                  aria-label={`Enlace de ${SITE_SOCIAL_LABELS[s.network]}`}
                  value={s.url}
                  onChange={(e) => setSocials(socials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                  placeholder="https://"
                  maxLength={2000}
                />
                <button
                  type="button"
                  className="fo-icon-btn fo-icon-btn-danger"
                  aria-label={`Quitar ${SITE_SOCIAL_LABELS[s.network]}`}
                  onClick={() => setSocials(socials.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {socials.length < MAX_SOCIAL_LINKS ? (
            <button
              type="button"
              className="fo-btn fo-btn-secondary text-sm"
              onClick={() => setSocials([...socials, { network: libre ?? "instagram", url: "" }])}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Agregar red
            </button>
          ) : null}
        </Section>

        <Section title="Protección de fotos">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1" checked={photoProtection} onChange={(e) => setPhotoProtection(e.target.checked)} />
            <span className="space-y-1">
              <span className="fo-label block">Bloquear el clic derecho y el arrastre sobre las fotos</span>
              <span className="fo-helper block">
                Disuade, no impide capturas: hace más difícil guardar las fotos con «Guardar imagen como…», pero cualquiera puede
                igual sacar una captura de pantalla.
              </span>
            </span>
          </label>
        </Section>

        <Section
          title="Páginas"
          description="Ajustes de cada página que creaste. La página de inicio usa los ajustes generales de arriba."
        >
          {pageRows.length === 0 ? (
            <p className="fo-helper">Todavía no creaste páginas propias (se crean desde el constructor).</p>
          ) : (
            <ul className="divide-y divide-[var(--fo-border)]">
              {pageRows.map((p) => (
                <li key={p.key} className="space-y-3 py-4 first:pt-0">
                  <p className="text-sm font-semibold">
                    {p.title} <span className="font-normal text-[var(--fo-muted)]">/{p.slug}</span>
                  </p>
                  <ImageUploadField
                    name={`_shareImage_${p.key}`}
                    presetKey="websiteShareImage"
                    label="Imagen al compartir esta página"
                    description="Si no elegís ninguna, se usa la del sitio."
                    initialUrl={p.shareImageUrl}
                    onUploaded={(url) => setPageRows((rows) => rows.map((r) => (r.key === p.key ? { ...r, shareImageUrl: url } : r)))}
                  />
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={p.hideFromSearch}
                      onChange={(e) =>
                        setPageRows((rows) => rows.map((r) => (r.key === p.key ? { ...r, hideFromSearch: e.target.checked } : r)))
                      }
                    />
                    <span className="space-y-1">
                      <span className="fo-label block">Ocultar de buscadores</span>
                      <span className="fo-helper block">
                        Google no la muestra en sus resultados. La página sigue abierta para quien tenga el enlace.
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </fieldset>

      {state.error ? <p className="text-sm text-[var(--fo-danger)]">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-[var(--fo-success)]">Guardado en el borrador. Publicá el sitio para que se vea.</p> : null}
      {canEdit ? (
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pending || gvInvalid || gaInvalid || pixelInvalid || waInvalid}>
          {pending ? "Guardando…" : "Guardar ajustes"}
        </button>
      ) : null}
    </form>
  );
}
