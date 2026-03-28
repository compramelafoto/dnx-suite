import Link from "next/link";
import { redirect } from "next/navigation";
import { FotorankDialogShell } from "../components/ui/FotorankDialogShell";
import { getAuthUser } from "../lib/auth";
import { LoginForm } from "./LoginForm";

type LoginPageProps = { searchParams: Promise<{ error?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getAuthUser();
  if (user) redirect("/dashboard");

  const sp = await searchParams;
  const oauthError = typeof sp.error === "string" && sp.error.trim() ? sp.error.trim() : null;

  return (
    <FotorankDialogShell
      title="Iniciar sesión"
      subtitle="Accedé como organizador para crear concursos, jurados y resultados en FotoRank."
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
      <LoginForm oauthError={oauthError} />
    </FotorankDialogShell>
  );
}
