import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COMMUNICATION_CHANNELS,
  COMMUNICATION_EVENT_TYPES,
  CommunicationError,
  clearProviders,
  createCommunicationEvent,
  createCommunicationLogger,
  createCommunicationsFacade,
  createProviderRegistry,
  createResendProvider,
  failedResult,
  isCommunicationEventType,
  registerCommunicationProvider,
  removeProvider,
  sanitizeLogMetadata,
  successResult,
  type CommunicationProvider,
  type CommunicationResult,
  type ResendClientLike,
} from "./index";

function createMemoryEmailProvider(
  behavior: "success" | "failed" | "throw" = "success",
): CommunicationProvider {
  return {
    name: "memory-mail",
    channel: "email",
    async send(input): Promise<CommunicationResult> {
      if (behavior === "throw") {
        throw new Error("boom-provider");
      }
      if (behavior === "failed") {
        return failedResult({
          channel: "email",
          provider: "memory-mail",
          errorCode: "SEND_FAILED",
          errorMessage: "falló a propósito",
        });
      }
      return successResult({
        channel: "email",
        provider: "memory-mail",
        providerMessageId: "mem_1",
        metadata: { subjectPresent: Boolean(input.subject) },
      });
    },
  };
}

test("canales y catálogo de eventos tipados", () => {
  for (const channel of ["email", "whatsapp", "push", "sms", "in_app"] as const) {
    assert.ok(COMMUNICATION_CHANNELS.includes(channel));
  }
  assert.ok(COMMUNICATION_EVENT_TYPES.includes("user.welcome"));
  assert.ok(COMMUNICATION_EVENT_TYPES.includes("purchase.completed"));
  assert.equal(isCommunicationEventType("news.published"), true);
  assert.equal(isCommunicationEventType("not.a.real.event"), false);

  const event = createCommunicationEvent({
    type: "purchase.completed",
    payload: { orderId: "ord_1", userId: "user_1" },
  });
  assert.equal(event.type, "purchase.completed");
  assert.equal(event.payload.orderId, "ord_1");
});

test("registry aislado: register / get / has / remove / clear", () => {
  const registry = createProviderRegistry();
  const provider = createMemoryEmailProvider();

  assert.equal(registry.hasProvider("email"), false);
  registry.registerProvider("email", provider);
  assert.equal(registry.hasProvider("email"), true);
  assert.equal(registry.getProvider("email").name, "memory-mail");

  assert.equal(registry.removeProvider("email"), true);
  assert.equal(registry.hasProvider("email"), false);

  registry.registerProvider("email", provider);
  registry.clearProviders();
  assert.equal(registry.listProviders().length, 0);
});

test("registry: provider faltante lanza error tipado", () => {
  const registry = createProviderRegistry();
  assert.throws(
    () => registry.getProvider("email"),
    (error: unknown) =>
      error instanceof CommunicationError && error.code === "PROVIDER_NOT_REGISTERED",
  );
});

test("registry: mismatch de canal", () => {
  const registry = createProviderRegistry();
  const wa: CommunicationProvider = {
    name: "fake-wa",
    channel: "whatsapp",
    async send() {
      return successResult({ channel: "whatsapp", provider: "fake-wa" });
    },
  };
  assert.throws(
    () => registry.registerProvider("email", wa),
    (error: unknown) =>
      error instanceof CommunicationError && error.code === "PROVIDER_MISMATCH",
  );
});

test("registry: reemplazo requiere replace:true", () => {
  const registry = createProviderRegistry();
  registry.registerProvider("email", createMemoryEmailProvider());
  assert.throws(
    () => registry.registerProvider("email", createMemoryEmailProvider()),
    (error: unknown) =>
      error instanceof CommunicationError &&
      error.code === "PROVIDER_ALREADY_REGISTERED",
  );

  registry.registerProvider("email", createMemoryEmailProvider(), { replace: true });
  assert.equal(registry.getProvider("email").name, "memory-mail");
});

test("fachada: envío exitoso con provider falso", async () => {
  const facade = createCommunicationsFacade();
  facade.registerProvider("email", createMemoryEmailProvider("success"));

  const result = await facade.send({
    to: { email: "runner@example.com", id: "u1" },
    from: { email: "noreply@example.com", name: "DNX" },
    subject: "Hola",
    text: "Fundación",
  });

  assert.equal(result.status, "success");
  assert.equal(result.ok, true);
  assert.equal(result.provider, "memory-mail");
  assert.equal(result.providerMessageId, "mem_1");
});

test("fachada: error normalizado del provider", async () => {
  const facade = createCommunicationsFacade();
  facade.registerProvider("email", createMemoryEmailProvider("failed"));

  const result = await facade.send({
    to: { email: "runner@example.com" },
    from: { email: "noreply@example.com" },
    subject: "Hola",
  });

  assert.equal(result.status, "failed");
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "SEND_FAILED");
});

test("fachada: excepción del provider se normaliza", async () => {
  const facade = createCommunicationsFacade();
  facade.registerProvider("email", createMemoryEmailProvider("throw"));

  const result = await facade.send({
    to: { email: "runner@example.com" },
    from: { email: "noreply@example.com" },
    subject: "Hola",
  });

  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "SEND_FAILED");
  assert.match(result.errorMessage ?? "", /boom-provider/);
});

test("fachada: solicitud inválida", async () => {
  const facade = createCommunicationsFacade();
  facade.registerProvider("email", createMemoryEmailProvider());

  const result = await facade.send({
    to: [],
    from: { email: "noreply@example.com" },
  });

  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "INVALID_REQUEST");
});

test("fachada: provider faltante no envía ni lanza", async () => {
  const facade = createCommunicationsFacade();
  const result = await facade.send({
    to: { email: "runner@example.com" },
    from: { email: "noreply@example.com" },
    subject: "Hola",
  });

  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "PROVIDER_NOT_REGISTERED");
  assert.equal(result.ok, false);
});

test("fachada: schedule no finge éxito", async () => {
  const facade = createCommunicationsFacade();
  const result = await facade.schedule({
    runAt: new Date(Date.now() + 60_000),
    to: { email: "runner@example.com" },
    from: { email: "noreply@example.com" },
    subject: "Luego",
  });

  assert.equal(result.status, "skipped");
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "SCHEDULE_NOT_IMPLEMENTED");
});

test("fachada: trigger valida evento y no ejecuta automatizaciones", async () => {
  const facade = createCommunicationsFacade();

  const invalid = await facade.trigger({
    event: {
      type: "not.real",
      occurredAt: new Date(),
      payload: {},
    },
  });
  assert.equal(invalid.status, "failed");
  assert.equal(invalid.validEvent, false);
  assert.equal(invalid.errorCode, "INVALID_EVENT");
  assert.equal(invalid.plannedActions, 0);

  const valid = await facade.trigger({
    event: createCommunicationEvent({
      type: "user.welcome",
      payload: { userId: "42" },
    }),
  });
  assert.equal(valid.status, "skipped");
  assert.equal(valid.validEvent, true);
  assert.equal(valid.errorCode, "TRIGGER_NOT_IMPLEMENTED");
  assert.equal(valid.plannedActions, 0);
  assert.equal(valid.ok, false);
});

test("fachada: preview/render reales no fingen éxito ante payload inválido", async () => {
  const facade = createCommunicationsFacade();
  const invalid = await facade.render({
    templateId: "system.test",
    brandId: "dnx",
    locale: "es-AR",
    data: { recipientName: "Ada" },
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errorCode, "INVALID_TEMPLATE_PAYLOAD");
  assert.equal(invalid.html, undefined);

  const ok = await facade.preview({
    templateId: "system.test",
    brandId: "dnx",
    locale: "es-AR",
    data: { recipientName: "Ada", message: "ok" },
  });
  assert.equal(ok.ok, true);
  assert.ok(ok.html && ok.text && ok.subject);
});

test("ResendProvider: dry-run por defecto no contacta client", async () => {
  let called = 0;
  const client: ResendClientLike = {
    emails: {
      async send() {
        called += 1;
        return { data: { id: "should-not" }, error: null };
      },
    },
  };
  const provider = createResendProvider({ client, dryRun: true });
  const result = await provider.sendEmail({
    to: { email: "runner@example.com" },
    from: { email: "noreply@example.com" },
    subject: "Dry",
  });

  assert.equal(called, 0);
  assert.equal(result.status, "skipped");
  assert.equal(result.errorCode, "DRY_RUN");
  assert.equal(result.dryRun, true);
});

test("ResendProvider: client fake éxito / error / excepción / sin ID", async () => {
  const successClient: ResendClientLike = {
    emails: {
      async send() {
        return { data: { id: "re_ok_1" }, error: null };
      },
    },
  };
  const ok = await createResendProvider({
    client: successClient,
    dryRun: false,
  }).sendEmail({
    to: { email: "runner@example.com" },
    from: { email: "noreply@example.com" },
    subject: "Ok",
    text: "hola",
    idempotencyKey: "idem_1",
  });
  assert.equal(ok.status, "success");
  assert.equal(ok.providerMessageId, "re_ok_1");

  const rejectClient: ResendClientLike = {
    emails: {
      async send() {
        return { data: null, error: { message: "rejected by provider" } };
      },
    },
  };
  const rejected = await createResendProvider({
    client: rejectClient,
    dryRun: false,
  }).sendEmail({
    to: { email: "runner@example.com" },
    from: { email: "noreply@example.com" },
    subject: "No",
  });
  assert.equal(rejected.status, "failed");
  assert.equal(rejected.errorCode, "PROVIDER_REJECTED");

  const throwClient: ResendClientLike = {
    emails: {
      async send() {
        throw new Error("network down");
      },
    },
  };
  const threw = await createResendProvider({
    client: throwClient,
    dryRun: false,
  }).sendEmail({
    to: { email: "runner@example.com" },
    from: { email: "noreply@example.com" },
    subject: "Err",
  });
  assert.equal(threw.status, "failed");
  assert.equal(threw.errorCode, "SEND_FAILED");

  const noIdClient: ResendClientLike = {
    emails: {
      async send() {
        return { data: {}, error: null };
      },
    },
  };
  const noId = await createResendProvider({
    client: noIdClient,
    dryRun: false,
  }).sendEmail({
    to: { email: "runner@example.com" },
    from: { email: "noreply@example.com" },
    subject: "Sin id",
  });
  assert.equal(noId.status, "failed");
  assert.equal(noId.errorCode, "PROVIDER_RESPONSE_INVALID");
});

test("ResendProvider live sin client → configuración faltante (vía send)", async () => {
  const provider = createResendProvider({ dryRun: false });
  const result = await provider.send({
    to: { email: "runner@example.com" },
    from: { email: "noreply@example.com" },
    subject: "Live",
    dryRun: false,
  });
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "CONFIGURATION_ERROR");
});

test("logger sanitiza metadata sensible", () => {
  const cleaned = sanitizeLogMetadata({
    apiKey: "secret-value",
    token: "abc",
    email: "person@example.com",
    html: "<p>hola</p>",
    channel: "email",
    toCount: 1,
  });
  assert.equal(cleaned?.apiKey, undefined);
  assert.equal(cleaned?.token, undefined);
  assert.equal(cleaned?.email, undefined);
  assert.equal(cleaned?.html, undefined);
  assert.equal(cleaned?.channel, "email");
  assert.equal(cleaned?.toCount, 1);

  const logger = createCommunicationLogger();
  logger.info("test", { password: "x", provider: "memory-mail" });
  const entry = logger.entries()[0]!;
  assert.equal(entry.metadata?.password, undefined);
  assert.equal(entry.metadata?.provider, "memory-mail");
});

test("API default registerCommunicationProvider + remove/clear", () => {
  clearProviders();
  try {
    registerCommunicationProvider("email", createMemoryEmailProvider());
    assert.equal(removeProvider("email"), true);
    registerCommunicationProvider("email", createMemoryEmailProvider());
    assert.equal(removeProvider("email"), true);
  } finally {
    clearProviders();
  }
});

test("instancias de fachada no comparten registry", async () => {
  const a = createCommunicationsFacade();
  const b = createCommunicationsFacade();
  a.registerProvider("email", createMemoryEmailProvider());
  assert.equal(a.hasProvider("email"), true);
  assert.equal(b.hasProvider("email"), false);
});
