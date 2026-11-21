import "server-only";
import { prisma } from "@/lib/prisma";
import { secretoDeEntrega } from "@/lib/school-fulfillment/codigo-de-canje";
import { hashDeToken, leerCodigoDeEntregaDePedido } from "./codigos";
import { leerResumen, nombreDeLaCookie, nombreDelFotografo, tokenConFormatoValido } from "./puerta-del-lab";
import { actorDelSobre, textoDelEstadoDelPedido, type ActorDelSobre } from "./entrega-del-pedido";

/**
 * Lo que abre el QR del sobre de un pedido común: código → `PrintOrder` espejo → su entrada viva en
 * un lote no anulado → el lote. Código adulterado, de otro tipo, o pedido sin lote vivo: null (la
 * página dice «Este código no es válido.» en todos los casos, sin contar más).
 *
 * Lo que se arma acá puede verlo cualquiera que tenga el sobre: nombre del fotógrafo, el cliente
 * sin correo ni teléfono, número de pedido, estado y dónde se retira. Nunca el total.
 */

export type DondeRetirar = { nombre: string; direccion: string | null; horario: string | null };

export type SobreDelPedido = {
  printOrderId: number;
  status: string;
  textoDelEstado: string;
  fotografo: string;
  cliente: string;
  pedido: number | null;
  album: string;
  retiraCliente: boolean;
  dondeRetirar: DondeRetirar | null;
  /** Sólo para decidir el actor en el servidor; no viajan al navegador. */
  interno: { batchId: number; photographerId: number; labId: number | null; tokenHash: string | null };
};

export type ErrorDeSecreto = { sinSecreto: true };

export async function cargarSobre(codigo: string): Promise<SobreDelPedido | ErrorDeSecreto | null> {
  const secreto = secretoDeEntrega();
  if (!secreto) return { sinSecreto: true };
  const printOrderId = leerCodigoDeEntregaDePedido(String(codigo || ""), secreto);
  if (printOrderId == null) return null;

  const entry = await prisma.printBatchEntry.findFirst({
    where: { printOrderId, quitadoAt: null, batch: { estado: { not: "ANULADO" } } },
    orderBy: { id: "desc" },
    select: {
      albumOrderId: true, retiraCliente: true, pickupLabContactId: true, resumen: true,
      printOrder: { select: { status: true } },
      batch: {
        select: {
          id: true, photographerId: true, labId: true, tokenHash: true,
          photographer: { select: { name: true, companyName: true } },
        },
      },
    },
  });
  if (!entry || !entry.printOrder) return null;

  const r = leerResumen(entry.resumen);
  let dondeRetirar: DondeRetirar | null = null;
  if (entry.retiraCliente) {
    const c = await prisma.photographerLabContact.findFirst({
      where: entry.pickupLabContactId
        ? { id: entry.pickupLabContactId }
        : { photographerId: entry.batch.photographerId, activo: true, esPredeterminado: true },
      select: { nombre: true, direccion: true, horario: true, lab: { select: { name: true, address: true, city: true } } },
    });
    if (c) {
      dondeRetirar = {
        nombre: c.nombre?.trim() || c.lab?.name?.trim() || "El laboratorio",
        direccion: c.direccion?.trim() || [c.lab?.address, c.lab?.city].filter((x) => x?.trim()).join(", ") || null,
        horario: c.horario?.trim() || null,
      };
    }
  }

  const status = entry.printOrder.status;
  return {
    printOrderId,
    status,
    textoDelEstado: textoDelEstadoDelPedido(status),
    fotografo: nombreDelFotografo(entry.batch.photographer),
    cliente: r.cliente,
    pedido: r.pedido ?? entry.albumOrderId,
    album: r.album,
    retiraCliente: entry.retiraCliente,
    dondeRetirar,
    interno: {
      batchId: entry.batch.id,
      photographerId: entry.batch.photographerId,
      labId: entry.batch.labId,
      tokenHash: entry.batch.tokenHash,
    },
  };
}

export function esErrorDeSecreto(x: unknown): x is ErrorDeSecreto {
  return !!x && typeof x === "object" && (x as ErrorDeSecreto).sinSecreto === true;
}

/**
 * Quién abrió el QR, con la sesión (si hay) y la cookie del lote que dejó la puerta del
 * laboratorio (`lab_lote_<batchId>`, el token en claro; vale si su hash es el `tokenHash` del lote).
 */
export function actorParaElSobre(
  sobre: SobreDelPedido,
  auth: { id: number; labId?: number } | null,
  leerCookie: (nombre: string) => string | undefined,
): ActorDelSobre {
  const { photographerId, labId, tokenHash, batchId } = sobre.interno;
  const cookie = leerCookie(nombreDeLaCookie(batchId));
  return actorDelSobre({
    esDueno: auth != null && auth.id === photographerId,
    esCuentaDelLab: auth?.labId != null && labId != null && auth.labId === labId,
    tieneCookieDelLote: tokenHash != null && tokenConFormatoValido(cookie) && hashDeToken(cookie) === tokenHash,
  });
}
