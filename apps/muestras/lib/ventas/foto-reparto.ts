/**
 * La foto del reparto que congela la reserva (`CulturalSaleOrder.splitSnapshot`, tarea 10): con
 * ella se arma la Order al pagar y se compara lo que devuelve Mercado Pago al conciliar. Sin base
 * ni red.
 */
export type PartnerCongelado = { recipientId: "organizer" | "photographer" | "both"; receiverId: string; cents: number };

export type FotoDelReparto = {
  environment: "SANDBOX" | "PRODUCTION";
  ownerUserId: string;
  ownerCents: number;
  partners: PartnerCongelado[];
  organizer: { userId: number; receiverId: string };
  photographer: { userId: number; receiverId: string };
};

const entero = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
const texto = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 100;
const ROLES = new Set(["organizer", "photographer", "both"]);

function persona(x: unknown): { userId: number; receiverId: string } | null {
  const o = x as { userId?: unknown; receiverId?: unknown } | null;
  return o && entero(o.userId) && texto(o.receiverId) ? { userId: o.userId, receiverId: o.receiverId } : null;
}

/** Lee la foto guardada; `null` si no tiene la forma esperada (entonces no se cobra ni se concilia). */
export function leerFotoDelReparto(json: unknown): FotoDelReparto | null {
  const o = json as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  if (o.environment !== "SANDBOX" && o.environment !== "PRODUCTION") return null;
  if (!texto(o.ownerUserId) || !entero(o.ownerCents) || !Array.isArray(o.partners)) return null;
  const organizer = persona(o.organizer);
  const photographer = persona(o.photographer);
  if (!organizer || !photographer) return null;
  const partners: PartnerCongelado[] = [];
  for (const p of o.partners as unknown[]) {
    const x = p as { recipientId?: unknown; receiverId?: unknown; cents?: unknown } | null;
    if (!x || typeof x.recipientId !== "string" || !ROLES.has(x.recipientId) || !texto(x.receiverId) || !entero(x.cents)) return null;
    partners.push({ recipientId: x.recipientId as PartnerCongelado["recipientId"], receiverId: x.receiverId, cents: x.cents });
  }
  return { environment: o.environment, ownerUserId: o.ownerUserId, ownerCents: o.ownerCents, partners, organizer, photographer };
}

export type PataDelReparto = { type: string; receiverId: string; cents: number | null };

/** Lo que tiene que decir Mercado Pago: el `owner` con el fee y cada `partner` con lo suyo. */
export function repartoEsperado(f: FotoDelReparto): PataDelReparto[] {
  return [{ type: "owner", receiverId: f.ownerUserId, cents: f.ownerCents }, ...f.partners.map((p) => ({ type: "partner", receiverId: p.receiverId, cents: p.cents }))];
}

const clave = (p: PataDelReparto) => `${p.type}|${p.receiverId}|${p.cents ?? "?"}`;

/** ¿Las patas que devolvió Mercado Pago son exactamente las congeladas (sin importar el orden)? */
export function mismoReparto(esperado: readonly PataDelReparto[], recibido: readonly PataDelReparto[]): boolean {
  if (esperado.length !== recibido.length) return false;
  const a = esperado.map(clave).sort();
  const b = recibido.map(clave).sort();
  return a.every((x, i) => x === b[i]);
}
