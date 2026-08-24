import assert from "node:assert/strict";
import { test } from "node:test";

import type { ReportAlert, ReportSection } from "@repo/ops-daily-report";

import {
  formatReportDate,
  renderAlertsBlock,
  renderFailedSectionsNote,
  renderSummaryBlock,
} from "./render-blocks";

test("la fecha se muestra en formato argentino", () => {
  assert.equal(formatReportDate("2026-08-23"), "23/08/2026");
});

test("sin alertas se dice explícitamente que no hay nada para atender", () => {
  assert.match(renderAlertsBlock([]), /no hay alertas/i);
});

test("cada alerta muestra urgencia, plataforma y detalle", () => {
  const alerts: ReportAlert[] = [
    {
      id: "x",
      platform: "clf-monorepo",
      title: "Cola de correos trabada",
      detail: "Hay 40 correos sin enviar.",
      severity: "critical",
      urgency: "immediate",
      affectedCount: 40,
      since: null,
    },
  ];

  const block = renderAlertsBlock(alerts);

  assert.match(block, /Atender ahora/);
  assert.match(block, /ComprameLaFoto/);
  assert.match(block, /Cola de correos trabada/);
  assert.match(block, /40 correos sin enviar/);
});

test("la alerta incluye el enlace para resolverla cuando lo tiene", () => {
  const alerts: ReportAlert[] = [
    {
      id: "x",
      platform: "platform",
      title: "Pagos sin conciliar",
      detail: "Hay 3 pedidos.",
      severity: "critical",
      urgency: "immediate",
      affectedCount: 3,
      since: null,
      actionUrl: "https://compramelafoto.com/admin/pagos-mp-anomalias",
    },
  ];

  assert.match(renderAlertsBlock(alerts), /pagos-mp-anomalias/);
});

test("el resumen lista las métricas con su variación", () => {
  const sections: ReportSection[] = [
    {
      key: "clf-monorepo",
      title: "ComprameLaFoto",
      status: "ok",
      error: null,
      groups: [
        {
          title: "Ventas",
          metrics: [
            {
              key: "paidOrders",
              label: "Pedidos pagados",
              value: 12,
              format: "count",
              previousValue: 10,
              sevenDayAverage: 8,
              changeRatio: 0.2,
            },
          ],
        },
      ],
      tables: [],
    },
  ];

  const block = renderSummaryBlock(sections);

  assert.match(block, /ComprameLaFoto/);
  assert.match(block, /Pedidos pagados/);
  assert.match(block, /12/);
  assert.match(block, /\+20 %/);
});

test("los montos en pesos se muestran con separador de miles", () => {
  const sections: ReportSection[] = [
    {
      key: "clf-monorepo",
      title: "ComprameLaFoto",
      status: "ok",
      error: null,
      groups: [
        {
          title: "Ventas",
          metrics: [
            {
              key: "revenueArs",
              label: "Facturación",
              value: 1_250_000,
              format: "currencyArs",
              previousValue: null,
              sevenDayAverage: null,
              changeRatio: null,
            },
          ],
        },
      ],
      tables: [],
    },
  ];

  assert.match(renderSummaryBlock(sections), /1\.250\.000/);
});

test("una tabla vacía muestra su mensaje en lugar de quedar en blanco", () => {
  const sections: ReportSection[] = [
    {
      key: "clf-monorepo",
      title: "ComprameLaFoto",
      status: "ok",
      error: null,
      groups: [],
      tables: [
        {
          title: "Top fotógrafos por facturación",
          columns: ["Nombre"],
          rows: [],
          emptyMessage: "Sin ventas en el día.",
        },
      ],
    },
  ];

  assert.match(renderSummaryBlock(sections), /Sin ventas en el día\./);
});

test("una sección caída no aparece en el resumen", () => {
  const sections: ReportSection[] = [
    {
      key: "fotoffice",
      title: "FotOffice",
      status: "failed",
      error: "timeout",
      groups: [],
      tables: [],
    },
  ];

  assert.doesNotMatch(renderSummaryBlock(sections), /FotOffice/);
});

test("una sección caída aparece en la nota de fallos", () => {
  const sections: ReportSection[] = [
    {
      key: "fotoffice",
      title: "FotOffice",
      status: "failed",
      error: "timeout",
      groups: [],
      tables: [],
    },
  ];

  assert.match(renderFailedSectionsNote(sections) ?? "", /FotOffice/);
});

test("sin secciones caídas no hay nota", () => {
  const sections: ReportSection[] = [
    { key: "a", title: "A", status: "ok", error: null, groups: [], tables: [] },
  ];

  assert.equal(renderFailedSectionsNote(sections), undefined);
});
