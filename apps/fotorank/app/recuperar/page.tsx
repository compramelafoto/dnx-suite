import Link from "next/link";
import { FotorankDialogShell } from "../components/ui/FotorankDialogShell";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function RecuperarPage() {
  return (
    <FotorankDialogShell
      title="¿Olvidaste tu contraseña?"
      subtitle="Restablecé tu Cuenta DNX. La nueva contraseña vale en todas las plataformas DNX habilitadas."
      footerLinks={
        <Link href="/login" className="transition-colors hover:text-gold">
          Volver a iniciar sesión
        </Link>
      }
    >
      <ForgotPasswordForm />
    </FotorankDialogShell>
  );
}
