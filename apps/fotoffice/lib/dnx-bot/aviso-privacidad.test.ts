import { describe, expect, it } from "vitest";
import { AVISO_PRIVACIDAD, AVISO_PRIVACIDAD_ARMAR, avisoDePrivacidad, ENLACE_DATOS } from "./aviso-privacidad";

const PERFIL_INCOMPLETO = { ok: true as const, message: "", data: { estado: "PERFIL_INCOMPLETO", faltan: ["x"] } };
const OK = { ok: true as const, message: "", data: {} };
const base = { historial: [] as unknown[], pantalla: "otra" as const, textoUsuario: "hola" };

describe("textos (los eligió Daniel, van tal cual)", () => {
  it("el aviso y su versión para armar el perfil", () => {
    expect(AVISO_PRIVACIDAD).toBe(
      "Tus números son tuyos: quedan guardados en tu estudio dentro de FOTOFFICE, no los ven otros fotógrafos ni tus clientes, y sólo los uso para calcular cuánto tenés que cobrar.",
    );
    expect(AVISO_PRIVACIDAD_ARMAR).toBe(`Dale, armémoslo juntos. ${AVISO_PRIVACIDAD}`);
    expect(ENLACE_DATOS).toEqual({ etiqueta: "Cómo cuidamos tus datos", ruta: "/ayuda/dnx-bot-datos" });
  });
});

describe("avisoDePrivacidad", () => {
  it("al armar el perfil (pantalla Precios o lo pidió): «Dale, armémoslo juntos.» + el aviso + el enlace", () => {
    expect(avisoDePrivacidad({ ...base, pantalla: "precios", herramienta: "ver_perfil_de_precios", resultado: OK })).toEqual({
      texto: AVISO_PRIVACIDAD_ARMAR,
      enlace: ENLACE_DATOS,
    });
    expect(avisoDePrivacidad({ ...base, textoUsuario: "Quiero armar mi perfil de precios conversando.", herramienta: "simular_perfil", resultado: OK })!.texto).toBe(
      AVISO_PRIVACIDAD_ARMAR,
    );
  });
  it("en otro contexto del perfil (ver el valor hora) o al cotizar sin perfil completo: desde «Tus números son tuyos…»", () => {
    expect(avisoDePrivacidad({ ...base, textoUsuario: "¿cuánto me da la hora?", herramienta: "ver_perfil_de_precios", resultado: OK })!.texto).toBe(AVISO_PRIVACIDAD);
    expect(avisoDePrivacidad({ ...base, herramienta: "cotizar_trabajo", resultado: PERFIL_INCOMPLETO })!.texto).toBe(AVISO_PRIVACIDAD);
  });
  it("nada con otras herramientas, ni al cotizar con el perfil completo", () => {
    expect(avisoDePrivacidad({ ...base, herramienta: "cotizar_trabajo", resultado: { ok: true, message: "", data: { estado: "OK" } } })).toBeNull();
    expect(avisoDePrivacidad({ ...base, herramienta: "ver_presupuesto", resultado: OK })).toBeNull();
  });
  it("una sola vez por conversación: si en el historial ya se habló del perfil, no se repite", () => {
    const historial = [
      { role: "user", content: "armemos el perfil" },
      { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "ver_perfil_de_precios", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "{}" }] },
    ];
    expect(avisoDePrivacidad({ ...base, historial, pantalla: "precios", herramienta: "simular_perfil", resultado: OK })).toBeNull();
    const conCotizacionIncompleta = [
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t2", content: JSON.stringify({ ok: true, data: { estado: "PERFIL_INCOMPLETO" } }) }] },
    ];
    expect(avisoDePrivacidad({ ...base, historial: conCotizacionIncompleta, herramienta: "ver_perfil_de_precios", resultado: OK })).toBeNull();
  });
});
