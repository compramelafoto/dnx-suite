import "server-only";
import { prisma, Prisma } from "@repo/db";
import { coincide } from "../reglas";
import { AccreditationError } from "./errores";
import { evaluateAccreditationEligibility } from "./elegibilidad";
import { hashQrPlaintext, issueRegistrationQrToken } from "./qr";

/**
 * La acreditación de un evento, del lado del servidor. Es el servicio de Clickatón
 * (`lib/accreditation/service.ts`) recortado a lo que tiene un evento de FOTOFFICE: un inscripto
 * es a la vez la inscripción y la credencial, y el check-in vive en el mismo renglón
 * (`acreditadoAt`). Se conservan las tres garantías de allá:
 *
 * - **Idempotente.** Cada confirmación viaja con una clave (`acreditacionClave`, única): el mismo
 *   escaneo repetido, o la cola sin conexión reenviada, no acredita dos veces.
 * - **Nunca pisa.** Se acredita con `acreditadoAt: null` en el `where`: si dos celulares escanean a
 *   la misma persona a la vez, entra uno y el otro ve "ya acreditado".
 * - **Todo dentro del negocio y del evento.** Un QR de otro evento no se encuentra.
 */

type Inscripto = Prisma.FotofficeEventoInscriptoGetPayload<object>;

export type ResultadoEscaneo = {
  tone: "GREEN" | "YELLOW" | "RED" | "BLUE";
  reason: string;
  canCheckIn: boolean;
  participant: {
    inscriptoId: string;
    nombre: string;
    codigo: string;
    tipo: string | null;
    estadoPago: string;
    instagram: string | null;
    fotoUrl: string | null;
    dni: string | null;
  };
  checkIn: { checkedInAt: string; operatorName: string | null; fuente: string | null } | null;
};

async function cargarEvento(workspaceId: string, eventoId: string) {
  const evento = await prisma.fotofficeEvento.findFirst({
    where: { id: eventoId, workspaceId },
    select: { id: true, acreditacionHabilitada: true },
  });
  if (!evento) throw new AccreditationError("NOT_FOUND", "No existe el evento.", 404);
  return evento;
}

async function nombreDeOperador(userId: number | null): Promise<string | null> {
  if (userId == null) return null;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  return u ? u.name?.trim() || u.email : null;
}

async function armarResultado(i: Inscripto, habilitada: boolean, excepcion = false): Promise<ResultadoEscaneo> {
  const e = evaluateAccreditationEligibility({
    estadoPago: i.estadoPago,
    alreadyCheckedIn: i.acreditadoAt != null,
    accreditationEnabled: habilitada,
    grantException: excepcion,
  });
  return {
    tone: e.tone,
    reason: e.reason,
    canCheckIn: e.canCheckIn,
    participant: {
      inscriptoId: i.id,
      nombre: i.nombre,
      codigo: i.codigo,
      tipo: i.tipo,
      estadoPago: i.estadoPago,
      instagram: i.instagram,
      fotoUrl: i.fotoUrl,
      dni: i.dni,
    },
    checkIn: i.acreditadoAt
      ? {
          checkedInAt: i.acreditadoAt.toISOString(),
          operatorName: await nombreDeOperador(i.acreditadoPorUserId),
          fuente: i.acreditadoFuente,
        }
      : null,
  };
}

/**
 * Guarda el hash del QR de los inscriptos que todavía no lo tienen. El QR se deriva del id, así que
 * es siempre el mismo: esto sólo deja anotado lo que el escáner va a buscar.
 */
export async function completarQrs(workspaceId: string, eventoId: string): Promise<void> {
  const faltan = await prisma.fotofficeEventoInscripto.findMany({
    where: { workspaceId, eventoId, qrTokenHash: null },
    select: { id: true },
    take: 2000,
  });
  for (const f of faltan) {
    const { tokenHash } = issueRegistrationQrToken({ inscriptoId: f.id });
    await prisma.fotofficeEventoInscripto.updateMany({ where: { id: f.id, qrTokenHash: null }, data: { qrTokenHash: tokenHash } });
  }
}

/** El texto del QR de un inscripto (y deja su hash guardado, por si todavía no estaba). */
export async function qrDeInscripto(inscriptoId: string): Promise<string> {
  const { plaintext, tokenHash } = issueRegistrationQrToken({ inscriptoId });
  await prisma.fotofficeEventoInscripto.updateMany({ where: { id: inscriptoId, qrTokenHash: null }, data: { qrTokenHash: tokenHash } });
  return plaintext;
}

/** El QR puede llegar como texto suelto o dentro de una dirección (`…?qr=`): se queda con el token. */
function limpiarQr(qr: string): string {
  const t = qr.trim();
  const m = t.match(/[?&]qr=([A-Za-z0-9_-]{20,64})/);
  return m ? m[1] : t;
}

async function buscarPorQr(workspaceId: string, eventoId: string, qr: string) {
  return prisma.fotofficeEventoInscripto.findFirst({
    where: { workspaceId, eventoId, qrTokenHash: hashQrPlaintext(limpiarQr(qr)) },
  });
}

async function buscarPorCodigo(workspaceId: string, eventoId: string, codigo: string) {
  return prisma.fotofficeEventoInscripto.findFirst({
    where: { workspaceId, eventoId, codigo: codigo.trim().toUpperCase() },
  });
}

export async function resolverPorQr(input: { workspaceId: string; eventoId: string; qr: string }) {
  const evento = await cargarEvento(input.workspaceId, input.eventoId);
  const i = await buscarPorQr(input.workspaceId, input.eventoId, input.qr);
  if (!i) throw new AccreditationError("QR_INVALID", "El QR no corresponde a ninguna entrada de este evento.", 404);
  return armarResultado(i, evento.acreditacionHabilitada);
}

export async function resolverPorCodigo(input: { workspaceId: string; eventoId: string; codigo: string }) {
  const evento = await cargarEvento(input.workspaceId, input.eventoId);
  const i = await buscarPorCodigo(input.workspaceId, input.eventoId, input.codigo);
  if (!i) throw new AccreditationError("SHORT_CODE_NOT_FOUND", "No hay ninguna entrada con ese código.", 404);
  return armarResultado(i, evento.acreditacionHabilitada);
}

export async function resolverPorId(input: { workspaceId: string; eventoId: string; inscriptoId: string }) {
  const evento = await cargarEvento(input.workspaceId, input.eventoId);
  const i = await prisma.fotofficeEventoInscripto.findFirst({
    where: { id: input.inscriptoId, workspaceId: input.workspaceId, eventoId: input.eventoId },
  });
  if (!i) throw new AccreditationError("NOT_FOUND", "No encontramos a esa persona en este evento.", 404);
  return armarResultado(i, evento.acreditacionHabilitada);
}

/** Búsqueda por nombre, DNI, teléfono o código, para cuando no hay QR. Hasta 10. */
export async function buscarInscriptos(input: { workspaceId: string; eventoId: string; q: string }) {
  await cargarEvento(input.workspaceId, input.eventoId);
  const todos = await prisma.fotofficeEventoInscripto.findMany({
    where: { workspaceId: input.workspaceId, eventoId: input.eventoId },
    orderBy: { nombre: "asc" },
  });
  return todos
    .filter((i) => coincide(i, input.q))
    .slice(0, 10)
    .map((i) => ({
      inscriptoId: i.id,
      nombre: i.nombre,
      codigo: i.codigo,
      tipo: i.tipo,
      estadoPago: i.estadoPago,
      acreditado: i.acreditadoAt != null,
      fotoUrl: i.fotoUrl,
    }));
}

export type ResultadoCheckIn = { duplicate: boolean; result: ResultadoEscaneo };

/**
 * Confirma la acreditación (Clickatón: `performCheckIn`). `clave` es la de idempotencia del pedido;
 * `excepcion` deja pasar un pago pendiente (cobro en la puerta).
 */
export async function acreditarConClave(input: {
  workspaceId: string;
  eventoId: string;
  inscriptoId: string;
  userId: number;
  clave: string;
  fuente: "QR" | "PUERTA" | "OFFLINE";
  excepcion?: boolean;
  cuando?: Date;
}): Promise<ResultadoCheckIn> {
  const evento = await cargarEvento(input.workspaceId, input.eventoId);

  const repetido = await prisma.fotofficeEventoInscripto.findFirst({
    where: { acreditacionClave: input.clave, workspaceId: input.workspaceId },
  });
  if (repetido) return { duplicate: true, result: await armarResultado(repetido, evento.acreditacionHabilitada) };

  const i = await prisma.fotofficeEventoInscripto.findFirst({
    where: { id: input.inscriptoId, workspaceId: input.workspaceId, eventoId: input.eventoId },
  });
  if (!i) throw new AccreditationError("NOT_FOUND", "No encontramos a esa persona en este evento.", 404);
  if (i.acreditadoAt) return { duplicate: true, result: await armarResultado(i, evento.acreditacionHabilitada) };

  const excepcion = Boolean(input.excepcion);
  const e = evaluateAccreditationEligibility({
    estadoPago: i.estadoPago,
    alreadyCheckedIn: false,
    accreditationEnabled: evento.acreditacionHabilitada,
    grantException: excepcion,
  });
  if (!e.canCheckIn) throw new AccreditationError(e.reason, "No se puede acreditar en este estado.", 409);

  try {
    const r = await prisma.fotofficeEventoInscripto.updateMany({
      where: { id: i.id, workspaceId: input.workspaceId, acreditadoAt: null },
      data: {
        acreditadoAt: input.cuando ?? new Date(),
        acreditadoPorUserId: input.userId,
        acreditadoFuente: excepcion && e.reason === "PAYMENT_PENDING" ? "EXCEPCION" : input.fuente,
        acreditacionClave: input.clave,
      },
    });
    const ahora = await prisma.fotofficeEventoInscripto.findUniqueOrThrow({ where: { id: i.id } });
    return { duplicate: r.count === 0, result: await armarResultado(ahora, evento.acreditacionHabilitada) };
  } catch (err) {
    // La misma clave en otra persona: un cliente que reusó la clave. No se acredita a nadie.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AccreditationError("IDEMPOTENCY_CONFLICT", "Ese pedido ya se usó para otra persona.", 409);
    }
    throw err;
  }
}

export type ResultadoOffline = { id: string; syncStatus: "SYNCED" | "CONFLICT" | "REJECTED"; reason?: string };

/**
 * Un escaneo tomado sin conexión (Clickatón: `enqueueOfflineEvent` + `syncOfflineEvents`). Allá se
 * encolaba en una tabla y se procesaba después; acá se procesa al llegar, con la misma respuesta
 * que espera la cola del celular: SINCRONIZADA, CONFLICTO (ya estaba, pago pendiente) o RECHAZADA
 * (no se encontró a nadie). El id que se devuelve es la clave del escaneo.
 */
export async function procesarEscaneoOffline(input: {
  workspaceId: string;
  eventoId: string;
  userId: number;
  idempotencyKey: string;
  clientOccurredAt: Date;
  qr?: string | null;
  shortCode?: string | null;
  inscriptoIdHint?: string | null;
}): Promise<ResultadoOffline> {
  const id = input.idempotencyKey;
  await cargarEvento(input.workspaceId, input.eventoId);

  let i: Inscripto | null = null;
  if (input.inscriptoIdHint) {
    i = await prisma.fotofficeEventoInscripto.findFirst({
      where: { id: input.inscriptoIdHint, workspaceId: input.workspaceId, eventoId: input.eventoId },
    });
  } else if (input.qr) {
    i = await buscarPorQr(input.workspaceId, input.eventoId, input.qr);
    if (!i) return { id, syncStatus: "REJECTED", reason: "QR_INVALID" };
  } else if (input.shortCode) {
    i = await buscarPorCodigo(input.workspaceId, input.eventoId, input.shortCode);
    if (!i) return { id, syncStatus: "REJECTED", reason: "SHORT_CODE_NOT_FOUND" };
  } else {
    return { id, syncStatus: "REJECTED", reason: "MISSING_IDENTIFIER" };
  }
  if (!i) return { id, syncStatus: "REJECTED", reason: "MISSING_IDENTIFIER" };
  if (i.acreditacionClave === id) return { id, syncStatus: "SYNCED" };

  // La hora es la de la puerta, no la de la sincronización; pero nunca en el futuro.
  const ahora = new Date();
  const cuando = input.clientOccurredAt.getTime() > ahora.getTime() ? ahora : input.clientOccurredAt;
  try {
    const r = await acreditarConClave({
      workspaceId: input.workspaceId,
      eventoId: input.eventoId,
      inscriptoId: i.id,
      userId: input.userId,
      clave: id,
      fuente: "OFFLINE",
      cuando,
    });
    // Ya había entrado por otro lado (otro celular, la búsqueda): no se duplicó, pero hay que mirarlo.
    if (r.duplicate) return { id, syncStatus: "CONFLICT", reason: "ALREADY_CHECKED_IN" };
    return { id, syncStatus: "SYNCED" };
  } catch (err) {
    if (err instanceof AccreditationError) return { id, syncStatus: "CONFLICT", reason: err.code };
    throw err;
  }
}

/** Enciende o apaga la acreditación por QR del evento. Devuelve cuántos ya entraron. */
export async function cambiarAcreditacionHabilitada(workspaceId: string, eventoId: string, habilitada: boolean) {
  await prisma.fotofficeEvento.updateMany({ where: { id: eventoId, workspaceId }, data: { acreditacionHabilitada: habilitada } });
}
