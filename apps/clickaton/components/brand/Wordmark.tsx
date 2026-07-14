import { Logo, type LogoVariant } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";

type WordmarkProps = {
  className?: string;
  href?: string;
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
  href = "/",
  tone = "default",
  height = 40,
}: WordmarkProps) {
  const variant: LogoVariant = tone === "inverse" ? "horizontalMono" : "horizontal";

  return (
    <Logo
      variant={variant}
      href={href}
      height={height}
      priority
      className={cn(className)}
    />
  );
}
