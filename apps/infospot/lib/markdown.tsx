import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

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
      "data-editorial-image",
      "data-credit",
      "data-caption",
      "data-asset-id",
    ],
    figcaption: ["className"],
    span: ["className", "dataCaption", "dataCreditText", "data-caption", "data-credit-text"],
    img: [...(defaultSchema.attributes?.img || []), "loading", "decoding", "className"],
    a: [...(defaultSchema.attributes?.a || []), "rel", "target", "className"],
  },
};

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
  figure: ({ children, ...props }) => (
    <figure className="is-editorial-figure" {...props}>
      {children}
    </figure>
  ),
  figcaption: ({ children }) => (
    <figcaption className="is-figcaption">{children}</figcaption>
  ),
  h1: ({ children }) => <h2>{children}</h2>,
  h2: ({ children }) => <h2>{children}</h2>,
  h3: ({ children }) => <h3>{children}</h3>,
  h4: ({ children }) => <h4>{children}</h4>,
};

/**
 * Render Markdown + islas HTML de figuras editoriales (sanitizado).
 * Mismo pipeline para público y preview de redacción.
 */
export function MarkdownBody({ content }: { content: string }) {
  if (!content.trim()) return null;
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
