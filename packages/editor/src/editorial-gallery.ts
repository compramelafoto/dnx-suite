import { Node, mergeAttributes } from "@tiptap/core";

export type EditorialGalleryImageSource = "INFOSPOT" | "CLF";

export type EditorialGalleryImageAttrs = {
  /** id local (uuid) — estable para keys/reorder/dedupe en el editor. */
  id: string;
  source: EditorialGalleryImageSource;
  /** InfoSpotEditorialAsset.id — solo source=INFOSPOT. */
  assetId?: string | null;
  /** InfoSpotEditorialPhoto.id (vía InfoSpotEditorialPhotoUsage) — solo source=CLF. */
  photoId?: string | null;
  /**
   * INFOSPOT: URL estable propia (asset permanente en R2 de InfoSpot).
   * CLF: fallback/último conocido — el render real siempre resuelve por
   * photoById (igual que editorialImage), nunca confía en este valor.
   */
  previewUrl: string;
  alt: string;
  caption?: string;
  credit?: string;
  photographerName?: string;
  photographerProfileUrl?: string;
  purchaseUrl?: string;
  width?: number;
  height?: number;
};

export type EditorialGalleryAttrs = {
  id: string;
  title?: string;
  caption?: string;
  autoplay: boolean;
  intervalMs: number;
  loop: boolean;
  images: EditorialGalleryImageAttrs[];
};

export const EDITORIAL_GALLERY_VERSION = 1;
export const EDITORIAL_GALLERY_MIN_IMAGES = 2;
export const EDITORIAL_GALLERY_MAX_IMAGES = 20;
export const EDITORIAL_GALLERY_DEFAULT_INTERVAL_MS = 5000;

const SAFE_URL_SCHEMES = new Set(["http:", "https:"]);

/**
 * true si el valor es un http(s) absoluto, una ruta relativa propia, o está
 * ausente. Reutilizada por el render público antes de emitir href/src.
 */
export function isSafeUrl(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  // Rutas relativas propias de InfoSpot (mismo origen) son válidas.
  if (trimmed.startsWith("/")) return true;
  try {
    const url = new URL(trimmed);
    return SAFE_URL_SCHEMES.has(url.protocol);
  } catch {
    return false;
  }
}

export type EditorialGalleryValidationError =
  | "INVALID_SHAPE"
  | "TOO_FEW_IMAGES"
  | "TOO_MANY_IMAGES"
  | "DUPLICATE_IMAGE"
  | "MISSING_ALT"
  | "UNSAFE_URL";

export type EditorialGalleryValidationResult =
  | { ok: true }
  | { ok: false; error: EditorialGalleryValidationError; index?: number };

/**
 * Validación pura del contrato de galería — sin TipTap ni DOM.
 * Usada tanto en el editor (antes de insertar) como en el servidor
 * (antes de publicar) y en los tests de contrato.
 */
export function validateEditorialGallery(
  attrs: unknown,
): EditorialGalleryValidationResult {
  if (!attrs || typeof attrs !== "object") {
    return { ok: false, error: "INVALID_SHAPE" };
  }
  const a = attrs as Partial<EditorialGalleryAttrs>;
  if (!Array.isArray(a.images)) {
    return { ok: false, error: "INVALID_SHAPE" };
  }
  if (a.images.length < EDITORIAL_GALLERY_MIN_IMAGES) {
    return { ok: false, error: "TOO_FEW_IMAGES" };
  }
  if (a.images.length > EDITORIAL_GALLERY_MAX_IMAGES) {
    return { ok: false, error: "TOO_MANY_IMAGES" };
  }

  const seen = new Set<string>();
  for (let i = 0; i < a.images.length; i++) {
    const img = a.images[i] as Partial<EditorialGalleryImageAttrs> | null;
    if (!img || typeof img !== "object") {
      return { ok: false, error: "INVALID_SHAPE", index: i };
    }
    if (img.source !== "INFOSPOT" && img.source !== "CLF") {
      return { ok: false, error: "INVALID_SHAPE", index: i };
    }
    const dedupeId = img.source === "CLF" ? img.photoId : img.assetId;
    if (dedupeId) {
      const dedupeKey = `${img.source}:${dedupeId}`;
      if (seen.has(dedupeKey)) {
        return { ok: false, error: "DUPLICATE_IMAGE", index: i };
      }
      seen.add(dedupeKey);
    }

    if (!img.alt || !img.alt.trim()) {
      return { ok: false, error: "MISSING_ALT", index: i };
    }
    if (!isSafeUrl(img.previewUrl) || !isSafeUrl(img.purchaseUrl)) {
      return { ok: false, error: "UNSAFE_URL", index: i };
    }
  }

  return { ok: true };
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    editorialGallery: {
      setEditorialGallery: (attrs: EditorialGalleryAttrs) => ReturnType;
    };
  }
}

function numberOrUndefined(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseGalleryImageElement(
  element: Element,
): EditorialGalleryImageAttrs | null {
  if (!(element instanceof HTMLElement)) return null;
  const img = element.querySelector("img");
  const source: EditorialGalleryImageSource =
    element.getAttribute("data-source") === "CLF" ? "CLF" : "INFOSPOT";

  return {
    id: element.getAttribute("data-item-id") || "",
    source,
    assetId: element.getAttribute("data-asset-id") || null,
    photoId: element.getAttribute("data-photo-id") || null,
    previewUrl: img?.getAttribute("src") || "",
    alt: img?.getAttribute("alt") || element.getAttribute("data-alt") || "",
    caption: element.getAttribute("data-caption") || "",
    credit: element.getAttribute("data-credit") || "",
    photographerName: element.getAttribute("data-photographer-name") || "",
    photographerProfileUrl: element.getAttribute("data-photographer-url") || "",
    purchaseUrl: element.getAttribute("data-purchase-url") || "",
    width: numberOrUndefined(element.getAttribute("data-width")),
    height: numberOrUndefined(element.getAttribute("data-height")),
  };
}

/**
 * Bloque de galería editorial: slideshow de 2-20 fotos (propias y/o CLF).
 * Serializa a <figure data-editorial-gallery><ol><li data-gallery-image>
 * para round-trip Markdown/HTML, igual que editorialImage pero con N fotos.
 */
export const EditorialGallery = Node.create({
  name: "editorialGallery",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: "" },
      title: { default: "" },
      caption: { default: "" },
      autoplay: { default: true },
      intervalMs: { default: EDITORIAL_GALLERY_DEFAULT_INTERVAL_MS },
      loop: { default: true },
      images: { default: [] as EditorialGalleryImageAttrs[] },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure[data-editorial-gallery]",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          const items = Array.from(
            element.querySelectorAll("li[data-gallery-image]"),
          );
          const images = items
            .map(parseGalleryImageElement)
            .filter((x): x is EditorialGalleryImageAttrs => x !== null);
          // Un bloque sin imágenes válidas no es una galería reconocible:
          // se descarta (falla de forma segura) en vez de insertar un nodo vacío.
          if (images.length === 0) return false;
          return {
            id: element.getAttribute("data-gallery-id") || "",
            title: element.getAttribute("data-gallery-title") || "",
            caption: element.getAttribute("data-gallery-caption") || "",
            autoplay: element.getAttribute("data-autoplay") !== "false",
            intervalMs:
              numberOrUndefined(element.getAttribute("data-interval-ms")) ??
              EDITORIAL_GALLERY_DEFAULT_INTERVAL_MS,
            loop: element.getAttribute("data-loop") !== "false",
            images,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as unknown as EditorialGalleryAttrs;
    const images = Array.isArray(attrs.images) ? attrs.images : [];
    const title = String(attrs.title || "");
    const caption = String(attrs.caption || "");

    const figAttrs = mergeAttributes({
      "data-editorial-gallery": "true",
      class: "is-editorial-gallery",
      "data-gallery-id": String(attrs.id || ""),
      ...(title ? { "data-gallery-title": title } : {}),
      ...(caption ? { "data-gallery-caption": caption } : {}),
      "data-autoplay": attrs.autoplay === false ? "false" : "true",
      "data-interval-ms": String(
        attrs.intervalMs || EDITORIAL_GALLERY_DEFAULT_INTERVAL_MS,
      ),
      "data-loop": attrs.loop === false ? "false" : "true",
    });

    const items = images.map((img) => {
      const liAttrs: Record<string, string> = {
        "data-gallery-image": "true",
        "data-item-id": img.id || "",
        "data-source": img.source,
        "data-alt": img.alt || "",
      };
      if (img.assetId) liAttrs["data-asset-id"] = img.assetId;
      if (img.photoId) liAttrs["data-photo-id"] = img.photoId;
      if (img.caption) liAttrs["data-caption"] = img.caption;
      if (img.credit) liAttrs["data-credit"] = img.credit;
      if (img.photographerName) {
        liAttrs["data-photographer-name"] = img.photographerName;
      }
      if (img.photographerProfileUrl) {
        liAttrs["data-photographer-url"] = img.photographerProfileUrl;
      }
      if (img.purchaseUrl) liAttrs["data-purchase-url"] = img.purchaseUrl;
      if (img.width) liAttrs["data-width"] = String(img.width);
      if (img.height) liAttrs["data-height"] = String(img.height);

      return [
        "li",
        liAttrs,
        [
          "img",
          {
            src: img.previewUrl || "",
            alt: img.alt || "",
            loading: "lazy",
            decoding: "async",
            draggable: "false",
          },
        ],
      ];
    });

    const children: unknown[] = [
      ["ol", { "data-gallery-images": "true" }, ...items],
    ];

    if (title || caption) {
      const figChildren: unknown[] = [];
      if (title) {
        figChildren.push([
          "span",
          { "data-gallery-title-text": "true", class: "is-caption" },
          title,
        ]);
      }
      if (caption) {
        figChildren.push([
          "span",
          { "data-caption": "true", class: "is-caption" },
          caption,
        ]);
      }
      children.push(["figcaption", { class: "is-figcaption" }, ...figChildren]);
    }

    return ["figure", figAttrs, ...children];
  },

  addCommands() {
    return {
      setEditorialGallery:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});
