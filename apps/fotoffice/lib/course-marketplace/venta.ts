// lib/course-marketplace/venta.ts
import { calcularReparto, type BeneficiarioEntrada, type ParteDelReparto } from "./reparto";
import type { EstadoDeVenta } from "./beneficiarios";

/**
 * La venta de un curso grabado, con todo el motor: reventa (R) y descuento para socios (D).
 * Puro. Lo usan la página pública, la acción de compra, el portal y los tests.
 *
 * Con el split de Mercado Pago apagado sólo se vende lo que no tiene reparto y lo vende su dueño;
 * todo lo demás dice "Disponible próximamente" (spec, sección 5.1). Así nadie queda sin cobrar.
 */

export type DecisionDeVenta = { tipo: "SIN_REPARTO" } | { tipo: "CON_REPARTO" } | { tipo: "PROXIMAMENTE"; motivo: string };

export function decidirVenta(input: { estado: EstadoDeVenta; revendido: boolean; splitHabilitado: boolean }): DecisionDeVenta {
  if (!input.revendido && input.estado.tipo === "SIN_REPARTO") return { tipo: "SIN_REPARTO" };
  if (!input.splitHabilitado) {
    return { tipo: "PROXIMAMENTE", motivo: "El reparto automático de Mercado Pago todavía no está habilitado." };
  }
  if (input.estado.tipo === "CON_REPARTO" && !input.estado.listo) {
    return { tipo: "PROXIMAMENTE", motivo: input.estado.faltantes[0] ?? "Falta completar el reparto." };
  }
  return { tipo: "CON_REPARTO" };
}

export type MontosDeVenta =
  | { ok: true; listPriceArs: string; discountArs: string; platformFeeArs: string; amountArs: string; netAmountArs: string; partes: ParteDelReparto[] }
  | { ok: false; error: string };

function aTexto(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

/**
 * Montos de una venta. El descuento sólo vale si quien compra es socio activo de quien revende,
 * y sale sólo de la parte del revendedor (el motor lo topea). `netAmountArs` es lo que le toca a
 * quien vende: su parte del reparto.
 */
export function montosDeVenta(input: {
  listaArs: string | number;
  comisionPlataformaBps: number;
  beneficiarios: BeneficiarioEntrada[];
  vendedorWorkspaceId: string;
  reventa: { workspaceId: string; nombre: string; bps: number; descuentoSociosBps: number } | null;
  esSocioDelVendedor: boolean;
}): MontosDeVenta {
  const listaCentavos = Math.round(Number(input.listaArs) * 100);
  const descuentoBps = input.reventa && input.esSocioDelVendedor ? input.reventa.descuentoSociosBps : 0;
  const r = calcularReparto({
    listaCentavos,
    comisionPlataformaBps: input.comisionPlataformaBps,
    beneficiarios: input.beneficiarios,
    reventa: input.reventa ? { id: input.reventa.workspaceId, nombre: input.reventa.nombre, bps: input.reventa.bps } : null,
    descuentoBps,
    vendedorId: input.reventa ? null : input.vendedorWorkspaceId,
  });
  if (!r.ok) return { ok: false, error: r.errores[0] ?? "No se pudo calcular el precio." };
  const delVendedor = r.partes.find((p) => p.tipo !== "PLATAFORMA" && p.id === input.vendedorWorkspaceId)?.centavos ?? 0;
  return {
    ok: true,
    listPriceArs: aTexto(listaCentavos),
    discountArs: aTexto(r.descuento),
    platformFeeArs: aTexto(r.comisionPlataforma),
    amountArs: aTexto(r.pagaElAlumno),
    netAmountArs: aTexto(delVendedor),
    partes: r.partes,
  };
}

/** Las filas de `CourseSaleShare` de una venta: el reparto congelado (spec, sección 2.3). */
export function filasDeReparto(partes: ParteDelReparto[]) {
  return partes.map((p) => ({
    workspaceId: p.tipo === "PLATAFORMA" ? null : p.id,
    kind: p.tipo,
    label: p.nombre,
    amountArs: aTexto(p.centavos),
    absorbsProcessorFee: p.absorbeMp,
  }));
}
