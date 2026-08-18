import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { PublicEditorialPhotoViewModel } from "@/lib/public-coverage";
import { PublicEditorialPhoto } from "@/components/public-coverage/PublicEditorialPhoto";
import { EditorialGalleryBlock } from "@/components/editorial/editorial-gallery-block";
import {
  extractGalleryImagesFromChildren,
  parseGalleryFigureAttrs,
} from "@/lib/editorial-gallery/parse-gallery-figure";
import { resolveGalleryForRender } from "@/lib/editorial-gallery/resolve-gallery";

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "figure",
    "figcaption",
    "span",
  ],
  attributes: {
    ...defaultSchema.attributes,
    figure: [
      "className",
      "dataEditorialImage",
      "dataCredit",
      "dataCaption",
      "dataAssetId",
      "dataPhotoId",
      "dataDisplay",
      "data-editorial-image",
      "data-credit",
      "data-caption",
      "data-asset-id",
      "data-photo-id",
      "data-display",
      "dataEditorialGallery",
      "dataGalleryId",
      "dataGalleryTitle",
      "dataGalleryCaption",
      "dataAutoplay",
      "dataIntervalMs",
      "dataLoop",
      "data-editorial-gallery",
      "data-gallery-id",
      "data-gallery-title",
      "data-gallery-caption",
      "data-autoplay",
      "data-interval-ms",
      "data-loop",
    ],
    figcaption: ["className"],
    span: [
      "className",
      "dataCaption",
      "dataCreditText",
      "dataGalleryTitleText",
      "data-caption",
      "data-credit-text",
      "data-gallery-title-text",
    ],
    ol: [...(defaultSchema.attributes?.ol || []), "className", "dataGalleryImages", "data-gallery-images"],
    li: [
      ...(defaultSchema.attributes?.li || []),
      "className",
      "dataGalleryImage",
      "dataItemId",
      "dataSource",
      "dataAssetId",
      "dataPhotoId",
      "dataAlt",
      "dataCaption",
      "dataCredit",
      "dataPhotographerName",
      "dataPhotographerUrl",
      "dataPurchaseUrl",
      "dataWidth",
      "dataHeight",
      "data-gallery-image",
      "data-item-id",
      "data-source",
      "data-asset-id",
      "data-photo-id",
      "data-alt",
      "data-caption",
      "data-credit",
      "data-photographer-name",
      "data-photographer-url",
      "data-purchase-url",
      "data-width",
      "data-height",
    ],
    img: [...(defaultSchema.attributes?.img || []), "loading", "decoding", "className", "draggable"],
    a: [...(defaultSchema.attributes?.a || []), "rel", "target", "className"],
  },
};

function readDataAttr(
  props: Record<string, unknown>,
  kebab: string,
  camel: string,
): string | null {
  const v = props[kebab] ?? props[camel];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

type MarkdownBodyProps = {
  content: string;
  /** Mapa pre-resuelto: una sola carga, sin query por nodo. */
  photoById?: Record<string, PublicEditorialPhotoViewModel>;
};

/**
 * Render Markdown + islas HTML de figuras editoriales (sanitizado).
 * Resuelve `data-photo-id` contra el view model público.
 */
export function MarkdownBody({ content, photoById }: MarkdownBodyProps) {
  if (!content.trim()) return null;

  const components: Components = {
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
    img: ({ src, alt }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={typeof src === "string" ? src : undefined}
        alt={alt ?? ""}
        loading="lazy"
      />
    ),
    figure: ({ children, ...props }) => {
      const isGallery = readDataAttr(
        props as Record<string, unknown>,
        "data-editorial-gallery",
        "dataEditorialGallery",
      );
      if (isGallery) {
        const attrs = parseGalleryFigureAttrs(props as Record<string, unknown>);
        const rawImages = extractGalleryImagesFromChildren(children);
        const resolved = resolveGalleryForRender(attrs, rawImages, photoById);
        if (!resolved) return null;
        return <EditorialGalleryBlock gallery={resolved} />;
      }

      const photoId = readDataAttr(
        props as Record<string, unknown>,
        "data-photo-id",
        "dataPhotoId",
      );
      const display = readDataAttr(
        props as Record<string, unknown>,
        "data-display",
        "dataDisplay",
      );

      if (photoId && photoById?.[photoId]) {
        const photo = photoById[photoId];
        return (
          <div className="my-8">
            <PublicEditorialPhoto
              photo={{
                ...photo,
                displaySize: display || photo.displaySize,
              }}
            />
          </div>
        );
      }

      return (
        <figure className="is-editorial-figure" {...props}>
          {children}
        </figure>
      );
    },
    figcaption: ({ children }) => (
      <figcaption className="is-figcaption">{children}</figcaption>
    ),
    h1: ({ children }) => <h2>{children}</h2>,
    h2: ({ children }) => <h2>{children}</h2>,
    h3: ({ children }) => <h3>{children}</h3>,
    h4: ({ children }) => <h4>{children}</h4>,
  };

  return (
    <div className="is-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
