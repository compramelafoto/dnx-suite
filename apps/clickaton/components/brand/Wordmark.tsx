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
 * En fondos oscuros (`inverse`) se usa el horizontal color (cámara + wordmark).
 */
export function Wordmark({
  className = "",
  href = null,
  tone = "default",
  height = 56,
}: WordmarkProps) {
  const variant: LogoVariant =
    tone === "inverse" ? "horizontalWeb" : "horizontal";

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
