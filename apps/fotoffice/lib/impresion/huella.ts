import "server-only";
import { createHash } from "node:crypto";

/** JSON con las claves ordenadas: el mismo contenido da siempre la misma huella. */
function canonico(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(",")}}`;
}

export function huellaDe(valor: unknown): string {
  return createHash("sha256").update(canonico(valor)).digest("hex");
}
