import {
  COLEGAS_PARA_GRATIS,
  ESCALERA_REFERIDOS,
  colegasParaElSiguienteEscalon,
  descuentoPorColegas,
  siguienteEscalon,
} from "../domain/escalera";

export type ProgramaDeReferidosView = {
  code: string;
  link: string;
  colegas: number;
  descuentoActual: number;
  siguienteDescuento: number | null;
  faltanParaElSiguiente: number;
  llegoAlTope: boolean;
  /** 0–100, hacia el premio grande. */
  progreso: number;
  escalera: Array<{ colegas: number; descuento: number; alcanzado: boolean }>;
};

export function presentarProgramaDeReferidos(input: {
  code: string;
  colegas: number;
  baseUrl: string;
}): ProgramaDeReferidosView {
  const colegas = Math.max(0, Math.floor(input.colegas));
  const siguiente = siguienteEscalon(colegas);
  const base = input.baseUrl.replace(/\/+$/, "");

  return {
    code: input.code,
    link: `${base}/i/${input.code}`,
    colegas,
    descuentoActual: descuentoPorColegas(colegas),
    siguienteDescuento: siguiente?.descuento ?? null,
    faltanParaElSiguiente: colegasParaElSiguienteEscalon(colegas),
    llegoAlTope: siguiente == null,
    progreso: Math.min(100, Math.round((colegas / COLEGAS_PARA_GRATIS) * 100)),
    escalera: ESCALERA_REFERIDOS.map((escalon) => ({
      colegas: escalon.colegas,
      descuento: escalon.descuento,
      alcanzado: colegas >= escalon.colegas,
    })),
  };
}
