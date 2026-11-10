import "server-only";
import { prisma } from "@repo/db";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { MENSAJES_PROYECTO, puedeGestionarProyectos, type CtxProyectos } from "./acceso";
import { correoParaProveedor } from "./correo-proveedor";
import { moverAFase } from "./avance";
import { itemsGuardados } from "@/lib/presupuestos/versiones";
import { emitirEnlace } from "@/lib/carpetas/carpeta";
import { faltanArchivos, listoParaSalirSolo } from "./estado-envio";
import { situacionesDeEnvio } from "./situacion-envio";

/**
 * El proveedor (laboratorio) de un trabajo: a quién se mandó, su número de pedido, lo que cobra y
 * la fecha de entrega prometida al cliente. "Enviar al proveedor" lo marca como enviado y, si el
 * proveedor tiene correo, le manda el pedido.
 */

export type DatosProveedorTrabajo = {
  proveedorId: string | null;
  proveedorRef: string | null;
  /** En pesos, como texto ("12500.00") o null. */
  proveedorCostoArs: string | null;
  /** "aaaa-mm-dd" o null. */
  entregaPrometida: string | null;
  enviadoAt: Date | null;
  /** Cuándo se borra la carpeta de archivos (ISO), o null. */
  carpetaVence: string | null;
  proveedores: { id: string; name: string; email: string | null }[];
};

const ID = /^[A-Za-z0-9_-]{1,64}$/;

function ymd(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export async function leerProveedorDelTrabajo(ctx: CtxProyectos, proyectoId: string): Promise<DatosProveedorTrabajo | null> {
  const [p, proveedores] = await Promise.all([
    prisma.fotofficeProyecto.findFirst({
      where: { id: proyectoId, workspaceId: ctx.workspaceId },
      select: { proveedorId: true, proveedorRef: true, proveedorCostoArs: true, entregaPrometida: true, proveedorEnviadoAt: true, carpetaVence: true },
    }),
    prisma.fotofficeProveedor.findMany({
      where: { workspaceId: ctx.workspaceId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);
  if (!p) return null;
  return {
    proveedorId: p.proveedorId,
    proveedorRef: p.proveedorRef,
    proveedorCostoArs: p.proveedorCostoArs ? p.proveedorCostoArs.toString() : null,
    entregaPrometida: ymd(p.entregaPrometida),
    enviadoAt: p.proveedorEnviadoAt,
    carpetaVence: p.carpetaVence ? p.carpetaVence.toISOString() : null,
    proveedores,
  };
}

export type CambiosProveedorTrabajo = {
  proveedorId?: unknown;
  proveedorRef?: unknown;
  proveedorCostoArs?: unknown;
  entregaPrometida?: unknown;
};

type Resultado = { ok: true } | { ok: false; error: string };

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t.slice(0, max);
}

export async function guardarProveedorDelTrabajo(ctx: CtxProyectos, proyectoId: unknown, c: CambiosProveedorTrabajo): Promise<Resultado> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (typeof proyectoId !== "string" || !ID.test(proyectoId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };

  const proveedorId = texto(c.proveedorId, 64);
  if (proveedorId) {
    const existe = await prisma.fotofficeProveedor.count({ where: { id: proveedorId, workspaceId: ctx.workspaceId } });
    if (existe === 0) return { ok: false, error: "Ese proveedor no existe." };
  }
  const costoTexto = texto(c.proveedorCostoArs, 20)?.replace(/\./g, "").replace(",", ".") ?? null;
  const costo = costoTexto === null ? null : Number(costoTexto);
  if (costo !== null && (!Number.isFinite(costo) || costo < 0)) return { ok: false, error: "El costo no se entiende." };
  const entrega = texto(c.entregaPrometida, 10);
  if (entrega && !/^\d{4}-\d{2}-\d{2}$/.test(entrega)) return { ok: false, error: "La fecha de entrega no se entiende." };

  const r = await prisma.fotofficeProyecto.updateMany({
    where: { id: proyectoId, workspaceId: ctx.workspaceId },
    data: {
      proveedorId,
      proveedorRef: texto(c.proveedorRef, 80),
      proveedorCostoArs: costo === null ? null : costo.toFixed(2),
      entregaPrometida: entrega ? new Date(`${entrega}T12:00:00Z`) : null,
    },
  });
  return r.count > 0 ? { ok: true } : { ok: false, error: MENSAJES_PROYECTO.noExiste };
}

export type ResultadoEnvio = { ok: true; porCorreo: boolean; aviso: string } | { ok: false; error: string };

export const MENSAJE_FALTAN_ARCHIVOS =
  "Falta subir los archivos. Subilos en la carpeta del trabajo (sale solo a los pocos minutos) o, si ya le llegaron por otro lado, usá «Marcar enviado».";

/** Cantidad del renglón del pedido que generó el trabajo, o null. */
async function cantidadDelRenglon(workspaceId: string, pedidoId: string | null, indice: number | null): Promise<number | null> {
  if (!pedidoId || indice === null) return null;
  const ped = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { items: true } });
  if (!ped) return null;
  const c = itemsGuardados(ped.items)[indice]?.cantidad;
  return typeof c === "number" && Number.isFinite(c) && c > 0 ? c : null;
}

/**
 * Marca el trabajo como enviado al proveedor elegido y, si tiene correo, le manda el pedido desde
 * el remitente del estudio (las respuestas llegan al correo de contacto del estudio). Queda una
 * nota en el trabajo con lo que pasó.
 *
 * Nunca manda un correo con la carpeta vacía: si el trabajo necesita archivos (todo lo que no es
 * material físico, ver `estado-envio.ts`) y no tiene ninguno, devuelve MENSAJE_FALTAN_ARCHIVOS y
 * no toca nada. Si el correo no sale, el trabajo sigue sin enviar (el botón «Enviar» sigue ahí).
 */
export async function enviarAlProveedor(ctx: CtxProyectos, proyectoId: unknown, proveedorIdRaw: unknown, notasRaw: unknown): Promise<ResultadoEnvio> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  return enviarSinPermiso(ctx, proyectoId, proveedorIdRaw, notasRaw, { notaSiFalla: true });
}

/** El envío en sí. Quien llama ya verificó el permiso (o es el sistema: cron, `after` del cobro). */
async function enviarSinPermiso(
  ctx: CtxProyectos,
  proyectoId: unknown,
  proveedorIdRaw: unknown,
  notasRaw: unknown,
  opciones: { notaSiFalla: boolean },
): Promise<ResultadoEnvio> {
  if (typeof proyectoId !== "string" || !ID.test(proyectoId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const proveedorId = texto(proveedorIdRaw, 64);
  if (!proveedorId) return { ok: false, error: "Elegí a qué proveedor se manda." };
  const notas = texto(notasRaw, 1000);

  const [p, proveedor, branding] = await Promise.all([
    prisma.fotofficeProyecto.findFirst({
      where: { id: proyectoId, workspaceId: ctx.workspaceId },
      select: {
        number: true,
        name: true,
        entregaPrometida: true,
        pedidoId: true,
        pedidoItemIndex: true,
        proveedorMensaje: true,
        product: { select: { name: true } },
        client: { select: { firstName: true, lastName: true, businessName: true } },
      },
    }),
    prisma.fotofficeProveedor.findFirst({ where: { id: proveedorId, workspaceId: ctx.workspaceId }, select: { name: true, email: true } }),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: ctx.workspaceId }, select: { commercialName: true } }),
  ]);
  if (!p) return { ok: false, error: MENSAJES_PROYECTO.noExiste };
  if (!proveedor) return { ok: false, error: "Ese proveedor no existe." };

  let porCorreo = false;
  let aviso = `Marcado como enviado a ${proveedor.name}.`;
  if (proveedor.email) {
    const sit = (await situacionesDeEnvio(ctx.workspaceId, [proyectoId])).get(proyectoId);
    const envioSinArchivos = sit?.envioSinArchivos ?? false;
    const archivosListos = sit?.archivosListos ?? 0;
    if (faltanArchivos({ envioSinArchivos, archivosListos })) return { ok: false, error: MENSAJE_FALTAN_ARCHIVOS };
    let enlaceArchivos: string | null = null;
    if (archivosListos > 0) {
      const e = await emitirEnlace(ctx.workspaceId, proyectoId, "LABORATORIO");
      // Sin enlace el correo saldría sin archivos: mejor no mandarlo.
      if (!e.ok) return { ok: false, error: `No se pudo armar el enlace a los archivos: ${e.error}` };
      enlaceArchivos = e.url;
    }
    const correo = correoParaProveedor({
      estudio: branding?.commercialName?.trim() || "el estudio",
      proveedor: proveedor.name,
      numeroTrabajo: p.number,
      producto: p.product?.name ?? p.name,
      cantidad: await cantidadDelRenglon(ctx.workspaceId, p.pedidoId, p.pedidoItemIndex),
      cliente: nombreDeContacto(p.client),
      entregaDeseada: ymd(p.entregaPrometida),
      // Lo que se escribe al mandarlo a mano manda; si no, el mensaje que se dejó al armar el pedido.
      notas: notas ?? p.proveedorMensaje ?? null,
      enlaceArchivos,
      materialFisico: enlaceArchivos === null,
    });
    const sender = await loadWorkspaceSender(ctx.workspaceId);
    const r = await sendTransactionalEmail({ to: proveedor.email, ...correo, sender });
    porCorreo = r.status === "SENT";
    if (!porCorreo) {
      if (opciones.notaSiFalla) {
        await prisma.fotofficeProyectoNota.create({
          data: {
            workspaceId: ctx.workspaceId,
            proyectoId,
            authorUserId: ctx.userId,
            body: `El correo a ${proveedor.name} no salió: el trabajo sigue sin enviar. Probá de nuevo con «Enviar» o avisale por otro medio y usá «Marcar enviado».`,
          },
        });
      }
      return { ok: false, error: `El correo a ${proveedor.name} no salió: el trabajo sigue sin enviar. Probá de nuevo o avisale por otro medio.` };
    }
    aviso = `Pedido enviado por correo a ${proveedor.name} (${proveedor.email}).`;
  } else {
    aviso = `Marcado como enviado a ${proveedor.name}. No tiene correo cargado: avisale por otro medio.`;
  }

  await prisma.$transaction([
    prisma.fotofficeProyecto.updateMany({
      where: { id: proyectoId, workspaceId: ctx.workspaceId },
      data: { proveedorId, proveedorEnviadoAt: new Date() },
    }),
    prisma.fotofficeProyectoNota.create({
      data: {
        workspaceId: ctx.workspaceId,
        proyectoId,
        authorUserId: ctx.userId,
        body: [aviso, notas ? `Indicaciones: ${notas}` : null].filter(Boolean).join("\n"),
      },
    }),
  ]);
  // Mandado al laboratorio: el trabajo pasa solo a "En el proveedor".
  const avance = await moverAFase(ctx, proyectoId, "EN_PROVEEDOR", `Enviado a ${proveedor.name}.`);
  if (avance.ok && avance.movido) aviso = `${aviso} Pasó a «${avance.etapa}».`;
  return { ok: true, porCorreo, aviso };
}

/**
 * Al cargar un pedido: cada trabajo con proveedor (el «proveedor por defecto» del producto) se le
 * manda en el momento SÓLO si está completo: material físico (un rollo) o carpeta con archivos.
 * Los que necesitan archivos y no los tienen quedan pendientes con la nota «Faltan los archivos…»:
 * salen solos cuando se suben (cron `enviarTrabajosCompletos`). Corre después de responder
 * (`after`). No vuelve a mandar uno ya enviado. Fotolibros (sin diseño todavía) y trabajos de
 * mostrador (los manda el cron de impresiones con su ZIP) no pasan por acá.
 */
export async function enviarTrabajosDelPedidoAlProveedor(ctx: CtxProyectos, pedidoId: string): Promise<void> {
  try {
    const trabajos = await prisma.fotofficeProyecto.findMany({
      where: { workspaceId: ctx.workspaceId, pedidoId, proveedorId: { not: null }, proveedorEnviadoAt: null },
      select: { id: true, proveedorId: true },
    });
    const sit = await situacionesDeEnvio(ctx.workspaceId, trabajos.map((t) => t.id));
    for (const t of trabajos) {
      const s = sit.get(t.id);
      if (!s || s.otroCamino) continue;
      if (faltanArchivos(s)) {
        await prisma.fotofficeProyectoNota.create({
          data: {
            workspaceId: ctx.workspaceId,
            proyectoId: t.id,
            authorUserId: ctx.userId,
            body: `Faltan los archivos para ${s.proveedor ?? "el proveedor"}. Subilos en la carpeta del trabajo: el pedido sale solo a los pocos minutos.`,
          },
        });
        continue;
      }
      const r = await enviarSinPermiso(ctx, t.id, t.proveedorId, null, { notaSiFalla: true });
      if (!r.ok) console.error("[proyectos][proveedor] envío automático falló", { error: r.error });
    }
  } catch (e) {
    console.error("[proyectos][proveedor] envío automático falló", { error: e instanceof Error ? e.message : "desconocido" });
  }
}

/** El mismo contexto de sistema que usa el motor de circuitos (sin usuario: las notas quedan sin autor). */
function contextoDelSistema(workspaceId: string): CtxProyectos {
  return { workspaceId, userId: null, userLabel: "Sistema", role: null };
}

/** Desde cuándo el cron manda solos los trabajos completados: los anteriores pudieron salir por WhatsApp. */
export const ENVIO_AUTOMATICO_DESDE = new Date("2026-11-07T03:00:00Z");
/** Una subida que quedó PENDIENTE más de esto se da por abandonada (no frena el envío). */
const SUBIDA_ABANDONADA_MS = 30 * 60_000;
const TOPE_POR_CORRIDA = 20;

/**
 * Cron: los trabajos que esperaban archivos y ya los tienen salen solos. Recorre todos los
 * estudios con el contexto del sistema. Devuelve cuántos mandó.
 */
export async function enviarTrabajosCompletos(ahora: Date): Promise<number> {
  const pendientes = await prisma.fotofficeProyecto.findMany({
    where: { proveedorId: { not: null }, proveedorEnviadoAt: null, suspendedAt: null, createdAt: { gte: ENVIO_AUTOMATICO_DESDE } },
    select: { id: true, workspaceId: true, proveedorId: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  if (pendientes.length === 0) return 0;
  const conArchivos = new Set(
    (
      await prisma.fotofficeArchivoTrabajo.findMany({
        where: { proyectoId: { in: pendientes.map((p) => p.id) }, estado: "LISTO" },
        select: { proyectoId: true },
      })
    ).map((a) => a.proyectoId),
  );
  const candidatos = pendientes.filter((p) => conArchivos.has(p.id)).slice(0, TOPE_POR_CORRIDA);
  let enviados = 0;
  for (const c of candidatos) {
    try {
      const s = (await situacionesDeEnvio(c.workspaceId, [c.id])).get(c.id);
      if (!s) continue;
      const archivos = await prisma.fotofficeArchivoTrabajo.findMany({
        where: { workspaceId: c.workspaceId, proyectoId: c.id },
        select: { estado: true, createdAt: true },
      });
      const listos = archivos.filter((a) => a.estado === "LISTO");
      const subiendo = archivos.filter((a) => a.estado !== "LISTO" && ahora.getTime() - a.createdAt.getTime() < SUBIDA_ABANDONADA_MS).length;
      const ultimo = listos.reduce<Date | null>((m, a) => (!m || a.createdAt > m ? a.createdAt : m), null);
      if (!listoParaSalirSolo({ envioSinArchivos: s.envioSinArchivos, otroCamino: s.otroCamino, archivosListos: listos.length, archivosSubiendo: subiendo, ultimoArchivoAt: ultimo }, ahora)) continue;
      // Sin nota si falla: el cron vuelve a probar en la próxima corrida y no llena el trabajo de notas.
      const r = await enviarSinPermiso(contextoDelSistema(c.workspaceId), c.id, c.proveedorId, null, { notaSiFalla: false });
      if (r.ok) enviados++;
      else console.error("[proyectos][proveedor] envío al completar falló", { proyectoId: c.id, error: r.error });
    } catch (e) {
      console.error("[proyectos][proveedor] envío al completar falló", { proyectoId: c.id, error: e instanceof Error ? e.message : "desconocido" });
    }
  }
  return enviados;
}
