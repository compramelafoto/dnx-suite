import type { RepartoPiloto } from "../split-1n-piloto/reparto";
import type { EstadoPiloto, MarcaPiloto } from "../split-1n-piloto/snapshot";

/**
 * Marca de grupo dentro de `Order.pricingSnapshot` (sin migración).
 *
 * Todos los pedidos de un carrito de evento llevan el mismo `grupoId`, la lista de pedidos y el
 * estado del cobro, que se mueven juntos. `cobro` es propio de cada pedido: quiénes de CLF
 * cobraron por el split en ESE pedido y su reparto, para registrar sus comisiones igual que el
 * piloto. A propósito no es la marca del piloto (`split1nPiloto`): así ningún pedido del grupo
 * se puede pagar suelto en `/pagar/[orderId]`.
 */
export type MarcaGrupo = {
  v: 1;
  grupoId: string;
  pedidos: number[];
  estado: EstadoPiloto;
  providerOrderId?: string;
  intento?: number;
  cobro?: {
    referidorUserId: number | null;
    organizadorUserId: number | null;
    referidorOrganizadorUserId: number | null;
    reparto: RepartoPiloto;
  };
};

const CLAVE = "split1nGrupo";
const PREFIJO_REFERENCIA = "clf-event-cart-";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function comoObjeto(snapshot: unknown): Record<string, unknown> {
  return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
    ? (snapshot as Record<string, unknown>)
    : {};
}

export function esGrupoIdValido(grupoId: string | null | undefined): grupoId is string {
  return typeof grupoId === "string" && UUID.test(grupoId);
}

export function leerMarcaGrupo(snapshot: unknown): MarcaGrupo | null {
  const marca = comoObjeto(snapshot)[CLAVE];
  if (!marca || typeof marca !== "object") return null;
  const m = marca as Partial<MarcaGrupo>;
  return m.v === 1 && typeof m.grupoId === "string" && typeof m.estado === "string" && Array.isArray(m.pedidos)
    ? (m as MarcaGrupo)
    : null;
}

export function marcarSnapshotGrupo(
  snapshot: unknown,
  cambios: Omit<Partial<MarcaGrupo>, "v"> & { estado: EstadoPiloto },
): Record<string, unknown> {
  const base = comoObjeto(snapshot);
  const anterior = leerMarcaGrupo(base) ?? {};
  return { ...base, [CLAVE]: { ...anterior, ...cambios, v: 1 } };
}

export function referenciaGrupo(grupoId: string): string {
  return `${PREFIJO_REFERENCIA}${grupoId}`;
}

export function grupoIdDesdeReferencia(ref: string | null | undefined): string | null {
  if (!ref || !ref.startsWith(PREFIJO_REFERENCIA)) return null;
  const id = ref.slice(PREFIJO_REFERENCIA.length);
  return esGrupoIdValido(id) ? id : null;
}

/** Página de pago (y, ya pagado, de descargas) del grupo. */
export function urlPagoGrupo(grupoId: string): string {
  return `/pagar/grupo/${grupoId}`;
}

/** Clave de idempotencia de un intento de cobro del grupo (estable para el mismo intento). */
export function claveIntentoGrupo(grupoId: string, intento: number): string {
  return `${referenciaGrupo(grupoId)}-${intento}`;
}

/** La marca de un pedido del grupo con la forma del piloto, para `registrarComisiones`. */
export function marcaComoPiloto(marca: MarcaGrupo): MarcaPiloto {
  return {
    v: 1,
    estado: marca.estado,
    providerOrderId: marca.providerOrderId,
    intento: marca.intento,
    referidorUserId: marca.cobro?.referidorUserId ?? null,
    organizadorUserId: marca.cobro?.organizadorUserId ?? null,
    referidorOrganizadorUserId: marca.cobro?.referidorOrganizadorUserId ?? null,
    ...(marca.cobro ? { reparto: marca.cobro.reparto } : {}),
  };
}
