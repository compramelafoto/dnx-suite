import { Suspense } from "react";
import CuantoCobroLoginClient from "@/components/cuantocobro/CuantoCobroLoginClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar sesión — ¿Cuánto Cobro?",
  description: "Accedé a ¿Cuánto Cobro? con tu cuenta de ComprameLaFoto.",
  robots: { index: false, follow: false },
};

export default function CuantoCobroLoginPage() {
  return (
    <Suspense
      fallback={
        <p className="container-custom py-16 text-center text-[var(--cc-color-muted)]">Cargando…</p>
      }
    >
      <CuantoCobroLoginClient />
    </Suspense>
  );
}
