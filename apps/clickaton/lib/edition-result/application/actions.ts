"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  normalizeExpenseCategory,
  parsePercentToBps,
  parsePesosToMinor,
} from "../domain/result";

function pagePath(editionId: string) {
  return `${adminRoutes.editions}/${editionId}/numeros`;
}

function text(formData: FormData, key: string, max = 500): string | null {
  const value = String(formData.get(key) ?? "").trim().slice(0, max);
  return value || null;
}

function optionalDate(formData: FormData, key: string): Date | null {
  const value = String(formData.get(key) ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  // Mediodía en Argentina: la fecha no se corre de día con la zona horaria.
  return new Date(`${value}T15:00:00.000Z`);
}

function back(editionId: string, params: Record<string, string>): never {
  revalidatePath(pagePath(editionId));
  revalidatePath(adminRoutes.editionResults);
  const query = new URLSearchParams(params).toString();
  redirect(`${pagePath(editionId)}?${query}`);
}

async function assertEdition(editionId: string) {
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true },
  });
  if (!edition) throw new Error("Edición no encontrada.");
}

function readExpense(formData: FormData) {
  const concept = text(formData, "concept", 160);
  if (!concept) throw new Error("Poné un concepto para el gasto.");
  const amountMinor = parsePesosToMinor(formData.get("amount"));
  if (amountMinor == null) throw new Error("Poné el importe del gasto.");
  return {
    concept,
    description: text(formData, "description", 2000),
    category: normalizeExpenseCategory(formData.get("category")),
    amountMinor,
    paidBy: text(formData, "paidBy", 80),
    spentAt: optionalDate(formData, "spentAt"),
    isEstimate: formData.get("isEstimate") === "on",
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export async function saveExpenseAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  const expenseId = text(formData, "expenseId", 64);
  try {
    await assertEdition(editionId);
    const data = readExpense(formData);
    if (expenseId) {
      const updated = await prisma.clickatonEditionExpense.updateMany({
        where: { id: expenseId, editionId },
        data: { ...data, updatedByUserId: user.id },
      });
      if (updated.count === 0) throw new Error("Ese gasto ya no existe.");
    } else {
      await prisma.clickatonEditionExpense.create({
        data: { ...data, editionId, createdByUserId: user.id, updatedByUserId: user.id },
      });
    }
  } catch (error) {
    back(editionId, { error: errorMessage(error) });
  }
  back(editionId, { ok: expenseId ? "Gasto actualizado." : "Gasto agregado." });
}

export async function deleteExpenseAction(editionId: string, expenseId: string) {
  await requireClickatonAdmin();
  await prisma.clickatonEditionExpense.deleteMany({ where: { id: expenseId, editionId } });
  back(editionId, { ok: "Gasto borrado." });
}

export async function saveLeftoverAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  const itemId = text(formData, "itemId", 64);
  try {
    await assertEdition(editionId);
    const itemName = text(formData, "itemName", 160);
    if (!itemName) throw new Error("Poné qué es lo que sobró.");
    const quantityRaw = String(formData.get("quantity") ?? "").trim();
    if (!/^\d+$/.test(quantityRaw)) throw new Error("La cantidad tiene que ser un número entero.");
    const carriedToEditionId = text(formData, "carriedToEditionId", 64);
    if (carriedToEditionId === editionId) {
      throw new Error("El sobrante no puede pasar a la misma edición.");
    }
    if (carriedToEditionId) await assertEdition(carriedToEditionId);
    const data = {
      itemName,
      detail: text(formData, "detail", 120),
      quantity: Number.parseInt(quantityRaw, 10),
      unitCostMinor: parsePesosToMinor(formData.get("unitCost")),
      countedAt: optionalDate(formData, "countedAt"),
      notes: text(formData, "notes", 1000),
      carriedToEditionId,
      updatedByUserId: user.id,
    };
    if (itemId) {
      const updated = await prisma.clickatonEditionLeftoverItem.updateMany({
        where: { id: itemId, editionId },
        data,
      });
      if (updated.count === 0) throw new Error("Ese ítem ya no existe.");
    } else {
      await prisma.clickatonEditionLeftoverItem.create({
        data: { ...data, editionId, createdByUserId: user.id },
      });
    }
    if (carriedToEditionId) revalidatePath(pagePath(carriedToEditionId));
  } catch (error) {
    back(editionId, { error: errorMessage(error) });
  }
  back(editionId, { ok: itemId ? "Sobrante actualizado." : "Sobrante agregado." });
}

export async function deleteLeftoverAction(editionId: string, itemId: string) {
  await requireClickatonAdmin();
  await prisma.clickatonEditionLeftoverItem.deleteMany({ where: { id: itemId, editionId } });
  back(editionId, { ok: "Sobrante borrado." });
}

export async function saveFeeSettingsAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  try {
    await assertEdition(editionId);
    const data = {
      mpProcessingFeeBps: parsePercentToBps(formData.get("processingPercent")),
      mpWithdrawalFeeBps: parsePercentToBps(formData.get("withdrawalPercent")),
      mpFeesActualMinor: parsePesosToMinor(formData.get("actualFees")),
      notes: text(formData, "notes", 1000),
      updatedByUserId: user.id,
    };
    await prisma.clickatonEditionResultSettings.upsert({
      where: { editionId },
      create: { editionId, ...data },
      update: data,
    });
  } catch (error) {
    back(editionId, { error: errorMessage(error) });
  }
  back(editionId, { ok: "Comisiones guardadas." });
}
