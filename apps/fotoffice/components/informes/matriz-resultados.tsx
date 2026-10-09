import Link from "next/link";
import { paramsDeCelda, type FiltroCeldaResultados } from "@/lib/informes/detalle";
import type { BloqueMatriz, FilaRubro, MatrizResultados } from "@/lib/informes/resultados";
import { etiquetaMes } from "@/lib/informes/periodos";
import { formatMinorArs } from "@/lib/membership/money";

function claseImporte(v: number): string {
  return v < 0 ? "text-[var(--fo-danger)]" : "";
}

/**
 * Matriz de Resultados: rubros en filas, meses en columnas. Cada importe distinto de cero enlaza al
 * desglose de su celda. Costos y gastos se muestran en positivo; el resultado en rojo si es negativo.
 */
export function MatrizResultadosTabla({ matriz, base, periodo }: { matriz: MatrizResultados; base: string; periodo: string }) {
  const enlace = (f: FiltroCeldaResultados) => `/informes/resultados/detalle?${paramsDeCelda(f, base, periodo).toString()}`;

  function Celda({ valor, filtro, negrita }: { valor: number; filtro: FiltroCeldaResultados; negrita?: boolean }) {
    const texto = formatMinorArs(valor);
    const clase = `px-3 py-2 text-right tabular-nums ${claseImporte(valor)} ${negrita ? "font-semibold" : ""}`;
    if (valor === 0) return <td className={`${clase} text-[var(--fo-muted-soft)]`}>–</td>;
    return (
      <td className={clase}>
        <Link href={enlace(filtro)} className="hover:underline" aria-label={`Ver el detalle de ${texto}`}>
          {texto}
        </Link>
      </td>
    );
  }

  function FilaDeRubro({ fila, bloque, nivel }: { fila: FilaRubro; bloque: BloqueMatriz; nivel: 0 | 1 }) {
    const conHijos = fila.hijos.length > 0;
    const rubro = (mes: string | null): FiltroCeldaResultados => ({
      bloque: bloque.clave,
      rubro: fila.categoryId === null ? { tipo: "sin" } : { tipo: "id", id: fila.categoryId, conHijos },
      mes,
    });
    return (
      <>
        <tr className={nivel === 1 ? "text-[var(--fo-muted)]" : ""}>
          <th scope="row" className={`px-3 py-2 text-left ${nivel === 1 ? "pl-8 font-normal" : conHijos ? "font-semibold" : "font-medium"}`}>
            {fila.codigo ? `${fila.codigo} ` : ""}
            {fila.nombre}
            {fila.inactivo ? <span className="ml-2 rounded-full border border-[var(--fo-border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--fo-muted)]">inactivo</span> : null}
            {conHijos ? <span className="ml-2 text-xs font-normal text-[var(--fo-muted-soft)]">subtotal</span> : null}
          </th>
          {matriz.meses.map((m, i) => (
            <Celda key={m} valor={fila.porMes[i]} filtro={rubro(m)} negrita={conHijos} />
          ))}
          <Celda valor={fila.total} filtro={rubro(null)} negrita />
        </tr>
        {fila.hijos.map((h) => (
          <FilaDeRubro key={h.categoryId ?? "sin"} fila={h} bloque={bloque} nivel={1} />
        ))}
      </>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Rubro</th>
            {matriz.meses.map((m) => (
              <th key={m} scope="col" className="px-3 py-2 text-right font-semibold">{etiquetaMes(m)}</th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        {matriz.bloques
          .filter((b) => b.filas.length > 0 || b.clave === "INGRESOS" || b.clave === "COSTOS" || b.clave === "GASTOS")
          .map((b) => (
            <tbody key={b.clave} className="divide-y divide-[var(--fo-border)] border-t border-[var(--fo-border)] bg-[var(--fo-surface)]">
              <tr className="bg-[var(--fo-surface-muted)]">
                <th scope="colgroup" colSpan={matriz.meses.length + 2} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">
                  {b.titulo}
                </th>
              </tr>
              {b.filas.length === 0 ? (
                <tr>
                  <td colSpan={matriz.meses.length + 2} className="px-3 py-2 text-[var(--fo-muted-soft)]">
                    No hay rubros de este bloque. Los rubros se crean en Caja → Configuración, con un código que empiece con {b.clave === "INGRESOS" ? "3" : b.clave === "COSTOS" ? "4" : "5"}.
                  </td>
                </tr>
              ) : (
                b.filas.map((f) => <FilaDeRubro key={f.categoryId ?? "sin"} fila={f} bloque={b} nivel={0} />)
              )}
              <tr className="font-semibold">
                <th scope="row" className="px-3 py-2 text-left">Total {b.titulo.toLowerCase()}</th>
                {matriz.meses.map((m, i) => (
                  <Celda key={m} valor={b.porMes[i]} filtro={{ bloque: b.clave, rubro: { tipo: "todos" }, mes: m }} negrita />
                ))}
                <Celda valor={b.total} filtro={{ bloque: b.clave, rubro: { tipo: "todos" }, mes: null }} negrita />
              </tr>
            </tbody>
          ))}
        <tfoot className="border-t-2 border-[var(--fo-border-strong)] bg-[var(--fo-bg-elevated)] font-semibold">
          <tr>
            <th scope="row" className="px-3 py-2 text-left">Resultado</th>
            {matriz.resultado.porMes.map((v, i) => (
              <td key={matriz.meses[i]} className={`px-3 py-2 text-right tabular-nums ${claseImporte(v)}`}>{formatMinorArs(v)}</td>
            ))}
            <td className={`px-3 py-2 text-right tabular-nums ${claseImporte(matriz.resultado.total)}`}>{formatMinorArs(matriz.resultado.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
