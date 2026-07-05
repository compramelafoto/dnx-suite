/**
 * Extrae segmentos de carpeta desde `webkitRelativePath` (subida de carpeta completa).
 * Ej.: "Boda/Recepción/foto.jpg" → ["Boda", "Recepción"], fileName "foto.jpg"
 */
export function parseUploadRelativePath(relativePath: string | undefined | null): {
  folderSegments: string[];
  fileName: string;
} {
  const raw = String(relativePath ?? "")
    .trim()
    .replace(/\\/g, "/");
  if (!raw) {
    return { folderSegments: [], fileName: "" };
  }
  const parts = raw.split("/").filter((p) => p.length > 0);
  if (parts.length <= 1) {
    return { folderSegments: [], fileName: parts[0] ?? "" };
  }
  const fileName = parts[parts.length - 1]!;
  const folderSegments = parts.slice(0, -1);
  return { folderSegments, fileName };
}

/** Lee webkitRelativePath de un File del navegador. */
export function fileWebkitRelativePath(file: File): string {
  const withPath = file as File & { webkitRelativePath?: string };
  return String(withPath.webkitRelativePath ?? "").trim();
}
