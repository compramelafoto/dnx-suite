import Link from "next/link";
import { redirect } from "next/navigation";
import { FotorankDialogShell } from "../components/ui/FotorankDialogShell";
import { getAuthUser } from "../lib/auth";
import { safeNextPath } from "../lib/safe-next-path";
import { RegisterForm } from "./RegisterForm";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function CrearCuentaPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const user = await getAuthUser();
  if (user) redirect(next ?? "/participaciones");

  return (
    <FotorankDialogShell
      title="Crear cuenta DNX"
      subtitle="Una sola identidad para FotoRank y el resto de las plataformas DNX habilitadas."
      footerLinks={
        <>
          <Link href="/login" className="transition-colors hover:text-gold">
            Ya tengo cuenta
          </Link>
          <span className="hidden text-fr-border sm:inline" aria-hidden>
            ·
          </span>
          <Link href="/" className="transition-colors hover:text-gold">
            Volver al inicio
          </Link>
        </>
      }
    >
      <RegisterForm nextPath={next} />
    </FotorankDialogShell>
  );
}
