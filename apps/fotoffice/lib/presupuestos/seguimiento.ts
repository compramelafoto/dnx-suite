import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { numeroDe } from "@/lib/numeracion/asignar";
import { yaRespondida } from "@/lib/plantillas/automaticos";
import { conListaDePrecios, contextoDe, correoValido } from "@/lib/plantillas/contexto";
import { leerAutomatico } from "@/lib/plantillas/definiciones";
import {
  candadoDeDireccion,
  enviarCorreo,
  liberarReserva,
  MENSAJES_ENVIO,
  reservarEnvioAutomatico,
  sinAvisosAlEquipo,
  sinReservasViejas,
  type CtxEnvio,
  type DepsEnvio,
} from "@/lib/plantillas/envio";
import { QUOTES_MODULE_KEY } from "./acceso";
import { ENTIDAD_NUMERACION, esEstadoPresupuesto, type EstadoPresupuesto } from "./constantes";
import { pesos } from "./editor";
import { resolverClaveDeEnlace, tokenDeVersion, urlDelPresupuesto } from "./enlace";
import { ddmmaaaa, origenDe, textosFinales } from "./envio";
import { diaEnBuenosAires, estadoEfectivo, hoyEnBuenosAires } from "./estados";
import { asegurarPlantillaSeguimiento } from "./plantillas";
import { sitioDelWorkspace } from "./sitio";
import type { TotalesGuardados } from "./versiones";

/**
 * Seguimiento automático de presupuestos (etapa 2, Entrega B, spec §2 B.14). Lo corre una tarea
 * diaria (`app/api/cron/presupuestos-seguimiento`, 10:00 de Buenos Aires).
 *
 * Sólo se miran las versiones enviadas dentro de la ventana [hoy − (`followUpDays` +
 * `VENTANA_DIAS`), hoy − `followUpDays`], en páginas de la más vieja a la más nueva: así los
 * presupuestos viejos no tapan a los nuevos.
 *
 * Para cada organización con el seguimiento encendido (Configuración → Presupuestos) y el módulo
 * Presupuestos encendido, toma los presupuestos ENVIADO o VISTO (sin aceptar, ni rechazar, ni
 * vencer: el vencido se calcula con la validez) cuya versión vigente se envió hace
 * `followUpDays` días de calendario de Buenos Aires o más, y le manda a la persona de la consulta
 * el correo de la plantilla automática `PRESUPUESTO_SEGUIMIENTO` (con el enlace a la versión
 * vigente).
 *
 * - **Una vez por versión:** el mensaje se registra en el PRESUPUESTO (`entityType` PRESUPUESTO,
 *   `entityId` = su id; el historial de la consulta lo muestra igual) y antes de enviar se busca
 *   uno de esa plantilla para ese presupuesto desde el envío de la versión vigente (enviado,
 *   fallido o reservado). Dos presupuestos de la misma consulta no se pisan. Una versión nueva
 *   vuelve a contar desde su envío.
 * - **Dos corridas a la vez:** candado por presupuesto (`pg_advisory_xact_lock`), se vuelve a
 *   mirar adentro y se reserva el registro antes de mandar.
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
/** Versiones que se leen por página (de la más vieja a la más nueva, dentro de la ventana). */
export const CANDIDATOS_POR_PAGINA = 500;
const MAX_PAGINAS = 20;
/** Días después de `followUpDays` en los que todavía se manda el seguimiento. */
export const VENTANA_DIAS = 30;
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

type LectorMensajes = Pick<Prisma.TransactionClient, "fotofficeMessage">;

/** ¿Ya hay un seguimiento (enviado, fallido o reservado) de este presupuesto desde el envío de la vigente? */
async function yaTieneSeguimiento(
  cliente: LectorMensajes,
  workspaceId: string,
  templateId: string,
  presupuestoId: string,
  sentAt: Date,
  ahora: Date,
): Promise<boolean> {
  const previo = await cliente.fotofficeMessage.findFirst({
    where: {
      workspaceId, channel: "EMAIL", templateId, entityType: "PRESUPUESTO", entityId: presupuestoId, createdAt: { gte: sentAt },
      // Una reserva abandonada (de hace más de una hora) no cuenta: se vuelve a intentar.
      AND: [sinReservasViejas(ahora)],
    },
    select: { id: true },
  });
  return previo !== null;
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

  // Candidatas: las versiones vigentes (enviadas, sin aceptar ni reemplazar) enviadas dentro de la
  // ventana [hoy − (días + VENTANA_DIAS), hoy − días], en páginas de la más vieja a la más nueva.
  // Fuera de la ventana no se miran: así los presupuestos viejos (ya seguidos o abandonados) no
  // tapan a los nuevos. Cada página saca los vencidos, los que no están enviados o vistos y los
  // que ya tienen su seguimiento.
  const desde = new Date(ahora.getTime() - (dias + VENTANA_DIAS + 1) * DIA_MS);
  const hasta = new Date(ahora.getTime() - (dias - 1) * DIA_MS);
  let cursor: { sentAt: Date; id: string } | null = null;
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const versiones: { id: string; presupuestoId: string; sentAt: Date | null; totals: unknown }[] =
      await prisma.fotofficePresupuestoVersion.findMany({
        where: {
          workspaceId,
          sentAt: { gte: desde, lte: hasta },
          acceptedAt: null,
          revokedAt: null,
          ...(cursor ? { OR: [{ sentAt: { gt: cursor.sentAt } }, { sentAt: cursor.sentAt, id: { gt: cursor.id } }] } : {}),
        },
        orderBy: [{ sentAt: "asc" }, { id: "asc" }],
        select: { id: true, presupuestoId: true, sentAt: true, totals: true },
        take: CANDIDATOS_POR_PAGINA,
      });
    if (versiones.length === 0) return;
    const ultima = versiones[versiones.length - 1]!;
    cursor = { sentAt: ultima.sentAt as Date, id: ultima.id };

    const ids = [...new Set(versiones.map((v) => v.presupuestoId))];
    const [presupuestos, seguidos] = await Promise.all([
      prisma.fotofficePresupuesto.findMany({
        where: {
          workspaceId,
          id: { in: ids },
          status: { in: ["ENVIADO", "VISTO"] },
          OR: [{ validUntil: null }, { validUntil: { gte: hoyEnBuenosAires(ahora) } }],
        },
        select: { id: true, consultaLeadId: true, currentVersionId: true, validUntil: true, status: true },
      }),
      prisma.fotofficeMessage.findMany({
        where: {
          workspaceId, channel: "EMAIL", templateId: auto.id, entityType: "PRESUPUESTO", entityId: { in: ids }, createdAt: { gte: desde },
          AND: [sinReservasViejas(ahora)],
        },
        select: { entityId: true, createdAt: true },
      }),
    ]);
    const deId = new Map(presupuestos.map((p) => [p.id, p]));
    const candidatos = versiones.flatMap((v) => {
      const p = deId.get(v.presupuestoId);
      if (!p || p.currentVersionId !== v.id || !v.sentAt || !esEstadoPresupuesto(p.status)) return [];
      const sentAt = v.sentAt;
      if (!correspondeSeguimiento({ status: p.status, validUntil: p.validUntil, sentAt, aceptada: false, dias, ahora })) return [];
      if (seguidos.some((m) => m.entityId === p.id && m.createdAt.getTime() >= sentAt.getTime())) return [];
      return [{ p, v: { ...v, sentAt } }];
    });
    for (const c of candidatos) {
      if (contador.intentos >= contador.tope) {
        reporte.topeCorrida = true;
        return;
      }
      if ((await seguimientoDe(workspaceId, c.p, c.v, auto, sitio, origen, clave, ahora, reporte, contador, deps)) === "CORTAR") return;
    }
    if (versiones.length < CANDIDATOS_POR_PAGINA) return;
  }
}

type Automatico = NonNullable<Awaited<ReturnType<typeof leerAutomatico>>>;
type Sitio = NonNullable<Awaited<ReturnType<typeof sitioDelWorkspace>>>;

/** El seguimiento de un presupuesto. "CORTAR": no seguir con esta organización (tope o plantilla rota). */
async function seguimientoDe(
  workspaceId: string,
  p: { id: string; consultaLeadId: string; validUntil: Date | null },
  v: { id: string; sentAt: Date; totals: unknown },
  auto: Automatico,
  sitio: Sitio,
  origen: string,
  clave: string,
  ahora: Date,
  reporte: ReporteSeguimiento,
  contador: Contador,
  deps: DepsSeguimiento,
): Promise<"SEGUIR" | "CORTAR"> {
  const leido = await contextoDe(workspaceId, "CONSULTA", p.consultaLeadId, { nombre: null, email: null }, ahora);
  if (!leido || !correoValido(leido.destino.email)) {
    reporte.salteados++;
    return "SEGUIR";
  }
  // Una respuesta automática por dirección cada 24 h: si le tocó otra, mañana.
  const email = leido.destino.email;
  if (await yaRespondida(workspaceId, email, ahora)) {
    reporte.salteados++;
    return "SEGUIR";
  }
  const contexto = await conListaDePrecios(workspaceId, leido, auto.subject, auto.body);
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
    return "CORTAR";
  }
  // Candados: primero el de la dirección (el mismo que la respuesta común y la propuesta modelo:
  // nunca dos respuestas automáticas a la misma persona) y después el del presupuesto (dos
  // corridas a la vez). Adentro se vuelve a mirar todo y se reserva el registro; el correo sale
  // DESPUÉS de soltarlos (no se tiene una conexión tomada mientras responde el proveedor).
  const filtro = await sinAvisosAlEquipo(workspaceId);
  const reserva = await prisma.$transaction(async (tx) => {
    await candadoDeDireccion(tx, workspaceId, email);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-seguimiento:${p.id}`}))`;
    if (await yaRespondida(workspaceId, email, ahora, { cliente: tx, filtro })) return null;
    if (await yaTieneSeguimiento(tx, workspaceId, auto.id, p.id, v.sentAt, ahora)) return null;
    return reservarEnvioAutomatico(tx, { workspaceId, entityType: "PRESUPUESTO", entityId: p.id, templateId: auto.id, toAddress: email });
  }, OPCIONES_TRANSACCION);
  if (!reserva) {
    reporte.salteados++;
    return "SEGUIR";
  }
  contador.intentos++;
  const r = await enviarCorreo(
    ctxDelSistema(workspaceId),
    {
      entityType: "CONSULTA", entityId: p.consultaLeadId, templateId: auto.id, asunto: textos.asunto, cuerpo: textos.cuerpo, automatico: true,
      registroId: reserva, registrarEn: { entityType: "PRESUPUESTO", entityId: p.id },
    },
    { enviar: deps.enviar, ahora: () => ahora },
    { tipoPlantilla: "PRESUPUESTO" },
  );
  if (r.ok) {
    reporte.enviados++;
    return "SEGUIR";
  }
  // Si no se llegó a mandar (tope, texto), la reserva sigue EN_CURSO: se libera para mañana.
  await liberarReserva(workspaceId, reserva);
  if (r.error === MENSAJES_ENVIO.topeAutomaticos) {
    contador.intentos--;
    reporte.conTopeDiario++;
    return "CORTAR";
  }
  reporte.fallidos++;
  return "SEGUIR";
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
