import Link from "next/link";

/** Cuando un freno de la sala corta: el motivo y un camino, nunca una redirección muda. */
export function AvisoDeSala({ texto, volver }: { texto: string; volver: string }) {
  return (
    <main className="mf-marco max-w-2xl space-y-6 py-8 sm:py-12">
      <p role="status" className="text-lg">{texto}</p>
      <p><Link href={volver} className="underline underline-offset-[6px]">Ver la muestra</Link></p>
    </main>
  );
}
