/**
 * Productos de impresión que solo se usan en su flujo dedicado (Fotos Carnet, Polaroids).
 * No deben mostrarse en el listado general de productos al imprimir fotos o al elegir desde un álbum.
 */
export function isCarnetOrPolaroidProduct(name: string): boolean {
  const n = (name || "").trim().toLowerCase();
  return n.includes("carnet") || n === "polaroid" || n === "polaroids";
}

/**
 * Nombre de carpeta para export de pedidos: carnet → "Carnet", polaroids → "Polaroids".
 */
export function getExportFolderName(productName: string): string {
  const n = (productName || "").trim().toLowerCase();
  if (n.includes("carnet")) return "Carnet";
  if (n === "polaroid" || n === "polaroids") return "Polaroids";
  return productName || "Foto Impresa";
}
