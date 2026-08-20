import type { ImageBlockConfig } from "@/lib/website/blocks";

const WIDTH_CLASS: Record<ImageBlockConfig["widthPreset"], string> = {
  full: "max-w-none",
  contained: "max-w-4xl mx-auto",
  narrow: "max-w-2xl mx-auto",
};

export function ImageBlockView({ config }: { config: ImageBlockConfig }) {
  if (!config.imageUrl) return null;
  return (
    <section className="px-6 py-10">
      <figure className={WIDTH_CLASS[config.widthPreset]}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={config.imageUrl} alt={config.alt ?? ""} className="w-full h-auto rounded-2xl object-cover" />
        {config.caption ? (
          <figcaption className="mt-2 text-sm text-center opacity-60" style={{ color: "var(--wsite-text)" }}>
            {config.caption}
          </figcaption>
        ) : null}
      </figure>
    </section>
  );
}
