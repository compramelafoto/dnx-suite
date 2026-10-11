import { describe, expect, it } from "vitest";
import {
  esperaRevision, estadoDespues, estadosDesde, mensajeMaximo, mensajeMinimo, progresoSeleccion, puedeAgregar, puedeEditarElCliente,
  transicionar, validarComentario, validarConfigSeleccion, validarEnvio, type ConfigSeleccion,
} from "./seleccion";
import { ESTADOS_CLIENTE } from "./constantes";

const libre: ConfigSeleccion = { selectionMode: "LIBRE", minSelect: null, maxSelect: null };
const cant = (minSelect: number | null, maxSelect: number | null): ConfigSeleccion => ({ selectionMode: "CANTIDAD", minSelect, maxSelect });

describe("configuración de la selección (misma regla que el CHECK del SQL)", () => {
  it("libre no lleva límites", () => {
    expect(validarConfigSeleccion(libre)).toEqual({ ok: true });
    expect(validarConfigSeleccion({ ...libre, minSelect: 1 }).ok).toBe(false);
    expect(validarConfigSeleccion({ ...libre, maxSelect: 5 }).ok).toBe(false);
  });

  it("por cantidad necesita al menos un límite entero >= 1 y mínimo <= máximo", () => {
    expect(validarConfigSeleccion(cant(20, null))).toEqual({ ok: true });
    expect(validarConfigSeleccion(cant(null, 40))).toEqual({ ok: true });
    expect(validarConfigSeleccion(cant(20, 20))).toEqual({ ok: true });
    expect(validarConfigSeleccion(cant(null, null)).ok).toBe(false);
    expect(validarConfigSeleccion(cant(0, 10)).ok).toBe(false);
    expect(validarConfigSeleccion(cant(1.5, 10)).ok).toBe(false);
    expect(validarConfigSeleccion(cant(30, 20)).ok).toBe(false);
    expect(validarConfigSeleccion({ selectionMode: "OTRO" as never, minSelect: null, maxSelect: null }).ok).toBe(false);
  });
});

describe("validarEnvio", () => {
  it("nunca deja enviar vacío", () => {
    expect(validarEnvio(libre, 0)).toMatchObject({ ok: false, motivo: "SIN_FOTOS" });
    expect(validarEnvio(cant(null, 10), 0)).toMatchObject({ ok: false, motivo: "SIN_FOTOS" });
    expect(validarEnvio(libre, -1).ok).toBe(false);
    expect(validarEnvio(libre, 1.5).ok).toBe(false);
  });

  it("libre acepta cualquier cantidad desde una", () => {
    expect(validarEnvio(libre, 1)).toEqual({ ok: true });
    expect(validarEnvio(libre, 3000)).toEqual({ ok: true });
  });

  it("por cantidad valida el mínimo y el máximo, inclusive", () => {
    const c = cant(20, 30);
    expect(validarEnvio(c, 19)).toMatchObject({ ok: false, motivo: "MINIMO", error: "Tenés que elegir al menos 20 fotos: te falta 1." });
    expect(validarEnvio(c, 20)).toEqual({ ok: true });
    expect(validarEnvio(c, 30)).toEqual({ ok: true });
    expect(validarEnvio(c, 32)).toMatchObject({ ok: false, motivo: "MAXIMO", error: "Podés elegir hasta 30 fotos: te sobran 2." });
  });

  it("sólo mínimo o sólo máximo", () => {
    expect(validarEnvio(cant(5, null), 4).ok).toBe(false);
    expect(validarEnvio(cant(5, null), 500).ok).toBe(true);
    expect(validarEnvio(cant(null, 5), 6).ok).toBe(false);
    expect(validarEnvio(cant(null, 5), 1).ok).toBe(true);
  });

  it("singular y plural en los mensajes", () => {
    expect(mensajeMinimo(1, 0)).toBe("Tenés que elegir al menos 1 foto: te falta 1.");
    expect(mensajeMinimo(10, 7)).toBe("Tenés que elegir al menos 10 fotos: te faltan 3.");
    expect(mensajeMaximo(1, 2)).toBe("Podés elegir hasta 1 foto: te sobra 1.");
  });
});

describe("puedeAgregar y progreso", () => {
  it("sólo frena el máximo de por cantidad", () => {
    expect(puedeAgregar(libre, 5000).ok).toBe(true);
    expect(puedeAgregar(cant(5, null), 100).ok).toBe(true);
    expect(puedeAgregar(cant(null, 3), 2).ok).toBe(true);
    expect(puedeAgregar(cant(null, 3), 3).ok).toBe(false);
    expect(puedeAgregar(cant(null, 3), 1, 3).ok).toBe(false);
  });

  it("el contador muestra 'n de máx' y avisa mínimo y tope", () => {
    expect(progresoSeleccion(libre, 12)).toEqual({ texto: "12", cumpleMinimo: true, llegoAlMaximo: false });
    expect(progresoSeleccion(cant(20, 30), 12)).toEqual({ texto: "12 de 30", cumpleMinimo: false, llegoAlMaximo: false });
    expect(progresoSeleccion(cant(20, 30), 30)).toEqual({ texto: "30 de 30", cumpleMinimo: true, llegoAlMaximo: true });
  });
});

describe("estado de cada cliente", () => {
  it("enviar: sólo EN_PROGRESO → EN_REVISION", () => {
    expect(transicionar("EN_PROGRESO", "ENVIAR")).toBe("EN_REVISION");
    expect(transicionar("EN_REVISION", "ENVIAR")).toBeNull();
    expect(transicionar("FINALIZADO", "ENVIAR")).toBeNull();
  });

  it("finalizar: sólo EN_REVISION → FINALIZADO", () => {
    expect(transicionar("EN_REVISION", "FINALIZAR")).toBe("FINALIZADO");
    expect(transicionar("EN_PROGRESO", "FINALIZAR")).toBeNull();
    expect(transicionar("FINALIZADO", "FINALIZAR")).toBeNull();
  });

  it("reactivar: desde EN_REVISION o FINALIZADO vuelve a EN_PROGRESO", () => {
    expect(transicionar("EN_REVISION", "REACTIVAR")).toBe("EN_PROGRESO");
    expect(transicionar("FINALIZADO", "REACTIVAR")).toBe("EN_PROGRESO");
    expect(transicionar("EN_PROGRESO", "REACTIVAR")).toBeNull();
  });

  it("estadosDesde y estadoDespues coinciden con transicionar", () => {
    for (const accion of ["ENVIAR", "FINALIZAR", "REACTIVAR"] as const) {
      for (const e of ESTADOS_CLIENTE) {
        expect(estadosDesde(accion).includes(e)).toBe(transicionar(e, accion) !== null);
        if (transicionar(e, accion)) expect(transicionar(e, accion)).toBe(estadoDespues(accion));
      }
    }
  });

  it("el cliente sólo edita en EN_PROGRESO", () => {
    expect(puedeEditarElCliente("EN_PROGRESO")).toBe(true);
    expect(puedeEditarElCliente("EN_REVISION")).toBe(false);
    expect(puedeEditarElCliente("FINALIZADO")).toBe(false);
    expect(esperaRevision("EN_REVISION")).toBe(true);
    expect(esperaRevision("EN_PROGRESO")).toBe(false);
  });
});

describe("comentarios", () => {
  it("recorta y normaliza", () => {
    expect(validarComentario("  hola\r\nmundo  ")).toEqual({ ok: true, texto: "hola\nmundo" });
  });

  it("rechaza vacío, sólo espacios y no-texto", () => {
    for (const malo of ["", "   \n ", null, undefined, 5]) expect(validarComentario(malo).ok, String(malo)).toBe(false);
  });

  it("acepta 2000 y rechaza 2001", () => {
    expect(validarComentario("a".repeat(2000)).ok).toBe(true);
    expect(validarComentario("a".repeat(2001)).ok).toBe(false);
  });
});
