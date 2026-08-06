import { requireAuth } from "../lib/auth";
import { PublicShell } from "../components/public-ui";

/**
 * Área de participante: solo exige sesión User.
 * No requiere AppAccess FOTORANK ni pertenencia a ContestOrganization
 * (a diferencia del panel organizador).
 */
export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <PublicShell
      showFooter
      header={{
        variant: "participant",
        hasSession: true,
        userEmail: user.email,
        panelHref: "/participaciones",
      }}
      mainClassName="fr-public-container py-10 md:py-14"
    >
      {children}
    </PublicShell>
  );
}
