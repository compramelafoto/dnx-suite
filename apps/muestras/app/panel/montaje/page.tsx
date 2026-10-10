import Link from "next/link";
import { REVIEW_STATUS_LABELS, formatArDay, type ReviewStatus } from "@repo/muestras";
import { listarMuestrasParaMontaje } from "@/lib/actividades/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Montaje e impresión" };

export default async function Montaje() {
  const usuario = await requireUsuario("/panel/montaje");
  const muestras = await listarMuestrasParaMontaje(usuario.id);
  return (
    <main className="max-w-3xl space-y-10">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Montaje e impresión</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Todo lo que va a la sala, listo para imprimir: fichas con QR, marcos con título y autor, el cartel con el texto curatorial, el catálogo, el afiche del libro de visitas y el plano de montaje.
        </p>
      </header>
      {muestras.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">
          Cuando cargues una muestra, acá vas a preparar su montaje. <Link href="/panel/proponer" className="underline underline-offset-[6px]">Proponer una muestra</Link>
        </p>
      ) : (
        <ul className="border-t border-[var(--mf-line)]">
          {muestras.map((m) => (
            <li key={m.id} className="border-b border-[var(--mf-line)] py-5">
              <h2 className="mf-titulo text-[1.6rem]"><Link href={`/panel/montaje/${m.id}`} className="underline-offset-[5px] hover:underline">{m.title}</Link></h2>
              <p className="text-sm text-[var(--mf-muted)]">
                {formatArDay(m.startsAt)} al {formatArDay(m.endsAt)} · {m._count.works} obras · {REVIEW_STATUS_LABELS[m.reviewStatus as ReviewStatus] ?? m.reviewStatus}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
