import { requireSalesStaff } from "@/lib/sales/access";

/**
 * El guardia de la sección entera.
 *
 * Vive en el layout para que ninguna pantalla nueva del módulo pueda nacer sin control por
 * olvido. Cada pantalla vuelve a pedir lo suyo: son verificaciones que se suman.
 */
export default async function VentasLayout({ children }: { children: React.ReactNode }) {
  await requireSalesStaff();
  return <>{children}</>;
}
