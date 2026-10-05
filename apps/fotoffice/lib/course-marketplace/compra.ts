import { calcularReparto, type ParteDelReparto } from "./reparto";
import { beneficiariosParaMotor } from "./beneficiarios";

/**
 * Los montos de comprar un curso grabado SIN reparto (un solo beneficiario que es el dueño),
 * con el 5% de la plataforma encima del precio de lista (spec, sección 5.4).
 */

function aTexto(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

export function montosDeCompraSinReparto(input: {
  listaArs: string | number;
  comisionPlataformaBps: number;
  owner: { workspaceId: string; nombre: string };
}):
  | { ok: true; listPriceArs: string; discountArs: string; platformFeeArs: string; amountArs: string; netAmountArs: string; partes: ParteDelReparto[] }
  | { ok: false; error: string } {
  const listaCentavos = Math.round(Number(input.listaArs) * 100);
  const r = calcularReparto({
    listaCentavos,
    comisionPlataformaBps: input.comisionPlataformaBps,
    beneficiarios: beneficiariosParaMotor(input.owner, []),
    vendedorId: input.owner.workspaceId,
  });
  if (!r.ok) return { ok: false, error: r.errores[0] ?? "No se pudo calcular el precio." };
  return {
    ok: true,
    listPriceArs: aTexto(listaCentavos),
    discountArs: aTexto(r.descuento),
    platformFeeArs: aTexto(r.comisionPlataforma),
    amountArs: aTexto(r.pagaElAlumno),
    netAmountArs: aTexto(r.pagaElAlumno - r.comisionPlataforma),
    partes: r.partes,
  };
}
