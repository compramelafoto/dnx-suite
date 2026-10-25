import Link from "next/link";
import { etiquetaMes } from "@/lib/informes/periodos";
import { ETIQUETAS_AGRUPAMIENTO, paramsDeCeldaVentas, type FiltroVentas, type MatrizVentas } from "@/lib/informes/ventas";
import { formatMinorArs } from "@/lib/membership/money";

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/**
 * Matriz de Ventas: grupos en filas, meses en columnas, con total por fila, por columna y general.
 * Cada importe distinto de cero enlaza al desglose de su celda.
 */
export function MatrizVentasTabla({ matriz, periodo }: { matriz: MatrizVentas; periodo: string }) {
  const enlace = (f: FiltroVentas) => `/informes/ventas/detalle?${paramsDeCeldaVentas(f, periodo).toString()}`;

  function Celda({ valor, filtro, negrita }: { valor: number; filtro: FiltroVentas; negrita?: boolean }) {
    const clase = `px-3 py-2 text-right tabular-nums ${negrita ? "font-semibold" : ""}`;
    if (valor === 0) return <td className={`${clase} text-[var(--fo-muted-soft)]`}>–</td>;
    const texto = formatMinorArs(valor);
    return (
      <td className={clase}>
        <Link href={enlace(filtro)} className="hover:underline" aria-label={`Ver el detalle de ${texto}`}>
          {texto}
        </Link>
      </td>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">{ETIQUETAS_AGRUPAMIENTO[matriz.agrupar]}</th>
            {matriz.meses.map((m) => (
              <th key={m} scope="col" className="px-3 py-2 text-right font-semibold">{etiquetaMes(m)}</th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-semibold">Total</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">{matriz.unidad}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
          {matriz.filas.map((f) => (
            <tr key={f.clave}>
              <th scope="row" className="px-3 py-2 text-left font-medium">{f.etiqueta}</th>
              {matriz.meses.map((m, i) => (
                <Celda key={m} valor={f.porMes[i]} filtro={{ agrupar: matriz.agrupar, grupo: f.clave, mes: m }} />
              ))}
              <Celda valor={f.total} filtro={{ agrupar: matriz.agrupar, grupo: f.clave, mes: null }} negrita />
              <td className="px-3 py-2 text-right tabular-nums">{numero.format(f.cantidad)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-[var(--fo-border-strong)] bg-[var(--fo-bg-elevated)] font-semibold">
          <tr>
            <th scope="row" className="px-3 py-2 text-left">Total</th>
            {matriz.totalPorMes.map((v, i) => (
              <td key={matriz.meses[i]} className="px-3 py-2 text-right tabular-nums">{formatMinorArs(v)}</td>
            ))}
            <td className="px-3 py-2 text-right tabular-nums">{formatMinorArs(matriz.total)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{numero.format(matriz.cantidad)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
