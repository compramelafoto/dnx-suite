import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { resolveEditorialVideo } from "@repo/editor";
import type { PublicEditorialPhotoViewModel } from "@/lib/public-coverage";
import { PublicEditorialPhoto } from "@/components/public-coverage/PublicEditorialPhoto";
import { VideoEmbed } from "@/components/editorial/video-embed";
import { VideoEmbedFallback } from "@/components/editorial/video-embed-fallback";

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
      "dataEditorialVideo",
      "dataCredit",
      "dataCaption",
      "dataAssetId",
      "dataPhotoId",
      "dataDisplay",
      "dataProvider",
      "dataVideoId",
      "dataUrl",
      "dataWidth",
      "dataAlignment",
      "dataVariant",
      "data-editorial-image",
      "data-editorial-video",
      "data-credit",
      "data-caption",
      "data-asset-id",
      "data-photo-id",
      "data-display",
      "data-provider",
      "data-video-id",
      "data-url",
      "data-width",
      "data-alignment",
      "data-variant",
    ],
    figcaption: ["className"],
    span: ["className", "dataCaption", "dataCreditText", "data-caption", "data-credit-text"],
    img: [...(defaultSchema.attributes?.img || []), "loading", "decoding", "className"],
    a: [...(defaultSchema.attributes?.a || []), "rel", "target", "className", "dataVideoFallback", "data-video-fallback"],
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
      const record = props as Record<string, unknown>;
      const isVideo =
        readDataAttr(record, "data-editorial-video", "dataEditorialVideo") === "true";

      if (isVideo) {
        const resolved = resolveEditorialVideo({
          provider: readDataAttr(record, "data-provider", "dataProvider"),
          videoId: readDataAttr(record, "data-video-id", "dataVideoId"),
          url: readDataAttr(record, "data-url", "dataUrl"),
          caption: readDataAttr(record, "data-caption", "dataCaption"),
          width: readDataAttr(record, "data-width", "dataWidth"),
          alignment: readDataAttr(record, "data-alignment", "dataAlignment"),
          variant: readDataAttr(record, "data-variant", "dataVariant"),
        });
        if (!resolved.ok) {
          return (
            <VideoEmbedFallback
              url={readDataAttr(record, "data-url", "dataUrl")}
              caption={readDataAttr(record, "data-caption", "dataCaption") ?? undefined}
            />
          );
        }
        return <VideoEmbed video={resolved.value} />;
      }

      const photoId = readDataAttr(record, "data-photo-id", "dataPhotoId");
      const display = readDataAttr(record, "data-display", "dataDisplay");

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
