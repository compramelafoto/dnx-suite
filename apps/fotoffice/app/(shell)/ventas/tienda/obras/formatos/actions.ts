"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireStoreConfigurer } from "@/lib/store/access";
import { minorToDecimalString } from "@/lib/membership/money";
import { deleteOrDeactivatePrintFormat } from "@/lib/store/artworks/format-delete";
import { parseMinDpi, parsePrintFormatForm } from "@/lib/store/artworks/format-form";

/**
 * Acciones de la pantalla de formatos. Todas pasan por `requireStoreConfigurer`, toman el
 * workspace de la sesión y vuelven a comprobar que el formato sea de ese workspace.
 */

export type FormatsActionResult = { ok: true; message?: string } | { ok: false; error: string };

const RUTA = "/ventas/tienda/obras/formatos";

function idDe(valor: unknown): string | null {
  return typeof valor === "string" && valor !== "" ? valor : null;
}

export async function savePrintFormatAction(formData: FormData): Promise<FormatsActionResult> {
  const { workspace } = await requireStoreConfigurer();
  const parsed = parsePrintFormatForm(formData);
  if (!parsed.ok) return parsed;
  const v = parsed.values;
  const data = {
    name: v.name,
    kind: v.kind,
    widthCm: v.widthCm,
    heightCm: v.heightCm,
    priceArs: minorToDecimalString(v.priceMinor),
    costArs: v.costMinor === null ? null : minorToDecimalString(v.costMinor),
    weightGrams: v.weightGrams,
    packLengthCm: v.packLengthCm,
    packWidthCm: v.packWidthCm,
    packHeightCm: v.packHeightCm,
  };
  const aviso = parsed.warnings.length > 0 ? ` ${parsed.warnings.join(" ")}` : "";

  const id = idDe(formData.get("id"));
  if (id) {
    const { count } = await prisma.printFormat.updateMany({ where: { id, workspaceId: workspace.id }, data });
    if (count === 0) return { ok: false, error: "No encontramos ese formato." };
    revalidatePath(RUTA);
    return { ok: true, message: `Formato actualizado.${aviso}` };
  }

  const ultimo = await prisma.printFormat.aggregate({ where: { workspaceId: workspace.id }, _max: { sortOrder: true } });
  await prisma.printFormat.create({
    data: { ...data, workspaceId: workspace.id, sortOrder: (ultimo._max.sortOrder ?? -1) + 1 },
  });
  revalidatePath(RUTA);
  return { ok: true, message: `Formato creado.${aviso}` };
}

export async function setPrintFormatActiveAction(formatId: string, isActive: boolean): Promise<FormatsActionResult> {
  const { workspace } = await requireStoreConfigurer();
  const id = idDe(formatId);
  if (!id) return { ok: false, error: "Falta el formato." };
  const { count } = await prisma.printFormat.updateMany({
    where: { id, workspaceId: workspace.id },
    data: { isActive: isActive === true },
  });
  if (count === 0) return { ok: false, error: "No encontramos ese formato." };
  revalidatePath(RUTA);
  return { ok: true, message: isActive ? "Formato activado." : "Formato desactivado: ya no se ofrece en la tienda." };
}

/** Borra si nunca se usó en un pedido; si se usó, lo desactiva y lo avisa. */
export async function deletePrintFormatAction(formatId: string): Promise<FormatsActionResult> {
  const { workspace } = await requireStoreConfigurer();
  const id = idDe(formatId);
  if (!id) return { ok: false, error: "Falta el formato." };
  const resultado = await deleteOrDeactivatePrintFormat(workspace.id, id);
  if (resultado === "not_found") return { ok: false, error: "No encontramos ese formato." };
  revalidatePath(RUTA);
  if (resultado === "deactivated") {
    return {
      ok: true,
      message: "Este formato ya se usó en pedidos, así que no se puede borrar. Lo dejamos desactivado.",
    };
  }
  return { ok: true, message: "Formato borrado." };
}

export async function movePrintFormatAction(formatId: string, direction: "up" | "down"): Promise<FormatsActionResult> {
  const { workspace } = await requireStoreConfigurer();
  const id = idDe(formatId);
  if (!id || (direction !== "up" && direction !== "down")) return { ok: false, error: "Falta el formato." };
  const todos = await prisma.printFormat.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const i = todos.findIndex((f) => f.id === id);
  if (i === -1) return { ok: false, error: "No encontramos ese formato." };
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= todos.length) return { ok: true };
  const orden = todos.map((f) => f.id);
  [orden[i], orden[j]] = [orden[j], orden[i]];
  // Se renumera todo: así los empates viejos (mismo sortOrder) no rompen el orden.
  await prisma.$transaction(
    orden.map((fid, pos) => prisma.printFormat.updateMany({ where: { id: fid, workspaceId: workspace.id }, data: { sortOrder: pos } })),
  );
  revalidatePath(RUTA);
  return { ok: true };
}

export async function savePrintSettingsAction(formData: FormData): Promise<FormatsActionResult> {
  const { workspace } = await requireStoreConfigurer();
  const raw = formData.get("minDpi");
  const dpi = parseMinDpi(typeof raw === "string" ? raw : "");
  if (!dpi.ok) return dpi;
  await prisma.storePrintSettings.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, minDpi: dpi.minDpi },
    update: { minDpi: dpi.minDpi },
  });
  revalidatePath(RUTA);
  revalidatePath("/ventas/tienda/obras");
  return { ok: true, message: "Resolución mínima guardada." };
}
