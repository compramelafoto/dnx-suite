import "server-only";
import { prisma } from "@repo/db";
import { estadoCanalAgentes } from "../canal";
import { diaArgentino, inicioDelDiaArgentino, inicioDelMesArgentino } from "../periodista/horario";
import { gastoDelMesVendedor, guardarAjustesVendedor, leerAjustesVendedor, type AjustesVendedor } from "./ajustes";
import { colaDelDia, sigueApto, type ElementoCola, type MotivoNoApto } from "./aptos";
import { cupoDelDia } from "./calendario";
import { leerConocimiento } from "./clf";
import { informesGuardados, type InformeMes } from "./informe";
import type { MotivoSinPropuesta } from "./modelos";
import { GRUPOS, RESPONDER_A, ROTULO_GRUPO, type Grupo } from "./tipos";

/**
 * Lo que muestra el panel del Vendedor (/admin/contactos-dnx/vendedor) y la conversación de la ficha
 * de cada contacto. También las reglas de «Pausar» / «Reanudar» y la validación de los ajustes, para
 * que las acciones del servidor sólo chequeen permisos y llamen acá.
 *
 * Los correos se cuentan por filas `SALIDA` de `DnxVendedorCorreo` (no por hilos), igual que el motor:
 * los primeros y los recordatorios consumen cupo; las respuestas a dudas, no.
 */

const PASOS_CON_CUPO = ["PRIMERO", "RECORDATORIO"];

export type DnxVendedorHilo = NonNullable<Awaited<ReturnType<typeof prisma.dnxVendedorHilo.findFirst>>>;
export type DnxVendedorCorreo = NonNullable<Awaited<ReturnType<typeof prisma.dnxVendedorCorreo.findFirst>>>;

export type ModeloDelGrupo = {
  grupo: Grupo;
  rotulo: string;
  vigente: { id: string; asunto: string; aprobadoEn: Date | null } | null;
  propuesto: { id: string; asunto: string; creadoEn: Date } | null;
};

export type EstadoVendedor = {
  ajustes: AjustesVendedor;
  gastoMesUsd: number;
  cupoHoy: number;
  enviadosHoy: number;
  enviadosMes: number;
  cola: Array<ElementoCola & { nombre: string }>;
  modelos: ModeloDelGrupo[];
  informes: InformeMes[];
  conocimientoVersion: string | null;
};

function contarSalidas(desde: Date): Promise<number> {
  return prisma.dnxVendedorCorreo.count({ where: { direccion: "SALIDA", paso: { in: PASOS_CON_CUPO }, creadoEn: { gte: desde } } });
}

/**
 * El panel. La cola es una vista previa de lo que queda del cupo de hoy (cupo − enviados): sale de
 * `colaDelDia` con lo guardado de CLF (no le consulta nada a CLF) y respeta el contacto de prueba.
 */
export async function estadoVendedor(ahora: Date): Promise<EstadoVendedor> {
  const [ajustes, gastoMesUsd, enviadosHoy, enviadosMes, informes, conocimiento, modelos] = await Promise.all([
    leerAjustesVendedor(),
    gastoDelMesVendedor(ahora),
    contarSalidas(inicioDelDiaArgentino(ahora)),
    contarSalidas(inicioDelMesArgentino(ahora)),
    informesGuardados(),
    leerConocimiento(),
    prisma.dnxVendedorModelo.findMany({
      where: { OR: [{ estado: "PROPUESTO" }, { estado: "APROBADO", reemplazadoEn: null }] },
      select: { id: true, grupo: true, estado: true, asunto: true, aprobadoEn: true, creadoEn: true },
    }),
  ]);
  const cupoHoy = cupoDelDia(ajustes, ahora);
  const restante = Math.max(0, cupoHoy - enviadosHoy);
  const { cola } = restante > 0 ? await colaDelDia(restante, { soloContactoId: ajustes.soloContactoPrueba }) : { cola: [] };
  const ids = cola.map((c) => c.contactoId);
  const nombres = ids.length
    ? await prisma.dnxContacto.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } })
    : [];
  const nombre = new Map(nombres.map((c) => [c.id, c.nombre]));

  return {
    ajustes,
    gastoMesUsd,
    cupoHoy,
    enviadosHoy,
    enviadosMes,
    cola: cola.map((c) => ({ ...c, nombre: nombre.get(c.contactoId) ?? c.contactoId })),
    modelos: GRUPOS.map((grupo) => {
      const vigente = modelos.find((m) => m.grupo === grupo && m.estado === "APROBADO");
      const propuesto = modelos.find((m) => m.grupo === grupo && m.estado === "PROPUESTO");
      return {
        grupo,
        rotulo: ROTULO_GRUPO[grupo],
        vigente: vigente ? { id: vigente.id, asunto: vigente.asunto, aprobadoEn: vigente.aprobadoEn } : null,
        propuesto: propuesto ? { id: propuesto.id, asunto: propuesto.asunto, creadoEn: propuesto.creadoEn } : null,
      };
    }),
    informes,
    conocimientoVersion: conocimiento?.version ?? null,
  };
}

// --- Pausar y reanudar --------------------------------------------------------------------------

export const MOTIVO_SIN_CORREO_RECIBIDO = `Todavía no llegó ningún correo a ${RESPONDER_A}: falta el MX o el webhook`;

/**
 * Sólo se reanuda si ya llegó al menos un correo (prueba que el MX y el webhook andan), si está el
 * conocimiento de CLF y si Daniel tiene el chat de Telegram vinculado. Si falta algo, dice todo lo que falta.
 */
export async function puedeReanudar(): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const [recibidos, conocimiento, canal] = await Promise.all([
    prisma.dnxVendedorCorreo.count({ where: { direccion: "ENTRADA" } }),
    leerConocimiento(),
    estadoCanalAgentes(),
  ]);
  const motivos: string[] = [];
  if (recibidos === 0) motivos.push(MOTIVO_SIN_CORREO_RECIBIDO);
  if (!conocimiento) {
    motivos.push("Todavía no está cargado el conocimiento de CompraMeLaFoto (la guía del DNX Bot): se trae en la primera corrida de cada día; probá «Correr ahora»");
  }
  if (!canal.tieneToken) motivos.push("Falta el bot de Telegram de los agentes (TELEGRAM_AGENTES_BOT_TOKEN en Vercel)");
  else if (!canal.vinculado) motivos.push("El chat de Telegram de los agentes no está vinculado: vinculalo desde la página Agentes");
  return motivos.length === 0 ? { ok: true } : { ok: false, motivo: `${motivos.join(". ")}.` };
}

/**
 * Lo que cambia al reanudar: la salud se mira desde ahora (una queja vieja no vuelve a frenarlo
 * enseguida), se limpia el motivo de la pausa y el arranque (que fija el cupo de la primera semana) se
 * pone sólo la primera vez, con el día argentino. Con un contacto de prueba el arranque no se fija: la
 * prueba no gasta la primera semana.
 */
export function ajustesAlReanudar(a: AjustesVendedor, ahora: Date): Pick<AjustesVendedor, "pausado" | "pausadoPor" | "saludDesde" | "arrancoEn"> {
  const arrancoEn = a.arrancoEn ?? (a.soloContactoPrueba ? null : diaArgentino(ahora));
  return { pausado: false, pausadoPor: null, saludDesde: ahora.toISOString(), arrancoEn };
}

export async function cambiarPausaVendedor(pausado: boolean, ahora: Date): Promise<{ ok: boolean; mensaje: string }> {
  if (pausado) {
    await guardarAjustesVendedor({ pausado: true, pausadoPor: "MANUAL" });
    return { ok: true, mensaje: "Vendedor en pausa: no manda ningún correo nuevo hasta que lo reanudes." };
  }
  const puede = await puedeReanudar();
  if (!puede.ok) return { ok: false, mensaje: puede.motivo };
  const a = await leerAjustesVendedor();
  await guardarAjustesVendedor(ajustesAlReanudar(a, ahora));
  return {
    ok: true,
    mensaje: a.soloContactoPrueba && !a.arrancoEn
      ? "Vendedor en marcha en modo prueba: sólo le escribe al contacto de prueba. La primera semana real empieza cuando lo reanudes sin contacto de prueba."
      : a.arrancoEn
        ? "Vendedor reanudado: sigue en la próxima corrida, en días hábiles de 9 a 18."
        : "Vendedor en marcha: hoy es su primer día. La primera semana manda pocos correos por día; sigue en la próxima corrida, en días hábiles de 9 a 18.",
  };
}

// --- Ajustes ------------------------------------------------------------------------------------

export const TOPE_CLAUDE_MAXIMO_USD = 500;
export const CORREOS_POR_DIA_MAXIMO = 50;

type ValoresAjustes = Pick<AjustesVendedor, "topeClaudeUsd" | "correosPorDia" | "correosPrimeraSemana">;

/** Valida el formulario de ajustes: el tope (USD, admite coma) entre 0 y 500 y los correos, enteros entre 0 y 50. */
export function leerAjustesFormulario(tope: string, porDia: string, primeraSemana: string): { ok: true; valor: ValoresAjustes } | { ok: false; mensaje: string } {
  const limpio = (t: string) => String(t ?? "").trim().replace(/\s/g, "").replace(",", ".");
  const t = limpio(tope);
  const topeOk = /^\d+(\.\d+)?$/.test(t) && Number(t) <= TOPE_CLAUDE_MAXIMO_USD;
  const entero = (s: string) => {
    const v = limpio(s);
    return /^\d+$/.test(v) && Number(v) <= CORREOS_POR_DIA_MAXIMO ? Number(v) : null;
  };
  const dia = entero(porDia);
  const semana = entero(primeraSemana);
  if (!topeOk) return { ok: false, mensaje: `El tope de Claude tiene que ser un número entre 0 y ${TOPE_CLAUDE_MAXIMO_USD} (en dólares).` };
  if (dia === null || semana === null) {
    return { ok: false, mensaje: `Los correos por día tienen que ser un número entero entre 0 y ${CORREOS_POR_DIA_MAXIMO}.` };
  }
  return { ok: true, valor: { topeClaudeUsd: Math.round(Number(t) * 100) / 100, correosPorDia: dia, correosPrimeraSemana: semana } };
}

// --- Modelos ------------------------------------------------------------------------------------

export const esGrupo = (g: string): g is Grupo => (GRUPOS as readonly string[]).includes(g);

/**
 * El primer contacto apto del grupo (en el orden de la cola), para usarlo de ejemplo al pedir un modelo.
 * En modo prueba sólo puede ser el contacto de prueba: si no es de ese grupo, no hay ejemplo.
 */
export async function primerAptoDelGrupo(grupo: Grupo): Promise<string | null> {
  const { soloContactoPrueba } = await leerAjustesVendedor();
  const { cola, gruposSinModelo } = await colaDelDia(Number.MAX_SAFE_INTEGER, { soloContactoId: soloContactoPrueba });
  return gruposSinModelo.find((g) => g.grupo === grupo)?.contactoId ?? cola.find((c) => c.grupo === grupo)?.contactoId ?? null;
}

export const TEXTO_SIN_PROPUESTA: Record<MotivoSinPropuesta, string> = {
  YA_HAY_PROPUESTO: "Ya hay un modelo propuesto para este grupo: aprobalo, corregilo o descartalo en Telegram.",
  CLUBES_SIN_PAGINA: "La página de clubes de CompraMeLaFoto todavía no está publicada: los modelos de clubes y organizadores de eventos esperan a que la publiques.",
  YA_PROPUESTO_HOY: "Hoy ya se propuso un modelo para este grupo: el próximo se puede pedir mañana.",
  TOPE: "El Vendedor llegó al tope de gasto de Claude de este mes.",
  SIN_CONOCIMIENTO: "Todavía no está cargado el conocimiento de CompraMeLaFoto: sin eso no se redacta nada.",
  CLAUDE: "Claude no pudo redactar el modelo (puede faltar la clave ANTHROPIC_API_KEY). Probá de nuevo en un rato.",
  SIN_TELEGRAM: "No se pudo mandar el modelo por Telegram (¿está vinculado el chat de los agentes?): sin eso no hay dónde aprobarlo.",
};

// --- Contacto de prueba -------------------------------------------------------------------------

const TEXTO_NO_APTO: Record<MotivoNoApto, string> = {
  SIN_EMAIL: "no tiene correo",
  EMAIL_GENERICO: "su correo es genérico",
  ESTADO: "su estado no es Nuevo ni Revisado",
  USUARIO_CLF: "ya es usuario de CompraMeLaFoto",
  CONOCIDO: "es un conocido de DNX Estudio",
  CAMPANA_ESCOLAR: "recibió la campaña escolar de octubre",
  YA_TIENE_HILO: "ya tiene una conversación con el Vendedor",
  EMAIL_YA_ESCRITO: "a ese correo ya le escribió el Vendedor",
  SIN_GRUPO: "su tipo no tiene grupo de mensaje",
  FUSIONADO: "se fusionó en otro contacto",
  EMAIL_BLOQUEADO: "su correo está dado de baja o lo tiene otro contacto en «No contactar»",
  SIN_LISTA_CAMPANA: "todavía no se pudo traer de CompraMeLaFoto la lista de la campaña escolar (se trae una vez por día, desde las 8)",
};

/**
 * Con un contacto de prueba, el Vendedor sólo le escribe a ése (para probar el circuito con un correo
 * propio). Vacío vuelve a la cola normal. Si se saca la prueba con el Vendedor andando y todavía no
 * tiene arranque, hoy pasa a ser su primer día real.
 */
export async function fijarContactoPrueba(contactoId: string, ahora: Date = new Date()): Promise<{ ok: boolean; mensaje: string }> {
  const id = contactoId.trim();
  if (id === "") {
    const a = await leerAjustesVendedor();
    const arranca = !a.pausado && !a.arrancoEn;
    await guardarAjustesVendedor({ soloContactoPrueba: null, ...(arranca ? { arrancoEn: diaArgentino(ahora) } : {}) });
    return {
      ok: true,
      mensaje: a.pausado
        ? "Sin contacto de prueba. El Vendedor sigue en pausa: cuando lo reanudes, empieza con la cola normal."
        : arranca
          ? "Sin contacto de prueba: el Vendedor ya está en marcha con la cola normal y hoy es su primer día."
          : "Sin contacto de prueba: el Vendedor vuelve a la cola normal.",
    };
  }
  const c = await prisma.dnxContacto.findUnique({ where: { id }, select: { id: true, nombre: true } });
  if (!c) return { ok: false, mensaje: "No encontré ese contacto. Copiá el id desde la dirección de su ficha." };
  await guardarAjustesVendedor({ soloContactoPrueba: c.id });
  const motivo = await sigueApto(c.id);
  return {
    ok: true,
    mensaje: `Modo prueba: el Vendedor sólo le va a escribir a ${c.nombre}.${motivo ? ` Ojo: hoy no le escribiría, porque ${TEXTO_NO_APTO[motivo]}.` : ""}`,
  };
}

// --- Conversación de la ficha -------------------------------------------------------------------

/** La conversación del Vendedor con un contacto: el hilo y sus correos (salientes y entrantes), del más viejo al más nuevo. */
export async function hiloDeContacto(contactoId: string): Promise<{ hilo: DnxVendedorHilo; correos: DnxVendedorCorreo[] } | null> {
  const hilo = await prisma.dnxVendedorHilo.findUnique({ where: { contactoId } });
  if (!hilo) return null;
  const correos = await prisma.dnxVendedorCorreo.findMany({ where: { hiloId: hilo.id }, orderBy: { creadoEn: "asc" } });
  return { hilo, correos };
}

type Entrega = Pick<DnxVendedorCorreo, "direccion" | "entregadoEn" | "abiertoEn" | "clicEn" | "reboteEn" | "quejaEn">;

/** El estado de entrega de un correo saliente (lo que avisó Resend); null para los entrantes. */
export function estadoEntrega(c: Entrega): string | null {
  if (c.direccion !== "SALIDA") return null;
  if (c.reboteEn) return "Rebotó";
  if (c.quejaEn) return "Lo marcó como correo no deseado";
  if (c.clicEn) return "Abrió un enlace";
  if (c.abiertoEn) return "Abierto";
  if (c.entregadoEn) return "Entregado";
  return "Enviado";
}
