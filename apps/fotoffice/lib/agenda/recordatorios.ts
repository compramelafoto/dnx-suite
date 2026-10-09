import "server-only";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { contextoDe, correoValido, destinoDe } from "@/lib/plantillas/contexto";
import { leerAutomatico } from "@/lib/plantillas/definiciones";
import {
  candadoDeDireccion, completarTextos, enviarCorreo, liberarReserva, MENSAJES_ENVIO, reservarEnvioAutomatico, type CtxEnvio, type DepsEnvio,
} from "@/lib/plantillas/envio";
import { fechaAR } from "@/lib/plantillas/variables";
import { AGENDA_MODULE_KEY } from "./acceso";
import { DESFASE_ARGENTINA_HORAS } from "./constantes";
import { asegurarPlantillaRecordatorioCita } from "./plantillas";

/**
 * Recordatorio de citas al cliente (Etapa 4, Agenda). Lo corre una tarea horaria
 * (`app/api/cron/agenda-recordatorios`).
 *
 * Para cada organización con el recordatorio encendido (Configuración → Agenda,
 * `FotofficeAgendaAjustes.reminderEnabled`) y el módulo Agenda encendido, toma las citas:
 * - AGENDADA o CONFIRMADA (ni anuladas ni realizadas);
 * - cuyo inicio cae después de ahora y hasta ahora + `reminderHours` (los dos instantes UTC);
 * - que todavía no tienen un `FotofficeCitaRecordatorio` para ese (cita, inicio): si se mueve la
 *   cita, vuelve a avisar.
 *
 * Y le manda el correo de la plantilla automática `RECORDATORIO_CITA` a cada participante CONTACTO
 * con correo válido (nunca al equipo), una sola vez por dirección.
 *
 * - **Una vez por (cita, inicio):** antes de mandar se inserta el `FotofficeCitaRecordatorio` como
 *   reserva (el único frena a una corrida simultánea). Si no salió ningún correo, se borra y se
 *   vuelve a intentar en la próxima hora. Si salió alguno, queda: los que fallaron no se reintentan
 *   para no repetirle el correo a los que ya lo recibieron.
 * - **Topes:** es un correo AUTOMÁTICO: cuenta en el tope diario de los automáticos de la
 *   organización y, por corrida, como mucho `TOPE_RECORDATORIOS_CORRIDA` intentos entre todas.
 *   NO se frena por la regla de una respuesta automática por dirección cada 24 h: es transaccional.
 * - **Historial:** queda registrado en la cita (`entityType` CITA + su id).
 *
 * La tarea nunca crea filas de ajustes. Nunca lanza por una organización y el registro sólo guarda códigos.
 */

export const TOPE_RECORDATORIOS_CORRIDA = 200;
/** Citas que se leen por organización (de la que empieza antes a la que empieza después). */
export const CITAS_POR_ORGANIZACION = 1000;
const ESTADOS_QUE_AVISAN = ["AGENDADA", "CONFIRMADA"];

export type ReporteRecordatorios = {
  /** Organizaciones con el recordatorio encendido que se revisaron. */
  organizaciones: number;
  /** Correos enviados (uno por dirección). */
  enviados: number;
  fallidos: number;
  /** Citas sin contacto con correo válido, o ya reservadas por otra corrida. */
  salteados: number;
  /** Organizaciones que llegaron al tope diario de automáticos. */
  conTopeDiario: number;
  /** La corrida llegó a `TOPE_RECORDATORIOS_CORRIDA` y quedaron citas para la próxima hora. */
  topeCorrida: boolean;
};

export type DepsRecordatorios = DepsEnvio & {
  /** Tope por corrida (las pruebas lo bajan). */
  tope?: number;
};

function codigo(e: unknown): string {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : "desconocido";
}

/** PURO. Los instantes (UTC) entre los que tiene que empezar una cita para avisarse en esta corrida. */
export function ventanaDeRecordatorio(ahora: Date, horas: number): { desde: Date; hasta: Date } {
  const h = Math.max(0, Math.trunc(horas));
  return { desde: ahora, hasta: new Date(ahora.getTime() + h * 3_600_000) };
}

const DOS = (n: number) => String(n).padStart(2, "0");

/** PURO. "hh:mm" de Argentina del instante, o null si la cita es de todo el día. */
export function horaDeCita(startAt: Date, allDay: boolean): string | null {
  if (allDay) return null;
  const local = new Date(startAt.getTime() - DESFASE_ARGENTINA_HORAS * 3_600_000);
  return `${DOS(local.getUTCHours())}:${DOS(local.getUTCMinutes())}`;
}

function ctxDelSistema(workspaceId: string): CtxEnvio {
  return { workspaceId, userId: null, userLabel: null, userName: null, userEmail: null, role: null };
}

type Contador = { intentos: number; tope: number };
type Automatico = NonNullable<Awaited<ReturnType<typeof leerAutomatico>>>;
type Cita = { id: string; title: string; startAt: Date; allDay: boolean; location: string | null };
type Destinatario = { clientId: string; email: string };
type Resultado = "ENVIADO" | "FALLO" | "SALTEADO" | "TOPE" | "PLANTILLA";

/** Las citas de una organización que tienen que avisarse en esta corrida, en orden de inicio. */
async function candidatasDe(workspaceId: string, horas: number, ahora: Date): Promise<Cita[]> {
  const { desde, hasta } = ventanaDeRecordatorio(ahora, horas);
  const citas = (await prisma.fotofficeCita.findMany({
    where: { workspaceId, status: { in: ESTADOS_QUE_AVISAN }, startAt: { gt: desde, lte: hasta } },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    select: { id: true, title: true, startAt: true, allDay: true, location: true },
    take: CITAS_POR_ORGANIZACION,
  })) as Cita[];
  if (citas.length === 0) return [];
  const avisadas = await prisma.fotofficeCitaRecordatorio.findMany({
    where: { citaId: { in: citas.map((c) => c.id) } },
    select: { citaId: true, startAt: true },
  });
  const ya = new Set(avisadas.map((a) => `${a.citaId}:${a.startAt.getTime()}`));
  return citas.filter((c) => !ya.has(`${c.id}:${c.startAt.getTime()}`));
}

/** Los contactos con correo válido que participan de las citas, sin repetir dirección dentro de una cita. */
async function destinatariosDe(workspaceId: string, citaIds: string[]): Promise<Map<string, Destinatario[]>> {
  const filas = await prisma.fotofficeCitaParticipante.findMany({
    where: { citaId: { in: citaIds }, clientId: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { citaId: true, clientId: true },
  });
  const correos = new Map<string, string | null>();
  const porCita = new Map<string, Destinatario[]>();
  const vistas = new Map<string, Set<string>>();
  for (const f of filas) {
    const clientId = f.clientId as string | null;
    if (!clientId) continue;
    if (!correos.has(clientId)) {
      const d = await destinoDe(workspaceId, "CLIENTE", clientId);
      correos.set(clientId, d && correoValido(d.email) ? d.email : null);
    }
    const email = correos.get(clientId);
    if (!email) continue;
    const citaId = f.citaId as string;
    const set = vistas.get(citaId) ?? new Set<string>();
    const clave = email.trim().toLowerCase();
    if (set.has(clave)) continue;
    set.add(clave);
    vistas.set(citaId, set);
    porCita.set(citaId, [...(porCita.get(citaId) ?? []), { clientId, email }]);
  }
  return porCita;
}

/** Borra la reserva del (cita, inicio) para que se vuelva a intentar en la próxima hora. Nunca lanza. */
async function liberarRecordatorio(cita: Cita): Promise<void> {
  try {
    await prisma.fotofficeCitaRecordatorio.deleteMany({ where: { citaId: cita.id, startAt: cita.startAt } });
  } catch (e) {
    console.error("[agenda] no se pudo liberar un recordatorio de cita", { codigo: codigo(e) });
  }
}

/** El correo de una cita a un destinatario. */
async function enviarA(
  workspaceId: string,
  cita: Cita,
  d: Destinatario,
  auto: Automatico,
  ahora: Date,
  contador: Contador,
  deps: DepsRecordatorios,
): Promise<Resultado> {
  const base = await contextoDe(workspaceId, "CLIENTE", d.clientId, { nombre: null, email: null }, ahora);
  if (!base) return "SALTEADO";
  const contexto = {
    ...base,
    variables: {
      ...base.variables,
      cita: { titulo: cita.title, fecha: fechaAR(cita.startAt), hora: horaDeCita(cita.startAt, cita.allDay), lugar: cita.location },
    },
  };
  const textos = completarTextos(contexto, "CITA", auto.subject, auto.body);
  if (!textos.ok) {
    console.warn("[agenda] la plantilla del recordatorio de cita tiene errores", { codigo: "PLANTILLA_CON_ERRORES" });
    return "PLANTILLA";
  }

  // Reserva del registro del mensaje, con el candado de la dirección (el de todos los automáticos a
  // una persona). El correo sale DESPUÉS de soltar el candado.
  const reserva = await prisma.$transaction(async (tx) => {
    await candadoDeDireccion(tx, workspaceId, d.email);
    return reservarEnvioAutomatico(tx, { workspaceId, entityType: "CITA", entityId: cita.id, templateId: auto.id, toAddress: d.email });
  });
  contador.intentos++;
  let r: Awaited<ReturnType<typeof enviarCorreo>>;
  try {
    r = await enviarCorreo(
      ctxDelSistema(workspaceId),
      {
        entityType: "CLIENTE", entityId: d.clientId, templateId: auto.id, asunto: textos.asunto, cuerpo: textos.cuerpo, automatico: true,
        registroId: reserva, registrarEn: { entityType: "CITA", entityId: cita.id },
      },
      { enviar: deps.enviar, ahora: () => ahora },
      { tipoPlantilla: "CITA" },
    );
  } catch (e) {
    await liberarReserva(workspaceId, reserva);
    throw e;
  }
  if (r.ok) return "ENVIADO";
  // Si no se llegó a registrar (tope, texto) la reserva se borra; si el proveedor lo rechazó, queda como fallido.
  if (!r.registrado) await liberarReserva(workspaceId, reserva);
  if (r.error === MENSAJES_ENVIO.topeAutomaticos) {
    contador.intentos--;
    return "TOPE";
  }
  console.warn("[agenda] el recordatorio de cita no salió", { codigo: r.registrado ? "REGISTRADO_FALLIDO" : "NO_ENVIADO" });
  return "FALLO";
}

/** El recordatorio de una cita. "CORTAR": no seguir con esta organización (tope o plantilla rota). */
async function recordatorioDe(
  workspaceId: string,
  cita: Cita,
  destinatarios: Destinatario[],
  auto: Automatico,
  ahora: Date,
  reporte: ReporteRecordatorios,
  contador: Contador,
  deps: DepsRecordatorios,
): Promise<"SEGUIR" | "CORTAR"> {
  if (destinatarios.length === 0) {
    reporte.salteados++;
    return "SEGUIR";
  }
  // La reserva del (cita, inicio): su único frena a otra corrida.
  const r = await prisma.fotofficeCitaRecordatorio.createMany({ data: [{ citaId: cita.id, startAt: cita.startAt, sentAt: ahora }], skipDuplicates: true });
  if (r.count === 0) {
    reporte.salteados++;
    return "SEGUIR";
  }
  let enviados = 0;
  let cortar = false;
  try {
    for (const d of destinatarios) {
      if (contador.intentos >= contador.tope) {
        reporte.topeCorrida = true;
        cortar = true;
        break;
      }
      const res = await enviarA(workspaceId, cita, d, auto, ahora, contador, deps);
      if (res === "ENVIADO") {
        enviados++;
        reporte.enviados++;
      } else if (res === "FALLO") {
        reporte.fallidos++;
      } else if (res === "SALTEADO") {
        reporte.salteados++;
      } else if (res === "PLANTILLA") {
        // La plantilla no sirve para nadie: no tiene sentido seguir con esta organización.
        reporte.fallidos++;
        cortar = true;
        break;
      } else {
        reporte.conTopeDiario++;
        cortar = true;
        break;
      }
    }
  } finally {
    // Si no salió ningún correo, se libera para intentar en la próxima hora.
    if (enviados === 0) await liberarRecordatorio(cita);
  }
  return cortar ? "CORTAR" : "SEGUIR";
}

/** Los recordatorios de una organización. */
async function recordatoriosDe(
  workspaceId: string,
  horas: number,
  ahora: Date,
  reporte: ReporteRecordatorios,
  contador: Contador,
  deps: DepsRecordatorios,
): Promise<void> {
  if (!(await isModuleEnabledForWorkspace(workspaceId, AGENDA_MODULE_KEY))) return;
  await asegurarPlantillaRecordatorioCita(workspaceId);
  const auto = await leerAutomatico(workspaceId, "RECORDATORIO_CITA");
  if (!auto || !auto.enabled || auto.channel !== "EMAIL" || auto.entityType !== "CITA") return;
  const citas = await candidatasDe(workspaceId, horas, ahora);
  if (citas.length === 0) return;
  const destinatarios = await destinatariosDe(workspaceId, citas.map((c) => c.id));
  for (const cita of citas) {
    if (contador.intentos >= contador.tope) {
      reporte.topeCorrida = true;
      return;
    }
    if ((await recordatorioDe(workspaceId, cita, destinatarios.get(cita.id) ?? [], auto, ahora, reporte, contador, deps)) === "CORTAR") return;
  }
}

/** La corrida horaria. Devuelve sólo contadores (sin datos de nadie). */
export async function enviarRecordatoriosDeCitas(deps: DepsRecordatorios = {}): Promise<ReporteRecordatorios> {
  const reporte: ReporteRecordatorios = { organizaciones: 0, enviados: 0, fallidos: 0, salteados: 0, conTopeDiario: 0, topeCorrida: false };
  const ahora = (deps.ahora ?? (() => new Date()))();
  const ajustes = await prisma.fotofficeAgendaAjustes.findMany({
    where: { reminderEnabled: true },
    select: { workspaceId: true, reminderHours: true },
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
      await recordatoriosDe(a.workspaceId as string, a.reminderHours as number, ahora, reporte, contador, deps);
    } catch (e) {
      console.error("[agenda] fallaron los recordatorios de una organización", { codigo: codigo(e) });
    }
  }
  return reporte;
}
