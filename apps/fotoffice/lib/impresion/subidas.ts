import { MENSAJE_HEIC } from "./mensajes";

/**
 * Módulo PURO: lo que el navegador controla antes de subir una foto y la cola de subidas.
 * Los topes y textos son los mismos que el servidor (`almacen.ts` y `render.ts`).
 */

export const SUBIDAS_A_LA_VEZ = 3;
export const TAMANO_MAXIMO_FOTO = 60 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

export function validarArchivoFoto(f: { name: string; type: string; size: number }): { ok: true; tipo: string } | { ok: false; error: string } {
  const nombre = f.name.toLowerCase();
  // Algunos navegadores dejan vacío el tipo de una HEIC: se mira también el nombre.
  if (f.type === "image/heic" || f.type === "image/heif" || nombre.endsWith(".heic") || nombre.endsWith(".heif")) return { ok: false, error: MENSAJE_HEIC };
  if (!TIPOS.includes(f.type)) return { ok: false, error: "La foto tiene que ser JPG, PNG o WebP." };
  if (f.size > TAMANO_MAXIMO_FOTO) return { ok: false, error: `La foto pesa ${(f.size / 1024 / 1024).toFixed(1)} MB: el máximo es 60 MB.` };
  return { ok: true, tipo: f.type };
}

/** Corre `fn` sobre cada elemento, como mucho `limite` a la vez. Los resultados vuelven en el orden de entrada. */
export async function conLimite<T, R>(items: readonly T[], limite: number, fn: (item: T, i: number) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const resultados: PromiseSettledResult<R>[] = new Array(items.length);
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < items.length) {
      const i = siguiente++;
      try {
        resultados[i] = { status: "fulfilled", value: await fn(items[i]!, i) };
      } catch (reason) {
        resultados[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limite), items.length) }, trabajador));
  return resultados;
}
