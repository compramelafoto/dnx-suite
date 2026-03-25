import type { JudgeBioBlock, JudgeBioDocument } from "../../lib/fotorank/judges/judgeBioRich";

type JudgeBioRendererVariant = "public" | "preview";

function BlockView({ block, variant }: { block: JudgeBioBlock; variant: JudgeBioRendererVariant }) {
  const isPreview = variant === "preview";
  switch (block.type) {
    case "paragraph":
      return (
        <p
          className={
            isPreview
              ? "text-xs leading-relaxed text-fr-muted whitespace-pre-wrap"
              : "text-sm leading-relaxed text-fr-muted whitespace-pre-wrap"
          }
        >
          {block.text}
        </p>
      );
    case "heading":
      if (block.level === 2) {
        return (
          <h2
            className={
              isPreview
                ? "mt-3 text-base font-semibold text-fr-primary first:mt-0"
                : "mt-6 text-lg font-semibold text-fr-primary first:mt-0"
            }
          >
            {block.text}
          </h2>
        );
      }
      return (
        <h3
          className={
            isPreview
              ? "mt-2 text-sm font-semibold text-fr-primary first:mt-0"
              : "mt-4 text-base font-semibold text-fr-primary first:mt-0"
          }
        >
          {block.text}
        </h3>
      );
    case "bulletList":
      return (
        <ul
          className={
            isPreview
              ? "mt-1 list-disc space-y-0.5 pl-4 text-xs text-fr-muted"
              : "mt-2 list-disc space-y-1 pl-5 text-sm text-fr-muted"
          }
        >
          {block.items.map((item, i) => (
            <li key={i} className="whitespace-pre-wrap">
              {item}
            </li>
          ))}
        </ul>
      );
    case "numberedList":
      return (
        <ol
          className={
            isPreview
              ? "mt-1 list-decimal space-y-0.5 pl-4 text-xs text-fr-muted"
              : "mt-2 list-decimal space-y-1 pl-5 text-sm text-fr-muted"
          }
        >
          {block.items.map((item, i) => (
            <li key={i} className="whitespace-pre-wrap">
              {item}
            </li>
          ))}
        </ol>
      );
    case "link":
      return (
        <p className={isPreview ? "mt-1 text-xs" : "mt-2 text-sm"}>
          <a
            href={block.url}
            className="text-fr-primary underline decoration-fr-primary/40 underline-offset-2 hover:decoration-fr-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            {block.text}
          </a>
        </p>
      );
    default:
      return null;
  }
}

export function JudgeBioRenderer({
  doc,
  variant = "public",
}: {
  doc: JudgeBioDocument;
  variant?: JudgeBioRendererVariant;
}) {
  if (!doc.blocks.length) return null;
  return (
    <div className={variant === "preview" ? "space-y-0.5" : "space-y-1"}>
      {doc.blocks.map((b, i) => (
        <BlockView key={i} block={b} variant={variant} />
      ))}
    </div>
  );
}
