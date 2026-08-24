import { describe, expect, it } from "vitest";
import { collectionCopy, connectErrorMessage } from "./messages";
import type { WorkspaceCollectionStatus } from "./status";

const TODOS: WorkspaceCollectionStatus[] = [
  "NOT_CONNECTED",
  "PENDING",
  "AWAITING_CONSENT",
  "CONNECTED",
  "NEEDS_REAUTH",
  "REVOKED",
];

describe("collectionCopy", () => {
  it.each(TODOS)("%s tiene título, cuerpo y acción", (status) => {
    const c = collectionCopy(status);
    expect(c.title.length).toBeGreaterThan(0);
    expect(c.body.length).toBeGreaterThan(0);
    expect(c.actionLabel).toBeTruthy();
  });

  /**
   * Lo más importante de esta pantalla: ningún estado que no sea CONNECTED puede sugerir
   * que ya se puede cobrar. Una institución que crea que está cobrando y no lo está pierde
   * plata sin enterarse.
   */
  it.each(TODOS.filter((s) => s !== "CONNECTED"))(
    "%s no afirma que los cobros están funcionando",
    (status) => {
      const c = collectionCopy(status);
      expect(c.tone).not.toBe("ok");
      expect(c.title.toLowerCase()).not.toContain("conectados");
    },
  );

  it("solo CONNECTED tiene tono de éxito", () => {
    expect(collectionCopy("CONNECTED").tone).toBe("ok");
  });

  it("CONNECTED aclara que el dinero va directo a la institución", () => {
    const c = collectionCopy("CONNECTED");
    expect(c.body).toMatch(/directo a tu cuenta/i);
  });

  it("NOT_CONNECTED aclara que la plataforma no retiene el dinero", () => {
    const c = collectionCopy("NOT_CONNECTED");
    expect(c.body).toMatch(/no lo recibe ni lo retiene/i);
  });
});

describe("connectErrorMessage", () => {
  it("sin código no muestra nada", () => {
    expect(connectErrorMessage(null)).toBeNull();
  });

  it.each([
    ["cancelado", /cancelaste/i],
    ["sin_permiso", /dueño o un administrador/i],
    ["NOT_CONFIGURED", /no está configurada/i],
    ["STATE_EXPIRED", /venció/i],
    ["STATE_ALREADY_USED", /ya se había usado/i],
  ])("%s tiene un mensaje propio", (code, pattern) => {
    expect(connectErrorMessage(code)).toMatch(pattern);
  });

  it("un código desconocido cae a un mensaje genérico, no rompe", () => {
    expect(connectErrorMessage("LO_QUE_SEA")).toMatch(/no se pudo completar/i);
  });

  /** Los mensajes son para una persona: nunca deben filtrar detalle técnico. */
  it.each(["NOT_CONFIGURED", "STATE_WRONG_PRODUCT", "LO_QUE_SEA"])(
    "el mensaje de %s no menciona variables de entorno ni claves",
    (code) => {
      const msg = connectErrorMessage(code)!;
      expect(msg).not.toMatch(/FOTOFFICE_MP|CLIENT_SECRET|token|productKey/i);
    },
  );
});

describe("consentimiento de split en la pantalla", () => {
  /**
   * Es el caso que motivó todo esto: cuenta vinculada pero sin consentimiento activo.
   * MercadoPago rechaza la orden, así que el texto no puede sugerir que ya se cobra.
   */
  it("AWAITING_CONSENT explica que falta la autorización y no dice que esté conectado", () => {
    const c = collectionCopy("AWAITING_CONSENT");
    expect(c.tone).toBe("warn");
    expect(c.body).toMatch(/autorizaci[óo]n/i);
    expect(c.body).toMatch(/no se pueden cobrar/i);
    expect(c.title.toLowerCase()).not.toContain("conectados");
  });
});
