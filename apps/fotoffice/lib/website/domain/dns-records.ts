/**
 * Los registros que el dueño copia en NIC Argentina (o donde administre el dominio). Son los
 * valores que Vercel publica para cualquier proyecto; si Vercel recomienda otros para este
 * dominio, la comprobación los trae y reemplazan a estos.
 */
export const VERCEL_APEX_IP = "76.76.21.21";
export const VERCEL_WWW_CNAME = "cname.vercel-dns.com";

export type DnsRecord = { type: "A" | "CNAME" | "TXT"; name: string; value: string; note: string };

export function dnsRecordsFor(domain: string, overrides?: { apexIp?: string; wwwCname?: string }): DnsRecord[] {
  return [
    {
      type: "A",
      name: "@",
      value: overrides?.apexIp || VERCEL_APEX_IP,
      note: `Para ${domain}. Si ya hay un registro A, se reemplaza.`,
    },
    {
      type: "CNAME",
      name: "www",
      value: overrides?.wwwCname || VERCEL_WWW_CNAME,
      note: `Para www.${domain}. Si ya hay un registro www, se reemplaza.`,
    },
  ];
}

export type DomainStatus = "PENDING" | "CONNECTED" | "ERROR";

export function parseDomainStatus(raw: string | null | undefined): DomainStatus {
  return raw === "CONNECTED" || raw === "ERROR" ? raw : "PENDING";
}
