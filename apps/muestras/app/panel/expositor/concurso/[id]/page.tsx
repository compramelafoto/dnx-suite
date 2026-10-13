import type { Metadata } from "next";
import Link from "next/link";
import { dateRangeText } from "@repo/muestras";
import { enlace, nota } from "@/components/concursos/estilos";
import { FirmaDelAutor, ObraDelAutor } from "@/components/concursos/respuesta-autor";
import { miAutoriaEnMuestra } from "@/lib/concursos/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tus obras del concurso", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };

/**
 * La página del autor de obras traídas de un concurso (etapa 7, D19, D20). Exige sesión y que la
 * fila sea de esta cuenta: con otra cuenta no se ve ninguna imagen ni dato de las obras.
 */
export default async function MisObrasDelConcurso({ params }: Props) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/expositor/concurso/${id}`);
  const r = await miAutoriaEnMuestra(id, usuario);
  if (!r) {
    return (
      <main className="max-w-3xl space-y-6">
        <Link href="/panel/expositor" className={`text-sm ${enlace}`}>Dónde expongo</Link>
        <h1 className="mf-titulo text-[clamp(2rem,4vw,2.6rem)]">Este enlace es para otra cuenta</h1>
        <p className="text-lg">Entrá con la cuenta con la que participaste en el concurso.</p>
      </main>
    );
  }
  const m = r.muestra;
  const sede = m.isVirtualOnly ? "Sólo online" : m.venueName ? [m.venueName, m.city].filter(Boolean).join(", ") : "Sede a confirmar";
  const pideFirma = !r.firma?.trim();

  return (
    <main className="max-w-3xl space-y-10">
      <Link href="/panel/expositor" className={`text-sm ${enlace}`}>Dónde expongo</Link>
      <header className="space-y-3">
        <p className={nota}>Tus obras de {r.concurso}</p>
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">{m.title}</h1>
        <p className="text-[15px]">
          {dateRangeText(m.startsAt, m.endsAt)} · {sede} · Organiza: {m.organizersText}
          {m.isCancelled ? " · Cancelada" : ""}
        </p>
        <p className="text-lg leading-snug">
          {r.organizacion} armó una muestra con obras de {r.concurso} y quiere exponer las tuyas.
        </p>
        {m.slug ? <p><Link href={`/m/${m.slug}`} className={enlace}>Ver la muestra</Link></p> : null}
      </header>

      {r.obras.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">La organización sacó tus obras de esta muestra.</p>
      ) : (
        <ul className="border-t border-[var(--mf-line)]">
          {r.obras.map((o) => (
            <ObraDelAutor key={o.id} obra={o} cerrada={r.cerrada} pideFirma={pideFirma} firmaSugerida={r.perfil?.displayName ?? r.nombre} />
          ))}
        </ul>
      )}

      <FirmaDelAutor authorId={r.id} firma={r.firma} nombreSugerido={r.nombre} perfil={r.perfil} />
    </main>
  );
}
