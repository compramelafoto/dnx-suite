import type { ComponentType } from "react";
import { ImageUploadField } from "@/components/image-upload-field";
import { GalleryPhotosEditor } from "@/components/website/inspector/gallery-photos-editor";
import { InquiryFormInspector } from "@/components/website/inspector/inquiry-form-inspector";
import { PortfolioInspector } from "@/components/website/inspector/portfolio-inspector";
import { RichTextInspector } from "@/components/website/inspector/rich-text-inspector";
import { SelectField, TextAreaField, TextField, ToggleField } from "@/components/website/inspector/inspector-fields";
import { HeroBlockView } from "@/components/website/render/blocks/hero-block-view";
import { HeroSlideEditor } from "@/components/website/builder/hero-slide-editor";
import { TextBlockView } from "@/components/website/render/blocks/text-block-view";
import { ImageBlockView } from "@/components/website/render/blocks/image-block-view";
import { CtaBlockView } from "@/components/website/render/blocks/cta-block-view";
import { ContactBlockView } from "@/components/website/render/blocks/contact-block-view";
import { InquiryFormBlockView } from "@/components/website/render/blocks/inquiry-form-block-view";
import { GalleryBlockView } from "@/components/website/render/blocks/gallery-block-view";
import { VideoBlockView } from "@/components/website/render/blocks/video-block-view";
import { EmbedBlockView } from "@/components/website/render/blocks/embed-block-view";
import { RichTextBlockView } from "@/components/website/render/blocks/rich-text-block-view";
import { SpacerBlockView } from "@/components/website/render/blocks/spacer-block-view";
import { BlogLatestBlockView } from "@/components/website/render/blocks/blog-latest-block-view";
import { MemberOfWeekBlockView } from "@/components/website/render/blocks/member-of-week-block-view";
import { PortfolioBlockView } from "@/components/website/render/blocks/portfolio-block-view";
import { TestimonialsBlockView } from "@/components/website/render/blocks/testimonials-block-view";
import { isAllowedMapsUrl } from "./contact";
import { isAllowedEmbedUrl, toVideoEmbedUrl } from "./embed-hosts";
import type { WebsiteDynamicData } from "./dynamic-data";
import {
  WEBSITE_BLOCK_DEFINITIONS,
  type BlogLatestBlockConfig,
  type ContactBlockConfig,
  type ContactSocial,
  CONTACT_SOCIAL_NETWORKS,
  type CtaBlockConfig,
  type EmbedBlockConfig,
  type GalleryBlockConfig,
  type VideoBlockConfig,
  EMBED_MAX_HEIGHT_PX,
  EMBED_MIN_HEIGHT_PX,
  EMBED_DEFAULT_HEIGHT_PX,
  type MemberOfWeekBlockConfig,
  type ImageBlockConfig,
  type SpacerBlockConfig,
  type TestimonialsBlockConfig,
  type TextBlockConfig,
  type WebsiteBlock,
  type WebsiteBlockType,
} from "./blocks";

/**
 * Registro central: para cada tipo de bloque, TODO lo que hace falta para mostrarlo y editarlo
 * vive acá — metadata (`WEBSITE_BLOCK_DEFINITIONS`), el renderer público (`View`, ya existía) y
 * ahora el inspector lateral (`Inspector`, controlado: cada cambio llama a `onChange` con la
 * config completa, así la preview central reacciona al instante). Agregar un bloque nuevo es
 * agregar una entrada acá — no tocar un switch en 3 archivos distintos.
 */
type BlockRegistryEntry<TConfig> = {
  /** `data`: lo que leyó el servidor para los bloques dinámicos (ver `dynamic-data.ts`). Los
   * estáticos lo ignoran; en la vista previa del builder no llega nunca. */
  View: ComponentType<{ config: TConfig; blockId?: string; data?: WebsiteDynamicData }>;
  Inspector: ComponentType<{ config: TConfig; onChange: (config: TConfig) => void; blockId?: string }>;
};

export const WEBSITE_BLOCK_REGISTRY: { [K in WebsiteBlockType]: BlockRegistryEntry<Extract<WebsiteBlock, { type: K }>["config"]> } = {
  HERO: {
    View: HeroBlockView,
    Inspector: HeroSlideEditor,
  },
  TEXT: {
    View: TextBlockView,
    Inspector: ({ config, onChange }: { config: TextBlockConfig; onChange: (c: TextBlockConfig) => void }) => (
      <div className="space-y-4">
        <TextField label="Título (opcional)" value={config.title ?? ""} onChange={(v) => onChange({ ...config, title: v })} />
        <TextAreaField label="Contenido" value={config.content ?? ""} onChange={(v) => onChange({ ...config, content: v })} rows={7} />
        <SelectField
          label="Alineación"
          value={config.align}
          onChange={(v) => onChange({ ...config, align: v as TextBlockConfig["align"] })}
          options={[
            { value: "left", label: "Izquierda" },
            { value: "center", label: "Centro" },
          ]}
        />
      </div>
    ),
  },
  IMAGE: {
    View: ImageBlockView,
    Inspector: ({ config, onChange }: { config: ImageBlockConfig; onChange: (c: ImageBlockConfig) => void }) => (
      <div className="space-y-4">
        <ImageUploadField
          name="_image_block"
          presetKey="websiteBlockImage"
          label="Imagen"
          initialUrl={config.imageUrl || null}
          onUploaded={(url) => onChange({ ...config, imageUrl: url ?? "" })}
        />
        <TextField label="Texto alternativo" value={config.alt ?? ""} onChange={(v) => onChange({ ...config, alt: v })} helper="Para lectores de pantalla y buscadores." />
        <TextField label="Epígrafe (opcional)" value={config.caption ?? ""} onChange={(v) => onChange({ ...config, caption: v })} />
        <SelectField
          label="Ancho"
          value={config.widthPreset}
          onChange={(v) => onChange({ ...config, widthPreset: v as ImageBlockConfig["widthPreset"] })}
          options={[
            { value: "full", label: "Completo" },
            { value: "contained", label: "Contenido" },
            { value: "narrow", label: "Angosto" },
          ]}
        />
      </div>
    ),
  },
  CTA: {
    View: CtaBlockView,
    Inspector: ({ config, onChange }: { config: CtaBlockConfig; onChange: (c: CtaBlockConfig) => void }) => (
      <div className="space-y-4">
        <TextField label="Título" value={config.title ?? ""} onChange={(v) => onChange({ ...config, title: v })} />
        <TextAreaField label="Descripción" value={config.text ?? ""} onChange={(v) => onChange({ ...config, text: v })} rows={3} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Texto del botón" value={config.buttonLabel ?? ""} onChange={(v) => onChange({ ...config, buttonLabel: v })} />
          <TextField label="URL del botón" value={config.buttonUrl ?? ""} onChange={(v) => onChange({ ...config, buttonUrl: v })} />
        </div>
        <SelectField
          label="Estilo"
          value={config.stylePreset}
          onChange={(v) => onChange({ ...config, stylePreset: v as CtaBlockConfig["stylePreset"] })}
          options={[
            { value: "solid", label: "Sólido" },
            { value: "outline", label: "Contorno" },
          ]}
        />
      </div>
    ),
  },
  SPACER: {
    View: SpacerBlockView,
    Inspector: ({ config, onChange }: { config: SpacerBlockConfig; onChange: (c: SpacerBlockConfig) => void }) => (
      <SelectField
        label="Tamaño"
        value={config.sizePreset}
        onChange={(v) => onChange({ ...config, sizePreset: v as SpacerBlockConfig["sizePreset"] })}
        options={[
          { value: "sm", label: "Chico" },
          { value: "md", label: "Medio" },
          { value: "lg", label: "Grande" },
        ]}
      />
    ),
  },
  RICH_TEXT: {
    View: RichTextBlockView,
    Inspector: RichTextInspector,
  },
  GALLERY: {
    View: GalleryBlockView,
    Inspector: ({ config, onChange }: { config: GalleryBlockConfig; onChange: (c: GalleryBlockConfig) => void }) => (
      <div className="space-y-4">
        <TextField label="Título (opcional)" value={config.title ?? ""} onChange={(v) => onChange({ ...config, title: v })} />
        <GalleryPhotosEditor photos={config.photos} onChange={(photos) => onChange({ ...config, photos })} />
        <SelectField
          label="Disposición"
          value={config.layout}
          onChange={(v) => onChange({ ...config, layout: v as GalleryBlockConfig["layout"] })}
          options={[
            { value: "grid", label: "Grilla (todas del mismo tamaño)" },
            { value: "masonry", label: "Mosaico (respeta la forma de cada foto)" },
          ]}
        />
        <SelectField
          label="Columnas"
          value={String(config.columns)}
          onChange={(v) => onChange({ ...config, columns: v === "2" ? 2 : v === "4" ? 4 : 3 })}
          options={[
            { value: "2", label: "2 columnas" },
            { value: "3", label: "3 columnas" },
            { value: "4", label: "4 columnas" },
          ]}
        />
        <ToggleField label="Ampliar la foto al tocarla" checked={config.lightbox} onChange={(v) => onChange({ ...config, lightbox: v })} />
      </div>
    ),
  },
  VIDEO: {
    View: VideoBlockView,
    Inspector: ({ config, onChange }: { config: VideoBlockConfig; onChange: (c: VideoBlockConfig) => void }) => (
      <div className="space-y-4">
        <TextField label="Título (opcional)" value={config.title ?? ""} onChange={(v) => onChange({ ...config, title: v })} />
        <TextField label="Enlace del video" value={config.url} onChange={(v) => onChange({ ...config, url: v })} helper="Pegá el enlace de YouTube o de Vimeo." />
        {config.url.trim() && !toVideoEmbedUrl(config.url) ? (
          <p className="text-xs text-red-600">Ese enlace no es de YouTube ni de Vimeo: el video no se va a mostrar en el sitio.</p>
        ) : null}
      </div>
    ),
  },
  EMBED: {
    View: EmbedBlockView,
    Inspector: ({ config, onChange }: { config: EmbedBlockConfig; onChange: (c: EmbedBlockConfig) => void }) => (
      <div className="space-y-4">
        <TextField label="Título (opcional)" value={config.title ?? ""} onChange={(v) => onChange({ ...config, title: v })} />
        <TextField
          label="Enlace a insertar"
          value={config.url}
          onChange={(v) => onChange({ ...config, url: v })}
          helper="Sólo se admiten páginas de CompraMeLaFoto, YouTube, Vimeo y mapas de Google (Compartir → Insertar un mapa)."
        />
        {config.url.trim() && !isAllowedEmbedUrl(config.url) ? (
          <p className="text-xs text-red-600">Ese enlace no se puede insertar: la sección no se va a mostrar en el sitio.</p>
        ) : null}
        <label className="block space-y-1.5">
          <span className="fo-label">Alto (en píxeles)</span>
          <input
            type="number"
            className="fo-input"
            min={EMBED_MIN_HEIGHT_PX}
            max={EMBED_MAX_HEIGHT_PX}
            step={50}
            value={config.heightPx}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({ ...config, heightPx: Number.isFinite(n) ? Math.min(EMBED_MAX_HEIGHT_PX, Math.max(EMBED_MIN_HEIGHT_PX, Math.round(n))) : EMBED_DEFAULT_HEIGHT_PX });
            }}
          />
        </label>
      </div>
    ),
  },
  CONTACT: {
    View: ContactBlockView,
    Inspector: ({ config, onChange }: { config: ContactBlockConfig; onChange: (c: ContactBlockConfig) => void }) => (
      <div className="space-y-4">
        <TextField label="Título (opcional)" value={config.title ?? ""} onChange={(v) => onChange({ ...config, title: v })} />
        <ToggleField
          label="Completar con los datos de mi institución"
          checked={config.useWorkspaceData}
          onChange={(v) => onChange({ ...config, useWorkspaceData: v })}
        />
        <p className="text-xs text-[var(--fo-muted)]">
          Lo que dejes vacío acá se completa con el correo, teléfono, WhatsApp, dirección e Instagram de tu institución. Lo que escribas acá tiene prioridad.
        </p>
        <TextField label="Correo" value={config.email ?? ""} onChange={(v) => onChange({ ...config, email: v })} />
        <TextField label="Teléfono" value={config.phone ?? ""} onChange={(v) => onChange({ ...config, phone: v })} />
        <TextField label="WhatsApp" value={config.whatsapp ?? ""} onChange={(v) => onChange({ ...config, whatsapp: v })} helper="Con o sin código de país: «341 341-9869»." />
        <TextField label="Mensaje inicial de WhatsApp (opcional)" value={config.whatsappText ?? ""} onChange={(v) => onChange({ ...config, whatsappText: v })} />
        <TextField label="Dirección" value={config.address ?? ""} onChange={(v) => onChange({ ...config, address: v })} />
        <TextField label="Enlace de Google Maps" value={config.mapsUrl ?? ""} onChange={(v) => onChange({ ...config, mapsUrl: v })} helper="Pegá el enlace de «Compartir» de Google Maps." />
        {config.mapsUrl?.trim() && !isAllowedMapsUrl(config.mapsUrl) ? (
          <p className="text-xs text-red-600">Ese enlace no es de Google Maps: no se va a guardar.</p>
        ) : null}
        <div className="space-y-2">
          <span className="fo-label">Redes sociales</span>
          {config.socials.map((social, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                className="fo-input w-32 shrink-0"
                aria-label="Red social"
                value={social.network}
                onChange={(e) =>
                  onChange({ ...config, socials: config.socials.map((s, j) => (j === i ? { ...s, network: e.target.value as ContactSocial["network"] } : s)) })
                }
              >
                {CONTACT_SOCIAL_NETWORKS.map((n) => (
                  <option key={n} value={n}>
                    {n === "x" ? "X" : n.charAt(0).toUpperCase() + n.slice(1)}
                  </option>
                ))}
              </select>
              <input
                className="fo-input min-w-0 flex-1"
                aria-label="Enlace de la red social"
                placeholder="https://"
                value={social.url}
                onChange={(e) => onChange({ ...config, socials: config.socials.map((s, j) => (j === i ? { ...s, url: e.target.value } : s)) })}
              />
              <button type="button" className="px-1 text-red-600" aria-label="Quitar red social" onClick={() => onChange({ ...config, socials: config.socials.filter((_, j) => j !== i) })}>
                ×
              </button>
            </div>
          ))}
          {config.socials.length < 20 ? (
            <button
              type="button"
              className="text-sm underline"
              onClick={() => onChange({ ...config, socials: [...config.socials, { network: "instagram", url: "" }] })}
            >
              Agregar red social
            </button>
          ) : null}
        </div>
      </div>
    ),
  },
  INQUIRY_FORM: {
    View: InquiryFormBlockView,
    Inspector: InquiryFormInspector,
  },
  BLOG_LATEST: {
    View: BlogLatestBlockView,
    Inspector: ({ config, onChange }: { config: BlogLatestBlockConfig; onChange: (c: BlogLatestBlockConfig) => void }) => (
      <div className="space-y-4">
        <TextField label="Título" value={config.title ?? ""} onChange={(v) => onChange({ ...config, title: v })} />
        <SelectField
          label="Cuántos artículos"
          value={String(config.count)}
          onChange={(v) => onChange({ ...config, count: v === "6" ? 6 : 3 })}
          options={[
            { value: "3", label: "3 artículos" },
            { value: "6", label: "6 artículos" },
          ]}
        />
        <ToggleField label="Mostrar el extracto" checked={config.showExcerpt} onChange={(v) => onChange({ ...config, showExcerpt: v })} />
        <p className="text-xs text-[var(--fo-muted)]">
          Se muestran solos los últimos artículos publicados en el blog. Si todavía no hay ninguno, la sección no aparece en el sitio.
        </p>
      </div>
    ),
  },
  MEMBER_OF_WEEK: {
    View: MemberOfWeekBlockView,
    Inspector: ({ config, onChange }: { config: MemberOfWeekBlockConfig; onChange: (c: MemberOfWeekBlockConfig) => void }) => (
      <div className="space-y-4">
        <TextField label="Título" value={config.title ?? ""} onChange={(v) => onChange({ ...config, title: v })} />
        <TextAreaField label="Texto de presentación (opcional)" value={config.intro ?? ""} onChange={(v) => onChange({ ...config, intro: v })} />
        <p className="text-xs text-[var(--fo-muted)]">
          Muestra solo al socio destacado de esta semana. Si ese socio no dio permiso para aparecer en el sitio público, esa semana la sección no aparece. Nunca se muestran su teléfono ni su correo.
        </p>
      </div>
    ),
  },
  PORTFOLIO: {
    View: PortfolioBlockView,
    Inspector: PortfolioInspector,
  },
  TESTIMONIALS: {
    View: TestimonialsBlockView,
    Inspector: ({ config, onChange }: { config: TestimonialsBlockConfig; onChange: (c: TestimonialsBlockConfig) => void }) => (
      <div className="space-y-4">
        <TextField label="Título" value={config.title ?? ""} onChange={(v) => onChange({ ...config, title: v })} />
        <SelectField
          label="Cuántos testimonios"
          value={String(config.count)}
          onChange={(v) => onChange({ ...config, count: v === "3" ? 3 : v === "9" ? 9 : v === "12" ? 12 : v === "0" ? 0 : 6 })}
          options={[
            { value: "3", label: "3 testimonios" },
            { value: "6", label: "6 testimonios" },
            { value: "9", label: "9 testimonios" },
            { value: "12", label: "12 testimonios" },
            { value: "0", label: "Todos" },
          ]}
        />
        <SelectField
          label="Disposición"
          value={config.layout}
          onChange={(v) => onChange({ ...config, layout: v === "grid" ? "grid" : "carousel" })}
          options={[
            { value: "carousel", label: "Carrusel" },
            { value: "grid", label: "Grilla" },
          ]}
        />
        <ToggleField label="Mostrar el botón para dejar un testimonio" checked={config.showCta} onChange={(v) => onChange({ ...config, showCta: v })} />
        {config.showCta ? (
          <TextField label="Texto del botón" value={config.ctaLabel} onChange={(v) => onChange({ ...config, ctaLabel: v })} />
        ) : null}
        <p className="text-xs text-[var(--fo-muted)]">
          Se muestran solos los testimonios que publicaste, con los destacados primero. Si todavía no hay ninguno, la sección no aparece en el sitio.
        </p>
      </div>
    ),
  },
};

export { WEBSITE_BLOCK_DEFINITIONS };
