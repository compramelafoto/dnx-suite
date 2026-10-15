import { describe, expect, it } from "vitest";
import { providerDomainFromNameserver, providerFromNameservers } from "./dns-provider";

describe("providerFromNameservers", () => {
  it("reconoce a los proveedores comunes por sus servidores de nombres", () => {
    expect(providerFromNameservers(["ns1.donweb.com"])?.name).toBe("DonWeb");
    expect(providerFromNameservers(["ns2.ferozo.com."])?.name).toBe("DonWeb");
    expect(providerFromNameservers(["ada.ns.cloudflare.com"])?.name).toBe("Cloudflare");
    expect(providerFromNameservers(["ns05.domaincontrol.com"])?.name).toBe("GoDaddy");
    expect(providerFromNameservers(["ns-12.awsdns-01.com"])?.name).toBe("Amazon Route 53");
  });
  it("devuelve null si no lo conoce", () => {
    expect(providerFromNameservers(["ns1.mihosting.com.ar"])).toBeNull();
    expect(providerFromNameservers([])).toBeNull();
  });
});

describe("providerDomainFromNameserver", () => {
  it("se queda con el dominio del proveedor", () => {
    expect(providerDomainFromNameserver("ns1.mihosting.com.ar.")).toBe("mihosting.com.ar");
    expect(providerDomainFromNameserver("dns2.hosting.net")).toBe("hosting.net");
  });
});
