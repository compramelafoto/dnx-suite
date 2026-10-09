import "server-only";
import { prisma } from "@repo/db";
import { escapeHtml } from "@/lib/communications/html";
import { sendTransactionalEmail, type OutboundEmail, type SendOutcome } from "@/lib/communications/send-email";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { correoValido } from "@/lib/plantillas/contexto";
import { destinatarioDelPresupuesto } from "@/lib/presupuestos/avisos";
import { subirObjetoContrato } from "./almacen";
import {
  generarCodigo, hashCodigo, puedeEmitirCodigo, validarCodigo,
} from "./codigo";
import { claveFirma } from "./constantes";
import { enviarCorreoContrato, type DatosCorreoContrato, type ResultadoCorreoContrato } from "./correos";
import { resolverClaveDeEnlace, resolverTokenFirmantePorWorkspace, type ResultadoTokenContrato } from "./enlace";
import { registrarEvento } from "./eventos";
import { bytesDeDataUrlPng, revisarPngFirma } from "./png";
import { Corte, bloquearContrato } from "./versiones";

/**
 * Firma en línea (etapa 5): lo que hace el firmante desde su enlace personal, sin sesión.
 *
 * El token es la llave, y CADA paso lo vuelve a resolver (nunca se confía en lo que quedó de un paso
 * anterior): enlace desconocido, de otra organización, de una versión reemplazada, vencido o de un
 * contrato anulado = el mismo mensaje neutral. Los pasos:
 *
 * 1. `solicitarCodigo`: nombre + "leí y acepto"; hasta 3 códigos por hora por firmante; el código se
 *    guarda sólo con hash (atado al firmante) y se manda por correo SIN registrarlo en ningún lado.
 * 2. `verificarCodigo`: 15 minutos, 5 intentos, comparación en tiempo constante (`codigo.ts`).
 * 3. `firmar`: exige código verificado hace menos de 30 minutos y el mismo nombre; valida el PNG; en UNA
 *    transacción con el candado del contrato toma al firmante con un UPDATE condicional (una sola firma
 *    por firmante), sube el PNG a R2 privado, deja la evidencia (IP con sal y navegador) y recalcula el
 *    estado del contrato. Si ya firmaron todos: `FIRMADO`, tilda la tarea del checklist y avisa al
 *    responsable; el PDF (tarea 6) cuelga de `alFirmarContrato`.
 * 4. `rechazar`: "No estoy de acuerdo" con motivo obligatorio; el contrato queda `RECHAZADO`.
 *
 * Los eventos sólo guardan códigos y números (nunca el código de verificación, nombres ni correos).
 */

export const MENSAJES_FIRMA = {
  enlaceInvalido: "Este enlace ya no es válido.",
  yaFirmo: "Ya firmaste este contrato.",
  yaRechazo: "Ya indicaste que no estás de acuerdo con este contrato.",
  noAdmiteFirmas: "Este contrato ya no admite firmas.",
  nombre: "Escribí tu nombre completo (hasta 120 caracteres).",
  acepto: "Tenés que marcar que leíste el contrato y aceptás firmarlo con firma electrónica.",
  topeCodigos: "Ya te mandamos varios códigos. Esperá un rato y pedí uno nuevo.",
  codigoNoSalio: "No pudimos mandarte el código por correo. Probá de nuevo en unos minutos o escribile a quien te envió el contrato.",
  sinCodigo: "Pedí un código para seguir.",
  codigoFormato: "El código tiene 6 números.",
  codigoVencido: "El código venció. Pedí uno nuevo.",
  codigoAgotado: "Ingresaste demasiadas veces un código incorrecto. Pedí uno nuevo.",
  codigoIncorrecto: "El código no es correcto.",
  noVerificado: "Tenés que verificar el código de nuevo antes de firmar.",
  otroNombre: "El nombre tiene que ser el mismo que escribiste al pedir el código.",
  motivo: "Contanos el motivo (hasta 1000 caracteres).",
  carrera: "Alguien más cambió este contrato mientras tanto. Recargá la página.",
  fallo: "No se pudo completar la acción. Probá de nuevo en unos minutos.",
  sinConfigurar: "La firma en línea no está disponible en este momento.",
} as const;

export const MAX_NOMBRE_FIRMA = 120;
export const MAX_MOTIVO_RECHAZO = 1000;
/** Cuánto vale un código verificado para firmar. */
export const MINUTOS_VERIFICACION_VALIDA = 30;
export const TITULO_TAREA_FIRMA = "Recoger firma del contrato";

const ESTADOS_ACTUABLES = ["ENVIADO", "FIRMADO_PARCIAL"] as const;
const no = (error: string) => ({ ok: false as const, error });

export type Evidencia = { ipHash: string | null; userAgent: string | null };

export type DepsFirma = {
  ahora?: () => Date;
  /** Secreto del HMAC del código y de los enlaces. */
  secreto?: string | null;
  enviarCodigo?: (d: DatosCorreoContrato) => Promise<ResultadoCorreoContrato>;
  subir?: (clave: string, bytes: Uint8Array, tipo: string) => Promise<void>;
  enviar?: (m: OutboundEmail) => Promise<SendOutcome>;
  appOrigin?: string;
};

type Resuelto = Extract<ResultadoTokenContrato, { ok: true }>;

/** Normaliza un nombre: espacios colapsados, sin espacios en los bordes. null si no sirve. */
export function nombreDeFirma(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t.length >= 2 && t.length <= MAX_NOMBRE_FIRMA ? t : null;
}

const mismoNombre = (a: string, b: string) => a.normalize("NFC") === b.normalize("NFC");

/** El firmante, para actuar: el enlace tiene que servir y no tiene que haber firmado ni rechazado. */
async function resolverParaActuar(workspaceId: string, token: unknown, ahora: Date): Promise<{ ok: true; r: Resuelto } | { ok: false; error: string }> {
  const r = await resolverTokenFirmantePorWorkspace(workspaceId, token, ahora);
  if (!r.ok) return no(MENSAJES_FIRMA.enlaceInvalido);
  if (r.firmante.signedAt) return no(MENSAJES_FIRMA.yaFirmo);
  if (r.firmante.rejectedAt) return no(MENSAJES_FIRMA.yaRechazo);
  if (!(ESTADOS_ACTUABLES as readonly string[]).includes(r.contrato.status)) return no(MENSAJES_FIRMA.noAdmiteFirmas);
  return { ok: true, r };
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Dentro de la transacción y con el candado del contrato: vuelve a leer al firmante, el contrato y la
 * versión (lo que se leyó antes de abrirla puede estar viejo) y corta si ya no se puede actuar.
 */
async function tomar(tx: Tx, workspaceId: string, r: Resuelto) {
  await bloquearContrato(tx, r.contrato.id);
  const f = await tx.fotofficeContratoFirmante.findFirst({
    where: { id: r.firmante.id, workspaceId, versionId: r.version.id },
    select: {
      id: true, signedAt: true, rejectedAt: true, verifiedAt: true, typedName: true, email: true, name: true,
      codeHash: true, codeExpiresAt: true, codeAttempts: true, codesSentInWindow: true, codeWindowStart: true,
    },
  });
  const c = await tx.fotofficeContrato.findFirst({
    where: { id: r.contrato.id, workspaceId },
    select: { status: true, currentVersionId: true, pedidoId: true, ownerUserId: true, number: true },
  });
  const v = await tx.fotofficeContratoVersion.findFirst({ where: { id: r.version.id, workspaceId, contratoId: r.contrato.id }, select: { revokedAt: true } });
  if (!f || !c || !v || v.revokedAt || c.currentVersionId !== r.version.id) throw new Corte(MENSAJES_FIRMA.enlaceInvalido);
  if (f.signedAt) throw new Corte(MENSAJES_FIRMA.yaFirmo);
  if (f.rejectedAt) throw new Corte(MENSAJES_FIRMA.yaRechazo);
  if (!(ESTADOS_ACTUABLES as readonly string[]).includes(c.status)) throw new Corte(MENSAJES_FIRMA.noAdmiteFirmas);
  return { f, c };
}

function registrarFalla(donde: string, error: unknown): void {
  const e = error as { name?: string; code?: string } | null;
  console.error(`[contratos] ${donde} falló`, { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
}

function secretoDe(deps: DepsFirma): string | null {
  return deps.secreto !== undefined ? deps.secreto : resolverClaveDeEnlace();
}

/** a***@dominio.com: para decirle a la persona adónde fue el código sin mostrar la dirección entera. */
export function correoEnmascarado(correo: string): string {
  const [local = "", dominio = ""] = correo.split("@");
  return `${local.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(6, local.length - 1)))}@${dominio}`;
}

// --- 0. Primera apertura ----------------------------------------------------------------------

/** La primera vez que el firmante abre su enlace: guarda `viewedAt` y deja el evento VISTO. Nunca lanza. */
export async function registrarVista(workspaceId: string, r: Resuelto, ahora: Date = new Date()): Promise<void> {
  if (r.firmante.viewedAt || r.firmante.signedAt) return;
  try {
    await prisma.$transaction(async (tx) => {
      const n = await tx.fotofficeContratoFirmante.updateMany({ where: { id: r.firmante.id, workspaceId, viewedAt: null }, data: { viewedAt: ahora } });
      if (n.count === 1) await registrarEvento(tx, { workspaceId, contratoId: r.contrato.id, tipo: "VISTO", firmanteId: r.firmante.id, data: { orden: r.firmante.orden } });
    });
  } catch (e) {
    registrarFalla("registrarVista", e);
  }
}

// --- 1. Pedir el código -----------------------------------------------------------------------

export type ResultadoPedirCodigo = { ok: true; correo: string; venceEnMinutos: number } | { ok: false; error: string };

export async function solicitarCodigo(
  workspaceId: string,
  token: unknown,
  datos: { nombre: unknown; acepto: unknown },
  deps: DepsFirma = {},
): Promise<ResultadoPedirCodigo> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const nombre = nombreDeFirma(datos?.nombre);
  if (!nombre) return no(MENSAJES_FIRMA.nombre);
  if (datos.acepto !== true) return no(MENSAJES_FIRMA.acepto);
  const secreto = secretoDe(deps);
  if (!secreto) return no(MENSAJES_FIRMA.sinConfigurar);
  const previo = await resolverParaActuar(workspaceId, token, ahora);
  if (!previo.ok) return previo;
  const { r } = previo;

  let emitido: { codigo: string; email: string; nombreFirmante: string; numero: string };
  try {
    emitido = await prisma.$transaction(async (tx) => {
      const { f, c } = await tomar(tx, workspaceId, r);
      const emision = puedeEmitirCodigo(f, ahora);
      if (!emision.ok) throw new Corte(MENSAJES_FIRMA.topeCodigos);
      const codigo = generarCodigo();
      const s = emision.siguiente;
      const n = await tx.fotofficeContratoFirmante.updateMany({
        where: { id: f.id, workspaceId, signedAt: null, rejectedAt: null },
        data: {
          codeHash: hashCodigo(codigo, secreto, f.id),
          codeExpiresAt: s.codeExpiresAt,
          codeAttempts: s.codeAttempts,
          codesSentInWindow: s.codesSentInWindow,
          codeWindowStart: s.codeWindowStart,
          // Un código nuevo anula la verificación anterior; el nombre queda para compararlo al firmar.
          verifiedAt: null,
          typedName: nombre,
        },
      });
      if (n.count !== 1) throw new Corte(MENSAJES_FIRMA.carrera);
      await registrarEvento(tx, {
        workspaceId, contratoId: r.contrato.id, tipo: "CODIGO_ENVIADO", firmanteId: f.id,
        data: { nroEnLaHora: s.codesSentInWindow, aceptoClausula: true },
      });
      return { codigo, email: f.email, nombreFirmante: f.name, numero: c.number };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return no(e.mensaje);
    registrarFalla("solicitarCodigo", e);
    return no(MENSAJES_FIRMA.fallo);
  }

  // El correo sale después de confirmar; el código viaja sólo hacia acá y no se guarda en ningún otro lado.
  const enviarCodigo = deps.enviarCodigo ?? ((d) => enviarCorreoContrato(d, deps.enviar ? { enviar: deps.enviar } : {}));
  const salida = await enviarCodigo({
    workspaceId, clave: "CONTRATO_CODIGO", contratoId: r.contrato.id, para: emitido.email,
    nombre: emitido.nombreFirmante, numero: emitido.numero, codigo: emitido.codigo,
  });
  if (salida !== "ENVIADO") return no(MENSAJES_FIRMA.codigoNoSalio);
  return { ok: true, correo: correoEnmascarado(emitido.email), venceEnMinutos: 15 };
}

// --- 2. Verificar el código -------------------------------------------------------------------

export type ResultadoVerificar = { ok: true } | { ok: false; error: string; intentosRestantes?: number };

export async function verificarCodigo(workspaceId: string, token: unknown, codigo: unknown, deps: DepsFirma = {}): Promise<ResultadoVerificar> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const secreto = secretoDe(deps);
  if (!secreto) return no(MENSAJES_FIRMA.sinConfigurar);
  const previo = await resolverParaActuar(workspaceId, token, ahora);
  if (!previo.ok) return previo;
  const { r } = previo;
  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoVerificar> => {
      const { f } = await tomar(tx, workspaceId, r);
      const v = validarCodigo(codigo, f, secreto, ahora, f.id);
      if (v.ok) {
        const n = await tx.fotofficeContratoFirmante.updateMany({
          where: { id: f.id, workspaceId, signedAt: null, rejectedAt: null, codeHash: f.codeHash },
          // El código se gasta: no sirve dos veces.
          data: { codeHash: null, codeExpiresAt: null, verifiedAt: ahora },
        });
        if (n.count !== 1) throw new Corte(MENSAJES_FIRMA.carrera);
        await registrarEvento(tx, { workspaceId, contratoId: r.contrato.id, tipo: "CODIGO_VERIFICADO", firmanteId: f.id });
        return { ok: true };
      }
      if (v.motivo === "INCORRECTO") {
        // Esto SÍ se guarda (consume un intento) y por eso no corta la transacción.
        await tx.fotofficeContratoFirmante.updateMany({ where: { id: f.id, workspaceId, signedAt: null }, data: { codeAttempts: v.codeAttempts } });
        await registrarEvento(tx, { workspaceId, contratoId: r.contrato.id, tipo: "CODIGO_FALLIDO", firmanteId: f.id, data: { intento: v.codeAttempts } });
        return { ok: false, error: v.intentosRestantes > 0 ? MENSAJES_FIRMA.codigoIncorrecto : MENSAJES_FIRMA.codigoAgotado, intentosRestantes: v.intentosRestantes };
      }
      const mensaje =
        v.motivo === "VENCIDO" ? MENSAJES_FIRMA.codigoVencido
        : v.motivo === "AGOTADO" ? MENSAJES_FIRMA.codigoAgotado
        : v.motivo === "FORMATO" ? MENSAJES_FIRMA.codigoFormato
        : MENSAJES_FIRMA.sinCodigo;
      return no(mensaje);
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return no(e.mensaje);
    registrarFalla("verificarCodigo", e);
    return no(MENSAJES_FIRMA.fallo);
  }
}

// --- 3. Firmar --------------------------------------------------------------------------------

export type ResultadoFirmar = { ok: true; completo: boolean; contratoId: string } | { ok: false; error: string };

export async function firmar(
  workspaceId: string,
  token: unknown,
  datos: { nombre: unknown; png: unknown },
  evidencia: Evidencia,
  deps: DepsFirma = {},
): Promise<ResultadoFirmar> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const nombre = nombreDeFirma(datos?.nombre);
  if (!nombre) return no(MENSAJES_FIRMA.nombre);
  const bytes = bytesDeDataUrlPng(datos.png);
  if (!bytes) return no("La firma no es válida. Dibujala de nuevo.");
  const png = revisarPngFirma(bytes);
  if (!png.ok) return no(png.error);
  const previo = await resolverParaActuar(workspaceId, token, ahora);
  if (!previo.ok) return previo;
  const { r } = previo;
  const subir = deps.subir ?? subirObjetoContrato;

  let hecho: { completo: boolean; pedidoId: string; ownerUserId: number | null; numero: string };
  try {
    hecho = await prisma.$transaction(async (tx) => {
      const { f, c } = await tomar(tx, workspaceId, r);
      if (!f.verifiedAt || ahora.getTime() - f.verifiedAt.getTime() > MINUTOS_VERIFICACION_VALIDA * 60_000 || f.verifiedAt.getTime() > ahora.getTime()) {
        throw new Corte(MENSAJES_FIRMA.noVerificado);
      }
      if (!f.typedName || !mismoNombre(nombre, f.typedName)) throw new Corte(MENSAJES_FIRMA.otroNombre);
      const clave = claveFirma(workspaceId, r.contrato.id, f.id);
      // Primero se toma al firmante (UPDATE condicional: gana uno solo); recién después se sube el PNG, así
      // un segundo intento nunca pisa la imagen del primero.
      const n = await tx.fotofficeContratoFirmante.updateMany({
        where: { id: f.id, workspaceId, signedAt: null, rejectedAt: null, verifiedAt: f.verifiedAt },
        data: {
          typedName: nombre, signatureKey: clave, signedAt: ahora, ipHash: evidencia.ipHash, userAgent: evidencia.userAgent,
          codeHash: null, codeExpiresAt: null,
        },
      });
      if (n.count !== 1) throw new Corte(MENSAJES_FIRMA.yaFirmo);
      // Si la subida falla se deshace todo: no queda una firma registrada sin imagen.
      await subir(clave, bytes, "image/png");
      await registrarEvento(tx, { workspaceId, contratoId: r.contrato.id, tipo: "FIRMADO", firmanteId: f.id, data: { orden: r.firmante.orden } });
      // Recalcular el estado: ¿falta alguien de esta versión?
      const faltan = await tx.fotofficeContratoFirmante.count({ where: { workspaceId, versionId: r.version.id, signedAt: null } });
      const completo = faltan === 0;
      const e = await tx.fotofficeContrato.updateMany({
        where: { id: r.contrato.id, workspaceId, currentVersionId: r.version.id, status: { in: [...ESTADOS_ACTUABLES] } },
        data: completo ? { status: "FIRMADO", signedAt: ahora } : { status: "FIRMADO_PARCIAL" },
      });
      if (e.count !== 1) throw new Corte(MENSAJES_FIRMA.carrera);
      return { completo, pedidoId: c.pedidoId, ownerUserId: c.ownerUserId, numero: c.number };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return no(e.mensaje);
    registrarFalla("firmar", e);
    return no(MENSAJES_FIRMA.fallo);
  }

  // Lo que sigue nunca deshace la firma.
  if (hecho.completo) {
    await tildarTareaDeFirma(workspaceId, hecho.pedidoId, ahora);
    await avisarAlResponsable(
      { workspaceId, contratoId: r.contrato.id, ownerUserId: hecho.ownerUserId, asunto: `El contrato ${hecho.numero} quedó firmado`, lineas: [`El contrato ${hecho.numero} ya está firmado por todas las partes.`, "Se está generando el PDF con las firmas."] },
      deps,
    );
  }
  return { ok: true, completo: hecho.completo, contratoId: r.contrato.id };
}

/**
 * Gancho para la tarea 6 (PDF con las firmas y envío de la copia): se llama con `after()` cuando el
 * contrato queda firmado por todos. Hoy no hace nada.
 */
export async function alFirmarContrato(_contratoId: string): Promise<void> {
  return;
}

/** Tilda la tarea "Recoger firma del contrato" (sin importar mayúsculas) del checklist del pedido, si existe. Nunca lanza. */
export async function tildarTareaDeFirma(workspaceId: string, pedidoId: string, ahora: Date): Promise<number> {
  try {
    const tareas = await prisma.fotofficePedidoTarea.findMany({ where: { workspaceId, pedidoId, doneAt: null }, select: { id: true, title: true } });
    const ids = tareas.filter((t) => t.title.trim().toLowerCase() === TITULO_TAREA_FIRMA.toLowerCase()).map((t) => t.id);
    if (ids.length === 0) return 0;
    const r = await prisma.fotofficePedidoTarea.updateMany({ where: { workspaceId, pedidoId, id: { in: ids }, doneAt: null }, data: { doneAt: ahora } });
    return r.count;
  } catch (e) {
    registrarFalla("tildarTareaDeFirma", e);
    return 0;
  }
}

/** Correo interno al responsable del contrato (o al dueño). Nunca lanza ni loguea datos personales. */
export async function avisarAlResponsable(
  a: { workspaceId: string; contratoId: string; ownerUserId: number | null; asunto: string; lineas: string[] },
  deps: Pick<DepsFirma, "enviar" | "appOrigin"> = {},
): Promise<"ENVIADO" | "NO_ENVIADO" | "SIN_DESTINATARIO" | "SIN_CORREO" | "ERROR"> {
  try {
    const para = await destinatarioDelPresupuesto(a.workspaceId, a.ownerUserId);
    if (para === null) return "SIN_DESTINATARIO";
    const usuario = await prisma.user.findUnique({ where: { id: para }, select: { email: true } });
    if (!correoValido(usuario?.email)) return "SIN_CORREO";
    const origen = (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
    const enlace = origen ? `${origen}/contratos/${encodeURIComponent(a.contratoId)}` : null;
    const lineas = ["Hola:", "", ...a.lineas, ...(enlace ? ["", enlace] : [])];
    const html = lineas.map((l) => (l === "" ? "<br>" : l === enlace ? `<p><a href="${escapeHtml(l)}">Ver el contrato</a></p>` : `<p>${escapeHtml(l)}</p>`)).join("");
    const enviar = deps.enviar ?? ((m: OutboundEmail) => sendTransactionalEmail(m));
    const r = await enviar({ to: usuario!.email!, subject: a.asunto, html, text: lineas.join("\n") });
    return r.status === "SENT" ? "ENVIADO" : "NO_ENVIADO";
  } catch (e) {
    registrarFalla("avisarAlResponsable", e);
    return "ERROR";
  }
}

// --- 4. No estoy de acuerdo -------------------------------------------------------------------

export type ResultadoRechazar = { ok: true } | { ok: false; error: string };

export function motivoDeRechazo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\r\n/g, "\n").trim();
  return t.length >= 1 && t.length <= MAX_MOTIVO_RECHAZO ? t : null;
}

export async function rechazar(workspaceId: string, token: unknown, motivo: unknown, evidencia: Evidencia, deps: DepsFirma = {}): Promise<ResultadoRechazar> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const texto = motivoDeRechazo(motivo);
  if (!texto) return no(MENSAJES_FIRMA.motivo);
  const previo = await resolverParaActuar(workspaceId, token, ahora);
  if (!previo.ok) return previo;
  const { r } = previo;
  let hecho: { ownerUserId: number | null; numero: string };
  try {
    hecho = await prisma.$transaction(async (tx) => {
      const { f, c } = await tomar(tx, workspaceId, r);
      const n = await tx.fotofficeContratoFirmante.updateMany({
        where: { id: f.id, workspaceId, signedAt: null, rejectedAt: null },
        data: { rejectedAt: ahora, rejectReason: texto, ipHash: evidencia.ipHash, userAgent: evidencia.userAgent, codeHash: null, codeExpiresAt: null },
      });
      if (n.count !== 1) throw new Corte(MENSAJES_FIRMA.carrera);
      const e = await tx.fotofficeContrato.updateMany({
        where: { id: r.contrato.id, workspaceId, currentVersionId: r.version.id, status: { in: [...ESTADOS_ACTUABLES] } },
        data: { status: "RECHAZADO", rejectedAt: ahora },
      });
      if (e.count !== 1) throw new Corte(MENSAJES_FIRMA.carrera);
      // El motivo queda en el firmante; en la bitácora sólo el hecho.
      await registrarEvento(tx, { workspaceId, contratoId: r.contrato.id, tipo: "RECHAZADO", firmanteId: f.id, data: { orden: r.firmante.orden } });
      return { ownerUserId: c.ownerUserId, numero: c.number };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return no(e.mensaje);
    registrarFalla("rechazar", e);
    return no(MENSAJES_FIRMA.fallo);
  }
  await avisarAlResponsable(
    { workspaceId, contratoId: r.contrato.id, ownerUserId: hecho.ownerUserId, asunto: `Un firmante no está de acuerdo con el contrato ${hecho.numero}`, lineas: [`Una de las personas que tenían que firmar el contrato ${hecho.numero} indicó que no está de acuerdo.`, "Mirá el motivo en la ficha del contrato."] },
    deps,
  );
  return { ok: true };
}
