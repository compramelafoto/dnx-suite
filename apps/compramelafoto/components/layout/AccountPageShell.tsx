import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AccountPageShellProps = {
  children: ReactNode;
  className?: string;
  /** Fondo de la sección (por defecto gris suave de cuenta) */
  variant?: "muted" | "white";
};

/**
 * Shell para páginas de cuenta bajo MainLayout (Header/Footer).
 * Garantiza ancho útil completo, tope legible ~860px y stretch en flex.
 */
export default function AccountPageShell({
  children,
  className,
  variant = "muted",
}: AccountPageShellProps) {
  return (
    <section
      className={cn(
        "ds-account-page min-h-[50vh] w-full min-w-0 py-10 md:py-14",
        variant === "muted" ? "bg-gray-50" : "bg-white",
        className
      )}
    >
      <div className="container-custom ds-fill-width">
        <div className="ds-account-inner ds-stack-section">{children}</div>
      </div>
    </section>
  );
}
