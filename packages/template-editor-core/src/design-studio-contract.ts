import type { VariableContract, VariableDeclaration } from "@repo/design-studio";
import {
  resolveTemplateVariablePlugin,
  type TemplateProductId,
} from "./resolve-template-product";

/**
 * El contrato que design-studio necesita para emitir, derivado del registro del producto.
 *
 * Es la misma fuente que alimenta el catálogo del editor. Escribir el contrato a mano sería
 * volver a tener dos listas que se van separando sin que nadie lo note — que es exactamente lo
 * que hacía que el editor ofreciera la foto del socio y la emisión la rechazara.
 */

/** Una fecha que design-studio pueda formatear tiene que llegar como AAAA-MM-DD. */
const ISO = /^\d{4}-\d{2}-\d{2}/;

function tipoDeValor(
  v: string,
  ejemplo: unknown,
): VariableDeclaration["type"] {
  if (v === "image") return "image";
  if (v === "qrUrl") return "qrPayload";
  if (v === "number") return "number";
  if (v === "date") {
    /*
     * Hay variables declaradas como fecha que la aplicación entrega **ya formateadas** —
     * `event.dateFormatted` vale "17/04/2026", y el nombre lo dice. Para design-studio eso es
     * texto: pedirle que formatee algo que ya viene formateado no falla en silencio, falla la
     * emisión entera.
     *
     * El criterio es la forma real del dato, no su nombre: si el ejemplo no es una fecha ISO,
     * la aplicación no entrega fechas por ese camino.
     */
    return typeof ejemplo === "string" && ISO.test(ejemplo) ? "date" : "text";
  }
  return "text";
}

export function buildContractForProduct(
  product: TemplateProductId | "unknown",
): VariableContract {
  const defs = resolveTemplateVariablePlugin(product).listVariableDefinitions();
  return {
    variables: defs.map((d) => {
      const tipo = tipoDeValor(String(d.valueType), d.example);
      const decl: VariableDeclaration = {
        key: d.path,
        type: tipo,
        label: d.label,
        /*
         * En la vista previa nada es obligatorio. Al emitir sí: un carnet sin foto no
         * identifica y la emisión tiene que frenarse. Pero un diseño a medio armar debe poder
         * verse — si no, la vista previa solo sirve cuando ya no hace falta.
         */
        required: false,
        sampleValue: String(d.example ?? d.defaultFallback ?? d.label),
      };
      if (tipo === "date") decl.dateFormat = "es-AR-short";
      if (tipo === "number") decl.decimals = 0;
      return decl;
    }),
  };
}
