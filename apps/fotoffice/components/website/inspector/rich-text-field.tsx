"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ContentEditorProps } from "@repo/content-ui";
import { generateContentHtml, parseContentHtmlToJson } from "@repo/content";

/** Mismo editor TipTap que usa el blog, cargado sólo en el navegador. */
// `@tiptap/core` no es dependencia directa de la app: el tipo se toma del editor compartido.
type JSONContent = ContentEditorProps["value"];

const BlogEditorClient = dynamic(() => import("@/components/website/blog/blog-editor-client"), {
  ssr: false,
  loading: () => <p className="text-sm text-[var(--fo-muted)]">Cargando editor…</p>,
});

/**
 * Editor de texto con formato para el inspector del builder. El editor del blog trabaja con el
 * JSON de TipTap y el bloque guarda HTML, así que acá se traduce en las dos puntas: al abrir, el
 * HTML pasa a JSON (una sola vez); en cada cambio, el JSON vuelve a HTML. Mientras el campo está
 * montado el editor es la fuente de verdad — el `html` que vuelve del padre no se relee, así no
 * se pisa lo que el usuario está tipeando. El saneado final lo hace el servidor al guardar.
 */
export function RichTextField({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const [json, setJson] = useState<JSONContent | null>(null);
  const initialHtml = useRef(html);
  const lastEmitted = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void parseContentHtmlToJson(initialHtml.current)
      .then((parsed) => {
        if (!cancelled) setJson(parsed);
      })
      .catch(() => {
        if (!cancelled) setJson({ type: "doc", content: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!json) return <p className="text-sm text-[var(--fo-muted)]">Cargando editor…</p>;

  return (
    <BlogEditorClient
      value={json}
      onChange={(next) => {
        setJson(next);
        // Las respuestas async pueden llegar desordenadas: sólo vale la última pedida.
        const ticket = ++lastEmitted.current;
        void generateContentHtml(next).then((out) => {
          if (ticket === lastEmitted.current) onChange(out);
        });
      }}
      placeholder="Escribí el texto de la sección…"
    />
  );
}
