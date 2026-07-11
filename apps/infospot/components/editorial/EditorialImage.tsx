import { ImageCaption } from "@/components/editorial/ImageCaption";
import { cx } from "@/components/foundations/cx";

type AspectRatio = "hero" | "feature" | "card" | "wide" | "square" | "auto" | string;

type Props = {
  src: string;
  alt?: string;
  caption?: string | null;
  credit?: string | null;
  photographerName?: string | null;
  copyrightText?: string | null;
  priority?: boolean;
  aspectRatio?: AspectRatio;
  /** @deprecated Preferir aspectRatio */
  aspect?: AspectRatio;
  sizes?: string;
  className?: string;
};

const aspectPresets: Record<string, string> = {
  hero: "aspect-[16/10] md:aspect-[21/10]",
  feature: "aspect-[16/10]",
  card: "aspect-[16/10]",
  wide: "aspect-[16/9]",
  square: "aspect-square",
  auto: "aspect-auto",
};

function resolveAspect(aspectRatio: AspectRatio = "wide") {
  if (aspectRatio in aspectPresets) return aspectPresets[aspectRatio];
  return `aspect-[${aspectRatio}]`;
}

/** Imagen editorial con crédito. Sin lógica CLF ni URLs de origen. */
export function EditorialImage({
  src,
  alt = "",
  caption,
  credit,
  photographerName,
  copyrightText,
  priority = false,
  aspectRatio,
  aspect,
  sizes = "(max-width: 768px) 100vw, 960px",
  className,
}: Props) {
  const resolvedAspect = aspectRatio ?? aspect ?? "wide";
  const resolvedCredit =
    credit ||
    (photographerName ? `Foto: ${photographerName}` : null);

  return (
    <figure className={className}>
      <div
        className={cx(
          "overflow-hidden rounded-[var(--is-radius-md)] bg-[var(--is-surface-muted)]",
          resolveAspect(resolvedAspect),
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- allow arbitrary editorial sources */}
        <img
          src={src}
          alt={alt || caption || ""}
          className="h-full w-full object-cover select-none"
          draggable={false}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          sizes={sizes}
        />
      </div>
      <ImageCaption
        caption={caption}
        credit={resolvedCredit}
        copyrightText={copyrightText}
      />
    </figure>
  );
}
