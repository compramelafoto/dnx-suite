import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { MENSAJES_CONTRATO as M, puedeConfigurarContratos, type CtxContratos } from "./acceso";
import { CLAUSULA_CONSENTIMIENTO_INICIAL } from "./clausula";
import { DIAS_RECORDATORIO_INICIAL, MAX_DIAS_RECORDATORIO, MIN_DIAS_RECORDATORIO } from "./constantes";
import { borrarObjetoContrato, subirObjetoContrato, urlDeLecturaContrato } from "./almacen";

/**
 * Ajustes de Contratos (Configuración → Contratos, `FotofficeContratoAjustes`): una fila por
 * organización. Datos de la empresa (van a las variables `[empresa_…]`), cláusula de consentimiento,
 * recordatorios y la imagen de la firma de la empresa (R2 privado). Permiso: `configurar`.
 * Sin fila valen los de fábrica: sin datos, cláusula por omisión, recordatorio apagado a los 3 días.
 */
export type AjustesContratos = {
  companyName: string | null;
  companyTaxId: string | null;
  companyAddress: string | null;
  /** null = se usa la cláusula por omisión. */
  consentClause: string | null;
  reminderEnabled: boolean;
  reminderDays: number;
  /** Clave de la firma de la empresa en el bucket privado, o null si no se subió. */
  companySignatureKey: string | null;
};

export const AJUSTES_CONTRATOS_DE_FABRICA: AjustesContratos = {
  companyName: null, companyTaxId: null, companyAddress: null, consentClause: null,
  reminderEnabled: false, reminderDays: DIAS_RECORDATORIO_INICIAL, companySignatureKey: null,
};

export const MAX_EMPRESA_NOMBRE = 120;
export const MAX_EMPRESA_CUIT = 30;
export const MAX_EMPRESA_DOMICILIO = 200;
export const MAX_CLAUSULA = 3000;
/** Imagen de la firma de la empresa: hasta 1 MB. */
export const FIRMA_EMPRESA_MAX_BYTES = 1024 * 1024;

/** La cláusula que rige: la de la organización o, si no cargó ninguna, la de fábrica. */
export function clausulaVigente(a: Pick<AjustesContratos, "consentClause">): string {
  return a.consentClause && a.consentClause.trim() ? a.consentClause : CLAUSULA_CONSENTIMIENTO_INICIAL;
}

export async function leerAjustesContratos(workspaceId: string): Promise<AjustesContratos> {
  const f = await prisma.fotofficeContratoAjustes.findUnique({
    where: { workspaceId },
    select: {
      companyName: true, companyTaxId: true, companyAddress: true, consentClause: true,
      reminderEnabled: true, reminderDays: true, companySignatureKey: true,
    },
  });
  return f ? (f as AjustesContratos) : { ...AJUSTES_CONTRATOS_DE_FABRICA };
}

export type ResultadoAjustes = { ok: true } | { ok: false; error: string };

function textoOpcional(v: unknown, max: number): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\r\n/g, "\n").trim();
  if (t.length > max) return undefined;
  return t === "" ? null : t;
}

function entero(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

async function guardarFila(workspaceId: string, valores: Record<string, unknown>): Promise<void> {
  try {
    await prisma.fotofficeContratoAjustes.upsert({
      where: { workspaceId },
      create: { workspaceId, ...valores },
      update: valores,
      select: { id: true },
    });
  } catch (e) {
    // Dos pestañas guardaron la primera vez a la vez: el único frena a una; gana la última.
    if ((e as { code?: unknown } | null)?.code !== "P2002") throw e;
    await prisma.fotofficeContratoAjustes.updateMany({ where: { workspaceId }, data: valores });
  }
}

/**
 * Guarda empresa, cláusula y recordatorios. No toca la firma de la empresa. Una cláusula vacía vuelve
 * a la de fábrica. Exige `configurar`.
 */
export async function guardarAjustesContratos(ctx: CtxContratos, datos: unknown): Promise<ResultadoAjustes> {
  if (!puedeConfigurarContratos(ctx)) return { ok: false, error: M.sinPermiso };
  if (!datos || typeof datos !== "object") return { ok: false, error: M.datosInvalidos };
  const d = datos as Record<string, unknown>;
  if (typeof d.reminderEnabled !== "boolean") return { ok: false, error: M.datosInvalidos };
  const companyName = textoOpcional(d.companyName, MAX_EMPRESA_NOMBRE);
  if (companyName === undefined) return { ok: false, error: M.empresaNombre };
  const companyTaxId = textoOpcional(d.companyTaxId, MAX_EMPRESA_CUIT);
  if (companyTaxId === undefined) return { ok: false, error: M.empresaCuit };
  const companyAddress = textoOpcional(d.companyAddress, MAX_EMPRESA_DOMICILIO);
  if (companyAddress === undefined) return { ok: false, error: M.empresaDomicilio };
  const consentClause = textoOpcional(d.consentClause, MAX_CLAUSULA);
  if (consentClause === undefined) return { ok: false, error: M.clausula };
  const reminderDays = entero(d.reminderDays, MIN_DIAS_RECORDATORIO, MAX_DIAS_RECORDATORIO);
  if (reminderDays === null) return { ok: false, error: M.recordatorioDias };
  await guardarFila(ctx.workspaceId, { companyName, companyTaxId, companyAddress, consentClause, reminderEnabled: d.reminderEnabled, reminderDays });
  return { ok: true };
}

// --- Firma de la empresa ----------------------------------------------------------------------

/** Tipo de imagen por los primeros bytes (no por lo que diga el navegador): PNG o JPG, o null. */
export function tipoDeImagenFirma(b: Uint8Array): { tipo: "image/png" | "image/jpeg"; extension: "png" | "jpg" } | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return { tipo: "image/png", extension: "png" };
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { tipo: "image/jpeg", extension: "jpg" };
  return null;
}

/** Sube la imagen de la firma de la empresa (PNG o JPG, hasta 1 MB) y reemplaza la anterior. Exige `configurar`. */
export async function guardarFirmaEmpresa(ctx: CtxContratos, bytes: Uint8Array): Promise<ResultadoAjustes> {
  if (!puedeConfigurarContratos(ctx)) return { ok: false, error: M.sinPermiso };
  if (bytes.byteLength === 0) return { ok: false, error: M.firmaVacia };
  if (bytes.byteLength > FIRMA_EMPRESA_MAX_BYTES) return { ok: false, error: M.firmaTamano };
  const t = tipoDeImagenFirma(bytes);
  if (!t) return { ok: false, error: M.firmaTipo };
  const anterior = (await leerAjustesContratos(ctx.workspaceId)).companySignatureKey;
  const clave = `contratos/${ctx.workspaceId}/empresa/firma-${randomUUID()}.${t.extension}`;
  try {
    await subirObjetoContrato(clave, bytes, t.tipo);
  } catch {
    return { ok: false, error: M.firmaSinAlmacen };
  }
  try {
    await guardarFila(ctx.workspaceId, { companySignatureKey: clave });
  } catch {
    // No quedó referenciada: se borra lo recién subido (la firma anterior se conserva).
    await borrarObjetoContrato(clave).catch(() => undefined);
    return { ok: false, error: M.guardar };
  }
  if (anterior && anterior !== clave) await borrarObjetoContrato(anterior).catch(() => undefined);
  return { ok: true };
}

/** Quita la firma de la empresa. Exige `configurar`. */
export async function quitarFirmaEmpresa(ctx: CtxContratos): Promise<ResultadoAjustes> {
  if (!puedeConfigurarContratos(ctx)) return { ok: false, error: M.sinPermiso };
  const anterior = (await leerAjustesContratos(ctx.workspaceId)).companySignatureKey;
  if (!anterior) return { ok: true };
  await prisma.fotofficeContratoAjustes.updateMany({ where: { workspaceId: ctx.workspaceId }, data: { companySignatureKey: null } });
  await borrarObjetoContrato(anterior).catch(() => undefined);
  return { ok: true };
}

/** Enlace firmado para mostrar la firma de la empresa en la pantalla de ajustes (servidor), o null. */
export async function urlFirmaEmpresa(clave: string | null): Promise<string | null> {
  if (!clave) return null;
  try {
    return await urlDeLecturaContrato(clave);
  } catch {
    return null;
  }
}
