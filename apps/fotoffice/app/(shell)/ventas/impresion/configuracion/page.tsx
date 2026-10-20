import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireSalesAdmin } from "@/lib/sales/access";
import { asegurarConfiguracion, listarSalidas } from "@/lib/impresion/configuracion";
import { guardarEscalaAction } from "../actions";

export const dynamic = "force-dynamic";

/** Las impresoras del local: qué hojas imprimen y la corrección de escala medida con la hoja de prueba. */
export default async function ImpresionConfiguracionPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { workspace } = await requireSalesAdmin();
  const q = await searchParams;
  await asegurarConfiguracion(workspace.id);
  const salidas = await listarSalidas(workspace.id);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Impresión" description="Las impresoras del local, sus hojas y la prueba de medida." />
      {q.error ? <p className="fo-card p-4 text-sm text-[var(--fo-danger)]">{q.error}</p> : null}
      {q.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Guardado.</p> : null}
      {salidas.map((s) => (
        <section key={s.id} className="fo-card space-y-3 p-5">
          <h2 className="text-base font-semibold">{s.nombre}</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            {s.ppp} ppp · hojas: {s.tamanos.map((t) => t.nombre).join(", ")}
            {s.admiteCopias ? "" : " · sólo carnet, planchas e impresiones color (no copias fotográficas)"}
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>En el cuadro de impresión de esta impresora dejá fijo: el papel de la hoja, «sin bordes», escala 100 % y calidad máxima.</li>
            <li>
              Imprimí la{" "}
              {s.tamanos.map((t, i) => (
                <span key={t.id}>
                  {i > 0 ? " · " : ""}
                  <Link className="underline" href={`/imprimir/prueba/${s.id}?tamano=${t.id}`} target="_blank">
                    hoja de prueba {t.nombre}
                  </Link>
                </span>
              ))}
              .
            </li>
            <li>Medí con una regla las dos líneas de 100 mm y anotá lo que miden.</li>
          </ol>
          <form action={guardarEscalaAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="salidaId" value={s.id} />
            <label className="text-sm">
              Horizontal (mm)
              <input name="x" required inputMode="decimal" defaultValue={(100000 / s.escalaXMil).toFixed(1).replace(".", ",")} className="fo-input mt-1 w-28" />
            </label>
            <label className="text-sm">
              Vertical (mm)
              <input name="y" required inputMode="decimal" defaultValue={(100000 / s.escalaYMil).toFixed(1).replace(".", ",")} className="fo-input mt-1 w-28" />
            </label>
            <button type="submit" className="fo-btn fo-btn-primary text-sm">Guardar medida</button>
          </form>
        </section>
      ))}
    </div>
  );
}
