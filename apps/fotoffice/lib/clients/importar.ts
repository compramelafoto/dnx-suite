import "server-only";
import Papa from "papaparse";
import { prisma, Prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { conBloqueoDeImportacion } from "@/lib/importacion/bloqueo";
import type { Actor } from "@/lib/ficha/eventos";
import { validarPerfil, type CtxContacto } from "@/lib/contactos/perfil";
import { CATEGORIAS_CONTACTO, ETIQUETA_CATEGORIA_CONTACTO, type CategoriaContacto } from "@/lib/consultas/constantes";
import { parseClientForm, type ClientFormValues } from "./client-form";
import { nextClientNumber } from "./client-number";
import { CLIENTS_MODULE_KEY, IVA_CONDITIONS, IVA_CONDITION_LABELS } from "./constants";
import { clientDisplayName } from "./display";
import { matchExistingClient, soloDigitos, type ClientCandidate } from "./match";

/**
 * Importación de clientes desde un CSV (Clientes → Importar), con los datos ampliados de la
 * etapa 1: categoría de contacto, celular, segundo correo, cumpleaños, web, provincia, país,
 * código postal y "Sobre" (spec §3.6).
 *
 * Dos pasos, como la importación de socios: `previsualizar` analiza y NO escribe; `importar`
 * vuelve a analizar el MISMO texto (nunca confía en lo que aprobó el navegador) y crea, en la
 * misma transacción, cada cliente, su historial y su perfil. Las filas con errores o que ya
 * existen (por documento, correo o teléfono, como `matchExistingClient`) se informan y no se
 * cargan; el resto sí.
 */

export const MAX_FILAS_IMPORTACION_CLIENTES = 2000;
/** Tope del archivo (también se mira en el navegador antes de leerlo). */
export const MAX_BYTES_IMPORTACION_CLIENTES = 2 * 1024 * 1024;
/** Filas por transacción al confirmar: cada lote lee el último número y numera seguido. */
const FILAS_POR_LOTE = 100;

export const MENSAJES_IMPORTACION = {
  sinPermiso: "No tenés permiso para hacer esto.",
  vacio: "Pegá o subí el CSV antes de continuar.",
  sinEncabezado: "No encontramos el encabezado. La primera fila tiene que tener los nombres de las columnas.",
  sinNombre: "Falta una columna de nombre (nombre, apellido o razón social).",
  demasiadas: `Se pueden importar hasta ${MAX_FILAS_IMPORTACION_CLIENTES} filas por vez.`,
  grande: "El archivo pesa más de 2 MB. Partilo en varios archivos más chicos.",
  ilegible: "No pudimos leer el archivo. Revisá que sea un CSV.",
  numero: "No se pudo asignar un número. Probá de nuevo.",
} as const;

/** Encabezado de ejemplo para la pantalla. */
export const ENCABEZADO_EJEMPLO_CLIENTES =
  "tipo,nombre,apellido,razon social,tipo documento,documento,condicion iva,correo,telefono,domicilio,ciudad,categoria,celular,email2,cumpleaños,web,provincia,pais,codigo postal,sobre";

type CampoCsv =
  | "kind" | "firstName" | "lastName" | "businessName" | "docType" | "docNumber" | "ivaCondition" | "email" | "phone"
  | "address" | "city" | "category" | "mobile" | "email2" | "birthday" | "website" | "province" | "country" | "postalCode"
  | "about";

/** Encabezado normalizado (minúsculas, sin tildes, sin espacios ni signos) → campo. */
const ALIAS: Record<string, CampoCsv> = {
  tipo: "kind", tipodecliente: "kind", personaoempresa: "kind",
  nombre: "firstName", nombres: "firstName",
  apellido: "lastName", apellidos: "lastName",
  razonsocial: "businessName", empresa: "businessName",
  tipodocumento: "docType", tipodedocumento: "docType", tipodoc: "docType",
  documento: "docNumber", nrodocumento: "docNumber", numerodocumento: "docNumber", numerodedocumento: "docNumber", dni: "docNumber", cuit: "docNumber",
  condicioniva: "ivaCondition", condicionfrentealiva: "ivaCondition", iva: "ivaCondition",
  correo: "email", email: "email", mail: "email", correoelectronico: "email",
  telefono: "phone", tel: "phone",
  domicilio: "address", direccion: "address",
  ciudad: "city", localidad: "city",
  categoria: "category", categoriadecontacto: "category", categoriacontacto: "category",
  celular: "mobile", movil: "mobile",
  email2: "email2", correo2: "email2", segundocorreo: "email2", mail2: "email2",
  cumpleanos: "birthday", cumpleano: "birthday", fechadenacimiento: "birthday", nacimiento: "birthday",
  web: "website", sitioweb: "website", paginaweb: "website",
  provincia: "province",
  pais: "country",
  codigopostal: "postalCode", cp: "postalCode",
  sobre: "about",
};

const ETIQUETA_CAMPO_PERFIL: Record<string, string> = {
  category: "Categoría",
  mobile: "Celular",
  email2: "Segundo correo",
  birthday: "Cumpleaños",
  website: "Web",
  province: "Provincia",
  country: "País",
  postalCode: "Código postal",
  about: "Sobre",
};

export function normalizarEncabezado(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** "dd/mm/aaaa", "d/m/aaaa", "dd-mm-aaaa" o "aaaa-mm-dd" → "aaaa-mm-dd"; otra cosa queda igual (y falla la validación). */
export function fechaDeImportacion(v: string): string {
  const t = v.trim();
  const dma = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (dma) return `${dma[3]}-${dma[2]!.padStart(2, "0")}-${dma[1]!.padStart(2, "0")}`;
  return t;
}

function categoriaDeImportacion(v: string): CategoriaContacto | string {
  const n = normalizarEncabezado(v);
  for (const c of CATEGORIAS_CONTACTO) {
    if (n === normalizarEncabezado(c) || n === normalizarEncabezado(ETIQUETA_CATEGORIA_CONTACTO[c])) return c;
  }
  return v; // validarPerfil lo rechaza con su mensaje
}

function tipoDeImportacion(v: string): string {
  const n = normalizarEncabezado(v);
  if (n === "persona" || n === "p") return "PERSONA";
  if (n === "empresa" || n === "e") return "EMPRESA";
  return v.trim().toUpperCase();
}

function ivaDeImportacion(v: string): string {
  const n = normalizarEncabezado(v);
  for (const c of IVA_CONDITIONS) {
    if (n === normalizarEncabezado(c) || n === normalizarEncabezado(IVA_CONDITION_LABELS[c])) return c;
  }
  return v.trim().toUpperCase();
}

export type EstadoFila = "VALIDA" | "ERROR" | "DUPLICADA";

export type FilaImportacion = {
  /** 1 = la primera fila de datos (sin contar el encabezado). */
  fila: number;
  estado: EstadoFila;
  errores: string[];
  nombre: string;
  correo: string | null;
  categoria: CategoriaContacto | null;
};

type FilaInterna = FilaImportacion & {
  cliente?: ClientFormValues;
  /** Columnas del perfil a escribir; null si la fila no trae ningún dato ampliado. */
  perfil?: Record<string, string | null> | null;
};

export type ResultadoAnalisis =
  | { ok: false; error: string }
  | {
      ok: true;
      filas: FilaImportacion[];
      validas: number;
      conError: number;
      duplicadas: number;
      /** Válidas sin documento, correo ni teléfono: no hay con qué detectar si ya existen. */
      sinClave: number;
    };

/**
 * Analiza el CSV: columnas por encabezado (con alias en español), cada fila validada con las
 * mismas reglas del formulario del cliente (`parseClientForm`) y del perfil (`validarPerfil`).
 * Puro salvo `existentes`: los clientes del workspace que podrían coincidir.
 */
export function analizarCsvClientes(texto: string, existentes: readonly ClientCandidate[]): { ok: false; error: string } | { ok: true; filas: FilaInterna[] } {
  if (typeof texto !== "string" || !texto.trim()) return { ok: false, error: MENSAJES_IMPORTACION.vacio };
  if (new TextEncoder().encode(texto).length > MAX_BYTES_IMPORTACION_CLIENTES) return { ok: false, error: MENSAJES_IMPORTACION.grande };
  // Sin `transformHeader`: en papaparse 5.5 se aplica dos veces. Se traducen las claves después.
  const r = Papa.parse<Record<string, string>>(texto.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy" });
  if ((r.meta.fields ?? []).length === 0) return { ok: false, error: MENSAJES_IMPORTACION.sinEncabezado };
  const campoDe = new Map<string, CampoCsv>();
  for (const h of r.meta.fields ?? []) {
    const c = ALIAS[normalizarEncabezado(h)];
    // La primera columna que se reconoce para un campo gana (una repetida no la pisa).
    if (c && ![...campoDe.values()].includes(c)) campoDe.set(h, c);
  }
  const campos = new Set(campoDe.values());
  if (!campos.has("firstName") && !campos.has("lastName") && !campos.has("businessName")) {
    return { ok: false, error: MENSAJES_IMPORTACION.sinNombre };
  }
  if (r.data.length > MAX_FILAS_IMPORTACION_CLIENTES) return { ok: false, error: MENSAJES_IMPORTACION.demasiadas };

  const vistos: ClientCandidate[] = [];
  const filas: FilaInterna[] = r.data.map((original, i) => {
    const crudo: Partial<Record<CampoCsv, string>> = {};
    for (const [h, c] of campoDe) crudo[c] = original[h];
    const v = (c: CampoCsv) => (typeof crudo[c] === "string" ? crudo[c]!.trim() : "");
    const errores: string[] = [];

    // Cliente: mismas reglas que el formulario (se arma un FormData con los nombres del form).
    const fd = new FormData();
    const kind = v("kind") ? tipoDeImportacion(v("kind")) : v("businessName") && !v("firstName") && !v("lastName") ? "EMPRESA" : "PERSONA";
    fd.set("kind", kind);
    for (const c of ["firstName", "lastName", "businessName", "email", "phone", "address", "city"] as const) fd.set(c, v(c));
    const doc = soloDigitos(v("docNumber")) ? v("docNumber") : "";
    let docType = v("docType").toUpperCase();
    if (doc && !docType) docType = soloDigitos(doc).length === 11 ? "CUIT" : "DNI";
    fd.set("docType", docType);
    fd.set("docNumber", doc);
    if (v("ivaCondition")) fd.set("ivaCondition", ivaDeImportacion(v("ivaCondition")));
    const cliente = parseClientForm(fd);
    if (!cliente.ok) errores.push(cliente.error);

    // Perfil ampliado: sólo los campos que vienen con algo.
    const datosPerfil: Record<string, string> = {};
    for (const c of ["category", "mobile", "email2", "birthday", "website", "province", "country", "postalCode", "about"] as const) {
      const x = v(c);
      if (!x) continue;
      datosPerfil[c] = c === "birthday" ? fechaDeImportacion(x) : c === "category" ? categoriaDeImportacion(x) : x;
    }
    const perfil = validarPerfil(datosPerfil);
    if (!perfil.ok) {
      for (const [campo, msg] of Object.entries(perfil.errores)) errores.push(`${ETIQUETA_CAMPO_PERFIL[campo] ?? campo}: ${msg}`);
    }

    const nombre = cliente.ok
      ? clientDisplayName(cliente.values)
      : [v("firstName"), v("lastName")].filter(Boolean).join(" ") || v("businessName") || "Sin nombre";
    const base: FilaInterna = {
      fila: i + 1,
      estado: errores.length > 0 ? "ERROR" : "VALIDA",
      errores,
      nombre,
      correo: cliente.ok ? cliente.values.email : v("email") || null,
      categoria: perfil.ok ? ((perfil.valores.category as CategoriaContacto | undefined) ?? null) : null,
    };
    if (base.estado === "ERROR" || !cliente.ok || !perfil.ok) return base;

    // Duplicados: contra la base y contra las filas anteriores del mismo archivo.
    const buscado = { docNumber: cliente.values.docNumber, email: cliente.values.email, phone: cliente.values.phone };
    if (matchExistingClient(existentes, buscado)) {
      return { ...base, estado: "DUPLICADA", errores: ["Ya existe un cliente con ese documento, correo o teléfono."] };
    }
    if (matchExistingClient(vistos, buscado)) {
      return { ...base, estado: "DUPLICADA", errores: ["Repite el documento, correo o teléfono de una fila anterior."] };
    }
    vistos.push({ id: `fila-${i + 1}`, ...buscado });
    const tienePerfil = Object.keys(perfil.valores).length > 0;
    return { ...base, cliente: cliente.values, perfil: tienePerfil ? perfil.valores : null };
  });
  return { ok: true, filas };
}

/** Clientes del workspace que podrían coincidir con alguna fila (por documento, correo o teléfono). */
async function candidatosDe(workspaceId: string, texto: string): Promise<ClientCandidate[]> {
  // Primer análisis sin base para juntar las claves a buscar.
  const previo = analizarCsvClientes(texto, []);
  if (!previo.ok) return [];
  const docs = new Set<string>();
  const correos = new Set<string>();
  const telefonos = new Set<string>();
  for (const f of previo.filas) {
    if (!f.cliente) continue;
    if (f.cliente.docNumber) docs.add(f.cliente.docNumber);
    if (f.cliente.email) correos.add(f.cliente.email);
    if (f.cliente.phone) telefonos.add(f.cliente.phone);
  }
  const or: Prisma.ClientWhereInput[] = [];
  if (docs.size > 0) or.push({ docNumber: { in: [...docs] } });
  if (correos.size > 0) or.push({ email: { in: [...correos], mode: "insensitive" } });
  if (telefonos.size > 0) or.push({ phone: { in: [...telefonos] } });
  if (or.length === 0) return [];
  return prisma.client.findMany({ where: { workspaceId, OR: or }, select: { id: true, docNumber: true, email: true, phone: true } });
}

function resumen(filas: FilaInterna[]): Extract<ResultadoAnalisis, { ok: true }> {
  return {
    ok: true,
    filas: filas.map(({ cliente: _c, perfil: _p, ...f }) => f),
    validas: filas.filter((f) => f.estado === "VALIDA").length,
    conError: filas.filter((f) => f.estado === "ERROR").length,
    duplicadas: filas.filter((f) => f.estado === "DUPLICADA").length,
    sinClave: filas.filter((f) => f.estado === "VALIDA" && f.cliente && !f.cliente.docNumber && !f.cliente.email && !f.cliente.phone).length,
  };
}

/** Vista previa: analiza contra los clientes del workspace y NO escribe nada. Pide Gestionar en Clientes. */
export async function previsualizarImportacionClientes(ctx: CtxContacto, texto: unknown): Promise<ResultadoAnalisis> {
  if (!puedeEnContexto(ctx, "operar", CLIENTS_MODULE_KEY)) return { ok: false, error: MENSAJES_IMPORTACION.sinPermiso };
  if (typeof texto !== "string") return { ok: false, error: MENSAJES_IMPORTACION.vacio };
  const analisis = analizarCsvClientes(texto, await candidatosDe(ctx.workspaceId, texto));
  return analisis.ok ? resumen(analisis.filas) : analisis;
}

export type ResultadoImportacion =
  | { ok: false; error: string }
  | {
      ok: true;
      creados: number;
      conError: number;
      duplicadas: number;
      fallidas: number;
      /** Números de fila (1 = primera de datos) que no se pudieron guardar, para reimportar sólo esas. */
      filasFallidas: number[];
      sinClave: number;
    };

/**
 * Confirma: vuelve a analizar el texto y crea las filas válidas. Cada lote de hasta 100 filas va
 * en una transacción: lee el último número del workspace y crea, por fila, el cliente, su
 * `ClientAudit CREATED` y su perfil ampliado (si trae alguno). Si choca con un alta simultánea
 * (P2002 en el número), reintenta el lote. Un lote que falla no deshace los anteriores.
 */
export async function importarClientes(ctx: CtxContacto, texto: unknown): Promise<ResultadoImportacion> {
  if (!puedeEnContexto(ctx, "operar", CLIENTS_MODULE_KEY)) return { ok: false, error: MENSAJES_IMPORTACION.sinPermiso };
  if (typeof texto !== "string") return { ok: false, error: MENSAJES_IMPORTACION.vacio };
  // Una importación (de clientes o de consultas) a la vez por organización: el control de
  // duplicados va adentro del candado.
  const r = await conBloqueoDeImportacion(ctx, "clientes", () => importarConCandado(ctx, texto));
  return r.ok ? r.valor : r;
}

async function importarConCandado(ctx: CtxContacto, texto: string): Promise<ResultadoImportacion> {
  const analisis = analizarCsvClientes(texto, await candidatosDe(ctx.workspaceId, texto));
  if (!analisis.ok) return analisis;
  const { workspaceId } = ctx;
  const actor: Actor = { userId: ctx.userId, label: ctx.userLabel };
  const aCrear = analisis.filas.filter((f) => f.estado === "VALIDA" && f.cliente);

  let creados = 0;
  const filasFallidas: number[] = [];
  for (let i = 0; i < aCrear.length; i += FILAS_POR_LOTE) {
    const lote = aCrear.slice(i, i + FILAS_POR_LOTE);
    let hecho = false;
    for (let intento = 0; intento < 3 && !hecho; intento++) {
      try {
        await prisma.$transaction(
          async (tx) => {
            const ultimo = await tx.client.findFirst({
              where: { workspaceId },
              orderBy: { clientNumber: "desc" },
              select: { clientNumber: true },
            });
            let numero = nextClientNumber(ultimo?.clientNumber ?? null);
            for (const f of lote) {
              const creado = await tx.client.create({
                data: { ...f.cliente!, workspaceId, clientNumber: numero, createdByUserId: actor.userId },
                select: { id: true },
              });
              numero += 1;
              await tx.clientAudit.create({
                data: { workspaceId, clientId: creado.id, action: "CREATED", actorUserId: actor.userId, actorLabel: actor.label },
              });
              if (f.perfil) {
                const data: Record<string, unknown> = {};
                for (const [k, x] of Object.entries(f.perfil)) {
                  data[k] = k === "birthday" && x ? new Date(`${x}T00:00:00.000Z`) : x;
                }
                await tx.fotofficeContactoPerfil.create({
                  data: { ...data, workspaceId, clientId: creado.id } as Prisma.FotofficeContactoPerfilUncheckedCreateInput,
                  select: { id: true },
                });
              }
            }
          },
          { timeout: 60_000, maxWait: 10_000 },
        );
        hecho = true;
        creados += lote.length;
      } catch (e) {
        const choque = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
        if (!choque) {
          const err = e as { name?: string; code?: string } | null;
          console.error("[clientes] importación: falló un lote", { error: err?.name ?? "desconocido", codigo: err?.code ?? null });
          break;
        }
      }
    }
    if (!hecho) filasFallidas.push(...lote.map((f) => f.fila));
  }
  const r = resumen(analisis.filas);
  return {
    ok: true, creados, conError: r.conError, duplicadas: r.duplicadas, fallidas: filasFallidas.length, filasFallidas, sinClave: r.sinClave,
  };
}
