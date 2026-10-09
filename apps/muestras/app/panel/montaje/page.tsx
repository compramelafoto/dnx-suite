import Link from "next/link";
import { formatArDay } from "@repo/muestras";
import { DescargarFichas } from "@/components/panel/descargar-fichas";
import { listarPublicadasMias } from "@/lib/actividades/consultas";
import { MONTAJE_EN_PREPARACION } from "@/lib/panel/en-preparacion";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Montaje e impresión" };

export default async function Montaje() {
  const usuario = await requireUsuario("/panel/montaje");
  const muestras = await listarPublicadasMias(usuario.id);
  return (
    <main className="max-w-3xl space-y-12">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Montaje e impresión</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Fichas de sala con código QR, listas para imprimir: título, autor, año y técnica de cada obra. El QR lleva a la página de la obra.
        </p>
      </header>
      {muestras.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">
          Cuando tengas una muestra publicada, acá vas a poder bajar sus fichas. <Link href="/panel/proponer" className="underline underline-offset-[6px]">Proponer una muestra</Link>
        </p>
      ) : (
        <ul className="border-t border-[var(--mf-line)]">
          {muestras.map((m) => (
            <li key={m.id} className="space-y-3 border-b border-[var(--mf-line)] py-6">
              <div>
                <h2 className="mf-titulo text-[1.6rem]"><Link href={`/panel/muestras/${m.id}`} className="underline-offset-[5px] hover:underline">{m.title}</Link></h2>
                <p className="text-sm text-[var(--mf-muted)]">{formatArDay(m.startsAt)} al {formatArDay(m.endsAt)}</p>
              </div>
              <DescargarFichas id={m.id} obras={m.works} />
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby="t-proximo" className="space-y-3">
        <h2 id="t-proximo" className="text-sm text-[var(--mf-muted)]">También en preparación</h2>
        <ul className="border-t border-[var(--mf-line)]">
          {MONTAJE_EN_PREPARACION.map((p) => <li key={p} className="border-b border-[var(--mf-line)] py-3 text-[15px]">{p}</li>)}
        </ul>
      </section>
    </main>
  );
}
