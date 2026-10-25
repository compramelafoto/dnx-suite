import { describe, expect, it } from "vitest";
import { buildAudience, chunk, normalizeEmail } from "./audience";

describe("destinatarios", () => {
  const socios = [
    { id: "1", email: "Ana@Mail.com", firstName: "Ana" },
    { id: "2", email: "ana@mail.com ", firstName: "Ana bis" },
    { id: "3", email: null, firstName: "Sin correo" },
    { id: "4", email: "no-es-correo", firstName: "Mal" },
    { id: "5", email: "beto@mail.com", firstName: " " },
    { id: "6", email: "caro@mail.com", firstName: "Caro" },
    { id: "7", email: "dani@mail.com", firstName: "Dani" },
  ];

  it("una vez por casilla, sin vacíos ni inválidos", () => {
    const { recipients, optedOut } = buildAudience(socios, [], "blog");
    expect(recipients.map((r) => r.email)).toEqual(["ana@mail.com", "beto@mail.com", "caro@mail.com", "dani@mail.com"]);
    expect(recipients[1].firstName).toBeNull();
    expect(optedOut).toBe(0);
  });

  it("respeta la baja del tema y la baja total, no la de otro tema", () => {
    const { recipients, optedOut } = buildAudience(
      socios,
      [
        { email: "beto@mail.com", topic: "blog" },
        { email: "CARO@mail.com", topic: "all" },
        { email: "dani@mail.com", topic: "efemerides" },
      ],
      "blog",
    );
    expect(recipients.map((r) => r.email)).toEqual(["ana@mail.com", "dani@mail.com"]);
    expect(optedOut).toBe(2);
  });

  it("normaliza y trocea", () => {
    expect(normalizeEmail("  X@Y.COM ")).toBe("x@y.com");
    expect(normalizeEmail("x@y")).toBeNull();
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
