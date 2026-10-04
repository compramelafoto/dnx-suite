import { fail, ok, type Result } from "../result";
import { mmToPt, pxToPt } from "../document/units";
import type { DesignDocument, DesignMedium, TextAlign } from "../document/schema";
import type { ResolvedVariables } from "../variables/contract";
import { interpolate } from "../variables/resolve";
import { isFontId, slotFor, type FontId, type FontSlot } from "../fonts/catalog";
import { wrapText } from "./wrap";

/** Puerto de medida. La implementación real usa la fuente ya incrustada en el PDF. */
export type TextMeasurer = {
  widthOf(texto: string, fontId: FontId, slot: FontSlot, sizePt: number): number;
};

type ItemBase = {
  id: string;
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
  rotation: number;
  opacity: number;
};

export type LayoutTextItem = ItemBase & {
  kind: "text";
  fontId: FontId;
  slot: FontSlot;
  sizePt: number;
  lineHeightPt: number;
  color: string;
  align: TextAlign;
  lines: string[];
  /** El texto no entra en `maxLines` o excede el alto de la caja. */
  overflow: boolean;
};

export type LayoutQrItem = ItemBase & {
  kind: "qr";
  payload: string;
  errorCorrection: "L" | "M" | "Q" | "H";
  quietZoneModules: number;
  darkColor: string;
  lightColor: string;
};

export type LayoutImageItem = ItemBase & {
  kind: "image";
  /** Referencia que el producto resuelve a bytes. */
  ref: string;
  fit: "cover" | "contain";
  /** Con qué forma se recorta. Rectangular es no recortar. */
  mask: "rect" | "circle" | "ellipse";
  /** Solo con `mask: "rect"`. */
  cornerRadiusPt?: number;
};

export type LayoutLineItem = ItemBase & {
  kind: "line";
  strokeColor: string;
  strokeWidthPt: number;
};

export type LayoutRectItem = ItemBase & {
  kind: "rect";
  fillColor?: string;
  strokeColor?: string;
  strokeWidthPt?: number;
  cornerRadiusPt?: number;
};

export type LayoutItem =
  | LayoutTextItem
  | LayoutQrItem
  | LayoutImageItem
  | LayoutLineItem
  | LayoutRectItem;

export type LayoutPage = {
  sideId: string;
  name: string;
  widthPt: number;
  heightPt: number;
  /** Ya incluido en el tamaño de página si se pidió sangrado; 0 si no. */
  bleedPt: number;
  safeAreaPt: number;
  background: string;
  items: LayoutItem[];
};

export type LayoutPlan = {
  medium: DesignMedium;
  /** Puntos por pulgada declarados para PRINT; 96 para SCREEN. */
  dpi: number;
  pages: LayoutPage[];
};

export type LayoutOptions = {
  measurer: TextMeasurer;
  /** PRINT: agrandar la página con el sangrado y correr el contenido. */
  includeBleed: boolean;
};

/** Proporción de interlineado. 1,2 es el valor tipográfico habitual para texto corto. */
const LINE_HEIGHT_RATIO = 1.2;

/** Cómo se escriben las letras al dibujar. Es presentación, no un cambio del dato. */
function aplicarTransformacion(
  texto: string,
  modo: "none" | "uppercase" | "lowercase" | "capitalize" | undefined,
): string {
  if (modo === "uppercase") return texto.toLocaleUpperCase("es-AR");
  if (modo === "lowercase") return texto.toLocaleLowerCase("es-AR");
  if (modo === "capitalize") {
    // Cada palabra con su inicial: "maría fernanda" → "María Fernanda". El resto en minúscula,
    // porque si no un nombre escrito TODO EN MAYÚSCULAS en el padrón quedaría igual.
    return texto
      .toLocaleLowerCase("es-AR")
      .replace(/(^|\s|['’\-])(\p{L})/gu, (_t, antes: string, letra: string) =>
        antes + letra.toLocaleUpperCase("es-AR"),
      );
  }
  return texto;
}

/**
 * Hasta qué fracción del cuerpo declarado se puede achicar un texto que no entra. Por debajo
 * de esto deja de leerse, y es preferible que el desborde se vea y alguien agrande la caja.
 */
const ACHIQUE_MINIMO = 0.4;
/** De a cuánto se baja el cuerpo al buscar el que entra. Un cuarto de punto no se nota. */
const PASO_ACHIQUE_PT = 0.25;

/**
 * Corta el texto y, si no entra en su caja, lo achica hasta que entre.
 *
 * Existe por los nombres largos: "Iván Xavier Martínez Dufour" no cabía en el renglón del
 * carnet, saltaba a un segundo renglón y se encimaba con el DNI. Con un dato variable, quien
 * diseña no puede dejar la caja a la medida de cada socio; el texto se tiene que adaptar.
 *
 * Solo se achica lo que **desborda**: más renglones de los que caben en el alto (o en
 * `maxLines`), o un renglón más ancho que la caja. Un texto que hoy entra se dibuja con el
 * cuerpo que eligió quien diseñó, aunque la caja quede justa.
 */
function ajustarTexto(entrada: {
  texto: string;
  anchoPt: number;
  altoPt: number;
  maxLines: number | undefined;
  cuerpoPt: number;
  medir: (t: string, cuerpoPt: number) => number;
}): { sizePt: number; lineHeightPt: number; lines: string[]; overflow: boolean } {
  const medirCon = (cuerpo: number) => {
    const lineHeightPt = cuerpo * LINE_HEIGHT_RATIO;
    const lines = wrapText(
      entrada.texto,
      entrada.anchoPt,
      (t) => entrada.medir(t, cuerpo),
      entrada.maxLines,
    );
    // Al menos un renglón siempre "cabe": una caja apenas más baja que el interlineado es
    // una caja de un renglón, no un error.
    const caben = Math.min(
      entrada.maxLines ?? Number.POSITIVE_INFINITY,
      Math.max(1, Math.floor((entrada.altoPt + 0.01) / lineHeightPt)),
    );
    const desborda =
      lines.length > caben || lines.some((l) => entrada.medir(l, cuerpo) > entrada.anchoPt + 0.01);
    return { sizePt: cuerpo, lineHeightPt, lines, desborda };
  };

  const declarado = medirCon(entrada.cuerpoPt);
  let elegido = declarado;
  if (declarado.desborda) {
    const minimo = entrada.cuerpoPt * ACHIQUE_MINIMO;
    for (
      let cuerpo = entrada.cuerpoPt - PASO_ACHIQUE_PT;
      cuerpo >= minimo;
      cuerpo -= PASO_ACHIQUE_PT
    ) {
      const prueba = medirCon(cuerpo);
      if (!prueba.desborda) {
        elegido = prueba;
        break;
      }
    }
  }

  // Si ni achicado entra, se dibuja con el cuerpo declarado y se informa: un texto ilegible
  // de tan chico esconde el problema en vez de mostrarlo.
  if (elegido.desborda) elegido = declarado;
  const excedeLineas = entrada.maxLines !== undefined && elegido.lines.length > entrada.maxLines;
  const excedeAlto = elegido.lines.length * elegido.lineHeightPt > entrada.altoPt + 0.01;
  return {
    sizePt: elegido.sizePt,
    lineHeightPt: elegido.lineHeightPt,
    lines: elegido.lines,
    overflow: elegido.desborda || excedeLineas || excedeAlto,
  };
}

export function buildLayoutPlan(
  doc: DesignDocument,
  resolved: ResolvedVariables,
  options: LayoutOptions,
): Result<LayoutPlan> {
  const errores: string[] = [];
  const esImpresion = doc.format.medium === "PRINT";
  const aPuntos = esImpresion ? mmToPt : pxToPt;

  const sangradoPt =
    esImpresion && options.includeBleed && doc.format.bleedMm ? mmToPt(doc.format.bleedMm) : 0;
  const areaSeguraPt = esImpresion && doc.format.safeAreaMm ? mmToPt(doc.format.safeAreaMm) : 0;

  const pages: LayoutPage[] = [];

  for (const cara of doc.sides) {
    const items: LayoutItem[] = [];

    for (const bloque of cara.blocks) {
      if (bloque.hidden) continue;

      const base: ItemBase = {
        id: bloque.id,
        xPt: aPuntos(bloque.x) + sangradoPt,
        yPt: aPuntos(bloque.y) + sangradoPt,
        widthPt: aPuntos(bloque.width),
        heightPt: aPuntos(bloque.height),
        rotation: bloque.rotation ?? 0,
        opacity: bloque.opacity ?? 1,
      };

      if (bloque.type === "text") {
        if (!isFontId(bloque.fontId)) {
          errores.push(
            `El bloque "${bloque.id}" usa la tipografía "${bloque.fontId}", que no está en el catálogo.`,
          );
          continue;
        }
        let texto: string;
        try {
          /*
           * La conversión de mayúsculas se aplica **después** de reemplazar las variables, no
           * sobre el marcador. Un nombre que llega en minúsculas desde el padrón se imprime en
           * mayúsculas sin que nadie toque el dato guardado, y `{{fullName}}` no se convierte en
           * `{{FULLNAME}}`, que no resolvería nada.
           */
          texto = aplicarTransformacion(
            interpolate(bloque.content, resolved.values),
            bloque.textTransform,
          );
        } catch (e) {
          errores.push(e instanceof Error ? e.message : String(e));
          continue;
        }
        const fontId = bloque.fontId;
        const slot = slotFor(bloque.fontWeight, bloque.fontStyle);
        // El cuerpo tipográfico se declara SIEMPRE en puntos, en los dos medios: nadie
        // diseña texto en milímetros, y así el mismo valor significa lo mismo en una
        // tarjeta impresa y en una placa de pantalla.
        const ajuste = ajustarTexto({
          texto,
          anchoPt: base.widthPt,
          altoPt: base.heightPt,
          maxLines: bloque.maxLines,
          cuerpoPt: bloque.fontSize,
          medir: (t, cuerpo) => options.measurer.widthOf(t, fontId, slot, cuerpo),
        });
        const { sizePt, lineHeightPt, lines } = ajuste;
        items.push({
          ...base,
          kind: "text",
          fontId,
          slot,
          sizePt,
          lineHeightPt,
          color: bloque.color,
          align: bloque.align ?? "left",
          lines,
          overflow: ajuste.overflow,
        });
        continue;
      }

      if (bloque.type === "qrcode") {
        const payload = resolved.values[bloque.variableKey];
        if (payload === undefined) {
          errores.push(
            `El bloque QR "${bloque.id}" usa la variable "${bloque.variableKey}", que el contrato no declara.`,
          );
          continue;
        }
        if (payload.trim() === "") {
          errores.push(
            `El bloque QR "${bloque.id}" quedaría vacío: la variable "${bloque.variableKey}" no trae contenido.`,
          );
          continue;
        }
        items.push({
          ...base,
          kind: "qr",
          payload,
          errorCorrection: bloque.errorCorrection,
          quietZoneModules: bloque.quietZoneModules,
          darkColor: bloque.darkColor ?? "#000000",
          lightColor: bloque.lightColor ?? "#ffffff",
        });
        continue;
      }

      if (bloque.type === "image") {
        let ref: string | undefined;
        if (bloque.resourceRef) {
          ref = bloque.resourceRef;
        } else if (bloque.variableKey) {
          const valor = resolved.values[bloque.variableKey];
          if (valor === undefined) {
            errores.push(
              `La imagen "${bloque.id}" usa la variable "${bloque.variableKey}", que el contrato no declara.`,
            );
            continue;
          }
          ref = valor;
        }
        if (!ref || ref.trim() === "") {
          errores.push(`La imagen "${bloque.id}" no tiene de dónde salir.`);
          continue;
        }
        items.push({
          ...base,
          kind: "image",
          ref,
          fit: bloque.fit,
          mask: bloque.mask ?? "rect",
          ...(bloque.cornerRadius ? { cornerRadiusPt: aPuntos(bloque.cornerRadius) } : {}),
        });
        continue;
      }

      if (bloque.type === "line") {
        items.push({
          ...base,
          kind: "line",
          strokeColor: bloque.strokeColor,
          strokeWidthPt: aPuntos(bloque.strokeWidth),
        });
        continue;
      }

      items.push({
        ...base,
        kind: "rect",
        ...(bloque.fillColor ? { fillColor: bloque.fillColor } : {}),
        ...(bloque.strokeColor ? { strokeColor: bloque.strokeColor } : {}),
        ...(bloque.strokeWidth !== undefined ? { strokeWidthPt: aPuntos(bloque.strokeWidth) } : {}),
        ...(bloque.cornerRadius !== undefined
          ? { cornerRadiusPt: aPuntos(bloque.cornerRadius) }
          : {}),
      });
    }

    pages.push({
      sideId: cara.id,
      name: cara.name,
      widthPt: aPuntos(doc.format.width) + sangradoPt * 2,
      heightPt: aPuntos(doc.format.height) + sangradoPt * 2,
      bleedPt: sangradoPt,
      safeAreaPt: areaSeguraPt,
      background: cara.background,
      items,
    });
  }

  if (errores.length > 0) return fail(...errores);
  return ok({ medium: doc.format.medium, dpi: doc.format.dpi ?? 96, pages });
}
