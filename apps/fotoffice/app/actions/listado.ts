"use server";

import { revalidatePath } from "next/cache";
import { contextoDeListado, exigirCapacidad } from "@/lib/listado/acceso";
import { definicionDe, LISTAS } from "@/lib/listado/registro";
import { borrarVista, crearVista, normalizarNombreVista, renombrarVista, sanearQuery } from "@/lib/listado/vistas";

type Estado = { error: string | null; ok?: boolean };

const SIN_ACCESO: Estado = { error: "No tenés acceso a esta lista." };
const VISTA_AJENA: Estado = { error: "No encontramos esa vista o no podés modificarla." };

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === "string" ? v : "";
}

export async function guardarVistaAction(_prev: Estado, formData: FormData): Promise<Estado> {
  const clave = texto(formData, "clave");
  const ctx = await contextoDeListado(clave);
  if (!ctx) return SIN_ACCESO;
  const def = await definicionDe(clave, ctx);
  if (!def) return SIN_ACCESO;

  const nombre = normalizarNombreVista(texto(formData, "nombre"));
  if (!nombre) return { error: "Poné un nombre de hasta 60 caracteres." };
  const compartida = texto(formData, "compartida") === "on";
  if (compartida && !exigirCapacidad(ctx, "configurar")) {
    return { error: "Sólo el dueño o un administrador pueden compartir vistas con el equipo." };
  }
  await crearVista(ctx, clave, nombre, sanearQuery(def, texto(formData, "query")), compartida);
  revalidatePath(LISTAS[clave].ruta);
  return { error: null, ok: true };
}

export async function renombrarVistaAction(_prev: Estado, formData: FormData): Promise<Estado> {
  const clave = texto(formData, "clave");
  const ctx = await contextoDeListado(clave);
  if (!ctx) return SIN_ACCESO;
  const nombre = normalizarNombreVista(texto(formData, "nombre"));
  if (!nombre) return { error: "Poné un nombre de hasta 60 caracteres." };
  if (!(await renombrarVista(ctx, texto(formData, "id"), nombre))) return VISTA_AJENA;
  revalidatePath(LISTAS[clave].ruta);
  return { error: null, ok: true };
}

export async function borrarVistaAction(_prev: Estado, formData: FormData): Promise<Estado> {
  const clave = texto(formData, "clave");
  const ctx = await contextoDeListado(clave);
  if (!ctx) return SIN_ACCESO;
  if (!(await borrarVista(ctx, texto(formData, "id")))) return VISTA_AJENA;
  revalidatePath(LISTAS[clave].ruta);
  return { error: null, ok: true };
}
