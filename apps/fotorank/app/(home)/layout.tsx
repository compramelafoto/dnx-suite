import { requireAuth } from "../lib/auth";
import { resolveHomeCapabilities } from "../lib/fotorank/access/home-capabilities";
import { FotorankShell } from "../components/shell/FotorankShell";
import { seccionesDelHub } from "../components/shell/hub-sections";

/**
 * Shell del hub personal unificado (ETAPA 09B).
 * Cambio de contexto solo desde el menú lateral — nunca antes del login.
 *
 * Desde el 2026-09-21 usa el armazón común del panel. Antes tenía su propia barra lateral
 * —la tercera del producto, escrita a mano— sin estado activo, sin íconos y con su propio
 * botón de salir. Lo único que este hub hacía mejor que las demás áreas era decidir su menú
 * según lo que la cuenta puede hacer de verdad; eso se conserva, ahora en `seccionesDelHub`
 * y con test.
 */
export default async function HomeShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const caps = await resolveHomeCapabilities({
    userId: user.id,
    email: user.email,
    globalRole: user.globalRole,
  });

  return (
    <FotorankShell
      sections={seccionesDelHub(caps)}
      userDisplayName={user.name?.trim() ?? ""}
      userEmail={user.email}
      homeHref="/mi-actividad"
    >
      {children}
    </FotorankShell>
  );
}
