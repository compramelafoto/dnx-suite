import "server-only";
import { z } from "zod";
import { conversar, type DepsClaude, type FallaClaude, type ResultadoParseo } from "../claude";
import type { UsoClaude } from "../periodista/costo";
import { extraerJson } from "../periodista/salida";
import { CAMPOS_DATO, type Candidato, type CampoDato, type DatoConFuente } from "./contactos";
import { claveDominio, claveInstagram, claveTelefono } from "./normalizar";
import type { LugarPlaces } from "./places";
import { pedidoDescubrir, pedidoLeerLugar, SISTEMA_DESCUBRIR, SISTEMA_LEER_LUGAR } from "./prompts";
import { REGIONES, TIPOS_CONTACTO, type Region, type TipoContacto } from "./tipos";

/**
 * Búsqueda web del Buscador con Claude: encuentra prospectos en una provincia
 * (`descubrirEnProvincia`) o lee las páginas propias de un lugar que vino de Google Places
 * (`leerLugar`). Claude busca y lee; este módulo valida CADA dato antes de que se pueda guardar
 * (`validarCandidato`): la dirección donde se vio (http/https), el dominio del correo, el teléfono.
 *
 * La fuente de cada dato la decide el código, no el modelo: si la página donde se vio es del
 * propio negocio (su dominio, su perfil) es `SITIO_PROPIO`; si es de terceros, `WEB_SEARCH`. Nada
 * visto en Google (Maps, fichas) se acepta: las condiciones de Google no permiten guardarlo.
 *
 * Nunca lanza: si Claude falla, vuelve sin candidatos pero con el uso (el costo se cuenta igual) y
 * con `falla`, para que el motor distinga una caída del servicio de un error de esta búsqueda.
 */

/** Topes de búsquedas web por llamada (el motor los usa para estimar el costo de una llamada cortada). */
export const MAX_BUSQUEDAS_PROVINCIA = 5;
export const MAX_BUSQUEDAS_LUGAR = 3;
/** Plazo por omisión de cada llamada (la función tiene 300 s). */
const PLAZO_MS = 240_000;
/** Tope de candidatos que se revisan por respuesta (el prompt pide hasta 10). */
const MAX_CANDIDATOS = 20;

/** Proveedores de correo gratuitos: se aceptan aunque el negocio tenga dominio propio. */
const CORREO_GRATIS = new Set(["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.ar", "live.com", "icloud.com"]);

export type DepsBuscadorWeb = DepsClaude & { hasta?: number };

// ---------------------------------------------------------------------------------------------
// Validación

const esquemaCandidato = z.object({
  tipo: z.enum(TIPOS_CONTACTO),
  nichos: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  nombre: z.string().trim().min(1).max(200),
  ciudad: z.string().trim().max(120).nullish(),
  provincia: z.string().trim().max(120).nullish(),
  region: z.enum(REGIONES).nullish(),
  googlePlaceId: z.string().trim().max(300).nullish(),
  creadoPor: z.enum(["BUSCADOR", "MUESTRAS", "RADAR", "CARGA_INICIAL", "MANUAL"]).default("BUSCADOR"),
  datos: z.record(z.string(), z.unknown()).nullish(),
});

const esquemaDato = z.object({
  valor: z.string().trim().min(1).max(500),
  fuenteUrl: z.string().trim().min(1).max(2000),
});

/** URL http(s) parseada; null para cualquier otro esquema (javascript:, data:, ftp:…) o si no parsea. */
function urlHttp(texto: string): URL | null {
  try {
    const u = new URL(texto);
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

function hostSinWww(u: URL): string {
  return u.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

/** Páginas de Google (Maps, fichas, enlaces cortos): nunca son fuente de un dato guardado. */
function esDeGoogle(u: URL): boolean {
  return /(^|\.)(google\.[a-z.]+|goo\.gl|g\.page|googleusercontent\.com)$/.test(hostSinWww(u));
}

/** Si el texto trae un esquema, tiene que ser http(s). Un dominio suelto (`estudio.com.ar`) sirve. */
function esquemaAceptable(texto: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(texto) || urlHttp(texto) !== null;
}

function deDominio(host: string, dominio: string): boolean {
  return host === dominio || host.endsWith(`.${dominio}`);
}

/** La página de Facebook (primer segmento de la ruta), en minúsculas. */
function paginaFacebook(texto: string): string | null {
  const m = /(?:^|[/.])(?:facebook\.com|fb\.com)\/([^/?#\s]+)/i.exec(texto);
  const p = m?.[1]?.toLowerCase();
  return p && !["pages", "profile.php", "groups", "sharer", "share"].includes(p) ? p : null;
}

const EMAIL = /^[^\s@<>()",;:]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

/** El valor limpio del dato, o null si no sirve. `dominioWeb` es el de la web ya aceptada. */
function valorValido(campo: CampoDato, valor: string, dominioWeb: string | null): string | null {
  switch (campo) {
    case "web":
      return esquemaAceptable(valor) && claveDominio(valor) ? valor : null;
    case "instagram":
      return esquemaAceptable(valor) && claveInstagram(valor) ? valor : null;
    case "facebook":
      return esquemaAceptable(valor) && paginaFacebook(valor) ? valor : null;
    case "email": {
      const e = valor.toLowerCase().replace(/^mailto:/, "");
      if (!EMAIL.test(e)) return null;
      const dominio = e.split("@")[1]!;
      if (CORREO_GRATIS.has(dominio)) return e;
      return dominioWeb && deDominio(dominio, dominioWeb) ? e : null;
    }
    case "telefono":
      // Se guarda la forma normalizada (+54…), nunca el texto del modelo.
      return claveTelefono(valor);
    case "whatsapp": {
      // Un enlace wa.me / api.whatsapp.com trae el número en la ruta o en `phone=`. Se guarda un
      // enlace armado por el código con el número normalizado, nunca el texto del modelo.
      const m = /(?:wa\.me\/|phone=)(\+?\d{8,15})/i.exec(valor);
      const tel = claveTelefono(m ? m[1]! : valor);
      return tel ? `https://wa.me/${tel.replace(/^\+/, "")}` : null;
    }
  }
}

/** ¿La página donde se vio el dato es del propio negocio (su dominio o su perfil)? */
function esPaginaPropia(u: URL, propios: { dominio: string | null; instagram: string | null; facebook: string | null }): boolean {
  const host = hostSinWww(u);
  if (propios.dominio && deDominio(host, propios.dominio)) return true;
  if (propios.instagram && claveInstagram(u.href) === propios.instagram && /(^|\.)instagram\.com$/.test(host)) return true;
  if (propios.facebook && paginaFacebook(u.href) === propios.facebook) return true;
  return false;
}

/**
 * Revisa lo que vino del modelo (más el contexto que agrega el código) y arma un `Candidato` con
 * sólo los datos que pasan: cada uno con `fuenteUrl` http(s) que no sea de Google, correo del
 * dominio de su web o de un proveedor gratuito, teléfono legible. Sin ningún dato, se descarta.
 */
export function validarCandidato(bruto: unknown): { ok: true; candidato: Candidato } | { ok: false; motivo: string } {
  const r = esquemaCandidato.safeParse(bruto);
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, motivo: `formato inválido (${i ? `${i.path.join(".") || "(raíz)"}: ${i.message}` : "?"})` };
  }
  const c = r.data;
  const crudos = c.datos ?? {};

  // Primero cada dato con su dirección http(s) y su valor; la web va antes que el correo.
  const vistos: Partial<Record<CampoDato, { valor: string; url: URL }>> = {};
  for (const campo of CAMPOS_DATO) {
    const d = esquemaDato.safeParse(crudos[campo]);
    if (!d.success) continue;
    const url = urlHttp(d.data.fuenteUrl);
    if (!url || esDeGoogle(url)) continue;
    const dominioWeb = vistos.web ? claveDominio(vistos.web.valor) : null;
    const valor = valorValido(campo, d.data.valor, dominioWeb);
    if (valor) vistos[campo] = { valor, url };
  }

  const propios = {
    dominio: vistos.web ? claveDominio(vistos.web.valor) : null,
    instagram: vistos.instagram ? claveInstagram(vistos.instagram.valor) : null,
    facebook: vistos.facebook ? paginaFacebook(vistos.facebook.valor) : null,
  };
  const datos: Partial<Record<CampoDato, DatoConFuente>> = {};
  for (const campo of CAMPOS_DATO) {
    const v = vistos[campo];
    if (!v) continue;
    datos[campo] = { valor: v.valor, fuente: esPaginaPropia(v.url, propios) ? "SITIO_PROPIO" : "WEB_SEARCH", fuenteUrl: v.url.href };
  }
  if (Object.keys(datos).length === 0) return { ok: false, motivo: "sin ningún dato de contacto ni web/red con su fuente" };

  return {
    ok: true,
    candidato: {
      tipo: c.tipo,
      nichos: c.nichos,
      nombre: c.nombre,
      ciudad: c.ciudad || null,
      provincia: c.provincia || null,
      region: c.region ?? null,
      googlePlaceId: c.googlePlaceId || null,
      datos,
      creadoPor: c.creadoPor,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Llamadas a Claude

const objeto = z.record(z.string(), z.unknown());

function parsearDescubrir(texto: string): ResultadoParseo<unknown[]> {
  const json = extraerJson(texto);
  const r = z.object({ candidatos: z.array(z.unknown()) }).safeParse(json);
  if (!r.success) return { ok: false, error: 'falta el objeto { "candidatos": [...] }' };
  return { ok: true, valor: r.data.candidatos };
}

function parsearLugar(texto: string): ResultadoParseo<Record<string, unknown> | null> {
  const json = extraerJson(texto);
  const r = z.object({ candidato: objeto.nullable() }).safeParse(json);
  if (!r.success) return { ok: false, error: 'falta el objeto { "candidato": {...} o null }' };
  return { ok: true, valor: r.data.candidato };
}

function plazo(deps: DepsBuscadorWeb): number {
  return deps.hasta ?? (deps.ahora ?? Date.now)() + PLAZO_MS;
}

function textoONull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Búsqueda web amplia por provincia. Los candidatos que no pasan la validación se cuentan. */
export async function descubrirEnProvincia(
  t: { provincia: string; region: Region; tipo: TipoContacto; nicho: string | null },
  deps: DepsBuscadorWeb = {},
): Promise<{ candidatos: Candidato[]; uso: UsoClaude; descartados: number; falla?: FallaClaude }> {
  const res = await conversar({
    sistema: SISTEMA_DESCUBRIR,
    pedido: pedidoDescubrir(t),
    conBusqueda: true,
    maxBusquedas: MAX_BUSQUEDAS_PROVINCIA,
    parsear: parsearDescubrir,
    hasta: plazo(deps),
    deps,
  });
  if (!res.ok) return { candidatos: [], uso: res.uso, descartados: 0, falla: res.falla };

  const candidatos: Candidato[] = [];
  let descartados = 0;
  for (const item of res.valor.slice(0, MAX_CANDIDATOS)) {
    const o = objeto.safeParse(item);
    const v = o.success
      ? validarCandidato({
          tipo: t.tipo,
          nichos: t.nicho ? [t.nicho] : [],
          nombre: o.data.nombre,
          ciudad: textoONull(o.data.ciudad),
          provincia: t.provincia,
          region: t.region,
          creadoPor: "BUSCADOR",
          datos: o.data.datos,
        })
      : null;
    if (v?.ok) candidatos.push(v.candidato);
    else descartados++;
  }
  return { candidatos, uso: res.uso, descartados };
}

/**
 * Lee las páginas propias de un lugar de Google Places (su web o, si no tiene, lo que encuentre por
 * nombre + ciudad). Del lugar sólo se conserva `placeId`: ningún dato sale de Google (tampoco el
 * nombre: si el modelo no lo da, no hay candidato).
 */
export async function leerLugar(
  lugar: LugarPlaces,
  t: { ciudad: string; provincia: string; region: Region; tipo: TipoContacto; nicho: string | null },
  deps: DepsBuscadorWeb = {},
): Promise<{ candidato: Candidato | null; uso: UsoClaude; falla?: FallaClaude }> {
  const res = await conversar({
    sistema: SISTEMA_LEER_LUGAR,
    pedido: pedidoLeerLugar(lugar, t),
    conBusqueda: true,
    maxBusquedas: MAX_BUSQUEDAS_LUGAR,
    parsear: parsearLugar,
    hasta: plazo(deps),
    deps,
  });
  if (!res.ok) return { candidato: null, uso: res.uso, falla: res.falla };
  if (!res.valor) return { candidato: null, uso: res.uso };
  // El nombre tiene que venir del modelo (de las páginas propias): el de Places no se puede guardar.
  const nombre = textoONull(res.valor.nombre);
  if (!nombre) return { candidato: null, uso: res.uso };

  const v = validarCandidato({
    tipo: t.tipo,
    nichos: t.nicho ? [t.nicho] : [],
    nombre,
    ciudad: t.ciudad,
    provincia: t.provincia,
    region: t.region,
    googlePlaceId: lugar.placeId,
    creadoPor: "BUSCADOR",
    datos: res.valor.datos,
  });
  return { candidato: v.ok ? v.candidato : null, uso: res.uso };
}
