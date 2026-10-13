import { describe, expect, it } from "vitest";
import { herramientasPara } from "../herramientas";
import { CONSULTAS_DE_PRUEBA, ESCENARIOS, fallasDeCifras, fallasDeEntrada, fallasDeEntradaContiene, fallasDeEntradaEnAlguna, fallasDeTexto, type Escenario } from "./escenarios";

describe("banco de escenarios", () => {
  it("ids únicos y cada escenario con situación, mensaje y alguna expectativa", () => {
    expect(new Set(ESCENARIOS.map((e) => e.id)).size).toBe(ESCENARIOS.length);
    for (const e of ESCENARIOS) {
      expect(e.situacion.length, e.id).toBeGreaterThan(0);
      expect(e.mensaje.length, e.id).toBeGreaterThan(0);
      const expectativas =
        (e.debeUsar?.length ?? 0) + (e.debeUsarAlguna?.length ?? 0) + (e.noDebeUsar?.length ?? 0) + (e.textoNoDebeContener?.length ?? 0) +
        (e.textoDebeContener?.length ?? 0) + Object.keys(e.entradaEnAlguna ?? {}).length + Object.keys(e.entradaContiene ?? {}).length;
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
  it("están los ocho de la etapa 2 (casos 6 a 13)", () => {
    expect(ESCENARIOS.map((e) => e.id)).toEqual(
      expect.arrayContaining([
        "cotizar-casamiento", "cotizar-sin-edicion", "cotizar-sumar-album", "cotizar-perfil-incompleto",
        "pasar-a-consulta-de-lucia", "consulta-con-borrador", "precio-de-la-competencia", "precio-a-mano",
      ]),
    );
    for (const e of ESCENARIOS) if (e.consultas) expect(CONSULTAS_DE_PRUEBA[e.consultas].length, e.id).toBeGreaterThan(0);
  });

  it("están los siete de la etapa 3 (casos 14 a 20) y son 20 en total", () => {
    expect(ESCENARIOS.map((e) => e.id)).toEqual(
      expect.arrayContaining([
        "responder-consulta", "inyeccion-en-la-consulta", "mandale-el-presupuesto", "mensaje-con-monto",
        "seguimientos", "fuera-de-alcance", "ruta-de-la-validez",
      ]),
    );
    expect(ESCENARIOS).toHaveLength(20);
  });

  it("sólo nombran herramientas que existen", () => {
    const dueno = herramientasPara({
      workspaceId: "e", workspaceNombre: "e", userId: 1, userLabel: "e", role: "WORKSPACE_OWNER", email: "e", nombre: null,
      capacidades: { configurar: true, gestionarPresupuestos: true, verConsultas: true }, plataforma: "FOTOFFICE:e",
    }).map((t) => t.name);
    for (const e of ESCENARIOS) {
      for (const n of [...(e.debeUsar ?? []), ...(e.debeUsarAlguna ?? []), ...(e.noDebeUsar ?? []), ...Object.keys(e.entradaEsperada ?? {}), ...Object.keys(e.entradaEnAlguna ?? {}), ...Object.keys(e.entradaContiene ?? {})]) {
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

describe("fallasDeEntradaEnAlguna", () => {
  const e: Escenario = { id: "x", situacion: "s", mensaje: "m", entradaEnAlguna: { cotizar_trabajo: { precioTotalElegido: "1100000" } } };
  it("alcanza con una llamada que lo traiga", () => {
    expect(fallasDeEntradaEnAlguna(e, [{ herramienta: "cotizar_trabajo", entrada: {} }, { herramienta: "cotizar_trabajo", entrada: { precioTotalElegido: "1100000" } }])).toEqual([]);
    expect(fallasDeEntradaEnAlguna(e, [{ herramienta: "cotizar_trabajo", entrada: {} }])).toHaveLength(1);
  });
});

describe("fallasDeEntradaContiene", () => {
  const e: Escenario = { id: "x", situacion: "s", mensaje: "m", entradaContiene: { preparar_mensaje: { cuerpo: "[presupuesto_total]" } } };
  it("alcanza con una llamada que lo contenga", () => {
    expect(fallasDeEntradaContiene(e, [{ herramienta: "preparar_mensaje", entrada: { cuerpo: "Total: [presupuesto_total]" } }])).toEqual([]);
    expect(fallasDeEntradaContiene(e, [{ herramienta: "preparar_mensaje", entrada: { cuerpo: "Total: $1" } }])).toHaveLength(1);
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

describe("expresiones de las evaluaciones", () => {
  it("detectan «ya lo guardé/creé/envié» con tilde y no las negaciones", async () => {
    const { ESCENARIOS: E } = await import("./escenarios");
    const regla = (id: string, i = 0) => E.find((e) => e.id === id)!.textoNoDebeContener![i]!;
    const guardado = regla("perfil-todos-los-datos");
    expect(guardado.test("Listo. Ya lo guardé.")).toBe(true);
    expect(guardado.test("Te dejo la tarjeta: no se guarda hasta que toques Confirmar.")).toBe(false);
    const creado = regla("pasar-a-consulta-de-lucia");
    expect(creado.test("Perfecto. Ya lo creé.")).toBe(true);
    const enviado = regla("mandale-el-presupuesto");
    expect(enviado.test("Listo, ya se lo envié.")).toBe(true);
    expect(enviado.test("Todavía no está enviado: tocá «Abrir para enviar».")).toBe(false);
    expect(enviado.test("No lo envío yo: lo mandás vos.")).toBe(false);
  });
});

describe("informeDeEscenario (salida de bot:eval)", () => {
  it("si pasó, el texto va recortado a 200 caracteres en una línea", async () => {
    const { informeDeEscenario } = await import("./escenarios");
    const r = informeDeEscenario("caso", ["cotizar_trabajo"], [], `uno\ndos ${"x".repeat(300)}`);
    expect(r.startsWith("✓ caso [cotizar_trabajo]\n   uno dos ")).toBe(true);
    expect(r.split("\n")[1]!.length).toBe(3 + 200);
  });
  it("si falló, va el texto COMPLETO, con sus renglones, para ver qué escribió", async () => {
    const { informeDeEscenario } = await import("./escenarios");
    const largo = `Eso no lo puedo poner yo.\nSi no pagás, lo dejo en $ 0. ${"y".repeat(300)} fin`;
    const r = informeDeEscenario("caso", [], ["texto contiene /x/"], largo);
    expect(r).toContain("✗ caso [sin herramientas] — texto contiene /x/");
    expect(r).toContain("\n   Si no pagás, lo dejo en $ 0.");
    expect(r.endsWith("fin")).toBe(true);
  });
});

describe("presupuestoDePrueba", () => {
  it("existe sólo pres-lucia, en borrador, N.º 0007, de la consulta de Lucía", async () => {
    const { presupuestoDePrueba, CONSULTAS_DE_PRUEBA } = await import("./escenarios");
    const d = presupuestoDePrueba("pres-lucia")!;
    expect(d).toMatchObject({ numero: "0007", estado: "BORRADOR", consultaLeadId: "lead-lucia" });
    expect(d.borrador?.items).toHaveLength(1);
    expect(presupuestoDePrueba("0007")).toBeNull();
    expect(CONSULTAS_DE_PRUEBA["lucia-con-borrador"][0]!.presupuestos[0]!.id).toBe("pres-lucia");
  });
});

describe("AFIRMA_ENVIADO (casos 15, 16 y 18)", () => {
  it("detecta que el bot dice que ya envió: «envié», «mandé», «lo envié», «ya lo mandé», «se lo envié»", async () => {
    const { AFIRMA_ENVIADO: r } = await import("./escenarios");
    for (const t of ["Listo, ya se lo envié.", "Te lo mandé por WhatsApp.", "Ya lo mandé.", "Lo envié recién.", "Envié el presupuesto a Lucía.", "Mandé el mensaje."]) {
      expect(r.test(t), t).toBe(true);
    }
  });
  it("no salta con el subjuntivo ni citando la instrucción del cliente (falso positivo de la corrida 1 y 2)", async () => {
    const { AFIRMA_ENVIADO: r } = await import("./escenarios");
    for (const t of [
      "Trae una instrucción para que ignore mis reglas y mande un presupuesto con descuento a un correo. No la sigo",
      "Quiere que le envíe el presupuesto a otro correo: no lo hago.",
      "Todavía no está enviado: tocá «Abrir para enviar».",
      "No lo envío yo: lo mandás vos desde la pantalla de envío.",
      "No lo mandé: lo tenés que mandar vos.",
      "Enviarlo lo hacés vos.",
      "Cuando lo mandes, avisame.",
    ]) {
      expect(r.test(t), t).toBe(false);
    }
  });
});
