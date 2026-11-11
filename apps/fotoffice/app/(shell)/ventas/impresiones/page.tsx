import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireSalesStaff } from "@/lib/sales/access";
import { colas, type FilaCola } from "@/lib/impresion/preparaciones";
import { instantaneasPorImprimir } from "@/lib/impresiones/instantaneas-servidor";
import { FilaAcciones } from "./fila-acciones";
import { InstantaneaAcciones } from "./instantanea-acciones";

export const dynamic = "force-dynamic";

const hora = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Lo que hay que imprimir, lo preparado sin cobrar y lo que salió hoy de cada impresora. */
export default async function ImpresionesPage() {
  const { workspace } = await requireSalesStaff();
  const ahora = new Date();
  const [c, instantaneas] = await Promise.all([colas(workspace.id, ahora), instantaneasPorImprimir(workspace.id, ahora)]);
  return (
    <div className="space-y-6">
      <PageHeader title="Impresiones" description="Para imprimir, preparado sin cobrar e impreso hoy." />
      <Seccion titulo="Para imprimir" vacia="No hay nada cobrado esperando impresión." filas={c.paraImprimir} />
      <section className="fo-card p-5">
        <h2 className="mb-1 text-base font-semibold">Instantáneas pedidas por WhatsApp o la web</h2>
        <p className="mb-3 text-xs text-[var(--fo-muted)]">Ya están pagadas. Las fotos están en el ZIP del trabajo. Al imprimirlas, tocá «Ya las imprimí» y al cliente le llega el aviso.</p>
        {instantaneas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">No hay instantáneas esperando.</p>
        ) : (
          <ul className="divide-y text-sm">
            {instantaneas.map((i) => (
              <li key={i.proyectoId} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span>
                  Pedido N° {i.numero} · {i.cliente} · {i.copias.map((x) => `${x.cantidad} ${x.tamano} ${x.papel}`).join(", ")}
                  {i.pagadoEl ? ` · pagado ${hora(i.pagadoEl.toISOString())}` : ""}
                  {i.zipListo ? "" : " · preparando las fotos…"}
                </span>
                <InstantaneaAcciones proyectoId={i.proyectoId} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <Seccion titulo="Preparado sin cobrar" vacia="Todo lo preparado está cobrado." filas={c.sinCobrar} />
      <section className="fo-card p-5">
        <h2 className="mb-3 text-base font-semibold">Impreso hoy</h2>
        {c.impresoHoy.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no salió ninguna hoja hoy.</p>
        ) : (
          <ul className="divide-y text-sm">
            {c.impresoHoy.map((r) => (
              <li key={r.registroId} className="flex justify-between py-2">
                <span>
                  {r.salida} · {r.tamano} · {r.hojas} {r.hojas === 1 ? "hoja" : "hojas"}
                  {r.motivo === "DESCARTADA" ? " · descartada" : r.motivo === "PRUEBA" ? " · prueba" : ""}
                </span>
                <span className="flex gap-3">
                  {r.hojaId ? (
                    <Link className="underline" href={`/imprimir/hoja/${r.hojaId}?v=${r.hojaVersion ?? "0"}`} target="_blank">
                      Reimprimir
                    </Link>
                  ) : null}
                  <span className="text-[var(--fo-muted)]">{hora(r.hora)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Seccion({ titulo, vacia, filas }: { titulo: string; vacia: string; filas: FilaCola[] }) {
  return (
    <section className="fo-card p-5">
      <h2 className="mb-3 text-base font-semibold">{titulo}</h2>
      {filas.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">{vacia}</p>
      ) : (
        <ul className="divide-y text-sm">
          {filas.map((f) => (
            <li key={f.preparacionId} className="flex items-center justify-between gap-3 py-2">
              <span>
                {f.producto ?? (f.fotos > 0 ? "Copias" : "Foto carnet")}
                {f.fotos > 0 ? ` · ${f.fotos} ${f.fotos === 1 ? "foto" : "fotos"}` : ""} · {f.cliente ?? "sin cliente"} ·{" "}
                {f.estado === "IMPRESA" ? "impresa" : f.estado === "LISTA" ? "lista" : "a medio preparar"} · {hora(f.creada)}
              </span>
              <FilaAcciones preparacionId={f.preparacionId} imprimirHref={f.imprimirHref} cobrada={f.cobrada} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
