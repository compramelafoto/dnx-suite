import { requireBookingsStaff } from "@/lib/bookings/access";

/**
 * El guardia de la sección entera.
 *
 * Vive en el layout para que ninguna pantalla nueva del módulo pueda nacer sin control de
 * acceso por olvido. Cada pantalla vuelve a pedir lo suyo (ADMIN+ donde corresponde): son
 * verificaciones que se suman, no que se reemplazan.
 */
export default async function ReservasLayout({ children }: { children: React.ReactNode }) {
  await requireBookingsStaff();
  return <>{children}</>;
}
