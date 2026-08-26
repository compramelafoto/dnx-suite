import type { ReactNode } from "react";
import { CLICKATON_CONTENT_ACCENT_STYLE } from "@/lib/content/content-labels";
import { cn } from "@/lib/cn";

/**
 * Lienzo claro para el CMS compartido.
 *
 * `@repo/content-ui` es neutro de marca pero está construido sobre superficie
 * clara; el panel Clickatón es oscuro. En lugar de reescribir el paquete se
 * aísla el editor en una tarjeta clara e inyecta el amarillo de marca como
 * `--content-ui-accent`.
 */
export function ContentCmsSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      style={CLICKATON_CONTENT_ACCENT_STYLE}
      className={cn(
        "rounded-[var(--ck-radius-card)] border border-ck-border bg-white p-6 text-gray-900 sm:p-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
