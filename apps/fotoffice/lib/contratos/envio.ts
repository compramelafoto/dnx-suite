import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { MENSAJES_CONTRATO as M, puedeGestionarContratos, type CtxContratos } from "./acceso";
import { leerAjustesContratos } from "./ajustes";
import { enviarCorreoContrato } from "./correos";
import { resolverContratantes } from "./contratantes";
import { registrarEvento } from "./eventos";
import { hashDeToken, resolverClaveDeEnlace, tokenDeFirmante, urlDelContrato } from "./enlace";
import { Corte, armarFirmantes, bloquearContrato, contratantesSinCorreo, huellaTexto, revisarTextoFinal, vencimientoDeEnlace } from "./versiones";
import type { DepsEnvio } from "@/lib/plantillas/envio";

/**
 * Enviar un contrato a firmar, corregirlo (versión nueva) y reenviar el enlace de un firmante.
 *
 * ENVIAR (BORRADOR) o CORREGIR (ENVIADO o FIRMADO_PARCIAL, con el texto corregido): en UNA transacción,
 * con el candado del contrato, se crea la versión N+1 con el texto final y su huella SHA-256, se crean los
 * firmantes (uno por contratante, con nombre, documento y correo congelados, su token y su vencimiento), se
 * revoca la versión anterior (`revokedAt`: los enlaces de sus firmantes dejan de servir y las firmas que
 * tuviera quedan en esa versión) y el contrato queda ENVIADO con `currentVersionId` en la nueva. El
 * contrato se toma con un UPDATE condicional por estado y versión vigente: de dos envíos simultáneos gana
 * uno solo (el otro recibe "otra persona cambió este contrato"), y el índice único (contrato, número de
 * versión) es la red de seguridad.
 *
 * Los correos NO salen acá: `enviarCorreosDeVersion` los manda y lo llama la acción con `after()`, así que
 * una falla del proveedor nunca deshace el envío. El token no se guarda: se vuelve a calcular con el id del
 * firmante y su vencimiento.
 */

export type ResultadoEnviar =
  | { ok: true; versionId: string; version: number; correccion: boolean; firmantes: { id: string; orden: number }[] }
  | { ok: false; error: string };

const no = (error: string) => ({ ok: false as const, error });

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function origenDeLaApp(deps: { appOrigin?: string }): string {
  return (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
}

export type DepsEnviar = { ahora?: () => Date; clave?: string | null; appOrigin?: string };

export async function enviar(
  ctx: CtxContratos,
  contratoId: unknown,
  opciones: { textoCorregido?: unknown } = {},
  deps: DepsEnviar = {},
): Promise<ResultadoEnviar> {
  if (!puedeGestionarContratos(ctx)) return no(M.sinPermiso);
  if (!idValido(contratoId)) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  const ahora = (deps.ahora ?? (() => new Date()))();

  const c = await prisma.fotofficeContrato.findFirst({
    where: { id: contratoId, workspaceId },
    select: { id: true, status: true, pedidoId: true, bodyText: true },
  });
  if (!c) return no(M.contratoNoExiste);

  let crudo: string;
  if (c.status === "BORRADOR") {
    crudo = c.bodyText;
  } else if (c.status === "ENVIADO" || c.status === "FIRMADO_PARCIAL") {
    if (typeof opciones.textoCorregido !== "string") return no(M.faltaTextoCorregido);
    crudo = opciones.textoCorregido;
  } else {
    return no(M.noSeEnvia);
  }
  const revision = revisarTextoFinal(crudo);
  if (!revision.ok) return no(revision.error);

  const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
  if (!clave) return no(M.sinClaveEnlace);
  const sitio = await sitioDelWorkspace(workspaceId);
  if (!sitio || !urlDelContrato({ ...sitio, appOrigin: origenDeLaApp(deps), token: "x" })) return no(M.sinSitio);

  const ajustes = await leerAjustesContratos(workspaceId);
  if (!ajustes.companyName || !ajustes.companyName.trim()) return no(M.sinEmpresa);

  const contratantes = await resolverContratantes(workspaceId, c.pedidoId);
  if (!contratantes || contratantes.length === 0) return no(M.pedido);
  const sinCorreo = contratantesSinCorreo(contratantes);
  if (sinCorreo.length) return no(`${M.contratanteSinCorreo} ${sinCorreo.map((x) => x.nombre).join(", ")}.`);

  try {
    return await prisma.$transaction(async (tx) => {
      await bloquearContrato(tx, contratoId);
      const actual = await tx.fotofficeContrato.findFirst({
        where: { id: contratoId, workspaceId },
        select: { id: true, status: true, currentVersionId: true },
      });
      if (!actual) throw new Corte(M.contratoNoExiste);
      if (actual.status !== c.status) throw new Corte(c.status === "BORRADOR" ? M.yaEnviado : M.carrera);

      const versiones = await tx.fotofficeContratoVersion.findMany({ where: { contratoId, workspaceId }, select: { id: true, number: true, bodyText: true } });
      // Corregir con el mismo texto de la versión vigente no cambia nada (y es lo que pasa con un doble clic).
      const vigente = versiones.find((v) => v.id === actual.currentVersionId);
      if (vigente && vigente.bodyText === revision.texto) throw new Corte(M.sinCambios);
      const numero = versiones.reduce((m, v) => Math.max(m, v.number), 0) + 1;
      const versionId = randomUUID();
      await tx.fotofficeContratoVersion.create({
        data: { id: versionId, workspaceId, contratoId, number: numero, bodyText: revision.texto, contentHash: huellaTexto(revision.texto), sentAt: ahora },
        select: { id: true },
      });
      const firmantes = armarFirmantes(contratantes, clave, ahora);
      for (const f of firmantes) {
        await tx.fotofficeContratoFirmante.create({
          data: {
            id: f.id, workspaceId, versionId, orden: f.orden, clientId: f.clientId, name: f.name, docNumber: f.docNumber,
            email: f.email, tokenHash: f.tokenHash, tokenExpiresAt: f.tokenExpiresAt,
          },
          select: { id: true },
        });
      }
      const anterior = actual.currentVersionId;
      if (anterior) {
        await tx.fotofficeContratoVersion.updateMany({ where: { id: anterior, workspaceId, revokedAt: null }, data: { revokedAt: ahora } });
      }
      // Toma el contrato sólo si sigue como lo leímos: es lo que decide una carrera.
      const r = await tx.fotofficeContrato.updateMany({
        where: { id: contratoId, workspaceId, status: actual.status, currentVersionId: anterior },
        data: { status: "ENVIADO", currentVersionId: versionId, bodyText: revision.texto, sentAt: ahora },
      });
      if (r.count !== 1) throw new Corte(M.carrera);
      const correccion = anterior !== null;
      if (anterior) {
        await registrarEvento(tx, { workspaceId, contratoId, tipo: "VERSION_REVOCADA", actorUserId: ctx.userId, data: { version: numero - 1 } });
      }
      await registrarEvento(tx, {
        workspaceId, contratoId, tipo: "ENVIADO", actorUserId: ctx.userId,
        data: { version: numero, firmantes: firmantes.length, correccion },
      });
      return { ok: true as const, versionId, version: numero, correccion, firmantes: firmantes.map((f) => ({ id: f.id, orden: f.orden })) };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return no(e.mensaje);
    // Dos envíos a la vez que llegaron al índice único (contrato, versión): ganó el otro.
    if ((e as { code?: unknown } | null)?.code === "P2002") return no(M.carrera);
    console.error("[contratos] enviar falló", { codigo: typeof (e as { code?: unknown } | null)?.code === "string" ? (e as { code: string }).code : null });
    return no(M.guardar);
  }
}

// --- Correos del envío -----------------------------------------------------------------------------

export type DepsCorreosVersion = DepsEnvio & { clave?: string | null; appOrigin?: string };

/**
 * Manda `CONTRATO_ENVIO` a cada firmante de una versión que siga vigente. Nunca lanza (se llama con
 * `after()`). Devuelve cuántos correos salieron.
 */
export async function enviarCorreosDeVersion(
  workspaceId: string,
  contratoId: string,
  versionId: string,
  deps: DepsCorreosVersion = {},
): Promise<number> {
  try {
    const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
    if (!clave) return 0;
    const [sitio, contrato, version] = await Promise.all([
      sitioDelWorkspace(workspaceId),
      prisma.fotofficeContrato.findFirst({ where: { id: contratoId, workspaceId }, select: { number: true, currentVersionId: true, status: true } }),
      prisma.fotofficeContratoVersion.findFirst({ where: { id: versionId, workspaceId, contratoId }, select: { revokedAt: true } }),
    ]);
    if (!sitio || !contrato || !version || version.revokedAt || contrato.currentVersionId !== versionId || contrato.status === "ANULADO") return 0;
    const firmantes = await prisma.fotofficeContratoFirmante.findMany({
      where: { workspaceId, versionId, signedAt: null, rejectedAt: null },
      orderBy: [{ orden: "asc" }],
      select: { id: true, name: true, email: true, tokenExpiresAt: true },
    });
    let enviados = 0;
    for (const f of firmantes) {
      const enlace = urlDelContrato({ ...sitio, appOrigin: origenDeLaApp(deps), token: tokenDeFirmante(f.id, f.tokenExpiresAt, clave) });
      const r = await enviarCorreoContrato(
        { workspaceId, clave: "CONTRATO_ENVIO", contratoId, para: f.email, nombre: f.name, numero: contrato.number, enlace },
        deps,
      );
      if (r === "ENVIADO") enviados++;
    }
    return enviados;
  } catch (e) {
    console.error("[contratos] fallaron los correos del envío", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    return 0;
  }
}

// --- Reenviar el enlace de un firmante --------------------------------------------------------------

export type ResultadoReenviar = { ok: true; firmanteId: string; contratoId: string } | { ok: false; error: string };

/**
 * Cambia el enlace de un firmante (el anterior deja de servir) y le da 30 días nuevos. Sólo para un firmante
 * que no firmó ni rechazó, de la versión vigente de un contrato ENVIADO o FIRMADO_PARCIAL. El correo lo
 * manda `enviarCorreoAlFirmante` (la acción lo llama con `after()`).
 */
export async function reenviarEnlace(ctx: CtxContratos, firmanteId: unknown, deps: DepsEnviar = {}): Promise<ResultadoReenviar> {
  if (!puedeGestionarContratos(ctx)) return no(M.sinPermiso);
  if (!idValido(firmanteId)) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  const ahora = (deps.ahora ?? (() => new Date()))();
  const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
  if (!clave) return no(M.sinClaveEnlace);
  const f = await prisma.fotofficeContratoFirmante.findFirst({
    where: { id: firmanteId, workspaceId },
    select: { id: true, versionId: true },
  });
  if (!f) return no(M.firmanteNoExiste);
  const v = await prisma.fotofficeContratoVersion.findFirst({ where: { id: f.versionId, workspaceId }, select: { contratoId: true } });
  if (!v) return no(M.firmanteNoExiste);
  const contratoId = v.contratoId;
  try {
    return await prisma.$transaction(async (tx) => {
      await bloquearContrato(tx, contratoId);
      const [firmante, version, contrato] = await Promise.all([
        tx.fotofficeContratoFirmante.findFirst({
          where: { id: firmanteId, workspaceId },
          select: { id: true, versionId: true, tokenHash: true, tokenExpiresAt: true, signedAt: true, rejectedAt: true },
        }),
        tx.fotofficeContratoVersion.findFirst({ where: { id: f.versionId, workspaceId }, select: { id: true, revokedAt: true } }),
        tx.fotofficeContrato.findFirst({ where: { id: contratoId, workspaceId }, select: { id: true, status: true, currentVersionId: true } }),
      ]);
      if (!firmante || !version || !contrato) throw new Corte(M.firmanteNoExiste);
      if (
        firmante.signedAt || firmante.rejectedAt || version.revokedAt || contrato.currentVersionId !== version.id ||
        (contrato.status !== "ENVIADO" && contrato.status !== "FIRMADO_PARCIAL")
      ) {
        throw new Corte(M.noSeReenvia);
      }
      let vence = vencimientoDeEnlace(ahora);
      // El token depende del vencimiento: tiene que ser distinto del anterior.
      if (vence.getTime() <= firmante.tokenExpiresAt.getTime()) vence = new Date(firmante.tokenExpiresAt.getTime() + 1);
      const r = await tx.fotofficeContratoFirmante.updateMany({
        where: { id: firmanteId, workspaceId, tokenHash: firmante.tokenHash, signedAt: null, rejectedAt: null },
        data: { tokenHash: hashDeToken(tokenDeFirmante(firmanteId, vence, clave)), tokenExpiresAt: vence },
      });
      if (r.count !== 1) throw new Corte(M.carrera);
      await registrarEvento(tx, { workspaceId, contratoId, tipo: "REENVIADO", actorUserId: ctx.userId, firmanteId });
      return { ok: true as const, firmanteId, contratoId };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return no(e.mensaje);
    console.error("[contratos] reenviar falló", { codigo: typeof (e as { code?: unknown } | null)?.code === "string" ? (e as { code: string }).code : null });
    return no(M.guardar);
  }
}

/** Manda `CONTRATO_ENVIO` a un solo firmante con su enlace vigente. Nunca lanza (se llama con `after()`). */
export async function enviarCorreoAlFirmante(workspaceId: string, firmanteId: string, deps: DepsCorreosVersion = {}): Promise<boolean> {
  try {
    const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
    if (!clave) return false;
    const f = await prisma.fotofficeContratoFirmante.findFirst({
      where: { id: firmanteId, workspaceId, signedAt: null, rejectedAt: null },
      select: { id: true, versionId: true, name: true, email: true, tokenExpiresAt: true },
    });
    if (!f) return false;
    const version = await prisma.fotofficeContratoVersion.findFirst({ where: { id: f.versionId, workspaceId }, select: { contratoId: true, revokedAt: true } });
    if (!version || version.revokedAt) return false;
    const [sitio, contrato] = await Promise.all([
      sitioDelWorkspace(workspaceId),
      prisma.fotofficeContrato.findFirst({ where: { id: version.contratoId, workspaceId }, select: { number: true, currentVersionId: true, status: true } }),
    ]);
    if (!sitio || !contrato || contrato.currentVersionId !== f.versionId || contrato.status === "ANULADO") return false;
    const enlace = urlDelContrato({ ...sitio, appOrigin: origenDeLaApp(deps), token: tokenDeFirmante(f.id, f.tokenExpiresAt, clave) });
    const r = await enviarCorreoContrato(
      { workspaceId, clave: "CONTRATO_ENVIO", contratoId: version.contratoId, para: f.email, nombre: f.name, numero: contrato.number, enlace },
      deps,
    );
    return r === "ENVIADO";
  } catch (e) {
    console.error("[contratos] falló el correo al firmante", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    return false;
  }
}
