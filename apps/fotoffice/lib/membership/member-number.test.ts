import { describe, expect, it } from "vitest";
import { nextMemberNumber } from "./member-number";

describe("nextMemberNumber", () => {
  it("sigue al más alto del padrón", () => {
    expect(nextMemberNumber(["731", "732", "733"])).toBe("734");
  });

  it("no depende del orden en que vengan", () => {
    expect(nextMemberNumber(["733", "12", "500"])).toBe("734");
  });

  it("con el padrón vacío arranca en 1", () => {
    expect(nextMemberNumber([])).toBe("1");
  });

  /**
   * El número es de por vida y nunca se reutiliza: aunque el 733 se haya dado de baja,
   * el siguiente es el 734. Reciclar números mezclaría historiales de dos personas.
   */
  it("no reutiliza huecos dejados por bajas", () => {
    expect(nextMemberNumber(["1", "2", "50"])).toBe("51");
  });

  /**
   * El padrón puede tener números con formato propio de la institución. Se ignoran para
   * calcular el siguiente en vez de romper: el alta no puede quedar bloqueada porque
   * alguien cargó "S-12" hace diez años.
   */
  it("ignora números no numéricos en vez de fallar", () => {
    expect(nextMemberNumber(["733", "S-12", "honorario"])).toBe("734");
  });

  it("si ninguno es numérico arranca en 1", () => {
    expect(nextMemberNumber(["S-12", "honorario"])).toBe("1");
  });

  it("ignora espacios alrededor", () => {
    expect(nextMemberNumber(["  733  "])).toBe("734");
  });

  it("no se confunde con ceros a la izquierda", () => {
    expect(nextMemberNumber(["0099", "100"])).toBe("101");
  });

  it("maneja un padrón grande", () => {
    const padron = Array.from({ length: 5000 }, (_, i) => String(i + 1));
    expect(nextMemberNumber(padron)).toBe("5001");
  });
});
