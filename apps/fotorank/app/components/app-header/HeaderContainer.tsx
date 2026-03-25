import type { ReactNode } from "react";

export type HeaderContainerVariant = "dashboard" | "landing";

type HeaderContainerProps = {
  variant: HeaderContainerVariant;
  children: ReactNode;
  className?: string;
  /** Dashboard con logo alto: altura mínima mayor que landing (64px). */
  relaxedHeight?: boolean;
};

/**
 * Barra full-bleed; el contenido vive en contenedor centrado max-w 1280px con padding 16px / 24px.
 * Landing: 64px (`h-16`). Dashboard con `relaxedHeight`: espacio para logo grande + controles.
 */
export function HeaderContainer({ variant, children, className, relaxedHeight }: HeaderContainerProps) {
  const inner =
    relaxedHeight === true
      ? "mx-auto flex min-h-[5.5rem] w-full max-w-[1280px] items-center px-4 py-2 md:min-h-[6.5rem] md:px-6 md:py-2.5"
      : "mx-auto h-16 w-full max-w-[1280px] px-4 md:px-6";

  return (
    <header
      className={`z-40 w-full shrink-0 border-b border-[#1a1a1a] bg-[#050505]/90 font-sans backdrop-blur-md ${
        variant === "dashboard" ? "sticky top-0" : "fixed left-0 right-0 top-0"
      } ${className ?? ""}`}
    >
      <div className={inner}>{children}</div>
    </header>
  );
}
