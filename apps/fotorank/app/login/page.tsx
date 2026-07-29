import Link from "next/link";
import { redirect } from "next/navigation";
import { FotorankDialogShell } from "../components/ui/FotorankDialogShell";
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
    <FotorankDialogShell
      title="Iniciar sesión"
      subtitle={
        isParticipantReturn
          ? "Iniciá sesión para continuar tu inscripción al concurso."
          : "Accedé a FotoRank para organizar concursos o participar."
      }
      footerLinks={
        <>
          <Link href="/" className="transition-colors hover:text-gold">
            Volver al inicio
          </Link>
          <span className="hidden text-fr-border sm:inline" aria-hidden>
            ·
          </span>
          <Link href="/jurado/login" className="transition-colors hover:text-gold">
            Acceso jurados
          </Link>
        </>
      }
    >
      <LoginForm oauthError={oauthError} nextPath={next} />
    </FotorankDialogShell>
  );
}
