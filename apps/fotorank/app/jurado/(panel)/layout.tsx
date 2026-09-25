import { getAuthUser } from "../../lib/auth";
import { requireJudgeAuth } from "../../lib/judge-auth";
import { FotorankShell } from "../../components/shell/FotorankShell";
import { MarcoDeLaCuenta } from "../../components/shell/MarcoDeLaCuenta";
import { menuDelJuradoSinCuenta } from "../../components/shell/menuDeLaCuenta";

/**
 * El área del jurado.
 *
 * Hasta el 2026-09-24 no tenía marco: cada pantalla era una hoja suelta con su
 * propio encabezado y su fila de botones —Perfil profesional, Invitaciones,
 * Cerrar sesión— repetida a mano. No había barra lateral y no se parecía al
 * resto del producto.
 *
 * Un jurado casi siempre es también fotógrafo con cuenta en el sitio, y puede
 * inscribirse en otro concurso. Por eso, si hay sesión del sitio, ve el mismo
 * menú que en cualquier otra pantalla —con "Mis participaciones" incluido— y
 * no uno aparte. Sólo quien entró con la clave de jurado, sin cuenta del sitio,
 * ve el menú reducido.
 *
 * El grupo `(panel)` existe para que este marco **no** alcance al login, al
 * registro ni a la recuperación de clave, que se ven sin sesión; tampoco al
 * visor, que ocupa la pantalla entera a propósito. Los paréntesis no cambian
 * las direcciones.
 */
export default async function JudgePanelLayout({ children }: { children: React.ReactNode }) {
  const judge = await requireJudgeAuth();
  const user = await getAuthUser();

  if (user) {
    return (
      <MarcoDeLaCuenta user={user} esJurado>
        {children}
      </MarcoDeLaCuenta>
    );
  }

  const nombre = judge.profile
    ? `${judge.profile.firstName} ${judge.profile.lastName}`.trim()
    : "";

  return (
    <FotorankShell
      sections={menuDelJuradoSinCuenta()}
      userDisplayName={nombre}
      userEmail={judge.email}
      settingsHref="/jurado/perfil"
      homeHref="/jurado/panel"
    >
      {children}
    </FotorankShell>
  );
}
