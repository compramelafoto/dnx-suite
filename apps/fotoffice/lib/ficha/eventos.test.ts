import { describe, expect, it } from "vitest";
import { diffCampos } from "./eventos";

describe("diffCampos", () => {
  const campos = ["firstName", "email", "phone", "birthDate"] as const;
  it("sólo lo que cambió", () =>
    expect(diffCampos({ firstName: "Ana", email: "a@x", phone: "1" }, { firstName: "Ana", email: "b@x", phone: "1" }, campos)).toEqual({
      email: { before: "a@x", after: "b@x" },
    }));
  it("vacío y nulo son lo mismo", () => expect(diffCampos({ phone: "" }, { phone: null }, campos)).toEqual({}));
  it("fechas por valor", () =>
    expect(diffCampos({ birthDate: new Date("2000-01-01") }, { birthDate: new Date("2000-01-01") }, campos)).toEqual({}));
  it("ignora campos no listados", () => expect(diffCampos({ secreto: 1 }, { secreto: 2 }, campos)).toEqual({}));
});
