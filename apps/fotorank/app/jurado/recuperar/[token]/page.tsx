import type { Metadata } from "next";
import Link from "next/link";

import { FotorankDialogShell } from "../../../components/ui/FotorankDialogShell";
import { NuevaClaveForm } from "./NuevaClaveForm";

export const metadata: Metadata = {
  title: "Elegí tu contraseña nueva — FotoRank",
  // Un enlace de este tipo no tiene por qué llegar a un buscador.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * El enlace no se valida acá.
 *
 * Mostrar el formulario aunque el enlace esté vencido es a propósito: si esta
 * página dijera "este enlace no sirve" antes de que nadie escriba nada,
 * cualquiera podría ir probando enlaces y saber cuáles están vivos. El
 * resultado se conoce recién al enviar.
 */
export default async function NuevaClaveDeJuradoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <FotorankDialogShell
      title="Elegí tu contraseña nueva"
      subtitle="Al guardarla cerramos las sesiones abiertas en otros aparatos y entrás con la nueva."
      footerLinks={
        <Link href="/jurado/login" className="transition-colors hover:text-gold">
          Volver al acceso
        </Link>
      }
    >
      <NuevaClaveForm token={token} />
    </FotorankDialogShell>
  );
}
