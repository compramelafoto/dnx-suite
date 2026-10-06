import { Node } from "@tiptap/core";

/**
 * Publicación o reel de Instagram incrustado con el reproductor oficial (`/embed/`).
 *
 * El video no se copia: se muestra desde Instagram, con el crédito de la cuenta que lo publicó.
 * El nodo guarda el enlace de la publicación y arma la dirección del reproductor al renderizar;
 * si el enlace no es de una publicación de Instagram, no sale ningún iframe.
 */
const INSTAGRAM_POST_URL =
  /^https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|tv)\/([A-Za-z0-9_-]+)/;

export function getInstagramEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = INSTAGRAM_POST_URL.exec(url.trim());
  if (!match) return null;
  return `https://www.instagram.com/${match[1]}/${match[2]}/embed/`;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    instagramEmbed: {
      /** Inserta la publicación; no hace nada si el enlace no es de una publicación de Instagram. */
      setInstagramEmbed: (options: { src: string }) => ReturnType;
    };
  }
}

export const InstagramEmbed = Node.create({
  name: "instagramEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  addCommands() {
    return {
      setInstagramEmbed:
        ({ src }) =>
        ({ commands }) => {
          if (!getInstagramEmbedUrl(src)) return false;
          return commands.insertContent({ type: this.name, attrs: { src: src.trim() } });
        },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'iframe[src*="instagram.com/"]',
        getAttrs: (element) => {
          const src = element.getAttribute("src");
          return getInstagramEmbedUrl(src) ? { src } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const embedUrl = getInstagramEmbedUrl(HTMLAttributes.src as string | null);
    if (!embedUrl) return ["div", { class: "blog-instagram-embed" }];
    return [
      "div",
      { class: "blog-instagram-embed" },
      [
        "iframe",
        {
          src: embedUrl,
          title: "Publicación de Instagram",
          loading: "lazy",
          frameborder: "0",
          allowfullscreen: "true",
          allow: "autoplay; encrypted-media; picture-in-picture",
        },
      ],
    ];
  },
});
