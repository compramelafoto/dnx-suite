import type { Metadata } from "next";
import Link from "next/link";

import { FotorankDialogShell } from "../../components/ui/FotorankDialogShell";
import { PedirEnlaceForm } from "./PedirEnlaceForm";

export const metadata: Metadata = {
  title: "Recuperar tu contraseña de jurado — FotoRank",
};

export default function RecuperarClaveDeJuradoPage() {
  return (
    <FotorankDialogShell
      title="Recuperar tu contraseña"
      subtitle="Te mandamos un enlace para elegir una nueva. Vence a las 2 horas."
      footerLinks={
        <>
          <Link href="/jurado/login" className="transition-colors hover:text-gold">
            Volver al acceso
          </Link>
          <span className="hidden text-fr-border sm:inline" aria-hidden>
            ·
          </span>
          {/*
            La cuenta de jurado es distinta de la del sitio: quien se equivocó
            de puerta se va con las manos vacías si no le decimos cuál es la otra.
          */}
          <Link href="/recuperar" className="transition-colors hover:text-gold">
            No soy jurado
          </Link>
        </>
      }
    >
      <PedirEnlaceForm />
    </FotorankDialogShell>
  );
}
