import "server-only";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { zipEnFlujo } from "@/lib/galerias/zip";
import { pagoAprobado } from "@/lib/galerias/venta-publica";
import { claveDeArchivo } from "@/lib/carpetas/reglas";
import { emitirEnlace } from "@/lib/carpetas/carpeta";
import { moverAFase } from "@/lib/proyectos/avance";
import { contextoDeSistema } from "@/lib/circuitos/acceso";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { subirFlujo } from "@/lib/carpetas/subir-servidor";
import { borrarArchivoGuardado } from "@/lib/carpetas/almacen";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { acreditarPagoImpresion, asegurarTrabajosDelPedido } from "./acreditar-servidor";
import { leerOriginal } from "./fuentes-servidor";
import { agruparPorLaboratorio, resumenParaLab, rutasDelZip } from "./carpeta-lab";
import { correoPedidoLab, esc } from "./correo-lab";
import { pedidoDeReferencia, referenciaPedido } from "./pago-servidor";
import { recorteEnPixeles } from "./recorte";
import type { Papel } from "./constantes";

/**
 * Preparar los pedidos pagados y mandarlos al laboratorio (lo corre el cron cada 5 minutos):
 *   1. toma el pedido con una escritura condicional (PAGADO → PREPARANDO; o un PREPARANDO trabado hace más de
 *      15 minutos, sumando un intento), así dos corridas nunca preparan el mismo. Al tercer intento trabado (un
 *      pedido enorme o una foto que tumba la función) no se insiste: queda PAGADO_SIN_ENVIAR y se avisa;
 *   2. si quedó sin trabajos (no había circuito al acreditar) los crea ahora;
 *   3. por laboratorio: recorta cada copia con sharp, arma UN ZIP ordenado (pedido / tamaño y papel / cantidad)
 *      que queda como archivo en la carpeta del trabajo, emite el enlace del laboratorio y le manda el correo
 *      "PARA MAÑANA" (en modo prueba, al estudio);
 *   4. marca el trabajo como enviado y lo pasa a "En el proveedor"; el pedido queda ENVIADO.
 * Ante cualquier falla el pedido queda PAGADO_SIN_ENVIAR con el motivo y se avisa al estudio, que lo reintenta
 * desde el trabajo o desde Configuración → Impresiones. Antes, concilia los pedidos sin pagar cuyo aviso de
 * Mercado Pago nunca llegó y vuelve a encolar los que esperaban un circuito de trabajo que ya existe.
 */

sharp.cache(false);
sharp.concurrency(1);
const BLOQUEO_VENCIDO_MS = 15 * 60 * 1000;
const MAX_PIXELES = 200_000_000;
const MINUTO = 60 * 1000;
/** Tres tomas trabadas y se corta (el intento que cuenta es el que se suma al retomar). */
const MAX_INTENTOS = 3;
/** La función dura hasta 300 s: pasados 200 no se empieza otro pedido (lo toma la próxima corrida). */
const PRESUPUESTO_MS = 200 * 1000;

const PREFIJO_SIN_CIRCUITO = "No hay un circuito de trabajo";
export const SIN_CIRCUITO_PARA_ENVIAR = `${PREFIJO_SIN_CIRCUITO} para crear el trabajo. Creá uno en Configuración → Circuitos y tocá «Reintentar envío».`;
export const PEDIDO_TRABADO =
  "El pedido es muy grande o una foto no se pudo procesar. Revisalo y tocá «Reintentar envío».";

type Item = {
  id: string; sourceKey: string; sourceName: string; widthCm: unknown; heightCm: unknown; quantity: number;
  cropX: number; cropY: number; cropW: number; cropH: number; proveedorId: string | null; proyectoId: string | null;
  sizeId?: string | null;
};

export async function recortarParaImprimir(original: Buffer, item: Pick<Item, "cropX" | "cropY" | "cropW" | "cropH">): Promise<Buffer> {
  const base = sharp(original, { limitInputPixels: MAX_PIXELES }).rotate();
  const { width = 0, height = 0, orientation = 1 } = await sharp(original, { limitInputPixels: MAX_PIXELES }).metadata();
  const [w, h] = orientation >= 5 ? [height, width] : [width, height];
  const px = recorteEnPixeles(w, h, { x: item.cropX, y: item.cropY, w: item.cropW, h: item.cropH });
  return base.extract(px).toColorspace("srgb").jpeg({ quality: 95, chromaSubsampling: "4:4:4" }).toBuffer();
}

export type DepsPreparar = {
  recortar?: (original: Buffer, item: Item) => Promise<Buffer>;
  leer?: (key: string) => Promise<Buffer>;
  subir?: typeof subirFlujo;
  enviar?: typeof sendTransactionalEmail;
  ahora?: () => Date;
};

const tomable = (ahora: Date) => ({
  OR: [{ status: "PAGADO" }, { status: "PREPARANDO", lockedAt: { lt: new Date(ahora.getTime() - BLOQUEO_VENCIDO_MS) } }],
});

/**
 * Toma el pedido: PAGADO → PREPARANDO; si no, un PREPARANDO vencido se retoma sumando un intento; y si ya se
 * trabó MAX_INTENTOS veces, se corta (PAGADO_SIN_ENVIAR) en vez de volver a procesarlo para siempre.
 */
async function tomar(pedidoId: string, ahora: Date): Promise<"TOMADO" | "TRABADO" | "OCUPADO"> {
  const orden = prisma.fotofficePrintOrder;
  const nuevo = await orden.updateMany({ where: { id: pedidoId, status: "PAGADO" }, data: { status: "PREPARANDO", lockedAt: ahora } });
  if (nuevo.count === 1) return "TOMADO";
  const vencido = { id: pedidoId, status: "PREPARANDO", lockedAt: { lt: new Date(ahora.getTime() - BLOQUEO_VENCIDO_MS) } };
  const retomado = await orden.updateMany({ where: { ...vencido, attempts: { lt: MAX_INTENTOS - 1 } }, data: { lockedAt: ahora, attempts: { increment: 1 } } });
  if (retomado.count === 1) return "TOMADO";
  const cortado = await orden.updateMany({
    where: vencido,
    data: { status: "PAGADO_SIN_ENVIAR", lockedAt: null, attempts: { increment: 1 }, lastError: PEDIDO_TRABADO },
  });
  return cortado.count === 1 ? "TRABADO" : "OCUPADO";
}

/**
 * Copias sin laboratorio (o con uno que ya no está activo): usan el laboratorio actual de su tamaño, si lo
 * tiene, y se anota en la copia. Así «Reintentar envío» funciona después de que el estudio arregla la
 * configuración. Las que siguen sin laboratorio fallan más adelante con su motivo.
 */
async function completarLaboratorios(workspaceId: string, items: Item[]): Promise<void> {
  const ids = [...new Set(items.map((i) => i.proveedorId).filter((x): x is string => !!x))];
  const activos = new Set(
    (await prisma.fotofficeProveedor.findMany({ where: { workspaceId, active: true, id: { in: ids } }, select: { id: true } })).map((x) => x.id),
  );
  const rotos = items.filter((i) => !i.proveedorId || !activos.has(i.proveedorId));
  const sizeIds = [...new Set(rotos.map((i) => i.sizeId).filter((x): x is string => !!x))];
  if (sizeIds.length === 0) return;
  const tamanos = await prisma.fotofficePrintSize.findMany({
    where: { workspaceId, id: { in: sizeIds } },
    select: { id: true, proveedorId: true, proveedor: { select: { active: true } } },
  });
  const actual = new Map(tamanos.filter((t) => t.proveedorId && t.proveedor?.active).map((t) => [t.id, t.proveedorId!]));
  for (const i of rotos) {
    const nuevo = i.sizeId ? actual.get(i.sizeId) : undefined;
    if (!nuevo || nuevo === i.proveedorId) continue;
    await prisma.fotofficePrintOrderItem.update({ where: { id: i.id }, data: { proveedorId: nuevo } });
    i.proveedorId = nuevo;
  }
}

/** Un reintento no deja dos ZIP iguales en la carpeta del trabajo: se borra el anterior (fila y objeto). */
async function borrarZipAnterior(workspaceId: string, proyectoId: string, nombre: string): Promise<void> {
  const previos = await prisma.fotofficeArchivoTrabajo.findMany({ where: { workspaceId, proyectoId, nombre }, select: { id: true, key: true } });
  if (previos.length === 0) return;
  for (const a of previos) await borrarArchivoGuardado(a.key);
  await prisma.fotofficeArchivoTrabajo.deleteMany({ where: { id: { in: previos.map((a) => a.id) }, workspaceId } });
}

/** Orden dentro del ZIP: por tamaño (lado corto, lado largo), después cantidad y nombre. */
function ordenarParaZip<T extends { widthCm: number; heightCm: number; quantity: number; sourceName: string }>(items: T[]): T[] {
  const corto = (i: T) => Math.min(i.widthCm, i.heightCm);
  const largo = (i: T) => Math.max(i.widthCm, i.heightCm);
  return [...items].sort((a, b) => corto(a) - corto(b) || largo(a) - largo(b) || a.quantity - b.quantity || a.sourceName.localeCompare(b.sourceName, "es"));
}

export async function prepararPedido(pedidoId: string, deps: DepsPreparar = {}): Promise<"ENVIADO" | "PAGADO_SIN_ENVIAR" | "OCUPADO"> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const toma = await tomar(pedidoId, ahora);
  if (toma === "OCUPADO") return "OCUPADO";
  const recortar = deps.recortar ?? recortarParaImprimir;
  const leer = deps.leer ?? leerOriginal;
  const subir = deps.subir ?? subirFlujo;
  const enviar = deps.enviar ?? sendTransactionalEmail;

  let p = await prisma.fotofficePrintOrder.findUniqueOrThrow({ where: { id: pedidoId }, include: { items: true } });
  const ws = p.workspaceId;
  if (toma === "TRABADO") {
    await avisarFallaAlEstudio(ws, p.number, PEDIDO_TRABADO, enviar).catch(() => undefined);
    return "PAGADO_SIN_ENVIAR";
  }

  try {
    // Antes de crear trabajos: así el trabajo nace con el laboratorio correcto.
    await completarLaboratorios(ws, p.items as Item[]);

    // Sin trabajos (no había circuito al acreditar): se crean ahora; sin circuito, no se puede seguir.
    if (p.items.some((i) => !i.proyectoId)) {
      const r = await asegurarTrabajosDelPedido(ws, pedidoId, ahora);
      if (r === "SIN_CIRCUITO") throw new Error(SIN_CIRCUITO_PARA_ENVIAR);
      if (r !== "OK") throw new Error("El pedido no tiene trabajo creado.");
      p = await prisma.fotofficePrintOrder.findUniqueOrThrow({ where: { id: pedidoId }, include: { items: true } });
      if (p.items.some((i) => !i.proyectoId)) throw new Error("El pedido no tiene trabajo creado.");
    }

    const proyectoIds = [...new Set(p.items.map((i) => i.proyectoId!))];
    const [ajustes, branding, proveedores, trabajos] = await Promise.all([
      prisma.fotofficePrintSettings.findUnique({ where: { workspaceId: ws } }),
      prisma.fotofficeWorkspaceBranding.findFirst({ where: { workspaceId: ws }, select: { commercialName: true, contactEmail: true } }),
      prisma.fotofficeProveedor.findMany({ where: { workspaceId: ws, active: true, id: { in: p.items.map((i) => i.proveedorId).filter((x): x is string => !!x) } } }),
      prisma.fotofficeProyecto.findMany({ where: { workspaceId: ws, id: { in: proyectoIds } }, select: { id: true, proveedorEnviadoAt: true } }),
    ]);
    const prueba = ajustes?.testMode ?? true;
    const porProveedor = new Map(proveedores.map((x) => [x.id, x]));
    // En un reintento, el laboratorio que ya recibió su parte no la recibe de nuevo.
    const yaEnviados = new Set(trabajos.filter((t) => t.proveedorEnviadoAt).map((t) => t.id));
    const limpiados = new Set<string>();

    for (const [proveedorId, items] of agruparPorLaboratorio(p.items as Item[])) {
      const proyectoId = items[0].proyectoId!;
      if (yaEnviados.has(proyectoId)) continue;
      const prov = proveedorId ? porProveedor.get(proveedorId) : undefined;
      if (!prov) throw new Error("Hay copias sin laboratorio asignado.");
      const destino = prueba ? branding?.contactEmail : prov.email;
      if (!destino) throw new Error(prueba ? "El estudio no tiene correo de contacto para el modo prueba." : `${prov.name} no tiene correo cargado.`);

      const ordenados = ordenarParaZip(items.map((i) => ({ ...i, widthCm: Number(i.widthCm), heightCm: Number(i.heightCm) })));
      const paraLab = ordenados.map((i) => ({ itemId: i.id, proveedorId, widthCm: i.widthCm, heightCm: i.heightCm, quantity: i.quantity, sourceName: i.sourceName }));
      const rutas = new Map(rutasDelZip(p.number, p.nombre, p.paper as Papel, paraLab).map((r) => [r.itemId, r.ruta]));
      const archivos = ordenados.map((i) => ({
        nombre: rutas.get(i.id)!,
        fecha: ahora,
        abrir: async () => {
          // Si una copia falla, el pedido no sale incompleto: se corta todo el ZIP.
          try {
            const jpg = await recortar(await leer(i.sourceKey), i);
            return (async function* () {
              yield new Uint8Array(jpg);
            })();
          } catch (e) {
            throw new Error(`No se pudo preparar ${i.sourceName}: ${(e as Error).message}`);
          }
        },
      }));

      const archivoId = randomUUID();
      const nombreZip = `Pedido-${p.number}.zip`;
      if (!limpiados.has(proyectoId)) {
        await borrarZipAnterior(ws, proyectoId, nombreZip);
        limpiados.add(proyectoId);
      }
      const clave = claveDeArchivo(ws, proyectoId, archivoId, nombreZip);
      const bytes = await subir(clave, zipEnFlujo(archivos, undefined, { conCarpetas: true }), "application/zip");
      await prisma.fotofficeArchivoTrabajo.create({
        data: { id: archivoId, workspaceId: ws, proyectoId, key: clave, nombre: nombreZip, tipo: "application/zip", bytes: BigInt(bytes), estado: "LISTO" },
      });
      const enlace = await emitirEnlace(ws, proyectoId, "LABORATORIO", ahora);
      if (!enlace.ok) throw new Error(enlace.error);

      const correo = correoPedidoLab({
        estudio: branding?.commercialName ?? "El estudio",
        laboratorio: prov.name,
        numero: p.number,
        cliente: p.nombre,
        enlace: enlace.url,
        vence: enlace.vence.slice(0, 10),
        resumen: resumenParaLab(paraLab, p.paper as Papel),
        prueba,
      });
      const r = await enviar({ to: destino, ...correo, sender: await loadWorkspaceSender(ws) });
      if (r.status !== "SENT") throw new Error(`El correo a ${prov.name} no salió (${r.status}).`);

      await prisma.fotofficeProyecto.update({ where: { id: proyectoId }, data: { proveedorEnviadoAt: ahora } });
      // Mover de etapa es un plus: si el recorrido no lo permite (tareas obligatorias), el pedido igual salió.
      await moverAFase(contextoDeSistema(ws), proyectoId, "EN_PROVEEDOR", `Pedido de impresión ${p.number} enviado a ${prov.name}${prueba ? " (modo prueba)" : ""}.`).catch(() => undefined);
    }
    await prisma.fotofficePrintOrder.update({ where: { id: pedidoId }, data: { status: "ENVIADO", sentAt: ahora, lockedAt: null, lastError: null } });
    return "ENVIADO";
  } catch (e) {
    const lastError = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    await prisma.fotofficePrintOrder.update({ where: { id: pedidoId }, data: { status: "PAGADO_SIN_ENVIAR", lockedAt: null, lastError, attempts: { increment: 1 } } });
    await avisarFallaAlEstudio(ws, p.number, lastError, enviar).catch(() => undefined);
    return "PAGADO_SIN_ENVIAR";
  }
}

const QUE_HACER = "Entrá a FOTOFFICE → Configuración → Impresiones (o al trabajo, si existe) y tocá «Reintentar envío».";

async function avisarFallaAlEstudio(workspaceId: string, numero: number, error: string, enviar: typeof sendTransactionalEmail) {
  const b = await prisma.fotofficeWorkspaceBranding.findFirst({ where: { workspaceId }, select: { contactEmail: true } });
  if (!b?.contactEmail) return;
  await enviar({
    to: b.contactEmail,
    sender: await loadWorkspaceSender(workspaceId),
    subject: `El pedido de impresión ${numero} no se pudo mandar al laboratorio`,
    text: `El pedido ${numero} está pagado pero no salió al laboratorio.\n\nMotivo: ${error}\n\n${QUE_HACER}`,
    html: `<p>El pedido <strong>${numero}</strong> está pagado pero no salió al laboratorio.</p><p>Motivo: ${esc(error)}</p><p>${esc(QUE_HACER)}</p>`,
  });
}

/**
 * Pedidos sin pagar de entre 10 minutos y 3 días (con o sin preferencia anotada: la búsqueda es por la
 * referencia del pedido, que viaja aunque no se haya podido guardar la preferencia): se le pregunta a Mercado Pago (con el
 * token del estudio) si hay un pago aprobado por la referencia del pedido y, si lo hay, se acredita. Cubre el
 * aviso de Mercado Pago que nunca llegó y el comprador que no volvió. Las fallas se anotan y se saltean.
 */
async function conciliarPagos(ahora: Date): Promise<void> {
  const pendientes = await prisma.fotofficePrintOrder.findMany({
    where: {
      status: "PENDIENTE_PAGO",
      createdAt: { gte: new Date(ahora.getTime() - 3 * 24 * 60 * MINUTO), lte: new Date(ahora.getTime() - 10 * MINUTO) },
    },
    orderBy: { updatedAt: "asc" },
    take: 5,
    select: { id: true, workspaceId: true },
  });
  for (const { id, workspaceId } of pendientes) {
    try {
      const collector = await resolveWorkspaceCollector(workspaceId);
      if (collector.ok) {
        const adapter = createMercadoPagoCheckoutProLiveAdapter({ accessToken: collector.collector.accessToken });
        const pago = await adapter.searchPaymentsByExternalReference(referenciaPedido(id));
        if (pago && pedidoDeReferencia(pago.externalReference) === id && pagoAprobado(pago)) {
          const r = await acreditarPagoImpresion(workspaceId, pago);
          if (!r.ok) console.warn("[impresiones] pago conciliado sin acreditar", { pedidoId: id, codigo: r.error });
        }
      }
      // Se toca el pedido para que la próxima corrida mire otros (rota por `updatedAt`).
      await prisma.fotofficePrintOrder.updateMany({ where: { id, status: "PENDIENTE_PAGO" }, data: { lockedAt: null } });
    } catch (error) {
      console.warn("[impresiones] no se pudo conciliar el pago", { pedidoId: id, detalle: sanitizeError(error) });
    }
  }
}

/**
 * Los pedidos que quedaron PAGADO_SIN_ENVIAR por falta de circuito vuelven a PAGADO solos cuando el estudio ya
 * tiene un circuito de trabajo (con el mismo criterio con el que se crean los trabajos). Una consulta, hasta 3.
 */
async function reencolarLosQueEsperabanCircuito(): Promise<void> {
  const listos = await prisma.fotofficePrintOrder.findMany({
    where: {
      status: "PAGADO_SIN_ENVIAR",
      lastError: { startsWith: PREFIJO_SIN_CIRCUITO },
      workspace: { fotofficeCircuits: { some: { kind: "TRABAJO", isActive: true, stages: { some: { archivedAt: null } } } } },
    },
    orderBy: { updatedAt: "asc" },
    take: 3,
    select: { id: true },
  });
  for (const { id } of listos) {
    await prisma.fotofficePrintOrder.updateMany({
      where: { id, status: "PAGADO_SIN_ENVIAR" },
      data: { status: "PAGADO", lastError: null, lockedAt: null, attempts: 0 },
    });
  }
}

/** `preparar: false` (sin almacenamiento configurado): sólo concilia los pagos. */
export async function procesarPedidosDeImpresion(
  deps: DepsPreparar = {},
  opciones: { preparar?: boolean } = {},
): Promise<{ procesados: number; enviados: number; fallidos: number }> {
  const reloj = deps.ahora ?? (() => new Date());
  const ahora = reloj();
  await conciliarPagos(ahora).catch((error) => console.warn("[impresiones] falló la conciliación de pagos", { detalle: sanitizeError(error) }));
  if (opciones.preparar === false) return { procesados: 0, enviados: 0, fallidos: 0 };
  await reencolarLosQueEsperabanCircuito().catch((error) => console.warn("[impresiones] no se pudieron reencolar pedidos", { detalle: sanitizeError(error) }));
  const pendientes = await prisma.fotofficePrintOrder.findMany({ where: tomable(ahora), orderBy: { paidAt: "asc" }, take: 3, select: { id: true } });
  let procesados = 0;
  let enviados = 0;
  let fallidos = 0;
  for (const { id } of pendientes) {
    if (reloj().getTime() - ahora.getTime() > PRESUPUESTO_MS) break;
    procesados++;
    try {
      const r = await prepararPedido(id, deps);
      if (r === "ENVIADO") enviados++;
      if (r === "PAGADO_SIN_ENVIAR") fallidos++;
    } catch (error) {
      // Una falla fuera de la preparación (la base) no frena a los demás pedidos.
      fallidos++;
      console.error("[impresiones] falló la preparación de un pedido", { pedidoId: id, detalle: sanitizeError(error) });
    }
  }
  return { procesados, enviados, fallidos };
}
