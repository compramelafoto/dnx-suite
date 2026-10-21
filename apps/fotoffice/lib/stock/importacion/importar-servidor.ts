import "server-only";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@repo/db";
import { adjuntosR2Configurado, bucketR2Privado, clienteR2Privado } from "@/lib/ficha/adjuntos-r2";
import { minorToDecimalString } from "@/lib/membership/money";
import { normalizeBarcode } from "@/lib/sales/barcode";
import type { LineaBorrador } from "../recepcion";
import { diaParaInput, fechaDesdeInput } from "../recepcion-pantalla";
import { enBorrador, productoParaLinea } from "../recepcion-servidor";
import { guardarAlias, indiceParaAsociar } from "./alias-servidor";
import { asociarFilas, normalizarTexto } from "./asociar";
import { cuadre, validarDocumento, type DocumentoImportado, type FilaImportada } from "./esquema";

/**
 * Vuelca lo leído de una factura (con IA o con la plantilla CSV) en el borrador de una
 * recepción (stock etapa 3). Todo pasa por `enBorrador`: la recepción bloqueada, de este
 * negocio y en BORRADOR; una confirmada o descartada se rechaza antes de escribir nada.
 *
 * Reglas del volcado (plan, "Volcado"): una línea `IMPORTACION` por fila con descripción;
 * cantidad = max(1, redondeo); en bultos si trae más de 1 unidad por paquete, con el costo
 * por paquete tal como vino. El proveedor detectado nunca se crea solo.
 */

export type ResultadoImportacion =
  | {
      ok: true;
      agregadas: number;
      /** Filas sin descripción: no se cargan. */
      descartadas: number;
      /** Filas con cantidad 0 o negativa: se cargaron con 1, para que la persona lo revise. */
      corregidas: number;
      sinAsociar: number;
      cuadra: boolean;
      /** Nombre del proveedor de la factura cuando no coincide con ninguno cargado. */
      proveedorDetectado: string | null;
    }
  | { ok: false; error: string };

const ERR_INVALIDO = "La lectura salió incompleta. Probá de nuevo o usá la plantilla CSV.";
const ERR_SIN_FILAS = "No encontramos artículos para cargar.";

function textoONulo(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
}

/** Costo en pesos ⇒ minor (centavos). Negativo o inválido ⇒ sin costo. */
function costoMinor(pesos: number | null): number | null {
  if (pesos === null || !Number.isFinite(pesos) || pesos < 0) return null;
  return Math.round(pesos * 100);
}

/**
 * La fecha de la recepción se completa con la del documento sólo si sigue la que se puso al
 * abrir el borrador (el mismo día en que se creó): la columna nunca está vacía, así que
 * "vacía" quiere decir "nadie la cambió".
 */
function fechaSinTocar(fecha: Date, createdAt: Date): boolean {
  return diaParaInput(fecha) === diaParaInput(createdAt);
}

type LectorProveedores = {
  fotofficeProveedor: {
    findMany(a: { where: { workspaceId: string; active: true }; select: { id: true; name: true } }): Promise<{ id: string; name: string }[]>;
  };
};

/**
 * Proveedor de la recepción: si ya tiene, ése. Si no, el activo de este negocio cuyo nombre
 * normalizado coincide con el del documento; si ninguno coincide, se devuelve como detectado
 * (nunca se crea solo).
 */
async function resolverProveedor(
  db: LectorProveedores,
  workspaceId: string,
  actual: string | null,
  nombreDoc: string | null,
): Promise<{ proveedorId: string | null; proveedorDetectado: string | null }> {
  if (actual || !nombreDoc) return { proveedorId: actual, proveedorDetectado: null };
  const buscado = normalizarTexto(nombreDoc);
  const activos = await db.fotofficeProveedor.findMany({
    where: { workspaceId, active: true },
    select: { id: true, name: true },
  });
  const hallado = buscado ? activos.find((p) => normalizarTexto(p.name) === buscado) : undefined;
  return hallado ? { proveedorId: hallado.id, proveedorDetectado: null } : { proveedorId: null, proveedorDetectado: nombreDoc };
}

/** ¿Hay al menos una fila con descripción? Sin eso no se carga nada (ni se guarda el archivo). */
export function tieneFilasUtiles(doc: DocumentoImportado): boolean {
  return doc.filas.some((f) => typeof f.descripcion === "string" && f.descripcion.trim() !== "");
}

export async function importarEnRecepcion(
  workspaceId: string,
  recepcionId: string,
  userId: number,
  origen: "IA" | "CSV",
  documento: DocumentoImportado,
  archivoKey?: string,
): Promise<ResultadoImportacion> {
  // `userId` y `origen` quedan para el registro: hoy la línea sólo guarda `IMPORTACION`.
  void userId;
  void origen;
  const v = validarDocumento(documento);
  if (!v.ok) return { ok: false, error: ERR_INVALIDO };
  const doc = v.doc;

  const utiles = doc.filas.filter((f) => f.descripcion.trim() !== "");
  const descartadas = doc.filas.length - utiles.length;
  if (utiles.length === 0) return { ok: false, error: ERR_SIN_FILAS };

  // El catálogo y los alias se leen ANTES de abrir la transacción, para no tener la recepción
  // bloqueada (FOR UPDATE) mientras se recorre todo el catálogo. Mismo alcance: negocio y
  // proveedor que va a quedar en la recepción.
  const nombreDoc = textoONulo(doc.proveedor);
  const previa = await prisma.fotofficeRecepcion.findFirst({
    where: { id: recepcionId, workspaceId },
    select: { proveedorId: true },
  });
  const supuesto = await resolverProveedor(prisma, workspaceId, previa?.proveedorId ?? null, nombreDoc);
  let indice = await indiceParaAsociar(workspaceId, supuesto.proveedorId);

  return enBorrador<ResultadoImportacion>(workspaceId, recepcionId, async (tx) => {
    const r = await tx.fotofficeRecepcion.findFirst({
      where: { id: recepcionId, workspaceId },
      select: { proveedorId: true, comprobante: true, fecha: true, createdAt: true },
    });
    if (!r) return { ok: false as const, error: "Esa recepción no existe." };

    // Si otra pestaña cambió el proveedor entre la lectura previa y el bloqueo, se resuelve de
    // nuevo con lo que quedó y se rearma el índice (caso raro).
    let resuelto = supuesto;
    if (r.proveedorId !== (previa?.proveedorId ?? null)) {
      resuelto = await resolverProveedor(tx, workspaceId, r.proveedorId, nombreDoc);
      indice = await indiceParaAsociar(workspaceId, resuelto.proveedorId);
    }
    const { proveedorId, proveedorDetectado } = resuelto;

    const asociadas = asociarFilas(utiles, indice);

    // Un producto con talles no puede ir en una recepción (etapa 2): la línea queda sin asociar.
    const ids = [...new Set(asociadas.map((a) => a.productId).filter((x): x is string => x !== null))];
    const conTalles = new Set(
      ids.length === 0
        ? []
        : (
            await tx.productVariant.findMany({
              where: { workspaceId, productId: { in: ids } },
              select: { productId: true },
            })
          ).map((t) => t.productId),
    );

    const ultima = await tx.fotofficeRecepcionLinea.findFirst({
      where: { recepcionId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const desde = (ultima?.order ?? -1) + 1;

    let corregidas = 0;
    let sinAsociar = 0;
    const data = asociadas.map((a, i) => {
      const f = a.fila;
      const cantidad = Math.max(1, Math.round(f.cantidad));
      if (f.cantidad < 1) corregidas += 1;
      const upp = f.unidades_por_paquete;
      const enBultos = upp !== null && upp > 1;
      const productId = a.productId && !conTalles.has(a.productId) ? a.productId : null;
      if (!productId) sinAsociar += 1;
      const costo = costoMinor(f.costo_unitario);
      const barras = textoONulo(f.codigo_barras);
      return {
        recepcionId,
        workspaceId,
        productId,
        descripcionOriginal: f.descripcion.trim(),
        codigoBarras: barras ? (normalizeBarcode(barras) ?? barras) : null,
        cantidad,
        enUnidadDeCompra: enBultos,
        unidadesPorCompra: enBultos ? upp : null,
        costoUnitarioArs: costo === null ? null : minorToDecimalString(costo),
        origen: "IMPORTACION",
        order: desde + i,
      };
    });
    await tx.fotofficeRecepcionLinea.createMany({ data });

    // Encabezado: lo que estaba vacío se completa; el IVA, si el documento lo dice.
    const encabezado: { proveedorId?: string; comprobante?: string; fecha?: Date; preciosConIva?: boolean; archivoKey?: string } = {};
    if (proveedorId && proveedorId !== r.proveedorId) encabezado.proveedorId = proveedorId;
    const comprobante = textoONulo(doc.comprobante);
    if (!textoONulo(r.comprobante) && comprobante) encabezado.comprobante = comprobante;
    const fecha = doc.fecha ? fechaDesdeInput(doc.fecha) : null;
    if (fecha && fechaSinTocar(r.fecha, r.createdAt)) encabezado.fecha = fecha;
    if (doc.precios_con_iva !== null) encabezado.preciosConIva = doc.precios_con_iva;
    if (archivoKey) encabezado.archivoKey = archivoKey;
    if (Object.keys(encabezado).length > 0) {
      await tx.fotofficeRecepcion.update({ where: { id: recepcionId }, data: encabezado });
    }

    return {
      ok: true as const,
      agregadas: data.length,
      descartadas,
      corregidas,
      sinAsociar,
      cuadra: cuadre(doc).cuadra,
      proveedorDetectado,
    };
  });
}

/**
 * Elegir a mano el producto de una línea. Si la línea vino de una importación y la recepción
 * tiene proveedor, se recuerda: la próxima factura de ese proveedor con esa descripción se
 * asocia sola (alias).
 */
export async function elegirProductoDeLineaImportada(
  workspaceId: string,
  recepcionId: string,
  lineaId: string,
  productId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return enBorrador(workspaceId, recepcionId, async (tx) => {
    const linea = await tx.fotofficeRecepcionLinea.findFirst({
      where: { id: lineaId, recepcionId, workspaceId },
      select: { id: true, descripcionOriginal: true, origen: true },
    });
    if (!linea) return { ok: false as const, error: "Esa línea no existe." };
    const p = await productoParaLinea(tx, workspaceId, productId);
    if (!p.ok) return p;

    await tx.fotofficeRecepcionLinea.update({ where: { id: linea.id }, data: { productId } });

    if (linea.origen === "IMPORTACION") {
      const r = await tx.fotofficeRecepcion.findFirst({
        where: { id: recepcionId, workspaceId },
        select: { proveedorId: true },
      });
      if (r?.proveedorId) {
        await guardarAlias(tx, { workspaceId, proveedorId: r.proveedorId, descripcion: linea.descripcionOriginal, productId });
      }
    }
    return { ok: true as const };
  });
}

/** Las líneas de una recepción como filas de la plantilla CSV (para descargarlas y corregirlas). */
export function filasDesdeLineas(
  lineas: readonly (Pick<
    LineaBorrador,
    "codigoBarras" | "descripcionOriginal" | "cantidad" | "enUnidadDeCompra" | "unidadesPorCompra" | "costoUnitarioMinor"
  > & { producto: { kind: string; unidadCompra: string | null } | null })[],
): FilaImportada[] {
  return lineas.map((l) => ({
    codigo_barras: l.codigoBarras,
    codigo_proveedor: null,
    descripcion: l.descripcionOriginal,
    cantidad: l.cantidad,
    unidad: l.enUnidadDeCompra ? (l.producto?.unidadCompra ?? null) : null,
    unidades_por_paquete: l.enUnidadDeCompra ? l.unidadesPorCompra : null,
    costo_unitario: l.costoUnitarioMinor === null ? null : l.costoUnitarioMinor / 100,
    alicuota_iva: null,
    subtotal: null,
    tipo: l.producto && (l.producto.kind === "INSUMO" || l.producto.kind === "PRODUCTO") ? l.producto.kind : null,
  }));
}

/** Para no gastar una lectura con IA en una recepción que ya no se puede tocar. */
export async function recepcionEditable(workspaceId: string, recepcionId: string): Promise<boolean> {
  const r = await prisma.fotofficeRecepcion.findFirst({
    where: { id: recepcionId, workspaceId },
    select: { estado: true },
  });
  return r?.estado === "BORRADOR";
}

// ---------------------------------------------------------------------------------------------
// Archivo original

/** `recepciones/<negocio>/<recepción>/<hora>-<nombre saneado>`: sin tildes, espacios ni barras. */
export function claveDeArchivo(workspaceId: string, recepcionId: string, nombre: string, ahora: number): string {
  const plano = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const ext = /\.[A-Za-z0-9]{1,8}$/.exec(plano)?.[0] ?? "";
  const base = plano
    .slice(0, plano.length - ext.length)
    .replace(/[^A-Za-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `recepciones/${workspaceId}/${recepcionId}/${ahora}-${base || "archivo"}${base ? ext : ""}`;
}

/**
 * Guarda el archivo original en el bucket PRIVADO de FOTOFFICE (una factura no es pública).
 * Si R2 no está configurado o la subida falla, devuelve null y la importación sigue igual.
 */
export async function subirArchivoDeRecepcion(
  workspaceId: string,
  recepcionId: string,
  archivo: { nombre: string; tipo: string; bytes: Buffer },
  ahora: number = Date.now(),
): Promise<string | null> {
  if (!adjuntosR2Configurado()) {
    console.error("[stock/importacion] R2 privado sin configurar: no se guarda el archivo original");
    return null;
  }
  const clave = claveDeArchivo(workspaceId, recepcionId, archivo.nombre, ahora);
  try {
    await clienteR2Privado().send(
      new PutObjectCommand({
        Bucket: bucketR2Privado(),
        Key: clave,
        Body: archivo.bytes,
        ContentType: archivo.tipo || "application/octet-stream",
      }),
    );
    return clave;
  } catch (e) {
    console.error("[stock/importacion] no se pudo subir el archivo original a R2", e);
    return null;
  }
}

/** Borra el original subido si la importación no se hizo. Un fallo sólo se registra. */
export async function borrarArchivoDeRecepcion(clave: string): Promise<void> {
  try {
    await clienteR2Privado().send(new DeleteObjectCommand({ Bucket: bucketR2Privado(), Key: clave }));
  } catch (e) {
    console.error("[stock/importacion] no se pudo borrar de R2 el archivo de una importación fallida", clave, e);
  }
}

/**
 * Importa lo leído de un archivo guardando el original: sólo se sube si hay algo para cargar,
 * y si la importación igual falla (recepción confirmada en el medio, por ejemplo), se borra.
 * Así no quedan archivos sueltos en R2.
 */
export async function importarConArchivo(
  workspaceId: string,
  recepcionId: string,
  userId: number,
  doc: DocumentoImportado,
  original: { nombre: string; tipo: string; bytes: Buffer },
): Promise<ResultadoImportacion> {
  if (!tieneFilasUtiles(doc)) return importarEnRecepcion(workspaceId, recepcionId, userId, "IA", doc);
  const clave = await subirArchivoDeRecepcion(workspaceId, recepcionId, original);
  const r = await importarEnRecepcion(workspaceId, recepcionId, userId, "IA", doc, clave ?? undefined);
  if (!r.ok && clave) await borrarArchivoDeRecepcion(clave);
  return r;
}
