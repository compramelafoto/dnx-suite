import type { Metadata } from "next";
import { requireFotofficePanelUser } from "@/lib/shell/require-fotoffice-access";

/**
 * Armazón de la vista previa de las plantillas del sitio: la página sola, sin el menú ni la
 * cabecera del panel. Tiene grupo de ruta propio (la URL sigue siendo `/website/plantillas/…`)
 * porque el selector la muestra en miniatura dentro de un iframe, y ahí el armazón del panel se
 * vería encima de la plantilla. Mismo criterio que `(editor)`: pide sesión del panel igual.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function VistaPlantillaLayout({ children }: { children: React.ReactNode }) {
  await requireFotofficePanelUser();
  return <>{children}</>;
}
