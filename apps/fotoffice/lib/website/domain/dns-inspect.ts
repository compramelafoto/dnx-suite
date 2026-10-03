import "server-only";
import { resolveMx, resolveNs } from "node:dns/promises";
import { providerDomainFromNameserver, providerFromNameservers, type DnsProvider } from "./dns-provider";

export type DnsInspection = {
  nameservers: string[];
  /** Proveedor reconocido, o null si no lo conocemos (se muestra el dominio del NS). */
  provider: DnsProvider | null;
  providerDomain: string | null;
  /** Cuántos registros MX tiene: si hay, el dominio recibe correo y no hay que tocarlos. */
  mailRecords: number;
};

/** Consulta pública de DNS (lo mismo que ve cualquiera en internet). Nunca tira. */
export async function inspectDomainDns(domain: string): Promise<DnsInspection> {
  const [ns, mx] = await Promise.all([
    resolveNs(domain).catch(() => [] as string[]),
    resolveMx(domain).catch(() => [] as { exchange: string }[]),
  ]);
  return {
    nameservers: ns,
    provider: providerFromNameservers(ns),
    providerDomain: ns[0] ? providerDomainFromNameserver(ns[0]) : null,
    mailRecords: mx.length,
  };
}
