export type PublicGalleryFolderFilter =
  | { kind: "all" }
  | { kind: "uncategorized" }
  | { kind: "folder"; id: number };

/**
 * Resuelve filtro desde query (?folderId= / ?folder=). Valores inválidos → todas las fotos.
 */
export function resolvePublicGalleryFolderFilter(opts: {
  folderIdRaw?: string | null;
  folderSlugRaw?: string | null;
  activeFolders: Array<{ id: number; slug: string | null }>;
}): PublicGalleryFolderFilter {
  const { folderIdRaw, folderSlugRaw, activeFolders } = opts;
  const idSet = new Set(activeFolders.map((f) => f.id));

  if (folderIdRaw != null && String(folderIdRaw).trim() !== "") {
    const raw = String(folderIdRaw).trim();
    const lower = raw.toLowerCase();
    if (lower === "none" || lower === "sin-carpeta") {
      return { kind: "uncategorized" };
    }
    const num = parseInt(raw, 10);
    if (Number.isFinite(num) && String(num) === raw && idSet.has(num)) {
      return { kind: "folder", id: num };
    }
    // folderId inválido: seguir con ?folder= sin forzar “todas” todavía
  }

  if (folderSlugRaw != null && String(folderSlugRaw).trim() !== "") {
    const slug = String(folderSlugRaw).trim();
    const match = activeFolders.find((f) => f.slug != null && f.slug !== "" && f.slug === slug);
    if (match) return { kind: "folder", id: match.id };
    return { kind: "all" };
  }

  return { kind: "all" };
}

/** Conserva params salvo los que controlan carpeta (para enlaces del chip bar). */
export function buildPreservedGalleryQueryString(
  raw: Record<string, string | string[] | undefined>,
): string {
  const p = new URLSearchParams();
  for (const [key, val] of Object.entries(raw)) {
    if (key === "folderId" || key === "folder") continue;
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item !== undefined && item !== "") p.append(key, item);
      }
    } else if (val !== "") {
      p.append(key, val);
    }
  }
  return p.toString();
}
