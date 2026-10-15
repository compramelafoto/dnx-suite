import "server-only";
import { GROUP_LABEL_PREFIX } from "./constants";
import { PERSON_FIELDS, UPDATE_PERSON_FIELDS, type GooglePerson } from "./person";

/**
 * Cliente de la People API. Lo único de este módulo que habla por la red.
 *
 * Vive detrás de una interfaz para que la sincronización se pueda probar con un doble:
 * ningún test llama a Google.
 */

const API = "https://people.googleapis.com/v1";

export type ChangesPage = {
  people: GooglePerson[];
  nextPageToken: string | null;
  /** Guardar para la próxima corrida. Solo viene en la última página. */
  nextSyncToken: string | null;
};

export type ContactsClient = {
  /** El grupo del módulo, creándolo si hace falta. Nunca crea dos con el mismo nombre. */
  ensureGroup(label: string): Promise<string>;
  listChanges(input: { syncToken?: string | null; pageToken?: string | null }): Promise<ChangesPage>;
  createContact(body: Record<string, unknown>): Promise<{
    resourceName: string;
    etag: string | null;
    /**
     * La persona tal como quedó guardada en Google, según la propia respuesta de la People
     * API — no la que se le mandó. Quien sincroniza la necesita para calcular la huella
     * remota sobre lo que Google efectivamente guardó: si Google normaliza o reformatea algo
     * (un teléfono, un espacio de más), la huella de lo enviado no describe lo que quedó allá.
     * `null` sólo si la respuesta no la trajo — no debería pasar, pero el tipo lo permite para
     * que quien la consuma se pueda degradar sin romperse.
     */
    person: GooglePerson | null;
  }>;
  updateContact(input: {
    resourceName: string;
    etag: string | null;
    body: Record<string, unknown>;
  }): Promise<{
    etag: string | null;
    /** Ídem `createContact`: la persona que devolvió Google, no la que se le mandó. */
    person: GooglePerson | null;
  }>;
  setGroupMembership(input: {
    groupResourceName: string;
    resourceName: string;
    member: boolean;
  }): Promise<void>;
};

/** Error con el código HTTP y el motivo a la vista, para poder distinguir los dos 429. */
class ContactsHttpError extends Error {
  readonly code: number;
  readonly reason: string | null;
  constructor(code: number, reason: string | null, message: string) {
    super(message);
    this.name = "ContactsHttpError";
    this.code = code;
    this.reason = reason;
  }
}

/**
 * Distingue "Google no te deja" de "Google falló".
 *
 * Son dos consejos opuestos: ante un 403 hay que reconectar la cuenta para que otorgue el
 * permiso que falta, y ante cualquier otra cosa hay que esperar y reintentar.
 */
export function isContactsPermissionError(error: unknown): boolean {
  return error instanceof ContactsHttpError && error.code === 403;
}

/**
 * ¿El `syncToken` dejó de valer?
 *
 * **Ojo: acá NO sirve la función de Calendar.** Calendar contesta 410; la People API contesta
 * **429 con `reason: "EXPIRED_SYNC_TOKEN"`** — y 429 a secas es "pediste demasiado", que se
 * arregla esperando. Tomar todo 429 por token vencido haría recargar la agenda entera cada
 * vez que Google frena la mano.
 *
 * El token vence a los 7 días aunque nadie toque nada: que esto pase de vez en cuando es el
 * funcionamiento normal, no una falla.
 */
export function isExpiredSyncToken(error: unknown): boolean {
  return error instanceof ContactsHttpError && error.reason === "EXPIRED_SYNC_TOKEN";
}

/** El `reason` que viene adentro del cuerpo de error de Google, si viene. */
function leerReason(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const error = (body as { error?: { details?: unknown[]; status?: string } }).error;
  if (!error) return null;
  for (const detalle of error.details ?? []) {
    const reason = (detalle as { reason?: unknown }).reason;
    if (typeof reason === "string") return reason;
  }
  return typeof error.status === "string" ? error.status : null;
}

/**
 * Pausa mínima entre escrituras. La People API acepta unas 90 escrituras por minuto por
 * cuenta; una corrida que manda 200 de corrido choca contra ese límite a mitad de camino y
 * lo que falta queda para la corrida siguiente —que es al otro día—. A 750 ms son 80 por
 * minuto: la carga inicial de un padrón de 200 personas entra en una sola corrida, en
 * dos minutos y medio. En las pruebas no se espera.
 */
const PAUSA_ENTRE_ESCRITURAS_MS = process.env.NODE_ENV === "test" ? 0 : 750;

export function createContactsClient(accessToken: string): ContactsClient {
  let ultimaEscritura = 0;

  async function pedir<T>(path: string, init?: RequestInit): Promise<T> {
    const escribe = init?.method !== undefined && init.method !== "GET";
    if (escribe && PAUSA_ENTRE_ESCRITURAS_MS > 0) {
      const falta = ultimaEscritura + PAUSA_ENTRE_ESCRITURAS_MS - Date.now();
      if (falta > 0) await new Promise((r) => setTimeout(r, falta));
      ultimaEscritura = Date.now();
    }
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      // El cuerpo puede traer datos de la cuenta: solo se propaga el código y el motivo.
      const body = await res.json().catch(() => null);
      throw new ContactsHttpError(
        res.status,
        leerReason(body),
        `La People API respondió ${res.status}`,
      );
    }
    return (await res.json()) as T;
  }

  return {
    async ensureGroup(label) {
      const lista = await pedir<{ contactGroups?: { resourceName?: string; name?: string }[] }>(
        "/contactGroups?pageSize=1000",
      );
      const existente = lista.contactGroups?.find((g) => g.name === label);
      if (existente?.resourceName) return existente.resourceName;

      const creado = await pedir<{ resourceName?: string }>("/contactGroups", {
        method: "POST",
        body: JSON.stringify({ contactGroup: { name: label } }),
      });
      if (!creado.resourceName) {
        throw new ContactsHttpError(500, null, "Google no devolvió el grupo creado");
      }
      return creado.resourceName;
    },

    async listChanges({ syncToken, pageToken }) {
      // Los parámetros TIENEN que ser idénticos a los de la llamada que generó el token.
      // Agregar un campo a PERSON_FIELDS invalida los tokens de todas las instituciones:
      // hay que borrarlos en la misma migración que agregue el campo.
      const q = new URLSearchParams({
        personFields: PERSON_FIELDS,
        pageSize: "1000",
        requestSyncToken: "true",
      });
      if (syncToken) q.set("syncToken", syncToken);
      if (pageToken) q.set("pageToken", pageToken);

      const page = await pedir<{
        connections?: GooglePerson[];
        nextPageToken?: string;
        nextSyncToken?: string;
      }>(`/people/me/connections?${q.toString()}`);

      return {
        people: page.connections ?? [],
        nextPageToken: page.nextPageToken ?? null,
        nextSyncToken: page.nextSyncToken ?? null,
      };
    },

    async createContact(body) {
      // La People API devuelve, por defecto, el contacto COMPLETO en el mismo cuerpo que trae
      // `resourceName` y `etag` — no hace falta pedir `personFields` aparte para tenerlo.
      const creado = await pedir<GooglePerson>("/people:createContact", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!creado.resourceName) {
        throw new ContactsHttpError(500, null, "Google no devolvió el contacto creado");
      }
      return { resourceName: creado.resourceName, etag: creado.etag ?? null, person: creado };
    },

    async updateContact({ resourceName, etag, body }) {
      // El etag es el testigo de concurrencia de Google: sin él se pisa lo que otro escribió
      // entre que se leyó el contacto y se lo actualizó.
      // Igual que en `createContact`: la respuesta trae el contacto completo por defecto.
      const actualizado = await pedir<GooglePerson>(
        `/${resourceName}:updateContact?updatePersonFields=${encodeURIComponent(UPDATE_PERSON_FIELDS)}`,
        { method: "PATCH", body: JSON.stringify({ ...body, etag }) },
      );
      return { etag: actualizado.etag ?? null, person: actualizado };
    },

    async setGroupMembership({ groupResourceName, resourceName, member }) {
      await pedir(`/${groupResourceName}/members:modify`, {
        method: "POST",
        body: JSON.stringify(
          member
            ? { resourceNamesToAdd: [resourceName] }
            : { resourceNamesToRemove: [resourceName] },
        ),
      });
    },
  };
}

/** El nombre del grupo de un módulo. Ver `GROUP_LABEL_PREFIX`. */
export function groupLabelFor(moduleLabel: string): string {
  return `${GROUP_LABEL_PREFIX}${moduleLabel}`;
}
