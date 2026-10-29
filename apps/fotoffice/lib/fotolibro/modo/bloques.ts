import type { TemplateV2Block } from "@repo/template-editor-core";
import { acomodar, type Caja } from "./maquetar";
import { ladosDe, type EstadoFotolibro, type FotoDelLibro, type Lado, type LadoPliego } from "./estado";
import { cantidadDeDisenos, disenoDePliego, type Zonas } from "./disenos";
import { estiloPorId } from "@/lib/fotolibro/estilos/catalogo";
import { tipoDePliego, type EstiloFotolibro } from "@/lib/fotolibro/estilos/tipos";
import { cajaDeFotos } from "@/lib/fotolibro/estilos/vista-previa";

/**
 * De la intención ("estas fotos en esta página") a los bloques del diseño, que es lo que se guarda,
 * se ve en el editor libre y se imprime.
 *
 * Sólo se regeneran los bloques que este modo creó (`configJson.fotolibroAuto`). Lo que alguien
 * agregó a mano en el diseño libre —un texto, un adorno— se conserva tal cual. El encuadre de cada
 * foto (zoom y corrimiento) también: se toma del bloque anterior de esa misma foto en esa página.
 */

export type Lienzo = { width: number; height: number; dpi?: number };

const pxDeMm = (mm: number, dpi: number) => (mm * dpi) / 25.4;

/** El pliego en milímetros, a partir del lienzo. */
export const medidasDelLienzo = (lienzo: Lienzo) => {
  const dpi = lienzo.dpi ?? 300;
  return { anchoMm: (lienzo.width * 25.4) / dpi, altoMm: (lienzo.height * 25.4) / dpi };
};

/** La clave de medida con la que se dibujan los fondos de un estilo ("610×305"). */
export const claveDeMedida = (lienzo: Lienzo) => {
  const m = medidasDelLienzo(lienzo);
  return `${Math.round(m.anchoMm)}×${Math.round(m.altoMm)}`;
};

/** La caja útil de una página del pliego, sin el margen. El pliego son dos páginas lado a lado. */
export function cajaDePagina(lienzo: Lienzo, lado: LadoPliego, margenMm: number): Caja {
  const dpi = lienzo.dpi ?? 300;
  const m = pxDeMm(margenMm, dpi);
  const anchoPagina = lienzo.width / 2;
  const x0 = lado === "izq" ? 0 : anchoPagina;
  return { x: x0 + m, y: m, w: Math.max(1, anchoPagina - 2 * m), h: Math.max(1, lienzo.height - 2 * m) };
}

export const idDeBloque = (pliego: number, lado: Lado, fotoId: string) => `fl-${pliego}-${lado}-${fotoId}`;

export function esBloqueAutomatico(b: Pick<TemplateV2Block, "configJson">): boolean {
  return b.configJson?.fotolibroAuto === true;
}

/** Los marcos de una página, en píxeles del lienzo, en el orden de sus fotos. */
export function marcosDePagina(
  estado: EstadoFotolibro,
  lienzo: Lienzo,
  pliego: number,
  lado: Lado,
  fotosPorId: Map<string, FotoDelLibro>,
): Caja[] {
  const pagina = estado.pliegos[pliego]?.[lado];
  if (!pagina || pagina.fotos.length === 0) return [];
  const aspectos = pagina.fotos.map((id) => {
    const f = fotosPorId.get(id);
    return f ? f.w / f.h : 1;
  });
  const dpi = lienzo.dpi ?? 300;
  const sep = pxDeMm(estado.separacionMm, dpi);
  const estilo = estiloPorId(estado.estilo?.id);
  // Con estilo, las fotos respetan la zona que deja libre (títulos y adornos).
  const cajaDe = (l: LadoPliego): Caja =>
    estilo
      ? (() => {
          const c = cajaDeFotos(estilo, tipoDePliego(pliego, estado.pliegos.length), l, medidasDelLienzo(lienzo), estado.margenMm);
          return { x: pxDeMm(c.x, dpi), y: pxDeMm(c.y, dpi), w: pxDeMm(c.w, dpi), h: pxDeMm(c.h, dpi) };
        })()
      : cajaDePagina(lienzo, l, estado.margenMm);
  // Una favorita aplicada: sus marcos, llevados a la medida de este libro.
  if (pagina.marcos?.length === pagina.fotos.length) {
    return pagina.marcos.map((c) => ({ x: c.x * lienzo.width, y: c.y * lienzo.height, w: c.w * lienzo.width, h: c.h * lienzo.height }));
  }
  if (lado === "todo") return disenoDePliego(aspectos, zonasDelPliego(estado, lienzo, pliego), sep, pagina.variante);
  return acomodar(aspectos, cajaDe(lado), sep, pagina.variante);
}

/** El pliego entero y la parte útil de cada página (con margen y lo que deja libre el estilo). */
function zonasDelPliego(estado: EstadoFotolibro, lienzo: Lienzo, pliego: number): Zonas {
  const dpi = lienzo.dpi ?? 300;
  const estilo = estiloPorId(estado.estilo?.id);
  const cajaDe = (l: LadoPliego): Caja => {
    if (!estilo) return cajaDePagina(lienzo, l, estado.margenMm);
    const c = cajaDeFotos(estilo, tipoDePliego(pliego, estado.pliegos.length), l, medidasDelLienzo(lienzo), estado.margenMm);
    return { x: pxDeMm(c.x, dpi), y: pxDeMm(c.y, dpi), w: pxDeMm(c.w, dpi), h: pxDeMm(c.h, dpi) };
  };
  return { lienzo: { x: 0, y: 0, w: lienzo.width, h: lienzo.height }, izq: cajaDe("izq"), der: cajaDe("der") };
}

/** Cuántas distribuciones hay para el pliego entero con sus fotos (para mostrar "7 de 64"). */
export function cantidadDeDistribuciones(estado: EstadoFotolibro, lienzo: Lienzo, pliego: number): number {
  const p = estado.pliegos[pliego];
  if (!p || p.modo !== "pliego") return 0;
  const fotos = new Map(estado.fotos.map((f) => [f.id, f]));
  const aspectos = p.todo.fotos.map((id) => {
    const f = fotos.get(id);
    return f ? f.w / f.h : 1;
  });
  return cantidadDeDisenos(aspectos, zonasDelPliego(estado, lienzo, pliego), pxDeMm(estado.separacionMm, lienzo.dpi ?? 300));
}

export function generarBloques(
  estado: EstadoFotolibro,
  lienzo: Lienzo,
  anteriores: readonly TemplateV2Block[],
): TemplateV2Block[] {
  const fotosPorId = new Map(estado.fotos.map((f) => [f.id, f]));
  const previoPorId = new Map(anteriores.map((b) => [b.id, b]));
  const cantidad = estado.pliegos.length;

  // Lo que no es de este modo queda, salvo en hojas que ya no existen.
  const resultado: TemplateV2Block[] = anteriores.filter(
    (b) => !esBloqueAutomatico(b) && (b.pageIndex ?? 0) < cantidad,
  );

  const estilo = estiloPorId(estado.estilo?.id);
  aplicarFondosDelEstilo(resultado, estado, estilo, cantidad);

  // Cada hoja necesita su fondo: el editor lo espera y la impresión pinta el papel con él.
  for (let i = 0; i < cantidad; i++) {
    if (!resultado.some((b) => (b.pageIndex ?? 0) === i && b.type === "BACKGROUND")) {
      resultado.push({
        id: `fl-fondo-${i}`,
        type: "BACKGROUND",
        pageIndex: i,
        name: "Fondo",
        layout: { x: 0, y: 0, width: lienzo.width, height: lienzo.height, rotation: 0, zIndex: 0, opacity: 1, locked: true, visible: true },
        configJson: fondoDePliego(estado, estilo, i, cantidad),
      });
    }
  }

  if (estilo) resultado.push(...textosDelEstilo(estado, estilo, lienzo));

  estado.pliegos.forEach((pliego, i) => {
    for (const lado of ladosDe(pliego)) {
      const marcos = marcosDePagina(estado, lienzo, i, lado, fotosPorId);
      pliego[lado].fotos.forEach((fotoId, k) => {
        const foto = fotosPorId.get(fotoId);
        const marco = marcos[k];
        if (!foto || !marco) return;
        const id = idDeBloque(i, lado, fotoId);
        const previo = previoPorId.get(id);
        // El borde es un rectángulo de color detrás, y la foto se achica hacia adentro: así el
        // diseño no se mueve y se imprime igual (la impresión no dibuja bordes de imagen).
        const borde = pxDeMm(estado.bordeMm, lienzo.dpi ?? 300);
        if (borde > 0) {
          resultado.push({
            id: `fl-borde-${i}-${lado}-${fotoId}`,
            type: "SHAPE",
            pageIndex: i,
            name: "Borde",
            layout: { x: marco.x, y: marco.y, width: marco.w, height: marco.h, rotation: 0, zIndex: 9, opacity: 1, locked: true, visible: true },
            configJson: { variant: "rectangle", fill: estado.bordeColor, strokeWidth: 0, fotolibroAuto: true },
          });
        }
        const dentro = borde > 0 && marco.w > 4 * borde && marco.h > 4 * borde ? { x: marco.x + borde, y: marco.y + borde, w: marco.w - 2 * borde, h: marco.h - 2 * borde } : marco;
        resultado.push({
          id,
          type: "IMAGE",
          pageIndex: i,
          name: foto.nombre || "Foto",
          layout: {
            x: dentro.x,
            y: dentro.y,
            width: dentro.w,
            height: dentro.h,
            rotation: 0,
            zIndex: 10 + k,
            opacity: 1,
            locked: false,
            visible: true,
          },
          configJson: {
            src: foto.url,
            previewSrc: foto.vista,
            fit: "cover",
            srcWidth: foto.w,
            srcHeight: foto.h,
            fotoId,
            fotolibroAuto: true,
            ...(estilo?.esquinasMm ? { borderRadius: pxDeMm(estilo.esquinasMm, lienzo.dpi ?? 300) } : {}),
            ...(previo?.configJson.crop ? { crop: previo.configJson.crop } : {}),
          },
        });
      });
    }
  });

  return resultado;
}

/**
 * Corre de hoja lo que se agregó a mano cuando se inserta o se saca un pliego, para que el texto
 * del pliego 5 siga en el pliego 5. Los bloques automáticos no hace falta tocarlos: se regeneran.
 */
export function reindexarHojas(
  bloques: readonly TemplateV2Block[],
  cambio: { tipo: "insertar" | "quitar"; indice: number },
): TemplateV2Block[] {
  const out: TemplateV2Block[] = [];
  for (const b of bloques) {
    if (esBloqueAutomatico(b)) {
      out.push(b);
      continue;
    }
    const i = b.pageIndex ?? 0;
    if (cambio.tipo === "quitar") {
      if (i === cambio.indice) continue;
      out.push(i > cambio.indice ? { ...b, pageIndex: i - 1 } : b);
    } else {
      out.push(i >= cambio.indice ? { ...b, pageIndex: i + 1 } : b);
    }
  }
  return out;
}


/** El fondo de un pliego: el del estilo para su tipo (apertura, interior, cierre) o papel blanco. */
function fondoDePliego(estado: EstadoFotolibro, estilo: EstiloFotolibro | null, i: number, cantidad: number) {
  // Un color elegido para este pliego manda sobre el papel y el fondo dibujado del estilo.
  const propio = estado.pliegos[i]?.fondo;
  if (propio) return { backgroundColor: propio, src: "", fit: "cover", fotolibroEstilo: true };
  const src = estilo ? estado.estilo?.fondos[tipoDePliego(i, cantidad)] ?? "" : "";
  return { backgroundColor: estilo?.papel ?? "#ffffff", src, fit: "cover", fotolibroEstilo: Boolean(estilo) };
}

/** Pone en cada fondo existente el del estilo (o lo vuelve a papel blanco si se lo sacó). */
function aplicarFondosDelEstilo(bloques: TemplateV2Block[], estado: EstadoFotolibro, estilo: EstiloFotolibro | null, cantidad: number) {
  bloques.forEach((b, k) => {
    if (b.type !== "BACKGROUND") return;
    const i = b.pageIndex ?? 0;
    const nuevo = fondoDePliego(estado, estilo, i, cantidad);
    // Un fondo que alguien eligió a mano en el diseño libre, sin estilo, no se toca.
    if (!estilo && !b.configJson.fotolibroEstilo && !estado.pliegos[i]?.fondo) return;
    bloques[k] = { ...b, configJson: { ...b.configJson, ...nuevo } };
  });
}

/**
 * Los títulos del estilo (nombres, fecha, frase) como bloques de texto: se ven, se editan en el
 * diseño libre y se imprimen con su tipografía. Sólo los que tienen algo escrito.
 */
function textosDelEstilo(estado: EstadoFotolibro, estilo: EstiloFotolibro, lienzo: Lienzo): TemplateV2Block[] {
  const dpi = lienzo.dpi ?? 300;
  const m = medidasDelLienzo(lienzo);
  const cantidad = estado.pliegos.length;
  const out: TemplateV2Block[] = [];
  estado.pliegos.forEach((_p, i) => {
    const tipo = tipoDePliego(i, cantidad);
    for (const t of estilo.textos?.(tipo, m) ?? []) {
      const contenido = estado.estilo?.textos[t.rol]?.trim();
      if (!contenido) continue;
      /*
       * El cuerpo del estilo está pensado para un título corto. Si lo escrito es largo, se achica
       * para que entre en el ancho de la caja (una letra mide cerca de medio cuerpo de ancho; las
       * mayúsculas con espaciado, un poco más).
       */
      const cuerpoMm = (t.puntos * 25.4) / 72;
      const anchoEstimado = contenido.length * cuerpoMm * (t.mayusculas ? 0.72 : 0.5);
      const escala = anchoEstimado > t.w ? Math.max(0.35, t.w / anchoEstimado) : 1;
      out.push({
        id: `fl-texto-${i}-${t.rol}`,
        type: "TEXT",
        pageIndex: i,
        name: t.rol,
        layout: { x: pxDeMm(t.x, dpi), y: pxDeMm(t.y, dpi), width: pxDeMm(t.w, dpi), height: pxDeMm(t.h, dpi), rotation: 0, zIndex: 40, opacity: 1, locked: false, visible: true },
        configJson: {
          content: contenido,
          fontFamily: t.fuente,
          fontSize: (t.puntos * escala * dpi) / 72,
          fontWeight: t.negrita ? 700 : 400,
          fontItalic: t.italica === true,
          color: t.color,
          textAlign: t.alineacion ?? "center",
          ...(t.mayusculas ? { textTransform: "uppercase", letterSpacing: 2 } : {}),
          lineHeight: 1.15,
          fotolibroAuto: true,
        },
      });
    }
  });
  return out;
}

/**
 * Reordena las hojas del diseño cuando se mueven pliegos: `orden[nuevo] = viejo`. Mueve todo, lo
 * agregado a mano y los bloques automáticos (a los que también les cambia el id, que lleva el
 * número de pliego), así el encuadre de cada foto viaja con su pliego.
 */
export function permutarHojas(bloques: readonly TemplateV2Block[], orden: number[]): TemplateV2Block[] {
  const nuevoDe = new Map(orden.map((viejo, nuevo) => [viejo, nuevo]));
  return bloques.map((b) => {
    const viejo = b.pageIndex ?? 0;
    const nuevo = nuevoDe.get(viejo);
    if (nuevo === undefined || nuevo === viejo) return b;
    const id = esBloqueAutomatico(b) ? b.id.replace(/^fl-(\d+)-/, `fl-${nuevo}-`) : b.id;
    return { ...b, id, pageIndex: nuevo };
  });
}

/** Los marcos de las fotos de un pliego en proporción (0 a 1), para guardarlos como favorita. */
export function marcosEnProporcion(bloques: readonly TemplateV2Block[], pliego: number, lienzo: Lienzo): Caja[] {
  const porId = new Map(bloques.map((b) => [b.id, b]));
  return bloques
    .filter((b) => b.type === "IMAGE" && esBloqueAutomatico(b) && (b.pageIndex ?? 0) === pliego)
    .sort((a, b) => a.layout.zIndex - b.layout.zIndex)
    .map((b) => {
      // Con borde, la foto está achicada: el marco es el del rectángulo de atrás.
      const l = (porId.get(b.id.replace(/^fl-/, "fl-borde-")) ?? b).layout;
      return { x: l.x / lienzo.width, y: l.y / lienzo.height, w: l.width / lienzo.width, h: l.height / lienzo.height };
    });
}
