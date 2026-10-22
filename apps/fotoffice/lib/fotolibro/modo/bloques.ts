import type { TemplateV2Block } from "@repo/template-editor-core";
import { acomodar, type Caja } from "./maquetar";
import type { EstadoFotolibro, FotoDelLibro, LadoPliego } from "./estado";

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

/** La caja útil de una página del pliego, sin el margen. El pliego son dos páginas lado a lado. */
export function cajaDePagina(lienzo: Lienzo, lado: LadoPliego, margenMm: number): Caja {
  const dpi = lienzo.dpi ?? 300;
  const m = pxDeMm(margenMm, dpi);
  const anchoPagina = lienzo.width / 2;
  const x0 = lado === "izq" ? 0 : anchoPagina;
  return { x: x0 + m, y: m, w: Math.max(1, anchoPagina - 2 * m), h: Math.max(1, lienzo.height - 2 * m) };
}

export const idDeBloque = (pliego: number, lado: LadoPliego, fotoId: string) => `fl-${pliego}-${lado}-${fotoId}`;

export function esBloqueAutomatico(b: Pick<TemplateV2Block, "configJson">): boolean {
  return b.configJson?.fotolibroAuto === true;
}

/** Los marcos de una página, en píxeles del lienzo, en el orden de sus fotos. */
export function marcosDePagina(
  estado: EstadoFotolibro,
  lienzo: Lienzo,
  pliego: number,
  lado: LadoPliego,
  fotosPorId: Map<string, FotoDelLibro>,
): Caja[] {
  const pagina = estado.pliegos[pliego]?.[lado];
  if (!pagina || pagina.fotos.length === 0) return [];
  const aspectos = pagina.fotos.map((id) => {
    const f = fotosPorId.get(id);
    return f ? f.w / f.h : 1;
  });
  const sep = pxDeMm(estado.separacionMm, lienzo.dpi ?? 300);
  return acomodar(aspectos, cajaDePagina(lienzo, lado, estado.margenMm), sep, pagina.variante);
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

  // Cada hoja necesita su fondo: el editor lo espera y la impresión pinta el papel con él.
  for (let i = 0; i < cantidad; i++) {
    if (!resultado.some((b) => (b.pageIndex ?? 0) === i && b.type === "BACKGROUND")) {
      resultado.push({
        id: `fl-fondo-${i}`,
        type: "BACKGROUND",
        pageIndex: i,
        name: "Fondo",
        layout: { x: 0, y: 0, width: lienzo.width, height: lienzo.height, rotation: 0, zIndex: 0, opacity: 1, locked: true, visible: true },
        configJson: { backgroundColor: "#ffffff", src: "", fit: "cover" },
      });
    }
  }

  estado.pliegos.forEach((pliego, i) => {
    for (const lado of ["izq", "der"] as const) {
      const marcos = marcosDePagina(estado, lienzo, i, lado, fotosPorId);
      pliego[lado].fotos.forEach((fotoId, k) => {
        const foto = fotosPorId.get(fotoId);
        const marco = marcos[k];
        if (!foto || !marco) return;
        const id = idDeBloque(i, lado, fotoId);
        const previo = previoPorId.get(id);
        resultado.push({
          id,
          type: "IMAGE",
          pageIndex: i,
          name: foto.nombre || "Foto",
          layout: {
            x: marco.x,
            y: marco.y,
            width: marco.w,
            height: marco.h,
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
