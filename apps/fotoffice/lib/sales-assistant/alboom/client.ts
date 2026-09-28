import { ALBOOM_STATUS_ABIERTO, type AlboomActivity, type AlboomLeadRow, type AlboomMail, type AlboomStagesList } from "./types";

/**
 * Cliente de la API INTERNA de Alboom: la misma que usa su panel. No es pública ni documentada;
 * si Alboom la cambia, esto falla con `AlboomApiError` y la bandeja lo avisa. Sólo lee.
 *
 * El login devuelve un token que viaja como `Authorization: Bearer`. Se inicia sesión una vez
 * por corrida; ante un 401 se reintenta una sola vez.
 */
export class AlboomLoginError extends Error {}
export class AlboomApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export type CredencialAlboom = { subdomain: string; username: string; password: string };

export type ClienteAlboom = {
  listarAbiertas(): Promise<AlboomLeadRow[]>;
  detalle(id: string): Promise<{ activities: AlboomActivity[]; mails: AlboomMail[] }>;
  embudos(): Promise<string[]>;
};

const PAGE_SIZE = 100;
const MAX_PAGINAS = 20;
const TIMEOUT_MS = 20_000;

export function horaLocalAlboom(d: Date): string {
  return new Date(d.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, -1);
}

export async function crearClienteAlboom(
  cred: CredencialAlboom,
  fetchImpl: typeof fetch = fetch,
): Promise<ClienteAlboom> {
  if (!/^[a-z0-9-]{1,63}$/i.test(cred.subdomain)) {
    throw new AlboomApiError("Subdominio de Alboom inválido");
  }
  const base = `https://${cred.subdomain}.alboomcrm.com/api`;
  let token = "";

  async function login(): Promise<void> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}/users/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: cred.username,
          password: cred.password,
          type: "simple",
          login_time: horaLocalAlboom(new Date()),
          keepme: true,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new AlboomApiError("No se pudo conectar con Alboom");
    }
    // Sólo un rechazo EXPLÍCITO de la credencial es AlboomLoginError (un 401, o un 2xx que dice
    // `status: "error"`), porque ese error apaga la integración hasta que alguien la reconecte.
    // Un 403 o un 429 (firewall, límite de pedidos) o cualquier otra respuesta rara son un
    // problema de Alboom, no de la contraseña: AlboomApiError, y mañana se reintenta sola.
    if (res.status === 401) throw new AlboomLoginError("Alboom rechazó el usuario");
    if (!res.ok) throw new AlboomApiError(`Alboom respondió ${res.status} al iniciar sesión`, res.status);
    const data = (await res.json().catch(() => null)) as { status?: string; token?: string } | null;
    if (data?.status === "ok" && data.token) {
      token = data.token;
      return;
    }
    if (data?.status === "error") throw new AlboomLoginError("Alboom rechazó el usuario");
    throw new AlboomApiError("Alboom respondió algo inesperado al iniciar sesión", res.status);
  }

  async function pedir<T>(ruta: string, init: { method: "GET" | "POST"; body?: unknown }, reintento = true): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${ruta}`, {
        method: init.method,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new AlboomApiError(`No se pudo leer ${ruta}`);
    }
    if (res.status === 401 && reintento) {
      await login();
      return pedir<T>(ruta, init, false);
    }
    if (res.status === 401) throw new AlboomLoginError("Alboom rechazó la sesión");
    if (!res.ok) throw new AlboomApiError(`Alboom respondió ${res.status} en ${ruta}`, res.status);
    const data = await res.json().catch(() => null);
    if (data === null) throw new AlboomApiError(`Respuesta no JSON en ${ruta}`);
    return data as T;
  }

  await login();

  return {
    async listarAbiertas() {
      const todas: AlboomLeadRow[] = [];
      for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
        const r = await pedir<{ rows?: AlboomLeadRow[]; count?: string | number }>("/leads/paginate", {
          method: "POST",
          body: { pageNumber: pagina, pageSize: PAGE_SIZE, sortBy: "id", sortDir: "DESC", pipeline: "all", stage: "all", searchTerm: "" },
        });
        if (!Array.isArray(r.rows)) throw new AlboomApiError("leads/paginate cambió de forma");
        todas.push(...r.rows);
        const total = Number(r.count ?? 0);
        if (r.rows.length < PAGE_SIZE || todas.length >= total) break;
      }
      return todas.filter((f) => String(f.status_id) === ALBOOM_STATUS_ABIERTO);
    },
    async detalle(id) {
      if (!/^\d+$/.test(id)) throw new AlboomApiError("id de oportunidad inválido");
      const [act, mails] = await Promise.all([
        pedir<{ rows?: AlboomActivity[] }>("/activities/paginate", {
          method: "POST",
          body: { type: "leads", id, offset: 0, count: 50, searchTerm: "" },
        }),
        pedir<{ rows?: AlboomMail[] }>(`/mails/leads/${id}/0/50`, { method: "GET" }),
      ]);
      return { activities: act.rows ?? [], mails: mails.rows ?? [] };
    },
    async embudos() {
      const r = await pedir<AlboomStagesList>("/stages/list?type=lead_stage", { method: "GET" });
      return (r.stage_list ?? []).map((s) => s.name);
    },
  };
}
