import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente: las fichas de Cliente y Socio usan la ficha estándar sin perder guardas. */
const RAIZ = join(__dirname, "..", "..");
const sinComentarios = (f: string) => f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");

const CLIENTE = leer("app", "(shell)", "clientes", "[clientId]", "page.tsx");
const SOCIO = leer("app", "(shell)", "members", "[id]", "page.tsx");
const FORM_CLIENTE = leer("app", "(shell)", "clientes", "client-form.tsx");
const FORM_SOCIO = leer("components", "members", "member-form.tsx");

/** Posición de la primera aparición en el código (sin comentarios); falla si no está. */
function pos(fuente: string, texto: string): number {
  const i = sinComentarios(fuente).indexOf(texto);
  expect(i, `falta "${texto}"`).toBeGreaterThanOrEqual(0);
  return i;
}

describe("ficha de Cliente", () => {
  it("usa <Ficha> y resuelve la persona después del guarda", () => {
    const guarda = pos(CLIENTE, "await requireClientsStaff()");
    expect(pos(CLIENTE, "resolverPersonaPorCliente(")).toBeGreaterThan(guarda);
    expect(pos(CLIENTE, "<Ficha")).toBeGreaterThan(guarda);
    expect(CLIENTE).toContain("notFound()");
  });

  it("no lee `notes` ni muestra la lista de Consumo (ahora es la línea de tiempo)", () => {
    expect(CLIENTE).not.toMatch(/\.notes\b/);
    expect(CLIENTE).not.toContain("MovementsTable");
    expect(CLIENTE).not.toContain("listMovements");
  });

  it("conserva el formulario, el enlace con el socio y los avisos", () => {
    expect(CLIENTE).toContain("<ClientForm");
    expect(CLIENTE).toContain("linkClientToMemberAction");
    expect(CLIENTE).toContain("¿Es socio?");
    expect(CLIENTE).toContain("query.ok");
    expect(CLIENTE).toContain("query.error");
    expect(CLIENTE).toContain("`/members/${");
  });
});

describe("ficha de Socio", () => {
  it("usa <Ficha> y resuelve la persona después del guarda", () => {
    const guarda = pos(SOCIO, "await requireMembersContext()");
    expect(pos(SOCIO, "resolverPersonaPorSocio(")).toBeGreaterThan(guarda);
    expect(pos(SOCIO, "<Ficha")).toBeGreaterThan(guarda);
    expect(SOCIO).toContain("notFound()");
  });

  it("sin Observaciones ni historial viejo: eso está en notas y en la línea de tiempo", () => {
    expect(SOCIO).not.toMatch(/\.notes\b/);
    expect(SOCIO).not.toContain("MemberAuditLog");
    expect(SOCIO).not.toContain("listMemberAudits");
  });

  it("los permisos de hoy siguen decidiendo tarjetas y botones", () => {
    expect(SOCIO).toContain("canOperateWorkspaceCollection(");
    expect(SOCIO).toMatch(/canManage \?/);
    for (const pieza of [
      "MemberStatusChanger",
      "MemberAccessPanel",
      "ManualPaymentForm",
      "PaymentHistoryList",
      "RecommendationVoidForm",
      "`/members/${member.id}/edit`",
      "loadPersonVocabulary",
    ]) {
      expect(SOCIO).toContain(pieza);
    }
  });
});

describe("formularios de alta y edición", () => {
  it("no muestran ni mandan `notes`", () => {
    expect(FORM_CLIENTE).not.toContain('name="notes"');
    expect(FORM_SOCIO).not.toContain('name="notes"');
    expect(FORM_CLIENTE).not.toMatch(/\.notes\b/);
    expect(FORM_SOCIO).not.toMatch(/\.notes\b/);
  });
});
