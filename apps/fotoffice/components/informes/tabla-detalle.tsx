import Link from "next/link";
import { fechaLarga, type FilaDetalle } from "@/lib/informes/detalle";
import { formatMinorArs } from "@/lib/membership/money";

/** Lista de lo que forma una celda: fecha, origen, contacto, descripción, importe y enlace. */
export function TablaDetalle({ filas, total, cantidad, truncado }: { filas: readonly FilaDetalle[]; total: number; cantidad: number; truncado: boolean }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Fecha</th>
              <th scope="col" className="px-3 py-2 font-semibold">Origen</th>
              <th scope="col" className="px-3 py-2 font-semibold">Contacto</th>
              <th scope="col" className="px-3 py-2 font-semibold">Descripción</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Importe</th>
              <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Enlace</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
            {filas.map((f) => (
              <tr key={f.clave}>
                <td className="whitespace-nowrap px-3 py-2">{fechaLarga(f.fecha)}</td>
                <td className="px-3 py-2">{f.origen}</td>
                <td className="px-3 py-2 text-[var(--fo-muted)]">{f.contacto ?? "–"}</td>
                <td className="px-3 py-2">{f.descripcion || "–"}</td>
                <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${f.centavos < 0 ? "text-[var(--fo-danger)]" : ""}`}>{formatMinorArs(f.centavos)}</td>
                <td className="px-3 py-2">
                  {f.href ? (
                    <Link href={f.href} className="text-[var(--fo-accent)] hover:underline">
                      Abrir
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-[var(--fo-border-strong)] bg-[var(--fo-bg-elevated)] font-semibold">
            <tr>
              <td colSpan={4} className="px-3 py-2">Total ({cantidad} {cantidad === 1 ? "renglón" : "renglones"})</td>
              <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${total < 0 ? "text-[var(--fo-danger)]" : ""}`}>{formatMinorArs(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {truncado ? (
        <p className="text-xs text-[var(--fo-muted)]">Mostramos los primeros {filas.length} renglones; el total suma todos. El CSV trae la lista completa.</p>
      ) : null}
    </div>
  );
}
