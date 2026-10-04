import { requireAuth } from "../lib/auth";
import { MarcoDeLaCuenta } from "../components/shell/MarcoDeLaCuenta";

/**
 * Área de participante: sólo exige sesión del sitio.
 *
 * No requiere AppAccess FOTORANK ni pertenencia a una organización (a
 * diferencia del panel organizador). Hasta el 2026-09-24 tenía un encabezado
 * con tres enlaces sueltos; ahora comparte el marco y el menú de la cuenta.
 */
export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  return <MarcoDeLaCuenta user={user}>{children}</MarcoDeLaCuenta>;
}
