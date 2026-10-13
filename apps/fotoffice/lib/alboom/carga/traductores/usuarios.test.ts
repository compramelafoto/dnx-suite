import { describe, expect, it } from "vitest";
import { MOTIVOS } from "../campos";
import { USUARIO, crudo, mapaDe } from "../ejemplos-alboom";
import { TIPO_USUARIO, traducirUsuario, type CtxUsuarios } from "./usuarios";

const ctx = (over: Partial<CtxUsuarios> = {}): CtxUsuarios => ({ miembros: [{ userId: 7, email: "ana@estudio.test" }, { userId: 8, email: null }], mapa: new Map(), ...over });

describe("usuarios → miembros (nunca se crean)", () => {
  it("empareja por correo normalizado y lo vincula", () => {
    const d = traducirUsuario(crudo("usuarios", "1", USUARIO), ctx());
    expect(d).toMatchObject({ accion: "IGUAL", targetId: "7", vincula: true });
  });
  it("sin miembro con ese correo → OMITIR con motivo; sin correo → OMITIR", () => {
    expect(traducirUsuario(crudo("usuarios", "2", { ...USUARIO, email: "otro@estudio.test" }), ctx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.sinMiembro });
    expect(traducirUsuario(crudo("usuarios", "3", { ...USUARIO, email: "" }), ctx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.sinCorreo });
    expect(traducirUsuario(crudo("usuarios", "4", { ...USUARIO, role: "contact" }), ctx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.esContacto });
  });
  it("ya vinculado con el mismo crudo → IGUAL sin escribir; si cambió el crudo, actualiza el mapa", () => {
    const c = crudo("usuarios", "1", USUARIO);
    expect(traducirUsuario(c, ctx({ mapa: new Map([["1", mapaDe(c, TIPO_USUARIO, "7")]]) }))).toEqual({ accion: "IGUAL", targetId: "7", escribirMapa: false });
    const cambiado = crudo("usuarios", "1", { ...USUARIO, lastname: "Gómez Paz" });
    expect(traducirUsuario(cambiado, ctx({ mapa: new Map([["1", mapaDe(c, TIPO_USUARIO, "7")]]) }))).toMatchObject({ accion: "IGUAL", vincula: false });
  });
  it("tolera campos faltantes o con otra forma", () => {
    expect(traducirUsuario(crudo("usuarios", "x", null), ctx()).accion).toBe("OMITIR");
    expect(traducirUsuario(crudo("usuarios", "x", { email: 12 }), ctx()).accion).toBe("OMITIR");
  });
});
