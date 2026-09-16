import { describe, expect, it } from "vitest";
import { personVocabulary } from "@/lib/vocabulario/personas";
import { friendlyMemberCategoryError, friendlyMemberError, memberSchema } from "./schema";

const socios = personVocabulary(null);
const voluntarios = personVocabulary({ singular: "voluntario/a", plural: "voluntarios/as" });

describe("friendlyMemberError — G/I: mensajes claros, nunca el error crudo de Prisma", () => {
  it("G: memberNumber duplicado → mensaje específico de número", () => {
    const e = { code: "P2002", meta: { target: ["workspaceId", "memberNumber"] } };
    expect(friendlyMemberError(e, socios)).toBe("Ya existe un socio con ese número en este workspace.");
  });

  it("I: documento duplicado → mensaje específico de documento", () => {
    const e = { code: "P2002", meta: { target: ["workspaceId", "documentType", "documentNumber"] } };
    expect(friendlyMemberError(e, socios)).toBe("Ya existe un socio con ese documento en este workspace.");
  });

  it("email duplicado → mensaje específico de email", () => {
    const e = { code: "P2002", meta: { target: ["workspaceId", "email"] } };
    expect(friendlyMemberError(e, socios)).toBe("Ya existe un socio con ese email en este workspace.");
  });

  it("userId duplicado → mensaje específico de cuenta vinculada", () => {
    const e = { code: "P2002", meta: { target: ["workspaceId", "userId"] } };
    expect(friendlyMemberError(e, socios)).toBe("Esa cuenta ya está vinculada a otro socio de este workspace.");
  });

  it("nunca expone el objeto de error crudo de Prisma", () => {
    const e = { code: "P2002", meta: { target: ["workspaceId", "memberNumber"] } };
    const msg = friendlyMemberError(e, socios);
    expect(msg).not.toMatch(/P2002|PrismaClient|meta\./);
  });

  it("error no reconocido → mensaje genérico, no explota", () => {
    expect(friendlyMemberError(new Error("algo raro"), socios)).toBe("No se pudo guardar el socio.");
    expect(friendlyMemberError(undefined, socios)).toBe("No se pudo guardar el socio.");
  });

  it("en una institución de voluntarios, el error habla de voluntarios", () => {
    // El error de Prisma es el mismo; la palabra con la que se lo cuenta, no.
    const e = { code: "P2002", meta: { target: ["workspaceId", "memberNumber"] } };
    expect(friendlyMemberError(e, voluntarios)).toBe(
      "Ya existe un voluntario/a con ese número en este workspace.",
    );
    expect(friendlyMemberError(undefined, voluntarios)).not.toMatch(/socio/i);
  });
});

describe("friendlyMemberCategoryError", () => {
  it("nombre duplicado → mensaje claro", () => {
    expect(friendlyMemberCategoryError({ code: "P2002" })).toBe(
      "Ya existe una categoría con ese nombre en este workspace.",
    );
  });
});

describe("memberSchema — categoría obligatoria en el form (aunque el dato permita null)", () => {
  it("rechaza sin categoryId", () => {
    const result = memberSchema.safeParse({
      memberNumber: "1",
      categoryId: "",
      firstName: "Ana",
      lastName: "Pérez",
      status: "ACTIVE",
      joinedAt: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("acepta el mínimo obligatorio con categoría", () => {
    const result = memberSchema.safeParse({
      memberNumber: "1",
      categoryId: "cat-1",
      firstName: "Ana",
      lastName: "Pérez",
      status: "ACTIVE",
      joinedAt: "2026-01-01",
    });
    expect(result.success).toBe(true);
  });
});
