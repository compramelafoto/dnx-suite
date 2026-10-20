import "server-only";
import { prisma } from "@repo/db";
import { isUniqueViolation } from "@/lib/commission/rules";
import {
  SALIDAS_INICIALES,
  TAMANOS_INICIALES,
  escalaDesdeRegla,
  type Nitidez,
} from "./medidas";

export type TamanoVista = {
  id: string;
  nombre: string;
  anchoMm: number;
  altoMm: number;
};
export type SalidaVista = {
  id: string;
  nombre: string;
  tipo: "LOCAL" | "LABORATORIO";
  ppp: number;
  nitidez: Nitidez;
  escalaXMil: number;
  escalaYMil: number;
  admiteCopias: boolean;
  tamanos: TamanoVista[];
};
export type ProduccionVista = {
  tipoPieza: "COPIA" | "CARNET" | "POLAROID";
  salidaId: string;
  tamanoHojaId: string;
  unidad: "HOJA" | "COPIA" | "PIEZA";
};
type R = { ok: true } | { ok: false; error: string };

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const TIPOS = new Set(["COPIA", "CARNET", "POLAROID"]);
const UNIDADES = new Set(["HOJA", "COPIA", "PIEZA"]);

/** La primera vez que se usa Impresión en un negocio: las dos impresoras de DNX y los tamaños reales. */
export async function asegurarConfiguracion(
  workspaceId: string,
): Promise<void> {
  const hay = await prisma.fotofficeTamanoImpresion.count({
    where: { workspaceId },
  });
  if (hay > 0) return;
  try {
    await prisma.$transaction(async (tx) => {
      if (
        (await tx.fotofficeTamanoImpresion.count({ where: { workspaceId } })) >
        0
      )
        return;
      const ids = new Map<string, string>();
      for (const t of TAMANOS_INICIALES) {
        const c = await tx.fotofficeTamanoImpresion.create({
          data: {
            workspaceId,
            nombre: t.nombre,
            anchoMm: t.anchoMm,
            altoMm: t.altoMm,
            orden: t.orden,
          },
          select: { id: true },
        });
        ids.set(t.nombre, c.id);
      }
      for (const s of SALIDAS_INICIALES) {
        const c = await tx.fotofficeSalidaImpresion.create({
          data: {
            workspaceId,
            nombre: s.nombre,
            tipo: "LOCAL",
            ppp: s.ppp,
            nitidez: s.nitidez,
            admiteCopias: s.admiteCopias,
          },
          select: { id: true },
        });
        for (const n of s.tamanos)
          await tx.fotofficeSalidaTamano.create({
            data: { salidaId: c.id, tamanoId: ids.get(n)! },
          });
      }
    });
  } catch (e) {
    // Otro pedido simultáneo ya sembró (índice único): no es un error.
    if (!isUniqueViolation(e)) throw e;
  }
}

export async function listarSalidas(
  workspaceId: string,
): Promise<SalidaVista[]> {
  const [salidas, tamanos] = await Promise.all([
    prisma.fotofficeSalidaImpresion.findMany({
      where: { workspaceId, activo: true },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        ppp: true,
        nitidez: true,
        escalaXMil: true,
        escalaYMil: true,
        admiteCopias: true,
      },
    }),
    prisma.fotofficeTamanoImpresion.findMany({
      where: { workspaceId, activo: true },
      orderBy: { orden: "asc" },
      select: { id: true, nombre: true, anchoMm: true, altoMm: true },
    }),
  ]);
  const puentes = await prisma.fotofficeSalidaTamano.findMany({
    where: { salidaId: { in: salidas.map((s) => s.id) } },
    select: { salidaId: true, tamanoId: true },
  });
  const vistas: TamanoVista[] = tamanos.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    anchoMm: Number(t.anchoMm),
    altoMm: Number(t.altoMm),
  }));
  return salidas.map((s) => ({
    ...s,
    tipo: s.tipo as SalidaVista["tipo"],
    nitidez: s.nitidez as Nitidez,
    tamanos: vistas.filter((t) =>
      puentes.some((p) => p.salidaId === s.id && p.tamanoId === t.id),
    ),
  }));
}

export async function guardarEscala(
  workspaceId: string,
  salidaId: string,
  medidaXmm: number,
  medidaYmm: number,
): Promise<R> {
  if (!ID.test(salidaId))
    return { ok: false, error: "Esa impresora no existe." };
  const x = escalaDesdeRegla(medidaXmm);
  const y = escalaDesdeRegla(medidaYmm);
  if (x === null || y === null)
    return {
      ok: false,
      error: "La regla tiene que medir entre 90 y 110 mm. Volvé a medirla.",
    };
  const r = await prisma.fotofficeSalidaImpresion.updateMany({
    where: { id: salidaId, workspaceId },
    data: { escalaXMil: x, escalaYMil: y },
  });
  return r.count === 1
    ? { ok: true }
    : { ok: false, error: "Esa impresora no existe." };
}

export async function leerProduccion(
  workspaceId: string,
  productId: string,
): Promise<ProduccionVista | null> {
  const p = await prisma.fotofficeProductoProduccion.findFirst({
    where: { workspaceId, productId },
    select: {
      tipoPieza: true,
      salidaId: true,
      tamanoHojaId: true,
      unidad: true,
    },
  });
  return p ? (p as ProduccionVista) : null;
}

export async function guardarProduccion(
  workspaceId: string,
  productId: string,
  datos: ProduccionVista | null,
): Promise<R> {
  if (!ID.test(productId))
    return { ok: false, error: "Ese producto no existe." };
  const producto = await prisma.product.findFirst({
    where: { id: productId, workspaceId },
    select: { id: true },
  });
  if (!producto) return { ok: false, error: "Ese producto no existe." };
  if (datos === null) {
    await prisma.fotofficeProductoProduccion.deleteMany({
      where: { workspaceId, productId },
    });
    return { ok: true };
  }
  if (
    !TIPOS.has(datos.tipoPieza) ||
    !UNIDADES.has(datos.unidad) ||
    !ID.test(datos.salidaId) ||
    !ID.test(datos.tamanoHojaId)
  ) {
    return { ok: false, error: "Faltan datos de producción." };
  }
  const salida = await prisma.fotofficeSalidaImpresion.findFirst({
    where: { id: datos.salidaId, workspaceId, activo: true },
    select: { id: true, admiteCopias: true, nombre: true },
  });
  if (!salida) return { ok: false, error: "Esa impresora no existe." };
  if (datos.tipoPieza === "COPIA" && !salida.admiteCopias)
    return {
      ok: false,
      error: `${salida.nombre} no hace copias fotográficas.`,
    };
  const admite = await prisma.fotofficeSalidaTamano.count({
    where: { salidaId: salida.id, tamanoId: datos.tamanoHojaId },
  });
  if (admite === 0)
    return { ok: false, error: `${salida.nombre} no imprime en esa hoja.` };
  const existente = await prisma.fotofficeProductoProduccion.findFirst({
    where: { workspaceId, productId },
    select: { id: true },
  });
  if (existente)
    await prisma.fotofficeProductoProduccion.update({
      where: { id: existente.id },
      data: { ...datos },
    });
  else
    await prisma.fotofficeProductoProduccion.create({
      data: { workspaceId, productId, ...datos },
    });
  return { ok: true };
}

export async function produccionDeProductos(
  workspaceId: string,
): Promise<Record<string, { tipoPieza: ProduccionVista["tipoPieza"] }>> {
  const filas = await prisma.fotofficeProductoProduccion.findMany({
    where: { workspaceId },
    select: { productId: true, tipoPieza: true },
  });
  return Object.fromEntries(
    filas.map((f) => [
      f.productId,
      { tipoPieza: f.tipoPieza as ProduccionVista["tipoPieza"] },
    ]),
  );
}
