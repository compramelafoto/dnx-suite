"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUploadField } from "@/components/image-upload-field";
import {
  WEBSITE_BLOCK_DEFINITIONS,
  ctaConfigSchema,
  heroConfigSchema,
  imageConfigSchema,
  spacerConfigSchema,
  textConfigSchema,
  type WebsiteBlock,
} from "@/lib/website/blocks";

const CONFIG_SCHEMAS = {
  HERO: heroConfigSchema,
  TEXT: textConfigSchema,
  IMAGE: imageConfigSchema,
  CTA: ctaConfigSchema,
  SPACER: spacerConfigSchema,
} as const;

export function BlockEditDialog({
  block,
  onSave,
  onClose,
}: {
  block: WebsiteBlock;
  onSave: (updated: WebsiteBlock) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [visible, setVisible] = useState(block.visible);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const rawConfig = formDataToConfig(block.type, fd);
    const schema = CONFIG_SCHEMAS[block.type];
    const parsed = schema.safeParse(rawConfig);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisá los campos del bloque.");
      return;
    }
    setError(null);
    onSave({ ...block, visible, config: parsed.data } as WebsiteBlock);
  }

  const def = WEBSITE_BLOCK_DEFINITIONS[block.type];

  return (
    <dialog ref={dialogRef} className="fo-card max-w-lg w-[90vw] p-0 backdrop:bg-black/50" onClose={onClose} onCancel={onClose}>
      <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Editar {def.label.toLowerCase()}</h2>
        </div>

        <BlockFields block={block} />

        <label className="flex items-center gap-2 text-sm text-[var(--fo-text)]">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          Mostrar esta sección en el sitio
        </label>

        {error ? <p className="text-sm text-[var(--fo-danger)]">{error}</p> : null}

        <div className="fo-form-actions">
          <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Guardar bloque
          </button>
        </div>
      </form>
    </dialog>
  );
}

function formDataToConfig(type: WebsiteBlock["type"], fd: FormData): Record<string, unknown> {
  const get = (name: string) => fd.get(name)?.toString()?.trim() || undefined;
  switch (type) {
    case "HERO":
      return {
        title: get("title") ?? "",
        subtitle: get("subtitle"),
        imageUrl: get("imageUrl"),
        buttonLabel: get("buttonLabel"),
        buttonUrl: get("buttonUrl"),
        align: get("align") ?? "center",
      };
    case "TEXT":
      return { title: get("title"), content: get("content") ?? "", align: get("align") ?? "left" };
    case "IMAGE":
      return {
        imageUrl: get("imageUrl") ?? "",
        alt: get("alt") ?? "",
        caption: get("caption"),
        widthPreset: get("widthPreset") ?? "full",
      };
    case "CTA":
      return {
        title: get("title") ?? "",
        text: get("text"),
        buttonLabel: get("buttonLabel") ?? "",
        buttonUrl: get("buttonUrl") ?? "",
        stylePreset: get("stylePreset") ?? "solid",
      };
    case "SPACER":
      return { sizePreset: get("sizePreset") ?? "md" };
  }
}

function BlockFields({ block }: { block: WebsiteBlock }) {
  switch (block.type) {
    case "HERO":
      return (
        <div className="space-y-4">
          <TextField label="Título" name="title" defaultValue={block.config.title} required />
          <TextAreaField label="Subtítulo" name="subtitle" defaultValue={block.config.subtitle} />
          <ImageUploadField name="imageUrl" presetKey="websiteHeroImage" label="Imagen de fondo" initialUrl={block.config.imageUrl ?? null} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Texto del botón" name="buttonLabel" defaultValue={block.config.buttonLabel} />
            <TextField label="Enlace del botón" name="buttonUrl" defaultValue={block.config.buttonUrl} />
          </div>
          <AlignField defaultValue={block.config.align} />
        </div>
      );
    case "TEXT":
      return (
        <div className="space-y-4">
          <TextField label="Título (opcional)" name="title" defaultValue={block.config.title} />
          <TextAreaField label="Contenido" name="content" defaultValue={block.config.content} required rows={6} />
          <AlignField defaultValue={block.config.align} />
        </div>
      );
    case "IMAGE":
      return (
        <div className="space-y-4">
          <ImageUploadField name="imageUrl" presetKey="websiteBlockImage" label="Imagen" initialUrl={block.config.imageUrl || null} />
          <TextField label="Texto alternativo" name="alt" defaultValue={block.config.alt} required helper="Describe la imagen para lectores de pantalla y buscadores." />
          <TextField label="Epígrafe (opcional)" name="caption" defaultValue={block.config.caption} />
          <SelectField
            label="Ancho"
            name="widthPreset"
            defaultValue={block.config.widthPreset}
            options={[
              { value: "full", label: "Completo" },
              { value: "contained", label: "Contenido" },
              { value: "narrow", label: "Angosto" },
            ]}
          />
        </div>
      );
    case "CTA":
      return (
        <div className="space-y-4">
          <TextField label="Título" name="title" defaultValue={block.config.title} required />
          <TextAreaField label="Descripción" name="text" defaultValue={block.config.text} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Texto del botón" name="buttonLabel" defaultValue={block.config.buttonLabel} required />
            <TextField label="URL del botón" name="buttonUrl" defaultValue={block.config.buttonUrl} required />
          </div>
          <SelectField
            label="Estilo"
            name="stylePreset"
            defaultValue={block.config.stylePreset}
            options={[
              { value: "solid", label: "Sólido" },
              { value: "outline", label: "Contorno" },
            ]}
          />
        </div>
      );
    case "SPACER":
      return (
        <SelectField
          label="Tamaño"
          name="sizePreset"
          defaultValue={block.config.sizePreset}
          options={[
            { value: "sm", label: "Chico" },
            { value: "md", label: "Medio" },
            { value: "lg", label: "Grande" },
          ]}
        />
      );
  }
}

function TextField({
  label,
  name,
  defaultValue,
  required,
  helper,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  helper?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="fo-label">{label}</span>
      <input name={name} defaultValue={defaultValue} required={required} className="fo-input" />
      {helper ? <p className="fo-helper">{helper}</p> : null}
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  required,
  rows = 3,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <label className="block space-y-2">
      <span className="fo-label">{label}</span>
      <textarea name={name} defaultValue={defaultValue} required={required} rows={rows} className="fo-input" />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block space-y-2">
      <span className="fo-label">{label}</span>
      <select name={name} defaultValue={defaultValue} className="fo-input">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AlignField({ defaultValue }: { defaultValue: string }) {
  return (
    <SelectField
      label="Alineación"
      name="align"
      defaultValue={defaultValue}
      options={[
        { value: "left", label: "Izquierda" },
        { value: "center", label: "Centro" },
      ]}
    />
  );
}
