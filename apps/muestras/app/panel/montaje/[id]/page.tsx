import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATALOG_SIZES, GUESTBOOK_POSTER_SIZES, POSTER_SIZES } from "@repo/muestras";
import { DescargarFichas } from "@/components/panel/descargar-fichas";
import { DescargarMarcos } from "@/components/montaje/descargar-marcos";
import { Descargas } from "@/components/montaje/descargas";
import { EditorMontaje } from "@/components/montaje/editor-montaje";
import { cantidad } from "@/lib/cantidad";
import { cargarMontaje } from "@/lib/montaje/consultas";
import { urlDePieza } from "@/lib/piezas/opciones";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Montaje e impresión" };

export default async function MontajeDeMuestra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/montaje/${id}`);
  const m = await cargarMontaje(id, usuario);
  if (!m) notFound();
  const publicada = m.reviewStatus === "APPROVED";
  const conObras = m.works.length > 0;
  const seccion = "space-y-3 border-t border-[var(--mf-line)] pt-6";
  const sinPublicar = <p className="text-[15px] text-[var(--mf-muted)]">Lleva un QR a la página de la muestra: se baja cuando la muestra está publicada.</p>;
  return (
    <main className="max-w-3xl space-y-10">
      <Link href="/panel/montaje" className="text-sm text-[var(--mf-muted)] underline underline-offset-[6px]">Volver a Montaje e impresión</Link>
      <h1 className="mf-titulo text-[clamp(2rem,4vw,2.8rem)]">{m.title}</h1>

      <section aria-labelledby="t-fichas" className={seccion}>
        <h2 id="t-fichas" className="mf-titulo text-[1.5rem]">Fichas de sala con QR</h2>
        {publicada ? <DescargarFichas id={m.id} obras={m.works} /> : sinPublicar}
      </section>

      <section aria-labelledby="t-marcos" className={seccion}>
        <h2 id="t-marcos" className="mf-titulo text-[1.5rem]">Marcos y remarcos</h2>
        {conObras ? <DescargarMarcos id={m.id} obras={m.works} /> : <p className="text-[15px] text-[var(--mf-muted)]">Cargá obras en la muestra para armar sus marcos.</p>}
      </section>

      <section aria-labelledby="t-cartel" className={seccion}>
        <h2 id="t-cartel" className="mf-titulo text-[1.5rem]">Cartel de sala</h2>
        <p className="text-[15px] text-[var(--mf-muted)]">
          {m.curatorialText
            ? "Título, organiza, curaduría, el texto curatorial, fechas, horarios, sede y un QR a la muestra. Si el texto es muy largo, el final se corta: probá una medida más grande."
            : <>Sale con el título, los datos y el QR. Para sumar el texto curatorial, escribilo en la <Link href={`/panel/muestras/${m.id}`} className="underline underline-offset-[6px]">ficha de la muestra</Link>.</>}
        </p>
        {publicada ? <Descargas opciones={Object.entries(POSTER_SIZES).map(([k, v]) => ({ etiqueta: v.label, href: urlDePieza(m.id, { pieza: "cartel", tamano: k as keyof typeof POSTER_SIZES }) }))} /> : sinPublicar}
      </section>

      <section aria-labelledby="t-catalogo" className={seccion}>
        <h2 id="t-catalogo" className="mf-titulo text-[1.5rem]">Catálogo</h2>
        <p className="text-[15px] text-[var(--mf-muted)]">Portada, texto curatorial, una página por obra con su ficha, índice de autores y un QR a la muestra.</p>
        {!publicada ? sinPublicar : conObras
          ? <Descargas opciones={Object.entries(CATALOG_SIZES).map(([k, v]) => ({ etiqueta: v.label, href: urlDePieza(m.id, { pieza: "catalogo", tamano: k as keyof typeof CATALOG_SIZES }) }))} />
          : <p className="text-[15px] text-[var(--mf-muted)]">Cargá obras en la muestra para armar el catálogo.</p>}
      </section>

      <section aria-labelledby="t-libro" className={seccion}>
        <h2 id="t-libro" className="mf-titulo text-[1.5rem]">Afiche del libro de visitas</h2>
        <p className="text-[15px] text-[var(--mf-muted)]">
          Quien recorre la sala escanea el afiche y deja su comentario. Los moderás en <Link href={`/panel/estadisticas/${m.id}/libro`} className="underline underline-offset-[6px]">Estadísticas</Link>.
        </p>
        {publicada ? <Descargas opciones={Object.entries(GUESTBOOK_POSTER_SIZES).map(([k, v]) => ({ etiqueta: v.label, href: urlDePieza(m.id, { pieza: "libro", tamano: k as keyof typeof GUESTBOOK_POSTER_SIZES }) }))} /> : sinPublicar}
      </section>

      <section aria-labelledby="t-plano" className={seccion}>
        <h2 id="t-plano" className="mf-titulo text-[1.5rem]">Plano y lista de montaje</h2>
        <p className="text-[15px] text-[var(--mf-muted)]">Cargá las paredes y qué obra va en cada una, en orden. Calculamos dónde va cada marco: centro a 150 cm del piso y el mismo espacio entre obras.</p>
        {m.droppedItems > 0 ? <p role="status" className="text-[15px] text-[var(--mf-alerta)]">Sacamos del plano {cantidad(m.droppedItems, "obra que ya no está", "obras que ya no están")} en la muestra.</p> : null}
        <EditorMontaje id={m.id} obras={m.works} planInicial={m.plan} />
      </section>
    </main>
  );
}
