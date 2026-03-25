import Link from "next/link";
import { Suspense } from "react";
import { FotorankDialogShell } from "../../components/ui/FotorankDialogShell";
import { JudgeRegisterForm } from "./JudgeRegisterForm";

export default function JudgeRegisterPage() {
  return (
    <FotorankDialogShell
      title="Registro de jurado"
      subtitle="Completá tus datos para aceptar la invitación y acceder al panel de evaluación."
      maxWidthClassName="max-w-lg"
      footerLinks={
        <>
          <Link href="/" className="transition-colors hover:text-gold">
            Volver al inicio
          </Link>
          <span className="hidden text-fr-border sm:inline" aria-hidden>
            ·
          </span>
          <Link href="/jurado/login" className="transition-colors hover:text-gold">
            Ya tengo cuenta
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="fr-caption text-center">Cargando formulario...</div>}>
        <JudgeRegisterForm />
      </Suspense>
    </FotorankDialogShell>
  );
}
