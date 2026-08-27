import { Prisma } from "@repo/db";
import { monthlyAmountFor, type FeeScale } from "./amounts";
import { monthlyDuePeriod } from "./periods";

/**
 * Qué cuotas hay que generar para un período.
 *
 * Función pura: recibe el padrón y devuelve los cargos a crear. Generar cuotas es la
 * operación que le toca el bolsillo a 152 personas a la vez, así que la decisión de a quién
 * y por cuánto tiene que poder probarse sin base de datos.
 */

export type MemberForDues = {
  id: string;
  status: "ACTIVE" | "SUSPENDED" | "INACTIVE";
  joinedAt: Date;
  feeScale: FeeScale;
  ownDuesAmount: Prisma.Decimal | null;
  categoryId: string | null;
  /** Si su categoría genera cuotas. Los honorarios, por ejemplo, no. */
  categoryGeneratesDues: boolean;
  /** Valor de referencia vigente para su categoría en este período. */
  referenceAmount: Prisma.Decimal | null;
};

export type PlannedCharge = {
  memberId: string;
  period: string;
  amountArs: Prisma.Decimal;
  dueDate: Date;
};

export type SkippedMember = {
  memberId: string;
  reason:
    | "no está activo"
    | "su categoría no genera cuotas"
    | "está exento"
    | "todavía no era socio"
    | "sin valor de cuota vigente";
};

export type MonthlyPlan = {
  charges: PlannedCharge[];
  skipped: SkippedMember[];
};

export function planMonthlyCharges(input: {
  /** `AAAA-MM`. */
  period: string;
  members: MemberForDues[];
  dueDay: number;
  floorMultiple: number;
  /** Si el mes en que se asoció le cobra cuota cuando entró antes del día de vencimiento. */
  countJoinMonthIfBeforeDueDay: boolean;
}): MonthlyPlan {
  const { dueDate, periodStart } = periodBounds(input.period, input.dueDay);

  const charges: PlannedCharge[] = [];
  const skipped: SkippedMember[] = [];

  for (const socio of input.members) {
    // Un suspendido sigue debiendo: la suspensión es una sanción, no una exención. Pero uno
    // dado de baja no genera cuotas nuevas.
    if (socio.status === "INACTIVE") {
      skipped.push({ memberId: socio.id, reason: "no está activo" });
      continue;
    }
    if (!socio.categoryGeneratesDues) {
      skipped.push({ memberId: socio.id, reason: "su categoría no genera cuotas" });
      continue;
    }
    if (socio.feeScale === "EXENTA" && !socio.ownDuesAmount) {
      skipped.push({ memberId: socio.id, reason: "está exento" });
      continue;
    }

    // Quien se asoció después del período no debe esa cuota. En el mes en que entró, depende
    // de la configuración: si entró el 25 y la cuota vencía el 10, cobrarle ese mes sería
    // cobrarle por días en los que no era socio.
    const entroDespuesDelPeriodo = socio.joinedAt >= startOfNextMonth(periodStart);
    if (entroDespuesDelPeriodo) {
      skipped.push({ memberId: socio.id, reason: "todavía no era socio" });
      continue;
    }
    const entroEnEstePeriodo = socio.joinedAt >= periodStart;
    if (entroEnEstePeriodo) {
      const entroAntesDelVencimiento = socio.joinedAt < dueDate;
      const corresponde = input.countJoinMonthIfBeforeDueDay && entroAntesDelVencimiento;
      if (!corresponde) {
        skipped.push({ memberId: socio.id, reason: "todavía no era socio" });
        continue;
      }
    }

    if (!socio.referenceAmount) {
      skipped.push({ memberId: socio.id, reason: "sin valor de cuota vigente" });
      continue;
    }

    const amountArs = monthlyAmountFor({
      referenceAmount: socio.referenceAmount,
      scale: socio.feeScale,
      ownAmount: socio.ownDuesAmount,
      floorMultiple: input.floorMultiple,
    });

    // Una cuota en cero no es una cuota: sería un cargo que nadie tiene que pagar y que
    // ensuciaría el cálculo de mora.
    if (amountArs.lte(0)) {
      skipped.push({ memberId: socio.id, reason: "está exento" });
      continue;
    }

    charges.push({ memberId: socio.id, period: input.period, amountArs, dueDate });
  }

  return { charges, skipped };
}

function periodBounds(period: string, dueDay: number): { periodStart: Date; dueDate: Date } {
  const [anio = "1970", mes = "01"] = period.split("-");
  const periodStart = new Date(Date.UTC(Number(anio), Number(mes) - 1, 1));
  const { dueDate } = monthlyDuePeriod(period, dueDay);
  return { periodStart, dueDate };
}

function startOfNextMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

/** `AAAA-MM` del mes de una fecha, en UTC. */
export function periodOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
