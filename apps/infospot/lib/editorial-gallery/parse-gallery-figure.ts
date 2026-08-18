/**
 * Extrae el contenido de un bloque <figure data-editorial-gallery> ya
 * convertido a árbol React por react-markdown (rehype-raw + rehype-sanitize).
 * No hay HTML crudo acá — son elementos React reales (ol/li/img), por eso
 * es testeable con React.createElement sin DOM ni parser adicional.
 */

import { Children, isValidElement, type ReactElement, type ReactNode } from "react";

export type RawGalleryImage = {
  id: string;
  source: "INFOSPOT" | "CLF";
  assetId: string | null;
  photoId: string | null;
  previewUrl: string;
  alt: string;
  caption: string | null;
  credit: string | null;
  photographerName: string | null;
  photographerProfileUrl: string | null;
  purchaseUrl: string | null;
  width?: number;
  height?: number;
};

export type RawGalleryAttrs = {
  id: string;
  title: string | null;
  caption: string | null;
  autoplay: boolean;
  intervalMs: number;
  loop: boolean;
};

/** Lee un atributo data-* tanto en su forma kebab como camelCase (react-markdown preserva ambas según el paso de sanitización). */
export function readDataAttr(
  props: Record<string, unknown>,
  kebab: string,
  camel: string,
): string | null {
  const v = props[kebab] ?? props[camel];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function numberOrUndefined(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function parseGalleryFigureAttrs(
  props: Record<string, unknown>,
): RawGalleryAttrs {
  return {
    id: readDataAttr(props, "data-gallery-id", "dataGalleryId") || "",
    title: readDataAttr(props, "data-gallery-title", "dataGalleryTitle"),
    caption: readDataAttr(props, "data-gallery-caption", "dataGalleryCaption"),
    autoplay: readDataAttr(props, "data-autoplay", "dataAutoplay") !== "false",
    intervalMs:
      numberOrUndefined(readDataAttr(props, "data-interval-ms", "dataIntervalMs")) ?? 5000,
    loop: readDataAttr(props, "data-loop", "dataLoop") !== "false",
  };
}

/**
 * Encuentra el <img> hijo por estructura (prop `src`), no por identidad de
 * tipo: react-markdown puede reemplazar "img" por un componente custom
 * (ver components.img en MarkdownBody), así que el `type` ya no es la
 * cadena literal "img" en ese caso.
 */
function findImgChild(children: ReactNode): ReactElement | null {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    const props = child.props as Record<string, unknown>;
    if (child.type === "img" || typeof props.src === "string") return child;
  }
  return null;
}

/** Recorre <ol data-gallery-images><li data-gallery-image><img/></li></ol> dentro de children del figure. */
export function extractGalleryImagesFromChildren(children: ReactNode): RawGalleryImage[] {
  const images: RawGalleryImage[] = [];

  for (const olCandidate of Children.toArray(children)) {
    if (!isValidElement(olCandidate) || olCandidate.type !== "ol") continue;
    const olProps = olCandidate.props as { children?: ReactNode };

    for (const liCandidate of Children.toArray(olProps.children)) {
      if (!isValidElement(liCandidate) || liCandidate.type !== "li") continue;
      const liProps = liCandidate.props as Record<string, unknown>;
      const isGalleryItem = readDataAttr(liProps, "data-gallery-image", "dataGalleryImage");
      if (!isGalleryItem) continue;

      const img = findImgChild(liProps.children as ReactNode);
      const imgProps = (img?.props as Record<string, unknown>) || {};
      const src = typeof imgProps.src === "string" ? imgProps.src : "";
      const imgAlt = typeof imgProps.alt === "string" ? imgProps.alt : "";

      images.push({
        id: readDataAttr(liProps, "data-item-id", "dataItemId") || "",
        source:
          readDataAttr(liProps, "data-source", "dataSource") === "CLF" ? "CLF" : "INFOSPOT",
        assetId: readDataAttr(liProps, "data-asset-id", "dataAssetId"),
        photoId: readDataAttr(liProps, "data-photo-id", "dataPhotoId"),
        previewUrl: src,
        alt: imgAlt || readDataAttr(liProps, "data-alt", "dataAlt") || "",
        caption: readDataAttr(liProps, "data-caption", "dataCaption"),
        credit: readDataAttr(liProps, "data-credit", "dataCredit"),
        photographerName: readDataAttr(liProps, "data-photographer-name", "dataPhotographerName"),
        photographerProfileUrl: readDataAttr(
          liProps,
          "data-photographer-url",
          "dataPhotographerUrl",
        ),
        purchaseUrl: readDataAttr(liProps, "data-purchase-url", "dataPurchaseUrl"),
        width: numberOrUndefined(readDataAttr(liProps, "data-width", "dataWidth")),
        height: numberOrUndefined(readDataAttr(liProps, "data-height", "dataHeight")),
      });
    }
  }

  return images;
}
