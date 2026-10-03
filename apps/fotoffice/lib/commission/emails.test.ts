import { describe, expect, it } from "vitest";
import { buildAddedToCommissionEmail, buildMemberInactiveWithRoleEmail } from "./emails";

const added = {
  institution: "Sociedad Fotográfica",
  personName: "Ana",
  officeName: "Tesorera" as string | null,
  roleNames: ["Tesorería"],
  hasAccount: true,
  panelUrl: "https://x.test/panel",
  endsAt: null as Date | null,
};
const FORBIDDEN = /workspace|token|membership/i;

describe("buildAddedToCommissionEmail", () => {
  it("el asunto nombra la institución", () => {
    expect(buildAddedToCommissionEmail(added).subject).toContain("Sociedad Fotográfica");
  });
  it("sin cuenta explica que entra al panel al activar su cuenta", () => {
    const r = buildAddedToCommissionEmail({ ...added, hasAccount: false });
    expect(r.text).toMatch(/cuando actives tu cuenta/);
    expect(buildAddedToCommissionEmail(added).text).not.toMatch(/cuando actives tu cuenta/);
  });
  it("con endsAt muestra la fecha argentina", () => {
    const r = buildAddedToCommissionEmail({ ...added, endsAt: new Date("2027-01-01T02:59:59.999Z") });
    expect(r.text).toContain("31/12/2026");
    expect(r.html).toContain("31/12/2026");
  });
  it("escapa HTML en nombres", () => {
    const r = buildAddedToCommissionEmail({ ...added, personName: "<script>x</script>", roleNames: ["<script>"] });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });
  it("incluye cargo, roles y enlace", () => {
    const r = buildAddedToCommissionEmail(added);
    expect(r.text).toContain("Tesorera");
    expect(r.text).toContain("Tesorería");
    expect(r.text).toContain("https://x.test/panel");
  });
  it("sin vocabulario interno", () => {
    for (const h of [true, false]) {
      const r = buildAddedToCommissionEmail({ ...added, hasAccount: h });
      expect(`${r.subject}${r.html}${r.text}`).not.toMatch(FORBIDDEN);
    }
  });
});

describe("buildMemberInactiveWithRoleEmail", () => {
  const inactive = {
    institution: "Sociedad Fotográfica",
    personName: "Ana",
    newStatus: "SUSPENDED" as const,
    officeNames: ["Tesorera"],
    roleNames: ["Tesorería"],
    commissionUrl: "https://x.test/comision",
  };
  it("asunto con institución y persona", () => {
    const r = buildMemberInactiveWithRoleEmail(inactive);
    expect(r.subject).toContain("Sociedad Fotográfica");
    expect(r.text).toContain("Ana");
    expect(r.text).toContain("https://x.test/comision");
  });
  it("distingue suspendido de baja", () => {
    const a = buildMemberInactiveWithRoleEmail(inactive).text;
    const b = buildMemberInactiveWithRoleEmail({ ...inactive, newStatus: "INACTIVE" }).text;
    expect(a).not.toEqual(b);
  });
  it("escapa HTML y evita vocabulario interno", () => {
    const r = buildMemberInactiveWithRoleEmail({ ...inactive, personName: "<script>", officeNames: ["<script>"] });
    expect(r.html).not.toContain("<script>");
    expect(`${r.subject}${r.html}${r.text}`).not.toMatch(FORBIDDEN);
  });
});
