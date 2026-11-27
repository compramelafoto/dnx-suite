"use server";

import { redirect } from "next/navigation";
import { codigoDeError, type CodigoError, type CodigoOk } from "@/lib/avisos";
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
import { parseEnteroPesos } from "@/lib/publicaciones/numeros";
import type { ListingInput } from "@/lib/publicaciones/reglas";

const LISTA = "/mis-publicaciones";

function text(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}

function entero(fd: FormData, k: string): number | null {
  return parseEnteroPesos(fd.get(k));
}

function checked(fd: FormData, k: string): boolean {
  return fd.get(k) === "on";
}

function optionalFile(fd: FormData, k: string): File | undefined {
  const f = fd.get(k);
  return f instanceof File && f.size > 0 ? f : undefined;
}

function errorDe(err: unknown, noEncontrado: CodigoError = "NO_ENCONTRADA_PUBLICACION"): CodigoError {
  return codigoDeError(err, { noEncontrado, origen: "mis-publicaciones" });
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

/**
 * Ejecuta y vuelve a `volver` con `?ok=CODIGO` o `?error=CODIGO`: por la URL nunca viaja texto,
 * la página lo traduce con `lib/avisos.ts`. `redirect` se llama fuera del try.
 */
async function run(volver: string, fn: () => Promise<CodigoOk | void>): Promise<never> {
  let query: string;
  try {
    const ok = await fn();
    query = ok ? `ok=${ok}` : "";
  } catch (err) {
    query = `error=${errorDe(err)}`;
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
    const ok: CodigoOk = status === "PUBLISHED" ? "PUBLICADO" : "EN_REVISION";
    destino = `${LISTA}/${listingId}?ok=${ok}`;
  } catch (err) {
    // Al publicar, lo que no se encuentra es el equipo.
    destino = `${formPage}?error=${errorDe(err, "NO_ENCONTRADO_EQUIPO")}`;
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
    return "CAMBIOS_GUARDADOS";
  });
}

export async function pausarPublicacion(formData: FormData) {
  const id = Number(text(formData, "id"));
  const volver = `${LISTA}/${id}`;
  const user = await requireLevel("identidad", volver);
  await run(volver, async () => {
    await pauseListing(user.id, id);
    return "PAUSADA";
  });
}

export async function reanudarPublicacion(formData: FormData) {
  const id = Number(text(formData, "id"));
  const volver = `${LISTA}/${id}`;
  const user = await requireLevel("identidad", volver);
  await run(volver, async () => {
    const { status } = await resumeListing(user.id, id);
    return status === "PUBLISHED" ? "REANUDADA" : "EN_REVISION";
  });
}

export async function cerrarPublicacion(formData: FormData) {
  const id = Number(text(formData, "id"));
  const volver = `${LISTA}/${id}`;
  const user = await requireLevel("identidad", volver);
  await run(volver, async () => {
    await closeListing(user.id, id);
    return "CERRADA";
  });
}
