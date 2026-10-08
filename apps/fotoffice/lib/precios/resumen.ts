import {
  INITIAL_CUANTO_COBRO_QUOTE,
  computeMonthlyBillableHours,
  getCuantoCobroMissingFields,
  getProfileHourlyRate,
  getProfileMonthlyNeed,
  parseCuantoCobroAmount,
  type CuantoCobroProfileInput,
} from "@repo/cuanto-cobro-core";

type PasoPerfil = Parameters<typeof getCuantoCobroMissingFields>[0];

/** Refleja `PROFILE_RESULT_STEPS` de packages/cuanto-cobro-core/src/calculate-cuanto-cobro.ts (no se exporta). */
const PASOS_DEL_PERFIL: readonly PasoPerfil[] = [
  "currency",
  "employment",
  "personal",
  "business",
  "team",
  "availability",
  "investment",
  "emergency-fund",
  "savings-goals",
  "commercial-positioning",
];

export type ResumenPerfil = {
  completo: boolean;
  faltan: string[];
  necesidadMensual: number;
  horasFacturablesMes: number;
  valorHora: number | null;
  gastosPersonales: number;
  gastosNegocio: number;
  reservas: number;
};

function monto(valor: string): number {
  return parseCuantoCobroAmount(valor) ?? 0;
}

export function resumirPerfil(p: CuantoCobroProfileInput): ResumenPerfil {
  const faltan = [
    ...new Set(
      PASOS_DEL_PERFIL.flatMap((paso) => getCuantoCobroMissingFields(paso, p, INITIAL_CUANTO_COBRO_QUOTE)),
    ),
  ];

  const necesidadMensual = getProfileMonthlyNeed(p);
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
    gastosPersonales,
    gastosNegocio,
    reservas,
  };
}
