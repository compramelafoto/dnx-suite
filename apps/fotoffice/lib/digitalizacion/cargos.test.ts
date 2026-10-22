import { describe, expect, it } from "vitest";
import {
  MINIMO_CARGO_ARS, cotizarEnvioCassettes, franjaParaKm, kmDeEnvio, precioDescargaExtra, precioExtension, precioUnitarioDelTrabajo,
  puedeComprarDescarga, puedeExtender, puedePedirEnvio, saldoParaVideos, totalOriginal, vencimientoExtendido,
} from "./cargos";

const AHORA = new Date("2026-10-22T15:00:00Z");
const ESTUDIO = { lat: -32.9468, lon: -60.6393 }; // Rosario
const FUNES = { lat: -32.9167, lon: -60.8167 };

describe("precios (E7)", () => {
  it("la descarga extra es el 25 % del precio unitario, en pesos enteros, con mínimo de 100", () => {
    expect(precioDescargaExtra(15000)).toBe(3750);
    expect(precioDescargaExtra(10001)).toBe(2500);
    expect(precioDescargaExtra(10002)).toBe(2501); // 2500,5 → 2501
    expect(precioDescargaExtra(300)).toBe(MINIMO_CARGO_ARS);
    expect(precioDescargaExtra(0)).toBe(MINIMO_CARGO_ARS);
  });

  it("la extensión es el 50 % del total original, con mínimo de 100", () => {
    expect(precioExtension(30000)).toBe(15000);
    expect(precioExtension(12345.5)).toBe(6173);
    expect(precioExtension(150)).toBe(100);
  });

  it("el total original descuenta los cargos que no se anularon", () => {
    expect(totalOriginal(33750, [{ montoArs: 3750, estado: "PENDIENTE" }, { montoArs: 500, estado: "ANULADO" }])).toBe(30000);
    expect(totalOriginal(30000, [])).toBe(30000);
    expect(totalOriginal(100, [{ montoArs: 500, estado: "APLICADO" }])).toBe(0);
  });

  it("el precio del trabajo sale del renglón del pedido; si no hay, el total original repartido", () => {
    const items = [
      { id: "a", cantidad: 2, precioUnitario: 15000 },
      { id: "b", cantidad: 1, precioUnitario: 8000 },
    ];
    expect(precioUnitarioDelTrabajo({ items, renglones: {}, pedidoItemIndex: 0, totalOriginal: 38000, videosListos: 3 })).toEqual({ precio: 15000, origen: "ITEM" });
    // Con descuento en el renglón vale el neto por unidad.
    expect(precioUnitarioDelTrabajo({ items, renglones: { a: { neto: 27000 } }, pedidoItemIndex: 0, totalOriginal: 38000, videosListos: 3 })).toEqual({ precio: 13500, origen: "ITEM" });
    expect(precioUnitarioDelTrabajo({ items, renglones: {}, pedidoItemIndex: null, totalOriginal: 38000, videosListos: 4 })).toEqual({ precio: 9500, origen: "REPARTO" });
    expect(precioUnitarioDelTrabajo({ items, renglones: {}, pedidoItemIndex: 7, totalOriginal: 38000, videosListos: 0 })).toEqual({ precio: 38000, origen: "REPARTO" });
  });
});

describe("envío de cassettes (E9)", () => {
  it("la distancia es la línea recta × 1,3, igual que Impresiones", () => {
    const km = kmDeEnvio(ESTUDIO, FUNES)!;
    expect(km).toBeGreaterThan(20);
    expect(km).toBeLessThan(25);
    expect(Math.round(km * 10)).toBe(km * 10);
    expect(kmDeEnvio(null, FUNES)).toBeNull();
    expect(kmDeEnvio(ESTUDIO, { lat: 200, lon: 0 })).toBeNull();
  });

  it("la franja es la primera que alcanza los km", () => {
    const franjas = [{ hastaKm: 30, precioArs: 9000 }, { hastaKm: 10, precioArs: 4000 }];
    expect(franjaParaKm(franjas, 5)).toEqual({ hastaKm: 10, precioArs: 4000 });
    expect(franjaParaKm(franjas, 10)).toEqual({ hastaKm: 10, precioArs: 4000 });
    expect(franjaParaKm(franjas, 10.1)).toEqual({ hastaKm: 30, precioArs: 9000 });
    expect(franjaParaKm(franjas, 31)).toBeNull();
    expect(franjaParaKm([], 1)).toBeNull();
  });

  it("con franja hay precio; sin franja, sin franjas o sin estudio, a coordinar; precio 0 es envío sin cargo", () => {
    const franjas = [{ hastaKm: 30, precioArs: 9000 }];
    expect(cotizarEnvioCassettes({ estudio: ESTUDIO, destino: FUNES, franjas })).toMatchObject({ estado: "A_PAGAR", precioArs: 9000 });
    expect(cotizarEnvioCassettes({ estudio: ESTUDIO, destino: FUNES, franjas: [{ hastaKm: 5, precioArs: 9000 }] })).toMatchObject({ estado: "A_COORDINAR", motivo: "FUERA_DE_FRANJAS" });
    expect(cotizarEnvioCassettes({ estudio: ESTUDIO, destino: FUNES, franjas: [] })).toMatchObject({ estado: "A_COORDINAR", motivo: "SIN_FRANJAS" });
    expect(cotizarEnvioCassettes({ estudio: null, destino: FUNES, franjas })).toEqual({ estado: "A_COORDINAR", km: null, motivo: "SIN_ESTUDIO" });
    expect(cotizarEnvioCassettes({ estudio: ESTUDIO, destino: FUNES, franjas: [{ hastaKm: 30, precioArs: 0 }] })).toMatchObject({ estado: "CONFIRMADO", precioArs: 0 });
  });
});

describe("qué se puede pedir", () => {
  const vigente = { cancelado: false, videosVencenAt: new Date("2026-11-20T02:59:59.999Z"), videosBorradosAt: null };

  it("comprar otra descarga: no con el pedido cancelado, los videos vencidos o el video borrado", () => {
    expect(puedeComprarDescarga(vigente, { videoBorradoAt: null }, AHORA)).toBe(true);
    expect(puedeComprarDescarga({ ...vigente, cancelado: true }, { videoBorradoAt: null }, AHORA)).toBe(false);
    expect(puedeComprarDescarga(vigente, { videoBorradoAt: AHORA }, AHORA)).toBe(false);
    expect(puedeComprarDescarga({ ...vigente, videosVencenAt: AHORA }, { videoBorradoAt: null }, AHORA)).toBe(false);
    expect(puedeComprarDescarga({ ...vigente, videosBorradosAt: AHORA }, { videoBorradoAt: null }, AHORA)).toBe(false);
  });

  it("extender: no si los videos ya se borraron o vencieron", () => {
    expect(puedeExtender(vigente, AHORA)).toBe(true);
    expect(puedeExtender({ ...vigente, videosBorradosAt: AHORA }, AHORA)).toBe(false);
    expect(puedeExtender({ ...vigente, videosVencenAt: new Date("2026-10-01T00:00:00Z") }, AHORA)).toBe(false);
    expect(puedeExtender({ ...vigente, cancelado: true }, AHORA)).toBe(false);
  });

  it("pedir envío: no con los cassettes vencidos ni con un envío ya confirmado o entregado", () => {
    const e = { cancelado: false, cassettesVencenAt: new Date("2026-11-20T02:59:59.999Z"), envioEstado: null };
    expect(puedePedirEnvio(e, AHORA)).toBe(true);
    expect(puedePedirEnvio({ ...e, envioEstado: "A_PAGAR" }, AHORA)).toBe(true);
    expect(puedePedirEnvio({ ...e, envioEstado: "A_COORDINAR" }, AHORA)).toBe(true);
    expect(puedePedirEnvio({ ...e, envioEstado: "CONFIRMADO" }, AHORA)).toBe(false);
    expect(puedePedirEnvio({ ...e, envioEstado: "ENTREGADO" }, AHORA)).toBe(false);
    expect(puedePedirEnvio({ ...e, cassettesVencenAt: new Date("2026-10-01T00:00:00Z") }, AHORA)).toBe(false);
    expect(puedePedirEnvio({ ...e, cassettesVencenAt: null }, AHORA)).toBe(false);
    expect(puedePedirEnvio({ ...e, cancelado: true }, AHORA)).toBe(false);
  });
});

describe("vencimiento extendido", () => {
  it("suma 30 días desde el vencimiento vigente, al final del día argentino", () => {
    const v = new Date("2026-11-20T02:59:59.999Z"); // fin del 19/11 en Argentina
    expect(vencimientoExtendido(v, AHORA).toISOString()).toBe("2026-12-20T02:59:59.999Z");
  });
  it("si ya venció, desde hoy", () => {
    expect(vencimientoExtendido(new Date("2026-10-01T00:00:00Z"), AHORA).toISOString()).toBe("2026-11-22T02:59:59.999Z");
    expect(vencimientoExtendido(null, AHORA).toISOString()).toBe("2026-11-22T02:59:59.999Z");
  });
});

describe("saldo para habilitar los videos", () => {
  it("no cuenta lo que falta de los cargos sin pagar", () => {
    expect(saldoParaVideos(375000, [375000])).toBe(0);
    expect(saldoParaVideos(1375000, [375000])).toBe(1000000);
    expect(saldoParaVideos(100000, [375000])).toBe(0);
    expect(saldoParaVideos(500, [])).toBe(500);
  });
});
