import { describe, expect, it } from "vitest";
import { integrationErrorMessage, integrationOkMessage } from "./messages";

describe("mensajes de la pantalla de integraciones", () => {
  it("cada código de error tiene un texto en castellano", () => {
    for (const code of [
      "sin_permiso",
      "integracion_desconocida",
      "falta_configuracion",
      "cancelado",
      "respuesta_incompleta",
      "estado_vencido",
      "permisos_incompletos",
      "no_se_pudo_conectar",
    ]) {
      const mensaje = integrationErrorMessage(code);
      expect(mensaje, code).toBeTruthy();
      expect(mensaje!.length).toBeGreaterThan(10);
    }
  });

  it("sin código no hay mensaje", () => {
    expect(integrationErrorMessage(null)).toBeNull();
    expect(integrationOkMessage(null)).toBeNull();
  });

  it("un código desconocido da un mensaje genérico, nunca el código crudo", () => {
    const mensaje = integrationErrorMessage("algo_raro_123");
    expect(mensaje).toBeTruthy();
    expect(mensaje).not.toContain("algo_raro_123");
  });

  it("el mensaje de éxito confirma la conexión", () => {
    expect(integrationOkMessage("conectado")).toContain("conect");
  });

  it("ningún mensaje nombra una variable de entorno ni un token", () => {
    for (const code of ["falta_configuracion", "no_se_pudo_conectar", "permisos_incompletos"]) {
      const mensaje = integrationErrorMessage(code)!;
      expect(mensaje).not.toContain("GOOGLE_CLIENT");
      expect(mensaje).not.toContain("token");
    }
  });
});
