"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@repo/db";
import { requireMembersManageContext } from "@/lib/members/access";
import { cargarRecorridoDeSocio } from "@/lib/box-mensual/store";
import { direccionDeEnvio, etiquetaBox, materialesDesdeFormulario } from "@/lib/box-mensual/secuencia";

/**
 * BOX mensual — acciones del panel. Todas exigen gestionar Socios: preparar y despachar cajas
 * es trabajo de quien administra el padrón, no de quien sólo lo consulta.
 */

export type BoxActionState = { error: string | null; ok?: string | null };

const texto = (formData: FormData, k: string, max: number) => {
  const v = formData.get(k)?.toString().trim() ?? "";
  return v ? v.slice(0, max) : null;
};

function refrescar(memberId?: string) {
  revalidatePath("/members/box");
  revalidatePath("/members/box/preparar");
  revalidatePath("/members/box/enviadas");
  if (memberId) revalidatePath(`/members/${memberId}`);
}

/**
 * Marca como enviada la caja que le toca a una persona.
 *
 * La caja no se toma del formulario a ciegas: se vuelve a calcular el recorrido acá, así dos
 * personas del equipo que marcan a la vez —o una pantalla vieja— no mandan una caja salteada
 * ni una segunda caja que no corresponde. La dirección se copia del socio en este momento.
 */
export async function marcarBoxEnviadaAction(
  _prev: BoxActionState | undefined,
  formData: FormData,
): Promise<BoxActionState> {
  const { workspace, user } = await requireMembersManageContext();
  const memberId = formData.get("memberId")?.toString().trim();
  const boxId = formData.get("boxId")?.toString().trim();
  if (!memberId || !boxId) return { error: "Faltan datos del envío. Actualizá la pantalla." };

  const actual = await cargarRecorridoDeSocio(workspace.id, memberId);
  if (!actual) return { error: "No encontramos a esa persona socia." };
  const { recorrido, socio } = actual;
  if (recorrido.estado !== "PARA_ENVIAR" || !recorrido.proxima) {
    return { error: "Esta persona no tiene ninguna caja pendiente. Actualizá la pantalla." };
  }
  if (recorrido.proxima.id !== boxId) {
    return {
      error: `Le toca la ${etiquetaBox(recorrido.proxima)}: alguien ya marcó otra caja. Actualizá la pantalla.`,
    };
  }
  const direccion = direccionDeEnvio(socio);
  if (!direccion) {
    return { error: "Falta la dirección (calle y localidad). Cargala en su ficha antes de enviar." };
  }

  try {
    await prisma.fotofficeBoxShipment.create({
      data: {
        workspaceId: workspace.id,
        memberId,
        boxId,
        boxNumber: recorrido.proxima.number,
        status: "ENVIADA",
        ...direccion,
        carrier: texto(formData, "carrier", 120),
        trackingCode: texto(formData, "trackingCode", 120),
        notes: texto(formData, "notes", 1000),
        shippedByUserId: user.id,
      },
    });
  } catch (e) {
    // `@@unique([memberId, boxId])`: otra persona del equipo la marcó un instante antes.
    if ((e as { code?: unknown })?.code === "P2002") {
      return { error: "Esa caja ya estaba marcada como enviada. Actualizá la pantalla." };
    }
    throw e;
  }

  refrescar(memberId);
  return { error: null, ok: `${etiquetaBox(recorrido.proxima)} marcada como enviada.` };
}

/** Marca un envío como entregado. */
export async function marcarBoxEntregadaAction(
  _prev: BoxActionState | undefined,
  formData: FormData,
): Promise<BoxActionState> {
  const { workspace } = await requireMembersManageContext();
  const id = formData.get("shipmentId")?.toString().trim();
  if (!id) return { error: "Envío inválido." };
  const r = await prisma.fotofficeBoxShipment.updateMany({
    where: { id, workspaceId: workspace.id, status: "ENVIADA" },
    data: { status: "ENTREGADA", deliveredAt: new Date() },
  });
  if (r.count === 0) return { error: "Ese envío ya estaba entregado o no existe." };
  const envio = await prisma.fotofficeBoxShipment.findFirst({ where: { id }, select: { memberId: true } });
  refrescar(envio?.memberId);
  return { error: null, ok: "Marcada como entregada." };
}

/**
 * Deshace un envío marcado por error. Sólo mientras no figure entregado: la caja vuelve a quedar
 * pendiente para esa persona.
 */
export async function deshacerEnvioBoxAction(
  _prev: BoxActionState | undefined,
  formData: FormData,
): Promise<BoxActionState> {
  const { workspace } = await requireMembersManageContext();
  const id = formData.get("shipmentId")?.toString().trim();
  if (!id) return { error: "Envío inválido." };
  const envio = await prisma.fotofficeBoxShipment.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { memberId: true, status: true },
  });
  if (!envio) return { error: "Ese envío no existe." };
  if (envio.status !== "ENVIADA") return { error: "Una caja entregada no se puede deshacer." };
  await prisma.fotofficeBoxShipment.deleteMany({ where: { id, workspaceId: workspace.id, status: "ENVIADA" } });
  refrescar(envio.memberId);
  return { error: null, ok: "Envío deshecho: la caja vuelve a quedar pendiente." };
}

const cajaSchema = z.object({
  number: z.number().int().min(1, "El N° tiene que ser 1 o más").max(1000),
  name: z.string().min(1, "Nombre obligatorio").max(160),
  description: z.string().max(2000).nullable(),
  isActive: z.boolean(),
});

/** Crea o edita una caja del catálogo (N°, nombre, descripción, materiales y si está activa). */
export async function guardarCajaAction(
  _prev: BoxActionState | undefined,
  formData: FormData,
): Promise<BoxActionState> {
  const { workspace } = await requireMembersManageContext();
  const id = formData.get("id")?.toString().trim() || null;

  const parsed = cajaSchema.safeParse({
    number: Number(formData.get("number")?.toString() ?? ""),
    name: formData.get("name")?.toString().trim() ?? "",
    description: texto(formData, "description", 2000),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos de la caja." };

  const materiales = materialesDesdeFormulario(
    formData.getAll("material").map(String),
    formData.getAll("perBox").map(String),
  );
  if (!materiales.ok) return { error: materiales.error };
  if (materiales.materiales.length === 0) return { error: "Cargá al menos un material." };

  const data = { ...parsed.data, materials: materiales.materiales };
  try {
    if (id) {
      const r = await prisma.fotofficeBox.updateMany({ where: { id, workspaceId: workspace.id }, data });
      if (r.count === 0) return { error: "Esa caja no existe." };
    } else {
      await prisma.fotofficeBox.create({ data: { workspaceId: workspace.id, ...data } });
    }
  } catch (e) {
    if ((e as { code?: unknown })?.code === "P2002") {
      return { error: `Ya hay un BOX N°${parsed.data.number}. Elegí otro número.` };
    }
    throw e;
  }

  refrescar();
  revalidatePath("/members/box/cajas");
  redirect("/members/box/cajas");
}
