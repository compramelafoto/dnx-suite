import type { ReactNode } from "react";
import type { Viewport } from "next";

/** Álbum público (preventa, etc.): viewport explícito para evitar zoom/ancho raro en móviles. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function AlbumLayout({ children }: { children: ReactNode }) {
  return children;
}
