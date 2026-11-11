import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import type { DepsTelegramApi } from "@/lib/telegram/api";
import { destinoAgentes, mandarMensaje } from "../canal";
import type { FallaClaude } from "../claude";
import { costoUsd, type UsoClaude } from "../periodista/costo";
import { diaArgentino } from "../periodista/horario";
import { escaparHtml } from "../periodista/mensaje";
import { activarRegion, regionActual } from "./consultas";
import { vincularClf as vincularConClf } from "./clf";
import { guardarCandidato, type Candidato } from "./contactos";
import { ETIQUETA_NICHO, ETIQUETA_TIPO } from "./etiquetas";
import { costoLlamadaPlaces, gastoDelMes, leerAjustes, guardarAjustes, MARGEN_FRENO_USD, puedeUsar } from "./gasto";
import { buscarLugares } from "./places";
import { leerSitioPropio } from "./sitio";
import type { Region, TipoContacto } from "./tipos";
import { completarCorreos, conteoCorreos, contactosSinCorreo, MARGEN_CORREO_MS } from "./correos";
import { buscarCorreo, descubrirEnProvincia, leerLugar, MAX_BUSQUEDAS_LUGAR, MAX_BUSQUEDAS_PROVINCIA } from "./web";

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
 * - Una falla de todo un servicio (falta la clave, cuota agotada, API sin habilitar, Claude
 *   saturado o sin conexión) no es culpa de la tarea: la tarea vuelve a `PENDIENTE` sin gastar un
 *   intento y la corrida deja de usar ese servicio. Así una caída no quema toda la cola en FALLO
 *   ni cierra regiones en cascada.
 * - Sin `GOOGLE_PLACES_API_KEY` las tareas de Places ni se tocan (quedan `PENDIENTE`, la región no
 *   se cierra) y se sigue con la búsqueda web. Sin `ANTHROPIC_API_KEY` no hay búsqueda web: sólo
 *   corren las tareas de Places, leyendo cada lugar con el lector barato de su web propia y sin
 *   llamar nunca a Claude (un lugar sin web legible se descarta).
 * - Al final de cada corrida, si queda tiempo y gasto (y hay clave de Claude), corre el paso
 *   «completar correos» (`correos.ts`): hasta 5 contactos que ya están sin email. Mientras haya
 *   contactos sin intentar, las tareas le guardan `RESERVA_CORREOS_MS` del presupuesto.
 */

const MICROS = 1_000_000;
const MINUTOS_COLGADA = 20;
const MAX_INTENTOS = 3;
/** Cortes por tiempo que se le permiten a una tarea: al tercero queda HECHA (parcial) con lo avanzado. */
const MAX_CORTES = 3;
/** No se empieza un lugar nuevo con menos de esto: alcanza para leer la web propia (10 s) y una llamada a Claude. */
const MARGEN_LUGAR_MS = 90_000;
/** No se empieza una tarea de búsqueda web con menos de esto: una búsqueda por provincia con Claude tarda. */
const MARGEN_WEB_MS = 120_000;
/**
 * Piso de tokens que se anota cuando una llamada a Claude se corta por tiempo (Anthropic puede
 * cobrarla aunque no llegue la respuesta). Se suma a las búsquedas máximas de esa llamada.
 */
const TOKENS_ENTRADA_CORTADA = 2_000;
const TOKENS_SALIDA_CORTADA = 1_000;
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
  /** `correo`: la búsqueda del correo de un contacto que ya está en la base (paso «completar correos»). */
  web?: { descubrir: typeof descubrirEnProvincia; leer: typeof leerLugar; correo?: typeof buscarCorreo };
  /** Lector barato de la web propia (sin Claude). */
  sitio?: typeof leerSitioPropio;
  telegram?: DepsTelegramApi;
  /** A quién escribirle; por omisión, el chat vinculado al canal de agentes. */
  destino?: () => Promise<{ token: string; chatId: string } | null>;
  /**
   * Qué claves hay. Por omisión, mira `GOOGLE_PLACES_API_KEY` y `ANTHROPIC_API_KEY` del servidor.
   */
  claves?: () => { google: boolean; claude: boolean };
  /**
   * Vincula los contactos nuevos o actualizados con usuarios de CLF. Por omisión, `vincularClf`
   * de `clf.ts`, que se saltea en silencio si no está `CLF_CONSULTA_USUARIOS_SECRET`.
   */
  clf?: (ids: string[]) => Promise<void>;
};

export type FrenoBuscador =
  | null
  | "PAUSADO"
  | "TOPE_GOOGLE"
  | "TOPE_CLAUDE"
  | "SIN_REGION"
  /** Google no se pudo usar (sin clave, cuota agotada, API sin habilitar): siguió sólo con la web. */
  | "GOOGLE_NO_DISPONIBLE"
  /** Claude no se pudo usar (sin clave, saturado, sin conexión): no hubo búsqueda web. */
  | "CLAUDE_NO_DISPONIBLE";

export type ResultadoCorrida = {
  procesadas: number;
  nuevos: number;
  frenadoPor: FrenoBuscador;
  regionCerrada: Region | null;
  /** Paso «completar correos» de esta corrida. */
  correos: { intentados: number; completados: number };
};

/**
 * Tiempo que se le guarda al paso «completar correos» mientras haya contactos sin intentar: las
 * tareas normales trabajan con el presupuesto menos esto, así el paso entra al menos un contacto por
 * corrida (si no, una región con muchas tareas no le dejaría nunca tiempo). Sin pendientes, nada.
 */
const RESERVA_CORREOS_MS = MARGEN_CORREO_MS;

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
  /** Si se puede llamar a Claude en esta corrida (hay clave). */
  conClaude: boolean;
  deps: DepsMotor;
};

/**
 * Cómo terminó UN intento de una tarea. `GOOGLE_NO_DISPONIBLE` y `CLAUDE_NO_DISPONIBLE`: el servicio
 * entero falló; la tarea vuelve a PENDIENTE sin gastar el intento.
 */
type FinTarea = { nuevos: number; cortadaPor: null | "TOPE_CLAUDE" | "TIEMPO" | "GOOGLE_NO_DISPONIBLE" | "CLAUDE_NO_DISPONIBLE" };

/** Errores de Places que son del servicio entero, no de la consulta. */
const ERRORES_GOOGLE_DE_SERVICIO = new Set(["SIN_CLAVE", "CUOTA", "ACCESO"]);

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

/** `idsGuardados`: contactos nuevos o con datos nuevos en este intento (los que se cruzan con CLF). */
type Conteo = { encontrados: number; nuevos: number; actualizados: number; descartados: number; idsGuardados: string[] };

async function guardar(c: Candidato, conteo: Conteo, ctx: Contexto): Promise<void> {
  const r = await guardarCandidato(c, { ahora: ctx.ahora });
  conteo.encontrados++;
  if (r.nuevo) {
    conteo.nuevos++;
    conteo.idsGuardados.push(r.contactoId);
  } else if (r.datosNuevos > 0) {
    conteo.actualizados++;
    conteo.idsGuardados.push(r.contactoId);
  }
}

function sinTiempoParaClaude(ctx: Contexto): boolean {
  return ctx.hasta - ctx.reloj() < MINIMO_PARA_CLAUDE_MS;
}

/**
 * Costo conservador (en micros) de una llamada a Claude que se cortó por tiempo: todas sus
 * búsquedas posibles más un piso de tokens, a precio de Sonnet (`periodista/costo.ts`).
 */
function microsLlamadaCortada(maxBusquedas: number): number {
  return Math.round(costoUsd({ entrada: TOKENS_ENTRADA_CORTADA, salida: TOKENS_SALIDA_CORTADA, busquedas: maxBusquedas }) * MICROS);
}

/**
 * Qué hacer con una respuesta de Claude que no trajo nada. `null` = es un error de la tarea (lo
 * decide quien llama). Una llamada cortada anota además su costo estimado.
 */
async function corteDeClaude(t: FilaTarea, falla: FallaClaude | undefined, maxBusquedas: number, ctx: Contexto): Promise<FinTarea["cortadaPor"] | null> {
  if (falla === "SERVICIO") return "CLAUDE_NO_DISPONIBLE";
  if (falla === "CORTADA") {
    await anotarGasto(t.id, { claudeMicros: microsLlamadaCortada(maxBusquedas) });
    return "TIEMPO";
  }
  if (falla === "SIN_TIEMPO" || sinTiempoParaClaude(ctx)) return "TIEMPO";
  return null;
}

/** Tarea de Places: lugares → (web propia o Claude) → guardar. Lanza `ErrorDeTarea` si falla. */
async function tareaPlaces(t: FilaTarea, conteo: Conteo, ctx: Contexto): Promise<FinTarea["cortadaPor"]> {
  const places = ctx.deps.places ?? buscarLugares;
  const res = await places(t.consulta, { paginas: t.paginas, region: "ar" });
  const llamadas = res.llamadas ?? {};
  if (Object.keys(llamadas).length > 0) await anotarGasto(t.id, { googleMicros: await microsGoogle(llamadas, ctx.ahora()), llamadas });
  if ("error" in res) {
    // Sin clave, cuota agotada o API sin habilitar: no es culpa de esta consulta.
    if (ERRORES_GOOGLE_DE_SERVICIO.has(res.error)) return "GOOGLE_NO_DISPONIBLE";
    throw new ErrorDeTarea(`Google Places: ${res.error}`);
  }

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
    if (!candidato && !ctx.conClaude) {
      // Sin clave de Claude sólo vale la web propia: el lugar se descarta (no se marca visto).
      conteo.descartados++;
      continue;
    }
    if (!candidato) {
      if (inicial + gastadoClaude >= limite) return "TOPE_CLAUDE";
      // Si queda poco tiempo, `conversar` no llama a Claude (sin uso): abajo se toma como corte, no error.
      const r = await leer(lugar, datosTarea, { hasta: ctx.hasta, ahora: ctx.reloj });
      const micros = Math.round(costoUsd(r.uso) * MICROS);
      gastadoClaude += micros;
      if (micros > 0) await anotarGasto(t.id, { claudeMicros: micros });
      if (r.falla === "SERVICIO" || r.falla === "CORTADA" || r.falla === "SIN_TIEMPO" || sinUso(r.uso)) {
        const corte = await corteDeClaude(t, r.falla, MAX_BUSQUEDAS_LUGAR, ctx);
        if (corte) return corte;
        if (sinUso(r.uso)) throw new ErrorDeTarea("Claude no respondió");
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
  if (r.candidatos.length === 0 && (r.falla === "SERVICIO" || r.falla === "CORTADA" || r.falla === "SIN_TIEMPO" || sinUso(r.uso))) {
    const corte = await corteDeClaude(t, r.falla, MAX_BUSQUEDAS_PROVINCIA, ctx);
    if (corte) return corte;
    if (sinUso(r.uso)) throw new ErrorDeTarea("Claude no respondió");
  }
  conteo.descartados += r.descartados;
  for (const c of r.candidatos) await guardar(c, conteo, ctx);
  return null;
}

/** Un intento de una tarea ya tomada: la deja HECHA, de nuevo PENDIENTE o en FALLO. */
async function procesarTarea(t: FilaTarea, ctx: Contexto): Promise<FinTarea> {
  const conteo: Conteo = { encontrados: 0, nuevos: 0, actualizados: 0, descartados: 0, idsGuardados: [] };
  try {
    let cortadaPor = t.fuente === "GOOGLE_PLACES" ? await tareaPlaces(t, conteo, ctx) : await tareaWeb(t, conteo, ctx);
    const fila = await prisma.dnxBuscadorTarea.findUnique({ where: { id: t.id }, select: { resultado: true } });
    const previo = comoObjeto(fila?.resultado);
    // Sólo los cortes por tiempo cuentan para darla por hecha; una caída de servicio no.
    const cortes = (typeof previo.cortes === "number" ? previo.cortes : 0) + (cortadaPor === "TIEMPO" ? 1 : 0);
    // Al tercer corte por tiempo la tarea se da por hecha con lo avanzado (no se reintenta sin fin).
    const parcial = cortadaPor === "TIEMPO" && cortes >= MAX_CORTES;
    if (parcial) cortadaPor = null;
    if (cortadaPor) {
      // Cortar por tope, por tiempo o por un servicio caído no es un error: el intento no cuenta. Lo guardado queda.
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
    await vincularClf(conteo.idsGuardados, ctx.deps);
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
    await vincularClf(conteo.idsGuardados, ctx.deps);
    return { nuevos: conteo.nuevos, cortadaPor: null };
  }
}

/** Por omisión: sin secreto no se consulta (en silencio); si CLF falla, se anota y se sigue. */
async function clfPorOmision(ids: string[]): Promise<void> {
  if (!process.env.CLF_CONSULTA_USUARIOS_SECRET?.trim()) return;
  const r = await vincularConClf(ids);
  if (r.error) console.error("[buscador] vínculo con CLF:", r.error);
}

async function vincularClf(ids: string[], deps: DepsMotor): Promise<void> {
  if (ids.length === 0) return;
  try {
    await (deps.clf ?? clfPorOmision)([...new Set(ids)]);
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
  // El paso «completar correos» no es de una región: se cuenta lo hecho mientras esta región estuvo en curso.
  const fila = await prisma.dnxBuscadorRegion.findFirst({ where: { region }, select: { iniciadaEn: true } });
  const correos = await conteoCorreos(fila?.iniciadaEn ?? null);

  const linea =(nombre: string, n: number) => `• ${escaparHtml(nombre)}: ${n}`;
  const partes = [`<b>Región ${escaparHtml(REGIONES_NOMBRE[region])} lista</b>`, `Contactos nuevos: ${contactos.length}`];
  if (porTipo.length) partes.push("", "<b>Por tipo</b>", ...porTipo.map(([k, n]) => linea(ETIQUETA_TIPO[k as TipoContacto] ?? k, n)));
  if (porNicho.length) partes.push("", "<b>Fotógrafos por nicho</b>", ...porNicho.map(([k, n]) => linea(ETIQUETA_NICHO[k] ?? k.replace(/^OTRO:/, ""), n)));
  if (porCiudad.length) partes.push("", "<b>Ciudades con más contactos</b>", ...porCiudad.map(([k, n]) => linea(k, n)));
  partes.push("", `Correos completados: ${correos.completados} de ${correos.intentados} intentados`);
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

function clavesDelServidor(): { google: boolean; claude: boolean } {
  return { google: Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim()), claude: Boolean(process.env.ANTHROPIC_API_KEY?.trim()) };
}

export async function correrBuscador(
  opciones: { presupuestoMs: number; motivo: "CRON" | "MANUAL" },
  deps: DepsMotor = {},
): Promise<ResultadoCorrida> {
  const ahora = deps.ahora ?? (() => new Date());
  const reloj = deps.reloj ?? Date.now;
  const inicio = reloj();
  const claves = (deps.claves ?? clavesDelServidor)();
  const finCorrida = inicio + opciones.presupuestoMs;
  const ctx: Contexto = { ahora, reloj, hasta: finCorrida, conClaude: claves.claude, deps };
  const sinCorreos = { intentados: 0, completados: 0 };
  const vacio = (frenadoPor: FrenoBuscador): ResultadoCorrida => ({ procesadas: 0, nuevos: 0, frenadoPor, regionCerrada: null, correos: sinCorreos });

  if ((await leerAjustes()).pausado) return vacio("PAUSADO");
  await rescatarColgadas(ahora());

  /**
   * Paso «completar correos», al final de la corrida: sólo con Claude disponible y sin el tope del
   * mes cumplido. Devuelve lo hecho y, si frenó por tope o por una caída de Claude, el freno. Nunca lanza.
   */
  const pasoCorreos = async (frenadoAntes: FrenoBuscador): Promise<{ correos: ResultadoCorrida["correos"]; freno: FrenoBuscador }> => {
    if (!claves.claude || frenadoAntes === "PAUSADO" || frenadoAntes === "TOPE_CLAUDE" || frenadoAntes === "CLAUDE_NO_DISPONIBLE") {
      return { correos: sinCorreos, freno: null };
    }
    try {
      if (finCorrida - reloj() < MARGEN_CORREO_MS) return { correos: sinCorreos, freno: null };
      const claude = await puedeUsar("CLAUDE", ahora());
      if (!claude.ok) {
        if (claude.motivo !== "TOPE") return { correos: sinCorreos, freno: "PAUSADO" };
        await avisarTope("CLAUDE", ahora(), deps);
        return { correos: sinCorreos, freno: "TOPE_CLAUDE" };
      }
      const r = await completarCorreos({
        ahora, reloj, hasta: finCorrida, sitio: deps.sitio, buscar: deps.web?.correo, vincular: (ids) => vincularClf(ids, deps),
      });
      if (r.frenadoPor === "TOPE_CLAUDE") await avisarTope("CLAUDE", ahora(), deps);
      if (r.frenadoPor === "CLAUDE_NO_DISPONIBLE") console.error("[buscador] Claude no está disponible; se cortó el paso de correos");
      const freno = r.frenadoPor === "TOPE_CLAUDE" || r.frenadoPor === "CLAUDE_NO_DISPONIBLE" ? r.frenadoPor : null;
      return { correos: { intentados: r.intentados, completados: r.completados }, freno };
    } catch {
      console.error("[buscador] no se pudo correr el paso de correos");
      return { correos: sinCorreos, freno: null };
    }
  };

  let region = await regionActual();
  if (!region) {
    // Nunca una PAUSADA ni una COMPLETA: la primera en espera, por orden.
    const siguiente = await prisma.dnxBuscadorRegion.findFirst({ where: { estado: "EN_ESPERA" }, orderBy: { orden: "asc" } });
    if (!siguiente) {
      // Sin región que recorrer, el paso de correos igual corre.
      const paso = await pasoCorreos(null);
      return { ...vacio(paso.freno ?? "SIN_REGION"), correos: paso.correos };
    }
    region = siguiente.region as Region;
    await activarRegion(region, ahora());
  }

  // Con contactos sin correo por intentar, las tareas le dejan tiempo al paso de correos.
  if (claves.claude) {
    let pendientes = false;
    try {
      pendientes = (await contactosSinCorreo(1)).length > 0;
    } catch {
      console.error("[buscador] no se pudieron leer los contactos sin correo");
    }
    if (pendientes) ctx.hasta = finCorrida - RESERVA_CORREOS_MS;
  }

  let procesadas = 0;
  let nuevos = 0;
  let frenadoPor: FrenoBuscador = null;
  let googleAvisado = false;
  // Google sin clave no se intenta; si en la corrida aparece una falla de servicio, deja de usarse.
  let googleDisponible = claves.google;
  if (!claves.google) frenadoPor = "GOOGLE_NO_DISPONIBLE";
  if (!claves.claude) frenadoPor = "CLAUDE_NO_DISPONIBLE";
  const vistas = new Set<string>();

  while (reloj() < ctx.hasta) {
    const momento = ahora();
    const claude = await puedeUsar("CLAUDE", momento);
    if (claude.motivo === "PAUSADO") {
      frenadoPor = "PAUSADO";
      break;
    }
    if (!claude.ok) {
      // Con el tope de Claude cumplido se frena todo (las de Places también lo usan).
      await avisarTope("CLAUDE", momento, deps);
      frenadoPor = "TOPE_CLAUDE";
      break;
    }
    // Una tarea de Places sin tiempo para leer ni un lugar pagaría la búsqueda de Google en vano.
    let usarGoogle = googleDisponible && ctx.hasta - reloj() >= MARGEN_LUGAR_MS;
    if (usarGoogle) {
      const google = await puedeUsar("GOOGLE", momento);
      if (!google.ok) {
        if (!googleAvisado) await avisarTope("GOOGLE", momento, deps);
        googleAvisado = true;
        frenadoPor = "TOPE_GOOGLE";
        usarGoogle = false;
      }
    }
    // La búsqueda web necesita Claude y tiempo: con menos de 120 s no se empieza una.
    const usarWeb = claves.claude && ctx.hasta - reloj() >= MARGEN_WEB_MS;
    const fuentes = [...(usarGoogle ? ["GOOGLE_PLACES"] : []), ...(usarWeb ? ["WEB_SEARCH"] : [])];
    if (fuentes.length === 0) break;
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
    if (fin.cortadaPor === "GOOGLE_NO_DISPONIBLE") {
      // El resto de la corrida sigue sólo con la web; las de Places quedan PENDIENTE.
      console.error("[buscador] Google Places no está disponible; sigue sólo con la búsqueda web");
      googleDisponible = false;
      frenadoPor = "GOOGLE_NO_DISPONIBLE";
    }
    if (fin.cortadaPor === "CLAUDE_NO_DISPONIBLE") {
      // Sin Claude no sirve ni la web ni la lectura de lugares: se corta acá y se reintenta en la próxima corrida.
      console.error("[buscador] Claude no está disponible; la corrida se corta");
      frenadoPor = "CLAUDE_NO_DISPONIBLE";
      break;
    }
  }

  const paso = await pasoCorreos(frenadoPor);
  if (paso.freno) frenadoPor = paso.freno;
  const regionCerrada = await cerrarSiTermino(region, ahora(), deps);
  return { procesadas, nuevos, frenadoPor, regionCerrada, correos: paso.correos };
}
