/**
 * "¿Qué proveedores activos tuvieron gasto el mes pasado y todavía no
 * tienen ninguno cargado este mes?" — la misma pregunta la usa la
 * pantalla de resumen (para mostrar el aviso) y el correo diario (para
 * reclamarlo). Antes vivía escrita dos veces con el mismo patrón
 * Prisma; si una copia cambiaba y la otra no, pantalla y correo podían
 * terminar en desacuerdo sobre qué significa "falta cargar esto". Ahora
 * las dos llaman a `findVendorsMissingThisPeriod`.
 *
 * (La ruta `expenses/copy-previous` NO usa esta función: ahí la pregunta
 * es otra — "qué entradas del mes anterior copiar" — y necesita las
 * entradas completas con sus montos y allocations, no la lista de
 * proveedores. Ver el comentario en esa ruta.)
 */
import { prisma } from "@/lib/prisma";
import { previousPeriod } from "./expense-form";

export type MissingVendor = { id: number; key: string; name: string };

/**
 * La decisión pura: de los proveedores con gasto el mes anterior, cuáles
 * no aparecen entre los `vendorId` ya cargados este mes. Separada de la
 * consulta a Prisma para poder probarla sin base de datos.
 */
export function vendorsAbsentThisMonth(
  previousMonthEntries: Array<{ vendorId: number; vendor: MissingVendor }>,
  loadedThisMonthVendorIds: Iterable<number>,
): MissingVendor[] {
  const cargados = new Set(loadedThisMonthVendorIds);
  const vistos = new Set<number>();
  const faltantes: MissingVendor[] = [];
  for (const entry of previousMonthEntries) {
    if (cargados.has(entry.vendorId)) continue;
    if (vistos.has(entry.vendorId)) continue;
    vistos.add(entry.vendorId);
    faltantes.push(entry.vendor);
  }
  return faltantes;
}

/**
 * Trae de Prisma lo mínimo para responder la pregunta y delega la
 * decisión en `vendorsAbsentThisMonth`. Sin lógica propia más allá de
 * armar los datos para esa función.
 */
export async function findVendorsMissingThisPeriod(input: {
  year: number;
  month: number;
}): Promise<MissingVendor[]> {
  const { year, month } = input;
  const anterior = previousPeriod(year, month);

  const [entradasEsteMes, entradasMesAnterior] = await Promise.all([
    prisma.expenseEntry.findMany({
      where: { periodYear: year, periodMonth: month },
      select: { vendorId: true },
    }),
    prisma.expenseEntry.findMany({
      where: {
        periodYear: anterior.year,
        periodMonth: anterior.month,
        vendor: { active: true },
      },
      include: { vendor: true },
    }),
  ]);

  return vendorsAbsentThisMonth(
    entradasMesAnterior.map((entry) => ({
      vendorId: entry.vendorId,
      vendor: { id: entry.vendor.id, key: entry.vendor.key, name: entry.vendor.name },
    })),
    entradasEsteMes.map((entry) => entry.vendorId),
  );
}
