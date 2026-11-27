"use server";

import { redirect } from "next/navigation";
import { codigoDeError } from "@/lib/avisos";
import { alertFiltersOf, createAlert, deleteAlert } from "@/lib/catalogo/alertas";
import { parseCatalogFilters } from "@/lib/catalogo/buscar";
import { requireLevel } from "@/lib/guards";

/** Crear y borrar alertas. Vuelven a «/alertas» con `?ok=CODIGO` / `?error=CODIGO`. */

const CAMPOS = ["kind", "make", "mount", "maxPrice", "province"] as const;

/** Crea una alerta con los filtros del catálogo que vienen en campos ocultos. */
export async function crearAlerta(formData: FormData) {
  const sp: Record<string, string> = {};
  for (const c of CAMPOS) {
    const v = formData.get(c);
    if (typeof v === "string" && v.trim()) sp[c] = v;
  }
  // Sin sesión vuelve al catálogo con los mismos filtros, para tocar el botón de nuevo.
  const catalogo = `/equipos${Object.keys(sp).length ? `?${new URLSearchParams(sp)}` : ""}`;
  const user = await requireLevel("registrado", catalogo);

  let query: string;
  try {
    await createAlert(user.id, alertFiltersOf(parseCatalogFilters(sp)));
    query = "ok=ALERTA_CREADA";
  } catch (err) {
    query = `error=${codigoDeError(err, { origen: "alertas" })}`;
  }
  redirect(`/alertas?${query}`);
}

export async function borrarAlerta(formData: FormData) {
  const user = await requireLevel("registrado", "/alertas");
  const raw = formData.get("alertId");
  const alertId = Number(typeof raw === "string" ? raw.trim() : "");

  let query: string;
  try {
    await deleteAlert(user.id, alertId);
    query = "ok=ALERTA_BORRADA";
  } catch (err) {
    query = `error=${codigoDeError(err, { noEncontrado: "NO_ENCONTRADA_ALERTA", origen: "alertas" })}`;
  }
  redirect(`/alertas?${query}`);
}
