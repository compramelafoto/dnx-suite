import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertSafeUrl,
  CommunicationError,
  createCommunicationsFacade,
  createEmailTemplateEngine,
  createTemplateRegistry,
  escapeHtml,
  failedResult,
  successResult,
  systemTestTemplate,
  type CommunicationProvider,
  type CommunicationResult,
} from "../index";

function memoryProvider(
  onSend?: (input: { subject?: string; html?: string; text?: string }) => void,
): CommunicationProvider {
  return {
    name: "memory-mail",
    channel: "email",
    async send(input): Promise<CommunicationResult> {
      onSend?.({
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return successResult({
        channel: "email",
        provider: "memory-mail",
        providerMessageId: "mem_tpl_1",
      });
    },
  };
}

test("template registry: register / duplicate / missing / remove / clear", () => {
  const registry = createTemplateRegistry();
  registry.registerTemplate(systemTestTemplate as never);
  assert.equal(registry.hasTemplate("system.test"), true);
  assert.throws(
    () => registry.registerTemplate(systemTestTemplate as never),
    (error: unknown) =>
      error instanceof CommunicationError &&
      error.code === "TEMPLATE_ALREADY_REGISTERED",
  );
  registry.registerTemplate(systemTestTemplate as never, { replace: true });
  assert.throws(
    () => registry.getTemplate("missing.template"),
    (error: unknown) =>
      error instanceof CommunicationError && error.code === "TEMPLATE_NOT_FOUND",
  );
  assert.equal(registry.removeTemplate("system.test"), true);
  registry.registerTemplate(systemTestTemplate as never);
  registry.clearTemplates();
  assert.equal(registry.hasTemplate("system.test"), false);
});

test("system.test: payload válido e inválido", () => {
  const engine = createEmailTemplateEngine();
  const valid = engine.getTemplate("system.test").validate({
    recipientName: "Ada",
    message: "Todo ok",
  });
  assert.equal(valid.ok, true);

  const invalid = engine.getTemplate("system.test").validate({
    recipientName: "Ada",
  });
  assert.equal(invalid.ok, false);
});

test("system.test: render HTML/texto/subject con brandings", async () => {
  const engine = createEmailTemplateEngine();

  for (const brandId of ["dnx", "clickaton", "compramelafoto"] as const) {
    const result = await engine.render({
      templateId: "system.test",
      brandId,
      locale: "es-AR",
      data: {
        recipientName: "Usuario de prueba",
        message: "El sistema funciona correctamente.",
        actionLabel: "Abrir",
        actionUrl: "https://example.com/test",
      },
    });

    assert.equal(result.ok, true, brandId);
    assert.ok(result.subject?.includes("DNX Communications") || result.subject);
    assert.ok(result.html?.includes("Usuario de prueba"));
    assert.ok(result.html?.includes("El sistema funciona correctamente."));
    assert.ok(result.html?.includes("https://example.com/test"));
    assert.ok(result.text?.includes("Usuario de prueba"));
    assert.equal(result.brandId, brandId);
    assert.equal(result.locale, "es-AR");
    assert.equal(result.templateId, "system.test");
    assert.ok(result.message?.html);
  }

  const clickaton = await engine.render({
    templateId: "system.test",
    brandId: "clickaton",
    locale: "es-AR",
    data: {
      recipientName: "Runner",
      message: "Clickatón branding",
    },
  });
  assert.ok(clickaton.html?.includes("#FFE600") || clickaton.html?.includes("#3B1F6E"));
});

test("user.welcome: render + CTA opcional", async () => {
  const engine = createEmailTemplateEngine();
  const withoutCta = await engine.render({
    templateId: "user.welcome",
    brandId: "dnx",
    locale: "es-AR",
    data: {
      recipientName: "Grace",
      platformName: "DNX Suite",
    },
  });
  assert.equal(withoutCta.ok, true);
  assert.ok(withoutCta.subject?.includes("DNX Suite"));
  assert.ok(!withoutCta.html?.includes("https://example.com/login"));
  assert.ok(!withoutCta.text?.includes("Ingresar:"));

  const withCta = await engine.render({
    templateId: "user.welcome",
    brandId: "compramelafoto",
    locale: "es-AR",
    allowHttp: true,
    data: {
      recipientName: "Grace",
      platformName: "ComprameLaFoto",
      loginUrl: "https://example.com/login",
      supportUrl: "https://example.com/support",
    },
  });
  assert.equal(withCta.ok, true);
  assert.ok(withCta.html?.includes("https://example.com/login"));
  assert.ok(withCta.text?.includes("https://example.com/support"));
});

test("locale es-AR ok; desconocido falla tipado", async () => {
  const engine = createEmailTemplateEngine();
  const ok = await engine.render({
    templateId: "system.test",
    brandId: "dnx",
    locale: "es-AR",
    data: { recipientName: "A", message: "B" },
  });
  assert.equal(ok.ok, true);

  const bad = await engine.render({
    templateId: "system.test",
    brandId: "dnx",
    locale: "pt-BR",
    data: { recipientName: "A", message: "B" },
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.errorCode, "LOCALE_NOT_SUPPORTED");
});

test("branding inexistente", async () => {
  const engine = createEmailTemplateEngine();
  const result = await engine.render({
    templateId: "system.test",
    brandId: "fotorank",
    locale: "es-AR",
    data: { recipientName: "A", message: "B" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "BRAND_NOT_FOUND");
});

test("escape HTML en payloads", async () => {
  const engine = createEmailTemplateEngine();
  const payload = {
    recipientName: `<script>alert("x")</script>`,
    message: `Hola & bienvenido <b>raw</b> "comillas" 'simples'`,
  };
  const result = await engine.render({
    templateId: "system.test",
    brandId: "dnx",
    locale: "es-AR",
    data: payload,
  });
  assert.equal(result.ok, true);
  assert.ok(!result.html?.includes("<script>"));
  assert.ok(result.html?.includes(escapeHtml(payload.recipientName)));
  assert.ok(result.html?.includes("&amp;"));
  assert.ok(result.html?.includes("&lt;b&gt;"));
  assert.ok(result.html?.includes("&quot;"));
  assert.ok(result.html?.includes("&#39;"));
});

test("bloqueo de URL insegura", () => {
  assert.throws(
    () => assertSafeUrl("javascript:alert(1)"),
    (error: unknown) =>
      error instanceof CommunicationError && error.code === "UNSAFE_URL",
  );
  assert.throws(
    () => assertSafeUrl("data:text/html,hi"),
    (error: unknown) =>
      error instanceof CommunicationError && error.code === "UNSAFE_URL",
  );
  assert.throws(
    () => assertSafeUrl("http://example.com"),
    (error: unknown) =>
      error instanceof CommunicationError && error.code === "UNSAFE_URL",
  );
  assert.equal(
    assertSafeUrl("https://example.com/path"),
    "https://example.com/path",
  );
  assert.equal(
    assertSafeUrl("http://example.com", { allowHttp: true }),
    "http://example.com/",
  );
});

test("CTA con URL insegura falla el render", async () => {
  const engine = createEmailTemplateEngine();
  const result = await engine.render({
    templateId: "system.test",
    brandId: "dnx",
    locale: "es-AR",
    data: {
      recipientName: "Ada",
      message: "msg",
      actionUrl: "javascript:alert(1)",
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "UNSAFE_URL");
});

test("communications.preview y render", async () => {
  const facade = createCommunicationsFacade();
  const rendered = await facade.render({
    templateId: "system.test",
    brandId: "clickaton",
    locale: "es-AR",
    data: {
      recipientName: "Usuario de prueba",
      message: "El sistema funciona correctamente.",
    },
  });
  assert.equal(rendered.ok, true);
  assert.ok(rendered.html && rendered.text && rendered.subject);

  const preview = await facade.preview({
    templateId: "user.welcome",
    brandId: "dnx",
    locale: "es-AR",
    data: {
      recipientName: "Usuario de prueba",
      platformName: "DNX Suite",
    },
  });
  assert.equal(preview.ok, true);
  assert.ok(preview.warnings?.some((w) => w.includes("preview")));
});

test("flujo render → send con provider falso", async () => {
  const facade = createCommunicationsFacade();
  let captured: { subject?: string; html?: string; text?: string } | undefined;
  facade.registerProvider("email", memoryProvider((payload) => {
    captured = payload;
  }));

  const rendered = await facade.render({
    templateId: "system.test",
    brandId: "clickaton",
    locale: "es-AR",
    data: {
      recipientName: "Usuario de prueba",
      message: "El sistema funciona correctamente.",
      actionUrl: "https://example.com/cta",
    },
  });
  assert.equal(rendered.ok, true);

  const result = await facade.send({
    channel: "email",
    to: [{ email: "test@example.com" }],
    from: { email: "no-reply@example.com", name: "Clickatón" },
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  assert.equal(result.status, "success");
  assert.equal(result.provider, "memory-mail");
  assert.equal(captured?.subject, rendered.subject);
  assert.ok(captured?.html?.includes("Usuario de prueba"));
  assert.ok(captured?.text?.includes("El sistema funciona correctamente."));
});

test("render fallido no se marca success ni se envía como ok", async () => {
  const facade = createCommunicationsFacade();
  facade.registerProvider("email", {
    name: "memory-mail",
    channel: "email",
    async send(): Promise<CommunicationResult> {
      return failedResult({
        channel: "email",
        provider: "memory-mail",
        errorCode: "SEND_FAILED",
        errorMessage: "no debería llamarse con render fallido en este test",
      });
    },
  });

  const rendered = await facade.render({
    templateId: "system.test",
    brandId: "missing-brand",
    data: { recipientName: "A", message: "B" },
  });
  assert.equal(rendered.ok, false);
  assert.notEqual(rendered.errorCode, undefined);
});
