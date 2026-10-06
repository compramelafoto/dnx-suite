/**
 * ¿Dónde se cambian los registros de este dominio? En NIC Argentina sólo se elige QUIÉN
 * administra el DNS (la "delegación"); los registros A/CNAME se cargan en ese proveedor. Por los
 * servidores de nombres (NS) se reconoce a los más comunes y se le dice al dueño a dónde ir.
 */

export type DnsProvider = { name: string; panelHint: string; helpUrl: string | null };

const KNOWN: { match: RegExp; provider: DnsProvider }[] = [
  {
    match: /cloudflare\.com$/,
    provider: { name: "Cloudflare", panelHint: "Entrá a Cloudflare → tu dominio → DNS → Records. En cada registro dejá la nube en gris («Solo DNS»): con la nube naranja el certificado de seguridad puede fallar.", helpUrl: "https://dash.cloudflare.com" },
  },
  {
    match: /(donweb|ferozo|dattatec)\.(com|net)$/,
    provider: { name: "DonWeb", panelHint: "Entrá a DonWeb → Mis servicios → tu dominio → Zona DNS.", helpUrl: "https://donweb.com/es-ar/ingresar" },
  },
  {
    match: /(hostinger|dns-parking)\.com$/,
    provider: { name: "Hostinger", panelHint: "Entrá a Hostinger → Dominios → tu dominio → DNS / Nameservers.", helpUrl: "https://hpanel.hostinger.com" },
  },
  {
    match: /domaincontrol\.com$/,
    provider: { name: "GoDaddy", panelHint: "Entrá a GoDaddy → Mis productos → tu dominio → DNS.", helpUrl: "https://dcc.godaddy.com" },
  },
  {
    match: /(googledomains|google)\.com$/,
    provider: { name: "Google / Squarespace", panelHint: "Entrá al panel de dominios de Squarespace → DNS.", helpUrl: "https://account.squarespace.com/domains" },
  },
  {
    match: /(awsdns-\d+)\.(com|net|org|co\.uk)$/,
    provider: { name: "Amazon Route 53", panelHint: "Entrá a AWS → Route 53 → Hosted zones → tu dominio.", helpUrl: null },
  },
  {
    match: /vercel-dns\.com$/,
    provider: { name: "Vercel", panelHint: "El DNS ya lo administra Vercel: avisanos y lo resolvemos nosotros.", helpUrl: null },
  },
  {
    match: /(nic\.ar)$/,
    provider: { name: "NIC Argentina", panelHint: "Hoy no hay ningún proveedor de DNS: hay que delegar el dominio a uno.", helpUrl: "https://nic.ar" },
  },
];

export function providerFromNameservers(nameservers: readonly string[]): DnsProvider | null {
  for (const ns of nameservers) {
    const host = ns.toLowerCase().replace(/\.$/, "");
    const hit = KNOWN.find((k) => k.match.test(host));
    if (hit) return hit.provider;
  }
  return null;
}

/** El dominio del proveedor a partir de un NS desconocido: `ns1.mihosting.com.ar` → `mihosting.com.ar`. */
export function providerDomainFromNameserver(ns: string): string {
  const parts = ns.toLowerCase().replace(/\.$/, "").split(".");
  const tail = parts.slice(-3).join(".");
  return /\.(com|net|org|gob|edu)\.ar$/.test(tail) ? tail : parts.slice(-2).join(".");
}
