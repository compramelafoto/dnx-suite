import type { ReactNode } from "react";
import { MarcoDelPanel } from "./marco";

/**
 * El marco de todo el panel del fotógrafo.
 *
 * Es el **único**: las secciones del evento las deduce `MarcoDelPanel` de la dirección.
 * Antes el marco del evento dibujaba su propio menú además de éste, y adentro de un
 * evento se veían dos.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return <MarcoDelPanel>{children}</MarcoDelPanel>;
}
