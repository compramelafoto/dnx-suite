import { normalizarMedida } from "@/lib/precios-proveedor/clave";
import {
  cotizarFotolibro,
  fotosPorHoja,
  hojasSugeridas,
  medidasDe,
  modelosDe,
  tieneCaja,
  type CatalogoFotolibro,
  type OfertaFotolibro,
  type TipoTapa,
} from "./cotizar";

/**
 * La calculadora de fotolibros del Cobrador, para el bot de WhatsApp. Módulo PURO, en centavos.
 *
 * El bot cotiza con el laboratorio del producto del catálogo («Fotolibro tapa rígida» o «tapa
 * flexible»), igual que el mostrador. Lo que falta lo va armando de a pasos: sin modelo muestra
 * los rangos de precio por medida; sin medida, las medidas con sus hojas y precio para esas fotos;
 * con todo, el precio del libro y el de la caja.
 */

export type PedidoFotolibro = {
  tapa: TipoTapa;
  modelo?: string | null;
  medida?: string | null;
  fotos?: number | null;
  hojas?: number | null;
  caja?: boolean;
};

/** Cuántas fotos se suponen cuando el cliente todavía no dijo. */
export const FOTOS_POR_OMISION = 100;

export type FilaRango = { medida: string; hojas: number; desdeMinor: number; hastaMinor: number; desdeModelo: string };

export type RespuestaFotolibro =
  | { tipo: "RANGO"; fotos: number; modelos: string[]; filas: FilaRango[] }
  | { tipo: "AMBIGUO"; opciones: string[] }
  | { tipo: "NO_ESTA"; modelos: string[] }
  | { tipo: "MEDIDAS"; modelo: string; fotos: number; filas: { medida: string; hojas: number; precioMinor: number }[] }
  | {
      tipo: "PRECIO";
      proveedorId: string;
      modelo: string;
      medida: string;
      hojas: number;
      fotos: number | null;
      precioMinor: number;
      costoMinor: number | null;
      /** null = ese modelo no tiene caja en esa medida. */
      caja: { precioMinor: number; costoMinor: number | null } | null;
      conCaja: boolean;
    }
  | { tipo: "ERROR"; mensaje: string };

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** El laboratorio del producto; si no tiene lista de fotolibros, el primero que la tenga. */
export function ofertaParaBot(c: CatalogoFotolibro, proveedorId: string | null): OfertaFotolibro | null {
  return c.ofertas.find((o) => o.proveedorId === proveedorId) ?? c.ofertas[0] ?? null;
}

/** El modelo por nombre: exacto, o el único que contiene todas las palabras. */
export function elegirModelo(modelos: readonly string[], texto: string): { ok: true; modelo: string } | { ok: false; opciones: string[] } {
  const n = normal(texto);
  const exacto = modelos.find((m) => normal(m) === n);
  if (exacto) return { ok: true, modelo: exacto };
  const palabras = n.split(" ").filter(Boolean);
  const candidatos = modelos.filter((m) => palabras.every((p) => normal(m).includes(p)));
  return candidatos.length === 1 ? { ok: true, modelo: candidatos[0] } : { ok: false, opciones: candidatos };
}

export function cotizarParaBot(c: CatalogoFotolibro, o: OfertaFotolibro, p: PedidoFotolibro): RespuestaFotolibro {
  const modelos = modelosDe(o, p.tapa);
  if (modelos.length === 0) return { tipo: "ERROR", mensaje: `${o.proveedor} no tiene tapas ${p.tapa === "FLEXIBLE" ? "flexibles" : "rígidas"} en la lista.` };
  const fotos = p.fotos && p.fotos > 0 ? Math.round(p.fotos) : null;

  let modelo: string;
  if (p.modelo?.trim()) {
    const e = elegirModelo(modelos, p.modelo);
    if (!e.ok) return e.opciones.length > 0 ? { tipo: "AMBIGUO", opciones: e.opciones } : { tipo: "NO_ESTA", modelos };
    modelo = e.modelo;
  } else if (modelos.length === 1) {
    modelo = modelos[0];
  } else {
    return { tipo: "RANGO", fotos: fotos ?? FOTOS_POR_OMISION, modelos, filas: rangos(c, o, modelos, fotos ?? FOTOS_POR_OMISION) };
  }

  const medidas = medidasDe(o, modelo);
  const medida = p.medida ? normalizarMedida(p.medida) : null;
  if (!medida || !medidas.includes(medida)) {
    const f = fotos ?? FOTOS_POR_OMISION;
    const filas = medidas.flatMap((m) => {
      const hojas = hojasSugeridas(f, fotosPorHoja(m, c.fotosPorHoja));
      const r = cotizarFotolibro(c, { proveedorId: o.proveedorId, modelo, medida: m, hojas, conCaja: false });
      return r.ok ? [{ medida: m, hojas, precioMinor: r.precioMinor }] : [];
    });
    if (filas.length === 0) return { tipo: "ERROR", mensaje: `${modelo} no tiene medidas con precio en la lista.` };
    return { tipo: "MEDIDAS", modelo, fotos: f, filas };
  }

  const hojas = p.hojas && p.hojas > 0 ? Math.round(p.hojas) : hojasSugeridas(fotos ?? FOTOS_POR_OMISION, fotosPorHoja(medida, c.fotosPorHoja));
  const conCaja = p.caja === true && tieneCaja(o, modelo, medida);
  const r = cotizarFotolibro(c, { proveedorId: o.proveedorId, modelo, medida, hojas, conCaja: tieneCaja(o, modelo, medida) });
  if (!r.ok) return { tipo: "ERROR", mensaje: r.error };
  return {
    tipo: "PRECIO",
    proveedorId: o.proveedorId,
    modelo,
    medida,
    hojas,
    fotos,
    precioMinor: r.precioMinor,
    costoMinor: r.costoMinor,
    caja: r.caja ? { precioMinor: r.caja.precioMinor, costoMinor: r.caja.costoMinor } : null,
    conCaja,
  };
}

/** Por medida: el más barato y el más caro de los modelos, para esas fotos. */
function rangos(c: CatalogoFotolibro, o: OfertaFotolibro, modelos: readonly string[], fotos: number): FilaRango[] {
  const porMedida = new Map<string, FilaRango>();
  for (const modelo of modelos) {
    for (const medida of medidasDe(o, modelo)) {
      const hojas = hojasSugeridas(fotos, fotosPorHoja(medida, c.fotosPorHoja));
      const r = cotizarFotolibro(c, { proveedorId: o.proveedorId, modelo, medida, hojas, conCaja: false });
      if (!r.ok) continue;
      const f = porMedida.get(medida);
      if (!f) porMedida.set(medida, { medida, hojas, desdeMinor: r.precioMinor, hastaMinor: r.precioMinor, desdeModelo: modelo });
      else {
        if (r.precioMinor < f.desdeMinor) Object.assign(f, { desdeMinor: r.precioMinor, desdeModelo: modelo });
        f.hastaMinor = Math.max(f.hastaMinor, r.precioMinor);
      }
    }
  }
  return [...porMedida.values()];
}
