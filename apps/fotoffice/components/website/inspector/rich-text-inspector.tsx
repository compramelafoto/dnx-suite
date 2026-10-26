"use client";

import { useEffect, useRef } from "react";
import { RichTextField } from "@/components/website/inspector/rich-text-field";
import { SelectField, TextField } from "@/components/website/inspector/inspector-fields";
import type { RichTextBlockConfig } from "@/lib/website/blocks";

/**
 * Inspector del texto con formato. El HTML llega de forma asíncrona (el editor lo traduce desde
 * JSON), así que al llegar se aplica sobre la config VIGENTE (ref) y no sobre la que había al
 * tipear: si mientras tanto se cambió el título o el ancho, ese cambio no se revierte.
 */
export function RichTextInspector({ config, onChange }: { config: RichTextBlockConfig; onChange: (c: RichTextBlockConfig) => void }) {
  const latest = useRef(config);
  useEffect(() => {
    latest.current = config;
  }, [config]);
  return (
    <div className="space-y-4">
      <TextField label="Título (opcional)" value={config.title ?? ""} onChange={(v) => onChange({ ...config, title: v })} />
      <div className="space-y-1.5">
        <span className="fo-label">Texto</span>
        <RichTextField html={config.html} onChange={(html) => onChange({ ...latest.current, html })} />
      </div>
      <SelectField
        label="Alineación"
        value={config.align}
        onChange={(v) => onChange({ ...config, align: v as RichTextBlockConfig["align"] })}
        options={[
          { value: "left", label: "Izquierda" },
          { value: "center", label: "Centro" },
        ]}
      />
      <SelectField
        label="Ancho"
        value={config.width}
        onChange={(v) => onChange({ ...config, width: v as RichTextBlockConfig["width"] })}
        options={[
          { value: "narrow", label: "Angosto" },
          { value: "normal", label: "Normal" },
          { value: "wide", label: "Ancho" },
        ]}
      />
    </div>
  );
}
