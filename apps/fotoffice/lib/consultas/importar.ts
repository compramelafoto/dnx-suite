import "server-only";
import Papa from "papaparse";
import { prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { mover } from "@/lib/circuitos/recorridos";
import { fechaDeImportacion, normalizarEncabezado } from "@/lib/clients/importar";
import { registrarActividad } from "@/lib/listado/actividad";
import { parseAmountToMinor } from "@/lib/membership/history-import/amount";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { puedeSerResponsable, type DepsAjustes } from "./ajustes";
import { altaDeConsulta, MAX_INVITADOS, MAX_MENSAJE_CONSULTA, MAX_TEXTO_CONSULTA, MAX_VALOR_ESTIMADO, type DatosAlta } from "./alta";
import type { CtxConsultas } from "./catalogo";
import { categoriaParaEventType } from "./categorias";
import { MAX_FILAS_IMPORTACION } from "./constantes";
import { MAX_NOMBRE_CONTACTO } from "./contacto";
import { asegurarCatalogosDelWorkspace } from "./semillas";

/**
 * Importación de consultas desde un CSV (Consultas → Importar, spec §3.6).
 *
 * Dos pasos, como la de clientes: `previsualizarImportacionConsultas` analiza y NO carga
 * consultas; `importarConsultas` vuelve a analizar el MISMO texto (nunca confía en lo que aprobó
 * el navegador) y da de alta cada fila válida con `altaDeConsulta(…, IMPORTACION)`: el mismo
 * camino que el alta manual (contacto buscado por correo o teléfono, o creado; número; circuito),
 * SIN aviso al equipo, sin tarea y sin respuesta automática.
 *
 * Las filas con errores se informan y no se cargan; el resto sí. No se duplica: una fila con el
 * mismo correo + categoría + fecha del evento que una consulta existente (o que una fila anterior
 * del archivo) queda como "Ya existe". La etapa, si viene, mueve la consulta con el motor de
 * circuitos después del alta. La importación queda en la bitácora de la lista de Consultas.
 *
 * Nunca loguea datos personales.
 */

export const MAX_BYTES_IMPORTACION_CONSULTAS = 2 * 1024 * 1024;
/** Altas en paralelo al confirmar: cada una es su propia transacción (2.000 de a una no entran en 300 s). */
const ALTAS_EN_PARALELO = 5;

export type DepsImportacion = DepsAjustes & {
  /** Altas a la vez. Las pruebas usan 1: la base en memoria no admite transacciones simultáneas. */
  enParalelo?: number;
};
const NOTA_ETAPA = "Importada desde un CSV";

export const MENSAJES_IMPORTACION_CONSULTAS = {
  sinPermiso: "No tenés permiso para importar consultas.",
  vacio: "Pegá o subí el CSV antes de continuar.",
  grande: "El archivo pesa más de 2 MB. Partilo en varios.",
  sinEncabezado: "No encontramos el encabezado. La primera fila tiene que tener los nombres de las columnas.",
  sinNombre: "Falta la columna del nombre del contacto.",
  demasiadas: `Se pueden importar hasta ${MAX_FILAS_IMPORTACION.toLocaleString("es-AR")} filas por vez.`,
} as const;

/** Encabezado de ejemplo para la pantalla. */
export const ENCABEZADO_EJEMPLO_CONSULTAS =
  "nombre,correo,telefono,categoria,fecha del evento,lugar,invitados,origen,valor,responsable,etapa,nota";

type CampoCsv =
  | "nombre" | "correo" | "telefono" | "categoria" | "fecha" | "lugar" | "invitados" | "origen" | "valor" | "responsable" | "etapa"
  | "nota";

/** Encabezado normalizado (minúsculas, sin tildes, sin espacios ni signos) → campo. */
const ALIAS: Record<string, CampoCsv> = {
  nombre: "nombre", nombrecompleto: "nombre", contacto: "nombre", cliente: "nombre", nombredelcontacto: "nombre", nombreyapellido: "nombre",
  correo: "correo", email: "correo", mail: "correo", correoelectronico: "correo", emaildelcontacto: "correo",
  telefono: "telefono", tel: "telefono", celular: "telefono", whatsapp: "telefono",
  categoria: "categoria", tipo: "categoria", tipodeevento: "categoria", tipodetrabajo: "categoria", servicio: "categoria",
  fechadelevento: "fecha", fecha: "fecha", fechaevento: "fecha", fechadeevento: "fecha", dia: "fecha", diadelevento: "fecha",
  lugar: "lugar", lugardelevento: "lugar", salon: "lugar", ubicacion: "lugar",
  invitados: "invitados", cantidaddeinvitados: "invitados", cantidadinvitados: "invitados",
  origen: "origen", comonosconociste: "origen", fuente: "origen", canal: "origen",
  valor: "valor", valorestimado: "valor", presupuesto: "valor", monto: "valor", importe: "valor",
  responsable: "responsable", correodelresponsable: "responsable", responsablecorreo: "responsable", emaildelresponsable: "responsable",
  etapa: "etapa", estado: "etapa",
  nota: "nota", notas: "nota", mensaje: "nota", comentario: "nota", comentarios: "nota", observaciones: "nota",
};

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EstadoFilaConsulta = "VALIDA" | "ERROR" | "DUPLICADA";

export type FilaImportacionConsulta = {
  /** 1 = la primera fila de datos (sin contar el encabezado). */
  fila: number;
  estado: EstadoFilaConsulta;
  errores: string[];
  nombre: string;
  correo: string | null;
  /** Nombre de la categoría que recibe (la indicada o la de reemplazo). */
  categoria: string | null;
  /** aaaa-mm-dd. */
  fecha: string | null;
  etapa: string | null;
};

type Ref = { id: string; name: string };

/** Lo que el análisis necesita de la base, resuelto de una vez. */
export type CatalogosImportacion = {
  /** Activas, por nombre normalizado. */
  categorias: Map<string, Ref>;
  /** La que recibe una fila sin categoría ("Otro" o la primera activa); null si no hay ninguna. */
  categoriaPorDefecto: Ref | null;
  origenes: Map<string, Ref>;
  /** Etapas activas del circuito de ventas predeterminado; null si todavía no hay circuito. */
  etapas: Map<string, Ref> | null;
  /** Correo (minúsculas) → usuario que puede ser responsable. */
  responsables: Map<string, number>;
  /** Claves correo|categoría|fecha de las consultas que ya existen. */
  existentes: Set<string>;
};

type Crudo = Partial<Record<CampoCsv, string>>;

type FilaInterna = FilaImportacionConsulta & { datos?: DatosAlta; etapaId?: string | null };

const no = (error: string) => ({ ok: false as const, error });

/** Para comparar nombres de catálogos: sin tildes, mayúsculas, espacios ni signos. */
const clave = (v: string) => normalizarEncabezado(v);

export const claveDuplicado = (correo: string, categoriaId: string, fecha: string | null) =>
  `${correo.trim().toLowerCase()}|${categoriaId}|${fecha ?? ""}`;

/** Lee el CSV: tamaño, encabezado con alias y tope de filas. No valida las filas. */
export function leerCsvConsultas(texto: unknown): { ok: false; error: string } | { ok: true; filas: Crudo[] } {
  if (typeof texto !== "string" || !texto.trim()) return no(MENSAJES_IMPORTACION_CONSULTAS.vacio);
  if (new TextEncoder().encode(texto).length > MAX_BYTES_IMPORTACION_CONSULTAS) return no(MENSAJES_IMPORTACION_CONSULTAS.grande);
  // Sin `transformHeader`: en papaparse 5.5 se aplica dos veces. Se traducen las claves después.
  const r = Papa.parse<Record<string, string>>(texto.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy" });
  if ((r.meta.fields ?? []).length === 0) return no(MENSAJES_IMPORTACION_CONSULTAS.sinEncabezado);
  const campoDe = new Map<string, CampoCsv>();
  for (const h of r.meta.fields ?? []) {
    const c = ALIAS[normalizarEncabezado(h)];
    // La primera columna que se reconoce para un campo gana (una repetida no la pisa).
    if (c && ![...campoDe.values()].includes(c)) campoDe.set(h, c);
  }
  if (![...campoDe.values()].includes("nombre")) return no(MENSAJES_IMPORTACION_CONSULTAS.sinNombre);
  if (r.data.length > MAX_FILAS_IMPORTACION) return no(MENSAJES_IMPORTACION_CONSULTAS.demasiadas);
  return {
    ok: true,
    filas: r.data.map((original) => {
      const crudo: Crudo = {};
      for (const [h, c] of campoDe) {
        const v = original[h];
        if (typeof v === "string") crudo[c] = v.trim();
      }
      return crudo;
    }),
  };
}

/** "dd/mm/aaaa" o "aaaa-mm-dd" → "aaaa-mm-dd" si es un día real (1900–2100); null si no. */
export function fechaDelEvento(v: string): string | null {
  const t = fechaDeImportacion(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) return null;
  const anio = d.getUTCFullYear();
  return anio >= 1900 && anio <= 2100 ? t : null;
}

/**
 * Valida cada fila contra los catálogos del workspace y marca los duplicados (contra la base y
 * contra las filas anteriores del archivo). Puro: todo lo de la base viene en `cat`.
 */
export function analizarFilasConsultas(filas: readonly Crudo[], cat: CatalogosImportacion): FilaInterna[] {
  const vistos = new Set<string>();
  return filas.map((c, i) => {
    const v = (k: CampoCsv) => c[k] ?? "";
    const errores: string[] = [];

    const nombre = v("nombre").replace(/\s+/g, " ");
    if (!nombre) errores.push("Falta el nombre.");
    else if (nombre.length > MAX_NOMBRE_CONTACTO) errores.push(`El nombre puede tener hasta ${MAX_NOMBRE_CONTACTO} caracteres.`);

    const correo = v("correo").toLowerCase() || null;
    if (correo && (correo.length > 254 || !CORREO.test(correo))) errores.push("El correo no es válido.");
    const telefono = v("telefono") || null;
    if (telefono && (telefono.length > 40 || !/\d/.test(telefono))) errores.push("El teléfono no es válido.");

    let categoria: Ref | null = null;
    if (v("categoria")) {
      categoria = cat.categorias.get(clave(v("categoria"))) ?? null;
      if (!categoria) errores.push(`No hay una categoría activa llamada «${v("categoria").slice(0, 80)}».`);
    } else {
      categoria = cat.categoriaPorDefecto;
      if (!categoria) errores.push("No hay categorías activas para cargar la consulta.");
    }

    let fecha: string | null = null;
    if (v("fecha")) {
      fecha = fechaDelEvento(v("fecha"));
      if (!fecha) errores.push("La fecha del evento no es válida (dd/mm/aaaa o aaaa-mm-dd).");
    }

    const lugar = v("lugar") || null;
    if (lugar && lugar.length > MAX_TEXTO_CONSULTA) errores.push(`El lugar puede tener hasta ${MAX_TEXTO_CONSULTA} caracteres.`);

    let invitados: number | null = null;
    if (v("invitados")) {
      const n = /^\d+$/.test(v("invitados").replace(/\./g, "")) ? Number(v("invitados").replace(/\./g, "")) : NaN;
      if (!Number.isSafeInteger(n) || n > MAX_INVITADOS) errores.push("La cantidad de invitados no es válida.");
      else invitados = n;
    }

    let origen: Ref | null = null;
    if (v("origen")) {
      origen = cat.origenes.get(clave(v("origen"))) ?? null;
      if (!origen) errores.push(`No hay un origen activo llamado «${v("origen").slice(0, 80)}».`);
    }

    let valor: number | null = null;
    if (v("valor")) {
      const r = parseAmountToMinor(v("valor"));
      if (!r.ok) errores.push(`Valor: ${r.error}`);
      else if (r.minor / 100 > MAX_VALOR_ESTIMADO) errores.push("El valor estimado es demasiado grande.");
      else valor = r.minor / 100;
    }

    let responsableUserId: number | null = null;
    if (v("responsable")) {
      responsableUserId = cat.responsables.get(v("responsable").toLowerCase()) ?? null;
      if (responsableUserId === null) errores.push("El responsable tiene que ser alguien del equipo con permiso para gestionar Consultas (por su correo).");
    }

    let etapa: Ref | null = null;
    if (v("etapa")) {
      etapa = cat.etapas?.get(clave(v("etapa"))) ?? null;
      if (!etapa) errores.push(`No hay una etapa activa llamada «${v("etapa").slice(0, 80)}» en el circuito de ventas.`);
    }

    const nota = v("nota") || null;
    if (nota && nota.length > MAX_MENSAJE_CONSULTA) errores.push(`La nota puede tener hasta ${MAX_MENSAJE_CONSULTA} caracteres.`);

    const base: FilaInterna = {
      fila: i + 1,
      estado: errores.length > 0 ? "ERROR" : "VALIDA",
      errores,
      nombre: nombre.slice(0, MAX_NOMBRE_CONTACTO) || "Sin nombre",
      correo,
      categoria: categoria?.name ?? null,
      fecha,
      etapa: etapa?.name ?? null,
    };
    if (base.estado === "ERROR" || !categoria) return base;

    // Sin duplicar: correo + categoría + fecha del evento (sin correo no hay con qué comparar).
    if (correo) {
      const k = claveDuplicado(correo, categoria.id, fecha);
      if (cat.existentes.has(k)) {
        return { ...base, estado: "DUPLICADA", errores: ["Ya hay una consulta con ese correo, categoría y fecha del evento."] };
      }
      if (vistos.has(k)) {
        return { ...base, estado: "DUPLICADA", errores: ["Repite el correo, la categoría y la fecha de una fila anterior."] };
      }
      vistos.add(k);
    }

    const datos: DatosAlta = {
      contacto: { nombre, email: correo, telefono },
      categoriaId: categoria.id,
      eventDate: fecha ? new Date(`${fecha}T00:00:00.000Z`) : null,
      eventLocation: lugar,
      message: nota,
      evento: { guests: invitados },
      origenId: origen?.id ?? null,
      valorEstimado: valor,
      responsableUserId,
    };
    return { ...base, datos, etapaId: etapa?.id ?? null };
  });
}

/** Circuito de ventas en el que entran las consultas nuevas: el predeterminado, o el primero activo. */
async function circuitoDeVentas(workspaceId: string): Promise<{ id: string } | null> {
  const pred = await prisma.fotofficeCircuit.findFirst({
    where: { workspaceId, kind: "VENTA", isActive: true, isDefault: true },
    select: { id: true },
  });
  if (pred) return pred;
  return prisma.fotofficeCircuit.findFirst({
    where: { workspaceId, kind: "VENTA", isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
}

function porNombre(filas: Ref[]): Map<string, Ref> {
  const m = new Map<string, Ref>();
  // Si dos se normalizan igual, gana la primera (en su orden).
  for (const f of filas) if (!m.has(clave(f.name))) m.set(clave(f.name), f);
  return m;
}

const trozos = <T,>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_x, i) => xs.slice(i * n, (i + 1) * n));

/** Todo lo que el análisis necesita de la base, sólo del workspace de la sesión. */
async function cargarCatalogos(workspaceId: string, filas: readonly Crudo[], deps: DepsAjustes): Promise<CatalogosImportacion> {
  const orden = [{ order: "asc" as const }, { createdAt: "asc" as const }];
  const [categorias, origenes, defecto, circuito] = await Promise.all([
    prisma.fotofficeConsultaCategoria.findMany({ where: { workspaceId, archivedAt: null }, orderBy: orden, take: 1000, select: { id: true, name: true } }),
    prisma.fotofficeOrigen.findMany({ where: { workspaceId, archivedAt: null }, orderBy: orden, take: 1000, select: { id: true, name: true } }),
    categoriaParaEventType(prisma, workspaceId, null),
    circuitoDeVentas(workspaceId),
  ]);
  const etapas = circuito
    ? await prisma.fotofficeStage.findMany({
        where: { circuitId: circuito.id, circuit: { workspaceId }, archivedAt: null },
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      })
    : null;

  // Responsables: los correos que vienen, contra los usuarios del equipo con "Gestionar".
  const correosResp = [...new Set(filas.map((f) => (f.responsable ?? "").toLowerCase()).filter((x) => CORREO.test(x)))].slice(0, 200);
  const responsables = new Map<string, number>();
  if (correosResp.length > 0) {
    const usuarios = await prisma.user.findMany({
      where: { OR: correosResp.map((e) => ({ email: { equals: e, mode: "insensitive" as const } })) },
      select: { id: true, email: true },
      take: 400,
    });
    for (const u of usuarios) {
      const e = (u.email ?? "").toLowerCase();
      if (!responsables.has(e) && (await puedeSerResponsable(workspaceId, u.id, deps))) responsables.set(e, u.id);
    }
  }

  // Duplicados: consultas del workspace con alguno de los correos, por categoría y fecha.
  const correos = [...new Set(filas.map((f) => (f.correo ?? "").toLowerCase()).filter(Boolean))];
  const existentes = new Set<string>();
  for (const grupo of trozos(correos, 500)) {
    const leads = await prisma.serviceSalesLead.findMany({
      where: { workspaceId, OR: grupo.map((e) => ({ email: { equals: e, mode: "insensitive" as const } })) },
      select: { id: true, email: true, eventDate: true },
    });
    if (leads.length === 0) continue;
    const fichas = await prisma.fotofficeConsulta.findMany({
      where: { workspaceId, leadId: { in: leads.map((l) => l.id) } },
      select: { leadId: true, categoryId: true },
    });
    const categoriaDe = new Map(fichas.map((f) => [f.leadId, f.categoryId]));
    for (const l of leads) {
      const cat = categoriaDe.get(l.id);
      if (!cat || !l.email) continue;
      existentes.add(claveDuplicado(l.email, cat, l.eventDate ? l.eventDate.toISOString().slice(0, 10) : null));
    }
  }

  return {
    categorias: porNombre(categorias),
    categoriaPorDefecto: defecto ? { id: defecto.id, name: defecto.name } : null,
    origenes: porNombre(origenes),
    etapas: etapas ? porNombre(etapas) : null,
    responsables,
    existentes,
  };
}

export type ResultadoAnalisisConsultas =
  | { ok: false; error: string }
  | { ok: true; filas: FilaImportacionConsulta[]; validas: number; conError: number; duplicadas: number };

function puedeImportar(ctx: CtxConsultas): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "operar", SERVICE_LEADS_MODULE_KEY);
}

async function analizar(ctx: CtxConsultas, texto: unknown, deps: DepsAjustes): Promise<{ ok: false; error: string } | { ok: true; filas: FilaInterna[] }> {
  const leido = leerCsvConsultas(texto);
  if (!leido.ok) return leido;
  try {
    await asegurarCatalogosDelWorkspace(ctx.workspaceId);
  } catch (e) {
    const err = e as { name?: string; code?: string } | null;
    console.error("[consultas] importación: no se pudieron sembrar los catálogos", { error: err?.name ?? "desconocido", codigo: err?.code ?? null });
  }
  return { ok: true, filas: analizarFilasConsultas(leido.filas, await cargarCatalogos(ctx.workspaceId, leido.filas, deps)) };
}

function resumen(filas: FilaInterna[]): Extract<ResultadoAnalisisConsultas, { ok: true }> {
  return {
    ok: true,
    filas: filas.map(({ datos: _d, etapaId: _e, ...f }) => f),
    validas: filas.filter((f) => f.estado === "VALIDA").length,
    conError: filas.filter((f) => f.estado === "ERROR").length,
    duplicadas: filas.filter((f) => f.estado === "DUPLICADA").length,
  };
}

/** Vista previa: analiza contra el workspace y NO carga consultas. Pide Gestionar en Consultas. */
export async function previsualizarImportacionConsultas(
  ctx: CtxConsultas,
  texto: unknown,
  deps: DepsAjustes = {},
): Promise<ResultadoAnalisisConsultas> {
  if (!puedeImportar(ctx)) return no(MENSAJES_IMPORTACION_CONSULTAS.sinPermiso);
  const a = await analizar(ctx, texto, deps);
  return a.ok ? resumen(a.filas) : a;
}

export type ResultadoImportacionConsultas =
  | { ok: false; error: string }
  | {
      ok: true;
      creadas: number;
      conError: number;
      duplicadas: number;
      /** Filas válidas que el alta rechazó o no pudo guardar. */
      fallidas: { fila: number; error: string }[];
      /** Cargadas que no pudieron pasar a la etapa pedida (quedaron en la primera). */
      sinEtapa: { fila: number; error: string }[];
    };

/**
 * Confirma: vuelve a analizar y da de alta las filas válidas, de a `ALTAS_EN_PARALELO`, cada una
 * por `altaDeConsulta(…, IMPORTACION)` (sin avisos ni respuesta automática). Una fila que falla no
 * frena a las demás. Con etapa, mueve el recorrido con el motor (`mover`), como lo haría quien
 * importa: si la etapa de entrada exige tareas, sólo quien puede configurar lo fuerza.
 */
export async function importarConsultas(
  ctx: CtxConsultas,
  texto: unknown,
  deps: DepsImportacion = {},
): Promise<ResultadoImportacionConsultas> {
  if (!puedeImportar(ctx)) return no(MENSAJES_IMPORTACION_CONSULTAS.sinPermiso);
  const a = await analizar(ctx, texto, deps);
  if (!a.ok) return a;
  const { workspaceId } = ctx;
  const aCargar = a.filas.filter((f) => f.estado === "VALIDA" && f.datos);

  let creadas = 0;
  const fallidas: { fila: number; error: string }[] = [];
  const sinEtapa: { fila: number; error: string }[] = [];

  const enParalelo = Math.max(1, Math.min(deps.enParalelo ?? ALTAS_EN_PARALELO, 10));
  for (const lote of trozos(aCargar, enParalelo)) {
    await Promise.all(
      lote.map(async (f) => {
        let leadId: string;
        try {
          const r = await altaDeConsulta(ctx, f.datos!, { origenDelAlta: "IMPORTACION" }, deps);
          if (!r.ok) {
            fallidas.push({ fila: f.fila, error: r.error });
            return;
          }
          creadas += 1;
          leadId = r.leadId;
        } catch (e) {
          const err = e as { name?: string; code?: string } | null;
          console.error("[consultas] importación: falló una fila", { error: err?.name ?? "desconocido", codigo: err?.code ?? null });
          fallidas.push({ fila: f.fila, error: "No se pudo guardar." });
          return;
        }
        if (!f.etapaId) return;
        try {
          const j = await prisma.fotofficeJourney.findFirst({
            where: { workspaceId, subjectType: "CAPTACION", subjectId: leadId, kind: "VENTA", closedAt: null },
            select: { id: true, stageId: true },
          });
          if (!j) {
            sinEtapa.push({ fila: f.fila, error: "No entró al circuito de ventas." });
            return;
          }
          if (j.stageId === f.etapaId) return;
          const m = await mover(ctx, j.id, f.etapaId, { nota: NOTA_ETAPA, forzar: true });
          if (!m.ok) sinEtapa.push({ fila: f.fila, error: m.error });
        } catch (e) {
          const err = e as { name?: string; code?: string } | null;
          console.error("[consultas] importación: no se pudo mover de etapa", { error: err?.name ?? "desconocido", codigo: err?.code ?? null });
          sinEtapa.push({ fila: f.fila, error: "No se pudo mover de etapa." });
        }
      }),
    );
  }

  const r = resumen(a.filas);
  fallidas.sort((x, y) => x.fila - y.fila);
  sinEtapa.sort((x, y) => x.fila - y.fila);

  // Bitácora de la lista de Consultas: sólo conteos, ningún dato personal.
  try {
    await registrarActividad(prisma, {
      ctx: { workspaceId, workspaceName: "", userId: ctx.userId!, userLabel: ctx.userLabel, role: ctx.role },
      listKey: "captacion",
      kind: "BULK_ACTION",
      action: "IMPORTAR_CSV",
      rowCount: creadas,
      query: "",
      detail: { filas: r.filas.length, creadas, conError: r.conError, duplicadas: r.duplicadas, fallidas: fallidas.length, sinEtapa: sinEtapa.length },
    });
  } catch (e) {
    const err = e as { name?: string; code?: string } | null;
    console.error("[consultas] importación: no se pudo registrar en la bitácora", { error: err?.name ?? "desconocido", codigo: err?.code ?? null });
  }

  return { ok: true, creadas, conError: r.conError, duplicadas: r.duplicadas, fallidas, sinEtapa };
}
