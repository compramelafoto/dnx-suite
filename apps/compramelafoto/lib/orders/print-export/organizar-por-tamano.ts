/**
 * ZIP de varios pedidos ordenado para el laboratorio: primero por tamaño y acabado, y
 * adentro una carpeta por cliente. Así el laboratorio imprime juntas todas las 10x15 brillo
 * sin abrir pedido por pedido, y el fotógrafo igual sabe de quién es cada copia.
 *
 *   15x21 Mate/3888 Juan Perez/2x IMG_1.jpg
 *   Foto grupal/3888 Juan Perez/Diseno 12.pdf          (diseños: por producto)
 *   Control/3888 Juan Perez/MANIFEST.txt               (+ resumen PDF y avisos)
 *   RESUMEN_PARA_LABORATORIO.txt                       (copias por tamaño)
 *
 * Los nombres son cortos a propósito: Windows no descomprime rutas largas (ver `rutas-cortas`).
 *
 * Con `separarClientes: false` no hay carpeta por cliente: todas las copias de un tamaño van
 * juntas y el número de pedido encabeza el nombre del archivo (`3888 2x IMG_1.jpg`).
 * Es para el fotógrafo que separa recién al embolsar y no quiere abrir una carpeta por cliente.
 *
 * Sólo cambia dónde va cada archivo; qué archivos entran lo siguen decidiendo los planes.
 */

import type { PrintExportPlan } from "./stream-print-export-zip";
import { carpetaDeImpresion } from "./rutas-cortas";

export const CARPETA_CONTROL = "Control";
export const NOMBRE_RESUMEN = "RESUMEN_PARA_LABORATORIO.txt";

const porNombre = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

/** "3888 Juan Perez" → "3888": el número sin el nombre. */
function numeroDePedido(plan: PrintExportPlan): string {
  return plan.codigo ?? (plan.folder.split(" ")[0] || plan.folder);
}

export function organizarPorTamano(
  plans: PrintExportPlan[],
  { separarClientes = true }: { separarClientes?: boolean } = {}
): {
  plans: PrintExportPlan[];
  resumen: { name: string; content: string };
} {
  // grupo → cliente → { fotos, copias }
  const conteo = new Map<string, Map<string, { fotos: number; copias: number }>>();

  const reorganizados = plans.map((plan) => {
    const prefijo = `${plan.folder}/`;
    const pedido = numeroDePedido(plan);
    // Dentro de cada grupo: la carpeta del cliente, o el número de pedido delante del archivo.
    const dentro = (resto: string) => (separarClientes ? `${plan.folder}/${resto}` : `${pedido} ${resto}`);
    const files = plan.files.map((file) => {
      const relativa = file.zipPath.startsWith(prefijo) ? file.zipPath.slice(prefijo.length) : file.zipPath;
      const partes = relativa.split("/");
      let zipPath: string;
      if (file.impresion) {
        const grupo = carpetaDeImpresion(file.impresion);
        zipPath = `${grupo}/${dentro(partes[partes.length - 1]!)}`;
        const clientes = conteo.get(grupo) ?? new Map();
        const fila = clientes.get(plan.folder) ?? { fotos: 0, copias: 0 };
        fila.fotos += 1;
        fila.copias += file.impresion.copias;
        clientes.set(plan.folder, fila);
        conteo.set(grupo, clientes);
      } else if (partes.length > 1) {
        // Diseños (PDF y caras): la primera carpeta es el producto.
        zipPath = `${partes[0]}/${dentro(partes.slice(1).join("/"))}`;
      } else {
        zipPath = `Otros/${dentro(relativa)}`;
      }
      return {
        ...file,
        zipPath,
        manifestLine: file.manifestLine.split(file.zipPath).join(zipPath),
      };
    });
    return { ...plan, folder: `${CARPETA_CONTROL}/${plan.folder}`, files };
  });

  const lineas = [
    `Resumen para el laboratorio - ${plans.length} pedido${plans.length === 1 ? "" : "s"}`,
    "",
    separarClientes
      ? "Cada carpeta es un tamaño y acabado; adentro hay una carpeta por cliente."
      : "Cada carpeta es un tamaño y acabado; cada archivo empieza con el número de pedido.",
    "Si falta algún archivo, figura como (FALTA ARCHIVO) en el MANIFEST del cliente,",
    `dentro de "${CARPETA_CONTROL}".`,
    "",
  ];
  let totalFotos = 0;
  let totalCopias = 0;
  for (const grupo of [...conteo.keys()].sort(porNombre)) {
    const clientes = conteo.get(grupo)!;
    let fotos = 0;
    let copias = 0;
    for (const fila of clientes.values()) {
      fotos += fila.fotos;
      copias += fila.copias;
    }
    totalFotos += fotos;
    totalCopias += copias;
    lineas.push(`${grupo}: ${copias} copias (${fotos} fotos)`);
    for (const cliente of [...clientes.keys()].sort(porNombre)) {
      const fila = clientes.get(cliente)!;
      lineas.push(`   ${cliente}: ${fila.copias} copias (${fila.fotos} fotos)`);
    }
    lineas.push("");
  }
  lineas.push(`TOTAL: ${totalCopias} copias (${totalFotos} fotos)`);

  return { plans: reorganizados, resumen: { name: NOMBRE_RESUMEN, content: lineas.join("\n") } };
}
