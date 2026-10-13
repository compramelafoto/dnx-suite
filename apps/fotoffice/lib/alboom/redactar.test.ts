import { describe, expect, it } from "vitest";
import { armarFilas } from "./extractor";
import { ENTIDADES } from "./entidades";
import { huella } from "./huella";
import { OCULTO, redactarSecretos } from "./redactar";

describe("secretos de Alboom", () => {
  it("oculta claves sensibles en cualquier nivel y deja el resto", () => {
    const settings = {
      company: "Estudio",
      mailchimp_api_key: "mc-123",
      smtp_host: "smtp.x.test",
      smtp_password: "s3",
      smtp_pass: "s4",
      boleto_token_api_user: "tk",
      paypal_email: "a@b.test",
      Subscriber: { plan: "pro", api_key: "ak", card: { number: "4111", cvv: "123" }, card_last4: "1111", apikey: "x" },
      users: [{ id: 1, password: "p", secret: "z", access_token: "t", name: "Ana" }],
      vacio: null,
    };
    const r = redactarSecretos(settings) as Record<string, any>;
    expect(r.company).toBe("Estudio");
    expect(r.smtp_host).toBe("smtp.x.test");
    expect(r.paypal_email).toBe("a@b.test");
    for (const v of [r.mailchimp_api_key, r.smtp_password, r.smtp_pass, r.boleto_token_api_user, r.Subscriber.api_key, r.Subscriber.card, r.Subscriber.card_last4, r.Subscriber.apikey, r.users[0].password, r.users[0].secret, r.users[0].access_token]) {
      expect(v).toBe(OCULTO);
    }
    expect(r.Subscriber.plan).toBe("pro");
    expect(r.users[0]).toMatchObject({ id: 1, name: "Ana" });
    expect(JSON.stringify(r)).not.toMatch(/mc-123|"s3"|"ak"|4111|"123"/);
  });

  it("saca el carácter nulo, que JSONB no acepta", () => {
    expect(redactarSecretos({ t: "a\u0000b", ["x\u0000"]: 1 })).toEqual({ t: "ab", x: 1 });
  });

  it("todas las entidades guardan el payload sin secretos y la huella se calcula sobre lo guardado", () => {
    for (const e of ENTIDADES) {
      const { filas } = armarFilas(e, [{ id: 5, name: "N", api_key: "secreta", password: "pw" }], null);
      expect(filas[0]!.payload, e.clave).toEqual({ id: 5, name: "N", api_key: OCULTO, password: OCULTO });
      expect(filas[0]!.hash).toBe(huella(filas[0]!.payload));
    }
  });
});
