import { Logo, type LogoVariant } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";

type WordmarkProps = {
  className?: string;
  /** `null` = marca estática, sin enlace. */
  href?: string | null;
  /** `inverse` = logo mono para fondos oscuros (Manual). */
  tone?: "default" | "inverse";
  height?: number;
};

/**
 * Marca Clickatón en chrome (header/footer).
 * Usa assets oficiales — no reconstrucción tipográfica.
 */
export function Wordmark({
  className = "",
  href = null,
  tone = "default",
  height = 56,
}: WordmarkProps) {
  const variant: LogoVariant = tone === "inverse" ? "horizontalMono" : "horizontal";

  return (
    <Logo
      variant={variant}
      href={href}
      height={height}
      priority
      className={cn("bg-transparent", className)}
    />
  );
}
