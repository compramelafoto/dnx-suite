import "server-only";
import { leerTokenInstagram } from "@/lib/integrations/instagram/credentials";

/**
 * Perfil público de quien escribe por Instagram (nombre y @usuario), para nombrar el chat nuevo.
 * Usa el token de la página vinculada. NUNCA lanza: si algo falla el chat se crea igual, sin nombre.
 * No loguea el token ni el IGSID.
 */

export type PerfilInstagram = { nombre: string | null; usuario: string | null };

export type DepsPerfil = {
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  leerToken?: (workspaceId: string) => Promise<string | null>;
};

/** El webhook tiene que contestarle rápido a Meta: el perfil no puede demorar el registro. */
const TIEMPO_PERFIL_MS = 5_000;

const cadena = (v: unknown): string | null => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null);

export async function perfilInstagram(workspaceId: string, igsid: string, deps: DepsPerfil = {}): Promise<PerfilInstagram> {
  const vacio: PerfilInstagram = { nombre: null, usuario: null };
  try {
    const token = await (deps.leerToken ?? leerTokenInstagram)(workspaceId);
    if (!token) return vacio;
    const version = process.env.WHATSAPP_API_VERSION || "v21.0";
    const r = await (deps.fetch ?? fetch)(`https://graph.facebook.com/${version}/${encodeURIComponent(igsid)}?fields=name,username`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIEMPO_PERFIL_MS),
    });
    if (!r.ok) {
      console.warn("[fotoffice][instagram] no se pudo leer un perfil", { status: r.status });
      return vacio;
    }
    const datos = (await r.json()) as { name?: unknown; username?: unknown } | null;
    return { nombre: cadena(datos?.name), usuario: cadena(datos?.username) };
  } catch (e) {
    console.warn("[fotoffice][instagram] no se pudo leer un perfil", { error: e instanceof Error ? e.name : "desconocido" });
    return vacio;
  }
}
