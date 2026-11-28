"use server";

import { redirect } from "next/navigation";
import type { GearItemKind, GearItemStatus } from "@/lib/inventario/tipos";
import { requireLevel } from "@/lib/guards";
import { markRecovered, reportIncident } from "@/lib/inventario/denuncias";
import {
  attachItemPhoto,
  attachPurchaseProof,
  confirmSighting,
  createManualItem,
  dismissSighting,
  EquipoError,
  KIND_LABELS,
  STATUS_LABELS,
  updateItem,
} from "@/lib/inventario/equipos";

const LISTA = "/mi-equipo";

function text(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}

/** Vacío → null; número entero (pesos/dólares, no centavos) → number; otra cosa → NaN (la rechaza el dominio). */
function money(fd: FormData, k: string): number | null {
  const v = text(fd, k).replace(/[.\s]/g, "");
  if (!v) return null;
  return /^\d+$/.test(v) ? Number(v) : Number.NaN;
}

function dateOrNull(fd: FormData, k: string): Date | null {
  const v = text(fd, k);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  // Mediodía UTC: cae el mismo día calendario en Argentina (UTC-3).
  return new Date(`${v}T12:00:00.000Z`);
}

function kindOf(fd: FormData): GearItemKind {
  const k = text(fd, "kind");
  if (!(k in KIND_LABELS)) throw new EquipoError("DATO_INVALIDO", "Elegí el tipo de equipo.");
  return k as GearItemKind;
}

function messageOf(err: unknown): string {
  if (err instanceof EquipoError) {
    return err.code === "NO_ENCONTRADO" ? "No encontramos ese equipo." : err.message;
  }
  console.error("[mi-equipo] Error inesperado:", err);
  return "No pudimos completar la operación. Probá de nuevo.";
}

/** Ejecuta y vuelve a `volver` con `?ok=` o `?error=`. `redirect` se llama fuera del try. */
async function run(volver: string, fn: () => Promise<string | void>): Promise<never> {
  let query: string;
  try {
    const ok = await fn();
    query = ok ? `ok=${encodeURIComponent(ok)}` : "";
  } catch (err) {
    query = `error=${encodeURIComponent(messageOf(err))}`;
  }
  redirect(query ? `${volver}?${query}` : volver);
}

export async function esMio(formData: FormData) {
  const user = await requireLevel("identidad", LISTA);
  const id = Number(text(formData, "sightingId"));
  await run(LISTA, async () => {
    await confirmSighting(user.id, id);
    return "Equipo agregado a tu inventario.";
  });
}

export async function noEsMio(formData: FormData) {
  const user = await requireLevel("identidad", LISTA);
  const id = Number(text(formData, "sightingId"));
  await run(LISTA, async () => {
    await dismissSighting(user.id, id);
    return "Listo, no te lo volvemos a sugerir.";
  });
}

export async function agregarEquipo(formData: FormData) {
  const user = await requireLevel("identidad", LISTA);
  await run(LISTA, async () => {
    await createManualItem(user.id, {
      kind: kindOf(formData),
      make: text(formData, "make"),
      model: text(formData, "model"),
      serialRaw: text(formData, "serialRaw"),
      purchaseDate: dateOrNull(formData, "purchaseDate"),
      declaredValueArs: money(formData, "declaredValueArs"),
      declaredValueUsd: money(formData, "declaredValueUsd"),
      notes: text(formData, "notes"),
    });
    return "Equipo agregado.";
  });
}

export async function guardarEquipo(formData: FormData) {
  const id = Number(text(formData, "id"));
  const volver = `${LISTA}/${id}`;
  const user = await requireLevel("identidad", volver);
  await run(volver, async () => {
    const status = text(formData, "status");
    await updateItem(user.id, id, {
      kind: kindOf(formData),
      make: text(formData, "make"),
      model: text(formData, "model"),
      serialRaw: text(formData, "serialRaw"),
      purchaseDate: dateOrNull(formData, "purchaseDate"),
      declaredValueArs: money(formData, "declaredValueArs"),
      declaredValueUsd: money(formData, "declaredValueUsd"),
      notes: text(formData, "notes"),
      // El formulario sólo ofrece el estado cuando es editable a mano (no robado/perdido/recuperado).
      ...(status && status in STATUS_LABELS ? { status: status as GearItemStatus } : {}),
    });
    return "Cambios guardados.";
  });
}

function fileOf(fd: FormData, k: string): File {
  const f = fd.get(k);
  if (!(f instanceof File) || f.size === 0) {
    throw new EquipoError("ARCHIVO_INVALIDO", "Elegí un archivo.");
  }
  return f;
}

export async function subirFoto(formData: FormData) {
  const id = Number(text(formData, "id"));
  const volver = `${LISTA}/${id}`;
  const user = await requireLevel("identidad", volver);
  await run(volver, async () => {
    await attachItemPhoto(user.id, id, fileOf(formData, "file"));
    return "Foto agregada.";
  });
}

export async function subirComprobante(formData: FormData) {
  const id = Number(text(formData, "id"));
  const volver = `${LISTA}/${id}`;
  const user = await requireLevel("identidad", volver);
  await run(volver, async () => {
    await attachPurchaseProof(user.id, id, fileOf(formData, "file"));
    return "Comprobante guardado.";
  });
}

function optionalFile(fd: FormData, k: string): File | undefined {
  const f = fd.get(k);
  return f instanceof File && f.size > 0 ? f : undefined;
}

export async function denunciarEquipo(formData: FormData) {
  const id = Number(text(formData, "id"));
  const formPage = `${LISTA}/${id}/denunciar`;
  const user = await requireLevel("identidad", formPage);
  let destino: string;
  try {
    const incident = text(formData, "incident");
    if (incident !== "THEFT" && incident !== "LOST") {
      throw new EquipoError("DATO_INVALIDO", "Elegí si fue un robo o una pérdida.");
    }
    const occurredAt = dateOrNull(formData, "occurredAt");
    if (!occurredAt) throw new EquipoError("DATO_INVALIDO", "Indicá la fecha del hecho.");
    await reportIncident(user.id, id, {
      incident,
      occurredAt,
      place: text(formData, "place"),
      description: text(formData, "description"),
      policeReportNumber: text(formData, "policeReportNumber"),
      invoice: optionalFile(formData, "invoice"),
      policeReport: optionalFile(formData, "policeReport"),
    });
    destino = `${LISTA}/${id}?ok=${encodeURIComponent("Recibimos tu denuncia. La vamos a revisar.")}`;
  } catch (err) {
    destino = `${formPage}?error=${encodeURIComponent(messageOf(err))}`;
  }
  redirect(destino);
}

export async function loRecupere(formData: FormData) {
  const id = Number(text(formData, "id"));
  const volver = `${LISTA}/${id}`;
  const user = await requireLevel("identidad", volver);
  await run(volver, async () => {
    await markRecovered(user.id, id);
    return "Listo, marcamos el equipo como recuperado.";
  });
}
