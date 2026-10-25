import { cotizarFotolibro, MAXIMO_HOJAS, type CatalogoFotolibro } from "@/lib/fotolibro/cotizar";

/**
 * Fotolibro de una propuesta modelo. Módulo PURO.
 *
 * En la propuesta no se guarda un precio: se guarda lo elegido en la calculadora (proveedor,
 * modelo, medida, hojas y si lleva caja). Al enviarla se cotiza con la última lista aplicada de
 * ese proveedor, con el margen y el redondeo de fotolibros del mostrador (`lib/fotolibro/cotizar.ts`):
 * si el laboratorio sube los precios, la propuesta sube sola. La caja va en su propio renglón.
 */
export type FotolibroDeModelo = { proveedorId: string; modelo: string; medida: string; hojas: number; conCaja: boolean };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

/** Lo que llega del navegador o de la base: sólo los cinco campos, con forma válida; si no, null. */
export function validarFotolibroDeModelo(raw: unknown): FotolibroDeModelo | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.proveedorId !== "string" || !ID.test(r.proveedorId)) return null;
  const modelo = texto(r.modelo, 200);
  const medida = texto(r.medida, 20);
  if (!modelo || !medida) return null;
  if (!Number.isInteger(r.hojas) || (r.hojas as number) < 1 || (r.hojas as number) > MAXIMO_HOJAS) return null;
  if (typeof r.conCaja !== "boolean") return null;
  return { proveedorId: r.proveedorId, modelo, medida, hojas: r.hojas as number, conCaja: r.conCaja };
}

export type RenglonDeFotolibro = { precio: number; descripcion: string };

/** El precio de hoy (pesos) del libro y, si lleva, de la caja. Sin lista o sin ese modelo: ok false. */
export function cotizarFotolibroDeModelo(
  catalogo: CatalogoFotolibro | null,
  f: FotolibroDeModelo,
): { ok: true; libro: RenglonDeFotolibro; caja: RenglonDeFotolibro | null } | { ok: false } {
  if (!catalogo) return { ok: false };
  const r = cotizarFotolibro(catalogo, f);
  if (!r.ok) return { ok: false };
  return {
    ok: true,
    libro: { precio: r.precioMinor / 100, descripcion: r.descripcion },
    caja: r.caja ? { precio: r.caja.precioMinor / 100, descripcion: r.caja.descripcion } : null,
  };
}
