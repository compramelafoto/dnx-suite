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
  /**
   * Búsqueda de Gmail propia, en vez de sumar `senders` al `from:` común. Para remitentes
   * compartidos por muchos comercios (Stripe) o dominios con mucho correo que no es cobro.
   */
  query?: string;
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
  // Los recibos de Vercel no llegan a dnxfotografia@ (ahí sólo los avisos de pago fallido).
  { key: "vercel", account: CLF, senders: ["invoice+statements@vercel.com"] },
  // AfterShoot cobra con Stripe pero manda los recibos desde su propio dominio.
  { key: "aftershoot", account: CUART, senders: ["invoice+statements@aftershoot.com"] },
  {
    key: "linkedin",
    account: CUART,
    senders: ["linkedin.com"],
    // "Premium" solo trae sobre todo promociones: sólo la confirmación de compra y los recibos.
    subjectHint: /gracias por abonarte|recibo|receipt|factura|invoice/i,
    query: 'from:linkedin.com subject:("gracias por abonarte" OR recibo OR receipt OR factura OR invoice)',
  },
  {
    key: "starlink",
    account: CUART,
    senders: ["starlink.com"],
    subjectHint: /recibo|receipt|factura|invoice/i,
    query: "from:starlink.com subject:(recibo OR receipt OR factura OR invoice)",
  },
];

function norm(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * "Neon, LLC <noreply@ar.neon.tech>" → "noreply@ar.neon.tech". Se toma el ÚLTIMO <…>: el
 * nombre visible lo escribe quien manda y puede traer una dirección falsa entre <>.
 */
function bareAddress(from: string): string {
  const all = [...from.matchAll(/<([^<>]+)>/g)];
  return norm(all.length > 0 ? all[all.length - 1][1] : from);
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
  const mine = MAIL_VENDORS.filter((v) => v.account === acc);
  const senders = [...new Set(mine.filter((v) => !v.query).flatMap((v) => v.senders))];
  const custom = mine.flatMap((v) => (v.query ? [v.query] : []));
  const parts = [...(senders.length ? [`from:(${senders.join(" OR ")})`] : []), ...custom];
  if (parts.length === 0) return "";
  const search = parts.length === 1 ? parts[0] : `(${parts.map((p) => `(${p})`).join(" OR ")})`;
  return after ? `${search} after:${Math.floor(after.getTime() / 1000)}` : search;
}
