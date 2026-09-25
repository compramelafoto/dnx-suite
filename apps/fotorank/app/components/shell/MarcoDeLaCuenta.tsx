import type { AuthUser } from "../../lib/auth";
import { perfilesDeLaCuenta } from "../../lib/fotorank/access/perfilesDeLaCuenta";
import { FotorankShell } from "./FotorankShell";
import { menuDeLaCuenta } from "./menuDeLaCuenta";

/**
 * El marco de las pantallas del fotógrafo, del jurado que entró con la cuenta
 * del sitio y del super admin.
 *
 * Recibe los roles de la persona y el marco elige el menú según la pantalla
 * (ver `rolDeLaRuta`). El organizador usa lo mismo a través de
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
  const menu = menuDeLaCuenta({ ...perfiles, esJurado: perfiles.esJurado || esJurado });

  return (
    <FotorankShell menu={menu} userDisplayName={user.name?.trim() ?? ""} userEmail={user.email}>
      {children}
    </FotorankShell>
  );
}
