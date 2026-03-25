import type { ReactNode } from "react";

/**
 * Cabecera de tarjeta en directorios: logo centrado ~70%.
 * Superficie `themeComprameLaFoto.directory.logoWell` (#f3f4f6).
 */
export function DirectoryLogoArea({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-40 min-h-[10rem] w-full shrink-0 items-center justify-center overflow-hidden rounded-t-2xl border-b border-[rgba(0,0,0,0.06)] bg-[#f3f4f6]">
      <div className="relative flex h-[70%] w-[70%] min-h-[4rem] min-w-0 items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/**
 * Cuerpo de ficha: padding alineado a `compositionSpacing.comprameLaFotoDirectory` (px-6, pt-5, pb-6).
 */
export function DirectoryCardContent({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center px-6 pb-6 pt-5 text-center">{children}</div>
  );
}
