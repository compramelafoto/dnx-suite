import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { archivoDeMensaje, claveDeMedia } from "@/lib/bandeja/archivo-de-mensaje";
import type { PedidoFotolibro, RespuestaFotolibro } from "@/lib/fotolibro/bot";
import { SKU_CAJA_FOTOLIBRO, tipoTapaDeSku, type FotolibroVendido } from "@/lib/fotolibro/venta";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import type { CtxPedidos } from "./acceso";
import type { DatosPedidoManual } from "./pedidos";
import { ORDERS_MODULE_KEY } from "./acceso";
import { claveDelAlta, disponibleDe, elegirProducto, planDelBot, prefijoDelChat, senaDe, type ProductoDelBot } from "./whatsapp";

/**
 * El bot de WhatsApp vende cualquier producto del catálogo (digitalización de VHS, pendrives,
 * cuadros…) como un pedido común, el mismo que arma el Mostrador: con sus trabajos según las
 * reglas de cada producto, la seña del 50 % como primera cuota y el enlace del pedido, donde el
 * cliente paga con Mercado Pago. Lo registra a nombre del dueño del estudio ("Bot de WhatsApp").
 * Las copias con fotos del chat NO pasan por acá: van por `lib/impresiones/whatsapp-servidor.ts`.
 * Lo demás que lleva fotos (cuadros, imanes, polaroid…) sí: las del renglón se copian a la carpeta
 * de su trabajo, la misma que se manda al laboratorio. Cada renglón abre su trabajo (por regla del
 * producto o «Para retirar») y lo que cuenta stock queda apartado, igual que una seña del Mostrador.
 */

export type ChatDelPedidoCatalogo = { id: string; waId: string; clientId: string | null; nombre: string | null };

export type FotoDelRenglon = { mensajeId: string };

export type DatosPedidoCatalogo = {
  lineas: {
    producto: string;
    variante?: string | null;
    cantidad: number;
    fotos?: FotoDelRenglon[];
    /** Lo elegido en la calculadora; el precio se vuelve a calcular acá. */
    fotolibro?: { modelo: string; medida: string; hojas: number; fotos?: number | null; caja?: boolean };
  }[];
  pago: "SENA" | "TOTAL";
  nombre: string;
  email?: string | null;
};

export type ResultadoPedidoCatalogo =
  | {
      ok: true;
      numero: string;
      lineas: { nombre: string; cantidad: number; precio: number }[];
      total: number;
      aPagarAhora: number;
      saldo: number;
      url: string;
      /** Fotos del chat que quedaron en las carpetas de los trabajos. */
      fotos: number;
    }
  | { ok: false; motivo: "MODULO" | "PRODUCTO" | "FOTOLIBRO" | "FOTO_NO_LISTA" | "SIN_DUENO" | "SIN_ENLACE" | "ERROR"; detalle?: string };

/** Un archivo del chat (ya en el R2 privado) para copiar a la carpeta de un trabajo. */
export type ArchivoDelChat = { clave: string; nombre: string; tipo: string; bytes: number };
export type FotosDelItem = { itemIndex: number; archivos: ArchivoDelChat[] };
type MensajeConMedia = { id: string; tipo: string; media: unknown };
type Elegida = { productId: string; variantId: string | null; nombre: string; precio: number; cantidad: number; linea: number; esCaja?: boolean };

type CtxDuenio = CtxPedidos & { userId: number };

export type DepsPedidoCatalogo = {
  moduloEncendido?: (workspaceId: string) => Promise<boolean>;
  productos?: (workspaceId: string) => Promise<ProductoDelBot[]>;
  ctxDelDuenio?: (workspaceId: string) => Promise<CtxDuenio | null>;
  /** El cliente del chat: el que ya tiene, o uno buscado/creado por teléfono. */
  cliente?: (workspaceId: string, chat: ChatDelPedidoCatalogo, nombre: string, email: string | null) => Promise<string>;
  /** Pedidos anteriores del bot en este chat todavía sin pagar (se cancelan al armar otro). */
  pendientesDelChat?: (workspaceId: string, chatId: string) => Promise<{ id: string; altaKey: string | null }[]>;
  cancelar?: (ctx: CtxDuenio, pedidoId: string) => Promise<void>;
  crear?: (ctx: CtxDuenio, datos: DatosPedidoManual) => Promise<{ ok: true; pedidoId: string; numero: string; repetido?: boolean } | { ok: false; error: string }>;
  /** Los mensajes del chat con su archivo (sólo los de este chat). */
  media?: (workspaceId: string, chatId: string, ids: string[]) => Promise<MensajeConMedia[]>;
  cotizarFotolibro?: (workspaceId: string, pedido: PedidoFotolibro) => Promise<RespuestaFotolibro>;
  /** Crea cada fotolibro vendido y lo ata a su trabajo, como el Cobrador. */
  atarFotolibros?: (workspaceId: string, userId: number, pedido: { id: string; numero: string }, cliente: string, libros: { itemIndex: number; fotolibro: FotolibroVendido }[]) => Promise<string[]>;
  /** Copia los archivos a la carpeta del trabajo de cada ítem; devuelve cuántos quedaron. */
  guardarFotos?: (workspaceId: string, pedidoId: string, porItem: FotosDelItem[]) => Promise<number>;
  enlace?: (workspaceId: string, pedidoId: string) => Promise<string | null>;
  avisar?: (workspaceId: string, pedidoId: string) => Promise<void>;
  ahora?: () => Date;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const POR_OMISION: Required<Omit<DepsPedidoCatalogo, "ahora">> = {
  moduloEncendido: async (workspaceId) => {
    const { isModuleEnabledForWorkspace } = await import("@/lib/modules/gating");
    return isModuleEnabledForWorkspace(workspaceId, ORDERS_MODULE_KEY);
  },
  productos: async (workspaceId) => {
    const { listProducts } = await import("@/lib/sales/repository");
    return listProducts(workspaceId, { onlyActive: true, onlyVendible: true });
  },
  ctxDelDuenio: async (workspaceId) => {
    const m = await prisma.workspaceMembership.findFirst({ where: { workspaceId, role: "WORKSPACE_OWNER" }, orderBy: { userId: "asc" }, select: { userId: true, role: true } });
    if (!m) return null;
    const { resolverAcceso } = await import("@/lib/access/acceso");
    return { workspaceId, userId: m.userId, userLabel: "Bot de WhatsApp", role: m.role, acceso: await resolverAcceso(m.userId, workspaceId) };
  },
  cliente: async (workspaceId, chat, nombre, email) => {
    if (chat.clientId) {
      if (email) await prisma.client.updateMany({ where: { id: chat.clientId, workspaceId, email: null }, data: { email } });
      return chat.clientId;
    }
    const { findOrCreateClient } = await import("@/lib/clients/find-or-create");
    const [primero, ...resto] = nombre.split(/\s+/);
    const c = await prisma.$transaction((tx) =>
      findOrCreateClient(tx, { workspaceId, phone: `+${chat.waId}`, email, firstName: primero || nombre, lastName: resto.join(" ") || null }),
    );
    if (email) await prisma.client.updateMany({ where: { id: c.id, workspaceId, email: null }, data: { email } });
    await prisma.fotofficeWaChat.updateMany({ where: { id: chat.id, workspaceId, clientId: null }, data: { clientId: c.id } });
    return c.id;
  },
  pendientesDelChat: async (workspaceId, chatId) => {
    const pedidos = await prisma.fotofficePedido.findMany({
      where: { workspaceId, status: "CONFIRMADO", altaKey: { startsWith: prefijoDelChat(chatId) } },
      select: { id: true, altaKey: true },
    });
    if (pedidos.length === 0) return [];
    const conCobros = await prisma.fotofficeCobro.findMany({ where: { workspaceId, pedidoId: { in: pedidos.map((p) => p.id) }, voidedAt: null }, select: { pedidoId: true } });
    const pagados = new Set(conCobros.map((c) => c.pedidoId));
    return pedidos.filter((p) => !pagados.has(p.id));
  },
  cancelar: async (ctx, pedidoId) => {
    const { cambiarEstadoPedido } = await import("./pedidos");
    await cambiarEstadoPedido(ctx, pedidoId, "CANCELADO", "El cliente armó otro pedido por WhatsApp.");
  },
  crear: async (ctx, datos) => {
    const { crearPedidoManual } = await import("./pedidos");
    const r = await crearPedidoManual(ctx, datos);
    return r.ok ? { ok: true, pedidoId: r.pedidoId, numero: r.numero, repetido: r.repetido } : r;
  },
  cotizarFotolibro: async (workspaceId, pedido) => {
    const { cotizarFotolibroParaBot } = await import("@/lib/fotolibro/bot-servidor");
    return cotizarFotolibroParaBot(workspaceId, pedido);
  },
  atarFotolibros: async (workspaceId, userId, pedido, cliente, libros) => {
    const { atarFotolibrosAlPedido } = await import("@/lib/fotolibro/venta-servidor");
    return atarFotolibrosAlPedido({ workspaceId, userId, pedidoId: pedido.id, pedidoNumero: pedido.numero, cliente, libros });
  },
  media: async (workspaceId, chatId, ids) =>
    prisma.fotofficeWaMensaje.findMany({ where: { workspaceId, chatId, id: { in: ids } }, select: { id: true, tipo: true, media: true } }),
  guardarFotos: async (workspaceId, pedidoId, porItem) => {
    const trabajos = await prisma.fotofficeProyecto.findMany({
      where: { workspaceId, pedidoId, pedidoItemIndex: { in: porItem.map((p) => p.itemIndex) } },
      orderBy: { createdAt: "asc" },
      select: { id: true, pedidoItemIndex: true },
    });
    const { copiarObjeto } = await import("@/lib/impresion/almacen");
    const { claveDeArchivo } = await import("@/lib/carpetas/reglas");
    let guardadas = 0;
    for (const { itemIndex, archivos } of porItem) {
      // Si el ítem abrió más de un trabajo, las fotos van al primero.
      const proyectoId = trabajos.find((t) => t.pedidoItemIndex === itemIndex)?.id;
      if (!proyectoId) continue;
      for (const a of archivos) {
        const id = randomUUID();
        const key = claveDeArchivo(workspaceId, proyectoId, id, a.nombre);
        await copiarObjeto(a.clave, key);
        await prisma.fotofficeArchivoTrabajo.create({
          data: { id, workspaceId, proyectoId, key, nombre: a.nombre, tipo: a.tipo, bytes: BigInt(a.bytes), estado: "LISTO" },
        });
        guardadas++;
      }
    }
    return guardadas;
  },
  enlace: async (workspaceId, pedidoId) => {
    const { enlaceDelPedidoDelSistema } = await import("./enlace");
    const r = await enlaceDelPedidoDelSistema(workspaceId, pedidoId);
    return r.ok ? r.url : null;
  },
  avisar: async (workspaceId, pedidoId) => {
    const { avisarPedidoRecibido } = await import("./aviso-pedido-servidor");
    await avisarPedidoRecibido(workspaceId, pedidoId);
  },
};

export async function crearPedidoDeCatalogoDesdeWhatsapp(
  workspaceId: string,
  chat: ChatDelPedidoCatalogo,
  datos: DatosPedidoCatalogo,
  deps: DepsPedidoCatalogo = {},
): Promise<ResultadoPedidoCatalogo> {
  const d = { ...POR_OMISION, ...deps };
  try {
    if (!(await d.moduloEncendido(workspaceId))) return { ok: false, motivo: "MODULO" };

    const catalogo = await d.productos(workspaceId);
    // Los fotolibros figuran a $0: su precio sale de la calculadora, no de la lista.
    const paraElegir = catalogo.map((p) => (tipoTapaDeSku(p.sku) ? { ...p, priceMinor: Math.max(p.priceMinor, 1) } : p));
    const elegidas: Elegida[] = [];
    const libros: { itemIndex: number; fotolibro: FotolibroVendido }[] = [];
    for (const [linea, l] of datos.lineas.entries()) {
      const e = elegirProducto(paraElegir, l.producto, l.variante ?? null);
      if (!e.ok) {
        const detalle =
          e.motivo === "AMBIGUO" ? `"${l.producto}" puede ser: ${e.opciones.join(", ")}.`
          : e.motivo === "VARIANTE" ? `De "${l.producto}" hay que elegir: ${e.opciones.join(", ")}.`
          : e.motivo === "SIN_PRECIO" ? `"${l.producto}" no tiene precio cargado.`
          : `"${l.producto}" no está en el catálogo.`;
        return { ok: false, motivo: "PRODUCTO", detalle };
      }
      const tapa = tipoTapaDeSku(catalogo.find((p) => p.id === e.productId)?.sku);
      if (!tapa) {
        elegidas.push({ productId: e.productId, variantId: e.variantId, nombre: e.nombre, precio: e.precio, cantidad: l.cantidad, linea });
        continue;
      }
      const f = l.fotolibro;
      if (!f) return { ok: false, motivo: "FOTOLIBRO", detalle: "Para vender un fotolibro hacen falta el modelo de tapa, la medida y las hojas." };
      const r = await d.cotizarFotolibro(workspaceId, { tapa, modelo: f.modelo, medida: f.medida, hojas: f.hojas, fotos: f.fotos ?? null, caja: f.caja === true });
      if (r.tipo !== "PRECIO") {
        const detalle = r.tipo === "ERROR" ? r.mensaje : r.tipo === "AMBIGUO" ? `El modelo puede ser: ${r.opciones.join(", ")}.` : `No encontré la tapa "${f.modelo}" en ${f.medida}.`;
        return { ok: false, motivo: "FOTOLIBRO", detalle };
      }
      if (f.caja && !r.caja) return { ok: false, motivo: "FOTOLIBRO", detalle: `La tapa ${r.modelo} no tiene caja en ${r.medida}.` };
      libros.push({
        itemIndex: elegidas.length,
        fotolibro: {
          proveedorId: r.proveedorId, modelo: r.modelo, medida: r.medida, hojas: r.hojas, fotos: r.fotos,
          costoMinor: r.costoMinor, cajaCostoMinor: r.conCaja && r.caja ? r.caja.costoMinor : null, templateId: null,
        },
      });
      const detalle = `${r.modelo} ${r.medida} · ${r.hojas} hojas`;
      elegidas.push({ productId: e.productId, variantId: null, nombre: `${e.nombre} ${detalle}`, precio: r.precioMinor / 100, cantidad: l.cantidad, linea });
      if (r.conCaja && r.caja) {
        const caja = catalogo.find((p) => p.sku?.trim().toUpperCase() === SKU_CAJA_FOTOLIBRO);
        if (!caja) return { ok: false, motivo: "FOTOLIBRO", detalle: "El catálogo no tiene el producto de la caja del fotolibro." };
        elegidas.push({ productId: caja.id, variantId: null, nombre: `${caja.name} ${r.modelo} ${r.medida}`, precio: r.caja.precioMinor / 100, cantidad: l.cantidad, linea, esCaja: true });
      }
    }

    // No se vende lo que no hay: el mismo producto en dos renglones suma.
    const pedidas = new Map<string, { productId: string; variantId: string | null; nombre: string; cantidad: number }>();
    for (const l of elegidas) {
      const clave = `${l.productId}:${l.variantId ?? ""}`;
      const previa = pedidas.get(clave);
      pedidas.set(clave, { ...l, cantidad: (previa?.cantidad ?? 0) + l.cantidad });
    }
    for (const l of pedidas.values()) {
      const disponible = disponibleDe(catalogo, l.productId, l.variantId);
      if (disponible === null || disponible >= l.cantidad) continue;
      const detalle = disponible === 0 ? `"${l.nombre}" no tiene stock ahora.` : `De "${l.nombre}" quedan ${disponible}.`;
      return { ok: false, motivo: "PRODUCTO", detalle };
    }

    // Las fotos de cada renglón, en el orden en que las pidió: todas tienen que estar bajadas.
    const idsFotos = [...new Set(datos.lineas.flatMap((l) => (l.fotos ?? []).map((f) => f.mensajeId)))];
    const mensajes = idsFotos.length > 0 ? new Map((await d.media(workspaceId, chat.id, idsFotos)).map((m) => [m.id, m])) : new Map<string, MensajeConMedia>();
    const porItem: FotosDelItem[] = [];
    let numeroFoto = 0;
    for (const [i, l] of datos.lineas.entries()) {
      const archivos: ArchivoDelChat[] = [];
      for (const f of l.fotos ?? []) {
        const m = mensajes.get(f.mensajeId);
        const clave = m ? claveDeMedia(m.media) : null;
        const archivo = m ? archivoDeMensaje(m.tipo, m.media) : null;
        if (!m || !clave || !archivo) return { ok: false, motivo: "FOTO_NO_LISTA" };
        numeroFoto++;
        archivos.push({ clave, nombre: nombreDeFoto(numeroFoto, archivo.nombre, archivo.mime, m.tipo), tipo: archivo.mime ?? "application/octet-stream", bytes: archivo.bytes ?? 0 });
      }
      if (archivos.length > 0) porItem.push({ itemIndex: elegidas.findIndex((x) => x.linea === i && !x.esCaja), archivos });
    }

    const ctx = await d.ctxDelDuenio(workspaceId);
    if (!ctx) return { ok: false, motivo: "SIN_DUENO" };

    const nombre = (datos.nombre || chat.nombre || "Cliente de WhatsApp").trim().slice(0, 120);
    const email = typeof datos.email === "string" && EMAIL.test(datos.email.trim()) ? datos.email.trim().toLowerCase().slice(0, 254) : null;
    const clientId = await d.cliente(workspaceId, chat, nombre, email);

    const total = Math.round(elegidas.reduce((s, l) => s + l.precio * l.cantidad, 0) * 100) / 100;
    const hoy = diaEnBuenosAires((d.ahora ?? (() => new Date()))());
    const clave = claveDelAlta(
      chat.id,
      elegidas.map((l) => ({ ...l, fotos: l.esCaja ? [] : (datos.lineas[l.linea]?.fotos ?? []).map((f) => f.mensajeId) })),
      datos.pago,
    );

    // Un pedido sin pagar por chat: si el cliente cambia lo que quiere, el anterior se cancela.
    for (const p of await d.pendientesDelChat(workspaceId, chat.id)) {
      if (p.altaKey !== clave) await d.cancelar(ctx, p.id);
    }

    const alta = await d.crear(ctx, {
      clientId,
      items: elegidas.map((l, i) => ({
        id: `wa${i + 1}`,
        productId: l.productId,
        nombre: l.nombre.slice(0, 200),
        descripcion: null,
        cantidad: l.cantidad,
        precioUnitario: l.precio,
        descuento: null,
        modoPrecio: "LISTA",
        calculo: null,
        seccion: null,
        opcional: false,
      })),
      descuento: null,
      opcion: datos.pago === "TOTAL" ? { tipo: "CONTADO" } : { tipo: "CUOTAS", cuotas: 2 },
      plan: planDelBot(total, datos.pago, hoy),
      eventLabel: "Pedido por WhatsApp",
      checklist: null,
      clave,
      // Cada renglón abre su trabajo; los que no tienen regla propia van a «Para retirar».
      paraRetirar: elegidas.map((_, i) => `wa${i + 1}`),
      // Lo que cuenta stock queda apartado hasta que se entrega o se cancela el pedido.
      apartar: elegidas.flatMap((l, i) =>
        disponibleDe(catalogo, l.productId, l.variantId) === null ? [] : [{ itemId: `wa${i + 1}`, productId: l.productId, variantId: l.variantId, cantidad: l.cantidad }],
      ),
    });
    if (!alta.ok) {
      console.warn("[pedidos/whatsapp] no se pudo crear el pedido", { codigo: "ALTA", error: alta.error });
      return { ok: false, motivo: "ERROR", detalle: alta.error };
    }
    const url = await d.enlace(workspaceId, alta.pedidoId);
    if (!url) return { ok: false, motivo: "SIN_ENLACE" };
    await d.avisar(workspaceId, alta.pedidoId).catch(() => undefined);
    // Un pedido repetido ya tiene sus fotos. Si la copia falla, el pedido sigue: las fotos están en la Bandeja.
    const fotos =
      porItem.length > 0 && !alta.repetido
        ? await d.guardarFotos(workspaceId, alta.pedidoId, porItem).catch((e) => {
            console.warn("[pedidos/whatsapp] no se pudieron copiar las fotos al trabajo", { codigo: (e as { code?: string } | null)?.code ?? "ERROR" });
            return 0;
          })
        : 0;

    // Los fotolibros: se crean en el editor y quedan atados a su trabajo, como en el Cobrador.
    if (libros.length > 0 && !alta.repetido) {
      await d.atarFotolibros(workspaceId, ctx.userId, { id: alta.pedidoId, numero: alta.numero }, nombre, libros).catch((e) => {
        console.warn("[pedidos/whatsapp] no se pudo preparar el fotolibro", { codigo: (e as { code?: string } | null)?.code ?? "ERROR" });
        return [];
      });
    }

    const { sena, saldo } = senaDe(total);
    return {
      ok: true,
      numero: alta.numero,
      lineas: elegidas.map((l) => ({ nombre: l.nombre, cantidad: l.cantidad, precio: l.precio })),
      total,
      aPagarAhora: datos.pago === "TOTAL" ? total : sena,
      saldo: datos.pago === "TOTAL" ? 0 : saldo,
      url,
      fotos,
    };
  } catch (e) {
    console.warn("[pedidos/whatsapp] falló el pedido del bot", { codigo: (e as { code?: string } | null)?.code ?? "ERROR" });
    return { ok: false, motivo: "ERROR" };
  }
}

const EXTENSION: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "application/pdf": "pdf" };

/** «Foto 3.jpg», o «Foto 3 - boda.jpg» si el cliente la mandó como documento con nombre. */
function nombreDeFoto(n: number, nombre: string, mime: string | null, tipo: string): string {
  const base = `Foto ${n}`;
  if (tipo === "DOCUMENTO" && nombre && nombre !== "archivo") return `${base} - ${nombre}`.slice(0, 180);
  return `${base}.${(mime && EXTENSION[mime]) ?? "jpg"}`;
}
