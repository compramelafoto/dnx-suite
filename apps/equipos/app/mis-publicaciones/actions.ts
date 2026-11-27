"use server";

import { redirect } from "next/navigation";
import { requireLevel } from "@/lib/guards";
import { EquipoError } from "@/lib/inventario/equipos";
import {
  closeListing,
  createListing,
  pauseListing,
  resumeListing,
  updateListing,
} from "@/lib/publicaciones/publicar";
import { CONDITION_LABELS, type GearListingCondition } from "@/lib/publicaciones/catalogos";
import type { ListingInput } from "@/lib/publicaciones/reglas";

import { TEXTO_EN_REVISION } from "./textos";

const LISTA = "/mis-publicaciones";

function text(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}

/** Vacío → null; entero (pesos o dólares) → number; otra cosa → NaN (la rechaza el dominio). */
function entero(fd: FormData, k: string): number | null {
  const v = text(fd, k).replace(/[.\s]/g, "");
  if (!v) return null;
  return /^\d+$/.test(v) ? Number(v) : Number.NaN;
}

function checked(fd: FormData, k: string): boolean {
  return fd.get(k) === "on";
}

function optionalFile(fd: FormData, k: string): File | undefined {
  const f = fd.get(k);
  return f instanceof File && f.size > 0 ? f : undefined;
}

function messageOf(err: unknown): string {
  if (err instanceof EquipoError) {
    return err.code === "NO_ENCONTRADO" ? "No encontramos esa publicación." : err.message;
  }
  console.error("[mis-publicaciones] Error inesperado:", err);
  return "No pudimos completar la operación. Probá de nuevo.";
}

function inputOf(fd: FormData, socialConsent: boolean): ListingInput {
  const condition = text(fd, "condition");
  if (!(condition in CONDITION_LABELS)) {
    throw new EquipoError("DATO_INVALIDO", "Elegí el estado del equipo.");
  }
  return {
    priceArs: entero(fd, "priceArs") ?? Number.NaN,
    priceUsdRef: entero(fd, "priceUsdRef"),
    condition: condition as GearListingCondition,
    description: text(fd, "description"),
    accessories: text(fd, "accessories"),
    province: text(fd, "province"),
    city: text(fd, "city"),
    // El select manda "" cuando no se elige montura.
    mount: text(fd, "mount") || null,
    socialConsent,
    declaredFirstOwner: checked(fd, "declaredFirstOwner"),
    includesCharger: checked(fd, "includesCharger"),
    includesManual: checked(fd, "includesManual"),
    includesBox: checked(fd, "includesBox"),
    batteriesCount: entero(fd, "batteriesCount"),
  };
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

export async function publicarEquipo(formData: FormData) {
  const gearItemId = Number(text(formData, "gearItemId"));
  const formPage = `/mi-equipo/${gearItemId}/publicar`;
  const user = await requireLevel("identidad", formPage);
  let destino: string;
  try {
    const { listingId, status } = await createListing(
      user.id,
      gearItemId,
      inputOf(formData, checked(formData, "socialConsent")),
      {
        serialPhoto: optionalFile(formData, "serialPhoto"),
        proofPhoto: optionalFile(formData, "proofPhoto"),
      },
    );
    const ok = status === "PUBLISHED" ? "Tu equipo ya está publicado." : TEXTO_EN_REVISION;
    destino = `${LISTA}/${listingId}?ok=${encodeURIComponent(ok)}`;
  } catch (err) {
    destino = `${formPage}?error=${encodeURIComponent(messageOf(err))}`;
  }
  redirect(destino);
}

export async function guardarPublicacion(formData: FormData) {
  const id = Number(text(formData, "id"));
  const volver = `${LISTA}/${id}`;
  const user = await requireLevel("identidad", volver);
  await run(volver, async () => {
    // El consentimiento ya se dio al publicar; editar no lo vuelve a pedir.
    await updateListing(user.id, id, inputOf(formData, true));
    return "Cambios guardados.";
  });
}

export async function pausarPublicacion(formData: FormData) {
  const id = Number(text(formData, "id"));
  const volver = `${LISTA}/${id}`;
  const user = await requireLevel("identidad", volver);
  await run(volver, async () => {
    await pauseListing(user.id, id);
    return "Publicación pausada. Nadie la ve hasta que la reanudes.";
  });
}

export async function reanudarPublicacion(formData: FormData) {
  const id = Number(text(formData, "id"));
  const volver = `${LISTA}/${id}`;
  const user = await requireLevel("identidad", volver);
  await run(volver, async () => {
    const { status } = await resumeListing(user.id, id);
    return status === "PUBLISHED" ? "Publicación reanudada." : TEXTO_EN_REVISION;
  });
}

export async function cerrarPublicacion(formData: FormData) {
  const id = Number(text(formData, "id"));
  const volver = `${LISTA}/${id}`;
  const user = await requireLevel("identidad", volver);
  await run(volver, async () => {
    await closeListing(user.id, id);
    return "Publicación cerrada.";
  });
}
