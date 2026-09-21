import type { Metadata } from "next";

import { PostulacionForm } from "./PostulacionForm";

export const metadata: Metadata = {
  title: "Postularte como jurado — FotoRank",
  description:
    "Presentá tu ficha para que los organizadores de concursos de FotoRank puedan convocarte como jurado.",
};

export default function PostulacionDeJuradoPage() {
  return (
    <div className="min-h-screen bg-fr-bg px-4 py-10 text-fr-primary md:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <h1 className="font-sans text-3xl font-semibold tracking-tight">Postularte como jurado</h1>
          <p className="text-sm text-fr-muted">
            Contanos quién sos y qué hacés. Si aprobamos tu ficha, los organizadores de concursos
            van a poder encontrarte y proponerte que integres su jurado.
          </p>
        </header>

        <PostulacionForm />
      </div>
    </div>
  );
}
