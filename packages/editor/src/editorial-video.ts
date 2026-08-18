import { Node, mergeAttributes } from "@tiptap/core";
import {
  defaultEditorialVideoAttrs,
  resolveEditorialVideo,
  type EditorialVideoAttrs,
} from "./video-embed";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    editorialVideo: {
      setEditorialVideo: (attrs: EditorialVideoAttrs) => ReturnType;
      updateEditorialVideo: (attrs: Partial<EditorialVideoAttrs>) => ReturnType;
    };
  }
}

function attrsFromElement(element: HTMLElement): EditorialVideoAttrs | false {
  const resolved = resolveEditorialVideo({
    provider: element.getAttribute("data-provider"),
    videoId: element.getAttribute("data-video-id"),
    url: element.getAttribute("data-url"),
    caption:
      element.getAttribute("data-caption") ||
      element.querySelector("[data-caption]")?.textContent ||
      "",
    width: element.getAttribute("data-width"),
    alignment: element.getAttribute("data-alignment"),
    variant: element.getAttribute("data-variant"),
  });
  return resolved.ok ? resolved.value : false;
}

/**
 * Bloque de video externo. Serializa a <figure data-editorial-video> sin iframe.
 * El iframe / embed se genera solo al renderizar.
 */
export const EditorialVideo = Node.create({
  name: "editorialVideo",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    const defaults = defaultEditorialVideoAttrs();
    return {
      provider: { default: defaults.provider },
      url: { default: defaults.url },
      videoId: { default: defaults.videoId },
      caption: { default: defaults.caption },
      width: { default: defaults.width },
      alignment: { default: defaults.alignment },
      variant: { default: defaults.variant },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure[data-editorial-video]",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          return attrsFromElement(element);
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const resolved = resolveEditorialVideo(HTMLAttributes);
    if (!resolved.ok) {
      return ["figure", mergeAttributes({ class: "is-editorial-video is-video-invalid" })];
    }
    const value = resolved.value;
    const figAttrs = mergeAttributes({
      "data-editorial-video": "true",
      "data-provider": value.provider,
      "data-video-id": value.videoId,
      "data-url": value.url,
      "data-width": value.width,
      "data-alignment": value.alignment,
      "data-variant": value.variant,
      class: "is-editorial-video",
      ...(value.caption ? { "data-caption": value.caption } : {}),
    });

    const fallbackLink = [
      "a",
      {
        href: value.url,
        rel: "noopener noreferrer",
        target: "_blank",
        "data-video-fallback": "true",
      },
      value.provider === "youtube"
        ? "Ver en YouTube"
        : value.provider === "vimeo"
          ? "Ver en Vimeo"
          : "Ver en Instagram",
    ] as const;

    if (!value.caption) {
      return ["figure", figAttrs, fallbackLink];
    }

    return [
      "figure",
      figAttrs,
      fallbackLink,
      [
        "figcaption",
        { class: "is-figcaption" },
        ["span", { "data-caption": "true", class: "is-caption" }, value.caption],
      ],
    ];
  },

  addCommands() {
    return {
      setEditorialVideo:
        (attrs) =>
        ({ commands }) => {
          const resolved = resolveEditorialVideo(attrs);
          if (!resolved.ok) return false;
          return commands.insertContent({
            type: this.name,
            attrs: resolved.value,
          });
        },
      updateEditorialVideo:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    };
  },
});
