import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { PageContainer, PublicShell } from "../components/public-ui";
import { getAuthUser } from "../lib/auth";
import { classifyFailure, resolvePostLoginPathForUser } from "../lib/fotorank/access/home-capabilities";
import { safeNextPath } from "../lib/safe-next-path";
import { LoginForm } from "./LoginForm";

type LoginPageProps = { searchParams: Promise<{ error?: string; next?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const user = await getAuthUser();
  if (user) {
    // Ya hay sesión válida. Los rechazos de las 3 consultas de capacidades
    // ya se resuelven fail-closed dentro de `resolveHomeCapabilities`; este
    // try/catch cubre lo que quede fuera de eso.
    let dest: string;
    try {
      dest = await resolvePostLoginPathForUser({
        userId: user.id,
        email: user.email,
        globalRole: user.globalRole,
        next,
      });
    } catch (err) {
      const incidentId = randomUUID();
      const { category, code } = classifyFailure(err);
      console.error("FOTORANK_LOGIN_REVISIT_FAILURE", { incidentId, category, code });
      redirect(`/cuenta/no-disponible?incident=${incidentId}`);
    }
    redirect(dest);
  }

  const oauthError = typeof sp.error === "string" && sp.error.trim() ? sp.error.trim() : null;
  const isParticipantReturn = Boolean(next?.includes("/inscripcion"));

  // Envoltorio public-ui recuperado de 7c7d4278. Ese commit también revertía el
  // manejo de errores de arriba (es anterior a ad7323d1): se conserva el actual.
  return (
    <PublicShell header={{ variant: "marketing", hasSession: false }} showFooter>
      <PageContainer width="narrow" className="py-12 md:py-16">
        <LoginForm
          oauthError={oauthError}
          nextPath={next}
          contextualNotice={
            isParticipantReturn
              ? "Vas a continuar tu inscripción al concurso después de iniciar sesión."
              : undefined
          }
        />
      </PageContainer>
    </PublicShell>
  );
}
