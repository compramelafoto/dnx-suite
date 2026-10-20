import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireSalesStaff } from "@/lib/sales/access";
import { colas, type FilaCola } from "@/lib/impresion/preparaciones";
import { FilaAcciones } from "./fila-acciones";

export const dynamic = "force-dynamic";

const hora = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Lo que hay que imprimir, lo preparado sin cobrar y lo que salió hoy de cada impresora. */
export default async function ImpresionesPage() {
  const { workspace } = await requireSalesStaff();
  const c = await colas(workspace.id, new Date());
  return (
    <div className="space-y-6">
      <PageHeader title="Impresiones" description="Para imprimir, preparado sin cobrar e impreso hoy." />
      <Seccion titulo="Para imprimir" vacia="No hay nada cobrado esperando impresión." filas={c.paraImprimir} />
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
                {f.producto ?? "Foto carnet"} · {f.cliente ?? "sin cliente"} · {f.estado === "IMPRESA" ? "impresa" : f.estado === "LISTA" ? "lista" : "a medio preparar"} · {hora(f.creada)}
              </span>
              <FilaAcciones preparacionId={f.preparacionId} hojaId={f.hojaId} hojaVersion={f.hojaVersion} cobrada={f.cobrada} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
