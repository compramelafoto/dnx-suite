import { arMonthOf } from "@/lib/store/artworks/royalty-report";
import { ETIQUETA_VALIDACION, type Validacion } from "./validacion";

/**
 * Cuentas de la pantalla «Ventas CLF» (etapa 2). Módulo PURO. Montos en pesos.
 * Una venta suma en el mes en que se pagó (hora de Buenos Aires), salvo que no esté en el Mercado Pago del
 * espacio. Un reintegro resta en el mes en que ocurrió: el total de un mes cerrado no cambia de golpe.
 */

export type VentaVista = {
  pagadoEl: Date;
  validacion: string;
  pagoFamiliaArs: number;
  netoFotografoArs: number;
  mpComisionPlataformaArs: number | null;
  comisionPlataformaArs: number;
  mpComisionMpArs: number | null;
  mpAcreditadoArs: number | null;
  mpReintegradoArs: number | null;
  reintegradoEl: Date | null;
};

export type TotalesMes = {
  cantidad: number;
  pagoFamilia: number;
  tuPrecio: number;
  comisionPlataforma: number;
  comisionMp: number;
  acreditado: number;
  reintegros: number;
  cobradoNeto: number;
  sinValidar: number;
};

const redondo = (n: number) => Math.round(n * 100) / 100;

export function cuentaEnTotales(validacion: string): boolean {
  return validacion !== "NO_EN_TU_MP";
}

export function totalesDelMes(ventas: readonly VentaVista[], mes: string): TotalesMes {
  const t: TotalesMes = { cantidad: 0, pagoFamilia: 0, tuPrecio: 0, comisionPlataforma: 0, comisionMp: 0, acreditado: 0, reintegros: 0, cobradoNeto: 0, sinValidar: 0 };
  for (const v of ventas) {
    if (arMonthOf(v.pagadoEl) === mes && cuentaEnTotales(v.validacion)) {
      t.cantidad++;
      t.pagoFamilia += v.pagoFamiliaArs;
      t.tuPrecio += v.netoFotografoArs;
      t.comisionPlataforma += v.mpComisionPlataformaArs ?? v.comisionPlataformaArs;
      t.comisionMp += v.mpComisionMpArs ?? 0;
      if (v.mpAcreditadoArs !== null) t.acreditado += v.mpAcreditadoArs;
      else t.sinValidar++;
    }
    if (v.reintegradoEl && v.mpReintegradoArs && arMonthOf(v.reintegradoEl) === mes) t.reintegros += v.mpReintegradoArs;
  }
  for (const k of ["pagoFamilia", "tuPrecio", "comisionPlataforma", "comisionMp", "acreditado", "reintegros"] as const) t[k] = redondo(t[k]);
  t.cobradoNeto = redondo(t.acreditado - t.reintegros);
  return t;
}

export function etiquetaValidacion(v: string): string {
  return ETIQUETA_VALIDACION[v as Validacion] ?? v;
}
