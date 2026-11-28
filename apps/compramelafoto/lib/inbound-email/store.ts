import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { casillaClf, clasificar, type CorreoRecibido } from "./parse";
import { listarRecibidos, traerCorreo } from "./resend-api";

/** Tope del cuerpo guardado: un correo con imágenes incrustadas puede pesar varios MB. */
const MAX_HTML = 500_000;
const MAX_TEXTO = 100_000;

function esRepetido(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export type ResultadoGuardar = { guardado: "NUEVO" | "YA_ESTABA" | "NO_ES_DE_CLF"; id?: number };

/** Guarda un correo recibido una sola vez (`resendId` único). Lanza si falla la base. */
export async function guardarCorreo(c: CorreoRecibido): Promise<ResultadoGuardar> {
  if (!casillaClf(c.to, c.cc)) return { guardado: "NO_ES_DE_CLF" };
  const ya = await prisma.clfInboundEmail.findUnique({ where: { resendId: c.resendId }, select: { id: true } });
  if (ya) return { guardado: "YA_ESTABA", id: ya.id };
  try {
    const nuevo = await prisma.clfInboundEmail.create({
      data: {
        resendId: c.resendId,
        messageId: c.messageId,
        inReplyTo: c.inReplyTo,
        references: c.references.length ? c.references.join(" ") : null,
        fromEmail: c.fromEmail,
        fromName: c.fromName,
        to: c.to.join(", "),
        cc: c.cc.length ? c.cc.join(", ") : null,
        subject: c.subject.slice(0, 1000),
        text: c.text.slice(0, MAX_TEXTO),
        html: c.html && c.html.length <= MAX_HTML ? c.html : null,
        attachments: c.attachments.length ? (c.attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        kind: clasificar(c),
        receivedAt: c.receivedAt,
      },
      select: { id: true },
    });
    return { guardado: "NUEVO", id: nuevo.id };
  } catch (e) {
    // Otro aviso del mismo correo lo guardó mientras tanto.
    if (esRepetido(e)) return { guardado: "YA_ESTABA" };
    throw e;
  }
}

export type ResultadoSincronizar = { revisados: number; nuevos: number; errores: string[] };

/**
 * Trae de Resend los correos recibidos que todavía no están guardados (por si el aviso no llegó o
 * llegaron antes de activar la bandeja). Recorre de los más nuevos a los más viejos y corta cuando
 * encuentra una página entera ya guardada.
 */
export async function sincronizarDesdeResend(opciones: { maxPaginas?: number } = {}): Promise<ResultadoSincronizar> {
  const maxPaginas = opciones.maxPaginas ?? 5;
  const out: ResultadoSincronizar = { revisados: 0, nuevos: 0, errores: [] };
  let despuesDe: string | undefined;
  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const lista = await listarRecibidos({ despuesDe, limite: 100 });
    if ("error" in lista) {
      out.errores.push(lista.error);
      break;
    }
    if (lista.items.length === 0) break;
    out.revisados += lista.items.length;

    const deClf = lista.items.filter((x) => casillaClf(x.to, x.cc));
    const guardados = await prisma.clfInboundEmail.findMany({
      where: { resendId: { in: deClf.map((x) => x.id) } },
      select: { resendId: true },
    });
    const yaEstan = new Set(guardados.map((g) => g.resendId));
    const faltan = deClf.filter((x) => !yaEstan.has(x.id));

    for (const item of faltan) {
      const correo = await traerCorreo(item.id);
      if ("error" in correo) {
        out.errores.push(correo.error);
        continue;
      }
      try {
        if ((await guardarCorreo(correo)).guardado === "NUEVO") out.nuevos++;
      } catch (e) {
        out.errores.push(e instanceof Error ? e.message : "No se pudo guardar un correo.");
      }
    }

    // Página entera ya guardada: lo de más atrás también lo está.
    if (deClf.length > 0 && faltan.length === 0) break;
    if (!lista.hayMas) break;
    despuesDe = lista.items[lista.items.length - 1]!.id;
  }
  out.errores = [...new Set(out.errores)].slice(0, 5);
  return out;
}
