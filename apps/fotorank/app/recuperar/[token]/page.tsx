import Link from "next/link";
import { FotorankDialogShell } from "../../components/ui/FotorankDialogShell";
import { ResetPasswordForm } from "./ResetPasswordForm";

type Props = { params: Promise<{ token: string }> };

export default async function ResetPasswordPage({ params }: Props) {
  const { token } = await params;
  return (
    <FotorankDialogShell
      title="Nueva contraseña"
      subtitle="Elegí una contraseña nueva para tu Cuenta DNX."
      footerLinks={
        <Link href="/login" className="transition-colors hover:text-gold">
          Volver a iniciar sesión
        </Link>
      }
    >
      <ResetPasswordForm token={token} />
    </FotorankDialogShell>
  );
}
