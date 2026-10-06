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
    const guarda = pos(CLIENTE, "await requireClientsViewer()");
    expect(pos(CLIENTE, "resolverPersonaPorCliente(")).toBeGreaterThan(guarda);
    expect(pos(CLIENTE, "<Ficha")).toBeGreaterThan(guarda);
    expect(CLIENTE).toContain("notFound()");
  });

  it("no lee `notes`; la lista de Consumo de main queda sólo para quien no ve la historia", () => {
    expect(CLIENTE).not.toMatch(/\.notes\b/);
    // Con "Gestionar" en Clientes los movimientos están en la línea de tiempo (filtro Plata).
    expect(sinComentarios(CLIENTE)).toMatch(/!veHistoria &&\s*hasLevel\(await getModuleLevel\(user\.id, workspace\.id, CASH_MODULE_KEY\), "VIEW"\)/);
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
    // Modelo de main: cobrar exige Gestionar en Cuotas.
    expect(SOCIO).toContain("hasModuleLevel(");
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

describe("notas con sólo Ver", () => {
  const FICHA = leer("components", "ficha", "ficha.tsx");
  const ACCIONES = leer("app", "actions", "ficha.ts");
  it("ninguna acción de la ficha usa el contexto de lectura: escribir sigue exigiendo Gestionar", () => {
    expect(ACCIONES).not.toContain("contextoDeLecturaDeNotas");
    expect(ACCIONES).toContain("contextoDeFicha(");
  });
  it("la rama de sólo lectura muestra las notas sin caja de nota ni línea de tiempo", () => {
    const rama = sinComentarios(FICHA).slice(
      sinComentarios(FICHA).indexOf("if (!ctx) {"),
      sinComentarios(FICHA).indexOf("await asegurarCategorias("),
    );
    expect(rama).toContain("contextoDeLecturaDeNotas(persona)");
    expect(rama).toContain("<NotasSoloLectura");
    expect(rama).not.toContain("<CajaDeNota");
    expect(rama).not.toContain("<LineaDeTiempo");
    expect(rama).not.toContain("<Adjuntos");
  });
});
