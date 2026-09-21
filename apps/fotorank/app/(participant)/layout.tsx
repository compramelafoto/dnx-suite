import { requireAuth } from "../lib/auth";
import { FotorankShell } from "../components/shell/FotorankShell";
import { SECCIONES_PARTICIPANTE } from "../components/shell/sections";

/**
 * Área de participante: solo exige sesión User.
 * No requiere AppAccess FOTORANK ni pertenencia a ContestOrganization
 * (a diferencia del panel organizador).
 *
 * Desde el 2026-09-21 usa el mismo armazón que el organizador y el jurado. Antes era un
 * encabezado con dos enlaces de texto y el correo al lado: sin menú, sin estado activo y
 * sin manera de cerrar sesión desde acá — siendo el área por la que pasa más gente.
 */
export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <FotorankShell
      sections={SECCIONES_PARTICIPANTE}
      userDisplayName={user.name ?? ""}
      userEmail={user.email}
      settingsHref="/cuenta"
      homeHref="/mi-actividad"
    >
      {children}
    </FotorankShell>
  );
}
