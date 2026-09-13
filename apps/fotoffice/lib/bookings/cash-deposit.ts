import "server-only";
import type { Prisma, PrismaClient } from "@repo/db";
import { resolveDepositTarget } from "@/lib/cash/auto-deposit";
import { recordCashMovement } from "@/lib/cash/record-movement";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { findOrCreateClient } from "@/lib/clients/find-or-create";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";

/**
 * Parte un `contactName` de una sola pieza en `firstName`/`lastName`, que es como los guarda
 * `Client`.
 *
 * No hay forma de partir un nombre que ande bien en todos los casos: un apellido compuesto,
 * una persona con un solo nombre, o hasta una razón social que alguien tipeó en el campo de
 * contacto de la reserva. La decisión acá es explícita y prioriza no perder texto: la primera
 * palabra va a `firstName` y TODO el resto —compuesto o no— a `lastName`. Con un solo nombre,
 * `lastName` queda en null en vez de vacío, para no ensuciar el padrón con apellidos "". Nunca
 * se descarta ninguna palabra: perder el nombre entero es peor que partirlo de más.
 */
function splitContactName(contactName: string): { firstName: string; lastName: string | null } {
  const partes = contactName.trim().replace(/\s+/g, " ").split(" ");
  const [firstName, ...resto] = partes;
  return { firstName, lastName: resto.length > 0 ? resto.join(" ") : null };
}

/**
 * Busca o crea el `Client` de una reserva ya pagada, o `null` si no corresponde tocar nada.
 *
 * Con el módulo Clientes habilitado: si la reserva es de un socio, se busca la ficha (si
 * existe) ya enlazada a ese socio por `Client.memberId`, único por socio. Si no es de un
 * socio, se resuelve o da de alta el contacto con `findOrCreateClient` a partir de
 * `contactName`/`contactEmail`/`contactPhone` — es lo que tapa el agujero que motivó el
 * módulo Clientes: sin esto, un no socio que pagó no quedaba registrado en ningún padrón.
 *
 * Con el módulo Clientes apagado: no se resuelve nada, ni siquiera para el socio — ver el
 * comentario de la guarda más abajo.
 */
async function resolveBookingClient(
  tx: Prisma.TransactionClient | PrismaClient,
  input: {
    workspaceId: string;
    memberId: string | null;
    contactName: string;
    contactEmail: string;
    contactPhone: string | null;
  },
): Promise<string | null> {
  // La guarda va PRIMERO, antes de CUALQUIER acceso a `Client` — el del socio incluido.
  // `Client` es una tabla nueva de la misma migración que las de Caja, y en este repo las
  // migraciones se aplican a mano después del deploy del código: hay una ventana en la que el
  // código ya corre en producción pero la tabla todavía no existe. La Tarea 15 había movido la
  // resolución del socio (`tx.client.findUnique`) antes de este chequeo, así que una reserva de
  // socio con la migración sin aplicar rompía `depositBookingPayment` con un error de Postgres
  // que revienta la transacción del llamador (Mercado Pago o transferencia): el cobro no se
  // completaba, tuviera o no Caja encendida. Es la misma familia del crítico de la Tarea 12,
  // ahora por `Client` en vez de `CashAccount`/`CashCategory`. Por eso los dos caminos —socio y
  // no socio— quedan detrás de este único chequeo: si alguna vez alguien reordena esto de
  // nuevo, que sea a propósito y leyendo este comentario primero.
  const clientsEnabled = await isModuleEnabledForWorkspace(input.workspaceId, CLIENTS_MODULE_KEY);
  if (!clientsEnabled) return null;

  if (input.memberId) {
    const cliente = await tx.client.findUnique({
      where: { memberId: input.memberId },
      select: { id: true },
    });
    return cliente?.id ?? null;
  }

  const { firstName, lastName } = splitContactName(input.contactName);
  const { id } = await findOrCreateClient(tx as Prisma.TransactionClient, {
    workspaceId: input.workspaceId,
    email: input.contactEmail || null,
    phone: input.contactPhone,
    firstName,
    lastName,
  });
  return id;
}

/**
 * Deposita en Caja el cobro de una reserva, si el workspace la tiene encendida, y resuelve
 * (o da de alta) el `Client` de quien pagó.
 *
 * Una reserva se paga por dos caminos —Mercado Pago (`checkout.ts`) y transferencia
 * confirmada a mano (`lifecycle.ts`)— y los dos tienen que terminar en el mismo asiento y en
 * la misma ficha de cliente. Vive acá, aparte, para que esa decisión no se escriba dos veces y
 * se termine desincronizando.
 *
 * Va DENTRO de la transacción de quien llama, igual que en cuotas: el pago, su asiento y la
 * ficha de cliente nacen juntos o no nacen. Nunca lanza por falta de Caja, de Clientes o de
 * configuración — eso lo deciden `resolveBookingClient` y `resolveDepositTarget` de antemano,
 * sin escribir nada.
 */
export async function depositBookingPayment(
  tx: Prisma.TransactionClient | PrismaClient,
  input: {
    workspaceId: string;
    bookingId: string;
    memberId: string | null;
    contactName: string;
    contactEmail: string;
    contactPhone: string | null;
    spaceName: string;
    amountMinor: number;
    occurredAt: Date;
    paymentMethod: "MERCADO_PAGO" | "TRANSFERENCIA";
  },
): Promise<void> {
  // Sin importe no hay nada que asentar: una reserva "Sin cargo" no genera movimiento NI
  // cliente — el disparador es el pago, y acá no hubo. Si alguna vez una reserva llega pagada
  // con importe 0 por fuera de ese camino conocido, dejamos rastro de que el depósito se
  // salteó a propósito y por qué — si no, nadie se entera de que una reserva "pagada" nunca
  // llegó al libro.
  if (input.amountMinor <= 0) {
    console.warn("[fotoffice][reservas] reserva pagada con importe <= 0, no se deposita en Caja", {
      bookingId: input.bookingId,
      workspaceId: input.workspaceId,
      amountMinor: input.amountMinor,
    });
    return;
  }

  // Se resuelve antes de mirar Caja: son dos módulos independientes, y quién compró algo no
  // depende de si la institución además usa Caja para asentarlo.
  const clientId = await resolveBookingClient(tx, input);

  // Por qué se pregunta si Caja está habilitada ANTES de tocar `cashAccount`/`cashCategory`:
  // esas tablas las trae una migración que en este repo se aplica a mano, después del deploy
  // del código (no hay `migrate deploy` automático). Si el código sale antes que la migración,
  // un `findMany` contra una tabla ausente rompe con un error de Postgres DENTRO de la
  // transacción de quien llama y voltea la confirmación del pago de la reserva completa — en
  // cualquier workspace, tenga o no Caja encendida. Cortar acá antes de cualquier consulta a
  // Caja hace que ese despliegue desordenado sea inofensivo.
  const cashEnabled = await isModuleEnabledForWorkspace(input.workspaceId, CASH_MODULE_KEY);
  if (!cashEnabled) return;

  const destino = resolveDepositTarget({
    cashEnabled,
    paymentMethod: input.paymentMethod,
    accounts: await tx.cashAccount.findMany({
      where: { workspaceId: input.workspaceId, isActive: true },
      select: { id: true, name: true, kind: true, isDefault: true, isVault: true },
      orderBy: { order: "asc" },
    }),
    categories: await tx.cashCategory.findMany({
      where: { workspaceId: input.workspaceId, kind: "INGRESO", isActive: true },
      select: { id: true, name: true, kind: true },
    }),
    categoryName: "Alquiler de espacios",
  });

  if (!destino.ok) return;

  await recordCashMovement(tx, {
    workspaceId: input.workspaceId,
    accountId: destino.accountId,
    categoryId: destino.categoryId,
    clientId,
    kind: "INGRESO",
    amountMinor: input.amountMinor,
    occurredAt: input.occurredAt,
    description: `Alquiler — ${input.spaceName}`,
    paymentMethod: input.paymentMethod,
    sourceModule: "bookings",
    sourceRef: input.bookingId,
  });
}
