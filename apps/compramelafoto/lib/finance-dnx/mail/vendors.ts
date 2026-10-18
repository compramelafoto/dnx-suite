/**
 * Proveedores cuyos mails se leen de Gmail, en qué cuenta llegan y desde qué remitentes.
 * `active` del proveedor en la base NO afecta esta tabla: los mails de un proveedor inactivo
 * (Cursor) se leen igual, para el histórico.
 */
export type MailVendor = {
  key: string;
  account: string;
  /** Dirección completa o dominio (un dominio cubre sus subdominios). */
  senders: string[];
  /** Si está, el asunto tiene que cumplirlo. Sirve para separar dos proveedores con el mismo remitente. */
  subjectHint?: RegExp;
};

const CLF = "compramelafoto@gmail.com";
const DNX = "dnxfotografia@gmail.com";
const CUART = "cuart.daniel@gmail.com";

export const MAIL_ACCOUNTS: readonly string[] = [CLF, DNX, CUART];

const ANTHROPIC = "invoice+statements@mail.anthropic.com";
const ANTHROPIC_API_HINT = /\b(api|credits?|cr[eé]dito)\b/i;

// El orden importa: la primera coincidencia gana (anthropic-api antes que anthropic).
export const MAIL_VENDORS: readonly MailVendor[] = [
  { key: "aws", account: CLF, senders: ["payment@aws.com"] },
  { key: "cloudflare", account: CLF, senders: ["cloudflare.com"] },
  { key: "anthropic-api", account: DNX, senders: [ANTHROPIC], subjectHint: ANTHROPIC_API_HINT },
  { key: "anthropic", account: DNX, senders: [ANTHROPIC] },
  { key: "resend", account: DNX, senders: ["invoice+statements@invoicing.resend.com"] },
  { key: "chatgpt", account: DNX, senders: ["openai.com"] },
  { key: "neon", account: DNX, senders: ["noreply@ar.neon.tech"] },
  { key: "vercel", account: DNX, senders: ["notifications@vercel.com"] },
  { key: "cursor", account: DNX, senders: ["invoice+statements+acct_1Lb5LzB4TZWxSIGU@stripe.com"] },
  // CapCut todavía no cobró: se confirma el remitente con el primer mail.
  { key: "capcut", account: DNX, senders: ["capcut.com"] },
  { key: "elevenlabs", account: CUART, senders: ["invoice+statements+acct_1M07hSLmdOdiMXBs@stripe.com"] },
];

function norm(email: string): string {
  return email.trim().toLowerCase();
}

/** "Neon, LLC <noreply@ar.neon.tech>" → "noreply@ar.neon.tech" */
function bareAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return norm(m ? m[1] : from);
}

function senderMatches(address: string, sender: string): boolean {
  const s = norm(sender);
  if (s.includes("@")) return address === s;
  const domain = address.split("@")[1] ?? "";
  return domain === s || domain.endsWith(`.${s}`);
}

export function isAllowedAccount(email: string): boolean {
  return MAIL_ACCOUNTS.includes(norm(email));
}

export function matchVendorKey(account: string, fromAddress: string, subject: string): string | null {
  const acc = norm(account);
  const address = bareAddress(fromAddress);
  for (const v of MAIL_VENDORS) {
    if (v.account !== acc) continue;
    if (!v.senders.some((s) => senderMatches(address, s))) continue;
    if (v.subjectHint && !v.subjectHint.test(subject)) continue;
    return v.key;
  }
  return null;
}

/** Búsqueda de Gmail para una cuenta. `after` null = todo el historial. "" = nada que buscar. */
export function gmailQueryFor(account: string, after: Date | null): string {
  const acc = norm(account);
  const senders = [...new Set(MAIL_VENDORS.filter((v) => v.account === acc).flatMap((v) => v.senders))];
  if (senders.length === 0) return "";
  const from = `from:(${senders.join(" OR ")})`;
  return after ? `${from} after:${Math.floor(after.getTime() / 1000)}` : from;
}
