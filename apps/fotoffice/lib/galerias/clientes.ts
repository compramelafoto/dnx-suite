import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { MENSAJES_GALERIA as M, puedeGestionarGalerias, puedeVerGalerias, type CtxGalerias } from "./acceso";
import {
  correoDeGaleria, enlaceWhatsappGaleria, nombreDeClienteDeGaleria, telefonoDeGaleria, textoWhatsappGaleria,
} from "./compartir";
import { MAX_CLIENTES_POR_GALERIA, type EstadoCliente } from "./constantes";
import { hashDeToken, resolverClaveDeEnlace, tokenDeGaleriaCliente, urlDeGaleria } from "./enlace";
import { registrarEvento } from "./eventos";

/**
 * Clientes de una galería (quienes reciben un enlace personal y eligen). Cada uno tiene su token
 * (re-derivable, ver `enlace.ts`), su estado y su selección. Escribir exige Gestionar; leer, Ver.
 * Toda consulta lleva `workspaceId`, y el cliente tiene que ser de una galería de ese workspace.
 */

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const idValido = (v: unknown): v is string => typeof v === "string" && ID_VALIDO.test(v);
const no = (error: string) => ({ ok: false as const, error });

export type ResultadoCliente = { ok: true; id: string } | { ok: false; error: string };
export type ResultadoSimpleCliente = { ok: true } | { ok: false; error: string };

export type DepsClientes = { ahora?: () => Date; clave?: string | null; appOrigin?: string };

function origenDeLaApp(deps: { appOrigin?: string }): string {
  return (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
}

// --- Alta ----------------------------------------------------------------------------------------

/**
 * Agrega un cliente a la galería: un contacto del padrón (`clientId`) o un alta rápida (nombre y
 * correo o teléfono). Máximo 30 por galería; un mismo contacto no entra dos veces. Le arma su
 * enlace (el token no se guarda: sólo su hash).
 */
export async function agregarClienteGaleria(
  ctx: CtxGalerias,
  galeriaId: unknown,
  datos: unknown,
  deps: DepsClientes = {},
): Promise<ResultadoCliente> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaId) || !datos || typeof datos !== "object") return no(M.datosInvalidos);
  const d = datos as Record<string, unknown>;
  const { workspaceId } = ctx;
  const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
  if (!clave) return no(M.sinClaveEnlace);

  let clientId: string | null = null;
  let nombre: string | null;
  let email: string | null | undefined;
  let telefono: string | null | undefined;
  if (d.clientId !== undefined && d.clientId !== null) {
    if (!idValido(d.clientId)) return no(M.datosInvalidos);
    const c = await prisma.client.findFirst({
      where: { id: d.clientId, workspaceId },
      select: { id: true, firstName: true, lastName: true, businessName: true, email: true, phone: true },
    });
    if (!c) return no(M.contacto);
    clientId = c.id;
    nombre = nombreDeClienteDeGaleria(nombreDeContacto(c));
    email = correoDeGaleria(c.email) ?? null;
    telefono = telefonoDeGaleria(c.phone) ?? null;
  } else {
    nombre = nombreDeClienteDeGaleria(d.nombre);
    email = correoDeGaleria(d.email);
    telefono = telefonoDeGaleria(d.telefono);
    if (email === undefined) return no(M.correoInvalido);
    if (telefono === undefined) return no(M.telefonoInvalido);
    if (nombre && !email && !telefono) return no(M.sinDatosDeContacto);
  }
  if (!nombre) return no(M.nombreCliente);

  const galeria = await prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId }, select: { id: true } });
  if (!galeria) return no(M.noExiste);
  const ahora = (deps.ahora ?? (() => new Date()))();
  const id = randomUUID();
  const token = tokenDeGaleriaCliente(id, ahora, clave);
  try {
    return await prisma.$transaction(async (tx) => {
      const cantidad = await tx.fotofficeGaleriaCliente.count({ where: { galeriaId, workspaceId } });
      if (cantidad >= MAX_CLIENTES_POR_GALERIA) return no(M.topeClientes);
      if (clientId) {
        const repetido = await tx.fotofficeGaleriaCliente.findFirst({ where: { galeriaId, workspaceId, clientId }, select: { id: true } });
        if (repetido) return no(M.contactoRepetido);
      }
      await tx.fotofficeGaleriaCliente.create({
        data: {
          id, workspaceId, galeriaId, clientId, name: nombre, email: email ?? null, phone: telefono ?? null,
          tokenHash: hashDeToken(token), tokenIssuedAt: ahora, status: "EN_PROGRESO",
        },
        select: { id: true },
      });
      await registrarEvento(tx, { workspaceId, galeriaId, galeriaClienteId: id, tipo: "CLIENTE_AGREGADO", actorUserId: ctx.userId, data: { contacto: clientId !== null } });
      return { ok: true as const, id };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === "P2002") return no(M.contactoRepetido);
    console.error("[galerias] agregar cliente falló", { codigo: typeof (e as { code?: unknown } | null)?.code === "string" ? (e as { code: string }).code : null });
    return no(M.guardar);
  }
}

// --- Lectura -------------------------------------------------------------------------------------

export type ClienteDeGaleria = {
  id: string;
  clientId: string | null;
  nombre: string;
  email: string | null;
  telefono: string | null;
  estado: EstadoCliente;
  anulado: boolean;
  elegidas: number;
  primeraVez: Date | null;
  ultimaVez: Date | null;
  enviadoEn: Date | null;
  finalizadoEn: Date | null;
  creadoEn: Date;
};

const ESTADOS: readonly EstadoCliente[] = ["EN_PROGRESO", "EN_REVISION", "FINALIZADO"];

/** Los clientes de una galería (nunca el token ni su hash). Vacío si no hay "Ver" o la galería es de otro workspace. */
export async function listarClientesDeGaleria(ctx: CtxGalerias, galeriaId: unknown): Promise<ClienteDeGaleria[]> {
  if (!puedeVerGalerias(ctx) || !idValido(galeriaId)) return [];
  const filas = await prisma.fotofficeGaleriaCliente.findMany({
    where: { galeriaId, workspaceId: ctx.workspaceId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MAX_CLIENTES_POR_GALERIA,
    select: {
      id: true, clientId: true, name: true, email: true, phone: true, status: true, revokedAt: true, firstSeenAt: true,
      lastSeenAt: true, submittedAt: true, finalizedAt: true, createdAt: true,
      _count: { select: { selecciones: true } },
    },
  });
  return filas.map((f) => ({
    id: f.id, clientId: f.clientId, nombre: f.name, email: f.email, telefono: f.phone,
    estado: (ESTADOS as readonly string[]).includes(f.status) ? (f.status as EstadoCliente) : "EN_PROGRESO",
    anulado: f.revokedAt !== null, elegidas: f._count.selecciones, primeraVez: f.firstSeenAt, ultimaVez: f.lastSeenAt,
    enviadoEn: f.submittedAt, finalizadoEn: f.finalizedAt, creadoEn: f.createdAt,
  }));
}

// --- Enlace -------------------------------------------------------------------------------------------

type Compartible = {
  url: string;
  clienteId: string;
  galeriaId: string;
  galeriaNumero: string;
  galeriaNombre: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  organizacion: string | null;
};

/**
 * Todo lo necesario para compartir el enlace de un cliente: la galería tiene que estar PUBLICADA y
 * el enlace sin anular. El token se vuelve a calcular en el servidor y se comprueba contra el hash
 * guardado (si no coincide, el enlace no es el vigente y no se entrega).
 */
async function cargarCompartible(
  ctx: CtxGalerias,
  galeriaClienteId: unknown,
  deps: DepsClientes,
): Promise<{ ok: true; datos: Compartible } | { ok: false; error: string }> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaClienteId)) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  const c = await prisma.fotofficeGaleriaCliente.findFirst({
    where: { id: galeriaClienteId, workspaceId },
    select: { id: true, galeriaId: true, name: true, email: true, phone: true, tokenHash: true, tokenIssuedAt: true, revokedAt: true },
  });
  if (!c) return no(M.clienteNoExiste);
  const g = await prisma.fotofficeGaleria.findFirst({ where: { id: c.galeriaId, workspaceId }, select: { number: true, name: true, status: true } });
  if (!g) return no(M.clienteNoExiste);
  if (g.status === "BORRADOR") return no(M.publicarPrimero);
  if (g.status === "ARCHIVADA") return no(M.galeriaArchivada);
  if (c.revokedAt) return no(M.clienteAnulado);
  const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
  if (!clave) return no(M.sinClaveEnlace);
  const token = tokenDeGaleriaCliente(c.id, c.tokenIssuedAt, clave);
  if (hashDeToken(token) !== c.tokenHash) return no(M.sinClaveEnlace);
  const sitio = await sitioDelWorkspace(workspaceId);
  if (!sitio) return no(M.sinSitio);
  const url = urlDeGaleria({ customDomain: sitio.customDomain, appOrigin: origenDeLaApp(deps), slug: sitio.slug, token });
  if (!url) return no(M.sinSitio);
  return {
    ok: true,
    datos: {
      url, clienteId: c.id, galeriaId: c.galeriaId, galeriaNumero: g.number, galeriaNombre: g.name,
      nombre: c.name, email: c.email, telefono: c.phone, organizacion: sitio.nombre,
    },
  };
}

/** "Copiar enlace": la dirección vigente de un cliente. Sólo con Gestionar y la galería publicada. */
export async function enlaceDeCliente(ctx: CtxGalerias, galeriaClienteId: unknown, deps: DepsClientes = {}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const r = await cargarCompartible(ctx, galeriaClienteId, deps);
  if (!r.ok) return r;
  await registrarEvento(prisma, { workspaceId: ctx.workspaceId, galeriaId: r.datos.galeriaId, galeriaClienteId: r.datos.clienteId, tipo: "ENLACE_COPIADO", actorUserId: ctx.userId });
  return { ok: true, url: r.datos.url };
}

/** "WhatsApp": el enlace wa.me con el texto ya escrito. Sólo si el cliente tiene un teléfono que sirva. */
export async function whatsappDeCliente(ctx: CtxGalerias, galeriaClienteId: unknown, deps: DepsClientes = {}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const r = await cargarCompartible(ctx, galeriaClienteId, deps);
  if (!r.ok) return r;
  const texto = textoWhatsappGaleria({ nombre: r.datos.nombre, galeria: r.datos.galeriaNombre, organizacion: r.datos.organizacion, url: r.datos.url });
  const url = enlaceWhatsappGaleria(r.datos.telefono, texto);
  if (!url) return no(M.sinTelefono);
  await registrarEvento(prisma, { workspaceId: ctx.workspaceId, galeriaId: r.datos.galeriaId, galeriaClienteId: r.datos.clienteId, tipo: "ENLACE_WHATSAPP", actorUserId: ctx.userId });
  return { ok: true, url };
}

/**
 * Prepara el envío por correo: valida todo (permiso, galería publicada, enlace vigente, correo) y deja el
 * pedido en el historial. El correo en sí lo manda `enviarCorreoEnlace` con `after()`.
 */
export async function pedirEnvioPorCorreo(
  ctx: CtxGalerias,
  galeriaClienteId: unknown,
  deps: DepsClientes = {},
): Promise<{ ok: true; galeriaId: string; clienteId: string } | { ok: false; error: string }> {
  const r = await cargarCompartible(ctx, galeriaClienteId, deps);
  if (!r.ok) return r;
  if (!correoDeGaleria(r.datos.email)) return no(M.sinCorreo);
  await registrarEvento(prisma, { workspaceId: ctx.workspaceId, galeriaId: r.datos.galeriaId, galeriaClienteId: r.datos.clienteId, tipo: "CORREO_PEDIDO", actorUserId: ctx.userId });
  return { ok: true, galeriaId: r.datos.galeriaId, clienteId: r.datos.clienteId };
}

// --- Regenerar y anular ----------------------------------------------------------------------------

/**
 * "Generar enlace nuevo": cambia `tokenIssuedAt` (el enlace anterior deja de andar al instante) y, si
 * estaba anulado, lo vuelve a habilitar. Escritura condicional sobre el hash que se leyó.
 */
export async function regenerarEnlace(ctx: CtxGalerias, galeriaClienteId: unknown, deps: DepsClientes = {}): Promise<ResultadoSimpleCliente> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaClienteId)) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
  if (!clave) return no(M.sinClaveEnlace);
  const ahora = (deps.ahora ?? (() => new Date()))();
  try {
    return await prisma.$transaction(async (tx) => {
      const c = await tx.fotofficeGaleriaCliente.findFirst({
        where: { id: galeriaClienteId, workspaceId },
        select: { id: true, galeriaId: true, tokenHash: true, tokenIssuedAt: true },
      });
      if (!c) return no(M.clienteNoExiste);
      if (!(await tx.fotofficeGaleria.findFirst({ where: { id: c.galeriaId, workspaceId }, select: { id: true } }))) return no(M.clienteNoExiste);
      // El token depende de la fecha: tiene que ser distinta de la anterior.
      const emitido = ahora.getTime() <= c.tokenIssuedAt.getTime() ? new Date(c.tokenIssuedAt.getTime() + 1) : ahora;
      const r = await tx.fotofficeGaleriaCliente.updateMany({
        where: { id: c.id, workspaceId, tokenHash: c.tokenHash },
        data: { tokenHash: hashDeToken(tokenDeGaleriaCliente(c.id, emitido, clave)), tokenIssuedAt: emitido, revokedAt: null },
      });
      if (r.count !== 1) return no(M.carrera);
      await registrarEvento(tx, { workspaceId, galeriaId: c.galeriaId, galeriaClienteId: c.id, tipo: "ENLACE_REGENERADO", actorUserId: ctx.userId });
      return { ok: true as const };
    }, OPCIONES_TRANSACCION);
  } catch {
    return no(M.guardar);
  }
}

/** "Anular": el enlace deja de servir (`revokedAt`). La selección que ya hizo se conserva. */
export async function anularEnlace(ctx: CtxGalerias, galeriaClienteId: unknown, ahora: Date = new Date()): Promise<ResultadoSimpleCliente> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaClienteId)) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx) => {
      const c = await tx.fotofficeGaleriaCliente.findFirst({
        where: { id: galeriaClienteId, workspaceId },
        select: { id: true, galeriaId: true, revokedAt: true },
      });
      if (!c) return no(M.clienteNoExiste);
      if (!(await tx.fotofficeGaleria.findFirst({ where: { id: c.galeriaId, workspaceId }, select: { id: true } }))) return no(M.clienteNoExiste);
      if (c.revokedAt) return { ok: true as const };
      const r = await tx.fotofficeGaleriaCliente.updateMany({ where: { id: c.id, workspaceId, revokedAt: null }, data: { revokedAt: ahora } });
      if (r.count === 1) await registrarEvento(tx, { workspaceId, galeriaId: c.galeriaId, galeriaClienteId: c.id, tipo: "ENLACE_ANULADO", actorUserId: ctx.userId });
      return { ok: true as const };
    }, OPCIONES_TRANSACCION);
  } catch {
    return no(M.guardar);
  }
}
