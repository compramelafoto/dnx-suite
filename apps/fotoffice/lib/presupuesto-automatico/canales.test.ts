import { describe, expect, it } from "vitest";
import { ACUSE_POR_OMISION, algunoSalio, decidirCanales, textoDeAcuse, textoDeCanales, textoWhatsappDelPresupuesto } from "./canales";

const TODO = { correoValido: true, waId: "5493415551234", whatsappConectado: true, ventanaAbierta: true };

describe("decidirCanales", () => {
  it("con correo, celular, Meta conectado y la ventana abierta: correo y WhatsApp", () => {
    expect(decidirCanales(TODO)).toEqual({ correo: true, whatsapp: true, motivoSinWhatsapp: null });
  });

  it("el correo sale siempre que haya correo", () => {
    expect(decidirCanales({ ...TODO, waId: null }).correo).toBe(true);
    expect(decidirCanales({ ...TODO, correoValido: false }).correo).toBe(false);
  });

  it("WhatsApp sólo con celular, conexión real y ventana de 24 h abierta (en ese orden de motivos)", () => {
    expect(decidirCanales({ ...TODO, waId: null, whatsappConectado: false })).toMatchObject({ whatsapp: false, motivoSinWhatsapp: "SIN_CELULAR" });
    expect(decidirCanales({ ...TODO, whatsappConectado: false })).toMatchObject({ whatsapp: false, motivoSinWhatsapp: "SIN_CONEXION" });
    expect(decidirCanales({ ...TODO, ventanaAbierta: false })).toMatchObject({ whatsapp: false, motivoSinWhatsapp: "VENTANA_CERRADA" });
  });

  it("cliente de WhatsApp sin correo: sólo WhatsApp", () => {
    expect(decidirCanales({ ...TODO, correoValido: false })).toEqual({ correo: false, whatsapp: true, motivoSinWhatsapp: null });
  });
});

describe("textos de los canales", () => {
  it("cuenta por dónde salió y por qué no salió por el otro", () => {
    expect(textoDeCanales({ correo: "ENVIADO", whatsapp: "ENVIADO" })).toBe("Enviado por correo y WhatsApp.");
    expect(textoDeCanales({ correo: "ENVIADO", whatsapp: "VENTANA_CERRADA" })).toBe(
      "Enviado por correo. WhatsApp no: pasaron más de 24 h desde su último mensaje.",
    );
    expect(textoDeCanales({ correo: "SIN_CORREO", whatsapp: "ENVIADO" })).toBe("Enviado por WhatsApp. No dejó correo.");
    expect(textoDeCanales({ correo: "FALLO", whatsapp: "SIN_CONEXION" })).toMatch(/^No salió por ningún canal\. El correo no salió/);
  });

  it("algunoSalio", () => {
    expect(algunoSalio({ correo: "FALLO", whatsapp: "ENVIADO" })).toBe(true);
    expect(algunoSalio({ correo: "FALLO", whatsapp: "SIN_CELULAR" })).toBe(false);
  });

  it("el WhatsApp lleva el nombre de pila, el tipo y el enlace, sin cifras", () => {
    const t = textoWhatsappDelPresupuesto({ nombre: "Lucía Gómez", categoria: "15 años", enlace: "https://dnx.com.ar/p/abc", estudio: "DNX Estudio" });
    expect(t).toContain("¡Hola Lucía!");
    expect(t).toContain("para 15 años");
    expect(t).toContain("https://dnx.com.ar/p/abc");
    expect(t).toContain("DNX Estudio");
    expect(t).not.toMatch(/\$/);
  });

  it("el acuse vacío usa el de omisión", () => {
    expect(textoDeAcuse("  ")).toBe(ACUSE_POR_OMISION);
    expect(textoDeAcuse("Hola, ya te escribimos")).toBe("Hola, ya te escribimos");
  });
});
