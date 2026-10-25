const API = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const TIMEOUT_MS = 15_000;
export const BODY_MAX_CHARS = 60_000;
// Debajo de esto el texto plano no alcanza y se prefiere el HTML.
const PLAIN_MIN_CHARS = 300;

export type GmailMessage = { id: string; from: string; subject: string; receivedAt: Date; bodyText: string };

export class GmailError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GmailError";
  }
}

type Part = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string };
  parts?: Part[];
};

async function getJson(url: string, accessToken: string, fetchImpl: typeof fetch): Promise<any> {
  const res = await fetchImpl(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new GmailError(`Gmail respondió ${res.status}: ${json?.error?.message ?? "sin detalle"}`, res.status);
  return json;
}

export async function listMessageIds(p: {
  accessToken: string;
  query: string;
  pageToken?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ids: string[]; nextPageToken: string | null }> {
  const url = new URL(API);
  url.searchParams.set("q", p.query);
  url.searchParams.set("maxResults", "100");
  url.searchParams.set("includeSpamTrash", "false");
  if (p.pageToken) url.searchParams.set("pageToken", p.pageToken);
  const json = await getJson(url.toString(), p.accessToken, p.fetchImpl ?? fetch);
  const ids = Array.isArray(json.messages) ? json.messages.map((m: { id: string }) => m.id) : [];
  return { ids, nextPageToken: typeof json.nextPageToken === "string" ? json.nextPageToken : null };
}

function decode(data: string | undefined): string {
  return data ? Buffer.from(data, "base64url").toString("utf8") : "";
}

function findPart(part: Part, mimeType: string): Part | null {
  if (part.mimeType === mimeType && !part.filename && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const hit = findPart(child, mimeType);
    if (hit) return hit;
  }
  return null;
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

export async function getMessage(p: { accessToken: string; id: string; fetchImpl?: typeof fetch }): Promise<GmailMessage> {
  const json = await getJson(`${API}/${encodeURIComponent(p.id)}?format=full`, p.accessToken, p.fetchImpl ?? fetch);
  const payload: Part = json.payload ?? {};
  const header = (name: string) =>
    payload.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  const plainText = decode(findPart(payload, "text/plain")?.body?.data).trim();
  const html = findPart(payload, "text/html");
  // Algunos proveedores (Neon) mandan un texto plano que es sólo el asunto: ahí el dato está en el HTML.
  const htmlText = plainText.length < PLAIN_MIN_CHARS && html ? htmlToText(decode(html.body?.data)) : "";
  const text = htmlText.length > plainText.length ? htmlText : plainText;
  return {
    id: String(json.id),
    from: header("From"),
    subject: header("Subject"),
    receivedAt: new Date(Number(json.internalDate ?? 0)),
    bodyText: text.slice(0, BODY_MAX_CHARS),
  };
}
