import "server-only";
import { prisma } from "@repo/db";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { CONTRACTS_MODULE_KEY } from "./acceso";
import { enviarCorreoContrato } from "./correos";
import { hashDeToken, resolverClaveDeEnlace, tokenDeFirmante, urlDelContrato } from "./enlace";
import { registrarEvento } from "./eventos";
import { finalizarContratoFirmado, type DepsSellado } from "./sellado";
import { DIAS_VALIDEZ_ENLACE } from "./constantes";
import { bloquearContrato } from "./versiones";

/**
 * Tarea diaria de Contratos (`app/api/cron/contratos-recordatorios`, 13:00 UTC = 10:00 de Buenos Aires).
 * Hace dos cosas, en este orden:
 *
 * 1. RECORDATORIOS de firma. Para cada organización con el módulo Contratos encendido y
 *    `FotofficeContratoAjustes.reminderEnabled`, toma a los firmantes de la versión VIGENTE (no revocada)
 *    de contratos ENVIADO o FIRMADO_PARCIAL que no firmaron ni rechazaron, con el enlace sin vencer, cuya
 *    versión se envió hace `reminderDays` días o más y cuyo último recordatorio (si hubo) fue hace
 *    `reminderDays` días o más. Les manda `CONTRATO_RECORDATORIO`.
 *    El enlace no se puede reconstruir desde la base (sólo está su hash): al recordar se manda el
 *    MISMO enlace (el token se recalcula con el id del firmante y su vencimiento) sin extender su vida: los
 *    recordatorios terminan cuando el enlace vence (o a los 30 días del envío de la versión). Sólo el
 *    "Reenviar enlace" manual rota el token y extiende. Si el correo no sale se deja como estaba.
 * 2. REINTENTO DE PDF: contratos FIRMADO (por los firmantes, no en papel) de los últimos 30 días que
 *    quedaron sin PDF o sin copia enviada (`after()` no llegó a terminar o falló el proveedor).
 *
 * Topes: como mucho `TOPE_RECORDATORIOS_CORRIDA` recordatorios por corrida entre todas las organizaciones,
 * el tope diario de correos automáticos de cada organización (lo aplica `enviarCorreoContrato`) y
 * `TOPE_PDFS_CORRIDA` contratos reintentados. Nada de esto crea filas de ajustes. Nunca lanza por una
 * organización y el registro sólo guarda códigos y números.
 */

export const TOPE_RECORDATORIOS_CORRIDA = 200;
export const TOPE_PDFS_CORRIDA = 25;
/** Fallos de envío seguidos tras los cuales se corta la corrida (proveedor caído). */
const FALLOS_SEGUIDOS_MAX = 5;
const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_REINTENTO_PDF = 30;

export type ReporteContratos = {
  organizaciones: number;
  recordatorios: { enviados: number; fallidos: number; salteados: number; conTopeDiario: number; topeCorrida: boolean };
  pdfs: { revisados: number; generados: number; enviados: number; fallidos: number };
};

export type DepsContratos = DepsSellado & {
  clave?: string | null;
  appOrigin?: string;
  topeRecordatorios?: number;
  topePdfs?: number;
};

function origenDeLaApp(deps: { appOrigin?: string }): string {
  return (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
}

function codigo(e: unknown): string {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : "desconocido";
}

type Estado = { intentos: number; tope: number; fallosSeguidos: number; corte: boolean };

type Rotacion = { nuevoHash: string; vence: Date; antes: { tokenHash: string; tokenExpiresAt: Date; lastReminderAt: Date | null } };

/** Rota el token del firmante y marca el recordatorio, bajo el candado del contrato. null = ya no corresponde. */
async function rotarToken(workspaceId: string, contratoId: string, firmanteId: string, versionId: string, limite: Date, ahora: Date, clave: string): Promise<Rotacion | null> {
  return prisma.$transaction(async (tx) => {
    await bloquearContrato(tx, contratoId);
    const [f, c, v] = await Promise.all([
      tx.fotofficeContratoFirmante.findFirst({
        where: { id: firmanteId, workspaceId, versionId },
        select: { tokenHash: true, tokenExpiresAt: true, lastReminderAt: true, signedAt: true, rejectedAt: true },
      }),
      tx.fotofficeContrato.findFirst({ where: { id: contratoId, workspaceId }, select: { status: true, currentVersionId: true } }),
      tx.fotofficeContratoVersion.findFirst({ where: { id: versionId, workspaceId }, select: { revokedAt: true, sentAt: true } }),
    ]);
    if (!f || !c || !v || f.signedAt || f.rejectedAt || v.revokedAt || c.currentVersionId !== versionId) return null;
    if (c.status !== "ENVIADO" && c.status !== "FIRMADO_PARCIAL") return null;
    if (f.tokenExpiresAt.getTime() <= ahora.getTime()) return null;
    if (f.lastReminderAt && f.lastReminderAt.getTime() > limite.getTime()) return null;
    // Segunda guarda: pasados los días de vida del enlace desde el envío de la versión, no se recuerda más.
    if (v.sentAt.getTime() + DIAS_VALIDEZ_ENLACE * DIA_MS <= ahora.getTime()) return null;
    // El recordatorio NO extiende la vida del enlace: sale con el mismo vencimiento (el token se recalcula igual
    // desde el id y el vencimiento, así que no hace falta rotarlo) y los recordatorios terminan cuando vence.
    const vence = f.tokenExpiresAt;
    const nuevoHash = f.tokenHash;
    const r = await tx.fotofficeContratoFirmante.updateMany({
      where: { id: firmanteId, workspaceId, tokenHash: f.tokenHash, signedAt: null, rejectedAt: null },
      data: { lastReminderAt: ahora },
    });
    if (r.count !== 1) return null;
    return { nuevoHash, vence, antes: { tokenHash: f.tokenHash, tokenExpiresAt: f.tokenExpiresAt, lastReminderAt: f.lastReminderAt } };
  }, OPCIONES_TRANSACCION);
}

async function deshacerRotacion(workspaceId: string, firmanteId: string, rot: Rotacion): Promise<void> {
  try {
    await prisma.fotofficeContratoFirmante.updateMany({
      where: { id: firmanteId, workspaceId, tokenHash: rot.nuevoHash },
      data: { tokenHash: rot.antes.tokenHash, tokenExpiresAt: rot.antes.tokenExpiresAt, lastReminderAt: rot.antes.lastReminderAt },
    });
  } catch (e) {
    console.error("[contratos] no se pudo deshacer la rotación del enlace", { codigo: codigo(e) });
  }
}

async function recordatoriosDe(workspaceId: string, dias: number, ahora: Date, clave: string, reporte: ReporteContratos, estado: Estado, deps: DepsContratos): Promise<void> {
  if (!(await isModuleEnabledForWorkspace(workspaceId, CONTRACTS_MODULE_KEY))) return;
  const limite = new Date(ahora.getTime() - dias * DIA_MS);
  const contratos = await prisma.fotofficeContrato.findMany({
    where: { workspaceId, status: { in: ["ENVIADO", "FIRMADO_PARCIAL"] }, manualSignedAt: null },
    orderBy: [{ sentAt: "asc" }],
    take: 1000,
    select: { id: true, number: true, currentVersionId: true },
  });
  const versionIds = contratos.flatMap((c) => (c.currentVersionId ? [c.currentVersionId] : []));
  if (versionIds.length === 0) return;
  const versiones = await prisma.fotofficeContratoVersion.findMany({
    where: { workspaceId, id: { in: versionIds }, revokedAt: null },
    select: { id: true, sentAt: true },
  });
  const vigentes = new Set(
    versiones.filter((v) => v.sentAt.getTime() <= limite.getTime() && v.sentAt.getTime() + DIAS_VALIDEZ_ENLACE * DIA_MS > ahora.getTime()).map((v) => v.id),
  );
  if (vigentes.size === 0) return;
  const firmantes = await prisma.fotofficeContratoFirmante.findMany({
    where: {
      workspaceId, versionId: { in: [...vigentes] }, signedAt: null, rejectedAt: null, tokenExpiresAt: { gt: ahora },
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lte: limite } }],
    },
    orderBy: [{ orden: "asc" }, { id: "asc" }],
    // Uno más que lo que queda de cupo, para saber si sobraron para mañana.
    take: estado.tope - estado.intentos + 1,
    select: { id: true, versionId: true, orden: true, name: true, email: true },
  });
  if (firmantes.length === 0) return;
  const sitio = await sitioDelWorkspace(workspaceId);
  const contratoDe = new Map(contratos.map((c) => [c.currentVersionId, c]));
  for (const f of firmantes) {
    if (estado.corte) return;
    if (estado.intentos >= estado.tope) {
      reporte.recordatorios.topeCorrida = true;
      return;
    }
    const c = contratoDe.get(f.versionId);
    if (!c) continue;
    let rot: Rotacion | null;
    try {
      rot = await rotarToken(workspaceId, c.id, f.id, f.versionId, limite, ahora, clave);
    } catch (e) {
      console.error("[contratos] no se pudo preparar un recordatorio", { codigo: codigo(e) });
      reporte.recordatorios.fallidos++;
      continue;
    }
    if (!rot) {
      reporte.recordatorios.salteados++;
      continue;
    }
    const enlace = sitio ? urlDelContrato({ ...sitio, appOrigin: origenDeLaApp(deps), token: tokenDeFirmante(f.id, rot.vence, clave) }) : null;
    if (!enlace) {
      await deshacerRotacion(workspaceId, f.id, rot);
      console.warn("[contratos] no se pudo armar el enlace de un recordatorio", { codigo: "SIN_ENLACE" });
      reporte.recordatorios.fallidos++;
      estado.corte = true;
      return;
    }
    estado.intentos++;
    const r = await enviarCorreoContrato(
      { workspaceId, clave: "CONTRATO_RECORDATORIO", contratoId: c.id, para: f.email, nombre: f.name, numero: c.number, enlace },
      { enviar: deps.enviar, ahora: () => ahora },
    );
    if (r === "ENVIADO") {
      estado.fallosSeguidos = 0;
      reporte.recordatorios.enviados++;
      try {
        await registrarEvento(prisma, { workspaceId, contratoId: c.id, tipo: "RECORDATORIO", firmanteId: f.id, data: { orden: f.orden } });
      } catch (e) {
        console.error("[contratos] no se pudo registrar un recordatorio", { codigo: codigo(e) });
      }
      continue;
    }
    // No salió: el enlace que la persona ya tenía tiene que seguir andando.
    await deshacerRotacion(workspaceId, f.id, rot);
    if (r === "SIN_CORREO") {
      reporte.recordatorios.salteados++;
    } else if (r === "TOPE") {
      reporte.recordatorios.conTopeDiario++;
      return;
    } else if (r === "APAGADA" || r === "PLANTILLA_CON_ERRORES") {
      // Sirve igual para todos los firmantes de la organización.
      reporte.recordatorios.salteados++;
      return;
    } else {
      reporte.recordatorios.fallidos++;
      if (++estado.fallosSeguidos >= FALLOS_SEGUIDOS_MAX) {
        console.warn("[contratos] demasiados fallos seguidos; se corta la corrida", { codigo: "FALLOS_SEGUIDOS" });
        estado.corte = true;
        return;
      }
    }
  }
}

/** Recordatorios de firma de todas las organizaciones que los tienen encendidos. */
export async function enviarRecordatoriosDeContratos(reporte: ReporteContratos, deps: DepsContratos = {}): Promise<void> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
  if (!clave) {
    console.error("[contratos] sin clave para los enlaces: no se mandan recordatorios", { codigo: "SIN_CLAVE_ENLACE" });
    return;
  }
  const estado: Estado = { intentos: 0, tope: deps.topeRecordatorios ?? TOPE_RECORDATORIOS_CORRIDA, fallosSeguidos: 0, corte: false };
  const ajustes = await prisma.fotofficeContratoAjustes.findMany({
    where: { reminderEnabled: true },
    orderBy: [{ workspaceId: "asc" }],
    select: { workspaceId: true, reminderDays: true },
  });
  for (const a of ajustes) {
    if (estado.corte) break;
    if (estado.intentos >= estado.tope) {
      reporte.recordatorios.topeCorrida = true;
      break;
    }
    try {
      reporte.organizaciones++;
      await recordatoriosDe(a.workspaceId, Math.min(30, Math.max(1, a.reminderDays)), ahora, clave, reporte, estado, deps);
    } catch (e) {
      console.error("[contratos] fallaron los recordatorios de una organización", { codigo: codigo(e) });
      reporte.recordatorios.fallidos++;
    }
  }
}

/** Contratos firmados que quedaron sin PDF o sin copia enviada: se completa lo que falte. */
export async function reintentarPdfsPendientes(reporte: ReporteContratos, deps: DepsContratos = {}): Promise<void> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const desde = new Date(ahora.getTime() - DIAS_REINTENTO_PDF * DIA_MS);
  const pendientes = await prisma.fotofficeContrato.findMany({
    where: { status: "FIRMADO", manualSignedAt: null, signedAt: { gte: desde }, OR: [{ pdfKey: null }, { pdfSentAt: null }] },
    orderBy: [{ signedAt: "desc" }],
    take: deps.topePdfs ?? TOPE_PDFS_CORRIDA,
    select: { id: true },
  });
  for (const p of pendientes) {
    reporte.pdfs.revisados++;
    const r = await finalizarContratoFirmado(p.id, deps);
    if (!r.ok) {
      reporte.pdfs.fallidos++;
      continue;
    }
    if (r.pdf === "GENERADO") reporte.pdfs.generados++;
    if (r.envio === "ENVIADO") reporte.pdfs.enviados++;
    else if (r.envio === "PENDIENTE" || r.envio === "ERROR") reporte.pdfs.fallidos++;
  }
}

/** La corrida completa del cron. */
export async function correrContratosDiario(deps: DepsContratos = {}): Promise<ReporteContratos> {
  const reporte: ReporteContratos = {
    organizaciones: 0,
    recordatorios: { enviados: 0, fallidos: 0, salteados: 0, conTopeDiario: 0, topeCorrida: false },
    pdfs: { revisados: 0, generados: 0, enviados: 0, fallidos: 0 },
  };
  try {
    await enviarRecordatoriosDeContratos(reporte, deps);
  } catch (e) {
    console.error("[contratos] fallaron los recordatorios", { codigo: codigo(e) });
  }
  try {
    await reintentarPdfsPendientes(reporte, deps);
  } catch (e) {
    console.error("[contratos] falló el reintento de PDFs", { codigo: codigo(e) });
  }
  return reporte;
}
