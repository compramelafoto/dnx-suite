import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { escribirConsulta } from "@/lib/listado/consulta";
import type { ConsultaListado, DefinicionListado } from "@/lib/listado/tipos";
import { Fila } from "./fila";
import { CasillaFila, CasillaPagina } from "./seleccion";
import { hrefListado } from "./util";

/**
 * La tabla. Los títulos de columnas ordenables son enlaces que alternan ascendente/descendente;
 * las columnas secundarias se esconden en pantallas chicas y cuando el panel está abierto.
 */
export function Tabla<F>({
  def,
  filas,
  consulta,
  ruta,
  seleccionable,
}: {
  def: DefinicionListado<F>;
  filas: F[];
  consulta: ConsultaListado;
  ruta: string;
  seleccionable: boolean;
}) {
  const panelAbierto = Boolean(consulta.ver && def.panel);
  const columnas = panelAbierto ? def.columnas.filter((c) => !c.secundaria) : def.columnas;
  const oculta = (secundaria?: boolean) => (secundaria ? "hidden md:table-cell" : "");
  const alinear = (a?: "izquierda" | "derecha") => (a === "derecha" ? "text-right" : "text-left");

  return (
    <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
      <table className="min-w-full text-sm">
        <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
          <tr>
            {seleccionable ? (
              <th scope="col" className="w-10 px-4 py-3">
                <CasillaPagina />
              </th>
            ) : null}
            {columnas.map((c) => {
              const activa = c.orden !== undefined && consulta.orden.campo === c.orden;
              const clases = `px-4 py-3 font-medium ${alinear(c.alinear)} ${oculta(c.secundaria)}`;
              if (!c.orden) {
                return (
                  <th key={c.clave} scope="col" className={clases}>
                    {c.titulo}
                  </th>
                );
              }
              const desc = activa ? !consulta.orden.desc : false;
              const href = hrefListado(ruta, escribirConsulta(def, consulta, { orden: { campo: c.orden, desc } }));
              return (
                <th
                  key={c.clave}
                  scope="col"
                  className={clases}
                  aria-sort={activa ? (consulta.orden.desc ? "descending" : "ascending") : "none"}
                >
                  <Link href={href} scroll={false} className={`inline-flex items-center gap-1 hover:text-[var(--fo-text)] ${activa ? "text-[var(--fo-text)]" : ""}`}>
                    {c.titulo}
                    {activa ? (
                      consulta.orden.desc ? <ArrowDown className="size-3.5" aria-hidden /> : <ArrowUp className="size-3.5" aria-hidden />
                    ) : null}
                  </Link>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
          {filas.map((fila) => {
            const id = def.idDe(fila);
            const hrefFicha = def.hrefFicha(id);
            const hrefPanel = def.panel ? hrefListado(ruta, escribirConsulta(def, consulta, { ver: id })) : hrefFicha;
            return (
              <Fila key={id} id={id} hrefPanel={hrefPanel} hrefFicha={hrefFicha} activa={consulta.ver === id}>
                {seleccionable ? (
                  <td className="w-10 px-4 py-3">
                    <CasillaFila id={id} />
                  </td>
                ) : null}
                {columnas.map((c) => (
                  <td key={c.clave} className={`px-4 py-3 text-[var(--fo-text)] ${alinear(c.alinear)} ${oculta(c.secundaria)}`}>
                    {c.celda(fila)}
                  </td>
                ))}
              </Fila>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
