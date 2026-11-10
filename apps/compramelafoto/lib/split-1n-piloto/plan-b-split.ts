import { armarOrdenCheckoutSplit, decidirOrdenCheckoutSplit } from "./checkout-split";
import type { PilotoConfig } from "./config";
import { clasificarErrorCobro, claveIntento, siguienteIntento } from "./intento";
import type { PedidoPiloto } from "./pedido";
import type { CobroPedidoPreparado } from "./preparar";
import { leerMarcaPiloto, marcarSnapshotPiloto, type MarcaPiloto } from "./snapshot";

/**
 * - `url`: el comprador va al Checkout Pro con reparto.
 * - `legacy`: no corresponde o no se pudo crear: sigue el Checkout Pro de siempre (1:1), que
 *   vuelve a mirar el estado del pedido. Sólo se devuelve cuando ningún enlace con reparto
 *   llegó al comprador.
 * - `fin`: no hay que cobrar por ningún lado (ya pagado, o hay un enlace vivo que no se pudo
 *   leer): se muestra el mensaje.
 */
export type ResultadoCheckoutSplit =
  | { tipo: "url"; url: string }
  | { tipo: "legacy" }
  | { tipo: "fin"; mensaje: string };

const LEGACY = { tipo: "legacy" } as const;

const MENSAJES = {
  pagado: "Tu pago ya se acreditó. Te mandamos las fotos por correo.",
  error: "No pudimos abrir Mercado Pago. Probá de nuevo en unos minutos.",
  cambio: "Esta compra cambió recién. Recargá la página.",
  abriendo: "Estamos abriendo Mercado Pago para esta compra. Esperá unos segundos y volvé a tocar el botón.",
  verificando:
    "Estamos verificando tu pago con Mercado Pago. Te avisamos por correo apenas se confirme. No pagues de nuevo.",
} as const;

/**
 * Una reserva sin orden más nueva que esto es de otra pestaña que todavía está esperando a
 * Mercado Pago: no se retoma (si se retomara, las dos podrían terminar con enlaces distintos).
 */
export const ESPERA_RESERVA_MS = 60_000;


type CambiosMarca = Parameters<typeof marcarSnapshotPiloto>[1];

/** Lo que la lógica necesita de afuera: base, Mercado Pago y configuración. */
export type DepsCheckoutSplit = {
  config: PilotoConfig;
  baseUrl: string;
  ahora(): Date;
  cargar(): Promise<PedidoPiloto | null>;
  /** Escribe la marca sólo si sigue exactamente como se leyó. `true` si escribió. */
  cambiarMarca(snapshot: unknown, leida: MarcaPiloto, cambios: CambiosMarca): Promise<boolean>;
  /** Estado de la orden en Mercado Pago. Lanza si no se pudo leer. */
  estadoOrden(providerOrderId: string): Promise<string | null>;
  /** Confirma el pedido con la orden pagada. `true` si quedó pagado (ahora o antes). */
  confirmar(providerOrderId: string): Promise<boolean>;
  /** Cancela en Mercado Pago una orden que no se va a usar (sin pagar). Lanza si falla. */
  cancelarOrden(providerOrderId: string): Promise<void>;
  preparar(cargado: PedidoPiloto, marca: MarcaPiloto): Promise<CobroPedidoPreparado>;
  /** POST /v1/orders. Lanza ante un error de red o de Mercado Pago. */
  crearOrden(
    clientes: Extract<CobroPedidoPreparado, { ok: true }>["clientes"],
    body: unknown,
    idempotencyKey: string,
  ): Promise<{ id: string | null; url: string | null }>;
};

/** Relee la marca desde JSON: así se compara con lo que quedó guardado (sin `undefined`). */
function comoQuedo(snapshot: unknown): { snapshot: unknown; marca: MarcaPiloto | null } {
  const guardado = JSON.parse(JSON.stringify(snapshot ?? {}));
  return { snapshot: guardado, marca: leerMarcaPiloto(guardado) };
}

/**
 * Plan B con reparto: «Pagar con Mercado Pago» crea una orden de Checkout Pro sobre Orders con
 * los mismos repartos que la tarjeta, o reutiliza la vigente.
 *
 * Contra el cobro doble:
 * - El pedido se reserva (`PENDIENTE` → `CHECKOUT_SPLIT`) antes de llamar a Mercado Pago, con una
 *   escritura condicionada a la marca leída: si la tarjeta reservó primero, esto no pasa.
 * - Mientras la orden pueda pagarse, la tarjeta y el Checkout Pro de siempre se niegan, y cada
 *   vuelta al botón reutiliza el mismo enlace. Recién una orden vencida, cancelada o rechazada
 *   habilita otra.
 * - La creación usa la clave de idempotencia del intento: si se corta y se reintenta, Mercado
 *   Pago devuelve la misma orden.
 * - Si la creación falla, ningún enlace llegó al comprador: el pedido vuelve a `PENDIENTE` y
 *   sigue el Checkout Pro de siempre, para no perder la venta.
 *
 * La confirmación es la del piloto: `external_reference` = `clf-album-order-<id>`, la leen el
 * aviso de Mercado Pago, la página al volver y la conciliación (`finalizarPedidoPiloto`).
 */
export async function resolverCheckoutSplit(
  deps: DepsCheckoutSplit,
  pedidoId: number,
): Promise<ResultadoCheckoutSplit> {
  const { config } = deps;
  let cargado = await deps.cargar();
  if (!cargado) return LEGACY;
  let marca = leerMarcaPiloto(cargado.order.pricingSnapshot);
  if (!marca || (cargado.order.status !== "PENDING" && cargado.order.status !== "FAILED")) return LEGACY;

  // 1) Hay una orden con reparto: se reutiliza, se confirma o, si terminó sin pago, se libera.
  if (marca.estado === "CHECKOUT_SPLIT" && marca.providerOrderId) {
    let status: string | null;
    try {
      status = await deps.estadoOrden(marca.providerOrderId);
    } catch (err: unknown) {
      console.error("[split-1n-piloto] checkout_split_no_leida", {
        pedidoId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { tipo: "fin", mensaje: MENSAJES.error };
    }
    const decision = decidirOrdenCheckoutSplit(status);
    if (decision === "reusar") {
      return marca.checkoutUrl ? { tipo: "url", url: marca.checkoutUrl } : { tipo: "fin", mensaje: MENSAJES.error };
    }
    if (decision === "confirmar") {
      const ok = await deps.confirmar(marca.providerOrderId).catch((err: unknown) => {
        console.error("[split-1n-piloto] checkout_split_no_confirmada", { pedidoId, err });
        return false;
      });
      return { tipo: "fin", mensaje: ok ? MENSAJES.pagado : MENSAJES.verificando };
    }
    if (decision === "verificar") {
      console.warn("[split-1n-piloto] checkout_split_estado_inesperado", { pedidoId, status });
      return { tipo: "fin", mensaje: MENSAJES.verificando };
    }
    const liberado = await deps.cambiarMarca(cargado.order.pricingSnapshot, marca, {
      estado: "PENDIENTE",
      providerOrderId: undefined,
      checkoutUrl: undefined,
      reservadoEn: undefined,
    });
    if (!liberado) return { tipo: "fin", mensaje: MENSAJES.cambio };
    console.info("[split-1n-piloto] checkout_split_liberada", { pedidoId, status });
    cargado = await deps.cargar();
    marca = cargado ? leerMarcaPiloto(cargado.order.pricingSnapshot) : null;
    if (!cargado || !marca) return LEGACY;
  }

  // 2) Reservado sin orden (la creación se cortó): con el interruptor apagado se libera; si no,
  //    se reintenta con el mismo intento y Mercado Pago devuelve la misma orden.
  const reservadoSinOrden = marca.estado === "CHECKOUT_SPLIT" && !marca.providerOrderId;
  if (!config.enabled || !config.planBSplit || !config.ownerUserId) {
    if (reservadoSinOrden) await deps.cambiarMarca(cargado.order.pricingSnapshot, marca, { estado: "PENDIENTE" });
    return LEGACY;
  }
  if (marca.estado !== "PENDIENTE" && !reservadoSinOrden) return LEGACY;
  if (reservadoSinOrden) {
    const desde = marca.reservadoEn ? Date.parse(marca.reservadoEn) : NaN;
    if (Number.isFinite(desde) && deps.ahora().getTime() - desde < ESPERA_RESERVA_MS) {
      return { tipo: "fin", mensaje: MENSAJES.abriendo };
    }
  }

  // 3) Mismo reparto que la tarjeta.
  const preparado = await deps.preparar(cargado, { ...marca, estado: "PENDIENTE" });
  if (!preparado.ok) {
    console.info("[split-1n-piloto] checkout_split_no_corresponde", { pedidoId, codigo: preparado.codigo });
    if (reservadoSinOrden) await deps.cambiarMarca(cargado.order.pricingSnapshot, marca, { estado: "PENDIENTE" });
    return LEGACY;
  }
  const { clientes, cobro, quienesCobran } = preparado;
  const order = cargado.order;

  // 4) Reserva (o, si se retoma una reserva cortada, se renueva con el mismo intento y con
  //    quiénes cobran recalculado, para que las comisiones salgan del reparto de esta orden).
  const intento = reservadoSinOrden ? marca.intento ?? 1 : siguienteIntento(marca);
  const cambios: CambiosMarca = {
    estado: "CHECKOUT_SPLIT",
    intento,
    ...quienesCobran,
    providerOrderId: undefined,
    checkoutUrl: undefined,
    reservadoEn: deps.ahora().toISOString(),
  };
  if (!(await deps.cambiarMarca(order.pricingSnapshot, marca, cambios))) {
    return { tipo: "fin", mensaje: MENSAJES.cambio };
  }
  const reservada = comoQuedo(marcarSnapshotPiloto(order.pricingSnapshot, cambios));
  if (!reservada.marca) return { tipo: "fin", mensaje: MENSAJES.error };

  // 5) Orden en Mercado Pago.
  let creada: { id: string | null; url: string | null };
  let incierto = false;
  try {
    const body = armarOrdenCheckoutSplit({
      pedidoId,
      cobro,
      ownerUserId: config.ownerUserId,
      titulo: `Fotos de «${order.album?.title ?? "álbum"}»`,
      payerEmail: order.buyerEmail,
      baseUrl: deps.baseUrl,
    });
    creada = await deps.crearOrden(clientes, body, claveIntento(pedidoId, intento));
  } catch (err: unknown) {
    // Al retomar una reserva cortada, un error incierto (red, 409, error de Mercado Pago) puede
    // querer decir que la orden de esta clave existe y alguien tiene su enlace: no se libera.
    incierto = reservadoSinOrden && clasificarErrorCobro(err) === "incierto";
    console.error("[split-1n-piloto] checkout_split_no_creada", {
      pedidoId,
      intento,
      incierto,
      error: err instanceof Error ? err.message : String(err),
    });
    creada = { id: null, url: null };
  }

  if (!creada.id || !creada.url) {
    if (incierto) return { tipo: "fin", mensaje: MENSAJES.error };
    // Ningún enlace llegó al comprador: el pedido vuelve a estar libre y sigue Checkout Pro 1:1.
    await deps.cambiarMarca(reservada.snapshot, reservada.marca, { estado: "PENDIENTE", reservadoEn: undefined });
    return LEGACY;
  }

  const guardada = await deps.cambiarMarca(reservada.snapshot, reservada.marca, {
    estado: "CHECKOUT_SPLIT",
    providerOrderId: creada.id,
    checkoutUrl: creada.url,
  });
  if (!guardada) {
    // Otra pestaña cambió el pedido mientras se creaba la orden. El enlace se entrega sólo si
    // quedó guardado justo este; si no, la orden se cancela para que no haya dos enlaces vivos.
    const ahora = await deps.cargar();
    const actual = ahora ? leerMarcaPiloto(ahora.order.pricingSnapshot) : null;
    if (actual?.estado === "CHECKOUT_SPLIT" && actual.providerOrderId === creada.id && actual.checkoutUrl) {
      return { tipo: "url", url: actual.checkoutUrl };
    }
    console.error("[split-1n-piloto] checkout_split_no_guardada", { pedidoId, providerOrderId: creada.id });
    await deps.cancelarOrden(creada.id).catch((err: unknown) =>
      console.error("[split-1n-piloto] checkout_split_no_cancelada", { pedidoId, providerOrderId: creada.id, err }),
    );
    return { tipo: "fin", mensaje: MENSAJES.cambio };
  }
  console.info("[split-1n-piloto] checkout_split_creada", { pedidoId, intento, providerOrderId: creada.id });
  return { tipo: "url", url: creada.url };
}

