import "server-only";
import { prisma, type Prisma } from "@repo/db";
import type { FallaClaude } from "../claude";
import { costoUsd, type UsoClaude } from "../periodista/costo";
import { vincularDnxEstudio, type DatoConFuente } from "./contactos";
import { gastoDelMes, leerAjustes, MARGEN_FRENO_USD } from "./gasto";
import { claveEmail } from "./normalizar";
import { leerSitioPropio } from "./sitio";
import {
  EVENTO_BUSQUEDA_CORREO, TIPOS_CONTACTO, type Region, type ResultadoBusquedaCorreo, type TipoContacto,
} from "./tipos";
import { buscarCorreo, MAX_BUSQUEDAS_CORREO } from "./web";

/**
 * Paso «completar correos» del Buscador: a los contactos que ya están en la base sin email (pero con
 * web, Instagram o Facebook) les busca el correo comercial publicado, porque el Vendedor sólo
 * escribe por correo. Lo corre el motor al final de cada corrida, si queda tiempo y gasto.
 *
 * Reglas:
 * - Primero los fotógrafos con nicho ESCOLAR o TURISTICA (en cualquier posición), después los demás
 *   fotógrafos y después los otros tipos. Nunca un fusionado, un NO_CONTACTAR ni un DESCARTADO.
 * - Con web, primero el lector barato de la web propia (sin Claude); sólo si no trae correo, Claude
 *   con búsqueda acotada (`buscarCorreo`). Sin web, Claude con nombre, ciudad, Instagram y Facebook.
 * - Cada intento queda como evento `BUSQUEDA_CORREO` del contacto, con su resultado y su costo: así no
 *   se repite y `gastoDelMes` lo suma. El evento se crea ANTES de llamar a Claude con un costo
 *   estimado conservador (por si la corrida muere en el medio) y después se corrige con el real.
 * - Sólo se completa el email (y su `DnxContactoDato` con fuente) del contacto EXISTENTE, y sólo si
 *   sigue vacío: no se crean contactos ni se pisa nada. Un correo que ya es de otro contacto no se
 *   asigna (queda el intento como `DUPLICADO`).
 * - Una caída de Claude, una llamada cortada o la falta de tiempo no gastan el intento
 *   (`REINTENTAR`) y cortan el paso; después de `MAX_REINTENTOS_CORREO` se da por intentado.
 * - Nunca lanza.
 */

/** Contactos que se intentan por corrida, como mucho. */
export const MAX_CORREOS_POR_CORRIDA = 5;
/** No se empieza un contacto con menos de esto: alcanza para la web propia (10 s) y una llamada a Claude. */
export const MARGEN_CORREO_MS = 90_000;
/** Intentos que terminaron en `REINTENTAR` a partir de los cuales el contacto ya no se vuelve a probar. */
export const MAX_REINTENTOS_CORREO = 3;

const MICROS = 1_000_000;
const AUTOR = "BUSCADOR";
/** Mismo piso que el motor para una llamada cortada (Anthropic puede cobrarla igual). */
const TOKENS_ENTRADA_CORTADA = 2_000;
const TOKENS_SALIDA_CORTADA = 1_000;

export type FilaSinCorreo = {
  id: string;
  tipo: string;
  nichos: string[];
  nombre: string;
  ciudad: string | null;
  provincia: string | null;
  region: string | null;
  web: string | null;
  instagram: string | null;
  facebook: string | null;
  googlePlaceId: string | null;
  creadoEn: Date;
};

export type DepsCorreos = {
  ahora: () => Date;
  reloj: () => number;
  /** Instante (en `reloj`) en que se acaba el presupuesto de la corrida. */
  hasta: number;
  sitio?: typeof leerSitioPropio;
  buscar?: typeof buscarCorreo;
  /** Vincula con CLF los contactos que ganaron un correo (el motor pasa el suyo). */
  vincular?: (ids: string[]) => Promise<void>;
};

export type ResultadoCorreos = {
  intentados: number;
  completados: number;
  frenadoPor: null | "TOPE_CLAUDE" | "CLAUDE_NO_DISPONIBLE" | "TIEMPO";
};

/** 0: fotógrafo escolar o de turismo; 1: otro fotógrafo; 2: los demás tipos. */
export function prioridadCorreo(c: { tipo: string; nichos: string[] }): number {
  if (c.tipo !== "FOTOGRAFO") return 2;
  return c.nichos.includes("ESCOLAR") || c.nichos.includes("TURISTICA") ? 0 : 1;
}

function texto(v: string | null | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

function resultadoDe(datos: unknown): string | null {
  const r = (datos as { resultado?: unknown } | null)?.resultado;
  return typeof r === "string" ? r : null;
}

/** ¿Ya no hay que volver a probar este contacto? (un intento hecho, o demasiados para reintentar). */
function yaIntentado(resultados: string[]): boolean {
  if (resultados.some((r) => r !== "REINTENTAR")) return true;
  return resultados.length >= MAX_REINTENTOS_CORREO;
}

/** Los contactos sin email que todavía no se intentaron, en orden de prioridad (hasta `limite`). */
export async function contactosSinCorreo(limite: number): Promise<FilaSinCorreo[]> {
  const filas = (await prisma.dnxContacto.findMany({
    where: {
      email: null,
      fusionadoEnId: null,
      estado: { notIn: ["NO_CONTACTAR", "DESCARTADO"] },
      OR: [{ web: { not: null } }, { instagram: { not: null } }, { facebook: { not: null } }],
    },
    select: {
      id: true, tipo: true, nichos: true, nombre: true, ciudad: true, provincia: true, region: true,
      web: true, instagram: true, facebook: true, googlePlaceId: true, creadoEn: true,
    },
  })) as FilaSinCorreo[];
  const conAlgo = filas.filter((f) => texto(f.web) || texto(f.instagram) || texto(f.facebook));
  if (conAlgo.length === 0) return [];

  const eventos = await prisma.dnxContactoEvento.findMany({
    where: { tipo: EVENTO_BUSQUEDA_CORREO, contactoId: { in: conAlgo.map((f) => f.id) } },
    select: { contactoId: true, datos: true },
  });
  const porContacto = new Map<string, string[]>();
  for (const e of eventos) {
    const lista = porContacto.get(e.contactoId) ?? [];
    lista.push(resultadoDe(e.datos) ?? "ERROR");
    porContacto.set(e.contactoId, lista);
  }
  return conAlgo
    .filter((f) => !yaIntentado(porContacto.get(f.id) ?? []))
    .sort(
      (a, b) =>
        prioridadCorreo(a) - prioridadCorreo(b) ||
        new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime() ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limite);
}

/**
 * Asigna el correo al contacto si sigue sin email y no es de otro contacto. Todo en una transacción:
 * el email y su clave, el `DnxContactoDato` con la fuente y el evento `DATO_NUEVO`.
 */
export async function guardarCorreo(
  contactoId: string,
  dato: DatoConFuente,
  ahora: Date,
): Promise<{ resultado: "COMPLETADO" | "DUPLICADO" | "YA_TENIA"; otroContactoId?: string }> {
  const valor = dato.valor.trim().toLowerCase();
  const clave = claveEmail(valor);
  return prisma.$transaction(async (tx) => {
    const otros = await tx.dnxContacto.findMany({
      where: {
        id: { not: contactoId },
        OR: [...(clave ? [{ claveEmail: clave }] : []), { email: { equals: valor, mode: "insensitive" as const } }],
      },
      select: { id: true, fusionadoEnId: true },
    });
    // Un contacto ya fusionado EN éste es el mismo negocio: no cuenta como dueño del correo.
    const otro = otros.find((o) => o.fusionadoEnId !== contactoId);
    if (otro) return { resultado: "DUPLICADO" as const, otroContactoId: otro.id };

    const actual = await tx.dnxContacto.findUnique({ where: { id: contactoId }, select: { email: true, claveEmail: true } });
    if (!actual || actual.email !== null) return { resultado: "YA_TENIA" as const };
    // Condicionado a `email: null`: si otra corrida o una persona lo cargó recién, no se pisa.
    const { count } = await tx.dnxContacto.updateMany({
      where: { id: contactoId, email: null },
      data: { email: valor, ...(actual.claveEmail === null && clave ? { claveEmail: clave } : {}) },
    });
    if (count !== 1) return { resultado: "YA_TENIA" as const };
    await tx.dnxContactoDato.create({
      data: { contactoId, campo: "email", valor, fuente: dato.fuente, fuenteUrl: dato.fuenteUrl, vistoEn: ahora },
    });
    await tx.dnxContactoEvento.create({
      data: {
        contactoId, tipo: "DATO_NUEVO", autor: AUTOR, creadoEn: ahora,
        datos: { campo: "email", valor, fuente: dato.fuente, fuenteUrl: dato.fuenteUrl },
      },
    });
    return { resultado: "COMPLETADO" as const };
  });
}

type DatosIntento = {
  resultado: ResultadoBusquedaCorreo;
  via: "SITIO_PROPIO" | "CLAUDE";
  costoClaudeUsdMicros: number;
  email?: string;
  fuente?: string;
  fuenteUrl?: string | null;
  otroContactoId?: string;
  falla?: FallaClaude;
};

async function anotarIntento(contactoId: string, datos: DatosIntento, ahora: Date): Promise<string> {
  const e = await prisma.dnxContactoEvento.create({
    data: { contactoId, tipo: EVENTO_BUSQUEDA_CORREO, autor: AUTOR, creadoEn: ahora, datos: datos as Prisma.InputJsonValue },
    select: { id: true },
  });
  return e.id;
}

async function cambiarIntento(id: string, datos: DatosIntento): Promise<void> {
  await prisma.dnxContactoEvento.update({ where: { id }, data: { datos: datos as Prisma.InputJsonValue } });
}

function microsLlamadaCortada(): number {
  return Math.round(costoUsd({ entrada: TOKENS_ENTRADA_CORTADA, salida: TOKENS_SALIDA_CORTADA, busquedas: MAX_BUSQUEDAS_CORREO }) * MICROS);
}

function sinUso(uso: UsoClaude): boolean {
  return !uso.entrada && !uso.salida && !uso.busquedas && !uso.cacheEscritura && !uso.cacheLectura;
}

function tipoValido(tipo: string): TipoContacto {
  return ((TIPOS_CONTACTO as readonly string[]).includes(tipo) ? tipo : "OTRO") as TipoContacto;
}

/** El correo de la web propia, sin Claude; null si no hay web o no trae uno válido. Nunca lanza. */
async function correoDeLaWeb(c: FilaSinCorreo, sitio: typeof leerSitioPropio): Promise<DatoConFuente | null> {
  const web = texto(c.web);
  if (!web) return null;
  try {
    const cand = await sitio(web, {
      ciudad: c.ciudad ?? "",
      provincia: c.provincia ?? "",
      region: (c.region ?? null) as Region,
      tipo: tipoValido(c.tipo),
      nicho: c.nichos[0] ?? null,
      googlePlaceId: c.googlePlaceId ?? "",
    });
    return cand?.datos.email ?? null;
  } catch {
    return null;
  }
}

/** Corre el paso. Quien llama ya verificó que hay clave de Claude y que el mes no llegó al tope. */
export async function completarCorreos(deps: DepsCorreos): Promise<ResultadoCorreos> {
  const out: ResultadoCorreos = { intentados: 0, completados: 0, frenadoPor: null };
  const sitio = deps.sitio ?? leerSitioPropio;
  const buscar = deps.buscar ?? buscarCorreo;
  const completados: string[] = [];
  try {
    if (deps.hasta - deps.reloj() < MARGEN_CORREO_MS) {
      out.frenadoPor = "TIEMPO";
      return out;
    }
    const lista = await contactosSinCorreo(MAX_CORREOS_POR_CORRIDA);
    if (lista.length === 0) return out;

    // Tope de Claude dentro del paso: cuenta local para no releer el mes por contacto.
    const ajustes = await leerAjustes();
    const inicial = Math.round((await gastoDelMes(deps.ahora())).claudeUsd * MICROS);
    const limite = Math.round((ajustes.topeClaudeUsd - MARGEN_FRENO_USD) * MICROS);
    let gastado = 0;

    for (const c of lista) {
      if (deps.hasta - deps.reloj() < MARGEN_CORREO_MS) {
        out.frenadoPor = "TIEMPO";
        break;
      }
      let intentoId: string | null = null;
      try {
        // 1) La web propia, gratis.
        const deLaWeb = await correoDeLaWeb(c, sitio);
        if (deLaWeb) {
          const g = await guardarCorreo(c.id, deLaWeb, deps.ahora());
          await anotarIntento(c.id, {
            resultado: g.resultado, via: "SITIO_PROPIO", costoClaudeUsdMicros: 0, email: deLaWeb.valor,
            fuente: deLaWeb.fuente, fuenteUrl: deLaWeb.fuenteUrl, ...(g.otroContactoId ? { otroContactoId: g.otroContactoId } : {}),
          }, deps.ahora());
          out.intentados++;
          if (g.resultado === "COMPLETADO") {
            out.completados++;
            completados.push(c.id);
          }
          continue;
        }

        // 2) Claude, sólo si queda gasto.
        if (inicial + gastado >= limite) {
          out.frenadoPor = "TOPE_CLAUDE";
          break;
        }
        const estimado = microsLlamadaCortada();
        // Se anota antes de llamar, con el costo estimado: si la corrida muere en el medio, el gasto queda.
        intentoId = await anotarIntento(c.id, { resultado: "EN_CURSO", via: "CLAUDE", costoClaudeUsdMicros: estimado }, deps.ahora());
        const r = await buscar(
          { ...c, web: texto(c.web), instagram: texto(c.instagram), facebook: texto(c.facebook) },
          { hasta: deps.hasta, ahora: deps.reloj },
        );
        const real = Math.round(costoUsd(r.uso) * MICROS);

        if (r.falla === "SERVICIO" || r.falla === "CORTADA" || r.falla === "SIN_TIEMPO" || (sinUso(r.uso) && !r.email)) {
          // No es culpa del contacto: el intento no cuenta. Una llamada cortada se cobra estimada.
          const costo = r.falla === "CORTADA" ? Math.max(real, estimado) : real;
          gastado += costo;
          await cambiarIntento(intentoId, { resultado: "REINTENTAR", via: "CLAUDE", costoClaudeUsdMicros: costo, ...(r.falla ? { falla: r.falla } : {}) });
          out.frenadoPor = r.falla === "SERVICIO" ? "CLAUDE_NO_DISPONIBLE" : "TIEMPO";
          break;
        }
        gastado += real;
        out.intentados++;
        if (!r.email) {
          await cambiarIntento(intentoId, { resultado: "SIN_CORREO", via: "CLAUDE", costoClaudeUsdMicros: real, ...(r.falla ? { falla: r.falla } : {}) });
          continue;
        }
        const g = await guardarCorreo(c.id, r.email, deps.ahora());
        await cambiarIntento(intentoId, {
          resultado: g.resultado, via: "CLAUDE", costoClaudeUsdMicros: real, email: r.email.valor, fuente: r.email.fuente,
          fuenteUrl: r.email.fuenteUrl, ...(g.otroContactoId ? { otroContactoId: g.otroContactoId } : {}),
        });
        if (g.resultado === "COMPLETADO") {
          out.completados++;
          completados.push(c.id);
        }
      } catch (e) {
        // Un error de este contacto no corta el paso: queda como intento con ERROR y se sigue.
        console.error("[buscador] completar correo falló", c.id, e instanceof Error ? e.name : "");
        try {
          if (intentoId) {
            const fila = await prisma.dnxContactoEvento.findUnique({ where: { id: intentoId }, select: { datos: true } });
            const previo = (fila?.datos ?? {}) as Partial<DatosIntento>;
            await cambiarIntento(intentoId, { resultado: "ERROR", via: "CLAUDE", costoClaudeUsdMicros: previo.costoClaudeUsdMicros ?? 0 });
          } else {
            await anotarIntento(c.id, { resultado: "ERROR", via: "SITIO_PROPIO", costoClaudeUsdMicros: 0 }, deps.ahora());
          }
        } catch {
          console.error("[buscador] no se pudo anotar el intento fallido de correo", c.id);
        }
        out.intentados++;
      }
    }
  } catch (e) {
    console.error("[buscador] el paso de completar correos falló", e instanceof Error ? e.name : "");
  }

  for (const id of completados) {
    try {
      await vincularDnxEstudio(id);
    } catch {
      console.error("[buscador] no se pudo vincular con DNX Estudio", id);
    }
  }
  if (completados.length > 0 && deps.vincular) {
    try {
      await deps.vincular(completados);
    } catch {
      console.error("[buscador] no se pudo vincular con CLF");
    }
  }
  return out;
}

/** Correos completados e intentos hechos (sin contar los `REINTENTAR`) desde una fecha (o desde siempre). */
export async function conteoCorreos(desde: Date | null): Promise<{ intentados: number; completados: number }> {
  const eventos = await prisma.dnxContactoEvento.findMany({
    where: { tipo: EVENTO_BUSQUEDA_CORREO, ...(desde ? { creadoEn: { gte: desde } } : {}) },
    select: { datos: true },
  });
  let intentados = 0;
  let completados = 0;
  for (const e of eventos) {
    const r = resultadoDe(e.datos);
    if (r === "REINTENTAR") continue;
    intentados++;
    if (r === "COMPLETADO") completados++;
  }
  return { intentados, completados };
}
