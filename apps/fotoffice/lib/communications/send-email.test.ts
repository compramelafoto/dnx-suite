import { describe, expect, it, vi } from "vitest";
import { sendTransactionalEmail } from "./send-email";

const API_KEY = "re_supersecret_value_0123456789";
const ENV = {
  RESEND_API_KEY: API_KEY,
  FOTOFFICE_NOTIFICATIONS_FROM: "FotoOffice <no-reply@mail.fotoffice.com>",
};

const MESSAGE = {
  to: "destino@example.com",
  subject: "Asunto de prueba",
  html: "<p>hola</p>",
  text: "hola",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("sendTransactionalEmail", () => {
  it("envía y devuelve el id del proveedor", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { id: "email_123" }));
    const result = await sendTransactionalEmail(MESSAGE, { env: ENV, fetchImpl });
    expect(result.status).toBe("SENT");
    if (result.status !== "SENT") return;
    expect(result.providerId).toBe("email_123");
  });

  it("manda un único destinatario, con HTML y texto plano", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { id: "email_123" }));
    await sendTransactionalEmail(MESSAGE, { env: ENV, fetchImpl });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.to).toEqual(["destino@example.com"]);
    expect(body.from).toBe("FotoOffice <no-reply@mail.fotoffice.com>");
    expect(body.subject).toBe("Asunto de prueba");
    expect(body.html).toBe("<p>hola</p>");
    expect(body.text).toBe("hola");
  });

  it("sin configuración no llama al proveedor", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { id: "no" }));
    const result = await sendTransactionalEmail(MESSAGE, { env: {}, fetchImpl });
    expect(result.status).toBe("CONFIGURATION_ERROR");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("el detalle de configuración nombra las variables, no sus valores", async () => {
    const result = await sendTransactionalEmail(MESSAGE, { env: {}, fetchImpl: vi.fn() });
    if (result.status !== "CONFIGURATION_ERROR") throw new Error("estado inesperado");
    expect(result.detail).toContain("RESEND_API_KEY");
    expect(result.detail).toContain("FOTOFFICE_NOTIFICATIONS_FROM");
  });

  it("traduce un rechazo del proveedor a PROVIDER_REJECTED con detalle depurado", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(422, { name: "validation_error", message: "Invalid `from` field" }),
    );
    const result = await sendTransactionalEmail(MESSAGE, { env: ENV, fetchImpl });
    expect(result.status).toBe("PROVIDER_REJECTED");
    if (result.status !== "PROVIDER_REJECTED") return;
    expect(result.detail).toContain("422");
    expect(result.detail).toContain("validation_error");
    expect(result.detail).toContain("Invalid `from` field");
  });

  /**
   * Un cuerpo que no es JSON (una página de error de un balanceador, por ejemplo) no se
   * guarda: solo queda el código HTTP. Registrar cuerpos crudos del proveedor es
   * exactamente lo que hay que evitar.
   */
  it("no filtra cuerpos crudos que no sean JSON", async () => {
    const raw = "<html><body>Gateway Error - internal host 10.1.2.3</body></html>";
    const fetchImpl = vi.fn(async () => new Response(raw, { status: 502 }));
    const result = await sendTransactionalEmail(MESSAGE, { env: ENV, fetchImpl });
    expect(result.status).toBe("PROVIDER_REJECTED");
    if (result.status !== "PROVIDER_REJECTED") return;
    expect(result.detail).toContain("502");
    expect(result.detail).not.toContain("10.1.2.3");
    expect(result.detail).not.toContain("<html>");
  });

  it("un fallo de red es INTERNAL_ERROR, no un throw", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("socket hang up");
    });
    const result = await sendTransactionalEmail(MESSAGE, { env: ENV, fetchImpl });
    expect(result.status).toBe("INTERNAL_ERROR");
  });

  it("nunca deja la API key en el resultado, aunque el proveedor la devuelva", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(401, { name: "unauthorized", message: `key ${API_KEY} is invalid` }),
    );
    const result = await sendTransactionalEmail(MESSAGE, { env: ENV, fetchImpl });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it("trunca el detalle largo", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(422, { name: "validation_error", message: "x".repeat(4000) }),
    );
    const result = await sendTransactionalEmail(MESSAGE, { env: ENV, fetchImpl });
    if (result.status !== "PROVIDER_REJECTED") throw new Error("estado inesperado");
    expect(result.detail.length).toBeLessThanOrEqual(500);
  });

  it("usa la clave solo en el header Authorization", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { id: "email_123" }));
    await sendTransactionalEmail(MESSAGE, { env: ENV, fetchImpl });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(String(init.body)).not.toContain(API_KEY);
  });
});
