import Link from "next/link";
import { verifyEmailWithToken, DNX_AUTH_MESSAGES } from "@repo/auth";
import { FotorankDialogShell } from "../components/ui/FotorankDialogShell";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function VerificarEmailPage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = sp.token?.trim() ?? "";
  let message = "Falta el token de verificación.";
  let ok = false;

  if (token) {
    try {
      await verifyEmailWithToken({ rawToken: token });
      message = DNX_AUTH_MESSAGES.verifySuccess;
      ok = true;
    } catch (err) {
      message =
        err instanceof Error ? err.message : DNX_AUTH_MESSAGES.verifyInvalidToken;
    }
  }

  return (
    <FotorankDialogShell
      title="Verificación de email"
      subtitle={message}
      footerLinks={
        <Link href="/login" className="transition-colors hover:text-gold">
          Ir a iniciar sesión
        </Link>
      }
    >
      <p
        className={`text-center text-sm leading-relaxed ${ok ? "text-fr-muted" : "text-red-300"}`}
        role={ok ? "status" : "alert"}
      >
        {ok
          ? "Tu email quedó verificado en toda la Cuenta DNX."
          : "Si el enlace venció, creá la cuenta de nuevo o pedí un nuevo correo."}
      </p>
    </FotorankDialogShell>
  );
}
