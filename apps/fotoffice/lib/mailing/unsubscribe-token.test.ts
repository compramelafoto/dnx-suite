import { describe, expect, it } from "vitest";
import { resolveUnsubscribeSecret, signUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-token";

const SECRET = "secreto-de-prueba";

describe("token de baja", () => {
  it("ida y vuelta, con la casilla en minúsculas", () => {
    const t = signUnsubscribeToken({ workspaceId: "ws_1", email: " Socio@Mail.com " }, SECRET);
    expect(verifyUnsubscribeToken(t, SECRET)).toEqual({ workspaceId: "ws_1", email: "socio@mail.com" });
  });

  it("rechaza un token con otra casilla", () => {
    const t = signUnsubscribeToken({ workspaceId: "ws_1", email: "a@b.com" }, SECRET);
    const [, sig] = t.split(".");
    const otro = Buffer.from(JSON.stringify({ w: "ws_1", e: "otra@b.com" })).toString("base64url");
    expect(verifyUnsubscribeToken(`${otro}.${sig}`, SECRET)).toBeNull();
  });

  it("rechaza otra clave, basura y vacío", () => {
    const t = signUnsubscribeToken({ workspaceId: "ws_1", email: "a@b.com" }, SECRET);
    expect(verifyUnsubscribeToken(t, "otra")).toBeNull();
    expect(verifyUnsubscribeToken("nada", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken("a.b.c", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken("", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(null, SECRET)).toBeNull();
  });

  it("toma la primera variable con valor", () => {
    expect(resolveUnsubscribeSecret({ CRON_SECRET: "c", FOTOFFICE_CRON_SECRET: " " })).toBe("c");
    expect(resolveUnsubscribeSecret({ FOTOFFICE_MAILING_SECRET: "m", CRON_SECRET: "c" })).toBe("m");
    expect(resolveUnsubscribeSecret({})).toBeNull();
  });
});
