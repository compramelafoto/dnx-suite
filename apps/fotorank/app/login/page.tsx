import { redirect } from "next/navigation";
import { PageContainer, PublicShell } from "../components/public-ui";
import { getAuthUser } from "../lib/auth";
import { resolvePostLoginPathForUser } from "../lib/fotorank/access/home-capabilities";
import { safeNextPath } from "../lib/safe-next-path";
import { LoginForm } from "./LoginForm";

type LoginPageProps = { searchParams: Promise<{ error?: string; next?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const user = await getAuthUser();
  if (user) {
    redirect(
      await resolvePostLoginPathForUser({
        userId: user.id,
        email: user.email,
        globalRole: user.globalRole,
        next,
      }),
    );
  }

  const oauthError = typeof sp.error === "string" && sp.error.trim() ? sp.error.trim() : null;
  const isParticipantReturn = Boolean(next?.includes("/inscripcion"));

  return (
    <PublicShell
      header={{ variant: "marketing", hasSession: false }}
      showFooter
    >
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
