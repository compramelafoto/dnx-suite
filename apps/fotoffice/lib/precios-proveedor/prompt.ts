import { ENCABEZADO_CSV } from "./csv";

/**
 * El prompt que el usuario copia y pega en ChatGPT junto con el PDF del proveedor. Es copia
 * fija del diseño (§6.2): si cambia el formato del CSV, cambia acá y en `csv.ts` a la vez.
 */
export function promptParaChatGpt(nombreProveedor: string): string {
  const encabezado = ENCABEZADO_CSV.join(",");
  return [
    "Vas a convertir la lista de precios adjunta (PDF o imagen) de un proveedor de impresión fotográfica en un CSV. Devolvé sólo el CSV dentro de un bloque de código, sin comentarios antes ni después.",
    "",
    "Encabezado exacto, en este orden:",
    encabezado,
    "",
    "Reglas:",
    "1. Un renglón por cada precio que aparezca. Si una tabla tiene medidas en columnas y terminaciones en filas, cada cruce es un renglón.",
    "2. precio: número entero en pesos, sin $, sin puntos ni espacios ($10 .200 → 10200). Si dice \"consultar\", \"a cotizar\" o está vacío, no lo incluyas.",
    "3. medida: en centímetros, ANCHOxALTO, sin espacios, el número chico primero (20x30). Si una celda tiene varias medidas (30x40/45, 15x20/21/22), repetí el renglón por cada una. Si el precio es por metro cuadrado, medida vacía y unidad = m2.",
    "4. Fotolibros: la tapa define el modelo. Cada precio de tapa es tipo = TAPA, con el nombre del modelo en modelo y la medida a libro abierto. El precio por hoja es tipo = HOJA (sin modelo, salvo que la hoja dependa del modelo). Las cajas son tipo = CAJA. Recargos opcionales (\"+ $500 lomo brillante\", \"adicional laminado de tapa\") son tipo = ADICIONAL. Un combo que ya incluye hojas y tapa es PRODUCTO, y en notas va qué incluye (por ejemplo \"4 hojas + tapa\").",
    "5. Precios por cantidad (\"x10\", \"+25\", \"100\", \"hasta 20 / hasta 50\"): un renglón por tramo, con la cantidad desde la que vale en cantidad_minima (para \"hasta 50\" después de \"hasta 20\", poné 21).",
    "6. variante: la terminación o material que cambia el precio (Brillo, Mate, Canvas, Lona front, Lija/Tela/3D, Simple faz, Doble faz…). Si dos terminaciones tienen el mismo precio en una sola celda (\"Brillo o Mate\"), un solo renglón con variante vacía.",
    "7. categoria: el título de la sección del PDF donde está el precio.",
    "8. vigencia: AAAA-MM según el mes que figura en la lista.",
    "9. Si un campo tiene coma, ponelo entre comillas dobles.",
    "10. No inventes datos. Si algo es ambiguo, incluilo igual y explicalo en notas.",
    "",
    `Proveedor: ${nombreProveedor}`,
  ].join("\n");
}
