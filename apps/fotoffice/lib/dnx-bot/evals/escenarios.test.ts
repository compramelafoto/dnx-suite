import { describe, expect, it } from "vitest";
import { herramientasPara } from "../herramientas";
import { ESCENARIOS, fallasDeCifras, fallasDeEntrada, fallasDeTexto, type Escenario } from "./escenarios";

describe("banco de escenarios", () => {
  it("ids únicos y cada escenario con situación, mensaje y alguna expectativa", () => {
    expect(new Set(ESCENARIOS.map((e) => e.id)).size).toBe(ESCENARIOS.length);
    for (const e of ESCENARIOS) {
      expect(e.situacion.length, e.id).toBeGreaterThan(0);
      expect(e.mensaje.length, e.id).toBeGreaterThan(0);
      const expectativas =
        (e.debeUsar?.length ?? 0) + (e.debeUsarAlguna?.length ?? 0) + (e.noDebeUsar?.length ?? 0) + (e.textoNoDebeContener?.length ?? 0);
      expect(expectativas, e.id).toBeGreaterThan(0);
    }
  });
});

describe("etapa 1 (casos 1 a 5 del spec)", () => {
  it("están los cinco", () => {
    expect(ESCENARIOS.map((e) => e.id)).toEqual(
      expect.arrayContaining(["perfil-vacio-una-pregunta", "perfil-lo-normal", "perfil-horas-no-suman", "perfil-todos-los-datos", "perfil-staff-sin-configurar"]),
    );
  });
  it("sólo nombran herramientas que existen", () => {
    const dueno = herramientasPara({
      workspaceId: "e", workspaceNombre: "e", userId: 1, userLabel: "e", role: "WORKSPACE_OWNER", email: "e", nombre: null,
      capacidades: { configurar: true, gestionarPresupuestos: true, verConsultas: true }, plataforma: "FOTOFFICE:e",
    }).map((t) => t.name);
    for (const e of ESCENARIOS) {
      for (const n of [...(e.debeUsar ?? []), ...(e.debeUsarAlguna ?? []), ...(e.noDebeUsar ?? []), ...Object.keys(e.entradaEsperada ?? {})]) {
        expect(dueno, `${e.id}: ${n}`).toContain(n);
      }
    }
  });
});

describe("fallasDeTexto y fallasDeCifras", () => {
  const e: Escenario = { id: "x", situacion: "s", mensaje: "gano 600000", textoNoDebeContener: [/guardado/i], textoDebeContener: [/15/], cifrasPermitidas: ["$1000"] };
  it("texto: lo prohibido y lo que falta", () => {
    expect(fallasDeTexto(e, "Listo, guardado.")).toEqual(["texto contiene /guardado/i", "texto no contiene /15/"]);
    expect(fallasDeTexto(e, "Faltan 15 horas.")).toEqual([]);
  });
  it("cifras: sólo valen las del mensaje, las de las herramientas y las permitidas", () => {
    expect(fallasDeCifras(e, "Anoto $600.000 y $1.000; tu valor hora $31.250.", ['{"valorHora":"$ 31.250"}'])).toEqual([]);
    expect(fallasDeCifras(e, "La mayoría paga $50.000.", [])).toEqual(["cifra no respaldada: $50000"]);
  });
});

describe("fallasDeEntrada", () => {
  const e: Escenario = { id: "x", situacion: "s", mensaje: "m", entradaEsperada: { cotizar_trabajo: { tipoDeTrabajo: "boda" } } };
  it("pasa si toda llamada trae el valor; falla si alguna no", () => {
    expect(fallasDeEntrada(e, [{ herramienta: "cotizar_trabajo", entrada: { tipoDeTrabajo: "boda" } }])).toEqual([]);
    expect(fallasDeEntrada(e, [{ herramienta: "cotizar_trabajo", entrada: { tipoDeTrabajo: "quince" } }])).toEqual([
      'cotizar_trabajo con tipoDeTrabajo="quince" (se esperaba "boda")',
    ]);
  });
  it("ignora otras herramientas", () => {
    expect(fallasDeEntrada(e, [{ herramienta: "ver_perfil_de_precios", entrada: {} }])).toEqual([]);
  });
});
