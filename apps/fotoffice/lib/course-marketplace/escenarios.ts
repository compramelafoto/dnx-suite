import { calcularReparto, topeDeDescuentoBps, formatoPorcentaje, type BeneficiarioEntrada } from "./reparto";
import { estimarComisionMp, TASA_MP_ESTIMADA_BPS } from "./comision-mp";

export type FilaEscenario = {
  id: string;
  nombre: string;
  tipo: "PLATAFORMA" | "REVENDEDOR" | "BENEFICIARIO";
  bruto: number;
  mp: number;
  neto: number;
};

type Clave = "directa" | "reventa" | "socio";

export type Escenario =
  | { clave: Clave; titulo: string; ok: true; pagaElAlumno: number; filas: FilaEscenario[] }
  | { clave: Clave; titulo: string; ok: false; errores: string[] };

/** Los tres escenarios del simulador (spec, sección 6). Puro: lo usa el navegador. */
export function armarEscenarios(input: {
  listaCentavos: number;
  comisionPlataformaBps: number;
  beneficiarios: BeneficiarioEntrada[];
  vendedorId: string;
  reventaBps: number;
  tasaMpBps?: number;
}): Escenario[] {
  const tasa = input.tasaMpBps ?? TASA_MP_ESTIMADA_BPS;
  const base = { listaCentavos: input.listaCentavos, comisionPlataformaBps: input.comisionPlataformaBps, beneficiarios: input.beneficiarios };
  const tope = topeDeDescuentoBps({ beneficiarios: input.beneficiarios, vendedorId: input.vendedorId });
  const casos: Array<{ clave: Clave; titulo: string; entrada: Parameters<typeof calcularReparto>[0] }> = [
    { clave: "directa", titulo: "Venta directa", entrada: { ...base, vendedorId: input.vendedorId } },
    {
      clave: "reventa",
      titulo: `Revendido al ${formatoPorcentaje(input.reventaBps)}`,
      entrada: { ...base, reventa: { id: "revendedor", nombre: "Revendedor", bps: input.reventaBps } },
    },
    {
      clave: "socio",
      titulo: `Socio con ${formatoPorcentaje(tope)} de descuento`,
      entrada: { ...base, vendedorId: input.vendedorId, descuentoBps: tope },
    },
  ];
  return casos.map(({ clave, titulo, entrada }) => {
    const r = calcularReparto(entrada);
    if (!r.ok) return { clave, titulo, ok: false, errores: r.errores };
    const mp = estimarComisionMp(r.pagaElAlumno, tasa);
    return {
      clave,
      titulo,
      ok: true,
      pagaElAlumno: r.pagaElAlumno,
      filas: r.partes.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        tipo: p.tipo,
        bruto: p.centavos,
        mp: p.absorbeMp ? mp : 0,
        neto: p.centavos - (p.absorbeMp ? mp : 0),
      })),
    };
  });
}
