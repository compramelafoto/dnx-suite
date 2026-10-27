import type { DividerBlockConfig } from "@/lib/website/blocks";

const SPACING: Record<DividerBlockConfig["spacing"], string> = { sm: "py-4", md: "py-8", lg: "py-16" };
const WIDTH: Record<DividerBlockConfig["width"], string> = { short: "max-w-[8rem]", medium: "max-w-xl", full: "max-w-6xl" };

/** Línea divisoria entre secciones: lisa, punteada o con un adorno simple al medio. */
export function DividerBlockView({ config }: { config: DividerBlockConfig }) {
  const line = (
    <hr
      className="w-full border-0 border-t-2"
      style={{ borderTopStyle: config.style === "dotted" ? "dotted" : "solid", borderColor: "var(--wsite-text)", opacity: 0.25 }}
    />
  );
  return (
    <div className={`px-6 ${SPACING[config.spacing]}`}>
      <div className={`mx-auto flex items-center gap-4 ${WIDTH[config.width]}`}>
        {config.style === "ornament" ? (
          <>
            {line}
            <span aria-hidden="true" className="shrink-0 text-lg leading-none" style={{ color: "var(--wsite-primary)" }}>
              ◆
            </span>
            {line}
          </>
        ) : (
          line
        )}
      </div>
    </div>
  );
}
