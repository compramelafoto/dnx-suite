"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSponsorsManager } from "@/lib/sponsors/access";
import {
  SponsorsError,
  assignPlacement,
  cancelPlacement,
  createSponsor,
  linkSponsor,
  saveSponsorLogo,
  unlinkSponsor,
  updateSponsorCommon,
  updateSponsorLocal,
} from "@/lib/sponsors/repository";

/**
 * Las acciones del módulo de sponsors.
 *
 * Todas empiezan por `requireSponsorsManager()`: una acción de servidor es una ruta pública
 * aunque se la llame desde un formulario del panel. Las reglas (qué es válido, qué lugar
 * queda libre) viven en `lib/sponsors/`; acá sólo se lee el formulario y se vuelve con un
 * mensaje.
 */

const LISTA = "/sponsors";

function texto(formData: FormData, campo: string): string {
  return formData.get(campo)?.toString() ?? "";
}

function ficha(partnerId: string, query = ""): string {
  const base = `${LISTA}/${encodeURIComponent(partnerId)}`;
  return query ? `${base}?${query}` : base;
}

function conError(destino: string, mensaje: string): never {
  redirect(`${destino}${destino.includes("?") ? "&" : "?"}error=${encodeURIComponent(mensaje)}`);
}

/** Corre la escritura y traduce los errores esperables en un mensaje para la pantalla. */
async function intentar<T>(destinoError: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof SponsorsError) conError(destinoError, error.message);
    console.error("[fotoffice][sponsors] falló una acción", {
      detalle: error instanceof Error ? error.message : String(error),
    });
    conError(destinoError, "No se pudo guardar. Probá de nuevo en un rato.");
  }
}

function refrescar(partnerId?: string) {
  revalidatePath(LISTA);
  if (partnerId) revalidatePath(`${LISTA}/${partnerId}`);
}

export async function vincularSponsorAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSponsorsManager();
  const partnerId = texto(formData, "partnerId").trim();
  if (!partnerId) conError(`${LISTA}/nuevo`, "Elegí un sponsor de la lista.");
  await intentar(`${LISTA}/nuevo`, () => linkSponsor({ workspaceId: workspace.id, partnerId }));
  refrescar(partnerId);
  redirect(ficha(partnerId, "ok=vinculado"));
}

export async function crearSponsorAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSponsorsManager();
  const partnerId = await intentar(`${LISTA}/nuevo`, () =>
    createSponsor({
      workspaceId: workspace.id,
      name: texto(formData, "name"),
      websiteUrl: texto(formData, "websiteUrl"),
      instagram: texto(formData, "instagram"),
    }),
  );
  refrescar(partnerId);
  redirect(ficha(partnerId, "ok=creado"));
}

export async function guardarFichaComunAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSponsorsManager();
  const partnerId = texto(formData, "partnerId");
  await intentar(ficha(partnerId), () =>
    updateSponsorCommon(workspace.id, partnerId, {
      name: texto(formData, "name"),
      websiteUrl: texto(formData, "websiteUrl"),
      instagram: texto(formData, "instagram"),
    }),
  );
  refrescar(partnerId);
  redirect(ficha(partnerId, "ok=comun"));
}

export async function guardarDatosPropiosAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSponsorsManager();
  const partnerId = texto(formData, "partnerId");
  await intentar(ficha(partnerId), () =>
    updateSponsorLocal(workspace.id, partnerId, {
      title: texto(formData, "title"),
      description: texto(formData, "description"),
      destinationUrl: texto(formData, "destinationUrl"),
      notes: texto(formData, "notes"),
    }),
  );
  refrescar(partnerId);
  redirect(ficha(partnerId, "ok=propios"));
}

export async function subirLogoAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSponsorsManager();
  const partnerId = texto(formData, "partnerId");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) conError(ficha(partnerId), "Elegí un archivo de logo.");
  const resultado = await intentar(ficha(partnerId), () =>
    saveSponsorLogo({ workspaceId: workspace.id, partnerId, file: file as File }),
  );
  if (!resultado.ok) conError(ficha(partnerId), resultado.error);
  refrescar(partnerId);
  redirect(ficha(partnerId, "ok=logo"));
}

export async function asignarEspacioAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSponsorsManager();
  const partnerId = texto(formData, "partnerId");
  const resultado = await intentar(ficha(partnerId), () =>
    assignPlacement({
      workspaceId: workspace.id,
      partnerId,
      placementKey: texto(formData, "placementKey"),
      desde: texto(formData, "desde"),
      hasta: texto(formData, "hasta"),
    }),
  );
  if (!resultado.ok) conError(ficha(partnerId), resultado.error);
  refrescar(partnerId);
  redirect(ficha(partnerId, "ok=asignado"));
}

export async function quitarEspacioAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSponsorsManager();
  const partnerId = texto(formData, "partnerId");
  await intentar(ficha(partnerId), () => cancelPlacement(workspace.id, texto(formData, "bookingId")));
  refrescar(partnerId);
  redirect(ficha(partnerId, "ok=quitado"));
}

export async function desvincularSponsorAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSponsorsManager();
  const partnerId = texto(formData, "partnerId");
  await intentar(ficha(partnerId), () => unlinkSponsor(workspace.id, partnerId));
  refrescar(partnerId);
  redirect(`${LISTA}?ok=desvinculado`);
}
