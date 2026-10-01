import { requireAuth } from "../lib/auth";
import { MarcoDeLaCuenta } from "../components/shell/MarcoDeLaCuenta";

/**
 * El hub personal y la super administración.
 *
 * Usan el mismo marco y el mismo menú que el resto de la cuenta: hasta el
 * 2026-09-24 este layout dibujaba su propia barra, distinta de la del
 * organizador, y entrar a "Organizaciones" cambiaba el menú entero.
 */
export default async function HomeShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  return <MarcoDeLaCuenta user={user}>{children}</MarcoDeLaCuenta>;
}
