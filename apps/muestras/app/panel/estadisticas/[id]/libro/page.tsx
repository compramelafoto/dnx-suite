import Link from "next/link";
import { notFound } from "next/navigation";
import { guestbookState } from "@repo/muestras";
import { ModerarLibro } from "@/components/libro/moderar-libro";
import { libroParaModerar } from "@/lib/libro/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Libro de visitas" };

export default async function Moderar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/estadisticas/${id}/libro`);
  const a = await libroParaModerar(id, usuario);
  if (!a) notFound();
  const estado = guestbookState(a, new Date());
  return (
    <main className="max-w-3xl space-y-8">
      <Link href={`/panel/estadisticas/${a.id}`} className="text-sm text-[var(--mf-muted)] underline underline-offset-[6px]">Volver a las estadísticas</Link>
      <header className="space-y-2">
        <p className="text-sm text-[var(--mf-muted)]">Libro de visitas</p>
        <h1 className="mf-titulo text-[clamp(2rem,4vw,2.8rem)]">{a.title}</h1>
        {estado === "OPEN" ? <p className="text-[15px]">Recibe comentarios en <Link href={`/m/${a.slug}/libro`} className="underline underline-offset-[6px]">la página del libro</Link>. El afiche con el QR está en <Link href={`/panel/montaje/${a.id}`} className="underline underline-offset-[6px]">Montaje e impresión</Link>.</p> : null}
        {estado === "ENDED" ? <p className="text-[15px] text-[var(--mf-muted)]">El libro ya no recibe comentarios (cerró 15 días después del final de la muestra).</p> : null}
        {estado === "UNAVAILABLE" ? <p className="text-[15px] text-[var(--mf-muted)]">El libro empieza a recibir comentarios cuando la muestra está publicada.</p> : null}
      </header>
      <ModerarLibro id={a.id} modo={a.guestbookMode} entradas={a.guestbookEntries} />
    </main>
  );
}
