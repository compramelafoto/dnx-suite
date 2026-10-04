import type { ComponentType } from "react";
import { ImageUploadField } from "@/components/image-upload-field";
import { SelectField, TextAreaField, TextField, ToggleField } from "@/components/website/inspector/inspector-fields";
import { HeroBlockView } from "@/components/website/render/blocks/hero-block-view";
import { HeroSlideEditor } from "@/components/website/builder/hero-slide-editor";
import { TextBlockView } from "@/components/website/render/blocks/text-block-view";
import { ImageBlockView } from "@/components/website/render/blocks/image-block-view";
import { CtaBlockView } from "@/components/website/render/blocks/cta-block-view";
import { SpacerBlockView } from "@/components/website/render/blocks/spacer-block-view";
import { BlogLatestBlockView } from "@/components/website/render/blocks/blog-latest-block-view";
import type { WebsiteDynamicData } from "./dynamic-data";
import {
  WEBSITE_BLOCK_DEFINITIONS,
  type BlogLatestBlockConfig,
  type CtaBlockConfig,
  type ImageBlockConfig,
  type SpacerBlockConfig,
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
};

export { WEBSITE_BLOCK_DEFINITIONS };
