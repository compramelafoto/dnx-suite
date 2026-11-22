import { MARCAS, marcaDeDisciplina, origenPublico, type MarcaId } from "@/lib/marca";

const DOMINIO_PUBLICO = "https://muestrasfotograficas.com";
const avisado: Record<MarcaId, boolean> = { FOTOGRAFIA: false, ARTE: false };

/** ¿Sirve para algo impreso o mandado por correo? https y un dominio propio (ni local ni `*.vercel.app`). */
function sirveEnProduccion(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return u.protocol === "https:" && host !== "localhost" && !host.endsWith(".localhost") && host !== "127.0.0.1"
      && host !== "[::1]" && host !== "vercel.app" && !host.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

/** Un QR de arte nunca lleva al sitio de fotografía (pasa si `APP_URL` es la de fotografía). */
function esDeFotografia(url: string): boolean {
  const host = new URL(url).hostname.toLowerCase();
  return host === MARCAS.FOTOGRAFIA.dominio || host.endsWith(`.${MARCAS.FOTOGRAFIA.dominio}`);
}

function avisar(marca: MarcaId, respaldo: string) {
  if (avisado[marca]) return;
  avisado[marca] = true;
  console.warn(`[fichas] APP_URL no sirve para un QR impreso en producción; se usa ${respaldo}.`);
}

/**
 * La dirección pública del sitio de **la casa de la muestra**, la que va en el QR, en las piezas,
 * certificados y correos. En local puede apuntar a `localhost` (arte, a `muestrasdearte.localhost`).
 *
 * En producción un QR impreso dura lo que dure la muestra: no puede llevar `localhost`, una
 * dirección `*.vercel.app` (cambia con cada proyecto) ni `http`. Si la dirección no sirve, se usa el
 * dominio de la marca y se avisa una vez en el log para corregir la variable en Vercel.
 *
 * Fotografía (o sin disciplina) sigue las reglas de siempre con `APP_URL`; el resto usa el dominio de
 * arte (`origenPublico(MARCAS.ARTE)`), con el mismo control, y nunca el dominio de fotografía.
 */
export function baseUrlPublica(env: Record<string, string | undefined> = process.env, primaryDiscipline?: string | null): string {
  const produccion = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  if (marcaDeDisciplina(primaryDiscipline).id === "ARTE") {
    const respaldo = MARCAS.ARTE.origen;
    let pedida: string | null = null;
    try {
      pedida = origenPublico(MARCAS.ARTE, env).replace(/\/+$/, "");
    } catch {
      // `APP_URL` que no es una dirección: se usa el dominio de arte.
    }
    if (pedida && (!produccion || pedida === respaldo)) return pedida;
    if (pedida && sirveEnProduccion(pedida) && !esDeFotografia(pedida)) return pedida;
    if (produccion) avisar("ARTE", respaldo);
    return respaldo;
  }
  const pedida = (env.APP_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim() || DOMINIO_PUBLICO).replace(/\/+$/, "");
  if (!produccion || pedida === DOMINIO_PUBLICO) return pedida;
  if (sirveEnProduccion(pedida)) return pedida;
  avisar("FOTOGRAFIA", DOMINIO_PUBLICO);
  return DOMINIO_PUBLICO;
}
