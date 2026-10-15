import { requireCashViewer } from "@/lib/cash/access";

/**
 * El guardia de la sección entera.
 *
 * Vive en el layout para que ninguna pantalla nueva del módulo pueda nacer sin control por
 * olvido. Cada pantalla y cada acción vuelve a pedir lo suyo (operar o configurar donde corresponde): son
 * verificaciones que se suman, no que se reemplazan.
 */
export default async function CajaLayout({ children }: { children: React.ReactNode }) {
  await requireCashViewer();
  return <>{children}</>;
}
