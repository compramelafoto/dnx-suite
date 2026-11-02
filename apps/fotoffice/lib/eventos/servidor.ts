import "server-only";
import { prisma, Prisma } from "@repo/db";
import { PEDIDO_ANULADO, PEDIDO_PAGADO, type EstadoPago } from "./constants";
import { generarCodigo, unidadesDeEntrada } from "./reglas";
import type { DatosEvento, DatosInscripto } from "./validar";

/**
 * Lo que toca la base en el módulo de eventos. Todas las funciones reciben el `workspaceId` y lo
 * ponen en el `where`: un evento de otro negocio no se ve ni se toca aunque se adivine su id.
 */

type Db = Prisma.TransactionClient | typeof prisma;

export async function listarEventos(workspaceId: string) {
  const eventos = await prisma.fotofficeEvento.findMany({
    where: { workspaceId },
    orderBy: [{ archivado: "asc" }, { fechaInicio: "desc" }, { createdAt: "desc" }],
  });
  const conteos = await prisma.fotofficeEventoInscripto.groupBy({
    by: ["eventoId"],
    where: { workspaceId, estadoPago: { not: "ANULADO" } },
    _count: { _all: true, acreditadoAt: true },
  });
  const porEvento = new Map(conteos.map((c) => [c.eventoId, c._count]));
  return eventos.map((e) => ({
    ...e,
    inscriptos: porEvento.get(e.id)?._all ?? 0,
    acreditados: porEvento.get(e.id)?.acreditadoAt ?? 0,
  }));
}

export async function obtenerEvento(workspaceId: string, eventoId: string) {
  return prisma.fotofficeEvento.findFirst({ where: { id: eventoId, workspaceId }, include: { entradas: true } });
}

export async function crearEvento(workspaceId: string, d: DatosEvento): Promise<string> {
  const e = await prisma.fotofficeEvento.create({ data: { workspaceId, ...d }, select: { id: true } });
  return e.id;
}

export async function actualizarEvento(workspaceId: string, eventoId: string, d: DatosEvento & { archivado?: boolean }) {
  await prisma.fotofficeEvento.updateMany({ where: { id: eventoId, workspaceId }, data: d });
}

/** Los productos activos del negocio, para elegir cuáles son entradas. */
export async function productosParaEntradas(workspaceId: string) {
  return prisma.product.findMany({
    where: { workspaceId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, priceArs: true },
  });
}

/** Los formularios del sitio del negocio, para elegir cuáles anotan en el evento. */
export async function formulariosDelSitio(workspaceId: string) {
  return prisma.fotofficeSitioFormulario.findMany({
    where: { workspaceId, origen: "SITIO" },
    orderBy: { nombre: "asc" },
    select: { clave: true, nombre: true, _count: { select: { envios: true } } },
  });
}

export async function vincularEntrada(workspaceId: string, eventoId: string, productId: string, tipo: string | null) {
  const [evento, producto] = await Promise.all([
    prisma.fotofficeEvento.findFirst({ where: { id: eventoId, workspaceId }, select: { id: true } }),
    prisma.product.findFirst({ where: { id: productId, workspaceId }, select: { id: true } }),
  ]);
  if (!evento || !producto) return false;
  await prisma.fotofficeEventoEntrada.upsert({
    where: { productId },
    create: { workspaceId, eventoId, productId, tipo },
    update: { eventoId, tipo },
  });
  return true;
}

export async function desvincularEntrada(workspaceId: string, entradaId: string) {
  await prisma.fotofficeEventoEntrada.deleteMany({ where: { id: entradaId, workspaceId } });
}

export async function cambiarFormularios(workspaceId: string, eventoId: string, claves: string[]) {
  const validas = await prisma.fotofficeSitioFormulario.findMany({
    where: { workspaceId, clave: { in: claves } },
    select: { clave: true },
  });
  await prisma.fotofficeEvento.updateMany({
    where: { id: eventoId, workspaceId },
    data: { formularioClaves: validas.map((v) => v.clave) },
  });
}

/** Un código que no existe todavía (la tabla tiene el código único: se reintenta si choca). */
async function codigoLibre(db: Db): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const c = generarCodigo();
    const ya = await db.fotofficeEventoInscripto.findUnique({ where: { codigo: c }, select: { id: true } });
    if (!ya) return c;
  }
  return generarCodigo(Math.random, 10);
}

/**
 * Trae al listado lo que llegó por la tienda y por los formularios y todavía no está. Idempotente:
 * cada unidad de un ítem y cada envío entran una sola vez (índices únicos), así que se puede
 * llamar al abrir la pantalla y después de cada pago sin miedo a duplicar.
 *
 * Además baja a ANULADO las entradas de pedidos cancelados que nadie acreditó todavía.
 */
export async function sincronizarInscriptos(workspaceId: string): Promise<{ nuevos: number }> {
  let nuevos = 0;
  const entradas = await prisma.fotofficeEventoEntrada.findMany({ where: { workspaceId } });

  if (entradas.length > 0) {
    const productIds = entradas.map((e) => e.productId);
    const pedidos = await prisma.storeOrder.findMany({
      where: { workspaceId, status: { in: [...PEDIDO_PAGADO] }, items: { some: { productId: { in: productIds } } } },
      select: {
        id: true,
        buyerName: true,
        buyerEmail: true,
        buyerPhone: true,
        items: { select: { id: true, productId: true, productName: true, variantName: true, qty: true, unitPriceArs: true } },
      },
    });
    const yaCargados = new Set(
      (
        await prisma.fotofficeEventoInscripto.findMany({
          where: { workspaceId, storeOrderId: { in: pedidos.map((p) => p.id) } },
          select: { storeOrderItemId: true, unidad: true },
        })
      ).map((r) => `${r.storeOrderItemId}:${r.unidad}`),
    );
    for (const p of pedidos) {
      const unidades = unidadesDeEntrada(
        p.items.map((it) => ({ ...it, unitPriceArs: it.unitPriceArs.toString() })),
        entradas,
      ).filter((u) => !yaCargados.has(`${u.storeOrderItemId}:${u.unidad}`));
      for (const u of unidades) {
        try {
          await prisma.fotofficeEventoInscripto.create({
            data: {
              workspaceId,
              eventoId: u.eventoId,
              nombre: p.buyerName,
              email: p.buyerEmail || null,
              telefono: p.buyerPhone,
              tipo: u.tipo,
              origen: "TIENDA",
              estadoPago: "PAGADO",
              montoArs: u.montoArs,
              storeOrderId: p.id,
              storeOrderItemId: u.storeOrderItemId,
              unidad: u.unidad,
              codigo: await codigoLibre(prisma),
            },
          });
          nuevos++;
        } catch (e) {
          // Dos sincronizaciones a la vez: la otra ya lo cargó (índice único). No es un error.
          if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
        }
      }
    }

    const anulados = await prisma.storeOrder.findMany({
      where: { workspaceId, status: { in: [...PEDIDO_ANULADO] } },
      select: { id: true },
    });
    if (anulados.length > 0) {
      await prisma.fotofficeEventoInscripto.updateMany({
        where: { workspaceId, origen: "TIENDA", storeOrderId: { in: anulados.map((a) => a.id) }, acreditadoAt: null },
        data: { estadoPago: "ANULADO" },
      });
    }
  }

  const conFormularios = await prisma.fotofficeEvento.findMany({
    where: { workspaceId, archivado: false, NOT: { formularioClaves: { isEmpty: true } } },
    select: { id: true, formularioClaves: true },
  });
  for (const ev of conFormularios) {
    const envios = await prisma.fotofficeSitioFormularioEnvio.findMany({
      where: {
        workspaceId,
        formulario: { clave: { in: ev.formularioClaves } },
        estado: { not: "ARCHIVADO" },
      },
      select: { id: true, nombre: true, email: true, telefono: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    if (envios.length === 0) continue;
    const ya = new Set(
      (
        await prisma.fotofficeEventoInscripto.findMany({
          where: { formularioEnvioId: { in: envios.map((e) => e.id) } },
          select: { formularioEnvioId: true },
        })
      ).map((r) => r.formularioEnvioId),
    );
    for (const env of envios) {
      if (ya.has(env.id)) continue;
      try {
        await prisma.fotofficeEventoInscripto.create({
          data: {
            workspaceId,
            eventoId: ev.id,
            nombre: env.nombre?.trim() || env.email || "Sin nombre",
            email: env.email,
            telefono: env.telefono,
            origen: "FORMULARIO",
            estadoPago: "PENDIENTE",
            formularioEnvioId: env.id,
            codigo: await codigoLibre(prisma),
            createdAt: env.createdAt,
          },
        });
        nuevos++;
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      }
    }
  }
  return { nuevos };
}

export async function listarInscriptos(workspaceId: string, eventoId: string) {
  return prisma.fotofficeEventoInscripto.findMany({
    where: { workspaceId, eventoId },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function agregarInscripto(workspaceId: string, eventoId: string, d: DatosInscripto) {
  const evento = await prisma.fotofficeEvento.findFirst({ where: { id: eventoId, workspaceId }, select: { id: true } });
  if (!evento) return false;
  await prisma.fotofficeEventoInscripto.create({
    data: { workspaceId, eventoId, ...d, origen: "MANUAL", codigo: await codigoLibre(prisma) },
  });
  return true;
}

/** Corrige los datos de la persona; el estado de pago se cambia aparte (`cambiarEstadoPago`). */
export async function editarInscripto(workspaceId: string, id: string, d: DatosInscripto) {
  await prisma.fotofficeEventoInscripto.updateMany({
    where: { id, workspaceId },
    data: { nombre: d.nombre, email: d.email, telefono: d.telefono, dni: d.dni, tipo: d.tipo, montoArs: d.montoArs, notas: d.notas },
  });
}

export async function cambiarEstadoPago(workspaceId: string, id: string, estadoPago: EstadoPago) {
  await prisma.fotofficeEventoInscripto.updateMany({ where: { id, workspaceId }, data: { estadoPago } });
}

/** Acredita (o deshace la acreditación). Devuelve el inscripto para mostrarlo en la puerta. */
export async function acreditar(workspaceId: string, id: string, userId: number, si: boolean) {
  await prisma.fotofficeEventoInscripto.updateMany({
    where: { id, workspaceId },
    data: si ? { acreditadoAt: new Date(), acreditadoPorUserId: userId } : { acreditadoAt: null, acreditadoPorUserId: null },
  });
}

/**
 * Quita a alguien del listado. Los de un formulario archivan además su envío (si no, la próxima
 * sincronización los volvería a traer). Los de la tienda no se borran: un pedido pagado es un
 * pedido pagado; para sacarlos se los pasa a "Anulado".
 */
export async function eliminarInscripto(workspaceId: string, id: string) {
  const i = await prisma.fotofficeEventoInscripto.findFirst({
    where: { id, workspaceId },
    select: { origen: true, formularioEnvioId: true },
  });
  if (!i || i.origen === "TIENDA") return;
  await prisma.$transaction(async (tx) => {
    if (i.formularioEnvioId) {
      await tx.fotofficeSitioFormularioEnvio.updateMany({
        where: { id: i.formularioEnvioId, workspaceId },
        data: { estado: "ARCHIVADO" },
      });
    }
    await tx.fotofficeEventoInscripto.deleteMany({ where: { id, workspaceId } });
  });
}
