import "server-only";
import { prisma } from "@repo/db";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { urlsDeLecturaPorLote } from "./almacen";
import { MENSAJES_ALBUM as MA, validarDecision, validarPin } from "./album-reglas";
import { MAX_COMENTARIOS_POR_RONDA, type DecisionAlbum, type EstadoRonda } from "./constantes";
import { registrarEvento } from "./eventos";
import { ordenarFotosDeGaleria } from "./orden";
import { fechaArgentina, resolverTokenGaleria, type Falla, type ResultadoTokenGaleria } from "./publico";
import type { ComentarioLamina, VistaAlbum } from "./publico-tipos";
import { puedeEditarElCliente, validarComentario } from "./seleccion";

/**
 * La prueba de álbum del cliente (etapa 7, Entrega C), sin sesión: el token es la llave. Igual que el resto de
 * `publico.ts`, TODA función vuelve a resolver el token (cliente no anulado, galería PUBLICADA de ese workspace) y
 * trabaja sólo con láminas de ESA galería. El cliente sólo comenta y decide en la ronda ABIERTA y mientras está
 * `EN_PROGRESO`; las rondas cerradas se ven en sólo lectura.
 */

type Resuelto = Extract<ResultadoTokenGaleria, { ok: true }>;
const falla = (error: string, codigo: Falla["codigo"] = "REGLA"): Falla => ({ ok: false, error, codigo });
const INVALIDO = (): Falla => falla("Este enlace ya no es válido.", "INVALIDO");

type RondaFila = { id: string; number: number; status: string; note: string | null };

const aComentario = (x: {
  id: string; fotoId: string; author: string; body: string; createdAt: Date; pinNumber: number | null; pinX: number | null; pinY: number | null;
}): ComentarioLamina => ({
  id: x.id,
  fotoId: x.fotoId,
  autor: x.author === "ESTUDIO" ? "ESTUDIO" : "CLIENTE",
  texto: x.body,
  fecha: fechaArgentina(x.createdAt),
  pinNumber: x.pinNumber,
  pinX: x.pinX,
  pinY: x.pinY,
});

/**
 * Todo lo que ve el cliente en su prueba de álbum. `numeroPedido` es la ronda que quiere mirar (de la dirección);
 * si no existe o no viene, la abierta (y si no hay ninguna abierta, la última).
 */
export async function armarVistaAlbum(r: Resuelto, numeroPedido?: number | null): Promise<VistaAlbum> {
  const { workspaceId, galeria: g, cliente: c } = r;
  const [sitio, rondas] = await Promise.all([
    sitioDelWorkspace(workspaceId),
    prisma.fotofficeGaleriaRonda.findMany({
      where: { workspaceId, galeriaId: g.id },
      orderBy: [{ number: "asc" }],
      select: { id: true, number: true, status: true, note: true },
    }) as Promise<RondaFila[]>,
  ]);
  const abierta = rondas.find((x) => x.status === "ABIERTA");
  const elegida =
    (typeof numeroPedido === "number" ? rondas.find((x) => x.number === numeroPedido) : undefined) ?? abierta ?? rondas[rondas.length - 1] ?? null;

  const [fotos, comentarios, decision] = elegida
    ? await Promise.all([
        prisma.fotofficeGaleriaFoto.findMany({
          where: { workspaceId, galeriaId: g.id, rondaId: elegida.id, status: "LISTA" },
          select: { id: true, fileName: true, order: true, thumbKey: true, width: true, height: true },
        }),
        prisma.fotofficeGaleriaComentario.findMany({
          where: { workspaceId, galeriaClienteId: c.id, rondaId: elegida.id },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, fotoId: true, author: true, body: true, createdAt: true, pinNumber: true, pinX: true, pinY: true },
        }),
        prisma.fotofficeGaleriaDecision.findFirst({
          where: { workspaceId, galeriaClienteId: c.id, rondaId: elegida.id },
          select: { decision: true, message: true, createdAt: true },
        }),
      ])
    : [[], [], null];

  const ordenadas = ordenarFotosDeGaleria(fotos, g.orderMode);
  const ids = new Set(ordenadas.map((f) => f.id));
  const urls = await urlsDeLecturaPorLote(ordenadas.map((f) => ({ id: f.id, viewKey: null, thumbKey: f.thumbKey })));
  const esLaAbierta = !!elegida && !!abierta && elegida.id === abierta.id;
  return {
    organizacion: { nombre: sitio?.nombre ?? "", logoUrl: sitio?.logoUrl ?? null },
    galeria: { nombre: g.name, mensaje: g.message?.trim() ? g.message : null },
    cliente: { nombre: c.name },
    rondas: rondas.map((x) => ({ numero: x.number, estado: x.status as EstadoRonda })),
    ronda: { numero: elegida?.number ?? 1, estado: (elegida?.status as EstadoRonda | undefined) ?? "CERRADA", nota: elegida?.note?.trim() ? elegida.note : null },
    puedeComentar: esLaAbierta && puedeEditarElCliente(c.status) && !decision,
    decision: decision ? { decision: decision.decision as DecisionAlbum, mensaje: decision.message, fecha: fechaArgentina(decision.createdAt) } : null,
    laminas: ordenadas.map((f) => ({ id: f.id, thumbUrl: urls.get(f.id)?.thumbUrl ?? null, width: f.width, height: f.height })),
    comentarios: comentarios.filter((x) => ids.has(x.fotoId)).map(aComentario),
  };
}

/** Lo común de comentar y decidir: token vigente, galería de ÁLBUM, ronda abierta y cliente todavía eligiendo. */
async function contextoEditable(workspaceId: string, token: unknown): Promise<{ r: Resuelto; ronda: { id: string; numero: number } } | Falla> {
  const r = await resolverTokenGaleria(workspaceId, token);
  if (!r.ok) return INVALIDO();
  if (r.galeria.kind !== "ALBUM") return falla(MA.noEsAlbum);
  const ronda = await prisma.fotofficeGaleriaRonda.findFirst({ where: { workspaceId, galeriaId: r.galeria.id, status: "ABIERTA" }, select: { id: true, number: true } });
  if (!ronda) return falla(MA.rondaCerrada, "SOLO_LECTURA");
  if (!puedeEditarElCliente(r.cliente.status)) return falla(MA.yaDecidiste, "SOLO_LECTURA");
  return { r, ronda: { id: ronda.id, numero: ronda.number } };
}

/**
 * Deja un comentario en una lámina de la ronda abierta: con `pin` (x, y entre 0 y 1 respecto de la imagen mostrada;
 * recibe el número siguiente de ESA lámina para este cliente) o general (sin pin). Tope: 300 por cliente y ronda.
 */
export async function comentarLamina(
  workspaceId: string,
  token: unknown,
  fotoId: unknown,
  texto: unknown,
  pin?: unknown,
): Promise<{ ok: true; comentario: ComentarioLamina } | Falla> {
  const ctx = await contextoEditable(workspaceId, token);
  if ("ok" in ctx) return ctx;
  const { r, ronda } = ctx;
  const v = validarComentario(texto);
  if (!v.ok) return falla(v.error);
  const p = validarPin(pin);
  if (!p.ok) return falla(p.error);
  if (typeof fotoId !== "string" || !fotoId || fotoId.length > 40) return falla(MA.laminaInvalida);
  // La lámina tiene que ser LISTA y de la ronda abierta de ESTA galería.
  const lamina = await prisma.fotofficeGaleriaFoto.findFirst({
    where: { workspaceId, galeriaId: r.galeria.id, rondaId: ronda.id, status: "LISTA", id: fotoId },
    select: { id: true },
  });
  if (!lamina) return falla(MA.laminaInvalida);
  const propios = await prisma.fotofficeGaleriaComentario.count({ where: { workspaceId, galeriaClienteId: r.cliente.id, rondaId: ronda.id, author: "CLIENTE" } });
  if (propios >= MAX_COMENTARIOS_POR_RONDA) return falla(MA.topeComentarios, "TOPE");
  let pinNumber: number | null = null;
  if (p.pin) {
    const max = await prisma.fotofficeGaleriaComentario.aggregate({ where: { workspaceId, galeriaClienteId: r.cliente.id, fotoId: lamina.id }, _max: { pinNumber: true } });
    pinNumber = (max._max.pinNumber ?? 0) + 1;
  }
  const fila = await prisma.fotofficeGaleriaComentario.create({
    data: {
      workspaceId, galeriaClienteId: r.cliente.id, fotoId: lamina.id, author: "CLIENTE", body: v.texto, rondaId: ronda.id,
      pinX: p.pin?.x ?? null, pinY: p.pin?.y ?? null, pinNumber,
    },
    select: { id: true, fotoId: true, author: true, body: true, createdAt: true, pinNumber: true, pinX: true, pinY: true },
  });
  // Si en este instante decidió desde otra pestaña o el estudio abrió otra ronda, lo agregado después no vale.
  const sigue = await prisma.fotofficeGaleriaCliente.findFirst({ where: { id: r.cliente.id, workspaceId, status: "EN_PROGRESO", revokedAt: null }, select: { id: true } });
  const abierta = await prisma.fotofficeGaleriaRonda.findFirst({ where: { id: ronda.id, workspaceId, status: "ABIERTA" }, select: { id: true } });
  if (!sigue || !abierta) {
    await prisma.fotofficeGaleriaComentario.deleteMany({ where: { id: fila.id, workspaceId } });
    return falla(sigue ? MA.rondaCambio : MA.yaDecidiste, "SOLO_LECTURA");
  }
  return { ok: true, comentario: aComentario(fila) };
}

export type DecisionHecha = {
  ok: true;
  decision: DecisionAlbum;
  fecha: string;
  /** Lo que necesita `after()` para el correo al estudio (el cliente ya no espera). */
  aviso: { workspaceId: string; galeriaId: string; galeriaClienteId: string; rondaNumero: number; decision: DecisionAlbum; mensaje: string | null; comentarios: number };
};

class Rechazo extends Error {
  constructor(readonly falla: Falla) {
    super(falla.error);
  }
}

/**
 * La decisión del cliente sobre la ronda abierta: APROBADO o CAMBIOS (que exige mensaje o al menos un comentario suyo
 * en la ronda). Una sola transacción: el cliente pasa EN_PROGRESO → EN_REVISION con una escritura condicional (dos
 * envíos a la vez: gana uno) y se guarda la decisión (única por cliente y ronda) y el evento. Si algo falla, no queda nada.
 */
export async function decidirAlbum(workspaceId: string, token: unknown, decision: unknown, mensaje: unknown, ahora: Date = new Date()): Promise<DecisionHecha | Falla> {
  const ctx = await contextoEditable(workspaceId, token);
  if ("ok" in ctx) return ctx;
  const { r, ronda } = ctx;
  const propios = await prisma.fotofficeGaleriaComentario.count({ where: { workspaceId, galeriaClienteId: r.cliente.id, rondaId: ronda.id, author: "CLIENTE" } });
  const v = validarDecision(decision, mensaje, propios);
  if (!v.ok) return falla(v.error);
  try {
    await prisma.$transaction(async (tx) => {
      const cambio = await tx.fotofficeGaleriaCliente.updateMany({
        where: { id: r.cliente.id, workspaceId, revokedAt: null, status: "EN_PROGRESO" },
        data: { status: "EN_REVISION", submittedAt: ahora, submitMessage: v.mensaje },
      });
      if (cambio.count === 0) throw new Rechazo(falla(MA.yaDecidiste, "SOLO_LECTURA"));
      // La ronda sigue abierta (el estudio pudo abrir otra mientras el cliente escribía).
      const abierta = await tx.fotofficeGaleriaRonda.findFirst({ where: { id: ronda.id, workspaceId, galeriaId: r.galeria.id, status: "ABIERTA" }, select: { id: true } });
      if (!abierta) throw new Rechazo(falla(MA.rondaCambio, "SOLO_LECTURA"));
      try {
        await tx.fotofficeGaleriaDecision.create({
          data: { workspaceId, galeriaClienteId: r.cliente.id, rondaId: ronda.id, decision: v.decision, message: v.mensaje, createdAt: ahora },
          select: { id: true },
        });
      } catch (e) {
        if ((e as { code?: unknown } | null)?.code === "P2002") throw new Rechazo(falla(MA.yaDecidiste, "SOLO_LECTURA"));
        throw e;
      }
      await registrarEvento(tx, {
        workspaceId, galeriaId: r.galeria.id, galeriaClienteId: r.cliente.id,
        tipo: v.decision === "APROBADO" ? "ALBUM_APROBADO" : "ALBUM_CAMBIOS_PEDIDOS",
        data: { ronda: ronda.numero, comentarios: propios },
      });
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Rechazo) return e.falla;
    throw e;
  }
  return {
    ok: true,
    decision: v.decision,
    fecha: fechaArgentina(ahora),
    aviso: { workspaceId, galeriaId: r.galeria.id, galeriaClienteId: r.cliente.id, rondaNumero: ronda.numero, decision: v.decision, mensaje: v.mensaje, comentarios: propios },
  };
}
