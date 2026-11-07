import { describe, expect, it } from "vitest";
import { estadoDeEnvio, faltanArchivos, listoParaSalirSolo } from "./estado-envio";

const base = { proveedor: "Fotolag", envioSinArchivos: false, otroCamino: false, archivosListos: 0, enviadoAt: null, abiertoAt: null, descargadoAt: null };

describe("estadoDeEnvio", () => {
  it("sin proveedor no muestra nada", () => {
    expect(estadoDeEnvio({ ...base, proveedor: null })).toBeNull();
  });
  it("sin archivos: faltan los archivos", () => {
    expect(estadoDeEnvio(base)?.clave).toBe("FALTAN_ARCHIVOS");
    expect(estadoDeEnvio(base)?.texto).toBe("Faltan los archivos para Fotolag");
  });
  it("con archivos y sin enviar: sale solo", () => {
    expect(estadoDeEnvio({ ...base, archivosListos: 3 })?.clave).toBe("SALE_SOLO");
  });
  it("material físico sin enviar: por enviar", () => {
    expect(estadoDeEnvio({ ...base, envioSinArchivos: true })?.clave).toBe("POR_ENVIAR");
  });
  it("fotolibro con archivos y sin enviar: por enviar (se manda a mano)", () => {
    expect(estadoDeEnvio({ ...base, otroCamino: true, archivosListos: 1 })?.clave).toBe("POR_ENVIAR");
  });
  it("enviado, abierto y descargado, con hora argentina", () => {
    const enviadoAt = new Date("2026-11-07T13:05:00Z");
    expect(estadoDeEnvio({ ...base, enviadoAt })?.texto).toBe("Enviado a Fotolag 07/11 10:05");
    expect(estadoDeEnvio({ ...base, enviadoAt, abiertoAt: new Date("2026-11-07T14:00:00Z") })?.clave).toBe("ABIERTO");
    expect(estadoDeEnvio({ ...base, enviadoAt, abiertoAt: enviadoAt, descargadoAt: "2026-11-07T15:00:00.000Z" })?.clave).toBe("DESCARGADO");
  });
});

describe("faltanArchivos", () => {
  it("el material físico nunca espera archivos", () => {
    expect(faltanArchivos({ envioSinArchivos: true, archivosListos: 0 })).toBe(false);
    expect(faltanArchivos({ envioSinArchivos: false, archivosListos: 0 })).toBe(true);
  });
});

describe("listoParaSalirSolo", () => {
  const ahora = new Date("2026-11-07T15:00:00Z");
  const d = { envioSinArchivos: false, otroCamino: false, archivosListos: 2, archivosSubiendo: 0, ultimoArchivoAt: new Date("2026-11-07T14:50:00Z") };
  it("sale cuando el último archivo lleva más de 5 minutos", () => {
    expect(listoParaSalirSolo(d, ahora)).toBe(true);
  });
  it("espera si el último es reciente o hay uno subiendo", () => {
    expect(listoParaSalirSolo({ ...d, ultimoArchivoAt: new Date("2026-11-07T14:58:00Z") }, ahora)).toBe(false);
    expect(listoParaSalirSolo({ ...d, archivosSubiendo: 1 }, ahora)).toBe(false);
  });
  it("no toca fotolibros, mostrador, físicos ni carpetas vacías", () => {
    expect(listoParaSalirSolo({ ...d, otroCamino: true }, ahora)).toBe(false);
    expect(listoParaSalirSolo({ ...d, envioSinArchivos: true }, ahora)).toBe(false);
    expect(listoParaSalirSolo({ ...d, archivosListos: 0 }, ahora)).toBe(false);
  });
});
