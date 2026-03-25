import Link from "next/link";
import { FotorankDialogShell } from "../../components/ui/FotorankDialogShell";
import { JudgeLoginForm } from "./JudgeLoginForm";

export default function JudgeLoginPage() {
  return (
    <FotorankDialogShell
      title="Acceso jurado"
      subtitle="Ingresá con el email y la contraseña de tu cuenta de jurado."
      footerLinks={
        <>
          <Link href="/" className="transition-colors hover:text-gold">
            Volver al inicio
          </Link>
          <span className="hidden text-fr-border sm:inline" aria-hidden>
            ·
          </span>
          <Link href="/login" className="transition-colors hover:text-gold">
            Soy organizador
          </Link>
        </>
      }
    >
      <JudgeLoginForm />
    </FotorankDialogShell>
  );
}
