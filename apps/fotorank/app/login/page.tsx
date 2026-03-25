import Link from "next/link";
import { redirect } from "next/navigation";
import { FotorankDialogShell } from "../components/ui/FotorankDialogShell";
import { getAuthUser } from "../lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getAuthUser();
  if (user) redirect("/dashboard");

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
      <LoginForm />
    </FotorankDialogShell>
  );
}
