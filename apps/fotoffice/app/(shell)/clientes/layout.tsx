import { requireClientsStaff } from "@/lib/clients/access";

/**
 * El guardia de la sección entera.
 *
 * Vive en el layout para que ninguna pantalla nueva del módulo pueda nacer sin control por
 * olvido. Cada pantalla vuelve a pedir lo suyo: son verificaciones que se suman.
 */
export default async function ClientesLayout({ children }: { children: React.ReactNode }) {
  await requireClientsStaff();
  return <>{children}</>;
}
