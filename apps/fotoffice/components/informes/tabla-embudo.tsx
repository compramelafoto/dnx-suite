import Link from "next/link";
import { ETIQUETAS_AGRUPAMIENTO_EMBUDO, hrefConsultas, type FilaEmbudo, type TablaEmbudo } from "@/lib/informes/embudo";
import { formatMinorArs } from "@/lib/membership/money";

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

/**
 * Tabla del Embudo: una fila por categoría u origen y el total al final. Cada cantidad mayor que cero
 * enlaza a la lista de Consultas filtrada (sólo las filas con categoría u origen real; "Sin …" no
 * tiene filtro en la lista).
 */
export function TablaEmbudoConsultas({ tabla, desde, hasta }: { tabla: TablaEmbudo; desde: string; hasta: string }) {
  function Cantidad({ fila, valor, resultado }: { fila: FilaEmbudo; valor: number; resultado?: "abierta" | "GANADA" | "PERDIDA" }) {
    if (valor === 0) return <td className="px-3 py-2 text-right tabular-nums text-[var(--fo-muted-soft)]">–</td>;
    const href = hrefConsultas({ agrupar: tabla.agrupar, idGrupo: fila.idGrupo, desde, hasta, resultado });
    return (
      <td className="px-3 py-2 text-right tabular-nums">
        {href ? (
          <Link href={href} className="hover:underline" aria-label={`Ver las ${valor} consultas en la lista`}>
            {valor}
          </Link>
        ) : (
          valor
        )}
      </td>
    );
  }
  const conversion = (f: FilaEmbudo) => (f.conversion === null ? "–" : `${numero.format(f.conversion)} %`);
  const dias = (f: FilaEmbudo) => (f.diasPromedio === null ? "–" : numero.format(f.diasPromedio));

  return (
    <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">{ETIQUETAS_AGRUPAMIENTO_EMBUDO[tabla.agrupar]}</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Entraron</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Ganadas</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Perdidas</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Abiertas</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">% de conversión</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Valor estimado</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Vendido</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Días hasta cerrar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
          {tabla.filas.map((f) => (
            <tr key={f.clave}>
              <th scope="row" className="px-3 py-2 text-left font-medium">{f.etiqueta}</th>
              <Cantidad fila={f} valor={f.entraron} />
              <Cantidad fila={f} valor={f.ganadas} resultado="GANADA" />
              <Cantidad fila={f} valor={f.perdidas} resultado="PERDIDA" />
              <Cantidad fila={f} valor={f.abiertas} resultado="abierta" />
              <td className="px-3 py-2 text-right tabular-nums">{conversion(f)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMinorArs(f.valorEstimado)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMinorArs(f.vendido)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{dias(f)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-[var(--fo-border-strong)] bg-[var(--fo-bg-elevated)] font-semibold">
          <tr>
            <th scope="row" className="px-3 py-2 text-left">Total</th>
            <td className="px-3 py-2 text-right tabular-nums">{tabla.total.entraron}</td>
            <td className="px-3 py-2 text-right tabular-nums">{tabla.total.ganadas}</td>
            <td className="px-3 py-2 text-right tabular-nums">{tabla.total.perdidas}</td>
            <td className="px-3 py-2 text-right tabular-nums">{tabla.total.abiertas}</td>
            <td className="px-3 py-2 text-right tabular-nums">{conversion(tabla.total)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatMinorArs(tabla.total.valorEstimado)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatMinorArs(tabla.total.vendido)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{dias(tabla.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
