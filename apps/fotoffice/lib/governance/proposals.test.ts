import { describe, expect, it } from "vitest";
import { parseProposal, proposalJourney, proposalStateForMember } from "./proposals";

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

describe("proposalJourney", () => {
  const estados = (s: string) => proposalJourney(s).map((p) => p.state);
  it("marca dónde está", () => {
    expect(estados("MEMBER_PROPOSAL")).toEqual(["done", "current", "pending", "pending", "pending"]);
    expect(estados("PROPOSED")).toEqual(["done", "done", "current", "pending", "pending"]);
    expect(estados("APPROVED")).toEqual(["done", "done", "done", "done", "current"]);
    expect(estados("DONE")).toEqual(["done", "done", "done", "done", "done"]);
  });
  it("marca dónde se cortó, con su nombre", () => {
    const archivada = proposalJourney("ARCHIVED");
    expect(archivada.map((p) => p.state)).toEqual(["done", "failed", "pending", "pending", "pending"]);
    expect(archivada[1]!.label).toBe("Archivada");
    expect(proposalJourney("REJECTED")[2]!.label).toBe("No aprobada");
  });
  it("nombra lo postergado y lo que está en marcha", () => {
    expect(proposalJourney("POSTPONED")[2]!.label).toMatch(/Postergada/);
    expect(proposalJourney("IN_PROGRESS")[4]!.label).toBe("En marcha");
  });
});

describe("proposalJourney aprobada", () => {
  it("no dice Realizada antes de tiempo", () => {
    expect(proposalJourney("APPROVED")[4]!.label).toBe("Por realizarse");
    expect(proposalJourney("DONE")[4]!.label).toBe("Realizada");
  });
});
