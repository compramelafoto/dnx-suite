import { describe, expect, it } from "vitest";
import { nombreArchivoVideo, nombreCliente } from "./nombre-archivo";

const base = { pedidoNumero: "1234", clienteNombre: "Ana Pérez", titulo: "Casamiento 1998", tipo: "VHS" as const, cassetteNumero: 2 };

describe("nombreCliente", () => {
  it("prefiere la razón social", () => expect(nombreCliente({ businessName: "Foto SA", firstName: "A", lastName: "B" })).toBe("Foto SA"));
  it("arma nombre y apellido", () => expect(nombreCliente({ businessName: null, firstName: "Ana", lastName: "Pérez" })).toBe("Ana Pérez"));
  it("tolera partes faltantes", () => {
    expect(nombreCliente({ businessName: " ", firstName: "Ana", lastName: null })).toBe("Ana");
    expect(nombreCliente({ businessName: null, firstName: null, lastName: null })).toBeNull();
    expect(nombreCliente(null)).toBeNull();
  });
});

describe("nombreArchivoVideo", () => {
  it("arma pedido, cliente y título", () => expect(nombreArchivoVideo(base, "mp4")).toBe("Pedido 1234 - Ana Pérez - Casamiento 1998.mp4"));
  it("sin título usa el cassette o DVD", () => {
    expect(nombreArchivoVideo({ ...base, titulo: null }, "mp4")).toBe("Pedido 1234 - Ana Pérez - Cassette 2.mp4");
    expect(nombreArchivoVideo({ ...base, titulo: " ", tipo: "DVD", cassetteNumero: null }, "vob")).toBe("Pedido 1234 - Ana Pérez - DVD.vob");
    expect(nombreArchivoVideo({ ...base, titulo: null, cassetteNumero: null }, "mp4")).toBe("Pedido 1234 - Ana Pérez - Cassette.mp4");
  });
  it("sin pedido dice Prueba y salta el cliente faltante", () => {
    expect(nombreArchivoVideo({ ...base, pedidoNumero: null, clienteNombre: null }, "mp4")).toBe("Prueba - Casamiento 1998.mp4");
  });
  it("saca caracteres prohibidos y espacios de más", () => {
    expect(nombreArchivoVideo({ ...base, titulo: '  Boda: "Juan/Ana"  <1998>?\u0007 |*\\ x ' }, "mp4")).toBe("Pedido 1234 - Ana Pérez - Boda JuanAna 1998 x.mp4");
  });
  it("limita la base a 150 caracteres y conserva la extensión", () => {
    const n = nombreArchivoVideo({ ...base, titulo: "a".repeat(400) }, "mp4");
    expect(n.endsWith(".mp4")).toBe(true);
    expect(n.length).toBe(154);
  });
});
