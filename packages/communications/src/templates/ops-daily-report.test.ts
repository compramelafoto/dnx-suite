import assert from "node:assert/strict";
import { test } from "node:test";

import { createEmailTemplateEngine } from "../index";

const BASE = {
  reportDate: "23/08/2026",
  status: "Completo",
  criticalCount: 0,
  alertsBlock: "Sin alertas para atender.",
  summaryBlock: "Pedidos pagados: 12",
};

function render(data: unknown) {
  const engine = createEmailTemplateEngine();
  return engine.render({
    templateId: "ops.daily-report",
    brandId: "dnx",
    locale: "es-AR",
    data,
  });
}

async function renderOk(data: unknown) {
  const result = await render(data);
  assert.equal(result.ok, true, `render falló: ${result.errorCode ?? ""}`);
  return result;
}

test("la plantilla queda registrada por defecto en el módulo", async () => {
  const result = await render(BASE);

  assert.equal(result.ok, true);
});

test("el asunto incluye la fecha del informe", async () => {
  const rendered = await renderOk(BASE);

  assert.match(rendered.subject ?? "", /23\/08\/2026/);
});

test("el asunto avisa cuántas alertas críticas hay", async () => {
  const rendered = await renderOk({ ...BASE, criticalCount: 3 });

  assert.match(rendered.subject ?? "", /3 alertas críticas/);
});

test("una sola alerta crítica se anuncia en singular", async () => {
  const rendered = await renderOk({ ...BASE, criticalCount: 1 });

  assert.match(rendered.subject ?? "", /1 alerta crítica/);
});

test("sin alertas críticas el asunto no las menciona", async () => {
  const rendered = await renderOk(BASE);

  assert.doesNotMatch(rendered.subject ?? "", /crítica/i);
});

test("el cuerpo HTML incluye las alertas y el resumen", async () => {
  const rendered = await renderOk({
    ...BASE,
    alertsBlock: "Cola de correos trabada",
    summaryBlock: "Facturacion: 120.000 ARS",
  });

  assert.match(rendered.html ?? "", /Cola de correos trabada/);
  assert.match(rendered.html ?? "", /120\.000 ARS/);
});

test("la versión en texto plano también trae el contenido", async () => {
  const rendered = await renderOk({ ...BASE, alertsBlock: "Pagos sin conciliar" });

  assert.match(rendered.text ?? "", /Pagos sin conciliar/);
  assert.match(rendered.text ?? "", /23\/08\/2026/);
});

test("incluye el botón al panel cuando se pasa la URL", async () => {
  const rendered = await renderOk({
    ...BASE,
    panelUrl: "https://compramelafoto.com/admin/informe-diario",
  });

  assert.match(rendered.html ?? "", /informe-diario/);
});

test("rechaza un informe sin fecha", async () => {
  const result = await render({ ...BASE, reportDate: "" });

  assert.equal(result.ok, false);
});

test("rechaza un conteo de alertas que no es número", async () => {
  const result = await render({ ...BASE, criticalCount: "tres" });

  assert.equal(result.ok, false);
});

test("muestra la nota cuando hubo secciones que fallaron", async () => {
  const rendered = await renderOk({
    ...BASE,
    failedSectionsNote: "No se pudo obtener: FotOffice",
  });

  assert.match(rendered.html ?? "", /No se pudo obtener: FotOffice/);
  assert.match(rendered.text ?? "", /No se pudo obtener: FotOffice/);
});
