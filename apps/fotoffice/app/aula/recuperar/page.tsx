// app/aula/recuperar/page.tsx
import type { Metadata } from "next";
import { RecuperarForm } from "./form";

export const metadata: Metadata = {
  title: "Recuperar mi aula",
  robots: { index: false, follow: false },
};

export default function RecuperarAulaPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="fo-card space-y-4 p-6">
        <h1 className="text-lg font-semibold">¿Perdiste el enlace de tu aula?</h1>
        <p className="text-sm text-[var(--fo-muted)]">
          Escribí el correo con el que compraste el curso y te mandamos uno nuevo.
        </p>
        <RecuperarForm />
      </div>
    </main>
  );
}
