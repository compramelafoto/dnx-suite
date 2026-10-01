import "server-only";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { listarCampos } from "@/lib/campos/definiciones";
import {
  CANALES, CLAVES_AUTOMATICO, ETIQUETA_CANAL, MAX_ASUNTO, MAX_CUERPO, MAX_NOMBRE_PLANTILLA,
  MAX_PLANTILLAS_ACTIVAS_POR_CANAL, TIPOS_PLANTILLA,
  type Canal, type ClaveAutomatico, type TipoPlantilla,
} from "./constantes";
import { analizar, tieneMarcadorSinCompletar, type ErrorPlantilla } from "./motor";
import { clavesPermitidas, type CampoParaVariables } from "./variables";

/** Quién configura. Las funciones de escritura exigen `configurar` adentro. */
export type CtxPlantillas = { workspaceId: string; userId: number; userLabel: string; role: string | null };

export type PlantillaDefinida = {
  id: string;
  channel: Canal;
  entityType: TipoPlantilla;
  name: string;
  subject: string | null;
  body: string;
  order: number;
  archivedAt: Date | null;
  updatedAt: Date;
};

export type Automatico = {
  id: string;
  clave: ClaveAutomatico;
  channel: Canal;
  entityType: TipoPlantilla;
  name: string;
  enabled: boolean;
  subject: string | null;
  body: string;
  updatedAt: Date;
};

/** Error de una variable o bloque, con el texto donde está (`asunto` o `cuerpo`) y la posición (base 0). */
export type ErrorDeTexto = ErrorPlantilla & { campo: "asunto" | "cuerpo" };

export type ResultadoPlantillas = { ok: true } | { ok: false; error: string; errores?: ErrorDeTexto[] };
export type ResultadoCreado = { ok: true; id: string } | { ok: false; error: string; errores?: ErrorDeTexto[] };

/** Cómo sale cada mensaje automático (spec §3.5): ficha, canal y nombre fijos. */
export const AUTOMATICOS: Record<ClaveAutomatico, { canal: Canal; tipo: TipoPlantilla; nombre: string }> = {
  CONSULTA_AUTORESPUESTA: { canal: "EMAIL", tipo: "CONSULTA", nombre: "Respuesta automática a una consulta nueva" },
};

export const MENSAJES_PLANTILLAS = {
  sinPermiso: "Sólo un administrador puede configurar las plantillas.",
  noEncontrada: "No encontramos esa plantilla.",
  esAutomatico: "Los mensajes automáticos se editan en su propia sección.",
  canalInvalido: "Elegí un canal válido: Correo o WhatsApp.",
  tipoInvalido: "Elegí para qué ficha es la plantilla.",
  nombre: `Poné un nombre de hasta ${MAX_NOMBRE_PLANTILLA} caracteres.`,
  asunto: `Poné un asunto de hasta ${MAX_ASUNTO} caracteres.`,
  cuerpoVacio: "Escribí el texto del mensaje.",
  yaSeUso: "Esta plantilla ya se usó: archivala.",
  ordenDesactualizado: "La lista cambió mientras la ordenabas: recargá la página.",
  datosInvalidos: "Los datos no son válidos.",
  marcadorSinCompletar: "Completá los textos entre corchetes en mayúsculas antes de encenderla.",
} as const;

const no = (error: string, errores?: ErrorDeTexto[]) => ({ ok: false as const, error, ...(errores ? { errores } : {}) });

export function esCanal(v: unknown): v is Canal {
  return typeof v === "string" && (CANALES as readonly string[]).includes(v);
}
export function esTipoPlantilla(v: unknown): v is TipoPlantilla {
  return typeof v === "string" && (TIPOS_PLANTILLA as readonly string[]).includes(v);
}
export function esClaveAutomatico(v: unknown): v is ClaveAutomatico {
  return typeof v === "string" && (CLAVES_AUTOMATICO as readonly string[]).includes(v);
}

function mensajeCuerpoLargo(canal: Canal): string {
  return `El texto puede tener hasta ${MAX_CUERPO[canal].toLocaleString("es-AR")} caracteres en ${ETIQUETA_CANAL[canal]}.`;
}
function mensajeTope(canal: Canal): string {
  return `Ya hay ${MAX_PLANTILLAS_ACTIVAS_POR_CANAL} plantillas activas de ${ETIQUETA_CANAL[canal]}. Archivá alguna.`;
}

const SELECT_PLANTILLA = {
  id: true, channel: true, entityType: true, name: true, subject: true, body: true, order: true, archivedAt: true,
  updatedAt: true,
} as const;

// ─── Validación ──────────────────────────────────────────────────────────────

/** Campos personalizados activos del tipo de ficha (0.5). Las GENERAL no usan campos. */
async function camposDe(workspaceId: string, tipo: TipoPlantilla): Promise<CampoParaVariables[]> {
  if (tipo === "GENERAL") return [];
  const campos = await listarCampos(workspaceId, tipo);
  return campos.map((c) => ({ clave: c.key, nombre: c.name }));
}

function limpiarNombre(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\s+/g, " ").trim();
  return t.length >= 1 && t.length <= MAX_NOMBRE_PLANTILLA ? t : null;
}

type TextoValido = { subject: string | null; body: string };

/**
 * Asunto y cuerpo listos para guardar, o el error. El asunto (sólo Correo) va en una línea; el
 * cuerpo normaliza los saltos de línea. Las variables se validan contra el tipo de ficha.
 */
async function validarTexto(
  workspaceId: string,
  canal: Canal,
  tipo: TipoPlantilla,
  asunto: unknown,
  cuerpo: unknown,
): Promise<{ ok: true; valor: TextoValido } | { ok: false; error: string; errores?: ErrorDeTexto[] }> {
  let subject: string | null = null;
  // Se analiza el texto tal como lo ve quien escribe (sólo con los saltos de línea normalizados), así
  // las posiciones de los errores coinciden con el campo; se recorta después.
  let asuntoVisto: string | null = null;
  if (canal === "EMAIL") {
    if (typeof asunto !== "string") return no(MENSAJES_PLANTILLAS.asunto);
    asuntoVisto = asunto.replace(/\r\n?/g, "\n");
    subject = asunto.replace(/\s+/g, " ").trim();
    if (subject.length < 1 || subject.length > MAX_ASUNTO) return no(MENSAJES_PLANTILLAS.asunto);
  } else if (asunto !== undefined && asunto !== null && asunto !== "") {
    return no(MENSAJES_PLANTILLAS.datosInvalidos);
  }
  if (typeof cuerpo !== "string") return no(MENSAJES_PLANTILLAS.cuerpoVacio);
  const cuerpoVisto = cuerpo.replace(/\r\n?/g, "\n");
  const body = cuerpoVisto.trim();
  if (!body) return no(MENSAJES_PLANTILLAS.cuerpoVacio);
  if (body.length > MAX_CUERPO[canal]) return no(mensajeCuerpoLargo(canal));

  const permitidas = clavesPermitidas(tipo, await camposDe(workspaceId, tipo));
  const errores: ErrorDeTexto[] = [];
  if (asuntoVisto !== null) {
    const r = analizar(asuntoVisto, permitidas);
    if (!r.ok) errores.push(...r.errores.map((e) => ({ ...e, campo: "asunto" as const })));
  }
  const r = analizar(cuerpoVisto, permitidas);
  if (!r.ok) errores.push(...r.errores.map((e) => ({ ...e, campo: "cuerpo" as const })));
  if (errores.length) {
    const e = errores[0]!;
    const donde = e.campo === "asunto" ? "En el asunto" : "En el texto";
    return no(`${donde} (carácter ${e.posicion + 1}): ${e.mensaje}`, errores);
  }
  return { ok: true, valor: { subject, body } };
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

/**
 * Plantillas comunes de un canal (nunca las automáticas). Con `tipo`, las de esa ficha más las
 * GENERAL; sin `tipo`, todas. Activas salvo `incluirArchivadas`, por orden.
 */
export async function listarPlantillas(
  workspaceId: string,
  opciones: { canal: Canal; tipo?: TipoPlantilla; incluirArchivadas?: boolean },
): Promise<PlantillaDefinida[]> {
  const tipos = opciones.tipo ? [...new Set<TipoPlantilla>([opciones.tipo, "GENERAL"])] : undefined;
  const filas = await prisma.fotofficeMessageTemplate.findMany({
    where: {
      workspaceId,
      channel: opciones.canal,
      systemKey: null,
      ...(tipos ? { entityType: { in: tipos } } : {}),
      ...(opciones.incluirArchivadas ? {} : { archivedAt: null }),
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    // Techo de seguridad: activas son ≤ 100 por canal (tope); con archivadas incluidas, 500 alcanza
    // de sobra para la pantalla de Configuración. Si alguna vez se pasa, las más nuevas no se listan.
    take: 500,
    select: SELECT_PLANTILLA,
  });
  return filas.map((f) => ({ ...f, channel: f.channel as Canal, entityType: f.entityType as TipoPlantilla }));
}

/** Una plantilla común activa del workspace, del canal y válida para la ficha; null si no. */
export async function plantillaParaUsar(
  workspaceId: string,
  id: unknown,
  canal: Canal,
  tipo: TipoPlantilla,
): Promise<PlantillaDefinida | null> {
  if (typeof id !== "string" || !id || id.length > 100) return null;
  const f = await prisma.fotofficeMessageTemplate.findFirst({
    where: { id, workspaceId, channel: canal, systemKey: null, archivedAt: null },
    select: SELECT_PLANTILLA,
  });
  if (!f || (f.entityType !== tipo && f.entityType !== "GENERAL")) return null;
  return { ...f, channel: f.channel as Canal, entityType: f.entityType as TipoPlantilla };
}

/** Cuántos mensajes registrados usó cada plantilla (sólo del workspace). Configuración ofrece "Borrar" a las de 0. */
export async function contarUsosPorPlantilla(workspaceId: string, ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const grupos = await prisma.fotofficeMessage.groupBy({
    by: ["templateId"],
    where: { workspaceId, templateId: { in: ids } },
    _count: true,
  });
  return Object.fromEntries(grupos.map((g) => [g.templateId as string, g._count as number]));
}

// ─── Plantillas comunes ──────────────────────────────────────────────────────

/** La plantilla, sólo si es del workspace. */
async function plantillaDelWorkspace(workspaceId: string, id: unknown) {
  if (typeof id !== "string" || !id || id.length > 100) return null;
  return prisma.fotofficeMessageTemplate.findFirst({
    where: { id, workspaceId },
    select: {
      id: true, channel: true, entityType: true, name: true, subject: true, body: true, systemKey: true, archivedAt: true,
    },
  });
}

/**
 * Tipo de ficha de una plantilla común del workspace; null si no existe, es ajena o es automática.
 * Configuración lo usa para frenar las plantillas de un módulo apagado antes de tocar nada.
 */
export async function tipoDePlantilla(workspaceId: string, id: unknown): Promise<TipoPlantilla | null> {
  const p = await plantillaDelWorkspace(workspaceId, id);
  if (!p || p.systemKey !== null || !esTipoPlantilla(p.entityType)) return null;
  return p.entityType;
}

async function activasDelCanal(workspaceId: string, canal: string): Promise<number> {
  return prisma.fotofficeMessageTemplate.count({ where: { workspaceId, channel: canal, systemKey: null, archivedAt: null } });
}

async function ordenAlFinal(workspaceId: string, canal: string): Promise<number> {
  const ultima = await prisma.fotofficeMessageTemplate.findFirst({
    where: { workspaceId, channel: canal, systemKey: null, archivedAt: null },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (ultima?.order ?? -1) + 1;
}

export type NuevaPlantilla = { canal: unknown; tipo: unknown; nombre: unknown; asunto?: unknown; cuerpo: unknown };

export async function crearPlantilla(ctx: CtxPlantillas, datos: NuevaPlantilla): Promise<ResultadoCreado> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_PLANTILLAS.sinPermiso);
  if (!datos || typeof datos !== "object") return no(MENSAJES_PLANTILLAS.datosInvalidos);
  if (!esCanal(datos.canal)) return no(MENSAJES_PLANTILLAS.canalInvalido);
  if (!esTipoPlantilla(datos.tipo)) return no(MENSAJES_PLANTILLAS.tipoInvalido);
  const name = limpiarNombre(datos.nombre);
  if (!name) return no(MENSAJES_PLANTILLAS.nombre);
  const texto = await validarTexto(ctx.workspaceId, datos.canal, datos.tipo, datos.asunto, datos.cuerpo);
  if (!texto.ok) return texto;
  if ((await activasDelCanal(ctx.workspaceId, datos.canal)) >= MAX_PLANTILLAS_ACTIVAS_POR_CANAL) {
    return no(mensajeTope(datos.canal));
  }
  const creada = await prisma.fotofficeMessageTemplate.create({
    data: {
      workspaceId: ctx.workspaceId,
      channel: datos.canal,
      entityType: datos.tipo,
      name,
      subject: texto.valor.subject,
      body: texto.valor.body,
      order: await ordenAlFinal(ctx.workspaceId, datos.canal),
      updatedByUserId: ctx.userId,
    },
    select: { id: true },
  });
  return { ok: true, id: creada.id };
}

export type CambiosDePlantilla = { tipo?: unknown; nombre?: unknown; asunto?: unknown; cuerpo?: unknown };

/**
 * Nombre, ficha, asunto y cuerpo. El canal no cambia. Si cambia la ficha, el asunto o el cuerpo,
 * se vuelve a validar todo el texto contra la ficha que queda. Gana la última edición.
 */
export async function editarPlantilla(ctx: CtxPlantillas, id: string, cambios: CambiosDePlantilla): Promise<ResultadoPlantillas> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_PLANTILLAS.sinPermiso);
  if (!cambios || typeof cambios !== "object") return no(MENSAJES_PLANTILLAS.datosInvalidos);
  const p = await plantillaDelWorkspace(ctx.workspaceId, id);
  if (!p) return no(MENSAJES_PLANTILLAS.noEncontrada);
  if (p.systemKey !== null) return no(MENSAJES_PLANTILLAS.esAutomatico);
  if (!esCanal(p.channel)) return no(MENSAJES_PLANTILLAS.datosInvalidos);

  const data: { name?: string; entityType?: TipoPlantilla; subject?: string | null; body?: string } = {};
  if (cambios.nombre !== undefined) {
    const name = limpiarNombre(cambios.nombre);
    if (!name) return no(MENSAJES_PLANTILLAS.nombre);
    data.name = name;
  }
  if (cambios.tipo !== undefined && !esTipoPlantilla(cambios.tipo)) return no(MENSAJES_PLANTILLAS.tipoInvalido);
  const tocaTexto =
    (cambios.tipo !== undefined && cambios.tipo !== p.entityType) || cambios.asunto !== undefined || cambios.cuerpo !== undefined;
  if (tocaTexto) {
    const tipo = (cambios.tipo ?? p.entityType) as TipoPlantilla;
    if (!esTipoPlantilla(tipo)) return no(MENSAJES_PLANTILLAS.tipoInvalido);
    const texto = await validarTexto(
      ctx.workspaceId, p.channel, tipo,
      cambios.asunto !== undefined ? cambios.asunto : p.subject,
      cambios.cuerpo !== undefined ? cambios.cuerpo : p.body,
    );
    if (!texto.ok) return texto;
    data.entityType = tipo;
    data.subject = texto.valor.subject;
    data.body = texto.valor.body;
  }
  if (Object.keys(data).length === 0) return { ok: true };
  await prisma.fotofficeMessageTemplate.updateMany({
    where: { id: p.id, workspaceId: ctx.workspaceId, systemKey: null },
    data: { ...data, updatedByUserId: ctx.userId },
  });
  return { ok: true };
}

/** "Copia de …", activa y al final de la lista, si no se pasa el tope. */
export async function duplicarPlantilla(ctx: CtxPlantillas, id: string): Promise<ResultadoCreado> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_PLANTILLAS.sinPermiso);
  const p = await plantillaDelWorkspace(ctx.workspaceId, id);
  if (!p) return no(MENSAJES_PLANTILLAS.noEncontrada);
  if (p.systemKey !== null) return no(MENSAJES_PLANTILLAS.esAutomatico);
  if (!esCanal(p.channel)) return no(MENSAJES_PLANTILLAS.datosInvalidos);
  if ((await activasDelCanal(ctx.workspaceId, p.channel)) >= MAX_PLANTILLAS_ACTIVAS_POR_CANAL) {
    return no(mensajeTope(p.channel));
  }
  // Se revalida: un campo personalizado pudo archivarse desde que se guardó el original.
  if (!esTipoPlantilla(p.entityType)) return no(MENSAJES_PLANTILLAS.datosInvalidos);
  const texto = await validarTexto(ctx.workspaceId, p.channel, p.entityType, p.subject, p.body);
  if (!texto.ok) return texto;
  const name = `Copia de ${p.name}`.slice(0, MAX_NOMBRE_PLANTILLA).trim();
  const creada = await prisma.fotofficeMessageTemplate.create({
    data: {
      workspaceId: ctx.workspaceId,
      channel: p.channel,
      entityType: p.entityType,
      name,
      subject: texto.valor.subject,
      body: texto.valor.body,
      order: await ordenAlFinal(ctx.workspaceId, p.channel),
      updatedByUserId: ctx.userId,
    },
    select: { id: true },
  });
  return { ok: true, id: creada.id };
}

/** `ids` son las plantillas activas del canal, en el orden nuevo (todas, sin repetir). */
export async function reordenarPlantillas(ctx: CtxPlantillas, canal: unknown, ids: unknown): Promise<ResultadoPlantillas> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_PLANTILLAS.sinPermiso);
  if (!esCanal(canal)) return no(MENSAJES_PLANTILLAS.canalInvalido);
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every((i) => typeof i === "string")) {
    return no(MENSAJES_PLANTILLAS.datosInvalidos);
  }
  const actuales = await prisma.fotofficeMessageTemplate.findMany({
    where: { workspaceId: ctx.workspaceId, channel: canal, systemKey: null, archivedAt: null },
    select: { id: true },
  });
  const set = new Set(actuales.map((a) => a.id));
  if (new Set(ids).size !== ids.length || ids.length !== set.size || !ids.every((i) => set.has(i))) {
    return no(MENSAJES_PLANTILLAS.ordenDesactualizado);
  }
  await prisma.$transaction(async (tx) => {
    for (const [i, id] of (ids as string[]).entries()) {
      await tx.fotofficeMessageTemplate.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data: { order: i } });
    }
  });
  return { ok: true };
}

/** Deja de ofrecerse en las fichas; los mensajes ya enviados guardan su texto. */
export async function archivarPlantilla(ctx: CtxPlantillas, id: string): Promise<ResultadoPlantillas> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_PLANTILLAS.sinPermiso);
  const p = await plantillaDelWorkspace(ctx.workspaceId, id);
  if (!p) return no(MENSAJES_PLANTILLAS.noEncontrada);
  if (p.systemKey !== null) return no(MENSAJES_PLANTILLAS.esAutomatico);
  if (p.archivedAt) return { ok: true };
  await prisma.fotofficeMessageTemplate.updateMany({
    where: { id: p.id, workspaceId: ctx.workspaceId },
    data: { archivedAt: new Date(), updatedByUserId: ctx.userId },
  });
  return { ok: true };
}

/** Vuelve al final de la lista, si no se pasa el tope de activas del canal. */
export async function desarchivarPlantilla(ctx: CtxPlantillas, id: string): Promise<ResultadoPlantillas> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_PLANTILLAS.sinPermiso);
  const p = await plantillaDelWorkspace(ctx.workspaceId, id);
  if (!p) return no(MENSAJES_PLANTILLAS.noEncontrada);
  if (p.systemKey !== null) return no(MENSAJES_PLANTILLAS.esAutomatico);
  if (!p.archivedAt) return { ok: true };
  if (!esCanal(p.channel)) return no(MENSAJES_PLANTILLAS.datosInvalidos);
  if ((await activasDelCanal(ctx.workspaceId, p.channel)) >= MAX_PLANTILLAS_ACTIVAS_POR_CANAL) {
    return no(mensajeTope(p.channel));
  }
  await prisma.fotofficeMessageTemplate.updateMany({
    where: { id: p.id, workspaceId: ctx.workspaceId },
    data: { archivedAt: null, order: await ordenAlFinal(ctx.workspaceId, p.channel), updatedByUserId: ctx.userId },
  });
  return { ok: true };
}

/** Sólo si nunca se usó (ningún mensaje registrado con ella); si se usó, se archiva. */
export async function borrarPlantilla(ctx: CtxPlantillas, id: string): Promise<ResultadoPlantillas> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_PLANTILLAS.sinPermiso);
  const p = await plantillaDelWorkspace(ctx.workspaceId, id);
  if (!p) return no(MENSAJES_PLANTILLAS.noEncontrada);
  if (p.systemKey !== null) return no(MENSAJES_PLANTILLAS.esAutomatico);
  return prisma.$transaction(async (tx) => {
    // Adentro de la transacción: un mensaje registrado en el mismo instante no pierde su plantilla.
    if ((await tx.fotofficeMessage.count({ where: { workspaceId: ctx.workspaceId, templateId: p.id } })) > 0) {
      return no(MENSAJES_PLANTILLAS.yaSeUso);
    }
    await tx.fotofficeMessageTemplate.deleteMany({ where: { id: p.id, workspaceId: ctx.workspaceId, systemKey: null } });
    return { ok: true as const };
  });
}

// ─── Mensajes automáticos ────────────────────────────────────────────────────

/** El automático del workspace, o null si todavía no se creó (lo crea la semilla). */
export async function leerAutomatico(workspaceId: string, clave: ClaveAutomatico): Promise<Automatico | null> {
  if (!esClaveAutomatico(clave)) return null;
  const f = await prisma.fotofficeMessageTemplate.findFirst({
    where: { workspaceId, systemKey: clave },
    select: { id: true, channel: true, entityType: true, name: true, enabled: true, subject: true, body: true, updatedAt: true },
  });
  if (!f) return null;
  return { ...f, clave, channel: f.channel as Canal, entityType: f.entityType as TipoPlantilla };
}

export type CambiosDeAutomatico = { enabled: unknown; subject: unknown; body: unknown };

/** Interruptor, asunto y cuerpo. Ficha y canal son fijos (`AUTOMATICOS`). Si no existía, lo crea. */
export async function guardarAutomatico(ctx: CtxPlantillas, clave: unknown, datos: CambiosDeAutomatico): Promise<ResultadoPlantillas> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_PLANTILLAS.sinPermiso);
  if (!esClaveAutomatico(clave)) return no(MENSAJES_PLANTILLAS.noEncontrada);
  if (!datos || typeof datos !== "object" || typeof datos.enabled !== "boolean") return no(MENSAJES_PLANTILLAS.datosInvalidos);
  const def = AUTOMATICOS[clave];
  const texto = await validarTexto(ctx.workspaceId, def.canal, def.tipo, datos.subject, datos.body);
  if (!texto.ok) return texto;
  if (datos.enabled && (tieneMarcadorSinCompletar(texto.valor.subject) || tieneMarcadorSinCompletar(texto.valor.body))) {
    return no(MENSAJES_PLANTILLAS.marcadorSinCompletar);
  }
  const data = {
    enabled: datos.enabled, subject: texto.valor.subject, body: texto.valor.body, updatedByUserId: ctx.userId,
  };
  const actualizar = () =>
    prisma.fotofficeMessageTemplate.updateMany({ where: { workspaceId: ctx.workspaceId, systemKey: clave }, data });
  if ((await actualizar()).count > 0) return { ok: true };
  try {
    await prisma.fotofficeMessageTemplate.create({
      data: {
        workspaceId: ctx.workspaceId, systemKey: clave, channel: def.canal, entityType: def.tipo, name: def.nombre, order: 0,
        ...data,
      },
      select: { id: true },
    });
  } catch (e) {
    // La semilla lo creó en el mismo instante: el índice único frena y se actualiza.
    if ((e as { code?: unknown })?.code !== "P2002") throw e;
    await actualizar();
  }
  return { ok: true };
}
