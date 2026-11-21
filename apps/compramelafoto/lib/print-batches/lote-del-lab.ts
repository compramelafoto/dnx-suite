import "server-only";
import { prisma } from "@/lib/prisma";
import { hashDeToken } from "./codigos";
import { partesDelLote } from "./partes-del-lote";
import {
  MARCA_RETIRA_CLIENTE,
  aNombreDe,
  botonesDelLab,
  copiasDelLote,
  fechaCorta,
  leerResumen,
  medidaYAcabado,
  nombreDelFotografo,
  textoDeCopias,
  textoDelEstado,
  tokenConFormatoValido,
  type EstadoDelLab,
} from "./puerta-del-lab";
import type { EntregaLote, EstadoLote } from "./reglas";

/**
 * El lote que ve el laboratorio con el enlace (sin cuenta). Sólo se busca por el hash del token;
 * un token mal formado no llega a la base. Lote inexistente o anulado: null (la ruta da un 404
 * con el mismo texto en los tres casos). Nunca trae el correo ni el teléfono del cliente.
 */

export type PedidoParaElLab = {
  pedido: number | null;
  aNombreDe: string;
  album: string;
  copias: string;
  totalCopias: number;
  retiraCliente: string | null;
};

/** Lo que ve el laboratorio (va al navegador: sin el id del lote ni datos de contacto). */
export type LoteParaElLab = {
  nombre: string;
  fotografo: string;
  mensaje: string | null;
  fechaPrometida: string | null;
  estado: EstadoLote;
  textoDelEstado: string;
  entrega: EntregaLote;
  enviaElLab: boolean;
  copias: Array<{ texto: string; cantidad: number }>;
  totalCopias: number;
  pedidos: PedidoParaElLab[];
  partes: number;
  botones: Array<{ hacia: EstadoDelLab; texto: string }>;
};

export async function loteDelLab(token: string): Promise<{ batchId: number; lote: LoteParaElLab } | null> {
  if (!tokenConFormatoValido(token)) return null;
  const b = await prisma.printBatch.findUnique({
    where: { tokenHash: hashDeToken(token) },
    select: {
      id: true, nombre: true, estado: true, entregaPreferida: true, mensajeAlLab: true, fechaPrometida: true,
      photographer: { select: { name: true, companyName: true } },
      entries: {
        where: { quitadoAt: null },
        orderBy: { id: "asc" },
        select: { albumOrderId: true, retiraCliente: true, resumen: true },
      },
    },
  });
  if (!b || b.estado === "ANULADO") return null;

  const fotografo = nombreDelFotografo(b.photographer);
  const resumenes = b.entries.map((e) => ({ e, r: leerResumen(e.resumen) }));
  const copias = copiasDelLote(resumenes.map((x) => x.r));
  const lote: LoteParaElLab = {
    nombre: b.nombre,
    fotografo,
    mensaje: b.mensajeAlLab?.trim() || null,
    fechaPrometida: b.fechaPrometida ? fechaCorta(b.fechaPrometida) : null,
    estado: b.estado,
    textoDelEstado: textoDelEstado(b.estado),
    entrega: b.entregaPreferida,
    enviaElLab: b.entregaPreferida === "ENVIA_LAB",
    copias: copias.map((c) => ({ texto: medidaYAcabado(c), cantidad: c.cantidad })),
    totalCopias: copias.reduce((s, c) => s + c.cantidad, 0),
    pedidos: resumenes.map(({ e, r }) => ({
      pedido: r.pedido ?? e.albumOrderId,
      aNombreDe: aNombreDe(fotografo, r.cliente),
      album: r.album,
      copias: textoDeCopias(r.copias),
      totalCopias: r.totalCopias,
      retiraCliente: e.retiraCliente ? MARCA_RETIRA_CLIENTE : null,
    })),
    // Mismo orden y mismos pedidos que `zip-del-lote` (vivos con pedido de álbum, por id).
    partes: partesDelLote(b.entries.flatMap((e) => (e.albumOrderId != null ? [e.albumOrderId] : []))).length,
    botones: botonesDelLab(b.estado, b.entregaPreferida),
  };
  return { batchId: b.id, lote };
}

/** Primera vez que el laboratorio abre el enlace. */
export async function marcarAbierto(batchId: number): Promise<void> {
  await prisma.printBatch.updateMany({ where: { id: batchId, labAbrioAt: null }, data: { labAbrioAt: new Date() } });
}

/** Primera descarga del ZIP. */
export async function marcarDescargado(batchId: number): Promise<void> {
  await prisma.printBatch.updateMany({ where: { id: batchId, labDescargoAt: null }, data: { labDescargoAt: new Date() } });
}
