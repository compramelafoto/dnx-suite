import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { MENSAJES_GALERIA as M, puedeGestionarGalerias, puedeVerGalerias, type CtxGalerias } from "./acceso";
import { borrarObjetoFoto, copiarObjeto } from "./almacen";
import { claveEsDe, clavesDeFoto } from "./claves";
import { MAX_LAMINAS_POR_RONDA, MAX_NOTA_RONDA, type EstadoRonda } from "./constantes";
import { registrarEvento } from "./eventos";
import { ordenarFotosDeGaleria } from "./orden";

/**
 * Rondas de una galería de ÁLBUM (etapa 7, Entrega C). Una ronda es un juego de láminas que el cliente revisa:
 * la primera nace con la galería; el estudio abre la 2, la 3… con las láminas corregidas. Una galería tiene a lo
 * sumo UNA ronda abierta (índice único parcial en el SQL) y las rondas cerradas quedan en sólo lectura.
 * Todo se acota al `workspaceId` del contexto. Las galerías de selección y de entrega no tienen rondas
 * (`rondaId` nulo en sus fotos): nada de acá las toca.
 */

export const MENSAJES_RONDA = {
  soloAlbum: "Sólo las galerías de álbum tienen rondas.",
  sinRonda: "El álbum no tiene una ronda abierta.",
  sinDecision: "Ningún cliente decidió todavía sobre la ronda actual. Si igual querés abrir la ronda nueva, confirmalo.",
  archivada: "La galería está archivada: reactivala para abrir una ronda nueva.",
  nota: `La nota puede tener hasta ${MAX_NOTA_RONDA.toLocaleString("es-AR")} caracteres.`,
  carrera: "Otra persona cambió el álbum al mismo tiempo. Recargá la página y probá de nuevo.",
  topeLaminas: `La ronda ya tiene el máximo de ${MAX_LAMINAS_POR_RONDA} láminas.`,
  rondaCerrada: "Las láminas de una ronda cerrada no se modifican.",
  sinLaminasListas: "Subí al menos una lámina antes de publicar el álbum.",
  rondaNoExiste: "No encontramos esa ronda.",
  descargaAlbum: "En un álbum la descarga puede ser “Sin descarga” o “Vista de galería”.",
} as const;

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const idValido = (v: unknown): v is string => typeof v === "string" && ID_VALIDO.test(v);
const no = (error: string) => ({ ok: false as const, error });

/** La ronda abierta de un álbum, o null (no es un álbum o no tiene). Sin permisos: la llama código ya autorizado. */
export async function rondaAbiertaDe(workspaceId: string, galeriaId: string): Promise<{ id: string; numero: number } | null> {
  const r = await prisma.fotofficeGaleriaRonda.findFirst({ where: { galeriaId, workspaceId, status: "ABIERTA" }, select: { id: true, number: true } });
  return r ? { id: r.id, numero: r.number } : null;
}

/** Cuántas láminas LISTA tiene la ronda abierta de cada álbum (para las tarjetas y los listados). Sin permisos. */
export async function laminasAbiertasPorGaleria(workspaceId: string, galeriaIds: readonly string[]): Promise<Map<string, number>> {
  const salida = new Map<string, number>();
  if (galeriaIds.length === 0) return salida;
  const abiertas = await prisma.fotofficeGaleriaRonda.findMany({ where: { workspaceId, galeriaId: { in: [...galeriaIds] }, status: "ABIERTA" }, select: { id: true, galeriaId: true } });
  if (abiertas.length === 0) return salida;
  const porRonda = new Map(abiertas.map((a) => [a.id, a.galeriaId]));
  const fotos = await prisma.fotofficeGaleriaFoto.findMany({ where: { workspaceId, rondaId: { in: [...porRonda.keys()] }, status: "LISTA" }, select: { rondaId: true } });
  for (const f of fotos) {
    const g = f.rondaId ? porRonda.get(f.rondaId) : undefined;
    if (g) salida.set(g, (salida.get(g) ?? 0) + 1);
  }
  return salida;
}

export type RondaVista = {
  id: string;
  numero: number;
  estado: EstadoRonda;
  nota: string | null;
  creadaEn: Date;
  cerradaEn: Date | null;
  /** Láminas LISTA de la ronda. */
  laminas: number;
  aprobados: number;
  conCambios: number;
};

/** Las rondas del álbum, de la primera a la última, con sus láminas y decisiones. Pide "Ver". */
export async function listarRondas(ctx: CtxGalerias, galeriaId: unknown): Promise<RondaVista[]> {
  if (!puedeVerGalerias(ctx) || !idValido(galeriaId)) return [];
  const { workspaceId } = ctx;
  const rondas = await prisma.fotofficeGaleriaRonda.findMany({
    where: { galeriaId, workspaceId },
    orderBy: { number: "asc" },
    select: { id: true, number: true, status: true, note: true, createdAt: true, closedAt: true },
  });
  if (rondas.length === 0) return [];
  const ids = rondas.map((r) => r.id);
  const [fotos, decisiones] = await Promise.all([
    prisma.fotofficeGaleriaFoto.findMany({ where: { galeriaId, workspaceId, rondaId: { in: ids }, status: "LISTA" }, select: { rondaId: true } }),
    prisma.fotofficeGaleriaDecision.findMany({ where: { workspaceId, rondaId: { in: ids } }, select: { rondaId: true, decision: true } }),
  ]);
  return rondas.map((r) => ({
    id: r.id,
    numero: r.number,
    estado: r.status === "ABIERTA" ? "ABIERTA" : "CERRADA",
    nota: r.note,
    creadaEn: r.createdAt,
    cerradaEn: r.closedAt,
    laminas: fotos.filter((f) => f.rondaId === r.id).length,
    aprobados: decisiones.filter((d) => d.rondaId === r.id && d.decision === "APROBADO").length,
    conCambios: decisiones.filter((d) => d.rondaId === r.id && d.decision === "CAMBIOS").length,
  }));
}

// --- Abrir una ronda nueva -------------------------------------------------------------------------------------

export type ResultadoRondaNueva =
  | { ok: true; rondaId: string; numero: number; nota: string | null; copiadas: number; noCopiadas: number }
  | { ok: false; error: string; codigo: "SIN_DECISION" | "GENERICO" };

function notaLimpia(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\r\n?/g, "\n").trim();
  if (t.length > MAX_NOTA_RONDA) return undefined;
  return t === "" ? null : t;
}

/** Láminas que se copian a la vez (3 objetos cada una): acota los pedidos simultáneos a R2. */
const LOTE_COPIA = 6;

type Lamina = { id: string; fileName: string; order: number; originalKey: string; viewKey: string | null; thumbKey: string | null; sizeBytes: bigint | number | null; width: number | null; height: number | null; contentType: string | null };

/** Copia los tres objetos de una lámina a las claves de la lámina nueva. Si algo falla, limpia lo copiado y devuelve false. */
async function copiarObjetosDeLamina(workspaceId: string, galeriaId: string, origen: Lamina, nuevoId: string): Promise<boolean> {
  if (!origen.viewKey || !origen.thumbKey) return false;
  if (![origen.originalKey, origen.viewKey, origen.thumbKey].every((k) => claveEsDe(k, workspaceId, galeriaId))) return false;
  const destino = clavesDeFoto(workspaceId, galeriaId, nuevoId);
  try {
    const hechos = await Promise.all([
      copiarObjeto(origen.originalKey, destino.original),
      copiarObjeto(origen.viewKey, destino.vista),
      copiarObjeto(origen.thumbKey, destino.mini),
    ]);
    if (hechos.every(Boolean)) return true;
  } catch {
    // Cae al borrado de lo que haya quedado.
  }
  await Promise.all([destino.original, destino.vista, destino.mini].map((k) => borrarObjetoFoto(k).catch(() => undefined)));
  return false;
}

/**
 * Abre la ronda siguiente del álbum. Cierra la ronda abierta (`closedAt`), crea la número+1 ABIERTA con la nota del
 * estudio, devuelve a `EN_PROGRESO` a los clientes que no tienen el enlace anulado y deja el hecho en el historial,
 * todo en una transacción con escritura condicional (de dos pedidos a la vez gana uno).
 *
 * Sólo si la ronda actual tiene al menos una decisión de un cliente o el estudio la fuerza (`forzar: true`). Con
 * `copiar: true` copia, con `CopyObject` de R2, las láminas LISTA de la ronda anterior a la nueva (original, vista y
 * miniatura bajo el id de la lámina nueva), en el mismo orden: después el estudio puede borrar, reemplazar o sumar.
 * Una lámina que no se pudo copiar se cuenta en `noCopiadas`; el resto sigue. El correo a los clientes lo manda quien
 * llama con `avisarRondaNueva` (la acción lo hace con `after()`).
 */
export async function abrirRondaNueva(ctx: CtxGalerias, galeriaId: unknown, datos: unknown, ahora: Date = new Date()): Promise<ResultadoRondaNueva> {
  const falla = (error: string, codigo: "SIN_DECISION" | "GENERICO" = "GENERICO") => ({ ok: false as const, error, codigo });
  if (!puedeGestionarGalerias(ctx) || ctx.userId === null) return falla(M.sinPermiso);
  if (!idValido(galeriaId) || (datos !== undefined && datos !== null && (typeof datos !== "object" || Array.isArray(datos)))) return falla(M.datosInvalidos);
  const d = (datos ?? {}) as Record<string, unknown>;
  const nota = notaLimpia(d.nota);
  if (nota === undefined) return falla(MENSAJES_RONDA.nota);
  if ((d.copiar !== undefined && typeof d.copiar !== "boolean") || (d.forzar !== undefined && typeof d.forzar !== "boolean")) return falla(M.datosInvalidos);
  const copiar = d.copiar === true;
  const forzar = d.forzar === true;
  const { workspaceId } = ctx;

  const galeria = await prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId }, select: { id: true, kind: true, status: true } });
  if (!galeria) return falla(M.noExiste);
  if (galeria.kind !== "ALBUM") return falla(MENSAJES_RONDA.soloAlbum);
  if (galeria.status === "ARCHIVADA") return falla(MENSAJES_RONDA.archivada);
  const actual = await prisma.fotofficeGaleriaRonda.findFirst({ where: { galeriaId, workspaceId, status: "ABIERTA" }, select: { id: true, number: true } });
  if (!actual) return falla(MENSAJES_RONDA.sinRonda);
  if (!forzar) {
    const decisiones = await prisma.fotofficeGaleriaDecision.count({ where: { rondaId: actual.id, workspaceId } });
    if (decisiones < 1) return falla(MENSAJES_RONDA.sinDecision, "SIN_DECISION");
  }
  // Las láminas a copiar se leen antes de cerrar la ronda (siguen siendo las mismas: la ronda no cambia mientras está cerrada).
  const aCopiar: Lamina[] = copiar
    ? ((await prisma.fotofficeGaleriaFoto.findMany({
        where: { galeriaId, workspaceId, rondaId: actual.id, status: "LISTA" },
        select: { id: true, fileName: true, order: true, originalKey: true, viewKey: true, thumbKey: true, sizeBytes: true, width: true, height: true, contentType: true },
      })) as Lamina[])
    : [];

  let nueva: { id: string; numero: number };
  try {
    nueva = await prisma.$transaction(async (tx) => {
      const cierre = await tx.fotofficeGaleriaRonda.updateMany({ where: { id: actual.id, galeriaId, workspaceId, status: "ABIERTA" }, data: { status: "CERRADA", closedAt: ahora } });
      if (cierre.count !== 1) throw new Error("CARRERA");
      const id = randomUUID();
      const numero = actual.number + 1;
      await tx.fotofficeGaleriaRonda.create({ data: { id, workspaceId, galeriaId, number: numero, status: "ABIERTA", note: nota, createdByUserId: ctx.userId }, select: { id: true } });
      await tx.fotofficeGaleriaCliente.updateMany({ where: { galeriaId, workspaceId, revokedAt: null }, data: { status: "EN_PROGRESO", reopenedAt: ahora, finalizedAt: null } });
      await registrarEvento(tx, { workspaceId, galeriaId, tipo: "RONDA_ABIERTA", actorUserId: ctx.userId, data: { numero, copiar, forzada: forzar } });
      return { id, numero };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if ((e as Error)?.message === "CARRERA" || (e as { code?: unknown } | null)?.code === "P2002") return falla(MENSAJES_RONDA.carrera);
    return falla(M.guardar);
  }

  let copiadas = 0;
  if (aCopiar.length > 0) {
    const ordenadas = ordenarFotosDeGaleria(aCopiar, "MANUAL");
    const base = ((await prisma.fotofficeGaleriaFoto.aggregate({ where: { galeriaId, workspaceId }, _max: { order: true } }))._max.order ?? -1) + 1;
    for (let i = 0; i < ordenadas.length; i += LOTE_COPIA) {
      const lote = ordenadas.slice(i, i + LOTE_COPIA);
      const hechas = await Promise.all(
        lote.map(async (origen, j) => {
          const nuevoId = randomUUID();
          try {
            if (!(await copiarObjetosDeLamina(workspaceId, galeriaId, origen, nuevoId))) return false;
            const claves = clavesDeFoto(workspaceId, galeriaId, nuevoId);
            await prisma.fotofficeGaleriaFoto.create({
              data: {
                id: nuevoId, workspaceId, galeriaId, rondaId: nueva.id, fileName: origen.fileName, originalKey: claves.original, viewKey: claves.vista, thumbKey: claves.mini,
                status: "LISTA", sizeBytes: origen.sizeBytes, width: origen.width, height: origen.height, mediaType: "FOTO", contentType: origen.contentType,
                order: base + i + j, uploadedByUserId: ctx.userId,
              },
              select: { id: true },
            });
            return true;
          } catch {
            const claves = clavesDeFoto(workspaceId, galeriaId, nuevoId);
            await Promise.all([claves.original, claves.vista, claves.mini].map((k) => borrarObjetoFoto(k).catch(() => undefined)));
            return false;
          }
        }),
      );
      copiadas += hechas.filter(Boolean).length;
    }
  }
  return { ok: true, rondaId: nueva.id, numero: nueva.numero, nota, copiadas, noCopiadas: aCopiar.length - copiadas };
}
