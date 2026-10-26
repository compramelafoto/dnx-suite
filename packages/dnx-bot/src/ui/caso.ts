// Modo caso de la burbuja: la persona llega desde el link del mail de soporte y sigue su reclamo.
// Puro y apto para el navegador (ver la regla de src/ui/index.ts).
import type { AlmacenSimple } from "./globito";
import type { Item } from "./items";

export const DNXBOT_CASO_PARAM = "dnxbot_caso";
export const DNXBOT_CASO_KEY = "dnxbot:caso";
const TOKEN = /^[A-Za-z0-9_-]{1,200}$/;

export const TEXTO_CASO_VENCIDO =
  "El link de este reclamo venció. Escribime y te mando un código a tu mail para seguir con tu consulta.";

/** Token del caso: de la URL (y se guarda, porque el inicio de sesión pierde el parámetro) o el guardado. */
export function casoInicial(search: string, almacen: AlmacenSimple | null): string | null {
  const deUrl = new URLSearchParams(search).get(DNXBOT_CASO_PARAM);
  if (deUrl != null) {
    if (!TOKEN.test(deUrl)) return null;
    try {
      almacen?.setItem(DNXBOT_CASO_KEY, deUrl);
    } catch {
      /* sin almacenamiento: sólo se usa la URL */
    }
    return deUrl;
  }
  try {
    const guardado = almacen?.getItem(DNXBOT_CASO_KEY) ?? null;
    return guardado && TOKEN.test(guardado) ? guardado : null;
  } catch {
    return null;
  }
}

export function olvidarCaso(almacen: AlmacenSimple | null): void {
  try {
    almacen?.removeItem(DNXBOT_CASO_KEY);
  } catch {
    /* nada */
  }
}

export function stripCasoParam(href: string): string {
  const u = new URL(href);
  u.searchParams.delete(DNXBOT_CASO_PARAM);
  return u.toString();
}

/** Historia del caso (de /caso?token=) a mensajes de la ventana. Lo que no se reconoce se descarta. */
export function itemsDeCaso(crudo: unknown): Item[] {
  if (!Array.isArray(crudo)) return [];
  const items: Item[] = [];
  for (const x of crudo) {
    const i = x as { rol?: unknown; texto?: unknown; autor?: unknown } | null;
    if (!i || typeof i.texto !== "string" || !i.texto) continue;
    if (i.rol === "usuario") items.push({ kind: "user", text: i.texto });
    else if (i.rol === "bot") items.push({ kind: "bot", text: i.texto });
    else if (i.rol === "equipo") items.push({ kind: "equipo", text: i.texto, autor: typeof i.autor === "string" ? i.autor : "Equipo" });
  }
  return items;
}
