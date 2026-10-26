import { describe, expect, it } from "vitest";
import { contarTrabajo, cumpleGrabado, cumpleSubido, trabajoCompleto } from "./cassettes";
import { estadoDeEntrega } from "./entrega";
import {
  esNoDigitalizable, lineaCorreoNoDigitalizables, siguienteCassette, textoClienteNoDigitalizable, textoNoDigitalizable, tipoPorDefecto, validarNoDigitalizable,
} from "./no-digitalizable";

/** Lo que guarda `registrarNoDigitalizable`. */
const noSePudo = (n: number, motivo = "Cinta cortada") => ({
  estado: "COMPLETA", conversionEstado: "SIN_IMAGEN" as string | null, sinImagen: true, motivoFin: "NO_DIGITALIZABLE", tipo: "VHS", cassetteNumero: n, titulo: motivo,
});
const lista = (n: number) => ({ estado: "COMPLETA", conversionEstado: "LISTA" as string | null, sinImagen: false, motivoFin: "MANUAL", tipo: "VHS", cassetteNumero: n, titulo: null as string | null });
const VEINTE = [{ id: "i0", nombre: "Digitalización de VHS", cantidad: 20 }];

describe("validarNoDigitalizable", () => {
  const ok = { proyectoId: "t1", tipo: "VHS", cassetteNumero: 7, motivo: "CORTADA" };
  it("guarda el texto del motivo elegido", () => {
    expect(validarNoDigitalizable(ok)).toEqual({ proyectoId: "t1", tipo: "VHS", cassetteNumero: 7, motivo: "Cinta cortada" });
    expect(validarNoDigitalizable({ ...ok, motivo: "VACIA" })?.motivo).toBe("Cinta vacía (sin grabación)");
    expect(validarNoDigitalizable({ ...ok, motivo: "MOJADA" })?.motivo).toBe("Cinta mojada u hongos");
    expect(validarNoDigitalizable({ ...ok, motivo: "NO_LEE" })?.motivo).toBe("La casetera no la lee");
  });
  it("«Otro» pide el texto y lo recorta", () => {
    expect(validarNoDigitalizable({ ...ok, motivo: "OTRO", otro: "  se   trabó  " })?.motivo).toBe("se trabó");
    expect(validarNoDigitalizable({ ...ok, motivo: "OTRO", otro: " " })).toBeNull();
    expect(validarNoDigitalizable({ ...ok, motivo: "OTRO" })).toBeNull();
    expect(validarNoDigitalizable({ ...ok, motivo: "OTRO", otro: "x".repeat(101) })).toBeNull();
  });
  it("rechaza lo raro", () => {
    expect(validarNoDigitalizable({ ...ok, motivo: "INVENTADO" })).toBeNull();
    expect(validarNoDigitalizable({ ...ok, cassetteNumero: 0 })).toBeNull();
    expect(validarNoDigitalizable({ ...ok, cassetteNumero: 1.5 })).toBeNull();
    expect(validarNoDigitalizable({ ...ok, cassetteNumero: null })).toBeNull(); // un VHS lleva número
    expect(validarNoDigitalizable({ ...ok, tipo: "DVD", cassetteNumero: null })).toMatchObject({ tipo: "DVD", cassetteNumero: null });
    expect(validarNoDigitalizable({ ...ok, tipo: "CD" })).toBeNull();
    expect(validarNoDigitalizable({ ...ok, proyectoId: "../x" })).toBeNull();
    expect(validarNoDigitalizable(null)).toBeNull();
  });
});

describe("textos", () => {
  it("para el equipo, el cliente y el correo", () => {
    expect(textoNoDigitalizable(noSePudo(7))).toBe("Cassette 7 · No se pudo digitalizar: Cinta cortada");
    expect(textoClienteNoDigitalizable(noSePudo(7))).toBe("Cassette 7: no se pudo digitalizar (Cinta cortada)");
    expect(textoNoDigitalizable({ tipo: "DVD", cassetteNumero: null, titulo: "La casetera no la lee" })).toBe("DVD · No se pudo digitalizar: La casetera no la lee");
    expect(lineaCorreoNoDigitalizables([])).toBeNull();
    expect(lineaCorreoNoDigitalizables([noSePudo(7)])).toBe("1 cassette no se pudo digitalizar: Cassette 7 (Cinta cortada).");
    expect(lineaCorreoNoDigitalizables([noSePudo(7), noSePudo(9, "Cinta mojada u hongos")])).toBe(
      "2 cassettes no se pudieron digitalizar: Cassette 7 (Cinta cortada), Cassette 9 (Cinta mojada u hongos).",
    );
  });
  it("sólo el motivoFin NO_DIGITALIZABLE es «no se pudo» (un corte sin imagen común no)", () => {
    expect(esNoDigitalizable(noSePudo(1))).toBe(true);
    expect(esNoDigitalizable({ motivoFin: "SIN_SENAL" })).toBe(false);
    expect(esNoDigitalizable({ motivoFin: null })).toBe(false);
  });
  it("número y tipo por defecto", () => {
    expect(siguienteCassette([1, 3, null, 2])).toBe(4);
    expect(siguienteCassette([])).toBe(1);
    expect(siguienteCassette([999])).toBe(999);
    expect(tipoPorDefecto(["Digitalización de VHS"], [])).toBe("VHS");
    expect(tipoPorDefecto(["Digitalización de DVD"], [])).toBe("DVD");
    expect(tipoPorDefecto(["Digitalización de VHS"], ["DVD", "DVD"])).toBe("DVD");
    expect(tipoPorDefecto(["Pasaje"], ["DVD", "VHS"])).toBe("VHS");
  });
});

describe("cuenta de cassettes con los que no se pudieron", () => {
  const veinte = (grabaciones: { estado: string; conversionEstado: string | null; sinImagen: boolean }[]) => contarTrabajo({ items: VEINTE, pedidoItemIndex: 0, grabaciones });
  const dieciocho = Array.from({ length: 18 }, (_, i) => lista(i + 1));

  it("20 vendidos: 18 listos + 2 que no se pudieron = completo, «Grabado» y «Subido»; la entrega está lista", () => {
    const gs = [...dieciocho, noSePudo(19), noSePudo(20, "Cinta mojada u hongos")];
    const c = veinte(gs);
    expect(c).toMatchObject({ esperados: 20, grabados: 20, hechos: 20, listas: 18, sinTerminar: 0 });
    expect(trabajoCompleto(c)).toBe(true);
    expect(cumpleGrabado(c)).toBe(true);
    expect(cumpleSubido(c)).toBe(true);
    expect(estadoDeEntrega(gs)).toBe("LISTA");
  });
  it("con uno «quitado» (DESCARTADA) vuelve a faltar uno", () => {
    const c = veinte([...dieciocho, noSePudo(19), { ...noSePudo(20), estado: "DESCARTADA", conversionEstado: null }]);
    expect(c).toMatchObject({ esperados: 20, grabados: 19, hechos: 19 });
    expect(trabajoCompleto(c)).toBe(false);
    expect(cumpleGrabado(c)).toBe(false);
    expect(cumpleSubido(c)).toBe(false);
  });
  it("«Subido» espera a que no quede nada convirtiéndose y pide al menos un video", () => {
    expect(cumpleSubido(veinte([...dieciocho, noSePudo(19), { ...lista(20), conversionEstado: "PROCESANDO" }]))).toBe(false);
    const todosNo = contarTrabajo({ items: [{ id: "i0", nombre: "Digitalización de VHS", cantidad: 2 }], pedidoItemIndex: 0, grabaciones: [noSePudo(1), noSePudo(2)] });
    expect(trabajoCompleto(todosNo)).toBe(true);
    expect(cumpleSubido(todosNo)).toBe(false);
    expect(cumpleGrabado(todosNo)).toBe(false);
  });
});
