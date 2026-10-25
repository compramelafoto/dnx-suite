import {
  INITIAL_CUANTO_COBRO_QUOTE,
  computeMonthlyBillableHours,
  computeStudioBreakdown,
  getCuantoCobroMissingFields,
  getProfileCostHour,
  getProfileHourlyRate,
  getProfileMonthlyNeed,
  getProfileResultSteps,
  parseCuantoCobroAmount,
  type CuantoCobroProfileInput,
  type CuantoCobroStudioBreakdown,
} from "@repo/cuanto-cobro-core";

export type ResumenPerfil = {
  completo: boolean;
  faltan: string[];
  necesidadMensual: number;
  horasFacturablesMes: number;
  valorHora: number | null;
  costoHora: number | null;
  gastosPersonales: number;
  gastosNegocio: number;
  reservas: number;
  /** Mi estudio: el desglose del motor (null si el perfil no está en modo estudio). */
  estudio: CuantoCobroStudioBreakdown | null;
};

function monto(valor: string): number {
  return parseCuantoCobroAmount(valor) ?? 0;
}

export function resumirPerfil(p: CuantoCobroProfileInput): ResumenPerfil {
  // Los pasos salen del motor según el modo (solo o estudio): no se copian acá.
  const faltan = [
    ...new Set(getProfileResultSteps(p).flatMap((paso) => getCuantoCobroMissingFields(paso, p, INITIAL_CUANTO_COBRO_QUOTE))),
  ];

  const necesidadMensual = getProfileMonthlyNeed(p);
  const estudio = computeStudioBreakdown(p);
  if (estudio) {
    return {
      completo: faltan.length === 0,
      faltan,
      necesidadMensual,
      horasFacturablesMes: estudio.capacityHours,
      valorHora: estudio.studioHourRate,
      costoHora: estudio.studioHourRate,
      // En modo estudio: el retiro hace de "personales" y fijos + equipo de "negocio".
      gastosPersonales: estudio.ownerDraw,
      gastosNegocio: estudio.fixedCosts + estudio.teamCost + estudio.fixedFromExtras,
      reservas: estudio.reserves,
      estudio,
    };
  }

  const gastosPersonales = p.personalExpenseGroups.reduce(
    (total, g) => total + g.items.reduce((s, i) => s + monto(i.amount), 0),
    0,
  );
  const equipo = monto(p.employeesCount) > 0 ? monto(p.employeeMonthlyCost) : 0;
  const gastosNegocio = monto(p.businessRent) + monto(p.businessSoftware) + monto(p.businessMarketing) + equipo;
  const externos = p.livesOnlyFromPhotography === "no" ? monto(p.externalMonthlyIncome) : 0;
  // Lo que queda de la necesidad una vez descontados gastos e ingresos externos: renovación, ampliación y ahorros.
  const reservas = Math.max(0, necesidadMensual - gastosPersonales - gastosNegocio + externos);

  return {
    completo: faltan.length === 0,
    faltan,
    necesidadMensual,
    horasFacturablesMes: computeMonthlyBillableHours(p.weeklyHours, p.timeDistribution),
    valorHora: getProfileHourlyRate(p),
    costoHora: getProfileCostHour(p),
    gastosPersonales,
    gastosNegocio,
    reservas,
    estudio: null,
  };
}
