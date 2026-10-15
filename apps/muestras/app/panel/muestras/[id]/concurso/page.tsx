import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatArDayLong } from "@repo/muestras";
import { CopiarImagenes } from "@/components/concursos/copiar-imagenes";
import { EnlaceAutor } from "@/components/concursos/enlace-autor";
import { enlace, nota, seccion } from "@/components/concursos/estilos";
import { ObraConcurso } from "@/components/concursos/obra-concurso";
import { ActualizarDesdeConcurso } from "@/components/concursos/panel-concurso";
import { panelDelConcurso } from "@/lib/concursos/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Del concurso" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ nueva?: string | string[] }> };

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Panel "Del concurso" (etapa 7): obras traídas de FotoRank, sus casillas, permisos, autores y actualizar. */
export default async function DelConcurso({ params, searchParams }: Props) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/muestras/${id}/concurso`);
  const p = await panelDelConcurso(id, usuario);
  if (!p) notFound();
  const recienArmada = (await searchParams).nueva === "1";
  const { muestra: m, concurso: c, resumen: r } = p;

  return (
    <main className="max-w-3xl space-y-8">
      <Link href={`/panel/muestras/${m.id}`} className={`text-sm ${enlace}`}>Volver a la muestra</Link>
      <header className="space-y-3">
        <p className={`${nota} break-words`}>{m.title}</p>
        <h1 className="mf-titulo break-words text-[clamp(2rem,4vw,3rem)]">Obras de {c.title} <span className="text-[var(--mf-muted)]">({c.organizationName})</span></h1>
        <p className={nota}>Última actualización desde FotoRank: {formatArDayLong(c.syncedAt)}.</p>
      </header>

      {recienArmada ? (
        <p role="status" className="rounded-[2px] border border-[var(--mf-line)] p-4 text-[15px]">
          Armamos el borrador de la muestra. Revisá fechas y sede: las pusimos provisorias.{" "}
          <Link href={`/panel/muestras/${m.id}`} className={enlace}>Completar la ficha</Link>
        </p>
      ) : null}
      {p.enRevision ? <p className={nota}>La muestra está en revisión: esperá a que se revise para cambiar sus obras.</p> : null}
      {!p.puedeCambiar ? <p className={nota}>Lo ves en modo lectura: las obras del concurso las maneja quien armó la muestra.</p> : null}

      {p.puedeCambiar && c.cambio ? (
        <section className="space-y-3 rounded-[2px] border border-[var(--mf-ink)] p-4">
          <p className="text-[17px]">
            {c.sinLote
              ? "Los resultados de este concurso ya no están cerrados en FotoRank. La muestra queda como está."
              : "Los resultados de FotoRank cambiaron desde que armaste la muestra."}
          </p>
          {!c.sinLote && p.editable ? <ActualizarDesdeConcurso activityId={m.id} tiers={c.tiers} destacado /> : null}
        </section>
      ) : null}

      {p.editable && (r.faltanImagenes || r.fallaron) ? (
        <CopiarImagenes activityId={m.id} total={r.total} faltan={r.faltanImagenes} fallaron={r.fallaron} />
      ) : null}

      <section aria-labelledby="t-obras" className={seccion}>
        <h2 id="t-obras" className="text-sm text-[var(--mf-muted)]">Obras</h2>
        <p className="text-[17px]">
          {plural(r.total, "obra", "obras")}: {r.enLaMuestra} en la muestra, {r.esperanAlAutor} {r.esperanAlAutor === 1 ? "espera" : "esperan"} al autor,{" "}
          {plural(r.sacadas, "sacada", "sacadas")}.
        </p>
        <p className={nota}>
          “Galería virtual”: la obra está en la muestra (lo que se ve online lo elegís en Visibilidad). “Se imprime”: va a fichas, marcos,
          plano y catálogo. “A la venta”: la venta llega más adelante; por ahora sólo le preguntamos al autor si está de acuerdo.
        </p>
        <ul className="border-t border-[var(--mf-line)]">
          {p.obras.map((o) => <ObraConcurso key={o.id} obra={o} editable={p.editable} />)}
        </ul>
      </section>

      {p.autores.length ? (
        <section aria-labelledby="t-autores" className={seccion}>
          <h2 id="t-autores" className="text-sm text-[var(--mf-muted)]">Autores</h2>
          <p className={nota}>
            Cada autor ve sus obras en “Dónde expongo” cuando entra con la misma cuenta de FotoRank. Mandale su enlace por WhatsApp o por
            mail: ahí acepta (o no) que se expongan y confirma cómo firma.
          </p>
          <ul className="border-t border-[var(--mf-line)]">
            {p.autores.map((a) => <EnlaceAutor key={a.id} autor={a} editable={p.puedeCambiar} />)}
          </ul>
        </section>
      ) : null}

      {p.editable && !c.cambio ? (
        <section aria-labelledby="t-actualizar" className={seccion}>
          <h2 id="t-actualizar" className="text-sm text-[var(--mf-muted)]">Actualizar desde FotoRank</h2>
          <p className={nota}>Suma las obras nuevas de los niveles elegidos y actualiza premios y orden. Nunca saca obras ni cambia sus títulos.</p>
          <ActualizarDesdeConcurso activityId={m.id} tiers={c.tiers} destacado={false} />
        </section>
      ) : null}
    </main>
  );
}
