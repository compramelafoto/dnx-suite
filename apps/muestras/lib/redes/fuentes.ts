import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Fuente de las piezas para redes (D26–D27): un archivo del repo, nunca una fuente del sistema (en
 * Vercel no hay). Es Roboto Regular (licencia Apache 2.0, la misma que usa la marca de agua de
 * FotoRank): no se descargó Archivo, así que los dos pesos usan este archivo y Pango sintetiza la
 * negrita. `process.cwd()` es apps/muestras en Next y en Vercel; los tests también corren desde ahí.
 *
 * Para que el archivo llegue a la función de Vercel, `next.config.ts` lo suma a la ruta
 * `/api/redes/**` con `outputFileTracingIncludes` (se lee con `fs`, así que el rastreo de Next no
 * lo encuentra solo).
 */
export const FAMILIA = "Roboto";

/**
 * En macOS, Pango dibuja con CoreText y **ignora `fontfile`** (usa una fuente del sistema): las
 * pruebas locales pasarían aunque el archivo no se usara. En Linux (Vercel) Pango sólo tiene
 * fontconfig, que sí registra el archivo. Se fuerza fontconfig para que local y producción dibujen
 * con la misma fuente. Tiene que valer antes del primer texto que dibuje el proceso: en Linux no
 * cambia nada.
 */
process.env.PANGOCAIRO_BACKEND ??= "fc";

/**
 * Configuración propia de fontconfig (`assets/fonts/fonts.conf`): sin ella, fontconfig no tiene
 * reglas (en Vercel no hay `/etc/fonts`) y "negrita" sale igual que la normal, porque el archivo es
 * Regular. La configuración sólo le pide que sintetice la negrita. Se resuelve una vez, al cargar.
 */
const CONFIG = buscar("fonts.conf");
if (CONFIG) process.env.FONTCONFIG_FILE ??= CONFIG;

function buscar(archivo: string): string | null {
  for (const base of [process.cwd(), path.join(process.cwd(), "apps", "muestras")]) {
    const ruta = path.join(base, "assets", "fonts", archivo);
    if (fs.existsSync(ruta)) return ruta;
  }
  return null;
}

const ARCHIVOS = { normal: "Roboto-Regular.ttf", negrita: "Roboto-Regular.ttf" } as const;
const cache = new Map<string, string>();

export function rutaDeFuente(peso: keyof typeof ARCHIVOS): string {
  const hit = cache.get(peso);
  if (hit) return hit;
  const ruta = buscar(ARCHIVOS[peso]);
  if (ruta) {
    cache.set(peso, ruta);
    return ruta;
  }
  throw new Error(`Falta la fuente de las piezas (assets/fonts/${ARCHIVOS[peso]}).`);
}
