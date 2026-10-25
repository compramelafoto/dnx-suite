import { describe, expect, it } from "vitest";
import { claveEtiqueta, clave, correo, esDatoDePrueba, fecha, importe, partirEtiquetas, siNo, telefonoAr, texto } from "./normalizar";

describe("normalización de los datos de Alboom", () => {
  it("correo: minúsculas, sin espacios; lo que no es correo no se guarda", () => {
    expect(correo(" Ana.Gomez@Correo.TEST ")).toEqual({ valor: "ana.gomez@correo.test", invalido: false });
    expect(correo("ana @ correo.test")).toEqual({ valor: "ana@correo.test", invalido: false });
    expect(correo("ana@correo")).toEqual({ valor: null, invalido: true });
    expect(correo("")).toEqual({ valor: null, invalido: false });
    expect(correo(null)).toEqual({ valor: null, invalido: false });
  });

  it("teléfono: dígitos con 54 (y 9 en el celular), sin 0 ni 15; los raros se guardan tal cual con duda", () => {
    expect(telefonoAr("341 15 555-1234", true)).toEqual({ valor: "5493415551234", nacional: "3415551234", raro: false });
    expect(telefonoAr("(0341) 155-551234", true).nacional).toBe("3415551234");
    expect(telefonoAr("+54 9 341 555 1234", false)).toEqual({ valor: "543415551234", nacional: "3415551234", raro: false });
    expect(telefonoAr("3410000000", false)).toEqual({ valor: "543410000000", nacional: "3410000000", raro: false });
    expect(telefonoAr("011 4123-4567", false).nacional).toBe("1141234567");
    expect(telefonoAr("+55 11 98765-4321", true)).toEqual({ valor: "5511987654321", nacional: null, raro: true });
    expect(telefonoAr("123", false)).toEqual({ valor: null, nacional: null, raro: true });
    expect(telefonoAr("", true)).toEqual({ valor: null, nacional: null, raro: false });
    expect(telefonoAr(3415551234, false).nacional).toBe("3415551234");
  });

  it("importes en pesos con dos decimales, en los formatos que aparecen", () => {
    expect(importe("150000.00")).toBe("150000.00");
    expect(importe(1500)).toBe("1500.00");
    expect(importe("1.500,50")).toBe("1500.50");
    expect(importe("1,500.50")).toBe("1500.50");
    expect(importe("1500,5")).toBe("1500.50");
    expect(importe("$ 1.500.000")).toBe("1500000.00");
    expect(importe("-5")).toBeNull();
    expect(importe("abc")).toBeNull();
    expect(importe(null)).toBeNull();
  });

  it("fechas aaaa-mm-dd; 0000-00-00 y fechas imposibles son null", () => {
    expect(fecha("1990-05-17")).toBe("1990-05-17");
    expect(fecha("2026-09-14 21:37:24")).toBe("2026-09-14");
    expect(fecha("17/5/1990")).toBe("1990-05-17");
    expect(fecha("0000-00-00")).toBeNull();
    expect(fecha("2026-02-31")).toBeNull();
    expect(fecha(19900517)).toBeNull();
  });

  it("sí/no en las formas de Alboom (también en portugués)", () => {
    expect([siNo("1"), siNo(1), siNo(true), siNo("sim"), siNo("Sí")]).toEqual([true, true, true, true, true]);
    expect([siNo("0"), siNo(0), siNo("não")]).toEqual([false, false, false]);
    expect(siNo("quizás")).toBeNull();
  });

  it("datos de prueba evidentes", () => {
    expect(esDatoDePrueba({ correo: "usuario@estudio.test", nombres: ["Ana"] })).toBe(true);
    expect(esDatoDePrueba({ correo: "test2@gmail.com", nombres: ["Ana"] })).toBe(true);
    expect(esDatoDePrueba({ correo: "ana@example.com", nombres: ["Ana"] })).toBe(true);
    expect(esDatoDePrueba({ correo: null, nombres: ["Contacto", "de Prueba"] })).toBe(true);
    expect(esDatoDePrueba({ correo: null, nombres: ["TEST"] })).toBe(true);
    expect(esDatoDePrueba({ correo: "testimonios@estudio.com.ar", nombres: ["Celeste"] })).toBe(false);
    expect(esDatoDePrueba({ correo: "ana@gmail.com", nombres: ["Ana", "Pruebasa"] })).toBe(false);
  });

  it("textos, claves y etiquetas", () => {
    expect(texto("  Hola   mundo ")).toBe("Hola mundo");
    expect(texto(12)).toBe("12");
    expect(texto("   ")).toBeNull();
    expect(clave("Recepción  del Presupuesto!")).toBe("recepcion del presupuesto");
    expect(claveEtiqueta(" Boda  2026 ")).toBe("boda 2026");
    expect(partirEtiquetas("VIP, vip ,Boda 2026,,")).toEqual({ nombres: ["VIP", "Boda 2026"], largas: 0 });
    expect(partirEtiquetas(["a", "x".repeat(41)])).toEqual({ nombres: ["a"], largas: 1 });
    expect(partirEtiquetas(undefined)).toEqual({ nombres: [], largas: 0 });
  });
});
