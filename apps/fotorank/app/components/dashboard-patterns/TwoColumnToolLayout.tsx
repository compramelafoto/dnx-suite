import type { ReactNode } from "react";

type TwoColumnToolLayoutProps = {
  /** Columna típica: filtros (orden primero en móvil). */
  sidebar: ReactNode;
  /** Resultados / contenido principal. */
  children: ReactNode;
  className?: string;
};

/**
 * Layout de herramienta: sidebar fijo de ancho estándar + área principal fluida.
 * En &lt; lg: stack vertical con gap de sección (40px).
 */
export function TwoColumnToolLayout({ sidebar, children, className = "" }: TwoColumnToolLayoutProps) {
  return (
    <div className={`flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10 xl:gap-12 ${className}`}>
      <div className="w-full shrink-0 lg:max-w-[300px] lg:basis-[280px]">{sidebar}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
