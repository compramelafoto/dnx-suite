import { normalizarTexto } from "@/lib/precios-proveedor/clave";
import { precioDe, type PrecioProbador } from "./catalogo";
import type { Composicion } from "./composicion";

/**
 * Los marcos reales del probador (etapa 4). Un **modelo** es un producto del catálogo en un color,
 * con una foto de frente enderezada (PNG con la ventana transparente) que cargó el estudio. Una sola
 * foto sirve para todas las medidas del modelo: el marco se dibuja estirado por partes, con el
 * ancho del perfil medido en esa foto. Módulo PURO.
 */

export type Medida = { corto: number; largo: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type ModeloMarco = {
  id: string;
  productId: string;
  color: string;
  imagenUrl: string;
  imagenAncho: number;
  imagenAlto: number;
  /** La ventana (el hueco) dentro de la imagen, en px. */
  ventana: Rect;
  /** Medida exterior de la pieza fotografiada, en cm (en la orientación de la foto). */
  exteriorAnchoCm: number;
  exteriorAltoCm: number;
};

export type ProductoMarco = {
  id: string;
  name: string;
  priceArs: number;
  costArs: number | null;
  variantes: { id: string; name: string; priceArs: number | null }[];
};

const MEDIDA = /(\d{1,3}(?:[.,]\d)?)\s*x\s*(\d{1,3}(?:[.,]\d)?)/g;

/** Si el producto es un marco que se puede cargar como modelo. */
export function esProductoMarco(nombre: string): boolean {
  const n = normalizarTexto(nombre);
  return /^marco\b/.test(n) || /^cuadro portarretratos? de madera\b/.test(n) || /^cuadro portarretratos? cuadrado\b/.test(n);
}

/**
 * Las medidas de un marco según su nombre y el de la variante. Con dos medidas ("13x18 / 28x35",
 * "20x30 o 30x40") la chica es la foto y la grande el exterior; con una sola, es la foto.
 */
export function medidasDeMarco(producto: string, variante: string): { foto: Medida; exterior: Medida | null } | null {
  // La variante manda ("Negro · 20x30cm", "Dorado · 20x30 o 30x40cm"); si no trae medida, el producto.
  const deVariante = leerMedidas(variante);
  const lista = deVariante.length ? deVariante : leerMedidas(producto);
  if (lista.length === 0) return null;
  return lista.length >= 2 ? { foto: lista[0], exterior: lista[lista.length - 1] } : { foto: lista[0], exterior: null };
}

/** Las medidas distintas de un texto, de la más chica a la más grande. */
function leerMedidas(texto: string): Medida[] {
  const vistas = new Map<string, Medida>();
  for (const m of normalizarTexto(texto).matchAll(MEDIDA)) {
    const a = Number(m[1].replace(",", ".")), b = Number(m[2].replace(",", "."));
    if (!(a > 0 && b > 0)) continue;
    const med = { corto: Math.min(a, b), largo: Math.max(a, b) };
    vistas.set(`${med.corto}x${med.largo}`, med);
  }
  return [...vistas.values()].sort((x, y) => x.corto * x.largo - y.corto * y.largo);
}

/** "Negro · 20x30cm" → "Negro"; "Marrón claro" → "Marrón claro". */
export function colorDeVariante(nombre: string): string {
  const parte = nombre.split("·")[0].trim();
  return /\d+\s*x\s*\d+/.test(parte) ? "Único" : parte || "Único";
}

/** El ancho del perfil de cada lado, en cm, medido en la foto del modelo. */
export function bordesCm(m: ModeloMarco) {
  const sx = m.exteriorAnchoCm / m.imagenAncho, sy = m.exteriorAltoCm / m.imagenAlto;
  return {
    izq: m.ventana.x * sx,
    der: (m.imagenAncho - m.ventana.x - m.ventana.w) * sx,
    arr: m.ventana.y * sy,
    aba: (m.imagenAlto - m.ventana.y - m.ventana.h) * sy,
  };
}

/** Si el modelo se fotografió parado (más alto que ancho). */
export const modeloVertical = (m: ModeloMarco) => m.exteriorAltoCm >= m.exteriorAnchoCm;

/**
 * Exterior, ventana y foto de un cuadro con marco, en cm desde su esquina. Si el cuadro va en la
 * otra orientación que la foto del modelo, los bordes giran con él. Sin exterior conocido, el
 * exterior es la foto más el perfil; con exterior, lo que sobra entre ventana y foto es paspartú.
 */
export function medidaConMarco(m: ModeloMarco, foto: Medida, exterior: Medida | null, vertical: boolean) {
  const b0 = bordesCm(m);
  // Girar 90°: arriba ← izquierda, derecha ← arriba, abajo ← derecha, izquierda ← abajo.
  const b = vertical === modeloVertical(m) ? b0 : { arr: b0.izq, der: b0.arr, aba: b0.der, izq: b0.aba };
  const fw = vertical ? foto.corto : foto.largo, fh = vertical ? foto.largo : foto.corto;
  let ew: number, eh: number;
  if (exterior) {
    ew = vertical ? exterior.corto : exterior.largo;
    eh = vertical ? exterior.largo : exterior.corto;
  } else {
    ew = fw + b.izq + b.der;
    eh = fh + b.arr + b.aba;
  }
  const ventana = { x: b.izq, y: b.arr, w: Math.max(fw, ew - b.izq - b.der), h: Math.max(fh, eh - b.arr - b.aba) };
  // Si la ventana real quedó más chica que la foto (medida rara), el exterior se agranda.
  ew = Math.max(ew, ventana.w + b.izq + b.der);
  eh = Math.max(eh, ventana.h + b.arr + b.aba);
  return {
    exterior: { w: ew, h: eh },
    ventana,
    foto: { x: ventana.x + (ventana.w - fw) / 2, y: ventana.y + (ventana.h - fh) / 2, w: fw, h: fh },
    giro: vertical === modeloVertical(m) ? 0 : 90,
  };
}

export type MedidaMarco = {
  varianteId: string | null;
  foto: Medida;
  exterior: Medida;
  /** Marco + ampliación de la foto; null si falta alguno de los dos precios. */
  precioArs: number | null;
  motivo: string | null;
};

/** Lo que ve el cliente de un modelo. */
export type MarcoPublico = {
  modeloId: string;
  nombre: string;
  color: string;
  imagen: { url: string; ancho: number; alto: number; ventana: Rect };
  exteriorCm: { w: number; h: number };
  medidas: MedidaMarco[];
};

/** Además, para el servidor: el producto marco y la ampliación de cada medida (costos y laboratorio). */
export type MarcoServidor = MarcoPublico & {
  productoId: string;
  extra: { precioMarco: number; costoMarco: number | null; impresion: PrecioProbador | null }[];
};

const clave = (m: Medida) => `${m.corto}x${m.largo}`;

/**
 * Las opciones de marco: un modelo por producto y color, con las medidas de las variantes de ese
 * color. Si dos variantes dan la misma medida, queda una.
 */
export function armarMarcos(productos: readonly ProductoMarco[], modelos: readonly ModeloMarco[], catalogo: readonly PrecioProbador[]): MarcoServidor[] {
  const salida: MarcoServidor[] = [];
  for (const modelo of modelos) {
    const p = productos.find((x) => x.id === modelo.productId);
    if (!p) continue;
    const variantes = p.variantes.length ? p.variantes : [{ id: "", name: "", priceArs: null }];
    const delColor = variantes.filter((v) => !p.variantes.length || colorDeVariante(v.name) === modelo.color);
    const medidas: MedidaMarco[] = [];
    const extra: MarcoServidor["extra"] = [];
    const vistas = new Set<string>();
    for (const v of delColor) {
      const med = medidasDeMarco(p.name, v.name);
      if (!med || vistas.has(clave(med.foto))) continue;
      vistas.add(clave(med.foto));
      const exterior = medidaConMarco(modelo, med.foto, med.exterior, true).exterior;
      const precioMarco = v.priceArs != null && v.priceArs > 0 ? v.priceArs : p.priceArs;
      const impresion = precioDe(catalogo, "IMPRESION", med.foto.corto, med.foto.largo);
      const motivo = !(precioMarco > 0)
        ? "El marco todavía no tiene precio"
        : !impresion
          ? `Falta la ampliación ${med.foto.corto}x${med.foto.largo} en Ventas`
          : null;
      medidas.push({
        varianteId: v.id || null,
        foto: med.foto,
        exterior: { corto: Math.min(exterior.w, exterior.h), largo: Math.max(exterior.w, exterior.h) },
        precioArs: motivo ? null : precioMarco + impresion!.precioArs,
        motivo,
      });
      extra.push({ precioMarco, costoMarco: p.costArs, impresion });
    }
    if (!medidas.length) continue;
    salida.push({
      modeloId: modelo.id,
      productoId: p.id,
      nombre: p.name,
      color: modelo.color,
      imagen: { url: modelo.imagenUrl, ancho: modelo.imagenAncho, alto: modelo.imagenAlto, ventana: modelo.ventana },
      exteriorCm: { w: modelo.exteriorAnchoCm, h: modelo.exteriorAltoCm },
      medidas,
      extra,
    });
  }
  return salida;
}

export function marcosPublicos(m: readonly MarcoServidor[]): MarcoPublico[] {
  return m.map((x) => ({ modeloId: x.modeloId, nombre: x.nombre, color: x.color, imagen: x.imagen, exteriorCm: x.exteriorCm, medidas: x.medidas }));
}

/** El modelo como lo necesita el dibujo, a partir de lo que ve el cliente. */
export function modeloDePublico(m: MarcoPublico): ModeloMarco {
  return {
    id: m.modeloId, productId: "", color: m.color, imagenUrl: m.imagen.url,
    imagenAncho: m.imagen.ancho, imagenAlto: m.imagen.alto, ventana: m.imagen.ventana,
    exteriorAnchoCm: m.exteriorCm.w, exteriorAltoCm: m.exteriorCm.h,
  };
}

/**
 * Pone un marco real en un cuadro: lo lleva a la medida exterior de esa medida del modelo, en la
 * orientación pedida, conservando el centro.
 */
export function aplicarMarco(c: Composicion, id: string, marco: MarcoPublico, medida: MedidaMarco, vertical: boolean): Composicion {
  const geo = medidaConMarco(modeloDePublico(marco), medida.foto, medida.exterior, vertical);
  return {
    ...c,
    cuadros: c.cuadros.map((q) => {
      if (q.id !== id) return q;
      const w = geo.exterior.w, h = geo.exterior.h;
      return {
        ...q,
        tipo: "MARCO" as const,
        paspartu: 0,
        x: q.x + (q.w - w) / 2,
        y: q.y + (q.h - h) / 2,
        w,
        h,
        marco: { modeloId: marco.modeloId, medidaFoto: medida.foto, ventana: geo.ventana, foto: geo.foto, giro: geo.giro as 0 | 90 },
      };
    }),
  };
}

/** La medida del modelo cuyo exterior más se parece a `w × h` (en escala logarítmica, como `medidaMasCercana`). */
export function medidaMarcoMasCercana(marco: MarcoPublico, w: number, h: number): MedidaMarco | null {
  let mejor: { m: MedidaMarco; d: number } | null = null;
  const corto = Math.min(w, h), largo = Math.max(w, h);
  for (const m of marco.medidas) {
    const d = Math.abs(Math.log(m.exterior.corto / corto)) + Math.abs(Math.log(m.exterior.largo / largo));
    if (!mejor || d < mejor.d) mejor = { m, d };
  }
  return mejor?.m ?? null;
}

/** La medida del modelo de un cuadro con marco, si existe. */
export function medidaDelMarco(marcos: readonly MarcoPublico[], q: { marco?: { modeloId: string; medidaFoto: Medida } }): { marco: MarcoPublico; medida: MedidaMarco } | null {
  if (!q.marco) return null;
  const marco = marcos.find((m) => m.modeloId === q.marco!.modeloId);
  const medida = marco?.medidas.find((m) => m.foto.corto === q.marco!.medidaFoto.corto && m.foto.largo === q.marco!.medidaFoto.largo);
  return marco && medida ? { marco, medida } : null;
}
