import { describe, expect, it } from "vitest";
import { campaniaInicial, DNXBOT_PENDIENTE_KEY, DNXBOT_PENDIENTE_TTL_MS, olvidarCampaniaPendiente, type AlmacenSimple } from "./globito";

function almacen(inicial: Record<string, string> = {}): AlmacenSimple & { datos: Record<string, string> } {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k) => (k in datos ? datos[k]! : null),
    setItem: (k, v) => { datos[k] = v; },
    removeItem: (k) => { delete datos[k]; },
  };
}
const roto: AlmacenSimple = {
  getItem: () => { throw new Error("bloqueado"); },
  setItem: () => { throw new Error("bloqueado"); },
  removeItem: () => { throw new Error("bloqueado"); },
};

describe("campaña pendiente del mail (?dnxbot= que sobrevive al login)", () => {
  it("con ?dnxbot= válido la devuelve y la guarda", () => {
    const a = almacen();
    expect(campaniaInicial("?dnxbot=sin_ventas", a, 1000)).toBe("sin_ventas");
    expect(JSON.parse(a.datos[DNXBOT_PENDIENTE_KEY]!)).toEqual({ c: "sin_ventas", t: 1000 });
  });
  it("sin parámetro usa la guardada (vuelta del login) y no la borra hasta abrir la ventana", () => {
    const a = almacen();
    campaniaInicial("?dnxbot=sin_escolar", a, 1000);
    expect(campaniaInicial("", a, 5000)).toBe("sin_escolar");
    expect(a.datos[DNXBOT_PENDIENTE_KEY]).toBeDefined();
    olvidarCampaniaPendiente(a);
    expect(campaniaInicial("", a, 6000)).toBeNull();
  });
  it("la guardada vencida o inválida no cuenta y se limpia", () => {
    const a = almacen({ [DNXBOT_PENDIENTE_KEY]: JSON.stringify({ c: "sin_ventas", t: 0 }) });
    expect(campaniaInicial("", a, DNXBOT_PENDIENTE_TTL_MS + 1)).toBeNull();
    expect(a.datos[DNXBOT_PENDIENTE_KEY]).toBeUndefined();
    const b = almacen({ [DNXBOT_PENDIENTE_KEY]: JSON.stringify({ c: "<script>", t: 10 }) });
    expect(campaniaInicial("", b, 20)).toBeNull();
    const c = almacen({ [DNXBOT_PENDIENTE_KEY]: "no es json" });
    expect(campaniaInicial("", c, 20)).toBeNull();
  });
  it("parámetro inválido no se guarda", () => {
    const a = almacen();
    expect(campaniaInicial("?dnxbot=ABC!", a, 1)).toBeNull();
    expect(a.datos).toEqual({});
  });
  it("sin sessionStorage (null o que tira) igual funciona con la URL y nunca tira", () => {
    expect(campaniaInicial("?dnxbot=sin_ventas", null, 1)).toBe("sin_ventas");
    expect(campaniaInicial("?dnxbot=sin_ventas", roto, 1)).toBe("sin_ventas");
    expect(campaniaInicial("", roto, 1)).toBeNull();
    expect(() => olvidarCampaniaPendiente(roto)).not.toThrow();
  });
});
