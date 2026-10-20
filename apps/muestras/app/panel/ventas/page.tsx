import Link from "next/link";
import { ORDER_STATUS_LABELS } from "@repo/muestras";
import { alerta, enlace, nota, seccion } from "@/components/ventas/estilos";
import { BorrarPruebas } from "@/components/ventas/pedidos-panel";
import { TarjetaPedido } from "@/components/ventas/tarjeta-pedido";
import { pedidosDeLaPlataforma } from "@/lib/ventas/pedidos-consultas";
import { requireSuperAdmin } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ventas de la plataforma" };

/**
 * Todos los pedidos de la plataforma (sólo super admin, etapa 8): alertas, pendientes de más de 72
 * horas, devoluciones pedidas con "Devolver el pago" y el borrado de las ventas de prueba.
 */
export default async function VentasDeLaPlataforma({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const usuario = await requireSuperAdmin();
  const { estado } = await searchParams;
  const d = (await pedidosDeLaPlataforma(usuario, estado ?? null))!;
  return (
    <main className="max-w-4xl space-y-8">
      <header className="space-y-2">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Ventas de la plataforma</h1>
      </header>

      <section className={seccion}>
        <h2 className="mf-titulo text-2xl">Piden atención</h2>
        {d.atencion.length === 0 ? <p className={nota}>Nada pendiente.</p> : (
          <>
            <p className={alerta}>Cobrados sin copia, devoluciones o arrepentimientos pedidos, alertas de conciliación y pendientes de más de 72 horas.</p>
            <ul className="border-t border-[var(--mf-line)]">
              {d.atencion.map((p) => <TarjetaPedido key={p.id} p={p} esDueno={false} esSuperAdmin conMuestra />)}
            </ul>
          </>
        )}
      </section>

      <section className={seccion}>
        <h2 className="mf-titulo text-2xl">Todos los pedidos</h2>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Filtrar por estado">
          <Link href="?" className={enlace}>Todos</Link>
          {d.estados.map((s) => <Link key={s} href={`?estado=${s}`} className={enlace}>{ORDER_STATUS_LABELS[s]}</Link>)}
        </nav>
        {d.pedidos.length === 0 ? <p className={nota}>No hay pedidos.</p> : (
          <ul className="border-t border-[var(--mf-line)]">
            {d.pedidos.map((p) => <TarjetaPedido key={p.id} p={p} esDueno={false} esSuperAdmin conMuestra />)}
          </ul>
        )}
      </section>

      <section className={seccion}>
        <h2 className="mf-titulo text-2xl">Ventas de prueba</h2>
        {d.pruebas.length === 0 ? <p className={nota}>No hay ventas de prueba.</p> : (
          <ul className="space-y-3">
            {d.pruebas.map((m) => (
              <li key={m.activityId} className="flex flex-wrap items-center gap-3 text-[15px]">
                <span>{m.title}: {m.cantidad} {m.cantidad === 1 ? "pedido" : "pedidos"}</span>
                <BorrarPruebas activityId={m.activityId} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
