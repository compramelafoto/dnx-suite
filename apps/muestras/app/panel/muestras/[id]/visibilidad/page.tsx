import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VISIBILITY_PRESET_LABELS, coverIsHiddenWork, visibilitySummary, visibleWorks } from "@repo/muestras";
import { FormularioVisibilidad } from "@/components/visibilidad/ajuste-visibilidad";
import { aviso, enlace, nota, seccion } from "@/components/visibilidad/estilos";
import { requireUsuario } from "@/lib/usuario";
import { cargarVisibilidad, sinSemilla } from "@/lib/visibilidad/consultas";
import { AVISO_FICHAS } from "@/lib/visibilidad/texto";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Visibilidad" };

type Props = { params: Promise<{ id: string }> };

export default async function VisibilidadDeMuestra({ params }: Props) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/muestras/${id}/visibilidad`);
  // Sin `visibility` (rol de textos, ajenos): no existe.
  const r = await cargarVisibilidad(id, usuario);
  if (!r) notFound();
  const { muestra: a, ajuste: v, tieneAjuste } = r;
  const ahora = new Date();
  const g = visibleWorks(a, a.works, ahora);
  const visibles = new Set(g.works.map((w) => w.id));
  const resumen = visibilitySummary(v);
  const portadaOculta = !g.perVisit && coverIsHiddenWork(a.coverImageUrl, a.works, visibles);
  const portadaEnAzar = !!g.perVisit && a.works.some((w) => w.imageUrl === a.coverImageUrl);
  const sortear = v.online.exhibited === "RANDOM" && v.online.rotation !== "PER_VISIT" && a.works.length > v.online.randomCount;

  return (
    <main className="max-w-3xl space-y-8">
      <Link href={`/panel/muestras/${a.id}`} className={`text-sm ${enlace}`}>Volver a la muestra</Link>
      <header className="space-y-3">
        <p className={nota}>{a.title}</p>
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Qué se ve de la muestra</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          La muestra se ve en la sala. Acá elegís qué se adelanta online y qué ve quien escanea el QR de una ficha.
        </p>
        <p className="text-[15px]">
          Ajuste actual: <strong>{VISIBILITY_PRESET_LABELS[v.preset]}</strong>
          {tieneAjuste ? "" : " (como hasta ahora: todavía no elegiste uno)"}.
        </p>
      </header>

      <FormularioVisibilidad activityId={a.id} inicial={sinSemilla(v)} sortear={sortear} />

      <section className={seccion} aria-labelledby="t-hoy">
        <h2 id="t-hoy" className="text-lg">Así se ve hoy</h2>
        <ul className="list-disc space-y-1 pl-5 text-[15px]">
          <li>{resumen.online}</li>
          <li>{resumen.profile}</li>
          <li>{resumen.room}</li>
          <li>{resumen.afterClose}</li>
        </ul>
        {a.works.length === 0 ? (
          <p className={nota}>La muestra todavía no tiene obras.</p>
        ) : g.perVisit ? (
          <p className="text-[15px]">
            Online se ven {g.perVisit.count} al azar de estas {g.perVisit.total}, distintas para cada visitante.
          </p>
        ) : null}
        {a.works.length ? (
          <ul className="border-t border-[var(--mf-line)]">
            {a.works.map((w) => (
              <li key={w.id} className="flex items-baseline justify-between gap-4 border-b border-[var(--mf-line)] py-2 text-[15px]">
                <span>{w.title} <span className={nota}>· {w.authorName}</span></span>
                <span className={nota}>{g.perVisit ? "Puede verse online" : visibles.has(w.id) ? "Se ve online" : "Se descubre en la sala"}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {portadaOculta || portadaEnAzar ? (
          <p role="status" className={aviso}>
            La portada de la muestra es una de las obras que reservás para la sala: se ve en el listado y al compartir el enlace. Cambiala en la ficha si querés que sea sorpresa.
          </p>
        ) : null}
        <p className={aviso}>{AVISO_FICHAS}</p>
        <p className="flex flex-wrap gap-x-5 text-[15px]">
          {a.reviewStatus === "APPROVED" ? <Link href={`/m/${a.slug}`} className={enlace}>Ver la publicación online</Link> : null}
          <Link href={`/m/${a.slug}/sala`} className={enlace}>Ver como en la sala</Link>
        </p>
      </section>
    </main>
  );
}
