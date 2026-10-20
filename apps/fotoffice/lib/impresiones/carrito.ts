import { PAPELES, type Papel } from "./constantes";
import type { LineaCarrito } from "./precios";
import { recorteValido } from "./recorte";

const MAX_LINEAS = 500;
const MAX_CANTIDAD = 99;

export function validarCarrito(
  raw: unknown,
  archivosPermitidos: ReadonlySet<string>,
  papelesActivos: readonly Papel[],
): { ok: true; lineas: LineaCarrito[]; papel: Papel } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Pedido inválido." };
  const { papel, lineas } = raw as { papel?: unknown; lineas?: unknown };
  if (typeof papel !== "string" || !(PAPELES as readonly string[]).includes(papel) || !papelesActivos.includes(papel as Papel)) {
    return { ok: false, error: "Elegí un papel disponible." };
  }
  if (!Array.isArray(lineas) || lineas.length === 0) return { ok: false, error: "Elegí al menos una copia." };
  if (lineas.length > MAX_LINEAS) return { ok: false, error: "El pedido es demasiado grande. Dividilo en dos." };
  const salida: LineaCarrito[] = [];
  for (const l of lineas) {
    const { archivoId, sizeId, quantity, recorte } = (l ?? {}) as Record<string, unknown>;
    if (typeof archivoId !== "string" || !archivosPermitidos.has(archivoId)) return { ok: false, error: "Una de las fotos no es de esta carpeta." };
    if (typeof sizeId !== "string" || sizeId.length === 0) return { ok: false, error: "Falta el tamaño de una copia." };
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CANTIDAD) return { ok: false, error: "Revisá las cantidades (de 1 a 99)." };
    if (!recorteValido(recorte)) return { ok: false, error: "Uno de los recortes no es válido." };
    salida.push({ archivoId, sizeId, quantity, recorte });
  }
  return { ok: true, lineas: salida, papel: papel as Papel };
}
