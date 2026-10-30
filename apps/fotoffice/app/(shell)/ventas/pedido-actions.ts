"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { avisarPedidoRecibido } from "@/lib/pedidos/aviso-pedido-servidor";
import { enviarTrabajosDelPedidoAlProveedor } from "@/lib/proyectos/proveedor";
import { prisma } from "@repo/db";
import { requireSalesStaff } from "@/lib/sales/access";
import { SALE_PAYMENT_METHODS, type SalePaymentMethod } from "@/lib/sales/constants";
import { contextoDePedidos } from "@/lib/pedidos/contexto";
import { crearPedidoManual, leerPedido } from "@/lib/pedidos/pedidos";
import { registrarCobro } from "@/lib/pedidos/cobros";
import { faseDeEtapa } from "@/lib/proyectos/en-curso-puro";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { formatMinorArs } from "@/lib/membership/money";
import { avisoCobroRepetido, diasEntre, reintentarSenaRepetida, repartirDescuento, separarTicket, type SenaRepetida } from "@/lib/sales/pedido-mostrador";
import { checkoutAction, type CheckoutInput } from "./actions";
import { buscarPagosParaCobrar, confirmarUsoPagoMp, liberarPagoMp, reservarCobroMp, type ResultadoBusquedaPago } from "@/lib/sales/verificar-pago-servidor";
import { notaDePagoVerificado } from "@/lib/sales/verificar-pago";
import { cancelarOrdenQr, consultarOrdenQr, crearOrdenQr } from "@/lib/sales/qr-mp-servidor";
import type { OrdenQr } from "@/lib/sales/qr-mp";
import { leerFotolibroVendido } from "@/lib/fotolibro/venta";
import { atarFotolibrosAlPedido } from "@/lib/fotolibro/venta-servidor";
import { clientDisplayName } from "@/lib/clients/display";
import { DIGITALIZACION_MODULE_KEY } from "@/lib/digitalizacion/constants";
import { trabajosDeDigitalizacionDelPedido } from "@/lib/digitalizacion/servidor/trabajo";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import {
  anotarFalloDeLaboratorio,
  comprobarTicketDeLaboratorio,
  crearPedidoDeMostrador,
  flujosQueNoSirven,
  mensajeFlujoQueNoSirve,
  preparacionYaCobrada,
} from "@/lib/impresiones/mostrador-servidor";

/**
 * El Mostrador con trabajos "con proceso" o renglones marcados «Seña». Esa parte se vuelve un pedido (con su seña
 * como primer cobro, que entra a Caja una sola vez) y genera sus trabajos; lo que se lleva en el
 * momento sigue siendo una venta común (`checkoutAction`), pagada entera.
 *
 * No es una sola transacción: pedido, cobro y venta tienen cada uno la suya. Se hacen en ese
 * orden (el pedido es lo que más puede fallar por validación) y, si algo falla después de crear
 * el pedido, la respuesta lo dice con su número para terminarlo desde la ficha. La clave del cobro
 * es también la del alta del pedido: si el mismo cobro vuelve (doble clic, reintento después de un
 * corte), se devuelve el pedido que ya existe sin cobrar ni vender otra vez.
 */

export type LineaMostrador = {
  productId: string | null;
  variantId: string | null;
  description: string;
  qty: number;
  unitPriceMinor: number;
  /**
   * El cajero lo marcó «Seña»: un producto sin proceso (o un renglón a mano) que el cliente deja
   * señado y retira después. Va al pedido y abre su trabajo en «Para retirar». En un producto con
   * proceso no cambia nada: ése va al pedido siempre.
   */
  paraRetirar?: boolean;
  /** El libro de un producto de fotolibro: lo elegido en la calculadora (ver `lib/fotolibro/venta.ts`). */
  fotolibro?: unknown;
  /** Renglón del «Pedido para laboratorio» (las copias de una preparación): va siempre al pedido. */
  paraLaboratorio?: boolean;
};

export type CobroConPedidoInput = {
  lines: LineaMostrador[];
  discountMinor: number;
  paymentMethod: string;
  note: string;
  clientId: string;
  /** "aaaa-mm-dd". */
  entrega: string;
  /** Lo que deja de seña para el pedido; null = paga el pedido entero. */
  senaMinor: number | null;
  /** Clave única del cobro (doble clic = un solo cobro). */
  clave: string;
  /** El cobro de Mercado Pago que "Verificar pago" encontró (opcional). */
  mpPaymentId?: string | null;
  /** La order del QR del mostrador ya pagada (opcional). */
  mpOrderId?: string | null;
  /** La preparación de las fotos de los renglones `paraLaboratorio` (opcional). */
  laboratorio?: { preparacionId: string } | null;
};

/** Un trabajo de digitalización que creó el cobro: la pantalla ofrece «Ir a grabar» (`/digitalizacion/grabar?proyecto=`). */
export type TrabajoParaGrabar = { proyectoId: string; numero: string; nombre: string };

export type CobroConPedidoResult =
  | {
      ok: true;
      pedidoId: string;
      pedidoNumero: string;
      cobradoMinor: number;
      saldoMinor: number;
      saleNumber: number | null;
      aviso: string | null;
      /** Vacío si no hay trabajos de digitalización o quien cobra no puede grabar. */
      grabar: TrabajoParaGrabar[];
      /** Los laboratorios a los que va el pedido para laboratorio (vacío si no hay). */
      laboratorios: string[];
    }
  | { ok: false; error: string };

const CLAVE = /^[A-Za-z0-9_-]{8,90}$/;
const pesos = (minor: number) => Math.round(minor) / 100;

/** Qué productos del ticket llevan proceso: los que tienen un flujo de trabajo en "Proyecto que genera". */
async function conProceso(workspaceId: string, productIds: string[]): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const filas = await prisma.fotofficeProductoProyecto.findMany({
    where: { workspaceId, productId: { in: productIds } },
    select: { productId: true },
  });
  return new Set(filas.map((f) => f.productId));
}

/**
 * Los trabajos de digitalización del pedido recién creado, para el «Ir a grabar» de la pantalla
 * del cobro: sólo con el módulo encendido y permiso de gestión en Digitalización (la estación lo
 * vuelve a exigir). Nunca corta el cobro: si falla, no se ofrece el acceso.
 */
async function trabajosParaGrabar(workspaceId: string, userId: number, pedidoId: string): Promise<TrabajoParaGrabar[]> {
  try {
    if (!hasLevel(await getModuleLevel(userId, workspaceId, DIGITALIZACION_MODULE_KEY), "MANAGE")) return [];
    const trabajos = await trabajosDeDigitalizacionDelPedido(workspaceId, pedidoId);
    return trabajos.map((t) => ({ proyectoId: t.id, numero: t.numero, nombre: t.nombre }));
  } catch (e) {
    console.error("[cobrador] trabajos para grabar", e);
    return [];
  }
}

/**
 * Después de crear el pedido: el pedido de impresión de mostrador con las fotos de la preparación.
 * El cobro ya está hecho y no se deshace: si algo falla, vuelve como aviso para el cajero y cada
 * trabajo de laboratorio del pedido queda con una nota que nombra la preparación (para retomarla).
 */
async function pedidoParaLaboratorio(
  workspaceId: string,
  preparacionId: string,
  d: { pedidoId: string; numero: string; clientId: string; delPedido: readonly LineaMostrador[] },
): Promise<{ laboratorios: string[]; aviso: string | null }> {
  const itemIndexes = d.delPedido.flatMap((l, itemIndex) => (l.paraLaboratorio === true ? [itemIndex] : []));
  const fallo = async (error: string, detalle: string = error) => {
    await anotarFalloDeLaboratorio({ workspaceId, pedidoId: d.pedidoId, preparacionId, itemIndexes, error: detalle }).catch((e) =>
      console.error("[cobrador][laboratorio] nota del fallo", { pedido: d.numero, preparacionId }, e),
    );
    return {
      laboratorios: [],
      aviso: `El pedido ${d.numero} quedó cobrado, pero las fotos no se prepararon: ${error.replace(/\.$/, "")}. Avisá a sistemas.`,
    };
  };
  try {
    const c = await prisma.client.findFirst({
      where: { id: d.clientId, workspaceId },
      select: { kind: true, firstName: true, lastName: true, businessName: true },
    });
    const r = await crearPedidoDeMostrador({
      workspaceId,
      preparacionId,
      pedidoId: d.pedidoId,
      clientId: d.clientId,
      nombreCliente: c ? clientDisplayName(c) : "Cliente del mostrador",
      lineasDelPedido: d.delPedido.flatMap((l, itemIndex) => (l.paraLaboratorio === true ? [{ productId: l.productId, itemIndex }] : [])),
    });
    if (r.ok) return { laboratorios: r.laboratorios, aviso: null };
    console.error("[cobrador][laboratorio]", { pedido: d.numero, preparacionId, error: r.error });
    return await fallo(r.error);
  } catch (e) {
    console.error("[cobrador][laboratorio]", { pedido: d.numero, preparacionId }, e);
    return await fallo("error inesperado", e instanceof Error && e.message ? e.message.slice(0, 300) : "error inesperado");
  }
}

export async function cobrarConPedidoAction(input: CobroConPedidoInput): Promise<CobroConPedidoResult> {
  const { workspace, user } = await requireSalesStaff();
  const ctx = await contextoDePedidos("operar");
  if (!ctx || ctx.workspaceId !== workspace.id) return { ok: false, error: "No tenés permiso para crear pedidos." };

  const metodo = input.paymentMethod as SalePaymentMethod;
  if (!SALE_PAYMENT_METHODS.includes(metodo)) return { ok: false, error: "Elegí un medio de pago." };
  if (!input.clientId) return { ok: false, error: "Elegí el cliente: es un pedido para retirar." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.entrega)) return { ok: false, error: "Elegí la fecha de entrega." };
  if (typeof input.clave !== "string" || !CLAVE.test(input.clave)) return { ok: false, error: "Volvé a apretar Cobrar." };
  if (!Array.isArray(input.lines) || input.lines.length === 0) return { ok: false, error: "Agregá algo al ticket antes de cobrar." };
  for (const l of input.lines) {
    if (!Number.isInteger(l.qty) || l.qty <= 0 || !Number.isInteger(l.unitPriceMinor) || l.unitPriceMinor < 0) {
      return { ok: false, error: "Hay un renglón con cantidad o precio que no se entiende." };
    }
  }
  if (!Number.isInteger(input.discountMinor) || input.discountMinor < 0) return { ok: false, error: "El descuento no se entiende." };

  // El «Pedido para laboratorio»: el ticket tiene que decir lo mismo que las fotos preparadas. Un
  // producto sin regla abre su trabajo en «Para retirar»; uno con regla necesita que su flujo sirva
  // (si se saltea no hay trabajo al que atar las fotos), y eso se dice antes de cobrar.
  const lineasLab = input.lines.filter((l) => l.paraLaboratorio === true);
  const preparacionId = input.laboratorio && typeof input.laboratorio.preparacionId === "string" ? input.laboratorio.preparacionId : null;
  // El mismo cobro que vuelve (ya hay pedido con esta clave) cuya preparación ya se cobró (LISTA o
  // con su pedido de impresión) no se vuelve a comprobar: la primera vuelta ya lo hizo y ahora la
  // comprobación la rechazaría. En cualquier otro caso se comprueba.
  const conLaboratorio = Boolean(input.laboratorio) || lineasLab.length > 0;
  const yaCobrado =
    conLaboratorio &&
    preparacionId !== null &&
    (await prisma.fotofficePedido.findFirst({ where: { workspaceId: workspace.id, altaKey: input.clave }, select: { id: true } })) !== null &&
    (await preparacionYaCobrada(workspace.id, preparacionId));
  if (conLaboratorio && !yaCobrado) {
    if (!preparacionId || lineasLab.length === 0) return { ok: false, error: "Las fotos cambiaron: tocá el pedido para laboratorio y volvé a cobrar." };
    const t = await comprobarTicketDeLaboratorio(workspace.id, preparacionId, lineasLab);
    if (!t.ok) return { ok: false, error: t.error };
    const rotos = await flujosQueNoSirven(workspace.id, t.renglones.map((r) => r.productId));
    if (rotos.length > 0) return { ok: false, error: mensajeFlujoQueNoSirve(rotos[0]!) };
  }

  const procesos = await conProceso(workspace.id, input.lines.map((l) => l.productId).filter((x): x is string => x !== null));
  // Los renglones de laboratorio van siempre al pedido (como los marcados «Seña»).
  const { delPedido, enElMomento } = separarTicket(
    input.lines.map((l) => (l.paraLaboratorio === true ? { ...l, paraRetirar: true } : l)),
    procesos,
  );
  if (delPedido.length === 0) return { ok: false, error: "Nada de este ticket queda para retirar: cobralo como venta común." };
  // Los ítems del pedido se llaman m1, m2… en el orden del ticket. Los que no tienen regla (van por
  // estar marcados «Seña») abren su trabajo en «Para retirar» y apartan su stock; los que tienen
  // regla siguen su propio flujo, como siempre.
  const idItem = (i: number) => `m${i + 1}`;
  const sinRegla = delPedido.flatMap((l, i) => (l.productId !== null && procesos.has(l.productId) ? [] : [{ l, itemId: idItem(i) }]));

  const subPedido = delPedido.reduce((a, l) => a + l.qty * l.unitPriceMinor, 0);
  const subVenta = enElMomento.reduce((a, l) => a + l.qty * l.unitPriceMinor, 0);
  const desc = repartirDescuento(subPedido, subVenta, input.discountMinor);
  const totalPedido = subPedido - desc.pedido;
  const sena = input.senaMinor === null ? totalPedido : Math.min(Math.max(0, Math.round(input.senaMinor)), totalPedido);

  // Pago verificado: tiene que ser por lo que se cobra ahora (seña + lo que se lleva en el momento).
  let reservaId: string | null = null;
  let notaVerificado = "";
  if (input.mpPaymentId || input.mpOrderId) {
    if (metodo !== "TRANSFERENCIA" && metodo !== "MERCADO_PAGO") return { ok: false, error: "El pago verificado sólo vale para transferencia o Mercado Pago." };
    const reserva = await reservarCobroMp(workspace.id, user.id, input, sena + (subVenta - desc.venta));
    if (!reserva) return { ok: false, error: "Falta el pago verificado." };
    if (!reserva.ok) return { ok: false, error: reserva.error };
    reservaId = reserva.reservaId;
    notaVerificado = notaDePagoVerificado(reserva.pago);
  }

  // 1. El pedido, con sus trabajos.
  const alta = await crearPedidoManual(ctx, {
    clientId: input.clientId,
    items: delPedido.map((l, i) => ({
      id: idItem(i),
      productId: l.productId,
      nombre: l.description.slice(0, 200),
      descripcion: null,
      cantidad: l.qty,
      precioUnitario: pesos(l.unitPriceMinor),
      descuento: null,
      modoPrecio: "LISTA",
      calculo: null,
      seccion: null,
      opcional: false,
    })),
    descuento: desc.pedido > 0 ? { tipo: "MONTO", valor: pesos(desc.pedido) } : null,
    opcion: { tipo: "CONTADO" },
    fechaEvento: input.entrega,
    eventLabel: "Entrega",
    checklist: null,
    clave: input.clave,
    paraRetirar: sinRegla.map((x) => x.itemId),
    // `crearPedidoManual` sólo mueve los que controlan stock.
    apartar: sinRegla.flatMap(({ l, itemId }) =>
      l.productId !== null ? [{ itemId, productId: l.productId, variantId: l.variantId, cantidad: l.qty }] : [],
    ),
  });
  if (!alta.ok) {
    if (reservaId) await liberarPagoMp(reservaId);
    return { ok: false, error: alta.error };
  }
  if (alta.repetido) {
    // El mismo cobro que vuelve: el pedido ya existe y no se re-escribe. El pago verificado que se
    // reservó para esta vuelta se suelta, porque el de la primera ya quedó usado. Si la primera
    // vuelta se cortó antes de registrar la seña, se registra ahora con la misma clave (idempotente);
    // lo que se llevaba en el momento no se vuelve a vender (ver `avisoCobroRepetido`).
    if (reservaId) await liberarPagoMp(reservaId);
    const antes = await leerPedido(ctx, alta.pedidoId);
    let senaRepetida: SenaRepetida = { tipo: "sin-cambios" };
    if (reintentarSenaRepetida(sena, antes ? Math.round(antes.plan.cobrado * 100) : 0)) {
      const c = await registrarCobro(ctx, {
        pedidoId: alta.pedidoId,
        importe: pesos(sena),
        fecha: diaEnBuenosAires(new Date()),
        medio: metodo,
        idempotencyKey: `${input.clave}-p`.slice(0, 100),
      });
      senaRepetida = !c.ok ? { tipo: "fallo", error: c.error } : c.creado ? { tipo: "registrada" } : { tipo: "sin-cambios" };
      if (c.ok && c.creado) {
        revalidatePath("/pedidos");
        revalidatePath("/caja");
      }
    }
    // Lo cobrado y el saldo, del pedido tal como quedó; el saldo es total menos cobrado, la misma
    // cuenta que devuelve la primera vuelta.
    const despues = senaRepetida.tipo === "registrada" ? await leerPedido(ctx, alta.pedidoId) : antes;
    // Si la primera vuelta se cortó antes del pedido de impresión, se crea ahora (es idempotente).
    const lab = preparacionId
      ? await pedidoParaLaboratorio(workspace.id, preparacionId, { pedidoId: alta.pedidoId, numero: alta.numero, clientId: input.clientId, delPedido })
      : { laboratorios: [], aviso: null };
    return {
      ok: true,
      pedidoId: alta.pedidoId,
      pedidoNumero: alta.numero,
      cobradoMinor: despues ? Math.round(despues.plan.cobrado * 100) : 0,
      saldoMinor: despues ? Math.round(despues.plan.saldo * 100) : 0,
      saleNumber: null,
      aviso: [avisoCobroRepetido({ numero: alta.numero, sena: senaRepetida, habiaVentaEnElMomento: enElMomento.length > 0 }), lab.aviso].filter(Boolean).join(" ") || null,
      grabar: await trabajosParaGrabar(workspace.id, user.id, alta.pedidoId),
      laboratorios: lab.laboratorios,
    };
  }
  if (reservaId) await confirmarUsoPagoMp(reservaId, `Pedido ${alta.numero}`);

  const hoy = diaEnBuenosAires(new Date());
  // La fecha de entrega queda en cada trabajo, y el plazo elegido se recuerda para la próxima venta.
  const plazo = diasEntre(hoy, input.entrega);
  await prisma.fotofficeProyecto.updateMany({
    where: { workspaceId: workspace.id, pedidoId: alta.pedidoId },
    data: { entregaPrometida: new Date(`${input.entrega}T12:00:00Z`) },
  });
  await prisma.fotofficeProductoProyecto.updateMany({
    // Sólo los productos con regla: los marcados «Seña» no tienen fila que recordar.
    where: { workspaceId: workspace.id, productId: { in: [...new Set(delPedido.flatMap((l) => (l.productId !== null && procesos.has(l.productId) ? [l.productId] : [])))] } },
    data: { ultimoPlazoDias: plazo },
  });

  const avisos: string[] = [];
  // Los fotolibros: cada uno queda atado a su trabajo (y se crea si no se creó antes de cobrar).
  const libros = delPedido.flatMap((l, itemIndex) => {
    const fotolibro = l.fotolibro === undefined ? null : leerFotolibroVendido(l.fotolibro);
    return fotolibro ? [{ itemIndex, fotolibro }] : [];
  });
  if (libros.length > 0) {
    try {
      const c = await prisma.client.findFirst({
        where: { id: input.clientId, workspaceId: workspace.id },
        select: { kind: true, firstName: true, lastName: true, businessName: true },
      });
      avisos.push(
        ...(await atarFotolibrosAlPedido({
          workspaceId: workspace.id,
          userId: user.id,
          pedidoId: alta.pedidoId,
          pedidoNumero: alta.numero,
          cliente: c ? clientDisplayName(c) : null,
          libros,
        })),
      );
    } catch (e) {
      console.error("[cobrador] fotolibros del pedido", e);
      avisos.push(`El pedido ${alta.numero} quedó bien, pero no se pudo preparar su fotolibro: crealo desde el trabajo.`);
    }
  }
  // 2. La seña (o el total) del pedido: entra a Caja como cobro del pedido.
  let cobrado = 0;
  if (sena > 0) {
    const c = await registrarCobro(ctx, {
      pedidoId: alta.pedidoId,
      importe: pesos(sena),
      fecha: hoy,
      medio: metodo,
      idempotencyKey: `${input.clave}-p`.slice(0, 100),
    });
    if (c.ok) cobrado = sena;
    else avisos.push(`El pedido ${alta.numero} quedó creado pero la seña no se registró (${c.error}). Cobrala desde el pedido.`);
  }

  // 3. Lo que se lleva en el momento: venta común, pagada entera.
  let saleNumber: number | null = null;
  if (enElMomento.length > 0) {
    const venta: CheckoutInput = {
      lines: enElMomento.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        description: l.description,
        qty: l.qty,
        unitPriceMinor: l.unitPriceMinor,
      })),
      discountMinor: desc.venta,
      paymentMethod: metodo,
      note: [input.note.trim(), `Junto con el pedido ${alta.numero}`, notaVerificado].filter(Boolean).join(" — "),
      client: { mode: "existing", clientId: input.clientId },
    };
    const v = await checkoutAction(venta);
    if (v.ok) saleNumber = v.saleNumber;
    else avisos.push(`El pedido ${alta.numero} quedó bien, pero lo que se llevaba en el momento no se cobró: ${v.error}`);
  }

  // Las fotos del pedido para laboratorio: antes del envío automático de abajo (corre en `after`).
  let laboratorios: string[] = [];
  if (preparacionId) {
    const lab = await pedidoParaLaboratorio(workspace.id, preparacionId, { pedidoId: alta.pedidoId, numero: alta.numero, clientId: input.clientId, delPedido });
    laboratorios = lab.laboratorios;
    if (lab.aviso) avisos.push(lab.aviso);
  }

  // Al cliente le llega el detalle del pedido (con la seña ya registrada).
  const workspaceId = workspace.id;
  after(() => avisarPedidoRecibido(workspaceId, alta.pedidoId));
  // Y cada trabajo con proveedor por defecto se le manda al laboratorio en el momento.
  after(() => enviarTrabajosDelPedidoAlProveedor(ctx, alta.pedidoId));
  revalidatePath("/pedidos");
  revalidatePath("/proyectos");
  revalidatePath("/caja");
  return {
    ok: true,
    pedidoId: alta.pedidoId,
    pedidoNumero: alta.numero,
    cobradoMinor: cobrado,
    saldoMinor: totalPedido - cobrado,
    saleNumber,
    aviso: avisos.length ? avisos.join(" ") : null,
    grabar: await trabajosParaGrabar(workspace.id, user.id, alta.pedidoId),
    laboratorios,
  };
}

export type PedidoParaRetirar = {
  id: string;
  numero: string;
  totalMinor: number;
  saldoMinor: number;
  entrega: string | null;
  /** `listo`: el trabajo está en «Listo para retirar» (fase LISTO); con saldo queda retenido. */
  trabajos: { nombre: string; etapa: string | null; listo: boolean }[];
};

/** Los pedidos abiertos del cliente, para cobrar el saldo cuando viene a retirar. */
export async function pedidosParaRetirarAction(clientId: string): Promise<PedidoParaRetirar[]> {
  await requireSalesStaff();
  const ctx = await contextoDePedidos("ver");
  if (!ctx || typeof clientId !== "string" || clientId.length > 64) return [];
  const abiertos = await prisma.fotofficePedido.findMany({
    where: { workspaceId: ctx.workspaceId, clientId, status: { in: ["CONFIRMADO", "EN_CURSO"] } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true },
  });
  const out: PedidoParaRetirar[] = [];
  for (const { id } of abiertos) {
    const d = await leerPedido(ctx, id);
    if (!d) continue;
    const trabajos = await prisma.fotofficeProyecto.findMany({
      where: { workspaceId: ctx.workspaceId, pedidoId: id },
      select: { name: true, id: true },
    });
    const journeys = trabajos.length
      ? await prisma.fotofficeJourney.findMany({
          where: { workspaceId: ctx.workspaceId, subjectType: "PROYECTO", subjectId: { in: trabajos.map((t) => t.id) } },
          select: { subjectId: true, stage: { select: { name: true, color: true, order: true } } },
        })
      : [];
    const etapaDe = new Map(journeys.map((j) => [j.subjectId, j.stage ?? null]));
    out.push({
      id,
      numero: d.numero,
      totalMinor: Math.round(d.plan.total * 100),
      saldoMinor: Math.round(d.plan.aCobrar * 100),
      entrega: d.eventDate,
      trabajos: trabajos.map((t) => {
        const etapa = etapaDe.get(t.id) ?? null;
        return { nombre: t.name, etapa: etapa?.name ?? null, listo: etapa ? faseDeEtapa({ ...etapa, esUltima: false }) === "LISTO" : false };
      }),
    });
  }
  return out;
}

export type CobroSaldoResult = { ok: true; mensaje: string } | { ok: false; error: string };

/** Cobra lo que falta de un pedido (el cliente vino a retirar). */
export async function cobrarSaldoAction(pedidoId: string, paymentMethod: string, clave: string, mpPaymentId: string | null = null, mpOrderId: string | null = null): Promise<CobroSaldoResult> {
  const { workspace, user } = await requireSalesStaff();
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return { ok: false, error: "No tenés permiso para cobrar pedidos." };
  if (!SALE_PAYMENT_METHODS.includes(paymentMethod as SalePaymentMethod)) return { ok: false, error: "Elegí un medio de pago." };
  if (typeof clave !== "string" || !CLAVE.test(clave)) return { ok: false, error: "Volvé a apretar Cobrar." };
  const d = await leerPedido(ctx, pedidoId);
  if (!d) return { ok: false, error: "Ese pedido no existe." };
  const saldo = Math.round(d.plan.aCobrar * 100);
  if (saldo <= 0) return { ok: false, error: "Ese pedido ya está pago." };
  let reservaId: string | null = null;
  if (mpPaymentId || mpOrderId) {
    if (paymentMethod !== "TRANSFERENCIA" && paymentMethod !== "MERCADO_PAGO") return { ok: false, error: "El pago verificado sólo vale para transferencia o Mercado Pago." };
    const reserva = await reservarCobroMp(workspace.id, user.id, { mpPaymentId, mpOrderId }, saldo);
    if (!reserva) return { ok: false, error: "Falta el pago verificado." };
    if (!reserva.ok) return { ok: false, error: reserva.error };
    reservaId = reserva.reservaId;
  }
  const c = await registrarCobro(ctx, {
    pedidoId: d.id,
    importe: pesos(saldo),
    fecha: diaEnBuenosAires(new Date()),
    medio: paymentMethod,
    idempotencyKey: clave,
  });
  if (!c.ok) {
    if (reservaId) await liberarPagoMp(reservaId);
    return { ok: false, error: c.error };
  }
  if (reservaId) await confirmarUsoPagoMp(reservaId, `Saldo del pedido ${d.numero}`);
  revalidatePath("/pedidos");
  revalidatePath("/caja");
  return { ok: true, mensaje: `Saldo del pedido ${d.numero} cobrado: ${formatMinorArs(saldo)}. Recibo ${c.reciboNumero}.` };
}

/** "Verificar pago": los cobros de Mercado Pago de las últimas horas por ese monto exacto, sin usar. */
export async function verificarPagoAction(montoMinor: number): Promise<ResultadoBusquedaPago> {
  const { workspace } = await requireSalesStaff();
  return buscarPagosParaCobrar(workspace.id, montoMinor);
}

/** Cobrar con el QR del mostrador: crea la order por el monto que se cobra ahora. */
export async function iniciarCobroQrAction(montoMinor: number, descripcion: string): Promise<{ ok: true; ordenId: string } | { ok: false; error: string }> {
  const { workspace } = await requireSalesStaff();
  return crearOrdenQr(workspace.id, montoMinor, typeof descripcion === "string" && descripcion.trim() ? descripcion : "Venta en el mostrador");
}

/** El mostrador pregunta cada pocos segundos si ya se pagó. */
export async function estadoCobroQrAction(ordenId: string): Promise<{ ok: true; orden: OrdenQr } | { ok: false; error: string }> {
  const { workspace } = await requireSalesStaff();
  return consultarOrdenQr(workspace.id, ordenId);
}

export async function cancelarCobroQrAction(ordenId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { workspace } = await requireSalesStaff();
  return cancelarOrdenQr(workspace.id, ordenId);
}
