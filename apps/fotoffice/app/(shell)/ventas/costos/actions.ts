"use server";

import { revalidatePath } from "next/cache";
import { requireSalesAdmin } from "@/lib/sales/access";
import {
  aplicarLista,
  aplicarPrecioSugerido,
  asignarProveedorMasivo,
  calibrarMargenes,
  crearLista,
  descartarLista,
  emparejarProducto,
  soltarProducto,
  guardarFilaCosto,
  guardarTramos,
  unirProveedores,
  vistaPreviaLista,
  type CambiosFilaCosto,
  type FilaCosto,
} from "@/lib/precios-proveedor/repositorio";
import { analizarCsvLista } from "@/lib/precios-proveedor/csv";
import type { FilaVistaPrevia } from "@/lib/precios-proveedor/vista-previa";
import type { TramoRedondeo } from "@/lib/precios-proveedor/redondeo";
import { guardarAjustesFotolibro, type AjustesFotolibro } from "@/lib/fotolibro/catalogo-precios";

const COSTOS = "/ventas/costos";
const MAX_CSV_BYTES = 2_000_000;

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function guardarFilaCostoAction(productId: string, cambios: CambiosFilaCosto): Promise<Resultado<{ fila: FilaCosto }>> {
  const { workspace } = await requireSalesAdmin();
  const r = await guardarFilaCosto(workspace.id, productId, cambios);
  if (r.ok) revalidatePath("/ventas/catalogo");
  return r;
}

export async function asignarProveedorMasivoAction(productIds: string[], proveedorId: string | null): Promise<Resultado<{ cantidad: number }>> {
  const { workspace } = await requireSalesAdmin();
  const cantidad = await asignarProveedorMasivo(workspace.id, productIds.slice(0, 2000), proveedorId);
  revalidatePath(COSTOS);
  return { ok: true, cantidad };
}

export async function calibrarMargenesAction(productIds: string[]): Promise<Resultado<{ calibrados: number; sinCosto: number; fueraDeRango: number }>> {
  const { workspace } = await requireSalesAdmin();
  const r = await calibrarMargenes(workspace.id, productIds.slice(0, 2000));
  revalidatePath(COSTOS);
  return { ok: true, ...r };
}

export async function aplicarPrecioSugeridoAction(productIds: string[]): Promise<Resultado<{ cantidad: number }>> {
  const { workspace } = await requireSalesAdmin();
  const cantidad = await aplicarPrecioSugerido(workspace.id, productIds.slice(0, 2000));
  revalidatePath(COSTOS);
  revalidatePath("/ventas/catalogo");
  return { ok: true, cantidad };
}

export async function guardarRedondeoAction(tramos: TramoRedondeo[]): Promise<Resultado> {
  const { workspace } = await requireSalesAdmin();
  const r = await guardarTramos(workspace.id, tramos);
  if (r.ok) revalidatePath(COSTOS);
  return r;
}

export async function unirProveedoresAction(pares: { texto: string; proveedorId: string | null; crear?: boolean }[]): Promise<Resultado<{ cantidad: number }>> {
  const { workspace } = await requireSalesAdmin();
  const cantidad = await unirProveedores(workspace.id, pares.slice(0, 200));
  revalidatePath(COSTOS);
  return { ok: true, cantidad };
}

export async function crearListaAction(proveedorId: string, csv: string, nombreArchivo: string | null): Promise<Resultado<{ id: string }>> {
  const { workspace, user } = await requireSalesAdmin();
  if (typeof csv !== "string" || csv.length > MAX_CSV_BYTES) return { ok: false, error: "El CSV es demasiado grande." };
  const r = await crearLista(workspace.id, user.id, proveedorId, nombreArchivo?.slice(0, 200) ?? null, analizarCsvLista(csv));
  if (r.ok) revalidatePath(`${COSTOS}/listas`);
  return r;
}

export async function emparejarProductoAction(listaId: string, itemId: string, productId: string, factor: number): Promise<Resultado<{ vista: FilaVistaPrevia[] }>> {
  const { workspace } = await requireSalesAdmin();
  const r = await emparejarProducto(workspace.id, itemId, productId, factor);
  if (!r.ok) return r;
  return { ok: true, vista: await vistaPreviaLista(workspace.id, listaId) };
}

export async function soltarProductoAction(listaId: string, itemId: string, productId: string): Promise<Resultado<{ vista: FilaVistaPrevia[] }>> {
  const { workspace } = await requireSalesAdmin();
  const r = await soltarProducto(workspace.id, itemId, productId);
  if (!r.ok) return r;
  return { ok: true, vista: await vistaPreviaLista(workspace.id, listaId) };
}

export async function aplicarListaAction(listaId: string): Promise<Resultado<{ actualizados: number }>> {
  const { workspace, user } = await requireSalesAdmin();
  const r = await aplicarLista(workspace.id, listaId, user.id);
  if (r.ok) {
    revalidatePath(COSTOS);
    revalidatePath(`${COSTOS}/listas`);
    revalidatePath("/ventas/catalogo");
  }
  return r;
}

export async function descartarListaAction(listaId: string): Promise<Resultado> {
  const { workspace } = await requireSalesAdmin();
  const ok = await descartarLista(workspace.id, listaId);
  revalidatePath(`${COSTOS}/listas`);
  return ok ? { ok: true } : { ok: false, error: "Esta lista ya no se puede descartar." };
}

export async function guardarAjustesFotolibroAction(a: AjustesFotolibro): Promise<Resultado> {
  const { workspace } = await requireSalesAdmin();
  const r = await guardarAjustesFotolibro(workspace.id, a);
  if (r.ok) revalidatePath(COSTOS);
  return r;
}
