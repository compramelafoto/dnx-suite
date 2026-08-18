import type { AnyExtension, Extensions } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { EditorialImage } from "./editorial-image";
import { EditorialGallery } from "./editorial-gallery";

export type EditorialExtensionsOptions = {
  placeholder?: string;
  /** Incluir Placeholder (solo cliente / editor). */
  withPlaceholder?: boolean;
  /**
   * Extensión a usar para el nodo `editorialGallery` — permite a la app
   * (que sí depende de `@tiptap/react`) inyectar una variante con NodeView
   * interactivo (`.extend({ addNodeView: ... })`) sin acoplar este paquete
   * headless a React. Por defecto usa `EditorialGallery` sin NodeView.
   */
  galleryNode?: AnyExtension;
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
    options.galleryNode ?? EditorialGallery,
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
