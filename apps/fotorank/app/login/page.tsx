import { redirect } from "next/navigation";
import { getAuthUser } from "../lib/auth";
import { safeNextPath } from "../lib/safe-next-path";
import { LoginForm } from "./LoginForm";

type LoginPageProps = { searchParams: Promise<{ error?: string; next?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const user = await getAuthUser();
  if (user) redirect(next ?? "/dashboard");

  const oauthError = typeof sp.error === "string" && sp.error.trim() ? sp.error.trim() : null;
  const isParticipantReturn = Boolean(next?.includes("/inscripcion"));

  return (
    <LoginForm
      oauthError={oauthError}
      nextPath={next}
      contextualNotice={
        isParticipantReturn
          ? "Vas a continuar tu inscripción al concurso después de iniciar sesión."
          : undefined
      }
    />
  );
}
