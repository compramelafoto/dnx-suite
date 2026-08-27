import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Role } from "@prisma/client";
import {
  requireTemplateV2ReadAccess,
  requireTemplateV2WriteAccess,
} from "../services/template-v2-authorization";
import { TemplateV2DomainError } from "../services/template-v2-errors";

const owner = { id: 10, role: Role.PHOTOGRAPHER };
const other = { id: 11, role: Role.PHOTOGRAPHER };
const admin = { id: 1, role: Role.ADMIN };
const template = { id: "t1", ownerUserId: 10, status: "DRAFT" };

describe("template-v2 authorization", () => {
  it("rechaza sin sesión", () => {
    assert.throws(
      () => requireTemplateV2ReadAccess({ user: null, template }),
      (e: unknown) => e instanceof TemplateV2DomainError && e.code === "TEMPLATE_UNAUTHORIZED"
    );
  });

  it("propietario puede leer y escribir", () => {
    assert.equal(requireTemplateV2ReadAccess({ user: owner, template }).id, "t1");
    assert.equal(requireTemplateV2WriteAccess({ user: owner, template }).id, "t1");
  });

  it("ajeno no ve plantilla privada (not found)", () => {
    assert.throws(
      () =>
        requireTemplateV2ReadAccess({
          user: other,
          template,
          publication: { visibility: "PRIVATE", reviewStatus: "DRAFT" },
        }),
      (e: unknown) => e instanceof TemplateV2DomainError && e.code === "TEMPLATE_NOT_FOUND"
    );
  });

  it("ajeno puede leer catálogo público aprobado", () => {
    const row = requireTemplateV2ReadAccess({
      user: other,
      template,
      publication: { visibility: "PUBLIC", reviewStatus: "APPROVED" },
    });
    assert.equal(row.id, "t1");
  });

  it("ajeno no puede escribir aunque sea pública", () => {
    assert.throws(
      () => requireTemplateV2WriteAccess({ user: other, template }),
      (e: unknown) => e instanceof TemplateV2DomainError && e.code === "TEMPLATE_NOT_FOUND"
    );
  });

  it("admin puede escribir", () => {
    assert.equal(requireTemplateV2WriteAccess({ user: admin, template }).id, "t1");
  });

  it("template null → not found", () => {
    assert.throws(
      () => requireTemplateV2ReadAccess({ user: owner, template: null }),
      (e: unknown) => e instanceof TemplateV2DomainError && e.code === "TEMPLATE_NOT_FOUND"
    );
  });
});
