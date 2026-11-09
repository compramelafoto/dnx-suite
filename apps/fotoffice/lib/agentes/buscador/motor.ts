import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import type { DepsTelegramApi } from "@/lib/telegram/api";
import { destinoAgentes, mandarMensaje } from "../canal";
import { costoUsd, type UsoClaude } from "../periodista/costo";
import { diaArgentino } from "../periodista/horario";
import { escaparHtml } from "../periodista/mensaje";
import { activarRegion, regionActual } from "./consultas";
import { guardarCandidato, type Candidato } from "./contactos";
import { ETIQUETA_NICHO, ETIQUETA_TIPO } from "./etiquetas";
import { costoLlamadaPlaces, gastoDelMes, leerAjustes, guardarAjustes, MARGEN_FRENO_USD, puedeUsar } from "./gasto";
import { buscarLugares } from "./places";
import { leerSitioPropio } from "./sitio";
import type { Region, TipoContacto } from "./tipos";
import { descubrirEnProvincia, leerLugar } from "./web";

/**
 * Motor del Buscador: lo llama el cron. Toma tareas de la región en curso, busca (Google Places o
 * búsqueda web con Claude), guarda los contactos, respeta los topes de gasto del mes, cierra la
 * región cuando no le queda nada y le avisa a Daniel por Telegram.
 *
 * Reglas que cuida:
 * - Una tarea se toma con `updateMany` condicionado a `PENDIENTE`: dos corridas a la vez no la
 *   procesan dos veces. Una `EN_CURSO` de hace más de 20 minutos es una corrida que murió y vuelve
 *   a `PENDIENTE`.
 * - El gasto se anota en la tarea apenas se hace cada llamada paga (también si después falla), y
 *   se acumula intento tras intento. Google se cobra llamada por llamada con el cupo gratis del mes.
 * - De Google Places sólo se usa el `placeId`: los datos salen de la web propia (lector barato,
 *   sin Claude) o, si no alcanza, de Claude (`leerLugar`).
 * - Los textos de Telegram son propios: nunca se reenvía un error crudo.
 */

const MICROS = 1_000_000;
const MINUTOS_COLGADA = 20;
const MAX_INTENTOS = 3;
/** Cortes por tiempo que se le permiten a una tarea: al tercero queda HECHA (parcial) con lo avanzado. */
const MAX_CORTES = 3;
/** No se empieza un lugar nuevo con menos de esto: alcanza para leer la web propia (10 s) y una llamada a Claude. */
const MARGEN_LUGAR_MS = 60_000;
/** Por debajo de esto `conversar` ni siquiera llama a Claude (ver `claude.ts`). */
const MINIMO_PARA_CLAUDE_MS = 15_000;
/** Si más de esta parte de las tareas de la región terminó en FALLO, el resumen lo avisa. */
const PROPORCION_FALLO_AVISO = 0.2;

export const REGIONES_NOMBRE: Record<Region, string> = {
  CENTRO: "Centro",
  BUENOS_AIRES_AMBA: "Buenos Aires y AMBA",
  CUYO: "Cuyo",
  NOA: "NOA",
  NEA: "NEA",
  PATAGONIA: "Patagonia",
};

export type DepsMotor = {
  ahora?: () => Date;
  /** Milisegundos para medir el presupuesto de tiempo (y el plazo de Claude). */
  reloj?: () => number;
  places?: typeof buscarLugares;
  web?: { descubrir: typeof descubrirEnProvincia; leer: typeof leerLugar };
  /** Lector barato de la web propia (sin Claude). */
  sitio?: typeof leerSitioPropio;
  telegram?: DepsTelegramApi;
  /** A quién escribirle; por omisión, el chat vinculado al canal de agentes. */
  destino?: () => Promise<{ token: string; chatId: string } | null>;
  /** Vincula los contactos nuevos con usuarios de CLF (Task 12); si no está, no se hace nada. */
  clf?: (ids: string[]) => Promise<void>;
};

export type FrenoBuscador = null | "PAUSADO" | "TOPE_GOOGLE" | "TOPE_CLAUDE" | "SIN_REGION";

export type ResultadoCorrida = { procesadas: number; nuevos: number; frenadoPor: FrenoBuscador; regionCerrada: Region | null };

type FilaTarea = {
  id: string;
  region: string;
  provincia: string;
  ciudad: string | null;
  tipo: string;
  nicho: string | null;
  fuente: string;
  consulta: string;
  paginas: number;
  intentos: number;
};

type Contexto = {
  ahora: () => Date;
  reloj: () => number;
  /** Instante (en `reloj`) en que se acaba el presupuesto. */
  hasta: number;
  deps: DepsMotor;
};

/** Cómo terminó UN intento de una tarea. */
type FinTarea = { nuevos: number; cortadaPor: null | "TOPE_CLAUDE" | "TIEMPO" };

/** "USD 6,10": siempre dos decimales y coma. */
export function textoDinero(usd: number): string {
  return `USD ${(Math.round(usd * 100) / 100).toFixed(2).replace(".", ",")}`;
}

function mesArgentino(ahora: Date): string {
  return diaArgentino(ahora).slice(0, 7);
}

function comoObjeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};
}

function sumarLlamadas(a: unknown, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(comoObjeto(a))) if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}

function sinUso(uso: UsoClaude): boolean {
  return !uso.entrada && !uso.salida && !uso.busquedas && !uso.cacheEscritura && !uso.cacheLectura;
}

class ErrorDeTarea extends Error {}

// ---------------------------------------------------------------------------------------------
// Telegram

async function decir(texto: string, deps: DepsMotor): Promise<boolean> {
  try {
    const destino = await (deps.destino ?? destinoAgentes)();
    if (!destino) return false;
    const r = await mandarMensaje(destino.token, destino.chatId, texto, null, deps.telegram ?? {});
    return r.ok;
  } catch {
    console.error("[buscador] no se pudo mandar el mensaje de Telegram");
    return false;
  }
}

/** Aviso de tope: una sola vez por mes y por fuente (queda anotado en los ajustes). */
async function avisarTope(fuente: "GOOGLE" | "CLAUDE", ahora: Date, deps: DepsMotor): Promise<void> {
  const ajustes = await leerAjustes();
  const mes = mesArgentino(ahora);
  if (ajustes.avisoTope[fuente] === mes) return;
  const gasto = await gastoDelMes(ahora);
  const gastado = fuente === "GOOGLE" ? gasto.googleUsd : gasto.claudeUsd;
  const tope = fuente === "GOOGLE" ? ajustes.topeGoogleUsd : ajustes.topeClaudeUsd;
  const nombre = fuente === "GOOGLE" ? "Google Places" : "Claude";
  const sigue =
    fuente === "GOOGLE"
      ? "Mientras tanto sigue con las búsquedas web."
      : "No busca nada más hasta el mes que viene.";
  const panel = appUrl();
  const texto = [
    `<b>El Buscador frenó ${escaparHtml(nombre)}</b>`,
    `Este mes ya se usaron ${textoDinero(gastado)} de dinero en ${escaparHtml(nombre)}, y el tope es ${textoDinero(tope)} (frena ${textoDinero(MARGEN_FRENO_USD)} antes para no pasarse).`,
    sigue,
    panel ? `Si querés que siga, podés subir el tope en ${escaparHtml(`${panel}/admin/contactos-dnx`)}` : "Si querés que siga, podés subir el tope en el panel de Contactos DNX.",
  ].join("\n");
  if (await decir(texto, deps)) await guardarAjustes({ avisoTope: { [fuente]: mes } });
}

// ---------------------------------------------------------------------------------------------
// Tareas

/**
 * Las `EN_CURSO` de hace más de 20 minutos son de una corrida que murió: vuelven a la cola, salvo
 * que ya hayan gastado todos sus intentos (una tarea que siempre mata la corrida no se repite sin fin).
 */
async function rescatarColgadas(ahora: Date): Promise<void> {
  const colgada = { estado: "EN_CURSO", tomadaEn: { lt: new Date(ahora.getTime() - MINUTOS_COLGADA * 60_000) } };
  await prisma.dnxBuscadorTarea.updateMany({ where: { ...colgada, intentos: { gte: MAX_INTENTOS } }, data: { estado: "FALLO" } });
  await prisma.dnxBuscadorTarea.updateMany({ where: { ...colgada, intentos: { lt: MAX_INTENTOS } }, data: { estado: "PENDIENTE" } });
}

/** La próxima `PENDIENTE` de la región (por prioridad e id) que esta corrida logra tomar. */
async function tomarSiguiente(region: Region, fuentes: string[], vistas: Set<string>, ahora: Date): Promise<FilaTarea | null> {
  for (;;) {
    const t = await prisma.dnxBuscadorTarea.findFirst({
      where: { region, estado: "PENDIENTE", fuente: { in: fuentes }, id: { notIn: [...vistas] } },
      orderBy: [{ prioridad: "asc" }, { id: "asc" }],
    });
    if (!t) return null;
    vistas.add(t.id);
    const { count } = await prisma.dnxBuscadorTarea.updateMany({
      where: { id: t.id, estado: "PENDIENTE" },
      data: { estado: "EN_CURSO", tomadaEn: ahora, intentos: { increment: 1 } },
    });
    if (count === 1) return { ...t, intentos: t.intentos + 1 };
    // Otra corrida la tomó entre la lectura y la toma: se sigue con la próxima.
  }
}

/** Cambia el `resultado` de la tarea a partir del actual. */
async function cambiarResultado(id: string, cambio: (previo: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
  const fila = await prisma.dnxBuscadorTarea.findUnique({ where: { id }, select: { resultado: true } });
  await prisma.dnxBuscadorTarea.update({ where: { id }, data: { resultado: cambio(comoObjeto(fila?.resultado)) as Prisma.InputJsonValue } });
}

function listaDeTextos(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Suma a la tarea lo gastado en una tanda de llamadas (micros y llamadas por SKU). */
async function anotarGasto(id: string, gasto: { googleMicros?: number; claudeMicros?: number; llamadas?: Record<string, number> }): Promise<void> {
  const fila = await prisma.dnxBuscadorTarea.findUnique({ where: { id }, select: { resultado: true } });
  const resultado = comoObjeto(fila?.resultado);
  const data: Prisma.DnxBuscadorTareaUpdateInput = {
    costoGoogleUsdMicros: { increment: gasto.googleMicros ?? 0 },
    costoClaudeUsdMicros: { increment: gasto.claudeMicros ?? 0 },
  };
  if (gasto.llamadas && Object.keys(gasto.llamadas).length > 0) {
    data.resultado = { ...resultado, llamadas: sumarLlamadas(resultado.llamadas, gasto.llamadas) } as Prisma.InputJsonValue;
  }
  await prisma.dnxBuscadorTarea.update({ where: { id }, data });
}

/**
 * Costo de Google en micros, llamada por llamada, con el cupo gratis que quede en el mes. Si no se
 * puede leer el mes, se cobra a precio lleno (sin cupo gratis): el gasto se anota igual.
 */
async function microsGoogle(llamadas: Record<string, number>, ahora: Date): Promise<number> {
  let previas: Record<string, number>;
  try {
    previas = (await gastoDelMes(ahora)).llamadasPorSku;
  } catch {
    console.error("[buscador] no se pudo leer el gasto del mes; Google se anota a precio lleno");
    previas = Object.fromEntries(Object.keys(llamadas).map((sku) => [sku, Number.POSITIVE_INFINITY]));
  }
  let micros = 0;
  for (const [sku, cantidad] of Object.entries(llamadas)) {
    for (let i = 0; i < cantidad; i++) micros += Math.round(costoLlamadaPlaces(sku, (previas[sku] ?? 0) + i) * MICROS);
  }
  return micros;
}

type Conteo = { encontrados: number; nuevos: number; actualizados: number; descartados: number; idsNuevos: string[] };

async function guardar(c: Candidato, conteo: Conteo, ctx: Contexto): Promise<void> {
  const r = await guardarCandidato(c, { ahora: ctx.ahora });
  conteo.encontrados++;
  if (r.nuevo) {
    conteo.nuevos++;
    conteo.idsNuevos.push(r.contactoId);
  } else if (r.datosNuevos > 0) conteo.actualizados++;
}

function sinTiempoParaClaude(ctx: Contexto): boolean {
  return ctx.hasta - ctx.reloj() < MINIMO_PARA_CLAUDE_MS;
}

/** Tarea de Places: lugares → (web propia o Claude) → guardar. Lanza `ErrorDeTarea` si falla. */
async function tareaPlaces(t: FilaTarea, conteo: Conteo, ctx: Contexto): Promise<FinTarea["cortadaPor"]> {
  const places = ctx.deps.places ?? buscarLugares;
  const res = await places(t.consulta, { paginas: t.paginas, region: "ar" });
  const llamadas = ("error" in res ? res.llamadas : res.llamadas) ?? {};
  if (Object.keys(llamadas).length > 0) await anotarGasto(t.id, { googleMicros: await microsGoogle(llamadas, ctx.ahora()), llamadas });
  if ("error" in res) throw new ErrorDeTarea(`Google Places: ${res.error}`);

  // Lugares que un intento anterior ya leyó sin sacar candidato: no se vuelve a pagar Claude por ellos.
  const vistos = new Set(listaDeTextos(comoObjeto((await prisma.dnxBuscadorTarea.findUnique({ where: { id: t.id }, select: { resultado: true } }))?.resultado).vistos));

  // Tope de Claude dentro de la tarea: se lleva la cuenta local para no releer el mes por lugar.
  const ajustes = await leerAjustes();
  const inicial = Math.round((await gastoDelMes(ctx.ahora())).claudeUsd * MICROS);
  const limite = Math.round((ajustes.topeClaudeUsd - MARGEN_FRENO_USD) * MICROS);
  let gastadoClaude = 0;

  const leer = ctx.deps.web?.leer ?? leerLugar;
  const sitio = ctx.deps.sitio ?? leerSitioPropio;
  const datosTarea = {
    ciudad: t.ciudad ?? t.provincia,
    provincia: t.provincia,
    region: t.region as Region,
    tipo: t.tipo as TipoContacto,
    nicho: t.nicho,
  };

  for (const lugar of res.lugares) {
    if (vistos.has(lugar.placeId)) continue;
    if (ctx.hasta - ctx.reloj() < MARGEN_LUGAR_MS) return "TIEMPO";
    const existe = await prisma.dnxContacto.findFirst({ where: { googlePlaceId: lugar.placeId }, select: { id: true } });
    if (existe) continue;

    let candidato = lugar.web ? await sitio(lugar.web, { ...datosTarea, googlePlaceId: lugar.placeId }) : null;
    if (!candidato) {
      if (inicial + gastadoClaude >= limite) return "TOPE_CLAUDE";
      // Si queda poco tiempo, `conversar` no llama a Claude (sin uso): abajo se toma como corte, no error.
      const r = await leer(lugar, datosTarea, { hasta: ctx.hasta, ahora: ctx.reloj });
      const micros = Math.round(costoUsd(r.uso) * MICROS);
      gastadoClaude += micros;
      if (micros > 0) await anotarGasto(t.id, { claudeMicros: micros });
      if (sinUso(r.uso)) {
        if (sinTiempoParaClaude(ctx)) return "TIEMPO";
        throw new ErrorDeTarea("Claude no respondió");
      }
      candidato = r.candidato;
    }
    if (!candidato) {
      conteo.descartados++;
      vistos.add(lugar.placeId);
      await cambiarResultado(t.id, (r) => ({ ...r, vistos: [...vistos] }));
      continue;
    }
    await guardar(candidato, conteo, ctx);
  }
  return null;
}

/** Tarea de web por provincia: Claude descubre → guardar. */
async function tareaWeb(t: FilaTarea, conteo: Conteo, ctx: Contexto): Promise<FinTarea["cortadaPor"]> {
  const descubrir = ctx.deps.web?.descubrir ?? descubrirEnProvincia;
  const r = await descubrir(
    { provincia: t.provincia, region: t.region as Region, tipo: t.tipo as TipoContacto, nicho: t.nicho },
    { hasta: ctx.hasta, ahora: ctx.reloj },
  );
  const micros = Math.round(costoUsd(r.uso) * MICROS);
  if (micros > 0) await anotarGasto(t.id, { claudeMicros: micros });
  if (sinUso(r.uso) && r.candidatos.length === 0) {
    if (sinTiempoParaClaude(ctx)) return "TIEMPO";
    throw new ErrorDeTarea("Claude no respondió");
  }
  conteo.descartados += r.descartados;
  for (const c of r.candidatos) await guardar(c, conteo, ctx);
  return null;
}

/** Un intento de una tarea ya tomada: la deja HECHA, de nuevo PENDIENTE o en FALLO. */
async function procesarTarea(t: FilaTarea, ctx: Contexto): Promise<FinTarea> {
  const conteo: Conteo = { encontrados: 0, nuevos: 0, actualizados: 0, descartados: 0, idsNuevos: [] };
  try {
    let cortadaPor = t.fuente === "GOOGLE_PLACES" ? await tareaPlaces(t, conteo, ctx) : await tareaWeb(t, conteo, ctx);
    const fila = await prisma.dnxBuscadorTarea.findUnique({ where: { id: t.id }, select: { resultado: true } });
    const previo = comoObjeto(fila?.resultado);
    const cortes = (typeof previo.cortes === "number" ? previo.cortes : 0) + (cortadaPor === "TIEMPO" ? 1 : 0);
    // Al tercer corte por tiempo la tarea se da por hecha con lo avanzado (no se reintenta sin fin).
    const parcial = cortadaPor === "TIEMPO" && cortes >= MAX_CORTES;
    if (parcial) cortadaPor = null;
    if (cortadaPor) {
      // Cortar por tope o por tiempo no es un error: el intento no cuenta. Lo guardado queda.
      await prisma.dnxBuscadorTarea.update({
        where: { id: t.id },
        data: { estado: "PENDIENTE", intentos: { decrement: 1 }, resultado: { ...previo, cortes } as Prisma.InputJsonValue },
      });
    } else {
      const sinError = { ...previo };
      delete sinError.error;
      const resultado = {
        ...sinError,
        encontrados: conteo.encontrados,
        nuevos: conteo.nuevos,
        actualizados: conteo.actualizados,
        descartados: conteo.descartados,
        llamadas: sumarLlamadas(previo.llamadas, {}),
        ...(cortes > 0 ? { cortes } : {}),
        ...(parcial ? { parcial: true } : {}),
      };
      await prisma.dnxBuscadorTarea.update({
        where: { id: t.id },
        data: { estado: "HECHA", hechaEn: ctx.ahora(), resultado: resultado as Prisma.InputJsonValue },
      });
    }
    await vincularClf(conteo.idsNuevos, ctx.deps);
    return { nuevos: conteo.nuevos, cortadaPor };
  } catch (e) {
    const motivo = e instanceof ErrorDeTarea ? e.message : "error inesperado";
    if (!(e instanceof ErrorDeTarea)) console.error("[buscador] la tarea falló", t.id, e instanceof Error ? e.name : "");
    const fila = await prisma.dnxBuscadorTarea.findUnique({ where: { id: t.id }, select: { resultado: true } });
    await prisma.dnxBuscadorTarea.update({
      where: { id: t.id },
      data: {
        estado: t.intentos >= MAX_INTENTOS ? "FALLO" : "PENDIENTE",
        resultado: { ...comoObjeto(fila?.resultado), error: motivo } as Prisma.InputJsonValue,
      },
    });
    await vincularClf(conteo.idsNuevos, ctx.deps);
    return { nuevos: conteo.nuevos, cortadaPor: null };
  }
}

async function vincularClf(ids: string[], deps: DepsMotor): Promise<void> {
  if (!deps.clf || ids.length === 0) return;
  try {
    await deps.clf(ids);
  } catch {
    console.error("[buscador] no se pudo vincular con CLF");
  }
}

// ---------------------------------------------------------------------------------------------
// Región

/** El texto de cierre de una región (HTML de Telegram). */
export async function resumenDeRegion(region: Region): Promise<string> {
  const contactos = await prisma.dnxContacto.findMany({
    where: { region, creadoPor: "BUSCADOR", fusionadoEnId: null },
    select: { tipo: true, nichos: true, ciudad: true },
  });
  const tareas = await prisma.dnxBuscadorTarea.findMany({
    where: { region },
    select: { estado: true, costoGoogleUsdMicros: true, costoClaudeUsdMicros: true },
  });

  const contar = (claves: string[]) => {
    const m = new Map<string, number>();
    for (const k of claves) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  };
  const porTipo = contar(contactos.map((c) => c.tipo));
  const porNicho = contar(contactos.filter((c) => c.tipo === "FOTOGRAFO").flatMap((c) => c.nichos));
  const porCiudad = contar(contactos.map((c) => c.ciudad?.trim()).filter((c): c is string => Boolean(c))).slice(0, 5);
  const google = tareas.reduce((s, t) => s + t.costoGoogleUsdMicros, 0) / MICROS;
  const claude = tareas.reduce((s, t) => s + t.costoClaudeUsdMicros, 0) / MICROS;
  const fallos = tareas.filter((t) => t.estado === "FALLO").length;

  const linea = (nombre: string, n: number) => `• ${escaparHtml(nombre)}: ${n}`;
  const partes = [`<b>Región ${escaparHtml(REGIONES_NOMBRE[region])} lista</b>`, `Contactos nuevos: ${contactos.length}`];
  if (porTipo.length) partes.push("", "<b>Por tipo</b>", ...porTipo.map(([k, n]) => linea(ETIQUETA_TIPO[k as TipoContacto] ?? k, n)));
  if (porNicho.length) partes.push("", "<b>Fotógrafos por nicho</b>", ...porNicho.map(([k, n]) => linea(ETIQUETA_NICHO[k] ?? k.replace(/^OTRO:/, ""), n)));
  if (porCiudad.length) partes.push("", "<b>Ciudades con más contactos</b>", ...porCiudad.map(([k, n]) => linea(k, n)));
  partes.push("", `Gasto de la región: Google ${textoDinero(google)} · Claude ${textoDinero(claude)}`);
  if (tareas.length > 0 && fallos / tareas.length > PROPORCION_FALLO_AVISO) {
    const pct = Math.round((fallos / tareas.length) * 100);
    partes.push(`Atención: ${fallos} de ${tareas.length} búsquedas fallaron (${pct} %). Conviene revisarlas en el panel.`);
  }
  const base = appUrl();
  if (base) partes.push("", escaparHtml(`${base}/admin/contactos-dnx?region=${region}`));
  return partes.join("\n");
}

/** Si a la región no le queda nada pendiente ni en curso: la cierra, avisa y activa la siguiente. */
async function cerrarSiTermino(region: Region, ahora: Date, deps: DepsMotor): Promise<Region | null> {
  const quedan = await prisma.dnxBuscadorTarea.count({ where: { region, estado: { in: ["PENDIENTE", "EN_CURSO"] } } });
  if (quedan > 0) return null;
  // Condicionado a EN_CURSO: si otra corrida ya la cerró, ésta no repite el resumen.
  const { count } = await prisma.dnxBuscadorRegion.updateMany({
    where: { region, estado: "EN_CURSO" },
    data: { estado: "COMPLETA", completadaEn: ahora },
  });
  if (count !== 1) return null;
  if (await decir(await resumenDeRegion(region), deps)) {
    await prisma.dnxBuscadorRegion.update({ where: { region }, data: { resumenEnviadoEn: ahora } });
  }
  const siguiente = await prisma.dnxBuscadorRegion.findFirst({ where: { estado: "EN_ESPERA" }, orderBy: { orden: "asc" } });
  if (siguiente) await activarRegion(siguiente.region as Region, ahora);
  return region;
}

// ---------------------------------------------------------------------------------------------
// Corrida

export async function correrBuscador(
  opciones: { presupuestoMs: number; motivo: "CRON" | "MANUAL" },
  deps: DepsMotor = {},
): Promise<ResultadoCorrida> {
  const ahora = deps.ahora ?? (() => new Date());
  const reloj = deps.reloj ?? Date.now;
  const inicio = reloj();
  const ctx: Contexto = { ahora, reloj, hasta: inicio + opciones.presupuestoMs, deps };
  const vacio = (frenadoPor: FrenoBuscador): ResultadoCorrida => ({ procesadas: 0, nuevos: 0, frenadoPor, regionCerrada: null });

  if ((await leerAjustes()).pausado) return vacio("PAUSADO");
  await rescatarColgadas(ahora());

  let region = await regionActual();
  if (!region) {
    // Nunca una PAUSADA ni una COMPLETA: la primera en espera, por orden.
    const siguiente = await prisma.dnxBuscadorRegion.findFirst({ where: { estado: "EN_ESPERA" }, orderBy: { orden: "asc" } });
    if (!siguiente) return vacio("SIN_REGION");
    region = siguiente.region as Region;
    await activarRegion(region, ahora());
  }

  let procesadas = 0;
  let nuevos = 0;
  let frenadoPor: FrenoBuscador = null;
  let googleAvisado = false;
  const vistas = new Set<string>();

  while (reloj() - inicio < opciones.presupuestoMs) {
    const momento = ahora();
    const claude = await puedeUsar("CLAUDE", momento);
    if (claude.motivo === "PAUSADO") {
      frenadoPor = "PAUSADO";
      break;
    }
    if (!claude.ok) {
      // Sin Claude no sirve ninguna tarea: las de Places también lo necesitan.
      await avisarTope("CLAUDE", momento, deps);
      frenadoPor = "TOPE_CLAUDE";
      break;
    }
    const google = await puedeUsar("GOOGLE", momento);
    if (!google.ok) {
      if (!googleAvisado) await avisarTope("GOOGLE", momento, deps);
      googleAvisado = true;
      frenadoPor = "TOPE_GOOGLE";
    }
    const fuentes = google.ok ? ["GOOGLE_PLACES", "WEB_SEARCH"] : ["WEB_SEARCH"];
    const tarea = await tomarSiguiente(region, fuentes, vistas, momento);
    if (!tarea) break;

    const fin = await procesarTarea(tarea, ctx);
    procesadas++;
    nuevos += fin.nuevos;
    if (fin.cortadaPor === "TOPE_CLAUDE") {
      await avisarTope("CLAUDE", ahora(), deps);
      frenadoPor = "TOPE_CLAUDE";
      break;
    }
    if (fin.cortadaPor === "TIEMPO") break;
  }

  const regionCerrada = await cerrarSiTermino(region, ahora(), deps);
  return { procesadas, nuevos, frenadoPor, regionCerrada };
}
