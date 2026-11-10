import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANEXO_COBRO_DIVIDIDO_TEXTO, ANEXO_COBRO_DIVIDIDO_VERSION } from "./anexo";
import { resolveAceptacionConfig } from "./config";
import { decidirAceptacion, rutaExenta, ROLES_ACEPTACION } from "./regla";

const ENCENDIDO = {
  DNX_CLF_SPLIT_1N_PILOTO_ENABLED: "true",
  DNX_CLF_SPLIT_1N_TODOS_LOS_ALBUMES: "true",
  DNX_CLF_SPLIT_1N_CONSENTIMIENTO_ENABLED: "true",
  DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED: "true",
  DNX_MP_PLATFORM_ACCESS_TOKEN: "APP_USR-x",
  DNX_CLF_SPLIT_1N_PILOTO_OWNER_USER_ID: "97484805",
  DNX_CLF_SPLIT_1N_ACEPTACION_LIMITE: "2026-11-23",
};

describe("aceptación obligatoria: configuración", () => {
  it("apagada por defecto", () => {
    assert.deepEqual(resolveAceptacionConfig({}), { enabled: false, limite: null });
  });

  it("la fecha límite es la medianoche de ese día en hora argentina", () => {
    const c = resolveAceptacionConfig(ENCENDIDO);
    assert.equal(c.enabled, true);
    assert.equal(c.limite?.toISOString(), "2026-11-23T03:00:00.000Z");
  });

  it("si falta cualquier pieza del cobro dividido, no se pide nada (nadie queda trabado)", () => {
    for (const falta of Object.keys(ENCENDIDO).filter((k) => k !== "DNX_CLF_SPLIT_1N_ACEPTACION_LIMITE")) {
      const env: Record<string, string> = { ...ENCENDIDO };
      delete env[falta];
      assert.equal(resolveAceptacionConfig(env).enabled, false, falta);
    }
  });

  it("una fecha mal escrita la deja apagada (nunca bloquea por un error de configuración)", () => {
    for (const limite of ["23/11/2026", "2026-13-01", "mañana", ""]) {
      const c = resolveAceptacionConfig({ ...ENCENDIDO, DNX_CLF_SPLIT_1N_ACEPTACION_LIMITE: limite });
      assert.equal(c.enabled, false, limite);
    }
  });
});

describe("aceptación obligatoria: ¿qué ve la persona al entrar al panel?", () => {
  const config = resolveAceptacionConfig(ENCENDIDO);
  const antes = new Date("2026-11-20T15:00:00Z");
  const despues = new Date("2026-11-23T03:00:00Z");
  const base = {
    config,
    rol: "PHOTOGRAPHER",
    terminosAceptados: false,
    estadoMp: "SIN_PEDIR" as const,
    mpRespondio: true,
  };

  it("con la función apagada, nada", () => {
    const r = decidirAceptacion({ ...base, config: { enabled: false, limite: null }, ahora: antes });
    assert.deepEqual(r, { mostrar: false });
  });

  it("antes de la fecha: el cartel aparece pero se puede posponer", () => {
    const r = decidirAceptacion({ ...base, ahora: antes });
    assert.deepEqual(r, {
      mostrar: true,
      obligatorio: false,
      limite: "2026-11-23T03:00:00.000Z",
      faltaTerminos: true,
      faltaMercadoPago: true,
    });
  });

  it("desde la fecha: el cartel no se puede cerrar", () => {
    const r = decidirAceptacion({ ...base, ahora: despues });
    assert.equal(r.mostrar && r.obligatorio, true);
  });

  it("aceptó los términos pero falta Mercado Pago: sigue el cartel, sólo con el segundo paso", () => {
    const r = decidirAceptacion({ ...base, terminosAceptados: true, estadoMp: "PENDING", ahora: despues });
    assert.equal(r.mostrar, true);
    assert.equal(r.mostrar && r.faltaTerminos, false);
    assert.equal(r.mostrar && r.faltaMercadoPago, true);
  });

  it("con las dos cosas hechas, no aparece más", () => {
    const r = decidirAceptacion({ ...base, terminosAceptados: true, estadoMp: "ACTIVE", ahora: despues });
    assert.deepEqual(r, { mostrar: false });
  });

  it("si después cancela el permiso en Mercado Pago, el cartel vuelve", () => {
    const r = decidirAceptacion({ ...base, terminosAceptados: true, estadoMp: "CANCELED", ahora: despues });
    assert.equal(r.mostrar && r.faltaMercadoPago, true);
  });

  it("si no pudimos consultar Mercado Pago, no se bloquea a nadie", () => {
    const r = decidirAceptacion({ ...base, terminosAceptados: true, estadoMp: null, ahora: despues });
    assert.deepEqual(r, { mostrar: false });
  });

  it("si Mercado Pago no responde, el cartel aparece pero se puede posponer aunque haya vencido el plazo", () => {
    const r = decidirAceptacion({ ...base, mpRespondio: false, ahora: despues });
    assert.equal(r.mostrar, true);
    assert.equal(r.mostrar && r.obligatorio, false);
  });

  it("sólo para quienes cobran una parte: fotógrafos y organizadores", () => {
    for (const rol of ROLES_ACEPTACION) {
      assert.equal(decidirAceptacion({ ...base, rol, ahora: antes }).mostrar, true, rol);
    }
    for (const rol of ["ADMIN", "SUPER_ADMIN", "LAB", "CUSTOMER", "SCHOOL_ORGANIZER"]) {
      assert.deepEqual(decidirAceptacion({ ...base, rol, ahora: despues }), { mostrar: false }, rol);
    }
  });
});

describe("aceptación obligatoria: la salida a soporte", () => {
  it("la página de soporte (y la de entrar con otra cuenta) nunca queda tapada", () => {
    assert.equal(rutaExenta("/fotografo/soporte"), true);
    assert.equal(rutaExenta("/organizador/soporte"), true);
    assert.equal(rutaExenta("/fotografo/soporte/123"), true);
    assert.equal(rutaExenta("/fotografo/login"), true);
    assert.equal(rutaExenta("/fotografo/registro"), true);
    assert.equal(rutaExenta("/fotografo/dashboard"), false);
    assert.equal(rutaExenta("/fotografo/soportes"), false);
    assert.equal(rutaExenta(null), false);
  });
});

describe("aceptación obligatoria: el anexo", () => {
  it("tiene versión propia y explica el cobro dividido", () => {
    assert.match(ANEXO_COBRO_DIVIDIDO_VERSION, /^anexo-cobro-dividido-/);
    assert.match(ANEXO_COBRO_DIVIDIDO_TEXTO, /Mercado Pago/);
    assert.doesNotMatch(ANEXO_COBRO_DIVIDIDO_TEXTO, /\bplata\b/i);
  });
});
