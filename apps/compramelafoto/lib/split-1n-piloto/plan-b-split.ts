import { armarOrdenCheckoutSplit, decidirOrdenCheckoutSplit } from "./checkout-split";
import type { PilotoConfig } from "./config";
import { claveIntento, siguienteIntento } from "./intento";
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
} as const;


type CambiosMarca = Parameters<typeof marcarSnapshotPiloto>[1];

/** Lo que la lógica necesita de afuera: base, Mercado Pago y configuración. */
export type DepsCheckoutSplit = {
  config: PilotoConfig;
  baseUrl: string;
  cargar(): Promise<PedidoPiloto | null>;
  /** Escribe la marca sólo si sigue exactamente como se leyó. `true` si escribió. */
  cambiarMarca(snapshot: unknown, leida: MarcaPiloto, cambios: CambiosMarca): Promise<boolean>;
  /** Estado de la orden en Mercado Pago. Lanza si no se pudo leer. */
  estadoOrden(providerOrderId: string): Promise<string | null>;
  confirmar(providerOrderId: string): Promise<void>;
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
      await deps.confirmar(marca.providerOrderId).catch((err: unknown) =>
        console.error("[split-1n-piloto] checkout_split_no_confirmada", { pedidoId, err }),
      );
      return { tipo: "fin", mensaje: MENSAJES.pagado };
    }
    const liberado = await deps.cambiarMarca(cargado.order.pricingSnapshot, marca, {
      estado: "PENDIENTE",
      checkoutUrl: undefined,
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

  // 3) Mismo reparto que la tarjeta.
  const preparado = await deps.preparar(cargado, { ...marca, estado: "PENDIENTE" });
  if (!preparado.ok) {
    console.info("[split-1n-piloto] checkout_split_no_corresponde", { pedidoId, codigo: preparado.codigo });
    if (reservadoSinOrden) await deps.cambiarMarca(cargado.order.pricingSnapshot, marca, { estado: "PENDIENTE" });
    return LEGACY;
  }
  const { clientes, cobro, quienesCobran } = preparado;
  const order = cargado.order;

  // 4) Reserva.
  let intento = marca.intento ?? 1;
  let reservada: { snapshot: unknown; marca: MarcaPiloto | null } = { snapshot: order.pricingSnapshot, marca };
  if (!reservadoSinOrden) {
    intento = siguienteIntento(marca);
    const cambios: CambiosMarca = {
      estado: "CHECKOUT_SPLIT",
      intento,
      ...quienesCobran,
      providerOrderId: undefined,
      checkoutUrl: undefined,
    };
    if (!(await deps.cambiarMarca(order.pricingSnapshot, marca, cambios))) {
      return { tipo: "fin", mensaje: MENSAJES.cambio };
    }
    reservada = comoQuedo(marcarSnapshotPiloto(order.pricingSnapshot, cambios));
  }
  if (!reservada.marca) return { tipo: "fin", mensaje: MENSAJES.error };

  // 5) Orden en Mercado Pago.
  let creada: { id: string | null; url: string | null };
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
    console.error("[split-1n-piloto] checkout_split_no_creada", {
      pedidoId,
      intento,
      error: err instanceof Error ? err.message : String(err),
    });
    creada = { id: null, url: null };
  }

  if (!creada.id || !creada.url) {
    // Ningún enlace llegó al comprador: el pedido vuelve a estar libre y sigue Checkout Pro 1:1.
    await deps.cambiarMarca(reservada.snapshot, reservada.marca, { estado: "PENDIENTE" });
    return LEGACY;
  }

  const guardada = await deps.cambiarMarca(reservada.snapshot, reservada.marca, {
    estado: "CHECKOUT_SPLIT",
    providerOrderId: creada.id,
    checkoutUrl: creada.url,
  });
  if (!guardada) {
    // No debería pasar (el pedido está reservado). El aviso de Mercado Pago igual lo confirma
    // por la referencia, y un nuevo clic recrea la misma orden por la clave de idempotencia.
    console.error("[split-1n-piloto] checkout_split_no_guardada", { pedidoId, providerOrderId: creada.id });
  }
  console.info("[split-1n-piloto] checkout_split_creada", { pedidoId, intento, providerOrderId: creada.id });
  return { tipo: "url", url: creada.url };
}

