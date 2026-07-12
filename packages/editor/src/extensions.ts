import type { Extensions } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { EditorialImage } from "./editorial-image";

export type EditorialExtensionsOptions = {
  placeholder?: string;
  /** Incluir Placeholder (solo cliente / editor). */
  withPlaceholder?: boolean;
};

/**
 * Extensiones TipTap para redacción editorial (sin tablas ni embeds).
 * H1 excluido: el título de la nota es el único H1 de página.
 */
export function getEditorialExtensions(options: EditorialExtensionsOptions = {}): Extensions {
  const extensions: Extensions = [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      codeBlock: false,
      code: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: {
        rel: "noopener noreferrer",
        target: "_blank",
      },
    }),
    EditorialImage,
  ];

  if (options.withPlaceholder !== false) {
    extensions.push(
      Placeholder.configure({
        placeholder: options.placeholder ?? "Empezá a escribir la nota…",
      }),
    );
  }

  return extensions;
}
