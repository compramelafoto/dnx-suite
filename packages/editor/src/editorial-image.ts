import { Node, mergeAttributes } from "@tiptap/core";

export type EditorialImageAttrs = {
  src: string;
  alt: string;
  caption: string;
  credit: string;
  assetId: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    editorialImage: {
      setEditorialImage: (attrs: EditorialImageAttrs) => ReturnType;
    };
  }
}

/**
 * Bloque de imagen editorial con alt, epígrafe y crédito.
 * Serializa a <figure data-editorial-image> para round-trip Markdown/HTML.
 */
export const EditorialImage = Node.create({
  name: "editorialImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
      credit: { default: "" },
      assetId: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure[data-editorial-image]",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          const img = element.querySelector("img");
          if (!img) return false;
          const captionEl = element.querySelector("[data-caption]");
          const creditEl = element.querySelector("[data-credit-text]");
          return {
            src: img.getAttribute("src") || "",
            alt: img.getAttribute("alt") || "",
            caption:
              captionEl?.textContent?.trim() ||
              element.getAttribute("data-caption") ||
              "",
            credit:
              creditEl?.textContent?.trim() ||
              element.getAttribute("data-credit") ||
              "",
            assetId: element.getAttribute("data-asset-id") || null,
          };
        },
      },
      {
        tag: "img[src]",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          if (element.closest("figure[data-editorial-image]")) return false;
          return {
            src: element.getAttribute("src") || "",
            alt: element.getAttribute("alt") || "",
            caption: element.getAttribute("title") || "",
            credit: "",
            assetId: null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const src = String(HTMLAttributes.src || "");
    const alt = String(HTMLAttributes.alt || "");
    const caption = String(HTMLAttributes.caption || "");
    const credit = String(HTMLAttributes.credit || "");
    const assetId = HTMLAttributes.assetId ? String(HTMLAttributes.assetId) : "";

    const figAttrs = mergeAttributes({
      "data-editorial-image": "true",
      class: "is-editorial-figure",
      ...(credit ? { "data-credit": credit } : {}),
      ...(caption ? { "data-caption": caption } : {}),
      ...(assetId ? { "data-asset-id": assetId } : {}),
    });

    const imgNode = [
      "img",
      {
        src,
        alt,
        loading: "lazy",
        decoding: "async",
      },
    ] as const;

    if (!caption && !credit) {
      return ["figure", figAttrs, imgNode];
    }

    const captionChildren: unknown[] = [];
    if (caption) {
      captionChildren.push(["span", { "data-caption": "true", class: "is-caption" }, caption]);
    }
    if (credit) {
      captionChildren.push([
        "span",
        { "data-credit-text": "true", class: "is-credit" },
        credit,
      ]);
    }

    return [
      "figure",
      figAttrs,
      imgNode,
      ["figcaption", { class: "is-figcaption" }, ...captionChildren],
    ];
  },

  addCommands() {
    return {
      setEditorialImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});
