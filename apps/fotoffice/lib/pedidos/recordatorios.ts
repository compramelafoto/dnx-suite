import "server-only";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { correoValido, destinoDe } from "@/lib/plantillas/contexto";
import { leerAutomatico } from "@/lib/plantillas/definiciones";
import {
  candadoDeDireccion, completarTextos, enviarCorreo, liberarReserva, MENSAJES_ENVIO, reservarEnvioAutomatico, type CtxEnvio, type DepsEnvio,
} from "@/lib/plantillas/envio";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { ORDERS_MODULE_KEY } from "./acceso";
import type { DepsEnlace } from "./enlace";
import { imputadoPorCuota } from "./estado";
import { fechaCorta, pesosConCentavos } from "./pantalla";
import { fechaDeBase, fechaParaBase, pesosDeBase, planesDe } from "./plan";
import { aCentavos, desdeCentavos, sumarDias } from "./plan-cuotas";
import { asegurarPlantillaRecordatorio } from "./plantillas";
import { contextoDeMensajePedido } from "./recibos";

/**
 * Recordatorio de vencimiento de cuotas (etapa 3, Entrega B1). Lo corre una tarea diaria
 * (`app/api/cron/pedidos-recordatorios`, 13:00 UTC = 10:00 de Buenos Aires).
 *
 * Para cada organización con los recordatorios encendidos (Configuración → Pedidos,
 * `FotofficePedidoAjustes.reminderEnabled`) y el módulo Pedidos encendido, toma las cuotas:
 * - con saldo (importe menos lo imputado por cobros sin anular);
 * - de pedidos que no están cancelados;
 * - cuyo vencimiento cae entre hoy y hoy + `reminderDays` (días de calendario de Buenos Aires,
 *   los dos extremos incluidos);
 * - que todavía no tienen un `FotofficeCuotaRecordatorio` para ese (cuota, vencimiento): si se
 *   mueve el vencimiento, vuelve a avisar.
 *
 * Y le manda al contacto del pedido el correo de la plantilla automática `RECORDATORIO_CUOTA`.
 *
 * - **Una vez por (cuota, vencimiento):** antes de mandar se inserta el `FotofficeCuotaRecordatorio`
 *   como reserva (el único frena a una corrida simultánea) junto con la reserva del registro del
 *   mensaje. Si el correo no sale, se borran las dos y se vuelve a intentar al día siguiente.
 * - **Topes:** es un correo AUTOMÁTICO: cuenta en el tope diario de los automáticos de la
 *   organización y, por corrida, como mucho `TOPE_RECORDATORIOS_CORRIDA` intentos entre todas.
 *   NO se frena por la regla de una respuesta automática por dirección cada 24 h: es
 *   transaccional, como el recibo de pago.
 * - **Historial:** queda registrado en el pedido (`entityType` PEDIDO + su id).
 *
 * La tarea nunca crea filas de ajustes (la de DNX nace al abrir Configuración → Pedidos o la lista
 * de Pedidos). Nunca lanza por una organización y el registro sólo guarda códigos.
 */

export const TOPE_RECORDATORIOS_CORRIDA = 200;
/** Cuotas que se leen por organización (de la que vence antes a la que vence después). */
export const CUOTAS_POR_ORGANIZACION = 2000;

export type ReporteRecordatorios = {
  /** Organizaciones con los recordatorios encendidos que se revisaron. */
  organizaciones: number;
  enviados: number;
  fallidos: number;
  /** Sin correo válido, o ya reservado por otra corrida. */
  salteados: number;
  /** Organizaciones que llegaron al tope diario de automáticos. */
  conTopeDiario: number;
  /** La corrida llegó a `TOPE_RECORDATORIOS_CORRIDA` y quedaron cuotas para mañana. */
  topeCorrida: boolean;
};

export type DepsRecordatorios = DepsEnvio & DepsEnlace & {
  /** Tope por corrida (las pruebas lo bajan). */
  tope?: number;
};

function codigo(e: unknown): string {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : "desconocido";
}

/** PURO. Primer y último día ("aaaa-mm-dd", Buenos Aires) de los vencimientos que se avisan hoy. */
export function ventanaDeRecordatorio(ahora: Date, dias: number): { desde: string; hasta: string } {
  const desde = diaEnBuenosAires(ahora);
  return { desde, hasta: sumarDias(desde, Math.max(0, Math.trunc(dias))) };
}

function ctxDelSistema(workspaceId: string): CtxEnvio {
  return { workspaceId, userId: null, userLabel: null, userName: null, userEmail: null, role: null };
}

type Contador = { intentos: number; tope: number };
type Automatico = NonNullable<Awaited<ReturnType<typeof leerAutomatico>>>;
type Candidata = { cuotaId: string; pedidoId: string; clientId: string; dueDate: string; saldo: number };

/** Las cuotas de una organización que tienen que recibir el recordatorio hoy, en orden de vencimiento. */
async function candidatasDe(workspaceId: string, dias: number, ahora: Date): Promise<Candidata[]> {
  const { desde, hasta } = ventanaDeRecordatorio(ahora, dias);
  const cuotas = await prisma.fotofficePedidoCuota.findMany({
    where: { workspaceId, dueDate: { gte: fechaParaBase(desde), lte: fechaParaBase(hasta) } },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    select: { id: true, pedidoId: true, dueDate: true, amountArs: true },
    take: CUOTAS_POR_ORGANIZACION,
  });
  if (cuotas.length === 0) return [];
  const pedidoIds = [...new Set(cuotas.map((c) => c.pedidoId))];
  const [pedidos, avisadas, planes] = await Promise.all([
    prisma.fotofficePedido.findMany({
      where: { workspaceId, id: { in: pedidoIds }, status: { not: "CANCELADO" } },
      select: { id: true, clientId: true },
    }),
    prisma.fotofficeCuotaRecordatorio.findMany({
      where: { workspaceId, cuotaId: { in: cuotas.map((c) => c.id) } },
      select: { cuotaId: true, dueDate: true },
    }),
    planesDe(workspaceId, pedidoIds),
  ]);
  const clienteDe = new Map(pedidos.map((p) => [p.id, p.clientId]));
  const ya = new Set(avisadas.map((a) => `${a.cuotaId}:${fechaDeBase(a.dueDate)}`));
  const imputado = new Map<string, number>();
  for (const plan of planes.values()) for (const [id, c] of imputadoPorCuota(plan.imputaciones)) imputado.set(id, c);
  return cuotas.flatMap((c): Candidata[] => {
    const clientId = clienteDe.get(c.pedidoId);
    if (!clientId) return [];
    const dueDate = fechaDeBase(c.dueDate);
    if (ya.has(`${c.id}:${dueDate}`)) return [];
    const saldo = aCentavos(pesosDeBase(c.amountArs)) - (imputado.get(c.id) ?? 0);
    if (saldo <= 0) return [];
    return [{ cuotaId: c.id, pedidoId: c.pedidoId, clientId, dueDate, saldo: desdeCentavos(saldo) }];
  });
}

/** Los recordatorios de una organización. */
async function recordatoriosDe(
  workspaceId: string,
  dias: number,
  ahora: Date,
  reporte: ReporteRecordatorios,
  contador: Contador,
  deps: DepsRecordatorios,
): Promise<void> {
  if (!(await isModuleEnabledForWorkspace(workspaceId, ORDERS_MODULE_KEY))) return;
  await asegurarPlantillaRecordatorio(workspaceId);
  const auto = await leerAutomatico(workspaceId, "RECORDATORIO_CUOTA");
  if (!auto || !auto.enabled || auto.channel !== "EMAIL" || auto.entityType !== "PEDIDO") return;
  for (const c of await candidatasDe(workspaceId, dias, ahora)) {
    if (contador.intentos >= contador.tope) {
      reporte.topeCorrida = true;
      return;
    }
    if ((await recordatorioDe(workspaceId, c, auto, ahora, reporte, contador, deps)) === "CORTAR") return;
  }
}

/** Borra la reserva del (cuota, vencimiento) para que se vuelva a intentar mañana. Nunca lanza. */
async function liberarRecordatorio(workspaceId: string, c: Candidata): Promise<void> {
  try {
    await prisma.fotofficeCuotaRecordatorio.deleteMany({ where: { workspaceId, cuotaId: c.cuotaId, dueDate: fechaParaBase(c.dueDate) } });
  } catch (e) {
    console.error("[pedidos] no se pudo liberar un recordatorio de cuota", { codigo: codigo(e) });
  }
}

/** El recordatorio de una cuota. "CORTAR": no seguir con esta organización (tope, plantilla rota o sin dirección pública). */
async function recordatorioDe(
  workspaceId: string,
  c: Candidata,
  auto: Automatico,
  ahora: Date,
  reporte: ReporteRecordatorios,
  contador: Contador,
  deps: DepsRecordatorios,
): Promise<"SEGUIR" | "CORTAR"> {
  // Primero lo barato: sin correo no hace falta armar enlaces ni cargar la firma.
  const destino = await destinoDe(workspaceId, "CLIENTE", c.clientId);
  if (!destino || !correoValido(destino.email)) {
    reporte.salteados++;
    return "SEGUIR";
  }
  const email = destino.email;
  const leido = await contextoDeMensajePedido(
    workspaceId, c.pedidoId, { cuotaId: c.cuotaId, usuario: { nombre: null, email: null }, ahora, textos: [auto.subject, auto.body] }, deps,
  );
  if (!leido.ok) {
    console.warn("[pedidos] el recordatorio de cuota no se pudo armar", { codigo: leido.codigo });
    if (leido.codigo === "SIN_ENLACE") {
      reporte.fallidos++;
      return "CORTAR";
    }
    reporte.salteados++;
    return "SEGUIR";
  }
  const contexto = {
    ...leido.contexto,
    variables: { ...leido.contexto.variables, cuota: { vence: fechaCorta(c.dueDate), importe: pesosConCentavos(c.saldo) } },
  };
  const textos = completarTextos(contexto, "PEDIDO", auto.subject, auto.body);
  if (!textos.ok) {
    // La plantilla no sirve para nadie: no tiene sentido seguir con esta organización.
    console.warn("[pedidos] la plantilla del recordatorio de cuota tiene errores", { codigo: "PLANTILLA_CON_ERRORES" });
    reporte.fallidos++;
    return "CORTAR";
  }

  // Reservas: el (cuota, vencimiento) —su único frena a otra corrida— y el registro del mensaje,
  // con el candado de la dirección (el de todos los automáticos a una persona). El correo sale
  // DESPUÉS de soltar el candado.
  const reserva = await prisma.$transaction(async (tx) => {
    await candadoDeDireccion(tx, workspaceId, email);
    const r = await tx.fotofficeCuotaRecordatorio.createMany({
      data: [{ workspaceId, cuotaId: c.cuotaId, dueDate: fechaParaBase(c.dueDate), sentAt: ahora }],
      skipDuplicates: true,
    });
    if (r.count === 0) return null;
    return reservarEnvioAutomatico(tx, { workspaceId, entityType: "PEDIDO", entityId: c.pedidoId, templateId: auto.id, toAddress: email });
  });
  if (!reserva) {
    reporte.salteados++;
    return "SEGUIR";
  }
  contador.intentos++;
  let r: Awaited<ReturnType<typeof enviarCorreo>>;
  try {
    r = await enviarCorreo(
      ctxDelSistema(workspaceId),
      {
        entityType: "CLIENTE", entityId: c.clientId, templateId: auto.id, asunto: textos.asunto, cuerpo: textos.cuerpo, automatico: true,
        registroId: reserva, registrarEn: { entityType: "PEDIDO", entityId: c.pedidoId },
      },
      { enviar: deps.enviar, ahora: () => ahora },
      { tipoPlantilla: "PEDIDO" },
    );
  } catch (e) {
    await liberarReserva(workspaceId, reserva);
    await liberarRecordatorio(workspaceId, c);
    throw e;
  }
  if (r.ok) {
    reporte.enviados++;
    return "SEGUIR";
  }
  // No salió: se libera el (cuota, vencimiento) para mañana. La reserva del mensaje se borra si no
  // se llegó a registrar (tope, texto); si el proveedor lo rechazó, queda registrado como fallido.
  if (!r.registrado) await liberarReserva(workspaceId, reserva);
  await liberarRecordatorio(workspaceId, c);
  if (r.error === MENSAJES_ENVIO.topeAutomaticos) {
    contador.intentos--;
    reporte.conTopeDiario++;
    return "CORTAR";
  }
  console.warn("[pedidos] el recordatorio de cuota no salió", { codigo: r.registrado ? "REGISTRADO_FALLIDO" : "NO_ENVIADO" });
  reporte.fallidos++;
  return "SEGUIR";
}

/** La corrida diaria. Devuelve sólo contadores (sin datos de nadie). */
export async function enviarRecordatoriosDeCuotas(deps: DepsRecordatorios = {}): Promise<ReporteRecordatorios> {
  const reporte: ReporteRecordatorios = { organizaciones: 0, enviados: 0, fallidos: 0, salteados: 0, conTopeDiario: 0, topeCorrida: false };
  const ahora = (deps.ahora ?? (() => new Date()))();
  const ajustes = await prisma.fotofficePedidoAjustes.findMany({
    where: { reminderEnabled: true },
    select: { workspaceId: true, reminderDays: true },
    orderBy: [{ workspaceId: "asc" }],
    take: 1000,
  });
  const contador: Contador = { intentos: 0, tope: deps.tope ?? TOPE_RECORDATORIOS_CORRIDA };
  for (const a of ajustes) {
    if (contador.intentos >= contador.tope) {
      reporte.topeCorrida = true;
      break;
    }
    reporte.organizaciones++;
    try {
      await recordatoriosDe(a.workspaceId, a.reminderDays, ahora, reporte, contador, deps);
    } catch (e) {
      console.error("[pedidos] fallaron los recordatorios de una organización", { codigo: codigo(e) });
    }
  }
  return reporte;
}
