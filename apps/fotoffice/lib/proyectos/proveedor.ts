import "server-only";
import { esSkuCajaFotolibro, tipoTapaDeSku } from "@/lib/fotolibro/venta";
import { prisma } from "@repo/db";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { MENSAJES_PROYECTO, puedeGestionarProyectos, type CtxProyectos } from "./acceso";
import { correoParaProveedor } from "./correo-proveedor";
import { moverAFase } from "./avance";
import { leerProductosDeCopia } from "@/lib/impresiones/catalogo-copias";
import { enlaceDeCarpeta, enlaceLaboratorioSiHayArchivos } from "@/lib/carpetas/carpeta";

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

/**
 * Marca el trabajo como enviado al proveedor elegido y, si tiene correo, le manda el pedido desde
 * el remitente del estudio (las respuestas llegan al correo de contacto del estudio). Queda una
 * nota en el trabajo con lo que pasó.
 */
export async function enviarAlProveedor(
  ctx: CtxProyectos,
  proyectoId: unknown,
  proveedorIdRaw: unknown,
  notasRaw: unknown,
  opciones: { siempreConCarpeta?: boolean } = {},
): Promise<ResultadoEnvio> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
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
    const estudio = branding?.commercialName?.trim() || "el estudio";
    const correo = correoParaProveedor({
      estudio,
      proveedor: proveedor.name,
      numeroTrabajo: p.number,
      producto: p.product?.name ?? p.name,
      cantidad: null,
      cliente: nombreDeContacto(p.client),
      entregaDeseada: ymd(p.entregaPrometida),
      notas,
      // Si la carpeta tiene archivos, el laboratorio los descarga desde acá (sin Drive).
      // Al cargar el pedido la carpeta todavía está vacía: va el enlace igual y los archivos aparecen ahí cuando se suben.
      enlaceArchivos: opciones.siempreConCarpeta
        ? await enlaceDeCarpeta(ctx, proyectoId, "LABORATORIO").then((r) => (r.ok ? r.url : null))
        : await enlaceLaboratorioSiHayArchivos(ctx, proyectoId),
    });
    const sender = await loadWorkspaceSender(ctx.workspaceId);
    const r = await sendTransactionalEmail({ to: proveedor.email, ...correo, sender });
    porCorreo = r.status === "SENT";
    aviso = porCorreo
      ? `Pedido enviado por correo a ${proveedor.name} (${proveedor.email}).`
      : `Marcado como enviado a ${proveedor.name}, pero el correo no salió. Avisale por otro medio.`;
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
 * Al cargar un pedido: cada trabajo que tiene proveedor (el «proveedor por defecto» del producto)
 * se le manda por correo en el momento, con el enlace a su carpeta, y pasa solo a «En el
 * proveedor». Corre después de responder (`after`): si un correo falla, queda la nota en el
 * trabajo y el botón «Enviar» del tablero sigue disponible. No vuelve a mandar uno ya enviado.
 * Los fotolibros no: al venderlos el libro todavía no está diseñado; se mandan con «Enviar» cuando
 * el diseño está listo.
 */
export async function enviarTrabajosDelPedidoAlProveedor(ctx: CtxProyectos, pedidoId: string): Promise<void> {
  try {
    const trabajos = await prisma.fotofficeProyecto.findMany({
      where: { workspaceId: ctx.workspaceId, pedidoId, proveedorId: { not: null }, proveedorEnviadoAt: null },
      select: { id: true, proveedorId: true, productId: true },
    });
    for (const t of trabajos) {
      const p = t.productId
        ? await prisma.product.findFirst({
            where: { id: t.productId, workspaceId: ctx.workspaceId },
            select: { sku: true, name: true, priceArs: true, costArs: true, preferredProveedorId: true },
          })
        : null;
      const esFotolibro = esProductoDeFotolibro(p?.sku);
      if (esFotolibro) continue;
      const esCopia = p ? leerProductosDeCopia([{ id: "x", name: p.name, priceArs: Number(p.priceArs), costArs: Number(p.costArs ?? 0), preferredProveedorId: p.preferredProveedorId }]).length > 0 : false;
      // Un trabajo de mostrador lo manda el cron de pedidos de impresión cuando hay archivos: si se
      // mandara acá quedaría «enviado» y el cron lo salteaba para siempre. Sin nota: el cron avisa.
      const esDeMostrador =
        (await prisma.fotofficePrintOrderItem.count({ where: { proyectoId: t.id, order: { workspaceId: ctx.workspaceId } } })) > 0;
      const archivosListos =
        esCopia && !esDeMostrador
          ? await prisma.fotofficeArchivoTrabajo.count({ where: { workspaceId: ctx.workspaceId, proyectoId: t.id, estado: "LISTO" } })
          : 0;
      if (!seMandaAlCobrar({ esCopia, esDeMostrador, archivosListos, esFotolibro })) {
        if (esCopia && !esDeMostrador) {
          const lab = await prisma.fotofficeProveedor.findFirst({ where: { id: t.proveedorId!, workspaceId: ctx.workspaceId }, select: { name: true } });
          await prisma.fotofficeProyectoNota.create({
            data: {
              workspaceId: ctx.workspaceId,
              proyectoId: t.id,
              authorUserId: ctx.userId,
              body: `Falta subir los archivos para mandarlo a ${lab?.name ?? "el laboratorio"}.`,
            },
          });
        }
        continue;
      }
      const r = await enviarAlProveedor(ctx, t.id, t.proveedorId, null, { siempreConCarpeta: true });
      if (!r.ok) console.error("[proyectos][proveedor] envío automático falló", { error: r.error });
    }
  } catch (e) {
    console.error("[proyectos][proveedor] envío automático falló", { error: e instanceof Error ? e.message : "desconocido" });
  }
}

/** ¿Se manda al laboratorio en el momento de cobrar? No: fotolibros (sin diseño), mostrador (lo manda el cron) ni copias sin archivos. */
export function seMandaAlCobrar(t: { esCopia: boolean; esDeMostrador: boolean; archivosListos: number; esFotolibro: boolean }): boolean {
  if (t.esFotolibro || t.esDeMostrador) return false;
  if (t.esCopia && t.archivosListos === 0) return false;
  return true;
}

function esProductoDeFotolibro(sku: string | null | undefined): boolean {
  return tipoTapaDeSku(sku) !== null || esSkuCajaFotolibro(sku);
}
