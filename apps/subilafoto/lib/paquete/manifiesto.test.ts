import { describe, expect, test } from "vitest";
import { armarManifiesto, nombreEnElPaquete, verificarManifiesto } from "./manifiesto";

const archivo = (nombre: string, bytes: number) => ({
  archivo: nombre,
  bytes,
  checksum: null,
  autor: null,
  pie: null,
  subidaEl: "2026-10-10T22:00:00.000Z",
});

describe("cómo se llaman las fotos dentro del paquete", () => {
  test("van numeradas y no con su nombre original", () => {
    // Hay un IMG_0001.jpg en cada celular de la fiesta. Un ZIP con nombres
    // repetidos pierde archivos al descomprimirse, sin avisar.
    expect(nombreEnElPaquete(1, 300, "eventos/ABC/xyz.jpg")).toBe("001.jpg");
    expect(nombreEnElPaquete(42, 300, "eventos/ABC/xyz.jpg")).toBe("042.jpg");
  });

  test("el ancho crece con la cantidad, para que el orden sea el correcto", () => {
    // Sin ceros adelante, el explorador pone la 10 entre la 1 y la 2.
    expect(nombreEnElPaquete(7, 1200, "a.jpg")).toBe("0007.jpg");
    expect(nombreEnElPaquete(7, 9, "a.jpg")).toBe("007.jpg");
  });

  test("conserva la extensión y la normaliza", () => {
    expect(nombreEnElPaquete(1, 10, "a.HEIC")).toBe("001.heic");
    expect(nombreEnElPaquete(1, 10, "sin-extension")).toBe("001.jpg");
  });
});

describe("el manifiesto", () => {
  test("suma los totales solo", () => {
    const m = armarManifiesto({
      evento: { nombre: "Casamiento", codigo: "ABC123" },
      parte: { numero: 1, de: 2 },
      archivos: [archivo("001.jpg", 1000), archivo("002.jpg", 2500)],
      generadoEl: new Date("2026-10-11T09:00:00Z"),
    });
    expect(m.totales).toEqual({ archivos: 2, bytes: 3500 });
    expect(m.parte).toEqual({ numero: 1, de: 2 });
  });
});

describe("verificar un paquete contra su manifiesto", () => {
  const m = armarManifiesto({
    evento: { nombre: "Casamiento", codigo: "ABC123" },
    parte: { numero: 1, de: 1 },
    archivos: [archivo("001.jpg", 1000), archivo("002.jpg", 2000)],
    generadoEl: new Date(),
  });

  test("un paquete completo pasa", () => {
    const r = verificarManifiesto(m, [
      { archivo: "001.jpg", bytes: 1000 },
      { archivo: "002.jpg", bytes: 2000 },
    ]);
    expect(r.ok).toBe(true);
  });

  test("detecta una foto que falta", () => {
    // Es el caso que motiva todo esto: un ZIP al que le faltan tres fotos se
    // abre igual y nadie se entera.
    const r = verificarManifiesto(m, [{ archivo: "001.jpg", bytes: 1000 }]);
    expect(r.ok).toBe(false);
    expect(r.faltan).toEqual(["002.jpg"]);
  });

  test("detecta una que pesa distinto", () => {
    const r = verificarManifiesto(m, [
      { archivo: "001.jpg", bytes: 1000 },
      { archivo: "002.jpg", bytes: 17 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.pesanDistinto).toEqual(["002.jpg"]);
  });

  test("detecta una que sobra", () => {
    const r = verificarManifiesto(m, [
      { archivo: "001.jpg", bytes: 1000 },
      { archivo: "002.jpg", bytes: 2000 },
      { archivo: "999.jpg", bytes: 1 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.sobran).toEqual(["999.jpg"]);
  });
});
