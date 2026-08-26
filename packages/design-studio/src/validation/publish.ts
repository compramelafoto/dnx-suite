import { ptToMm } from "../document/units";
import type { DesignDocument } from "../document/schema";
import { isFontId } from "../fonts/catalog";
import { buildLayoutPlan, type TextMeasurer } from "../layout/plan";
import { findDeclaration, type VariableContract } from "../variables/contract";
import { placeholdersOf } from "../variables/resolve";
import { evaluateQrLegibility } from "./qr";

export type PublishValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

/** Valores de ejemplo del contrato, que es contra lo que se valida el diseño. */
function valoresDeEjemplo(contract: VariableContract): {
  values: Record<string, string>;
  omitted: string[];
} {
  const values: Record<string, string> = {};
  for (const v of contract.variables) {
    values[v.key] = v.sampleValue;
  }
  return { values, omitted: [] };
}

export function validateForPublish(
  doc: DesignDocument,
  contract: VariableContract,
  opciones: { measurer: TextMeasurer },
): PublishValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const usadas = new Set<string>();

  for (const cara of doc.sides) {
    for (const bloque of cara.blocks) {
      if (bloque.type === "text") {
        if (!isFontId(bloque.fontId)) {
          errors.push(
            `El bloque "${bloque.id}" usa la tipografía "${bloque.fontId}", que no está en el catálogo.`,
          );
        }
        for (const clave of placeholdersOf(bloque.content)) {
          usadas.add(clave);
          const decl = findDeclaration(contract, clave);
          if (!decl) {
            errors.push(
              `El bloque "${bloque.id}" usa la variable "${clave}", que el contrato no declara.`,
            );
            continue;
          }
          if (decl.maxLength !== undefined && decl.sampleValue.length > decl.maxLength) {
            errors.push(
              `El valor de ejemplo de "${decl.label}" (${decl.key}) tiene ${decl.sampleValue.length} caracteres y el máximo declarado es ${decl.maxLength}.`,
            );
          }
        }
      }

      if (bloque.type === "qrcode") {
        usadas.add(bloque.variableKey);
        const decl = findDeclaration(contract, bloque.variableKey);
        if (!decl) {
          errors.push(
            `El bloque QR "${bloque.id}" usa la variable "${bloque.variableKey}", que el contrato no declara.`,
          );
        } else if (decl.type !== "qrPayload" && decl.type !== "url") {
          errors.push(
            `El bloque QR "${bloque.id}" apunta a "${decl.key}", que es de tipo ${decl.type}. Un QR necesita una variable de tipo qrPayload o url.`,
          );
        }
      }

      if (bloque.type === "image" && bloque.variableKey) {
        usadas.add(bloque.variableKey);
        const decl = findDeclaration(contract, bloque.variableKey);
        if (!decl) {
          errors.push(
            `La imagen "${bloque.id}" usa la variable "${bloque.variableKey}", que el contrato no declara.`,
          );
        } else if (decl.type !== "image") {
          errors.push(
            `La imagen "${bloque.id}" apunta a "${decl.key}", que es de tipo ${decl.type}. Tiene que ser una variable de tipo image.`,
          );
        }
      }
    }
  }

  for (const decl of contract.variables) {
    if (decl.required && !usadas.has(decl.key)) {
      errors.push(
        `El contrato declara "${decl.label}" (${decl.key}) como obligatoria, pero ningún bloque del diseño la usa. O la usás o dejala opcional.`,
      );
    }
  }

  // Maquetar con los valores de ejemplo revela desbordes y permite medir el QR de verdad.
  const plan = buildLayoutPlan(doc, valoresDeEjemplo(contract), {
    measurer: opciones.measurer,
    includeBleed: false,
  });

  if (!plan.ok) {
    errors.push(...plan.errors);
    return { ok: false, errors, warnings };
  }

  for (const pagina of plan.value.pages) {
    for (const item of pagina.items) {
      if (item.kind === "text" && item.overflow) {
        errors.push(
          `En la cara "${pagina.name}", el texto del bloque "${item.id}" no entra en su caja con el valor de ejemplo más largo.`,
        );
      }

      if (item.kind === "qr") {
        const legibilidad = evaluateQrLegibility({
          payload: item.payload,
          errorCorrection: item.errorCorrection,
          quietZoneModules: item.quietZoneModules,
          sidePt: Math.min(item.widthPt, item.heightPt),
          medium: plan.value.medium,
          dpi: plan.value.dpi,
        });
        if (legibilidad.level === "INVALID" || legibilidad.level === "BLOCKS_PUBLISH") {
          errors.push(`Bloque QR "${item.id}": ${legibilidad.message}`);
        } else if (legibilidad.level === "WARNING") {
          warnings.push(`Bloque QR "${item.id}": ${legibilidad.message}`);
        }
      }

      // Un fondo a sangre TIENE que llegar al borde: avisar por eso sería ruido. Lo que no
      // puede quedar cortado es lo que se lee.
      const puedeCortarse = item.kind === "text" || item.kind === "qr" || item.kind === "image";
      if (pagina.safeAreaPt > 0 && puedeCortarse) {
        const margen = pagina.safeAreaPt;
        const invade =
          item.xPt < margen ||
          item.yPt < margen ||
          item.xPt + item.widthPt > pagina.widthPt - margen ||
          item.yPt + item.heightPt > pagina.heightPt - margen;
        if (invade) {
          warnings.push(
            `En la cara "${pagina.name}", el bloque "${item.id}" invade el área segura de ${ptToMm(margen).toFixed(1)} mm. Al recortar la tarjeta puede quedar cortado.`,
          );
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
