import "server-only";
import { prisma } from "@repo/db";
import { countMembersByStatus } from "@repo/db/fotoffice-members";
import type { ModuleLevels } from "@/lib/permissions/levels";
import { homeWidgetGates } from "./gates";
import { loadDuesOverview } from "@/lib/membership/dues-overview";
import { listAwaitingPayment } from "@/lib/membership/inbox";
import { decimalArsToMinor } from "@/lib/membership/money";
import { loadMembersForRaffle } from "@/lib/raffles/repository";
import { isEligible } from "@/lib/raffles/eligibility";
import { listPendingAwards } from "@/lib/raffles/delivery";
import { listAccounts, movementsForBalance } from "@/lib/cash/repository";
import { balancesByAccountMinor } from "@/lib/cash/balance";
import { listBookingsInRange, listSpaces } from "@/lib/bookings/repository";
import { countRequestsByFilter } from "@/lib/coverages/repository";

/**
 * Los números del inicio de la institución.
 *
 * ── Las reglas ──
 *
 * - Nada se recalcula acá: cada número sale de la misma función que usa la pantalla de su
 *   módulo. Si el inicio dijera "12 socios con deuda" y la pantalla de Cuotas 14, el inicio no
 *   serviría para nada. Lo único nuevo es lo cobrado en el mes, que no existía.
 * - Cada bloque aparece sólo si quien mira tiene, en ese módulo, el nivel que exige la pantalla
 *   a la que lleva (`homeWidgetGates`). Un número que lleva a un "no tenés permiso" es peor que
 *   ninguno. Los niveles salen de `getModuleLevels`, la misma cuenta que usan menú y páginas.
 * - Cada bloque se calcula por separado y un error en uno no tumba el inicio: queda vacío y
 *   se registra. El inicio es la puerta de entrada; no puede caerse por la caja.
 */

export type HomeData = {
  socios: { total: number; activos: number; suspendidos: number; alDia: number } | null;
  cuotas: {
    deudaTotalMinor: number;
    sociosConVencidas: number;
    cobradoMesMinor: number;
    pagosMes: number;
    ultimosPagos: { id: string; nombre: string; numero: string; montoMinor: number; fecha: Date }[];
  } | null;
  altas: { pendientes: number; aprobadasSinPagar: number } | null;
  caja: { cuentas: { id: string; nombre: string; saldoMinor: number }[]; totalMinor: number } | null;
  reservas: {
    proximas: { id: string; espacio: string; contacto: string; inicio: Date; estado: string }[];
    aAprobar: number;
  } | null;
  sorteo: { id: string; titulo: string; estado: string; sorteaEl: Date; participantes: number | null } | null;
  premiosPorEntregar: number | null;
  coberturas: { nuevas: number; urgentes: number } | null;
  pedidosNuevos: number | null;
};

async function seguro<T>(nombre: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[fotoffice][inicio] no se pudo calcular ${nombre}`, {
      detalle: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Primer instante del mes en curso, en hora argentina (UTC−3, sin horario de verano). */
export function inicioDelMesArgentina(now: Date): Date {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const anio = Number(partes.find((p) => p.type === "year")?.value);
  const mes = Number(partes.find((p) => p.type === "month")?.value);
  return new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0));
}

export async function loadWorkspaceHome(input: {
  workspaceId: string;
  levels: ModuleLevels;
  now?: Date;
}): Promise<HomeData> {
  const { workspaceId } = input;
  const now = input.now ?? new Date();
  const ver = homeWidgetGates(input.levels);
  const cobra = ver.cuotas;
  const enUnaSemana = new Date(now.getTime() + 7 * 86_400_000);

  const [socios, cuotas, cobradoMes, altas, caja, reservas, sorteo, premios, coberturas, pedidos] =
    await Promise.all([
      ver.socios
        ? seguro("socios", async () => {
            const [conteo, padron] = await Promise.all([
              countMembersByStatus(workspaceId),
              loadMembersForRaffle(workspaceId),
            ]);
            // "Al día" con la misma regla que el socio ve en su portal y que decide los sorteos.
            const alDia = padron.filter((m) => isEligible(m, now).eligible).length;
            return { total: conteo.total, activos: conteo.ACTIVE, suspendidos: conteo.SUSPENDED, alDia };
          })
        : null,
      cobra ? seguro("cuotas", () => loadDuesOverview(workspaceId, { now })) : null,
      cobra
        ? seguro("cobrado del mes", () =>
            prisma.membershipPayment.aggregate({
              where: { workspaceId, status: "ACREDITADO", paidAt: { gte: inicioDelMesArgentina(now) } },
              _sum: { amountArs: true },
              _count: { _all: true },
            }),
          )
        : null,
      ver.altas
        ? seguro("altas", async () => {
            const [pendientes, impagas] = await Promise.all([
              prisma.membershipApplication.count({ where: { workspaceId, status: "PENDIENTE" } }),
              listAwaitingPayment(workspaceId),
            ]);
            return { pendientes, aprobadasSinPagar: impagas.length };
          })
        : null,
      ver.caja
        ? seguro("caja", async () => {
            const [cuentas, movimientos] = await Promise.all([
              listAccounts(workspaceId),
              movementsForBalance(workspaceId),
            ]);
            const saldos = balancesByAccountMinor(cuentas.map((c) => c.id), movimientos);
            const filas = cuentas.map((c) => ({ id: c.id, nombre: c.name, saldoMinor: saldos.get(c.id) ?? 0 }));
            return { cuentas: filas, totalMinor: filas.reduce((s, c) => s + c.saldoMinor, 0) };
          })
        : null,
      ver.reservas
        ? seguro("reservas", async () => {
            const [filas, espacios] = await Promise.all([
              listBookingsInRange(workspaceId, { startAt: now, endAt: enUnaSemana }),
              listSpaces(workspaceId, { includeInactive: true }),
            ]);
            const nombre = new Map(espacios.map((e) => [e.id, e.name]));
            const vivas = filas
              .filter((b) => ["CONFIRMED", "PENDING_APPROVAL", "HOLD"].includes(b.status))
              .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
            return {
              proximas: vivas.slice(0, 5).map((b) => ({
                id: b.id,
                espacio: nombre.get(b.spaceId) ?? "Espacio",
                contacto: b.contactName,
                inicio: b.startAt,
                estado: b.status,
              })),
              aAprobar: vivas.filter((b) => b.status === "PENDING_APPROVAL").length,
            };
          })
        : null,
      ver.sorteos
        ? seguro("sorteo", () =>
            prisma.raffle.findFirst({
              where: { workspaceId, status: { in: ["BORRADOR", "ANUNCIADO", "PADRON_SELLADO", "SORTEADO"] } },
              orderBy: { drawsAt: "asc" },
              select: { id: true, title: true, status: true, drawsAt: true, entrantsCount: true },
            }),
          )
        : null,
      ver.sorteos
        ? seguro("premios", async () => (await listPendingAwards(workspaceId)).length)
        : null,
      ver.coberturas
        ? seguro("coberturas", () => countRequestsByFilter({ workspaceId, now }))
        : null,
      ver.pedidos
        ? seguro("pedidos", () => prisma.serviceSalesLead.count({ where: { workspaceId, status: "NEW" } }))
        : null,
    ]);

  return {
    socios,
    cuotas: cuotas
      ? {
          deudaTotalMinor: cuotas.totalDebtMinor,
          sociosConVencidas: cuotas.debtors.filter((d) => d.overdueCharges > 0).length,
          cobradoMesMinor: cobradoMes?._sum.amountArs ? decimalArsToMinor(cobradoMes._sum.amountArs) : 0,
          pagosMes: cobradoMes?._count._all ?? 0,
          ultimosPagos: cuotas.recentPayments
            .filter((p) => p.status === "ACREDITADO")
            .slice(0, 5)
            .map((p) => ({
              id: p.id,
              nombre: p.fullName,
              numero: p.memberNumber,
              montoMinor: p.amountMinor,
              fecha: p.paidAt ?? p.createdAt,
            })),
        }
      : null,
    altas,
    caja,
    reservas,
    sorteo: sorteo
      ? {
          id: sorteo.id,
          titulo: sorteo.title,
          estado: sorteo.status,
          sorteaEl: sorteo.drawsAt,
          participantes: sorteo.entrantsCount,
        }
      : null,
    premiosPorEntregar: premios,
    coberturas: coberturas ? { nuevas: coberturas.nuevas, urgentes: coberturas.urgentes } : null,
    pedidosNuevos: pedidos,
  };
}
