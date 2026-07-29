import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";

type WordmarkProps = {
  className?: string;
  /** `null` = marca estática, sin enlace. */
  href?: string | null;
  /**
   * Conservado por compatibilidad de API.
   * En producto se usa siempre el logo principal del Manual de Marca.
   */
  tone?: "default" | "inverse";
  height?: number;
};

/**
 * Marca Clickatón en chrome (header / footer / admin).
 * Siempre el logo principal oficial (`/brand/logo-principal.png`).
 */
export function Wordmark({
  className = "",
  href = null,
  height = 64,
}: WordmarkProps) {
  return (
    <Logo
      variant="principal"
      href={href}
      height={height}
      priority
      className={cn("bg-transparent", className)}
    />
  );
}
