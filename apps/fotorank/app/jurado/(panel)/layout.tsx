import { judgeLogoutAction } from "../../actions/judges";
import { requireJudgeAuth } from "../../lib/judge-auth";
import { FotorankShell } from "../../components/shell/FotorankShell";
import { SECCIONES_JURADO } from "../../components/shell/sections";

/**
 * El área del jurado.
 *
 * Hasta el 2026-09-21 no tenía marco: cada pantalla era un `min-h-screen` con su propio
 * encabezado y su fila de botones —Perfil profesional, Invitaciones, Cerrar sesión—
 * repetida a mano. Quien evaluaba no tenía menú ni sabía dónde estaba parado.
 *
 * El grupo `(panel)` existe para que este marco **no** alcance a `/jurado/login`,
 * `/jurado/register` ni `/jurado/registro`, que se ven sin sesión. Los paréntesis no
 * aparecen en la dirección: las direcciones de las pantallas no cambiaron.
 *
 * El jurado tiene su propia sesión, distinta de la del resto del sitio, así que el armazón
 * recibe su acción de salida.
 */
export default async function JudgePanelLayout({ children }: { children: React.ReactNode }) {
  const judge = await requireJudgeAuth();
  const nombre = judge.profile
    ? `${judge.profile.firstName} ${judge.profile.lastName}`.trim()
    : "";

  return (
    <FotorankShell
      sections={SECCIONES_JURADO}
      userDisplayName={nombre}
      userEmail={judge.email}
      settingsHref="/jurado/perfil"
      homeHref="/jurado/panel"
      logoutAction={judgeLogoutAction}
    >
      {children}
    </FotorankShell>
  );
}
