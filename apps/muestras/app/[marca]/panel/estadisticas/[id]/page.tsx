import Link from "next/link";
import { notFound } from "next/navigation";
import { dailySeries, perWorkTotals, statTotals } from "@repo/muestras";
import { GraficoDiario } from "@/components/estadisticas/grafico-diario";
import { estadisticasDeMuestra } from "@/lib/estadisticas/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estadísticas" };

/** Fecha desde la que las fichas imprimen el QR con conteo (día del deploy de la etapa 4). */
const DESDE_QR_CON_CONTEO = "octubre de 2026";

export default async function EstadisticasDeMuestra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/estadisticas/${id}`);
  const d = await estadisticasDeMuestra(id, usuario, new Date());
  if (!d) notFound();
  const { a, ventana, filas, totales, libro } = d;
  const t = statTotals(totales);
  const porObra = perWorkTotals(totales, a.works);
  const visitas = dailySeries(filas, ventana.from, ventana.to, (r) => r.metric === "VIEW");
  const escaneos = dailySeries(filas, ventana.from, ventana.to, (r) => r.metric === "SCAN" || r.metric === "GUESTBOOK_SCAN");
  const esMuestra = a.type === "MUESTRA";
  const fila = "flex justify-between gap-4 border-b border-[var(--mf-line)] py-2";
  return (
    <main className="max-w-3xl space-y-10">
      <Link href="/panel/estadisticas" className="text-sm text-[var(--mf-muted)] underline underline-offset-[6px]">Volver a Estadísticas</Link>
      <h1 className="mf-titulo text-[clamp(2rem,4vw,2.8rem)]">{a.title}</h1>
      <dl className="border-t border-[var(--mf-line)] text-[15px]">
        <div className={fila}><dt>Visitas a la página de la muestra</dt><dd>{t.activityViews}</dd></div>
        {esMuestra ? <>
          <div className={fila}><dt>Visitas a las obras (incluye las que llegan por QR)</dt><dd>{t.workViews}</dd></div>
          <div className={fila}><dt>Escaneos de las fichas de sala</dt><dd>{t.workScans}</dd></div>
          <div className={fila}><dt>Escaneos del cartel y del catálogo</dt><dd>{t.activityScans}</dd></div>
          <div className={fila}><dt>Escaneos del afiche del libro de visitas</dt><dd>{t.guestbookScans}</dd></div>
          <div className={fila}><dt>Comentarios publicados en el libro</dt><dd><Link href={`/panel/estadisticas/${a.id}/libro`} className="underline underline-offset-[6px]">{libro.comentarios}{libro.pendientes ? ` (+${libro.pendientes} para revisar)` : ""}</Link></dd></div>
        </> : null}
      </dl>
      <GraficoDiario titulo="Visitas por día" serie={visitas} />
      {esMuestra ? <GraficoDiario titulo="Escaneos de QR por día" serie={escaneos} /> : null}
      {esMuestra && a.works.length ? (
        <section aria-labelledby="t-obras" className="space-y-3">
          <h2 id="t-obras" className="mf-titulo text-[1.5rem]">Por obra</h2>
          <table className="w-full text-left text-[15px]">
            <thead><tr className="border-b border-[var(--mf-line)] text-sm text-[var(--mf-muted)]"><th className="py-2 font-normal">Obra</th><th className="py-2 text-right font-normal">Visitas</th><th className="py-2 text-right font-normal">Escaneos</th></tr></thead>
            <tbody>
              {porObra.works.map((w) => <tr key={w.id} className="border-b border-[var(--mf-line)]"><td className="py-2">{w.title}</td><td className="py-2 text-right">{w.views}</td><td className="py-2 text-right">{w.scans}</td></tr>)}
              {porObra.removed.views + porObra.removed.scans > 0 ? <tr className="text-[var(--mf-muted)]"><td className="py-2">Obras que ya no están en la muestra</td><td className="py-2 text-right">{porObra.removed.views}</td><td className="py-2 text-right">{porObra.removed.scans}</td></tr> : null}
            </tbody>
          </table>
          <p className="text-sm text-[var(--mf-muted)]">
            Las fichas impresas antes de {DESDE_QR_CON_CONTEO} llevan el QR directo a la obra: sus escaneos cuentan como visitas a la obra, no como escaneos. Si querés separarlos, volvé a imprimir las fichas desde Montaje e impresión.
          </p>
        </section>
      ) : null}
      <p className="text-sm text-[var(--mf-muted)]">
        Contamos sin guardar datos de quien visita: ni IP, ni cookies, ni cuentas. No cuentan tus propias visitas ni las de robots. Los números son por día, en hora argentina.
      </p>
    </main>
  );
}
