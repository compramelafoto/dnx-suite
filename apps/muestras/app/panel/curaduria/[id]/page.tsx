import Link from "next/link";
import { notFound } from "next/navigation";
import { VisorCuraduria } from "@/components/curaduria/visor-curaduria";
import { colaDelCurador } from "@/lib/curaduria/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Curaduría" };

type Props = { params: Promise<{ id: string }> };

/** Sólo curadores activos, con la curaduría empezada. Cualquier otra cosa: 404. */
export default async function CurarConvocatoria({ params }: Props) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/curaduria/${encodeURIComponent(id)}`);
  const cola = await colaDelCurador(id, usuario.id);
  if (!cola) notFound();
  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-[var(--mf-muted)]"><Link href="/panel/curaduria" className="underline underline-offset-4">Curaduría</Link></p>
        <h1 className="mf-titulo text-[clamp(1.8rem,3vw,2.4rem)]">{cola.call.title}</h1>
        <p className="max-w-3xl text-[15px] leading-snug text-[var(--mf-muted)]">
          Estas obras se van a imprimir y colgar en una muestra presencial: puntualas pensando en cómo se verían en la sala.
          No ves quién las mandó, y cada curador las recorre en un orden distinto.
        </p>
        <details className="max-w-3xl text-[15px]">
          <summary className="cursor-pointer text-[var(--mf-muted)]">Las bases</summary>
          <div className="mt-2 whitespace-pre-line">{cola.call.basesText}</div>
        </details>
      </header>
      <VisorCuraduria obras={cola.obras} soloLectura={cola.call.status !== "CURATING"} />
    </main>
  );
}
