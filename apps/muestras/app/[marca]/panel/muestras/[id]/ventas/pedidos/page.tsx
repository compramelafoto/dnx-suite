import Link from "next/link";
import { notFound } from "next/navigation";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@repo/muestras";
import { alerta, enlace, nota, seccion } from "@/components/ventas/estilos";
import { BorrarPruebas, EmitirPA } from "@/components/ventas/pedidos-panel";
import { TarjetaPedido } from "@/components/ventas/tarjeta-pedido";
import { pedidosDeLaMuestra } from "@/lib/ventas/pedidos-consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos de la muestra" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ estado?: string }> };

/** Los pedidos de una muestra (etapa 8): producción de las impresas, piezas, P/A y devoluciones. */
export default async function PedidosDeLaMuestra({ params, searchParams }: Props) {
  const { id } = await params;
  const { estado } = await searchParams;
  const usuario = await requireUsuario(`/panel/muestras/${id}/ventas/pedidos`);
  const d = await pedidosDeLaMuestra(id, usuario, estado ?? null);
  if (!d) notFound();
  const filtro = (valor: string | null, texto: string) => (
    <Link
      key={valor ?? "todos"}
      href={valor ? `?estado=${valor}` : "?"}
      className={`${enlace} ${(estado ?? null) === valor ? "font-medium" : "text-[var(--mf-muted)]"}`}
    >
      {texto}
    </Link>
  );
  const conPA = d.pruebasDeAutor.filter((o) => o.emitidas.length < o.proofCount || o.emitidas.length > 0);
  return (
    <main className="max-w-3xl space-y-8">
      <Link href={`/panel/muestras/${d.actividad.id}/ventas`} className="text-sm text-[var(--mf-accent)] underline underline-offset-4">Volver a Ventas</Link>
      <header className="space-y-2">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Pedidos</h1>
        <p className="text-lg text-[var(--mf-muted)]">{d.actividad.title}</p>
      </header>
      {d.atencion ? (
        <p className={alerta}>
          {d.atencion === 1 ? "Un pedido pide atención" : `${d.atencion} pedidos piden atención`}: cobrados sin copia, arrepentimientos o devoluciones pedidas. {filtro("ALERTAS", "Verlos")}
        </p>
      ) : null}
      <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Filtrar por estado">
        {filtro(null, "Todos")}
        {ORDER_STATUSES.map((s) => filtro(s, ORDER_STATUS_LABELS[s]))}
        {filtro("ALERTAS", "Piden atención")}
      </nav>
      {d.pedidos.length === 0 ? <p className={nota}>No hay pedidos{estado ? " con ese estado" : ""}.</p> : (
        <ul className="border-t border-[var(--mf-line)]">
          {d.pedidos.map((p) => <TarjetaPedido key={p.id} p={p} esDueno={d.esDueno} esSuperAdmin={d.esSuperAdmin} />)}
        </ul>
      )}

      {conPA.length ? (
        <section className={seccion}>
          <h2 className="mf-titulo text-2xl">Pruebas de autor (P/A)</h2>
          <ul className="space-y-3 text-[15px]">
            {conPA.map((o) => (
              <li key={o.id} className="space-y-1">
                <p>{o.obra} · {o.format === "PRINT" ? "impresa" : "digital"} · {o.emitidas.length} de {o.proofCount} emitidas</p>
                <div className="flex flex-wrap gap-3">
                  {o.emitidas.filter((c) => c.certificateCode).map((c) => (
                    <span key={c.id} className="space-x-2">
                      <span>P/A {c.number}/{o.proofCount}{c.isTest ? " (prueba)" : ""}:</span>
                      <a href={`/api/ventas/certificado/pa?copia=${c.id}`} className={enlace}>Certificado</a>
                      {o.format === "PRINT" ? <a href={`/api/ventas/etiqueta/pa?copia=${c.id}`} className={enlace}>Etiqueta</a> : null}
                    </span>
                  ))}
                  {d.esDueno && o.emitidas.length < o.proofCount ? <EmitirPA offerId={o.id} /> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {d.esSuperAdmin ? (
        <section className={seccion}>
          <h2 className="mf-titulo text-2xl">Ventas de prueba</h2>
          <BorrarPruebas activityId={d.actividad.id} />
        </section>
      ) : null}
    </main>
  );
}
