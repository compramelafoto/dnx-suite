"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireSalesStaff } from "@/lib/sales/access";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canPrepareFotoCarnet } from "@/lib/foto-carnet/acceso";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { listClients } from "@/lib/clients/repository";
import { parseClientForm } from "@/lib/clients/client-form";
import { crearClienteConNumero } from "@/lib/clients/alta";
import { matchExistingClient } from "@/lib/clients/match";
import { clientDisplayName } from "@/lib/clients/display";
import { parseMovementForm } from "@/lib/cash/movement-form";
import { formatMinorArs, minorToDecimalString } from "@/lib/membership/money";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";

/**
 * Lo que el mostrador necesita sin salir de la pantalla: buscar al cliente, darlo de alta en el
 * momento y anotar un egreso. Devuelven un resultado en vez de redirigir: el ticket a medio
 * armar vive en el navegador y una redirección lo perdería.
 */

export type ClienteBuscado = {
  id: string;
  nombre: string;
  numero: number;
  documento: string | null;
  email: string | null;
  telefono: string | null;
};

const MAX_RESULTADOS = 8;

/**
 * Buscar y dar de alta clientes también lo hace la pantalla de Foto carnet, que es un módulo
 * aparte: alcanza con gestionar Ventas o Foto carnet. Lo que se puede hacer con los clientes lo
 * sigue decidiendo el nivel en Clientes, adentro de cada acción.
 */
async function requireBuscadorDeClientes() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace || !(await canPrepareFotoCarnet(user.id, workspace.id))) redirect("/dashboard");
  return { user, workspace };
}

/** Cualquier dato sirve: nombre, apellido, razón social, DNI, correo o teléfono (`listClients`). */
export async function buscarClientesAction(q: string): Promise<ClienteBuscado[]> {
  const { user, workspace } = await requireBuscadorDeClientes();
  const texto = q.trim();
  if (texto.length < 2) return [];
  if (!hasLevel(await getModuleLevel(user.id, workspace.id, CLIENTS_MODULE_KEY), "VIEW")) return [];
  const filas = await listClients(workspace.id, { search: texto, status: "ACTIVO" });
  return filas.slice(0, MAX_RESULTADOS).map((c) => ({
    id: c.id,
    nombre: c.displayName,
    numero: c.clientNumber,
    documento: c.docNumber,
    email: c.email,
    telefono: c.phone,
  }));
}

export type AltaRapidaResultado =
  | { ok: true; cliente: ClienteBuscado; yaExistia: boolean }
  | { ok: false; error: string };

/**
 * Alta de un cliente desde el mostrador. Valida igual que la pantalla de Clientes
 * (`parseClientForm`) y, si el DNI, el correo o el teléfono ya son de alguien, devuelve a ese
 * cliente en vez de crear una ficha duplicada: el historial tiene que quedar en una sola.
 */
export async function altaRapidaClienteAction(formData: FormData): Promise<AltaRapidaResultado> {
  const { user, workspace } = await requireBuscadorDeClientes();
  if (!hasLevel(await getModuleLevel(user.id, workspace.id, CLIENTS_MODULE_KEY), "MANAGE")) {
    return { ok: false, error: "No tenés permiso para dar de alta clientes." };
  }

  // Del mostrador sólo llega el DNI: el tipo se completa solo si se escribió un número.
  if (String(formData.get("docNumber") ?? "").trim() !== "" && !formData.get("docType")) formData.set("docType", "DNI");
  const parsed = parseClientForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const v = parsed.values;

  if (v.docNumber || v.email || v.phone) {
    const candidatos = await prisma.client.findMany({
      where: {
        workspaceId: workspace.id,
        OR: [
          ...(v.docNumber ? [{ docNumber: v.docNumber }] : []),
          ...(v.email ? [{ email: v.email }] : []),
          ...(v.phone ? [{ phone: v.phone }] : []),
        ],
      },
      select: {
        id: true,
        clientNumber: true,
        kind: true,
        firstName: true,
        lastName: true,
        businessName: true,
        docNumber: true,
        email: true,
        phone: true,
      },
      take: 50,
    });
    const existente = matchExistingClient(candidatos, { docNumber: v.docNumber, email: v.email, phone: v.phone });
    if (existente) {
      return {
        ok: true,
        yaExistia: true,
        cliente: {
          id: existente.id,
          nombre: clientDisplayName(existente),
          numero: existente.clientNumber,
          documento: existente.docNumber,
          email: existente.email,
          telefono: existente.phone,
        },
      };
    }
  }

  const id = await crearClienteConNumero(workspace.id, v, { userId: user.id, label: etiquetaDeUsuario(user) });
  if (id === null) return { ok: false, error: "No se pudo asignar un número de cliente. Probá de nuevo." };
  const creado = await prisma.client.findUniqueOrThrow({
    where: { id },
    select: { id: true, clientNumber: true, kind: true, firstName: true, lastName: true, businessName: true, docNumber: true, email: true, phone: true },
  });
  revalidatePath("/clientes");
  return {
    ok: true,
    yaExistia: false,
    cliente: {
      id: creado.id,
      nombre: clientDisplayName(creado),
      numero: creado.clientNumber,
      documento: creado.docNumber,
      email: creado.email,
      telefono: creado.phone,
    },
  };
}

export type EgresoResultado = { ok: true; mensaje: string } | { ok: false; error: string };

/**
 * Un egreso cargado desde el mostrador (lo que sale de la caja: insumos, un pago, un retiro).
 * Las mismas reglas que Caja → Anotar (`createMovementAction`): hace falta poder operar la caja,
 * la cuenta y la categoría tienen que ser del negocio, y si la cuenta tiene un turno abierto el
 * egreso queda en ese turno, así el arqueo lo descuenta.
 */
export async function registrarEgresoAction(formData: FormData): Promise<EgresoResultado> {
  const { user, workspace } = await requireSalesStaff();
  if (!hasLevel(await getModuleLevel(user.id, workspace.id, CASH_MODULE_KEY), "MANAGE")) {
    return { ok: false, error: "No tenés permiso para cargar egresos en la caja." };
  }

  formData.set("kind", "EGRESO");
  const parsed = parseMovementForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const v = parsed.values;

  const cuenta = await prisma.cashAccount.findFirst({
    where: { id: v.accountId, workspaceId: workspace.id },
    select: { name: true },
  });
  if (!cuenta) return { ok: false, error: "Esa cuenta no existe." };
  if (v.categoryId) {
    const categoria = await prisma.cashCategory.count({ where: { id: v.categoryId, workspaceId: workspace.id, kind: "EGRESO" } });
    if (categoria === 0) return { ok: false, error: "Esa categoría no es de egresos." };
  }

  const turno = await prisma.cashShift.findFirst({
    where: { workspaceId: workspace.id, accountId: v.accountId, status: "ABIERTO" },
    select: { id: true },
  });

  await prisma.cashMovement.create({
    data: {
      workspaceId: workspace.id,
      accountId: v.accountId,
      shiftId: turno?.id ?? null,
      kind: "EGRESO",
      amountArs: minorToDecimalString(v.amountMinor),
      occurredAt: v.occurredAt,
      categoryId: v.categoryId,
      paymentMethod: v.paymentMethod,
      clientId: null,
      description: v.description,
      receiptRef: v.receiptRef,
      sourceModule: "manual",
      createdByUserId: user.id,
    },
  });

  revalidatePath("/caja");
  revalidatePath("/caja/movimientos");
  return { ok: true, mensaje: `Egreso de ${formatMinorArs(v.amountMinor)} anotado en ${cuenta.name}.` };
}
