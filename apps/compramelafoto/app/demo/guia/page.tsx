import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guía de la demo",
  robots: { index: false, follow: false },
};

/**
 * Ventana aparte de la guía de las demos (para leerla en una segunda pantalla). El contenido lo
 * dibuja `CuadroGuia`, montado en el layout raíz, que reconoce esta ruta.
 */
export default function GuiaDeLaDemoPage() {
  return null;
}
