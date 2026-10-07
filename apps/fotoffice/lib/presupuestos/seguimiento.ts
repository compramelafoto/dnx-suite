import "server-only";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { numeroDe } from "@/lib/numeracion/asignar";
import { yaRespondida } from "@/lib/plantillas/automaticos";
import { contextoDe, correoValido } from "@/lib/plantillas/contexto";
import { leerAutomatico } from "@/lib/plantillas/definiciones";
import { enviarCorreo, MENSAJES_ENVIO, type CtxEnvio, type DepsEnvio } from "@/lib/plantillas/envio";
import { QUOTES_MODULE_KEY } from "./acceso";
import { ENTIDAD_NUMERACION, esEstadoPresupuesto, type EstadoPresupuesto } from "./constantes";
import { pesos } from "./editor";
import { resolverClaveDeEnlace, tokenDeVersion, urlDelPresupuesto } from "./enlace";
import { ddmmaaaa, origenDe, textosFinales } from "./envio";
import { diaEnBuenosAires, estadoEfectivo } from "./estados";
import { asegurarPlantillaSeguimiento } from "./plantillas";
import { sitioDelWorkspace } from "./sitio";
import type { TotalesGuardados } from "./versiones";

/**
 * Seguimiento automático de presupuestos (etapa 2, Entrega B, spec §2 B.14). Lo corre una tarea
 * diaria (`app/api/cron/presupuestos-seguimiento`, 10:00 de Buenos Aires).
 *
 * Para cada organización con el seguimiento encendido (Configuración → Presupuestos) y el módulo
 * Presupuestos encendido, toma los presupuestos ENVIADO o VISTO (sin aceptar, ni rechazar, ni
 * vencer: el vencido se calcula con la validez) cuya versión vigente se envió hace
 * `followUpDays` días de calendario de Buenos Aires o más, y le manda a la persona de la consulta
 * el correo de la plantilla automática `PRESUPUESTO_SEGUIMIENTO` (con el enlace a la versión
 * vigente).
 *
 * - **Una vez por versión:** antes de enviar busca un mensaje de esa plantilla en la consulta
 *   registrado desde el envío de la versión (enviado o fallido). Una versión nueva vuelve a
 *   contar desde su envío.
 * - **Topes:** es un correo AUTOMÁTICO (`enviarCorreo` con `automatico`): cuenta en el tope diario
 *   de los automáticos, sigue la regla de una respuesta automática por dirección cada 24 h (si
 *   le tocó otra, se intenta al día siguiente) y, por corrida, como mucho
 *   `TOPE_SEGUIMIENTOS_CORRIDA` intentos entre todas las organizaciones.
 * - **Historial:** el correo queda registrado en la consulta (`FotofficeMessage`, autor
 *   "Automático") y el historial de presupuestos lo muestra como "Seguimiento del presupuesto…"
 *   (`./historial.ts`).
 *
 * Nunca lanza por una organización (sigue con la siguiente) y el registro sólo guarda códigos.
 */

export const TOPE_SEGUIMIENTOS_CORRIDA = 200;
/** Presupuestos que se leen por organización y corrida (los más viejos primero). */
const CANDIDATOS_POR_ORGANIZACION = 500;
const DIA_MS = 24 * 60 * 60 * 1000;

export type ReporteSeguimiento = {
  /** Organizaciones con el seguimiento encendido que se revisaron. */
  organizaciones: number;
  enviados: number;
  fallidos: number;
  /** Ya tenían su seguimiento, o la dirección ya recibió un automático en las últimas 24 h, o sin correo. */
  salteados: number;
  /** Organizaciones que llegaron al tope diario de automáticos. */
  conTopeDiario: number;
  /** La corrida llegó a `TOPE_SEGUIMIENTOS_CORRIDA` y quedó gente para mañana. */
  topeCorrida: boolean;
};

export type DepsSeguimiento = DepsEnvio & {
  /** La clave de los enlaces (undefined: la del entorno). */
  clave?: string | null;
  /** Dirección de FOTOFFICE (undefined: la del entorno). */
  appOrigin?: string;
  /** Tope por corrida (las pruebas lo bajan). */
  tope?: number;
};

function codigo(e: unknown): string {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : "desconocido";
}

/** PURO. Días de calendario de Buenos Aires entre el envío y hoy (0 = el mismo día). */
export function diasDesdeElEnvio(sentAt: Date, ahora: Date): number {
  const a = Date.parse(`${diaEnBuenosAires(sentAt)}T00:00:00.000Z`);
  const b = Date.parse(`${diaEnBuenosAires(ahora)}T00:00:00.000Z`);
  return Math.round((b - a) / DIA_MS);
}

/** PURO. ¿Le toca el seguimiento? Enviado o visto, sin vencer, aceptar ni rechazar, y con los días cumplidos. */
export function correspondeSeguimiento(args: {
  status: EstadoPresupuesto;
  validUntil: Date | null;
  sentAt: Date | null;
  aceptada: boolean;
  dias: number;
  ahora: Date;
}): boolean {
  if (!args.sentAt || args.aceptada) return false;
  const efectivo = estadoEfectivo(args.status, args.validUntil, args.ahora);
  if (efectivo !== "ENVIADO" && efectivo !== "VISTO") return false;
  return diasDesdeElEnvio(args.sentAt, args.ahora) >= args.dias;
}

function ctxDelSistema(workspaceId: string): CtxEnvio {
  return { workspaceId, userId: null, userLabel: null, userName: null, userEmail: null, role: null };
}

type Contador = { intentos: number; tope: number };

/** Los seguimientos de una organización. Devuelve si quedó cortada por el tope diario de automáticos. */
async function seguimientosDe(
  workspaceId: string,
  dias: number,
  ahora: Date,
  clave: string,
  reporte: ReporteSeguimiento,
  contador: Contador,
  deps: DepsSeguimiento,
): Promise<void> {
  if (!(await isModuleEnabledForWorkspace(workspaceId, QUOTES_MODULE_KEY))) return;
  await asegurarPlantillaSeguimiento(workspaceId);
  const auto = await leerAutomatico(workspaceId, "PRESUPUESTO_SEGUIMIENTO");
  if (!auto || !auto.enabled || auto.channel !== "EMAIL" || auto.entityType !== "PRESUPUESTO") return;
  const sitio = await sitioDelWorkspace(workspaceId);
  const origen = origenDe(deps);
  if (!sitio || !urlDelPresupuesto({ ...sitio, appOrigin: origen, token: "x" })) {
    console.warn("[presupuestos] seguimiento sin dirección pública", { codigo: "SIN_SITIO" });
    return;
  }

  const presupuestos = await prisma.fotofficePresupuesto.findMany({
    where: { workspaceId, status: { in: ["ENVIADO", "VISTO"] }, currentVersionId: { not: null } },
    select: { id: true, consultaLeadId: true, currentVersionId: true, validUntil: true, status: true },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: CANDIDATOS_POR_ORGANIZACION,
  });
  if (presupuestos.length === 0) return;
  const versiones = await prisma.fotofficePresupuestoVersion.findMany({
    where: { workspaceId, id: { in: presupuestos.map((p) => p.currentVersionId as string) } },
    select: { id: true, sentAt: true, acceptedAt: true, totals: true },
  });
  const deId = new Map(versiones.map((v) => [v.id, v]));
  const candidatos = presupuestos
    .map((p) => ({ p, v: deId.get(p.currentVersionId as string) }))
    .filter(
      (x): x is { p: (typeof presupuestos)[number]; v: (typeof versiones)[number] & { sentAt: Date } } =>
        x.v !== undefined &&
        x.v.sentAt !== null &&
        esEstadoPresupuesto(x.p.status) &&
        correspondeSeguimiento({ status: x.p.status, validUntil: x.p.validUntil, sentAt: x.v.sentAt, aceptada: x.v.acceptedAt !== null, dias, ahora }),
    )
    .sort((a, b) => a.v.sentAt.getTime() - b.v.sentAt.getTime());

  for (const { p, v } of candidatos) {
    if (contador.intentos >= contador.tope) {
      reporte.topeCorrida = true;
      return;
    }
    // Una vez por versión: cualquier seguimiento registrado en la consulta desde que se envió.
    const previo = await prisma.fotofficeMessage.findFirst({
      where: { workspaceId, channel: "EMAIL", templateId: auto.id, entityType: "CONSULTA", entityId: p.consultaLeadId, createdAt: { gte: v.sentAt } },
      select: { id: true },
    });
    if (previo) {
      reporte.salteados++;
      continue;
    }
    const contexto = await contextoDe(workspaceId, "CONSULTA", p.consultaLeadId, { nombre: null, email: null }, ahora);
    if (!contexto || !correoValido(contexto.destino.email)) {
      reporte.salteados++;
      continue;
    }
    // Una respuesta automática por dirección cada 24 h: si le tocó otra, mañana.
    if (await yaRespondida(workspaceId, contexto.destino.email, ahora)) {
      reporte.salteados++;
      continue;
    }
    const numero = (await numeroDe(workspaceId, ENTIDAD_NUMERACION, [p.id])).get(p.id) ?? null;
    const enlace = urlDelPresupuesto({ ...sitio, appOrigin: origen, token: tokenDeVersion(v.id, clave) });
    const textos = textosFinales(contexto, "EMAIL", { asunto: auto.subject ?? "", cuerpo: auto.body, templateId: auto.id }, {
      numero,
      enlace,
      total: pesos((v.totals as TotalesGuardados | null)?.total ?? 0),
      vence: ddmmaaaa(p.validUntil),
    });
    if (!textos.ok) {
      // La plantilla no sirve para nadie: no tiene sentido seguir con esta organización.
      console.warn("[presupuestos] la plantilla del seguimiento tiene errores", { codigo: "PLANTILLA_CON_ERRORES" });
      reporte.fallidos++;
      return;
    }
    contador.intentos++;
    const r = await enviarCorreo(
      ctxDelSistema(workspaceId),
      { entityType: "CONSULTA", entityId: p.consultaLeadId, templateId: auto.id, asunto: textos.asunto, cuerpo: textos.cuerpo, automatico: true },
      { enviar: deps.enviar, ahora: () => ahora },
      { tipoPlantilla: "PRESUPUESTO" },
    );
    if (r.ok) {
      reporte.enviados++;
      continue;
    }
    if (r.error === MENSAJES_ENVIO.topeAutomaticos) {
      // No se registró nada: quedan para mañana.
      contador.intentos--;
      reporte.conTopeDiario++;
      return;
    }
    reporte.fallidos++;
  }
}

/** La corrida diaria. Devuelve sólo contadores (sin datos de nadie). */
export async function enviarSeguimientos(deps: DepsSeguimiento = {}): Promise<ReporteSeguimiento> {
  const reporte: ReporteSeguimiento = { organizaciones: 0, enviados: 0, fallidos: 0, salteados: 0, conTopeDiario: 0, topeCorrida: false };
  const ahora = (deps.ahora ?? (() => new Date()))();
  const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
  if (!clave) {
    console.warn("[presupuestos] seguimiento sin clave de enlaces", { codigo: "SIN_CLAVE" });
    return reporte;
  }
  const ajustes = await prisma.fotofficePresupuestoAjustes.findMany({
    where: { followUpEnabled: true },
    select: { workspaceId: true, followUpDays: true },
    orderBy: [{ workspaceId: "asc" }],
    take: 1000,
  });
  const contador: Contador = { intentos: 0, tope: deps.tope ?? TOPE_SEGUIMIENTOS_CORRIDA };
  for (const a of ajustes) {
    if (contador.intentos >= contador.tope) {
      reporte.topeCorrida = true;
      break;
    }
    reporte.organizaciones++;
    try {
      await seguimientosDe(a.workspaceId, a.followUpDays, ahora, clave, reporte, contador, deps);
    } catch (e) {
      console.error("[presupuestos] falló el seguimiento de una organización", { codigo: codigo(e) });
    }
  }
  return reporte;
}
