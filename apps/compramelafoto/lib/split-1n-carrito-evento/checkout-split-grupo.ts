import { armarOrdenCheckoutSplit, decidirOrdenCheckoutSplit } from "../split-1n-piloto/checkout-split";
import { clasificarErrorCobro } from "../split-1n-piloto/intento";
import type { EstadoPiloto } from "../split-1n-piloto/snapshot";
import type { GrupoCargado, PedidoDelGrupoCargado } from "./cargar";
import { claveIntentoGrupo, referenciaGrupo, urlPagoGrupo, type MarcaGrupo } from "./marca";
import { mensajeGrupo } from "./mensajes-grupo";
import type { GrupoPreparado } from "./preparar-grupo";

/**
 * - `url`: el comprador va al Checkout Pro con reparto del carrito.
 * - `fin`: no se abre Mercado Pago; se muestra el mensaje (ya pagado, en curso, no disponible).
 *
 * A diferencia del pedido de un álbum, un carrito no tiene «Checkout Pro de siempre» al que
 * caer: si no se puede cobrar con reparto, la salida es la tarjeta o pagar cada álbum aparte.
 */
export type ResultadoCheckoutSplitGrupo = { tipo: "url"; url: string } | { tipo: "fin"; mensaje: string };

export const MENSAJES_CHECKOUT_GRUPO = {
  pagado: "Tu pago ya se acreditó. Recargá la página para descargar tus fotos.",
  error: "No pudimos abrir Mercado Pago. Probá de nuevo en unos minutos o pagá con tarjeta.",
  cambio: "Esta compra cambió recién. Recargá la página.",
  abriendo: "Estamos abriendo Mercado Pago para esta compra. Esperá unos segundos y volvé a tocar el botón.",
  verificando:
    "Estamos verificando tu pago con Mercado Pago. Te avisamos por correo apenas se confirme. No pagues de nuevo.",
  no_disponible: "El pago con Mercado Pago no está disponible para esta compra. Podés pagar con tarjeta.",
  tarjeta_en_curso:
    "Ya hay un pago con tarjeta en curso para esta compra. Esperá unos minutos y recargá la página: no pagues de nuevo.",
} as const;

/** Una reserva sin orden más nueva que esto es de otra pestaña que todavía espera a Mercado Pago. */
export const ESPERA_RESERVA_GRUPO_MS = 60_000;

type CambiosMarca = Omit<Partial<MarcaGrupo>, "v"> & { estado: EstadoPiloto };

export type DepsCheckoutSplitGrupo = {
  planBSplit: boolean;
  ownerUserId: string | null;
  baseUrl: string;
  ahora(): Date;
  cargar(): Promise<GrupoCargado | null>;
  /**
   * Cambia la marca de TODOS los pedidos del grupo en una transacción, cada uno sólo si sigue
   * sin pagar y con la marca exactamente como se leyó en `grupo`. Todo o nada: `true` si escribió.
   */
  cambiarMarcas(grupo: GrupoCargado, cambios: (p: PedidoDelGrupoCargado) => CambiosMarca): Promise<boolean>;
  /** Estado de la orden en Mercado Pago. Lanza si no se pudo leer. */
  estadoOrden(providerOrderId: string): Promise<string | null>;
  /** Confirma el grupo con la orden pagada. `true` si quedó pagado (ahora o antes). */
  confirmar(providerOrderId: string): Promise<boolean>;
  /** Cancela en Mercado Pago una orden que no se va a usar (sin pagar). Lanza si falla. */
  cancelarOrden(providerOrderId: string): Promise<void>;
  /** Elegibilidad, consentimientos y reparto (con estado `PENDIENTE`). Nunca lanza. */
  preparar(grupo: GrupoCargado): Promise<GrupoPreparado>;
  /** POST /v1/orders. Lanza ante un error de red o de Mercado Pago. */
  crearOrden(
    clientes: Extract<GrupoPreparado, { ok: true }>["clientes"],
    body: unknown,
    idempotencyKey: string,
  ): Promise<{ id: string | null; url: string | null }>;
};

/**
 * La marca común del grupo: estado, orden, enlace, intento y reserva tienen que coincidir en
 * todos los pedidos (se mueven juntos). Si no coinciden, null: ante la duda, no se cobra.
 */
export function marcaComunDelGrupo(grupo: Pick<GrupoCargado, "pedidos">): MarcaGrupo | null {
  const [primero, ...resto] = grupo.pedidos;
  if (!primero) return null;
  const m = primero.marca;
  const igual = resto.every(
    (p) =>
      p.marca.estado === m.estado &&
      p.marca.providerOrderId === m.providerOrderId &&
      p.marca.checkoutUrl === m.checkoutUrl &&
      p.marca.intento === m.intento &&
      p.marca.reservadoEn === m.reservadoEn,
  );
  return igual ? m : null;
}

const sinPagar = (p: PedidoDelGrupoCargado) => p.order.status === "PENDING" || p.order.status === "FAILED";

/**
 * «Pagar con Mercado Pago» de un carrito de evento: una orden de Checkout Pro sobre Orders con
 * el mismo reparto que la tarjeta (`prepararPagoGrupo`), o la vigente si ya hay una.
 *
 * Contra el cobro doble, como el plan B de un álbum (`plan-b-split.ts`):
 * - Todos los pedidos se reservan juntos (`PENDIENTE` → `CHECKOUT_SPLIT`) antes de llamar a
 *   Mercado Pago, con una escritura condicionada a la marca leída. La tarjeta sólo reserva
 *   desde `PENDIENTE`: mientras haya una orden con reparto que se pueda pagar, no cobra.
 * - Cada vuelta al botón reutiliza el mismo enlace. Recién una orden vencida, cancelada o
 *   rechazada se libera y habilita otra (o la tarjeta).
 * - La creación usa la clave del intento: si se corta y se reintenta, Mercado Pago devuelve la
 *   misma orden.
 * - Si la creación falla, ningún enlace llegó al comprador: el grupo vuelve a `PENDIENTE`.
 *
 * La confirmación es la del carrito: `external_reference` = `clf-event-cart-<grupoId>`, la leen
 * el aviso de Mercado Pago, la página al volver y la conciliación (`finalizarGrupo`).
 */
export async function resolverCheckoutSplitGrupo(deps: DepsCheckoutSplitGrupo): Promise<ResultadoCheckoutSplitGrupo> {
  const M = MENSAJES_CHECKOUT_GRUPO;
  let grupo = await deps.cargar();
  if (!grupo || grupo.pedidos.length === 0) return { tipo: "fin", mensaje: mensajeGrupo("NO_DISPONIBLE") };

  // Algún pedido ya no está sin pagar: no se abre otro cobro. Si hay orden, se intenta confirmar.
  if (!grupo.pedidos.every(sinPagar)) {
    const orden = grupo.pedidos.find((p) => p.marca.providerOrderId)?.marca.providerOrderId;
    if (orden) {
      const ok = await deps.confirmar(orden).catch(() => false);
      return { tipo: "fin", mensaje: ok ? M.pagado : M.verificando };
    }
    return { tipo: "fin", mensaje: M.verificando };
  }

  let marca = marcaComunDelGrupo(grupo);
  if (!marca) return { tipo: "fin", mensaje: M.verificando };

  // 1) Hay una orden con reparto: se reutiliza, se confirma o, si terminó sin pago, se libera.
  if (marca.estado === "CHECKOUT_SPLIT" && marca.providerOrderId) {
    const providerOrderId = marca.providerOrderId;
    let status: string | null;
    try {
      status = await deps.estadoOrden(providerOrderId);
    } catch (err: unknown) {
      console.error("[carrito-evento] checkout_split_no_leida", {
        grupoId: grupo.grupoId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { tipo: "fin", mensaje: M.error };
    }
    const decision = decidirOrdenCheckoutSplit(status);
    if (decision === "reusar") {
      return marca.checkoutUrl ? { tipo: "url", url: marca.checkoutUrl } : { tipo: "fin", mensaje: M.error };
    }
    if (decision === "confirmar") {
      const ok = await deps.confirmar(providerOrderId).catch((err: unknown) => {
        console.error("[carrito-evento] checkout_split_no_confirmada", { grupoId: grupo?.grupoId, err });
        return false;
      });
      return { tipo: "fin", mensaje: ok ? M.pagado : M.verificando };
    }
    if (decision === "verificar") {
      console.warn("[carrito-evento] checkout_split_estado_inesperado", { grupoId: grupo.grupoId, status });
      return { tipo: "fin", mensaje: M.verificando };
    }
    const liberado = await deps.cambiarMarcas(grupo, () => ({
      estado: "PENDIENTE",
      providerOrderId: undefined,
      checkoutUrl: undefined,
      reservadoEn: undefined,
    }));
    if (!liberado) return { tipo: "fin", mensaje: M.cambio };
    console.info("[carrito-evento] checkout_split_liberada", { grupoId: grupo.grupoId, status });
    grupo = await deps.cargar();
    marca = grupo ? marcaComunDelGrupo(grupo) : null;
    if (!grupo || !marca) return { tipo: "fin", mensaje: M.cambio };
  }

  // 2) Reservado sin orden (la creación se cortó): con el interruptor apagado se libera; si no,
  //    se reintenta con el mismo intento y Mercado Pago devuelve la misma orden.
  const reservadoSinOrden = marca.estado === "CHECKOUT_SPLIT" && !marca.providerOrderId;
  if (!deps.planBSplit || !deps.ownerUserId) {
    if (reservadoSinOrden) await deps.cambiarMarcas(grupo, () => ({ estado: "PENDIENTE", reservadoEn: undefined }));
    return { tipo: "fin", mensaje: M.no_disponible };
  }
  if (marca.estado !== "PENDIENTE" && !reservadoSinOrden) {
    // COBRANDO / EN_REVISION / ACREDITADA: la tarjeta está en curso o con resultado incierto.
    return { tipo: "fin", mensaje: M.tarjeta_en_curso };
  }
  if (reservadoSinOrden) {
    const desde = marca.reservadoEn ? Date.parse(marca.reservadoEn) : NaN;
    if (Number.isFinite(desde) && deps.ahora().getTime() - desde < ESPERA_RESERVA_GRUPO_MS) {
      return { tipo: "fin", mensaje: M.abriendo };
    }
  }

  // 3) Mismo reparto que la tarjeta.
  const preparado = await deps.preparar(grupo);
  if (!preparado.ok) {
    console.info("[carrito-evento] checkout_split_no_corresponde", { grupoId: grupo.grupoId, codigo: preparado.codigo });
    if (reservadoSinOrden) await deps.cambiarMarcas(grupo, () => ({ estado: "PENDIENTE", reservadoEn: undefined }));
    return { tipo: "fin", mensaje: mensajeGrupo(preparado.codigo) };
  }

  // 4) Reserva de todo el grupo (o, al retomar una reserva cortada, se renueva con el mismo
  //    intento y el reparto recalculado).
  const intento = reservadoSinOrden
    ? marca.intento ?? 1
    : Math.max(0, ...grupo.pedidos.map((p) => p.marca.intento ?? 0)) + 1;
  const reservadoEn = deps.ahora().toISOString();
  const reservado = await deps.cambiarMarcas(grupo, (p) => ({
    estado: "CHECKOUT_SPLIT",
    intento,
    cobro: preparado.cobroDelPedido(p),
    providerOrderId: undefined,
    checkoutUrl: undefined,
    reservadoEn,
  }));
  if (!reservado) return { tipo: "fin", mensaje: M.cambio };
  const grupoId = grupo.grupoId;

  // Se relee lo que quedó escrito: las próximas escrituras se condicionan a esta marca.
  const reservadoGrupo = await deps.cargar();
  const reservadaMarca = reservadoGrupo ? marcaComunDelGrupo(reservadoGrupo) : null;
  if (
    !reservadoGrupo ||
    !reservadaMarca ||
    reservadaMarca.estado !== "CHECKOUT_SPLIT" ||
    reservadaMarca.intento !== intento ||
    reservadaMarca.reservadoEn !== reservadoEn ||
    reservadaMarca.providerOrderId
  ) {
    return { tipo: "fin", mensaje: M.cambio };
  }

  // 5) Orden en Mercado Pago.
  let creada: { id: string | null; url: string | null };
  let incierto = false;
  try {
    const n = grupo.pedidos.length;
    const body = armarOrdenCheckoutSplit({
      pedidoId: grupo.pedidos[0].order.id,
      cobro: preparado.cobro,
      ownerUserId: deps.ownerUserId,
      titulo: `Fotos de un evento (${n} ${n === 1 ? "álbum" : "álbumes"})`,
      payerEmail: preparado.payerEmail,
      baseUrl: deps.baseUrl,
      externalReference: referenciaGrupo(grupoId),
      rutaDeVuelta: urlPagoGrupo(grupoId),
    });
    creada = await deps.crearOrden(preparado.clientes, body, claveIntentoGrupo(grupoId, intento));
  } catch (err: unknown) {
    // Al retomar una reserva cortada, un error incierto puede querer decir que la orden de esta
    // clave existe y alguien tiene su enlace: no se libera.
    incierto = reservadoSinOrden && clasificarErrorCobro(err) === "incierto";
    console.error("[carrito-evento] checkout_split_no_creada", {
      grupoId,
      intento,
      incierto,
      error: err instanceof Error ? err.message : String(err),
    });
    creada = { id: null, url: null };
  }

  if (!creada.id || !creada.url) {
    if (incierto) return { tipo: "fin", mensaje: M.error };
    // Ningún enlace llegó al comprador: el grupo vuelve a estar libre (tarjeta o reintento).
    await deps.cambiarMarcas(reservadoGrupo, () => ({ estado: "PENDIENTE", reservadoEn: undefined }));
    return { tipo: "fin", mensaje: M.error };
  }

  const guardada = await deps.cambiarMarcas(reservadoGrupo, () => ({
    estado: "CHECKOUT_SPLIT",
    providerOrderId: creada.id!,
    checkoutUrl: creada.url!,
  }));
  if (!guardada) {
    // Otra pestaña cambió el grupo mientras se creaba la orden. El enlace se entrega sólo si
    // quedó guardado justo este; si no, la orden se cancela para que no haya dos enlaces vivos.
    const ahora = await deps.cargar();
    const actual = ahora ? marcaComunDelGrupo(ahora) : null;
    if (actual?.estado === "CHECKOUT_SPLIT" && actual.providerOrderId === creada.id && actual.checkoutUrl) {
      return { tipo: "url", url: actual.checkoutUrl };
    }
    console.error("[carrito-evento] checkout_split_no_guardada", { grupoId, providerOrderId: creada.id });
    await deps.cancelarOrden(creada.id).catch((err: unknown) =>
      console.error("[carrito-evento] checkout_split_no_cancelada", { grupoId, providerOrderId: creada.id, err }),
    );
    return { tipo: "fin", mensaje: M.cambio };
  }
  console.info("[carrito-evento] checkout_split_creada", { grupoId, intento, providerOrderId: creada.id });
  return { tipo: "url", url: creada.url };
}
