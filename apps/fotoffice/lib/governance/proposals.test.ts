import { describe, expect, it } from "vitest";
import { parseProposal, proposalStateForMember } from "./proposals";

describe("propuesta de socio", () => {
  it("pide título y una descripción con algo de detalle", () => {
    expect(parseProposal({ title: "", description: "x".repeat(30) }).ok).toBe(false);
    expect(parseProposal({ title: "Salida", description: "corta" }).ok).toBe(false);
  });

  it("lee el costo como lo escribe la gente", () => {
    const r = parseProposal({ title: "Salida", description: "Una salida fotográfica a la isla con socios.", approxCost: "$ 150.000,50", commitment: "Pido presupuestos." });
    expect(r.ok && r.values.approxCostArs).toBe("150000.50");
    expect(parseProposal({ title: "Salida", description: "Una salida fotográfica a la isla con socios.", approxCost: "mucho" }).ok).toBe(false);
  });

  it("pide el compromiso de quien propone; la idea de fondos es opcional", () => {
    const base = { title: "Parrillero", description: "Arreglar el techo del parrillero y la cocina." };
    const sin = parseProposal(base);
    expect(sin.ok).toBe(false);
    expect(!sin.ok && sin.error).toMatch(/colaborar/);
    const con = parseProposal({ ...base, commitment: "  Consigo tres presupuestos.  ", fundingIdea: "" });
    expect(con.ok && con.values.proposerCommitment).toBe("Consigo tres presupuestos.");
    expect(con.ok && con.values.fundingIdea).toBeNull();
    const fondos = parseProposal({ ...base, commitment: "Ayudo.", fundingIdea: "Una rifa." });
    expect(fondos.ok && fondos.values.fundingIdea).toBe("Una rifa.");
  });

  it("le cuenta al socio en qué quedó", () => {
    expect(proposalStateForMember("MEMBER_PROPOSAL").label).toMatch(/revisión/);
    expect(proposalStateForMember("PROPOSED").label).toMatch(/Aceptada/);
    expect(proposalStateForMember("ARCHIVED").tone).toBe("danger");
    expect(proposalStateForMember("APPROVED").tone).toBe("success");
  });
});
