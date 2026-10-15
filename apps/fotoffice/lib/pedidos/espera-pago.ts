import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { leerAjustesCobro } from "@/lib/cobro-ajustes/ajustes";
import { datosTransferenciaPublicos } from "@/lib/cobro-ajustes/datos";
import { imputadoPorCuota } from "./estado";
import { planesDe } from "./plan";
import { aCentavos, desdeCentavos } from "./plan-cuotas";

/**
 * Pago esperado por transferencia (etapa B, 15/10/2026). Desde el enlace del pedido, el cliente elige
 * «Pagar por transferencia» en una cuota: se anota lo que se espera (el saldo de la cuota) y el
 * pedido muestra "Esperando tu transferencia". La conciliación (más adelante) lo busca entre las
 * transferencias recibidas; también se cierra sola cuando la cuota queda paga (`cerrarEsperasPagas`).
 *
 * Monto único (opcional, Configuración → Presupuestos): a lo esperado se le suman de 1 a 99 pesos,
 * el menor que no repita otra espera abierta de la organización, para que dos transferencias del
 * mismo monto no se confundan. El índice único parcial de la base frena la carrera.
 */

export const MENSAJES_ESPERA = {
  noExiste: "No encontramos esa cuota.",
  cancelado: "El pedido está cancelado: no admite pagos.",
  sinSaldo: "Esa cuota ya está paga.",
  sinDatos: "La organización todavía no cargó sus datos para transferir. Escribile para pagar de otra forma.",
  sinMontoUnico: "No pudimos reservar un monto para tu transferencia. Escribile a la organización.",
  fallo: "No pudimos anotar tu transferencia. Probá de nuevo en un rato.",
} as const;

export type ResultadoEspera = { ok: true; importe: number; importeAPagar: number } | { ok: false; error: string };

/** El menor `esperado + k` (k de 1 a 99 pesos) que no está ocupado. En pesos. null si no queda ninguno. */
export function montoUnicoLibre(esperado: number, ocupados: ReadonlySet<number>): number | null {
  const base = aCentavos(esperado);
  const usados = new Set([...ocupados].map(aCentavos));
  for (let k = 1; k <= 99; k += 1) {
    const c = base + k * 100;
    if (!usados.has(c)) return desdeCentavos(c);
  }
  return null;
}

const pesos = (v: unknown): number => Number(v);

export async function esperarTransferencia(input: { workspaceId: string; pedidoId: string; cuotaId: string }): Promise<ResultadoEspera> {
  const { workspaceId, pedidoId, cuotaId } = input;
  const ajustes = await leerAjustesCobro(workspaceId);
  if (!datosTransferenciaPublicos(ajustes)) return { ok: false, error: MENSAJES_ESPERA.sinDatos };
  const pedido = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true, status: true } });
  if (!pedido) return { ok: false, error: MENSAJES_ESPERA.noExiste };
  const plan = (await planesDe(workspaceId, [pedidoId])).get(pedidoId) ?? { cuotas: [], imputaciones: [] };
  const cuota = plan.cuotas.find((c) => c.id === cuotaId);
  if (!cuota) return { ok: false, error: MENSAJES_ESPERA.noExiste };
  if (pedido.status === "CANCELADO") return { ok: false, error: MENSAJES_ESPERA.cancelado };
  const saldo = aCentavos(cuota.amountArs) - (imputadoPorCuota(plan.imputaciones).get(cuota.id) ?? 0);
  if (saldo <= 0) return { ok: false, error: MENSAJES_ESPERA.sinSaldo };
  const importe = desdeCentavos(saldo);

  // Una sola abierta por cuota: si ya hay, es la misma.
  const abierta = await prisma.fotofficeEsperaPago.findFirst({
    where: { workspaceId, cuotaId, estado: "ESPERANDO" },
    select: { importeEsperadoArs: true, importeUnicoArs: true },
  });
  if (abierta) {
    return { ok: true, importe: pesos(abierta.importeEsperadoArs), importeAPagar: pesos(abierta.importeUnicoArs ?? abierta.importeEsperadoArs) };
  }

  for (let intento = 0; intento < 3; intento += 1) {
    let unico: number | null = null;
    if (ajustes.montoUnico) {
      const otras = await prisma.fotofficeEsperaPago.findMany({
        where: { workspaceId, estado: "ESPERANDO", NOT: { importeUnicoArs: null } },
        select: { importeUnicoArs: true },
      });
      unico = montoUnicoLibre(importe, new Set(otras.map((o) => pesos(o.importeUnicoArs))));
      if (unico === null) return { ok: false, error: MENSAJES_ESPERA.sinMontoUnico };
    }
    try {
      await prisma.fotofficeEsperaPago.create({
        data: { id: randomUUID(), workspaceId, pedidoId, cuotaId, importeEsperadoArs: importe.toFixed(2), importeUnicoArs: unico === null ? null : unico.toFixed(2) },
      });
      return { ok: true, importe, importeAPagar: unico ?? importe };
    } catch (e) {
      // Otra espera ganó la carrera (misma cuota o mismo monto único): se vuelve a mirar.
      if ((e as { code?: unknown } | null)?.code !== "P2002") {
        console.error("[pedidos] esperarTransferencia falló", { codigo: typeof (e as { code?: unknown })?.code === "string" ? (e as { code: string }).code : null });
        return { ok: false, error: MENSAJES_ESPERA.fallo };
      }
      const ya = await prisma.fotofficeEsperaPago.findFirst({ where: { workspaceId, cuotaId, estado: "ESPERANDO" }, select: { importeEsperadoArs: true, importeUnicoArs: true } });
      if (ya) return { ok: true, importe: pesos(ya.importeEsperadoArs), importeAPagar: pesos(ya.importeUnicoArs ?? ya.importeEsperadoArs) };
    }
  }
  return { ok: false, error: MENSAJES_ESPERA.fallo };
}

/** Las esperas abiertas de un pedido: cuota → lo que hay que transferir. Sin la tabla, vacío. */
export async function esperasAbiertas(workspaceId: string, pedidoId: string): Promise<Map<string, number>> {
  try {
    const filas = await prisma.fotofficeEsperaPago.findMany({
      where: { workspaceId, pedidoId, estado: "ESPERANDO" },
      select: { cuotaId: true, importeEsperadoArs: true, importeUnicoArs: true },
    });
    return new Map(filas.map((f) => [f.cuotaId, pesos(f.importeUnicoArs ?? f.importeEsperadoArs)]));
  } catch {
    return new Map();
  }
}
