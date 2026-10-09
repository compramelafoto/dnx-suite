import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { selectionRoom } from "@repo/muestras";
import { TablaSeleccion } from "@/components/seleccion/tabla-seleccion";
import { buscarConvocatoriaDelOrganizador } from "@/lib/convocatorias/consultas";
import { avanceDelEquipo, elegidasFueraDeLaGaleria, rankingDeLaConvocatoria } from "@/lib/seleccion/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Selección" };

type Props = { params: Promise<{ id: string }> };

export default async function Seleccion({ params }: Props) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/convocatorias/${id}/seleccion`);
  const c = await buscarConvocatoriaDelOrganizador(id, usuario);
  if (!c) notFound();
  if (c.status !== "CURATING" && c.status !== "DONE") redirect(`/panel/convocatorias/${id}`);
  const [filas, equipo, faltanEnGaleria] = await Promise.all([
    rankingDeLaConvocatoria(id, c.status),
    avanceDelEquipo(id),
    c.assembledAt != null ? elegidasFueraDeLaGaleria(id, c.activity.id) : Promise.resolve(0),
  ]);
  const elegidas = filas.filter((f) => f.decision === "SELECTED").length;

  return (
    <main className="space-y-10">
      <header className="max-w-3xl space-y-3">
        <p className="text-sm text-[var(--mf-muted)]"><Link href={`/panel/convocatorias/${id}`} className="underline underline-offset-4">{c.title}</Link></p>
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">{c.status === "CURATING" ? "Ranking y selección" : "Selección"}</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          {c.status === "CURATING"
            ? "Promedio de los puntajes del equipo. Elegí las obras de la muestra; los nombres aparecen al cerrar la curaduría."
            : "La curaduría está cerrada. Con las elegidas armás la galería de la muestra."}
        </p>
      </header>

      <section aria-labelledby="t-equipo" className="max-w-3xl space-y-3">
        <h2 id="t-equipo" className="text-sm text-[var(--mf-muted)]">Avance del equipo</h2>
        <ul className="border-t border-[var(--mf-line)]">
          {equipo.map((k) => (
            <li key={k.id} className="flex justify-between border-b border-[var(--mf-line)] py-2 text-[15px]">
              <span>{k.email}</span><span className="tabular-nums">{k.puntuadas} de {k.total}</span>
            </li>
          ))}
        </ul>
      </section>

      <TablaSeleccion
        callId={id}
        estado={c.status}
        filas={filas}
        lugar={selectionRoom(c.activity._count.works, elegidas)}
        // Ya armada, salvo que falte en la galería alguna elegida (p. ej. se borró en el editor):
        // entonces se puede volver a armar y se copian sólo las que faltan.
        yaArmada={c.assembledAt != null && faltanEnGaleria === 0}
        muestraId={c.activity.id}
        porAgregar={c.assembledAt != null ? faltanEnGaleria : undefined}
      />
    </main>
  );
}
