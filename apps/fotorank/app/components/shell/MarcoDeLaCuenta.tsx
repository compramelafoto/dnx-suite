import type { AuthUser } from "../../lib/auth";
import { perfilesDeLaCuenta } from "../../lib/fotorank/access/perfilesDeLaCuenta";
import { FotorankShell } from "./FotorankShell";
import { menuDeLaCuenta } from "./menuDeLaCuenta";

/**
 * El marco de las áreas que no tienen contexto propio: el hub personal, el
 * participante, el super admin y el jurado que entró con la cuenta del sitio.
 *
 * Todas muestran el mismo menú —el de la cuenta— para que moverse entre ellas
 * no cambie la barra lateral. El organizador usa el mismo menú a través de
 * `DashboardLayout`, que además pone arriba la organización activa.
 */
export async function MarcoDeLaCuenta({
  user,
  esJurado = false,
  children,
}: {
  user: AuthUser;
  /**
   * El área del jurado lo fuerza: quien ya está adentro del panel de jurado lo
   * es, aunque su sesión de jurado sea de otro correo que la del sitio.
   */
  esJurado?: boolean;
  children: React.ReactNode;
}) {
  const perfiles = await perfilesDeLaCuenta(user);
  const sections = menuDeLaCuenta({ ...perfiles, esJurado: perfiles.esJurado || esJurado });

  return (
    <FotorankShell
      sections={sections}
      userDisplayName={user.name?.trim() ?? ""}
      userEmail={user.email}
      homeHref="/mi-actividad"
    >
      {children}
    </FotorankShell>
  );
}
