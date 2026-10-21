"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSalesStaff } from "@/lib/sales/access";
import { listProducts } from "@/lib/sales/repository";
import { crearDesdeRecepcion, type AltaRapida } from "@/lib/stock/alta-rapida";
import {
  agregarProductoALaRecepcion,
  confirmar,
  crearBorrador,
  descartar,
  enBorrador,
  escanear,
  guardarEncabezado,
  guardarLinea,
  leerRecepcion,
  quitarLinea,
} from "@/lib/stock/recepcion-servidor";
import { fechaDesdeInput } from "@/lib/stock/recepcion-pantalla";
import { escribirCsv, leerCsv } from "@/lib/stock/importacion/csv";
import { leerConIa, prepararEntrada } from "@/lib/stock/importacion/ia";
import {
  elegirProductoDeLineaImportada,
  filasDesdeLineas,
  importarEnRecepcion,
  recepcionEditable,
  subirArchivoDeRecepcion,
  type ResultadoImportacion,
} from "@/lib/stock/importacion/importar-servidor";

/**
 * Acciones de la recepción de pedidos. Cada una pide `requireSalesStaff` (lo mismo que "Cargar
 * entrada") y toma el negocio y la persona de ahí, nunca de lo que mande la pantalla. Las
 * reglas viven en `lib/stock/recepcion-servidor.ts` y `alta-rapida.ts`: acá sólo se arma lo
 * que llega y se refresca la pantalla.
 */

const LISTADO = "/ventas/stock/recepcion";

type Resultado = { ok: true } | { ok: false; error: string };

function refrescar(recepcionId: string) {
  revalidatePath(LISTADO);
  revalidatePath(`${LISTADO}/${recepcionId}`);
}

function texto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** "Recibir pedido": abre un borrador nuevo y lleva al editor. */
export async function crearRecepcionAction(): Promise<void> {
  const { workspace, user } = await requireSalesStaff();
  const { id } = await crearBorrador(workspace.id, user.id);
  revalidatePath(LISTADO);
  redirect(`${LISTADO}/${id}`);
}

export async function escanearAction(
  recepcionId: string,
  codigo: string,
): Promise<
  | { ok: true; resultado: "sumado" | "agregado" }
  | { ok: false; error: string; alta?: { codigo: string; nombre?: string; marca?: string | null } }
> {
  const { workspace } = await requireSalesStaff();
  const r = await escanear(workspace.id, texto(recepcionId), texto(codigo));
  if (r.ok) refrescar(recepcionId);
  return r;
}

export type ProductoBuscado = { id: string; nombre: string; detalle: string };

/** Buscador por nombre para agregar algo sin código. Productos e insumos activos, sin talles. */
export async function buscarProductosAction(busqueda: string): Promise<ProductoBuscado[]> {
  const { workspace } = await requireSalesStaff();
  const q = texto(busqueda).trim();
  if (q.length < 2) return [];
  const filas = await listProducts(workspace.id, { search: q, onlyActive: true });
  return filas
    .filter((p) => p.kind !== "SERVICIO" && p.variants.length === 0)
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      nombre: p.name,
      detalle: [p.kind === "INSUMO" ? "Insumo" : "Producto", p.sku, p.barcode].filter(Boolean).join(" · "),
    }));
}

/** Suma el producto elegido en el buscador (misma regla que el lector: bulto o suelto). */
export async function agregarProductoAction(recepcionId: string, productId: string): Promise<Resultado> {
  const { workspace } = await requireSalesStaff();
  const r = await enBorrador(workspace.id, texto(recepcionId), (tx) =>
    agregarProductoALaRecepcion(tx, {
      workspaceId: workspace.id,
      recepcionId: texto(recepcionId),
      productId: texto(productId),
      codigo: null,
      origen: "MANUAL",
    }),
  );
  if (!r.ok) return r;
  refrescar(recepcionId);
  return { ok: true };
}

/**
 * Cambios de una línea desde la tabla. Sólo viajan los campos que se editan acá (cantidad,
 * bultos y costo): el producto y el origen no se cambian desde la pantalla.
 */
export async function guardarLineaAction(
  recepcionId: string,
  lineaId: string,
  cambios: {
    cantidad?: number;
    enUnidadDeCompra?: boolean;
    unidadesPorCompra?: number | null;
    costoUnitarioMinor?: number | null;
  },
): Promise<Resultado> {
  const { workspace } = await requireSalesStaff();
  const linea: Parameters<typeof guardarLinea>[2] = { id: texto(lineaId) };
  if (!linea.id || !cambios || typeof cambios !== "object") return { ok: false, error: "Esa línea no existe." };
  if (typeof cambios.cantidad === "number") linea.cantidad = cambios.cantidad;
  if (typeof cambios.enUnidadDeCompra === "boolean") linea.enUnidadDeCompra = cambios.enUnidadDeCompra;
  if (cambios.unidadesPorCompra === null || typeof cambios.unidadesPorCompra === "number") {
    linea.unidadesPorCompra = cambios.unidadesPorCompra;
  }
  if (cambios.costoUnitarioMinor === null || typeof cambios.costoUnitarioMinor === "number") {
    linea.costoUnitarioMinor = cambios.costoUnitarioMinor;
  }
  const r = await guardarLinea(workspace.id, texto(recepcionId), linea);
  if (r.ok) refrescar(recepcionId);
  return r;
}

export async function quitarLineaAction(recepcionId: string, lineaId: string): Promise<Resultado> {
  const { workspace } = await requireSalesStaff();
  const r = await quitarLinea(workspace.id, texto(recepcionId), texto(lineaId));
  refrescar(recepcionId);
  return r;
}

export async function guardarEncabezadoAction(
  recepcionId: string,
  d: { proveedorId: string; fecha: string; comprobante: string; preciosConIva: boolean },
): Promise<Resultado> {
  const { workspace } = await requireSalesStaff();
  if (!d || typeof d !== "object") return { ok: false, error: "La fecha no se entiende." };
  const fecha = fechaDesdeInput(texto(d.fecha));
  if (!fecha) return { ok: false, error: "La fecha no se entiende." };
  const r = await guardarEncabezado(workspace.id, texto(recepcionId), {
    proveedorId: texto(d.proveedorId).trim() || null,
    fecha,
    comprobante: texto(d.comprobante),
    preciosConIva: d.preciosConIva === true,
    // La nota no se edita en esta pantalla: sin mandarla, la que tenga queda como está.
  });
  if (r.ok) refrescar(recepcionId);
  return r;
}

export async function descartarAction(recepcionId: string): Promise<Resultado> {
  const { workspace } = await requireSalesStaff();
  const r = await descartar(workspace.id, texto(recepcionId));
  refrescar(recepcionId);
  if (!r.ok) return r;
  redirect(LISTADO);
}

export async function confirmarAction(recepcionId: string): Promise<Resultado> {
  const { workspace, user } = await requireSalesStaff();
  const r = await confirmar(workspace.id, texto(recepcionId), user.id);
  if (!r.ok) return r;
  refrescar(recepcionId);
  revalidatePath("/ventas/stock");
  return { ok: true };
}

export async function altaRapidaAction(
  recepcionId: string,
  d: AltaRapida,
): Promise<{ ok: true; reutilizado: boolean } | { ok: false; error: string }> {
  const { workspace, user } = await requireSalesStaff();
  if (!d || typeof d !== "object") return { ok: false, error: "Escribí el nombre." };
  const kind = d.kind === "INSUMO" ? "INSUMO" : "PRODUCTO";
  const r = await crearDesdeRecepcion(workspace.id, user.id, texto(recepcionId), {
    codigo: texto(d.codigo).trim() || null,
    nombre: texto(d.nombre),
    kind,
    precioMinor: typeof d.precioMinor === "number" ? d.precioMinor : null,
    unidad: texto(d.unidad).trim() || null,
    unidadCompra: texto(d.unidadCompra).trim() || null,
    unidadesPorCompra: typeof d.unidadesPorCompra === "number" ? d.unidadesPorCompra : null,
  });
  if (!r.ok) return r;
  refrescar(recepcionId);
  return { ok: true, reutilizado: r.reutilizado };
}

// ---------------------------------------------------------------------------------------------
// Importar facturas (stock etapa 3)

const ERR_NO_EDITABLE = "Esa recepción ya no se puede modificar.";
const ERR_SIN_ARCHIVO = "Elegí un archivo.";
const MAX_BYTES_CSV = 1024 * 1024;

/** Foto, captura o PDF de la factura: se lee con IA y se vuelca en el borrador. */
export async function importarArchivoAction(formData: FormData): Promise<ResultadoImportacion> {
  const { workspace, user } = await requireSalesStaff();
  const recepcionId = texto(formData.get("recepcionId"));
  const archivo = formData.get("file");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: ERR_SIN_ARCHIVO };

  const original = { nombre: archivo.name, tipo: archivo.type, bytes: Buffer.from(await archivo.arrayBuffer()) };
  const entrada = await prepararEntrada(original);
  if (!entrada.ok) return entrada;
  // Antes de gastar una lectura con IA: la recepción tiene que seguir en borrador.
  if (!(await recepcionEditable(workspace.id, recepcionId))) return { ok: false, error: ERR_NO_EDITABLE };

  const leido = await leerConIa(workspace.id, user.id, entrada.bloques);
  if (!leido.ok) return leido;
  // El original se guarda recién con una lectura buena: así no quedan archivos sueltos en R2.
  const archivoKey = await subirArchivoDeRecepcion(workspace.id, recepcionId, original);
  const r = await importarEnRecepcion(workspace.id, recepcionId, user.id, "IA", leido.doc, archivoKey ?? undefined);
  refrescar(recepcionId);
  return r;
}

/** Texto pegado (un mail, un pedido copiado de la web del proveedor): se lee con IA. */
export async function importarTextoAction(recepcionId: string, contenido: string): Promise<ResultadoImportacion> {
  const { workspace, user } = await requireSalesStaff();
  const id = texto(recepcionId);
  const entrada = await prepararEntrada({ texto: texto(contenido) });
  if (!entrada.ok) return entrada;
  if (!(await recepcionEditable(workspace.id, id))) return { ok: false, error: ERR_NO_EDITABLE };

  const leido = await leerConIa(workspace.id, user.id, entrada.bloques);
  if (!leido.ok) return leido;
  const r = await importarEnRecepcion(workspace.id, id, user.id, "IA", leido.doc);
  refrescar(id);
  return r;
}

/** La plantilla CSV completada (a mano o con otro asistente de IA). */
export async function importarCsvAction(formData: FormData): Promise<ResultadoImportacion> {
  const { workspace, user } = await requireSalesStaff();
  const recepcionId = texto(formData.get("recepcionId"));
  const archivo = formData.get("file");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: ERR_SIN_ARCHIVO };
  if (archivo.size > MAX_BYTES_CSV) return { ok: false, error: "El CSV pesa más de 1 MB." };
  if (!/\.csv$/i.test(archivo.name) && !/csv|text\/plain/i.test(archivo.type)) {
    return { ok: false, error: "Elegí un archivo .csv con la plantilla." };
  }

  const leido = leerCsv(await archivo.text());
  if (!leido.ok) return leido;
  const r = await importarEnRecepcion(workspace.id, recepcionId, user.id, "CSV", {
    proveedor: null,
    cuit: null,
    fecha: null,
    comprobante: null,
    precios_con_iva: null,
    total: null,
    filas: leido.filas,
  });
  refrescar(recepcionId);
  return r;
}

/** Las líneas actuales en la plantilla CSV, para bajarlas, corregirlas en una planilla y volver a subirlas. */
export async function descargarCsvAction(
  recepcionId: string,
): Promise<{ ok: true; csv: string; nombre: string } | { ok: false; error: string }> {
  const { workspace } = await requireSalesStaff();
  const r = await leerRecepcion(workspace.id, texto(recepcionId));
  if (!r) return { ok: false, error: "Esa recepción no existe." };
  return { ok: true, csv: escribirCsv(filasDesdeLineas(r.lineas)), nombre: `recepcion-${r.numero}.csv` };
}

/** Elegir el producto de una línea sin asociar; si vino de una importación, se recuerda para ese proveedor. */
export async function elegirProductoImportadoAction(
  recepcionId: string,
  lineaId: string,
  productId: string,
): Promise<Resultado> {
  const { workspace } = await requireSalesStaff();
  const r = await elegirProductoDeLineaImportada(workspace.id, texto(recepcionId), texto(lineaId), texto(productId));
  if (r.ok) refrescar(recepcionId);
  return r;
}
