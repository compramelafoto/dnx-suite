import { armarCsvExcel } from "@/lib/listado/csv";
import type { ColumnaExport } from "@/lib/listado/tipos";
import { formatearNota, valorParaMiEscuela, type EspecialPeriodo } from "./notas";
import type { Periodo, Redondeo } from "./reglas";

/**
 * Planilla «Para Mi Escuela» (o planilla propia) en CSV para Excel: los estudiantes en el orden del
 * padrón y, por cada período, lo que hay que elegir en el desplegable. Pura: el servidor arma las
 * filas y esto sólo da forma.
 */

export type FilaParaPlanilla = {
  orden: number;
  apellido: string;
  nombre: string;
  dni: string | null;
  condicion: string;
  baja: string | null;
  redondeo: Redondeo;
  /** { [clavePeriodo | "FINAL"]: nota } */
  notas: Record<string, { final: number | null; especial: EspecialPeriodo | null }>;
  faltas: number;
  asistencia: number | null;
};

export function armarPlanillaMiEscuela(periodos: readonly Periodo[], filas: readonly FilaParaPlanilla[], conDecimales: boolean): string {
  const claves = [...periodos.map((p) => ({ clave: p.clave, nombre: p.nombre })), { clave: "FINAL", nombre: "Nota final" }];
  const columnas: ColumnaExport<FilaParaPlanilla>[] = [
    { titulo: "N.°", tipo: "texto", valor: (f) => String(f.orden) },
    { titulo: "Apellido y nombre", tipo: "texto", valor: (f) => `${f.apellido}${f.nombre ? `, ${f.nombre}` : ""}` },
    { titulo: "DNI", tipo: "texto", valor: (f) => f.dni },
    { titulo: "Condición", tipo: "texto", valor: (f) => (f.baja ? `Baja ${f.baja.split("-").reverse().join("/")}` : f.condicion) },
  ];
  for (const p of claves) {
    columnas.push({
      titulo: p.nombre,
      tipo: "texto",
      valor: (f) => (f.baja ? "" : valorParaMiEscuela(f.notas[p.clave] ?? { final: null, especial: null }, { redondeo: f.redondeo })),
    });
    if (conDecimales) {
      columnas.push({
        titulo: `${p.nombre} (con decimales)`,
        tipo: "texto",
        valor: (f) => {
          const n = f.notas[p.clave];
          return n && n.final !== null && !n.especial ? formatearNota(n.final) : "";
        },
      });
    }
  }
  columnas.push(
    { titulo: "Faltas", tipo: "texto", valor: (f) => formatearNota(f.faltas) },
    { titulo: "Asistencia %", tipo: "texto", valor: (f) => (f.asistencia === null ? "" : formatearNota(f.asistencia)) },
    { titulo: "Pasada", tipo: "texto", valor: () => "" },
  );
  return armarCsvExcel(columnas, [...filas].sort((a, b) => a.orden - b.orden));
}
