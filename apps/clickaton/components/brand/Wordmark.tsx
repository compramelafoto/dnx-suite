import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

type WordmarkProps = {
  className?: string;
  href?: string;
  tone?: "default" | "inverse";
};

/**
 * Wordmark tipográfico provisional.
 * Reemplazar cuando existan assets en /public/brand/.
 */
export function Wordmark({
  className = "",
  href = "#inicio",
  tone = "default",
}: WordmarkProps) {
  const toneClass = tone === "inverse" ? "text-ck-yellow" : "text-ck-black";

  return (
    <a
      href={href}
      className={cn(
        "ck-heading-md inline-flex items-baseline gap-0.5 tracking-tight",
        toneClass,
        className,
      )}
      aria-label={`${siteConfig.name} — inicio`}
    >
      <span>{siteConfig.wordmark.replace("!", "")}</span>
      <span aria-hidden="true">!</span>
    </a>
  );
}
