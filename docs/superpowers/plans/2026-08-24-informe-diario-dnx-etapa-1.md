# Informe Diario DNX — Etapa 1 — Plan de Implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Que todas las noches a las 00:00 de Argentina llegue a `dnxfotografia@gmail.com` un informe con las estadísticas de ComprameLaFoto (monorepo), los incidentes técnicos y la salud del reconocimiento facial, con alertas ordenadas por urgencia.

**Arquitectura:** Un paquete nuevo `@repo/ops-daily-report` contiene la lógica pura (ventana horaria, contratos, agregación, ranking de alertas, ensamblado). Los datos entran por **puertos** (interfaces), cuya implementación con Prisma vive en `apps/compramelafoto`. El envío usa una plantilla nueva `ops.daily-report` en `@repo/communications`. Una tarea programada de Vercel dispara todo.

**Stack:** TypeScript 5.9, Node 22, `node:test` vía `tsx --test`, Prisma 6, Next.js (App Router), Resend a través de `@repo/communications`.

**Spec:** `docs/superpowers/specs/2026-08-24-informe-diario-dnx-design.md`

## Restricciones globales

- **Idioma:** todos los comentarios, mensajes de error, textos de alerta y contenido del correo van en español. Los identificadores de código, en inglés, como en el resto del repo.
- **Zona horaria:** el día del informe es el día calendario de `America/Argentina/Buenos_Aires`. Ningún colector calcula fechas por su cuenta: todos reciben la ventana ya resuelta.
- **Cron de Vercel corre en UTC.** Para las 00:00 de Argentina la expresión es `0 3 * * *`. Nunca `0 0 * * *`.
- **`Order.totalCents` contiene pesos argentinos enteros, NO centavos.** El nombre quedó por compatibilidad histórica; está documentado así en `packages/db/prisma/schema.prisma`. Nunca dividir por 100.
- **`Order.isTest = true`** marca pedidos de simulación escolar. Se excluyen de toda métrica comercial.
- **`OrderItem.priceCents` y `OrderItem.subtotalCents`** siguen la misma convención histórica que `Order.totalCents`: son pesos enteros.
- **Tolerancia a fallos:** si un colector lanza una excepción, el informe se genera igual con esa sección marcada como fallida. Nunca dejar que un colector tumbe el informe completo.
- **El paquete nuevo no importa Prisma.** Solo tipos propios. La implementación con Prisma vive en la app.
- **Módulos ESM.** El repo usa `"type": "module"` en los paquetes; los imports relativos llevan extensión en los paquetes existentes solo cuando el paquete lo requiere — seguir el patrón de `@repo/communications`, que importa sin extensión (`from "./types"`).

---

### Task 1: Paquete `@repo/ops-daily-report` y ventana horaria argentina

**Archivos:**
- Crear: `packages/ops-daily-report/package.json`
- Crear: `packages/ops-daily-report/tsconfig.json`
- Crear: `packages/ops-daily-report/eslint.config.js`
- Crear: `packages/ops-daily-report/src/window/day-window.ts`
- Crear: `packages/ops-daily-report/src/window/day-window.test.ts`

**Interfaces:**
- Consume: nada.
- Produce:
  - `type DayWindow = { reportDate: string; current: DateRange; previous: DateRange; trailingSevenDays: DateRange; timeZone: string }`
  - `type DateRange = { start: Date; end: Date }`
  - `function resolveArgentinaDayWindow(now: Date): DayWindow`

- [ ] **Paso 1: Crear el andamiaje del paquete**

`packages/ops-daily-report/package.json`:

```json
{
  "name": "@repo/ops-daily-report",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "DNX Informe Diario — recolección de estadísticas, incidentes y alertas de la suite.",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./contracts": "./src/contracts/index.ts",
    "./window": "./src/window/day-window.ts"
  },
  "scripts": {
    "check-types": "tsc --noEmit -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "eslint .",
    "test": "pnpm exec tsx --test \"src/**/*.test.ts\""
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "^22.15.3",
    "eslint": "^9.39.1",
    "tsx": "^4.21.0",
    "typescript": "5.9.2"
  }
}
```

`packages/ops-daily-report/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true,
    "declaration": true,
    "declarationMap": false,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

`packages/ops-daily-report/eslint.config.js`:

```js
import { config as baseConfig } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ["dist/**", "node_modules/**"] },
  ...baseConfig,
];
```

- [ ] **Paso 2: Escribir el test que falla**

`packages/ops-daily-report/src/window/day-window.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveArgentinaDayWindow } from "./day-window";

test("el informe de las 03:00 UTC cubre el día argentino que acaba de terminar", () => {
  // 2026-08-24T03:00:00Z = 2026-08-24 00:00 en Argentina (UTC-3).
  const window = resolveArgentinaDayWindow(new Date("2026-08-24T03:00:00.000Z"));

  assert.equal(window.reportDate, "2026-08-23");
  assert.equal(window.current.start.toISOString(), "2026-08-23T03:00:00.000Z");
  assert.equal(window.current.end.toISOString(), "2026-08-24T03:00:00.000Z");
});

test("la ventana previa es el día anterior completo", () => {
  const window = resolveArgentinaDayWindow(new Date("2026-08-24T03:00:00.000Z"));

  assert.equal(window.previous.start.toISOString(), "2026-08-22T03:00:00.000Z");
  assert.equal(window.previous.end.toISOString(), "2026-08-23T03:00:00.000Z");
});

test("la ventana de siete días termina donde empieza el día informado", () => {
  const window = resolveArgentinaDayWindow(new Date("2026-08-24T03:00:00.000Z"));

  assert.equal(window.trailingSevenDays.start.toISOString(), "2026-08-16T03:00:00.000Z");
  assert.equal(window.trailingSevenDays.end.toISOString(), "2026-08-23T03:00:00.000Z");
});

test("una ejecución a media mañana sigue informando el día anterior", () => {
  // 2026-08-24T14:30:00Z = 2026-08-24 11:30 en Argentina.
  const window = resolveArgentinaDayWindow(new Date("2026-08-24T14:30:00.000Z"));

  assert.equal(window.reportDate, "2026-08-23");
  assert.equal(window.current.end.toISOString(), "2026-08-24T03:00:00.000Z");
});

test("cruce de mes: el 1 de septiembre informa el 31 de agosto", () => {
  const window = resolveArgentinaDayWindow(new Date("2026-09-01T03:00:00.000Z"));

  assert.equal(window.reportDate, "2026-08-31");
  assert.equal(window.current.start.toISOString(), "2026-08-31T03:00:00.000Z");
});

test("cruce de año: el 1 de enero informa el 31 de diciembre", () => {
  const window = resolveArgentinaDayWindow(new Date("2027-01-01T03:00:00.000Z"));

  assert.equal(window.reportDate, "2026-12-31");
});

test("justo antes de la medianoche argentina todavía se informa el día anteanterior", () => {
  // 2026-08-24T02:59:00Z = 2026-08-23 23:59 en Argentina.
  const window = resolveArgentinaDayWindow(new Date("2026-08-24T02:59:00.000Z"));

  assert.equal(window.reportDate, "2026-08-22");
});
```

- [ ] **Paso 3: Correr el test y verificar que falla**

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite
pnpm --filter @repo/ops-daily-report test
```

Esperado: FALLA con un error de módulo no encontrado (`./day-window`).

Si el patrón `"src/**/*.test.ts"` no expande, reemplazar el script `test` del `package.json` por la lista explícita de archivos, como hace `@repo/communications`.

- [ ] **Paso 4: Implementar**

`packages/ops-daily-report/src/window/day-window.ts`:

```ts
/**
 * Resolución del día calendario argentino para el informe diario.
 *
 * El cron corre en UTC. Argentina es UTC-3 sin horario de verano desde 2009,
 * pero el offset se calcula con Intl en lugar de fijarlo a mano, para que un
 * cambio futuro de política horaria no rompa el informe en silencio.
 */

export const REPORT_TIME_ZONE = "America/Argentina/Buenos_Aires";

const MS_PER_DAY = 86_400_000;

export type DateRange = {
  start: Date;
  end: Date;
};

export type DayWindow = {
  /** Día informado en formato YYYY-MM-DD, calendario argentino. */
  reportDate: string;
  /** El día que acaba de terminar. */
  current: DateRange;
  /** El día anterior al informado, para comparar. */
  previous: DateRange;
  /** Los siete días previos al informado, para el promedio. */
  trailingSevenDays: DateRange;
  timeZone: string;
};

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(instant: Date): ZonedParts {
  const parts = partsFormatter.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    if (!found) {
      throw new Error(`No se pudo leer el componente horario "${type}".`);
    }
    return Number(found.value);
  };

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/** Diferencia entre la hora argentina y UTC, en milisegundos (negativa para UTC-3). */
function zoneOffsetMs(instant: Date): number {
  const parts = zonedParts(instant);
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  // Se descartan los milisegundos del instante original: el offset siempre es
  // múltiplo de un minuto, así que no afectan el resultado.
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return asIfUtc - truncated;
}

/** Instante UTC correspondiente a la medianoche argentina de la fecha dada. */
function argentinaMidnight(year: number, month: number, day: number): Date {
  const naive = Date.UTC(year, month - 1, day);
  // Primera aproximación con el offset del propio instante, luego se corrige.
  const firstGuess = new Date(naive + 3 * 60 * 60 * 1000);
  const offset = zoneOffsetMs(firstGuess);
  return new Date(naive - offset);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function resolveArgentinaDayWindow(now: Date): DayWindow {
  if (Number.isNaN(now.getTime())) {
    throw new Error("resolveArgentinaDayWindow recibió una fecha inválida.");
  }

  const today = zonedParts(now);
  const todayMidnight = argentinaMidnight(today.year, today.month, today.day);

  // El día informado es el que terminó: desde su medianoche hasta la de hoy.
  const currentEnd = todayMidnight;
  const reportedDayParts = zonedParts(new Date(currentEnd.getTime() - MS_PER_DAY / 2));
  const currentStart = argentinaMidnight(
    reportedDayParts.year,
    reportedDayParts.month,
    reportedDayParts.day,
  );

  const previousDayParts = zonedParts(new Date(currentStart.getTime() - MS_PER_DAY / 2));
  const previousStart = argentinaMidnight(
    previousDayParts.year,
    previousDayParts.month,
    previousDayParts.day,
  );

  const sevenDaysAgoParts = zonedParts(
    new Date(currentStart.getTime() - 7 * MS_PER_DAY + MS_PER_DAY / 2),
  );
  const trailingStart = argentinaMidnight(
    sevenDaysAgoParts.year,
    sevenDaysAgoParts.month,
    sevenDaysAgoParts.day,
  );

  return {
    reportDate: `${reportedDayParts.year}-${pad(reportedDayParts.month)}-${pad(reportedDayParts.day)}`,
    current: { start: currentStart, end: currentEnd },
    previous: { start: previousStart, end: currentStart },
    trailingSevenDays: { start: trailingStart, end: currentStart },
    timeZone: REPORT_TIME_ZONE,
  };
}
```

- [ ] **Paso 5: Correr el test y verificar que pasa**

```bash
pnpm --filter @repo/ops-daily-report test
```

Esperado: los 7 tests en verde.

- [ ] **Paso 6: Instalar dependencias del workspace y verificar tipos**

```bash
pnpm install
pnpm --filter @repo/ops-daily-report typecheck
pnpm --filter @repo/ops-daily-report lint
```

Esperado: sin errores.

- [ ] **Paso 7: Commit**

```bash
git add packages/ops-daily-report pnpm-lock.yaml
git commit -m "feat(ops-report): paquete base y ventana horaria argentina"
```

---

### Task 2: Contratos del informe (métrica, alerta, sección, snapshot)

**Archivos:**
- Crear: `packages/ops-daily-report/src/contracts/metric.ts`
- Crear: `packages/ops-daily-report/src/contracts/alert.ts`
- Crear: `packages/ops-daily-report/src/contracts/snapshot.ts`
- Crear: `packages/ops-daily-report/src/contracts/index.ts`
- Crear: `packages/ops-daily-report/src/contracts/metric.test.ts`

**Interfaces:**
- Consume: `DayWindow` de la Task 1.
- Produce:
  - `type MetricFormat = "count" | "currencyArs" | "percent" | "duration"`
  - `type ReportMetric = { key: string; label: string; value: number; format: MetricFormat; previousValue: number | null; sevenDayAverage: number | null; changeRatio: number | null; hint?: string }`
  - `function buildMetric(input: BuildMetricInput): ReportMetric`
  - `type AlertSeverity = "critical" | "high" | "medium" | "low"`
  - `type AlertUrgency = "immediate" | "today" | "thisWeek" | "informational"`
  - `type ReportAlert = { id: string; platform: PlatformKey; title: string; detail: string; severity: AlertSeverity; urgency: AlertUrgency; affectedCount: number | null; since: string | null; actionUrl?: string }`
  - `type PlatformKey = "clf-monorepo" | "clf-legacy" | "clickaton" | "fotorank" | "infospot" | "fotoffice" | "platform"`
  - `type ReportSection = { key: string; title: string; status: "ok" | "failed"; error: string | null; groups: MetricGroup[]; tables: ReportTable[] }`
  - `type MetricGroup = { title: string; metrics: ReportMetric[] }`
  - `type ReportTable = { title: string; columns: string[]; rows: Array<Array<string | number>>; emptyMessage: string }`
  - `type DailyReportSnapshot = { reportDate: string; timeZone: string; generatedAt: string; generationMs: number; status: "complete" | "partial" | "failed"; sections: ReportSection[]; alerts: ReportAlert[]; failedSections: string[] }`

- [ ] **Paso 1: Escribir el test que falla**

`packages/ops-daily-report/src/contracts/metric.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { buildMetric } from "./metric";

test("calcula la variación contra el día anterior", () => {
  const metric = buildMetric({
    key: "paidOrders",
    label: "Pedidos pagados",
    value: 12,
    format: "count",
    previousValue: 10,
    sevenDayAverage: 8,
  });

  assert.equal(metric.changeRatio, 0.2);
});

test("sin día anterior no hay variación", () => {
  const metric = buildMetric({
    key: "paidOrders",
    label: "Pedidos pagados",
    value: 12,
    format: "count",
    previousValue: null,
    sevenDayAverage: null,
  });

  assert.equal(metric.changeRatio, null);
});

test("si ayer fue cero no se inventa un porcentaje infinito", () => {
  const metric = buildMetric({
    key: "paidOrders",
    label: "Pedidos pagados",
    value: 5,
    format: "count",
    previousValue: 0,
    sevenDayAverage: 1,
  });

  assert.equal(metric.changeRatio, null);
});

test("una caída se expresa como variación negativa", () => {
  const metric = buildMetric({
    key: "revenue",
    label: "Facturación",
    value: 50_000,
    format: "currencyArs",
    previousValue: 100_000,
    sevenDayAverage: 80_000,
  });

  assert.equal(metric.changeRatio, -0.5);
});

test("rechaza valores no finitos en lugar de propagar NaN al correo", () => {
  assert.throws(
    () =>
      buildMetric({
        key: "roto",
        label: "Roto",
        value: Number.NaN,
        format: "count",
        previousValue: null,
        sevenDayAverage: null,
      }),
    /valor no finito/i,
  );
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
pnpm --filter @repo/ops-daily-report test
```

Esperado: FALLA con módulo `./metric` no encontrado.

- [ ] **Paso 3: Implementar los contratos**

`packages/ops-daily-report/src/contracts/metric.ts`:

```ts
/** Cómo se muestra la métrica en el correo y en el panel. */
export type MetricFormat = "count" | "currencyArs" | "percent" | "duration";

export type ReportMetric = {
  key: string;
  label: string;
  value: number;
  format: MetricFormat;
  /** Mismo valor para el día anterior; null si no se pudo calcular. */
  previousValue: number | null;
  /** Promedio diario de los siete días previos; null si no se pudo calcular. */
  sevenDayAverage: number | null;
  /** Variación relativa contra el día anterior (0.2 = +20 %); null si no aplica. */
  changeRatio: number | null;
  /** Aclaración corta para el lector, opcional. */
  hint?: string;
};

export type BuildMetricInput = {
  key: string;
  label: string;
  value: number;
  format: MetricFormat;
  previousValue: number | null;
  sevenDayAverage: number | null;
  hint?: string;
};

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`La métrica recibió un valor no finito en "${field}".`);
  }
}

export function buildMetric(input: BuildMetricInput): ReportMetric {
  assertFinite(input.value, input.key);
  if (input.previousValue !== null) assertFinite(input.previousValue, `${input.key}.previousValue`);
  if (input.sevenDayAverage !== null) {
    assertFinite(input.sevenDayAverage, `${input.key}.sevenDayAverage`);
  }

  // Con base cero cualquier porcentaje es engañoso: se prefiere no mostrarlo.
  const changeRatio =
    input.previousValue === null || input.previousValue === 0
      ? null
      : (input.value - input.previousValue) / input.previousValue;

  return {
    key: input.key,
    label: input.label,
    value: input.value,
    format: input.format,
    previousValue: input.previousValue,
    sevenDayAverage: input.sevenDayAverage,
    changeRatio,
    ...(input.hint ? { hint: input.hint } : {}),
  };
}
```

`packages/ops-daily-report/src/contracts/alert.ts`:

```ts
export type PlatformKey =
  | "clf-monorepo"
  | "clf-legacy"
  | "clickaton"
  | "fotorank"
  | "infospot"
  | "fotoffice"
  /** Transversal a toda la suite. */
  | "platform";

export const PLATFORM_LABELS: Record<PlatformKey, string> = {
  "clf-monorepo": "ComprameLaFoto",
  "clf-legacy": "ComprameLaFoto (legacy)",
  clickaton: "Clickatón",
  fotorank: "FotoRank",
  infospot: "Info Spot",
  fotoffice: "FotOffice",
  platform: "Plataforma",
};

/** Cuánto duele si no se atiende. */
export type AlertSeverity = "critical" | "high" | "medium" | "low";

/** Cuánto puede esperar. */
export type AlertUrgency = "immediate" | "today" | "thisWeek" | "informational";

export type ReportAlert = {
  id: string;
  platform: PlatformKey;
  title: string;
  detail: string;
  severity: AlertSeverity;
  urgency: AlertUrgency;
  /** Cuántos casos abarca; null si no aplica. */
  affectedCount: number | null;
  /** ISO-8601 del caso más antiguo; null si no se conoce. */
  since: string | null;
  /** Enlace directo a la pantalla donde se resuelve. */
  actionUrl?: string;
};

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const URGENCY_LABELS: Record<AlertUrgency, string> = {
  immediate: "Atender ahora",
  today: "Atender hoy",
  thisWeek: "Esta semana",
  informational: "Informativa",
};
```

`packages/ops-daily-report/src/contracts/snapshot.ts`:

```ts
import type { ReportAlert } from "./alert";
import type { ReportMetric } from "./metric";

export type MetricGroup = {
  title: string;
  metrics: ReportMetric[];
};

export type ReportTable = {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  /** Qué mostrar cuando no hubo datos ese día. */
  emptyMessage: string;
};

export type ReportSection = {
  key: string;
  title: string;
  status: "ok" | "failed";
  /** Mensaje del error cuando status es "failed"; null si salió bien. */
  error: string | null;
  groups: MetricGroup[];
  tables: ReportTable[];
};

export type DailyReportStatus = "complete" | "partial" | "failed";

export type DailyReportSnapshot = {
  reportDate: string;
  timeZone: string;
  generatedAt: string;
  generationMs: number;
  status: DailyReportStatus;
  sections: ReportSection[];
  /** Ya ordenadas por urgencia y gravedad. */
  alerts: ReportAlert[];
  /** Claves de las secciones que fallaron. */
  failedSections: string[];
};
```

`packages/ops-daily-report/src/contracts/index.ts`:

```ts
export {
  buildMetric,
  type BuildMetricInput,
  type MetricFormat,
  type ReportMetric,
} from "./metric";

export {
  PLATFORM_LABELS,
  SEVERITY_LABELS,
  URGENCY_LABELS,
  type AlertSeverity,
  type AlertUrgency,
  type PlatformKey,
  type ReportAlert,
} from "./alert";

export type {
  DailyReportSnapshot,
  DailyReportStatus,
  MetricGroup,
  ReportSection,
  ReportTable,
} from "./snapshot";
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

```bash
pnpm --filter @repo/ops-daily-report test
```

Esperado: 12 tests en verde (7 de la Task 1 + 5 nuevos).

- [ ] **Paso 5: Commit**

```bash
git add packages/ops-daily-report/src/contracts
git commit -m "feat(ops-report): contratos de métricas, alertas y snapshot"
```

---

### Task 3: Motor de orden de alertas

**Archivos:**
- Crear: `packages/ops-daily-report/src/alerts/rank.ts`
- Crear: `packages/ops-daily-report/src/alerts/rank.test.ts`

**Interfaces:**
- Consume: `ReportAlert`, `AlertSeverity`, `AlertUrgency` de la Task 2.
- Produce: `function rankAlerts(alerts: ReportAlert[]): ReportAlert[]`, `function alertScore(alert: ReportAlert): number`

- [ ] **Paso 1: Escribir el test que falla**

`packages/ops-daily-report/src/alerts/rank.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import type { ReportAlert } from "../contracts/alert";
import { rankAlerts } from "./rank";

function alert(overrides: Partial<ReportAlert> & { id: string }): ReportAlert {
  return {
    platform: "platform",
    title: "Título",
    detail: "Detalle",
    severity: "medium",
    urgency: "today",
    affectedCount: null,
    since: null,
    ...overrides,
  };
}

test("la urgencia pesa más que la gravedad", () => {
  const ranked = rankAlerts([
    alert({ id: "critica-lenta", severity: "critical", urgency: "thisWeek" }),
    alert({ id: "alta-ya", severity: "high", urgency: "immediate" }),
  ]);

  assert.deepEqual(
    ranked.map((item) => item.id),
    ["alta-ya", "critica-lenta"],
  );
});

test("con la misma urgencia manda la gravedad", () => {
  const ranked = rankAlerts([
    alert({ id: "media", severity: "medium", urgency: "immediate" }),
    alert({ id: "critica", severity: "critical", urgency: "immediate" }),
  ]);

  assert.deepEqual(
    ranked.map((item) => item.id),
    ["critica", "media"],
  );
});

test("a igual urgencia y gravedad, primero la que afecta a más casos", () => {
  const ranked = rankAlerts([
    alert({ id: "pocos", severity: "high", urgency: "today", affectedCount: 3 }),
    alert({ id: "muchos", severity: "high", urgency: "today", affectedCount: 120 }),
  ]);

  assert.deepEqual(
    ranked.map((item) => item.id),
    ["muchos", "pocos"],
  );
});

test("el desempate final es estable por identificador", () => {
  const ranked = rankAlerts([
    alert({ id: "b", severity: "low", urgency: "informational" }),
    alert({ id: "a", severity: "low", urgency: "informational" }),
  ]);

  assert.deepEqual(
    ranked.map((item) => item.id),
    ["a", "b"],
  );
});

test("no modifica el arreglo recibido", () => {
  const original = [
    alert({ id: "z", severity: "low", urgency: "informational" }),
    alert({ id: "a", severity: "critical", urgency: "immediate" }),
  ];
  rankAlerts(original);

  assert.equal(original[0]!.id, "z");
});

test("una lista vacía devuelve una lista vacía", () => {
  assert.deepEqual(rankAlerts([]), []);
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
pnpm --filter @repo/ops-daily-report test
```

Esperado: FALLA con módulo `./rank` no encontrado.

- [ ] **Paso 3: Implementar**

`packages/ops-daily-report/src/alerts/rank.ts`:

```ts
import type { AlertSeverity, AlertUrgency, ReportAlert } from "../contracts/alert";

/**
 * La urgencia se multiplica por un factor mayor que la gravedad a propósito:
 * algo gravísimo que puede esperar a la semana que viene no debe tapar algo
 * serio que hay que atender ahora mismo.
 */
const URGENCY_WEIGHT: Record<AlertUrgency, number> = {
  immediate: 400,
  today: 300,
  thisWeek: 200,
  informational: 100,
};

const SEVERITY_WEIGHT: Record<AlertSeverity, number> = {
  critical: 40,
  high: 30,
  medium: 20,
  low: 10,
};

export function alertScore(alert: ReportAlert): number {
  return URGENCY_WEIGHT[alert.urgency] + SEVERITY_WEIGHT[alert.severity];
}

export function rankAlerts(alerts: ReportAlert[]): ReportAlert[] {
  return [...alerts].sort((left, right) => {
    const byScore = alertScore(right) - alertScore(left);
    if (byScore !== 0) return byScore;

    const byCount = (right.affectedCount ?? 0) - (left.affectedCount ?? 0);
    if (byCount !== 0) return byCount;

    return left.id.localeCompare(right.id);
  });
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

```bash
pnpm --filter @repo/ops-daily-report test
```

Esperado: 18 tests en verde.

- [ ] **Paso 5: Commit**

```bash
git add packages/ops-daily-report/src/alerts
git commit -m "feat(ops-report): orden de alertas por urgencia y gravedad"
```

---

### Task 4: Ejecución tolerante a fallos de colectores

**Archivos:**
- Crear: `packages/ops-daily-report/src/report/run-collector.ts`
- Crear: `packages/ops-daily-report/src/report/run-collector.test.ts`

**Interfaces:**
- Consume: `ReportSection` de la Task 2.
- Produce:
  - `type CollectorResult = { section: ReportSection; alerts: ReportAlert[] }`
  - `type Collector = { key: string; title: string; run: () => Promise<CollectorResult> }`
  - `function runCollector(collector: Collector): Promise<CollectorResult>`

- [ ] **Paso 1: Escribir el test que falla**

`packages/ops-daily-report/src/report/run-collector.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { runCollector } from "./run-collector";

test("devuelve la sección cuando el colector funciona", async () => {
  const result = await runCollector({
    key: "ventas",
    title: "Ventas",
    async run() {
      return {
        section: {
          key: "ventas",
          title: "Ventas",
          status: "ok",
          error: null,
          groups: [],
          tables: [],
        },
        alerts: [],
      };
    },
  });

  assert.equal(result.section.status, "ok");
  assert.equal(result.section.error, null);
});

test("un colector que explota no tumba el informe", async () => {
  const result = await runCollector({
    key: "fotoffice",
    title: "FotOffice",
    async run() {
      throw new Error("la consulta se cayó");
    },
  });

  assert.equal(result.section.status, "failed");
  assert.equal(result.section.key, "fotoffice");
  assert.equal(result.section.title, "FotOffice");
  assert.match(result.section.error ?? "", /la consulta se cayó/);
});

test("el fallo genera una alerta técnica de gravedad alta", async () => {
  const result = await runCollector({
    key: "fotoffice",
    title: "FotOffice",
    async run() {
      throw new Error("timeout");
    },
  });

  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0]!.severity, "high");
  assert.equal(result.alerts[0]!.urgency, "today");
  assert.equal(result.alerts[0]!.id, "collector-failed:fotoffice");
});

test("un error que no es Error igual se reporta legible", async () => {
  const result = await runCollector({
    key: "raro",
    title: "Raro",
    async run() {
      throw "algo no serializable";
    },
  });

  assert.equal(result.section.status, "failed");
  assert.match(result.section.error ?? "", /algo no serializable/);
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
pnpm --filter @repo/ops-daily-report test
```

Esperado: FALLA con módulo `./run-collector` no encontrado.

- [ ] **Paso 3: Implementar**

`packages/ops-daily-report/src/report/run-collector.ts`:

```ts
import type { ReportAlert } from "../contracts/alert";
import type { ReportSection } from "../contracts/snapshot";

export type CollectorResult = {
  section: ReportSection;
  alerts: ReportAlert[];
};

export type Collector = {
  key: string;
  title: string;
  run: () => Promise<CollectorResult>;
};

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Error desconocido.";
  }
}

/**
 * Ejecuta un colector aislando su fallo: si se cae, la sección queda marcada
 * como no disponible y se emite una alerta técnica, pero el informe sigue.
 */
export async function runCollector(collector: Collector): Promise<CollectorResult> {
  try {
    return await collector.run();
  } catch (error) {
    const message = describeError(error);

    return {
      section: {
        key: collector.key,
        title: collector.title,
        status: "failed",
        error: message,
        groups: [],
        tables: [],
      },
      alerts: [
        {
          id: `collector-failed:${collector.key}`,
          platform: "platform",
          title: `No se pudieron obtener los datos de ${collector.title}`,
          detail: `El informe se generó sin esta sección. Error: ${message}`,
          severity: "high",
          urgency: "today",
          affectedCount: null,
          since: null,
        },
      ],
    };
  }
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

```bash
pnpm --filter @repo/ops-daily-report test
```

Esperado: 22 tests en verde.

- [ ] **Paso 5: Commit**

```bash
git add packages/ops-daily-report/src/report
git commit -m "feat(ops-report): ejecución tolerante a fallos de colectores"
```

---

### Task 5: Puertos de datos y colector de ComprameLaFoto (monorepo)

**Archivos:**
- Crear: `packages/ops-daily-report/src/contracts/ports.ts`
- Crear: `packages/ops-daily-report/src/collectors/clf-monorepo.ts`
- Crear: `packages/ops-daily-report/src/collectors/clf-monorepo.test.ts`
- Modificar: `packages/ops-daily-report/src/contracts/index.ts`

**Interfaces:**
- Consume: `DayWindow`, `buildMetric`, `ReportSection`, `CollectorResult`.
- Produce:
  - `type PaidOrderRow = { orderId: number; totalArs: number; photographerId: number; photographerName: string; albumId: number; albumTitle: string; itemCount: number; origin: "STANDARD_CHECKOUT" | "PACK_REDEMPTION" }`
  - `interface ClfSalesPort { paidOrders(range: DateRange): Promise<PaidOrderRow[]>; countPendingOrders(range: DateRange): Promise<number>; countNewUsers(range: DateRange): Promise<number>; countNewAlbums(range: DateRange): Promise<number>; countUploadedPhotos(range: DateRange): Promise<number>; }`
  - `function createClfMonorepoCollector(port: ClfSalesPort, window: DayWindow, options: { adminBaseUrl: string }): Collector`

**Nota sobre el diseño:** el puerto devuelve las filas de pedidos del día sin agregar. La agregación (totales, ticket promedio, ranking de fotógrafos) se hace en memoria y por eso es testeable sin base de datos. El volumen diario es de cientos de pedidos, no de millones, así que traerlos es barato. Los conteos que no necesitan detalle (usuarios, álbumes, fotos) sí vienen agregados desde el puerto.

- [ ] **Paso 1: Escribir el test que falla**

`packages/ops-daily-report/src/collectors/clf-monorepo.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import type { ClfSalesPort, PaidOrderRow } from "../contracts/ports";
import { resolveArgentinaDayWindow } from "../window/day-window";
import { createClfMonorepoCollector } from "./clf-monorepo";

const WINDOW = resolveArgentinaDayWindow(new Date("2026-08-24T03:00:00.000Z"));

function order(overrides: Partial<PaidOrderRow> & { orderId: number }): PaidOrderRow {
  return {
    totalArs: 10_000,
    photographerId: 1,
    photographerName: "Ana Pérez",
    albumId: 100,
    albumTitle: "Torneo Apertura",
    itemCount: 2,
    origin: "STANDARD_CHECKOUT",
    ...overrides,
  };
}

function stubPort(overrides: Partial<ClfSalesPort> = {}): ClfSalesPort {
  return {
    async paidOrders() {
      return [];
    },
    async countPendingOrders() {
      return 0;
    },
    async countNewUsers() {
      return 0;
    },
    async countNewAlbums() {
      return 0;
    },
    async countUploadedPhotos() {
      return 0;
    },
    ...overrides,
  };
}

function metricValue(result: Awaited<ReturnType<ReturnType<typeof createClfMonorepoCollector>["run"]>>, key: string): number {
  for (const group of result.section.groups) {
    for (const metric of group.metrics) {
      if (metric.key === key) return metric.value;
    }
  }
  throw new Error(`No se encontró la métrica ${key}`);
}

test("suma la facturación del día en pesos enteros", async () => {
  const collector = createClfMonorepoCollector(
    stubPort({
      async paidOrders(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return [];
        return [order({ orderId: 1, totalArs: 15_000 }), order({ orderId: 2, totalArs: 5_000 })];
      },
    }),
    WINDOW,
    { adminBaseUrl: "https://compramelafoto.com" },
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "paidOrders"), 2);
  assert.equal(metricValue(result, "revenueArs"), 20_000);
  assert.equal(metricValue(result, "averageTicketArs"), 10_000);
});

test("arma el ranking de fotógrafos por monto vendido", async () => {
  const collector = createClfMonorepoCollector(
    stubPort({
      async paidOrders(range) {
        if (range.start.getTime() !== WINDOW.current.start.getTime()) return [];
        return [
          order({ orderId: 1, photographerId: 1, photographerName: "Ana Pérez", totalArs: 5_000 }),
          order({ orderId: 2, photographerId: 2, photographerName: "Beto Ruiz", totalArs: 30_000 }),
          order({ orderId: 3, photographerId: 1, photographerName: "Ana Pérez", totalArs: 4_000 }),
        ];
      },
    }),
    WINDOW,
    { adminBaseUrl: "https://compramelafoto.com" },
  );

  const result = await collector.run();
  const ranking = result.section.tables.find((table) => table.title.includes("fotógrafos"));

  assert.ok(ranking);
  assert.equal(ranking.rows[0]![0], "Beto Ruiz");
  assert.equal(ranking.rows[0]![2], 30_000);
  assert.equal(ranking.rows[1]![0], "Ana Pérez");
  assert.equal(ranking.rows[1]![1], 2);
  assert.equal(ranking.rows[1]![2], 9_000);
});

test("calcula la variación contra el día anterior", async () => {
  const collector = createClfMonorepoCollector(
    stubPort({
      async paidOrders(range) {
        if (range.start.getTime() === WINDOW.current.start.getTime()) {
          return [order({ orderId: 1 }), order({ orderId: 2 })];
        }
        if (range.start.getTime() === WINDOW.previous.start.getTime()) {
          return [order({ orderId: 3 })];
        }
        return [];
      },
    }),
    WINDOW,
    { adminBaseUrl: "https://compramelafoto.com" },
  );

  const result = await collector.run();
  const metric = result.section.groups
    .flatMap((group) => group.metrics)
    .find((item) => item.key === "paidOrders");

  assert.equal(metric?.previousValue, 1);
  assert.equal(metric?.changeRatio, 1);
});

test("un día sin ventas no rompe nada y deja la tabla con mensaje vacío", async () => {
  const collector = createClfMonorepoCollector(stubPort(), WINDOW, {
    adminBaseUrl: "https://compramelafoto.com",
  });

  const result = await collector.run();

  assert.equal(metricValue(result, "paidOrders"), 0);
  assert.equal(metricValue(result, "averageTicketArs"), 0);
  const ranking = result.section.tables.find((table) => table.title.includes("fotógrafos"));
  assert.equal(ranking?.rows.length, 0);
  assert.match(ranking?.emptyMessage ?? "", /sin ventas/i);
});

test("avisa cuando las ventas caen más de la mitad contra el promedio de la semana", async () => {
  const collector = createClfMonorepoCollector(
    stubPort({
      async paidOrders(range) {
        if (range.start.getTime() === WINDOW.current.start.getTime()) {
          return [order({ orderId: 1, totalArs: 1_000 })];
        }
        if (range.start.getTime() === WINDOW.trailingSevenDays.start.getTime()) {
          // 70.000 en siete días = 10.000 por día de promedio.
          return Array.from({ length: 7 }, (_, index) =>
            order({ orderId: 100 + index, totalArs: 10_000 }),
          );
        }
        return [];
      },
    }),
    WINDOW,
    { adminBaseUrl: "https://compramelafoto.com" },
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "clf-monorepo:revenue-drop");

  assert.ok(alert, "esperaba una alerta de caída de facturación");
  assert.equal(alert.severity, "medium");
  assert.equal(alert.urgency, "today");
});

test("no avisa de caída cuando la semana previa tampoco tuvo ventas", async () => {
  const collector = createClfMonorepoCollector(stubPort(), WINDOW, {
    adminBaseUrl: "https://compramelafoto.com",
  });

  const result = await collector.run();

  assert.equal(
    result.alerts.find((item) => item.id === "clf-monorepo:revenue-drop"),
    undefined,
  );
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
pnpm --filter @repo/ops-daily-report test
```

Esperado: FALLA con módulos `../contracts/ports` y `./clf-monorepo` no encontrados.

- [ ] **Paso 3: Implementar los puertos**

`packages/ops-daily-report/src/contracts/ports.ts`:

```ts
import type { DateRange } from "../window/day-window";

/** Espeja el enum `OrderOrigin` del esquema: son exactamente estos tres. */
export type OrderOriginKey = "STANDARD_CHECKOUT" | "PACK_REDEMPTION" | "PREVENTA_PACK";

/**
 * Fila de pedido pagado, ya normalizada.
 *
 * `totalArs` está en PESOS ENTEROS. En la base la columna se llama
 * `Order.totalCents` por compatibilidad histórica, pero no son centavos.
 * El adaptador es responsable de no dividir por cien.
 */
export type PaidOrderRow = {
  orderId: number;
  totalArs: number;
  photographerId: number;
  photographerName: string;
  albumId: number;
  albumTitle: string;
  itemCount: number;
  origin: OrderOriginKey;
};

export interface ClfSalesPort {
  /** Pedidos pagados en el rango, excluyendo los marcados como prueba. */
  paidOrders(range: DateRange): Promise<PaidOrderRow[]>;
  countPendingOrders(range: DateRange): Promise<number>;
  countNewUsers(range: DateRange): Promise<number>;
  countNewAlbums(range: DateRange): Promise<number>;
  countUploadedPhotos(range: DateRange): Promise<number>;
}

export type QueueHealth = {
  pending: number;
  failed: number;
  oldestPendingAt: Date | null;
};

export type JobHealth = {
  label: string;
  pending: number;
  failed: number;
  stuck: number;
  oldestPendingAt: Date | null;
};

export interface IncidentsPort {
  emailQueue(): Promise<QueueHealth>;
  unreconciledPaidOrders(olderThanHours: number): Promise<{ count: number; oldestAt: Date | null }>;
  openFraudAlerts(): Promise<{ count: number; oldestAt: Date | null }>;
  jobHealth(): Promise<JobHealth[]>;
}

export type FaceRecognitionStats = {
  photosAnalyzedDone: number;
  photosAnalyzedPending: number;
  photosAnalyzedError: number;
  facesDetected: number;
  matchEvents: number;
  interestsWithSearch: number;
  interestsWithAnyMatch: number;
  oldestPendingAt: Date | null;
};

export interface FaceRecognitionPort {
  stats(range: DateRange): Promise<FaceRecognitionStats>;
}
```

- [ ] **Paso 4: Implementar el colector**

`packages/ops-daily-report/src/collectors/clf-monorepo.ts`:

```ts
import type { ReportAlert } from "../contracts/alert";
import { buildMetric } from "../contracts/metric";
import type { ClfSalesPort, PaidOrderRow } from "../contracts/ports";
import type { ReportTable } from "../contracts/snapshot";
import type { Collector, CollectorResult } from "../report/run-collector";
import type { DateRange, DayWindow } from "../window/day-window";

const SECTION_KEY = "clf-monorepo";
const SECTION_TITLE = "ComprameLaFoto";
const RANKING_SIZE = 5;
/** Por debajo de este cociente contra el promedio semanal se avisa. */
const REVENUE_DROP_THRESHOLD = 0.5;

export type ClfMonorepoOptions = {
  /** Base pública de la app, para armar los enlaces del correo. */
  adminBaseUrl: string;
};

type OrdersSummary = {
  count: number;
  revenueArs: number;
  averageTicketArs: number;
  redemptionCount: number;
  preventaCount: number;
};

function summarize(orders: PaidOrderRow[]): OrdersSummary {
  const revenueArs = orders.reduce((total, row) => total + row.totalArs, 0);
  return {
    count: orders.length,
    revenueArs,
    averageTicketArs: orders.length === 0 ? 0 : Math.round(revenueArs / orders.length),
    redemptionCount: orders.filter((row) => row.origin === "PACK_REDEMPTION").length,
    preventaCount: orders.filter((row) => row.origin === "PREVENTA_PACK").length,
  };
}

type RankedEntity = {
  label: string;
  orders: number;
  revenueArs: number;
  items: number;
};

function rankBy(
  orders: PaidOrderRow[],
  keyOf: (row: PaidOrderRow) => string,
  labelOf: (row: PaidOrderRow) => string,
): RankedEntity[] {
  const buckets = new Map<string, RankedEntity>();

  for (const row of orders) {
    const key = keyOf(row);
    const current = buckets.get(key) ?? { label: labelOf(row), orders: 0, revenueArs: 0, items: 0 };
    current.orders += 1;
    current.revenueArs += row.totalArs;
    current.items += row.itemCount;
    buckets.set(key, current);
  }

  return [...buckets.values()]
    .sort((left, right) => right.revenueArs - left.revenueArs || left.label.localeCompare(right.label))
    .slice(0, RANKING_SIZE);
}

function rankingTable(title: string, entities: RankedEntity[], emptyMessage: string): ReportTable {
  return {
    title,
    columns: ["Nombre", "Pedidos", "Facturación (ARS)", "Fotos"],
    rows: entities.map((entity) => [entity.label, entity.orders, entity.revenueArs, entity.items]),
    emptyMessage,
  };
}

async function loadRange(port: ClfSalesPort, range: DateRange): Promise<PaidOrderRow[]> {
  return port.paidOrders(range);
}

export function createClfMonorepoCollector(
  port: ClfSalesPort,
  window: DayWindow,
  options: ClfMonorepoOptions,
): Collector {
  return {
    key: SECTION_KEY,
    title: SECTION_TITLE,
    async run(): Promise<CollectorResult> {
      const [currentOrders, previousOrders, trailingOrders] = await Promise.all([
        loadRange(port, window.current),
        loadRange(port, window.previous),
        loadRange(port, window.trailingSevenDays),
      ]);

      const [pendingOrders, newUsers, newAlbums, uploadedPhotos] = await Promise.all([
        port.countPendingOrders(window.current),
        port.countNewUsers(window.current),
        port.countNewAlbums(window.current),
        port.countUploadedPhotos(window.current),
      ]);

      const [previousUsers, previousAlbums, previousPhotos] = await Promise.all([
        port.countNewUsers(window.previous),
        port.countNewAlbums(window.previous),
        port.countUploadedPhotos(window.previous),
      ]);

      const current = summarize(currentOrders);
      const previous = summarize(previousOrders);
      const trailing = summarize(trailingOrders);
      const trailingDailyRevenue = trailing.revenueArs / 7;
      const trailingDailyOrders = trailing.count / 7;

      const alerts: ReportAlert[] = [];
      const revenueDropped =
        trailingDailyRevenue > 0 &&
        current.revenueArs < trailingDailyRevenue * REVENUE_DROP_THRESHOLD;

      if (revenueDropped) {
        alerts.push({
          id: `${SECTION_KEY}:revenue-drop`,
          platform: "clf-monorepo",
          title: "Caída fuerte de facturación",
          detail:
            `Se facturaron ${current.revenueArs} ARS, menos de la mitad del promedio ` +
            `diario de la última semana (${Math.round(trailingDailyRevenue)} ARS). ` +
            "Conviene revisar que el checkout y los pagos estén funcionando.",
          severity: "medium",
          urgency: "today",
          affectedCount: null,
          since: null,
          actionUrl: `${options.adminBaseUrl}/admin/pedidos`,
        });
      }

      return {
        alerts,
        section: {
          key: SECTION_KEY,
          title: SECTION_TITLE,
          status: "ok",
          error: null,
          groups: [
            {
              title: "Ventas",
              metrics: [
                buildMetric({
                  key: "paidOrders",
                  label: "Pedidos pagados",
                  value: current.count,
                  format: "count",
                  previousValue: previous.count,
                  sevenDayAverage: trailingDailyOrders,
                }),
                buildMetric({
                  key: "revenueArs",
                  label: "Facturación",
                  value: current.revenueArs,
                  format: "currencyArs",
                  previousValue: previous.revenueArs,
                  sevenDayAverage: trailingDailyRevenue,
                }),
                buildMetric({
                  key: "averageTicketArs",
                  label: "Ticket promedio",
                  value: current.averageTicketArs,
                  format: "currencyArs",
                  previousValue: previous.averageTicketArs,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "redemptionOrders",
                  label: "Pedidos por canje de pack",
                  value: current.redemptionCount,
                  format: "count",
                  previousValue: previous.redemptionCount,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "preventaOrders",
                  label: "Pedidos de preventa",
                  value: current.preventaCount,
                  format: "count",
                  previousValue: previous.preventaCount,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "pendingOrders",
                  label: "Pedidos pendientes de pago",
                  value: pendingOrders,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                  hint: "Iniciados y todavía sin pago acreditado.",
                }),
              ],
            },
            {
              title: "Actividad",
              metrics: [
                buildMetric({
                  key: "newUsers",
                  label: "Usuarios nuevos",
                  value: newUsers,
                  format: "count",
                  previousValue: previousUsers,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "newAlbums",
                  label: "Álbumes creados",
                  value: newAlbums,
                  format: "count",
                  previousValue: previousAlbums,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "uploadedPhotos",
                  label: "Fotos subidas",
                  value: uploadedPhotos,
                  format: "count",
                  previousValue: previousPhotos,
                  sevenDayAverage: null,
                }),
              ],
            },
          ],
          tables: [
            rankingTable(
              "Top fotógrafos por facturación",
              rankBy(
                currentOrders,
                (row) => String(row.photographerId),
                (row) => row.photographerName,
              ),
              "Sin ventas en el día.",
            ),
            rankingTable(
              "Top álbumes por facturación",
              rankBy(
                currentOrders,
                (row) => String(row.albumId),
                (row) => row.albumTitle,
              ),
              "Sin ventas en el día.",
            ),
          ],
        },
      };
    },
  };
}
```

- [ ] **Paso 5: Exportar los puertos desde el índice de contratos**

Agregar al final de `packages/ops-daily-report/src/contracts/index.ts`:

```ts
export type {
  ClfSalesPort,
  FaceRecognitionPort,
  FaceRecognitionStats,
  IncidentsPort,
  JobHealth,
  OrderOriginKey,
  PaidOrderRow,
  QueueHealth,
} from "./ports";
```

- [ ] **Paso 6: Correr el test y verificar que pasa**

```bash
pnpm --filter @repo/ops-daily-report test
pnpm --filter @repo/ops-daily-report typecheck
```

Esperado: 28 tests en verde, sin errores de tipos.

- [ ] **Paso 7: Commit**

```bash
git add packages/ops-daily-report/src
git commit -m "feat(ops-report): colector de ventas y ranking de fotógrafos"
```

---

### Task 6: Colector de incidentes técnicos

**Archivos:**
- Crear: `packages/ops-daily-report/src/collectors/incidents.ts`
- Crear: `packages/ops-daily-report/src/collectors/incidents.test.ts`

**Interfaces:**
- Consume: `IncidentsPort`, `QueueHealth`, `JobHealth` de la Task 5.
- Produce: `function createIncidentsCollector(port: IncidentsPort, window: DayWindow, options: { adminBaseUrl: string; now: Date }): Collector`

- [ ] **Paso 1: Escribir el test que falla**

`packages/ops-daily-report/src/collectors/incidents.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import type { IncidentsPort } from "../contracts/ports";
import { resolveArgentinaDayWindow } from "../window/day-window";
import { createIncidentsCollector } from "./incidents";

const NOW = new Date("2026-08-24T03:00:00.000Z");
const WINDOW = resolveArgentinaDayWindow(NOW);
const OPTIONS = { adminBaseUrl: "https://compramelafoto.com", now: NOW };

function stubPort(overrides: Partial<IncidentsPort> = {}): IncidentsPort {
  return {
    async emailQueue() {
      return { pending: 0, failed: 0, oldestPendingAt: null };
    },
    async unreconciledPaidOrders() {
      return { count: 0, oldestAt: null };
    },
    async openFraudAlerts() {
      return { count: 0, oldestAt: null };
    },
    async jobHealth() {
      return [];
    },
    ...overrides,
  };
}

test("un día limpio no genera alertas", async () => {
  const collector = createIncidentsCollector(stubPort(), WINDOW, OPTIONS);
  const result = await collector.run();

  assert.equal(result.alerts.length, 0);
  assert.equal(result.section.status, "ok");
});

test("la cola de correos trabada más de dos horas es crítica e inmediata", async () => {
  const collector = createIncidentsCollector(
    stubPort({
      async emailQueue() {
        return {
          pending: 40,
          failed: 0,
          // Tres horas antes del corte.
          oldestPendingAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
        };
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "incidents:email-queue-stuck");

  assert.ok(alert);
  assert.equal(alert.severity, "critical");
  assert.equal(alert.urgency, "immediate");
  assert.equal(alert.affectedCount, 40);
});

test("una cola con pendientes recientes no dispara alerta", async () => {
  const collector = createIncidentsCollector(
    stubPort({
      async emailQueue() {
        return {
          pending: 5,
          failed: 0,
          oldestPendingAt: new Date(NOW.getTime() - 10 * 60 * 1000),
        };
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(
    result.alerts.find((item) => item.id === "incidents:email-queue-stuck"),
    undefined,
  );
});

test("los pagos sin conciliar son críticos e inmediatos", async () => {
  const collector = createIncidentsCollector(
    stubPort({
      async unreconciledPaidOrders() {
        return { count: 3, oldestAt: new Date("2026-08-22T12:00:00.000Z") };
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "incidents:unreconciled-payments");

  assert.ok(alert);
  assert.equal(alert.severity, "critical");
  assert.equal(alert.urgency, "immediate");
  assert.equal(alert.since, "2026-08-22T12:00:00.000Z");
});

test("las alertas de fraude abiertas son de gravedad alta para hoy", async () => {
  const collector = createIncidentsCollector(
    stubPort({
      async openFraudAlerts() {
        return { count: 2, oldestAt: null };
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "incidents:fraud-open");

  assert.ok(alert);
  assert.equal(alert.severity, "high");
  assert.equal(alert.urgency, "today");
});

test("los trabajos trabados generan una alerta por tipo de trabajo", async () => {
  const collector = createIncidentsCollector(
    stubPort({
      async jobHealth() {
        return [
          { label: "Generación de ZIP", pending: 4, failed: 0, stuck: 3, oldestPendingAt: null },
          { label: "Ingesta de cámara", pending: 0, failed: 0, stuck: 0, oldestPendingAt: null },
        ];
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alerts = result.alerts.filter((item) => item.id.startsWith("incidents:job-stuck:"));

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.severity, "medium");
  assert.equal(alerts[0]!.affectedCount, 3);
  assert.match(alerts[0]!.title, /ZIP/);
});

test("la sección publica el resumen de la cola aunque no haya alertas", async () => {
  const collector = createIncidentsCollector(
    stubPort({
      async emailQueue() {
        return { pending: 2, failed: 1, oldestPendingAt: null };
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const metrics = result.section.groups.flatMap((group) => group.metrics);

  assert.equal(metrics.find((item) => item.key === "emailQueuePending")?.value, 2);
  assert.equal(metrics.find((item) => item.key === "emailQueueFailed")?.value, 1);
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
pnpm --filter @repo/ops-daily-report test
```

Esperado: FALLA con módulo `./incidents` no encontrado.

- [ ] **Paso 3: Implementar**

`packages/ops-daily-report/src/collectors/incidents.ts`:

```ts
import type { ReportAlert } from "../contracts/alert";
import { buildMetric } from "../contracts/metric";
import type { IncidentsPort } from "../contracts/ports";
import type { ReportMetric } from "../contracts/metric";
import type { Collector, CollectorResult } from "../report/run-collector";
import type { DayWindow } from "../window/day-window";

const SECTION_KEY = "incidents";
const SECTION_TITLE = "Incidentes técnicos";

/** A partir de acá una cola de correos deja de ser demora y pasa a ser traba. */
const EMAIL_QUEUE_STUCK_HOURS = 2;
/** Un pago acreditado sin conciliar después de esto es plata en riesgo. */
const UNRECONCILED_HOURS = 24;

export type IncidentsOptions = {
  adminBaseUrl: string;
  /** Momento de generación, para medir antigüedad. */
  now: Date;
};

function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (60 * 60 * 1000);
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createIncidentsCollector(
  port: IncidentsPort,
  _window: DayWindow,
  options: IncidentsOptions,
): Collector {
  return {
    key: SECTION_KEY,
    title: SECTION_TITLE,
    async run(): Promise<CollectorResult> {
      const [emailQueue, unreconciled, fraud, jobs] = await Promise.all([
        port.emailQueue(),
        port.unreconciledPaidOrders(UNRECONCILED_HOURS),
        port.openFraudAlerts(),
        port.jobHealth(),
      ]);

      const alerts: ReportAlert[] = [];

      const queueAgeHours = emailQueue.oldestPendingAt
        ? hoursBetween(emailQueue.oldestPendingAt, options.now)
        : 0;

      if (emailQueue.pending > 0 && queueAgeHours >= EMAIL_QUEUE_STUCK_HOURS) {
        alerts.push({
          id: "incidents:email-queue-stuck",
          platform: "platform",
          title: "La cola de correos está trabada",
          detail:
            `Hay ${emailQueue.pending} correos sin enviar, el más viejo espera hace ` +
            `${Math.round(queueAgeHours)} horas. Los clientes no están recibiendo sus enlaces de descarga.`,
          severity: "critical",
          urgency: "immediate",
          affectedCount: emailQueue.pending,
          since: toIso(emailQueue.oldestPendingAt),
          actionUrl: `${options.adminBaseUrl}/admin/emails`,
        });
      }

      if (unreconciled.count > 0) {
        alerts.push({
          id: "incidents:unreconciled-payments",
          platform: "platform",
          title: "Pagos acreditados sin conciliar",
          detail:
            `${unreconciled.count} pedidos figuran pagados pero no terminaron de conciliarse ` +
            `hace más de ${UNRECONCILED_HOURS} horas. Puede haber plata cobrada sin entregar.`,
          severity: "critical",
          urgency: "immediate",
          affectedCount: unreconciled.count,
          since: toIso(unreconciled.oldestAt),
          actionUrl: `${options.adminBaseUrl}/admin/pagos-mp-anomalias`,
        });
      }

      if (fraud.count > 0) {
        alerts.push({
          id: "incidents:fraud-open",
          platform: "platform",
          title: "Alertas de fraude sin revisar",
          detail: `Hay ${fraud.count} alertas de fraude abiertas esperando revisión.`,
          severity: "high",
          urgency: "today",
          affectedCount: fraud.count,
          since: toIso(fraud.oldestAt),
          actionUrl: `${options.adminBaseUrl}/admin/antifraude`,
        });
      }

      for (const job of jobs) {
        if (job.stuck <= 0) continue;
        alerts.push({
          id: `incidents:job-stuck:${slugify(job.label)}`,
          platform: "platform",
          title: `Trabajos trabados: ${job.label}`,
          detail: `${job.stuck} trabajos de "${job.label}" quedaron tomados sin avanzar.`,
          severity: "medium",
          urgency: "today",
          affectedCount: job.stuck,
          since: toIso(job.oldestPendingAt),
          actionUrl: `${options.adminBaseUrl}/admin/salud-plataforma`,
        });
      }

      const jobMetrics: ReportMetric[] = jobs.flatMap((job) => [
        buildMetric({
          key: `job:${slugify(job.label)}:pending`,
          label: `${job.label} — pendientes`,
          value: job.pending,
          format: "count",
          previousValue: null,
          sevenDayAverage: null,
        }),
        buildMetric({
          key: `job:${slugify(job.label)}:failed`,
          label: `${job.label} — con error`,
          value: job.failed,
          format: "count",
          previousValue: null,
          sevenDayAverage: null,
        }),
      ]);

      return {
        alerts,
        section: {
          key: SECTION_KEY,
          title: SECTION_TITLE,
          status: "ok",
          error: null,
          groups: [
            {
              title: "Correos y pagos",
              metrics: [
                buildMetric({
                  key: "emailQueuePending",
                  label: "Correos pendientes de envío",
                  value: emailQueue.pending,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "emailQueueFailed",
                  label: "Correos con error",
                  value: emailQueue.failed,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "unreconciledPayments",
                  label: "Pagos sin conciliar",
                  value: unreconciled.count,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "openFraudAlerts",
                  label: "Alertas de fraude abiertas",
                  value: fraud.count,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
              ],
            },
            ...(jobMetrics.length > 0
              ? [{ title: "Trabajos en segundo plano", metrics: jobMetrics }]
              : []),
          ],
          tables: [],
        },
      };
    },
  };
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

```bash
pnpm --filter @repo/ops-daily-report test
```

Esperado: 35 tests en verde.

- [ ] **Paso 5: Commit**

```bash
git add packages/ops-daily-report/src/collectors/incidents.ts packages/ops-daily-report/src/collectors/incidents.test.ts
git commit -m "feat(ops-report): colector de incidentes técnicos"
```

---

### Task 7: Colector de reconocimiento facial

**Archivos:**
- Crear: `packages/ops-daily-report/src/collectors/face-recognition.ts`
- Crear: `packages/ops-daily-report/src/collectors/face-recognition.test.ts`

**Interfaces:**
- Consume: `FaceRecognitionPort`, `FaceRecognitionStats` de la Task 5.
- Produce: `function createFaceRecognitionCollector(port: FaceRecognitionPort, window: DayWindow, options: { adminBaseUrl: string }): Collector`

- [ ] **Paso 1: Escribir el test que falla**

`packages/ops-daily-report/src/collectors/face-recognition.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import type { FaceRecognitionPort, FaceRecognitionStats } from "../contracts/ports";
import { resolveArgentinaDayWindow } from "../window/day-window";
import { createFaceRecognitionCollector } from "./face-recognition";

const WINDOW = resolveArgentinaDayWindow(new Date("2026-08-24T03:00:00.000Z"));
const OPTIONS = { adminBaseUrl: "https://compramelafoto.com" };

function stats(overrides: Partial<FaceRecognitionStats> = {}): FaceRecognitionStats {
  return {
    photosAnalyzedDone: 0,
    photosAnalyzedPending: 0,
    photosAnalyzedError: 0,
    facesDetected: 0,
    matchEvents: 0,
    interestsWithSearch: 0,
    interestsWithAnyMatch: 0,
    oldestPendingAt: null,
    ...overrides,
  };
}

function stubPort(byRange: (isCurrent: boolean) => FaceRecognitionStats): FaceRecognitionPort {
  return {
    async stats(range) {
      return byRange(range.start.getTime() === WINDOW.current.start.getTime());
    },
  };
}

test("calcula la tasa de coincidencia", async () => {
  const collector = createFaceRecognitionCollector(
    stubPort(() => stats({ interestsWithSearch: 40, interestsWithAnyMatch: 30 })),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const metric = result.section.groups
    .flatMap((group) => group.metrics)
    .find((item) => item.key === "matchRate");

  assert.equal(metric?.value, 75);
  assert.equal(metric?.format, "percent");
});

test("cero búsquedas no produce una división por cero", async () => {
  const collector = createFaceRecognitionCollector(
    stubPort(() => stats()),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const metric = result.section.groups
    .flatMap((group) => group.metrics)
    .find((item) => item.key === "matchRate");

  assert.equal(metric?.value, 0);
});

test("hubo búsquedas y ninguna coincidencia: alerta alta e inmediata", async () => {
  const collector = createFaceRecognitionCollector(
    stubPort((isCurrent) =>
      isCurrent
        ? stats({ interestsWithSearch: 25, interestsWithAnyMatch: 0, facesDetected: 500 })
        : stats({ interestsWithSearch: 20, interestsWithAnyMatch: 15 }),
    ),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "face-recognition:no-matches");

  assert.ok(alert);
  assert.equal(alert.severity, "high");
  assert.equal(alert.urgency, "immediate");
});

test("sin búsquedas en el día no se alerta por falta de coincidencias", async () => {
  const collector = createFaceRecognitionCollector(
    stubPort(() => stats()),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(
    result.alerts.find((item) => item.id === "face-recognition:no-matches"),
    undefined,
  );
});

test("los análisis con error generan alerta media para hoy", async () => {
  const collector = createFaceRecognitionCollector(
    stubPort((isCurrent) => (isCurrent ? stats({ photosAnalyzedError: 12 }) : stats())),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "face-recognition:analysis-errors");

  assert.ok(alert);
  assert.equal(alert.severity, "medium");
  assert.equal(alert.urgency, "today");
  assert.equal(alert.affectedCount, 12);
});

test("una caída de la tasa de coincidencia contra la semana previa se avisa", async () => {
  const collector = createFaceRecognitionCollector(
    stubPort((isCurrent) =>
      isCurrent
        ? stats({ interestsWithSearch: 40, interestsWithAnyMatch: 8 })
        : stats({ interestsWithSearch: 100, interestsWithAnyMatch: 80 }),
    ),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "face-recognition:match-rate-drop");

  assert.ok(alert, "esperaba alerta por degradación de la tasa de coincidencia");
  assert.equal(alert.severity, "high");
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
pnpm --filter @repo/ops-daily-report test
```

Esperado: FALLA con módulo `./face-recognition` no encontrado.

- [ ] **Paso 3: Implementar**

`packages/ops-daily-report/src/collectors/face-recognition.ts`:

```ts
import type { ReportAlert } from "../contracts/alert";
import { buildMetric } from "../contracts/metric";
import type { FaceRecognitionPort, FaceRecognitionStats } from "../contracts/ports";
import type { Collector, CollectorResult } from "../report/run-collector";
import type { DayWindow } from "../window/day-window";

const SECTION_KEY = "face-recognition";
const SECTION_TITLE = "Reconocimiento facial";

/** Debajo de esta proporción de la tasa previa se considera degradación. */
const MATCH_RATE_DROP_THRESHOLD = 0.5;
/** Con menos búsquedas que esto, la tasa es ruido estadístico. */
const MIN_SEARCHES_FOR_RATE_ALERT = 10;

export type FaceRecognitionOptions = {
  adminBaseUrl: string;
};

function matchRate(stats: FaceRecognitionStats): number {
  if (stats.interestsWithSearch === 0) return 0;
  return Math.round((stats.interestsWithAnyMatch / stats.interestsWithSearch) * 100);
}

export function createFaceRecognitionCollector(
  port: FaceRecognitionPort,
  window: DayWindow,
  options: FaceRecognitionOptions,
): Collector {
  return {
    key: SECTION_KEY,
    title: SECTION_TITLE,
    async run(): Promise<CollectorResult> {
      const [current, previous, trailing] = await Promise.all([
        port.stats(window.current),
        port.stats(window.previous),
        port.stats(window.trailingSevenDays),
      ]);

      const currentRate = matchRate(current);
      const previousRate = matchRate(previous);
      const trailingRate = matchRate(trailing);

      const alerts: ReportAlert[] = [];

      if (current.interestsWithSearch >= MIN_SEARCHES_FOR_RATE_ALERT && current.interestsWithAnyMatch === 0) {
        alerts.push({
          id: `${SECTION_KEY}:no-matches`,
          platform: "clf-monorepo",
          title: "El reconocimiento facial no encontró ninguna coincidencia",
          detail:
            `Hubo ${current.interestsWithSearch} búsquedas por rostro y ninguna devolvió resultado. ` +
            "Puede ser una falla del servicio de reconocimiento o de la indexación de rostros.",
          severity: "high",
          urgency: "immediate",
          affectedCount: current.interestsWithSearch,
          since: null,
          actionUrl: `${options.adminBaseUrl}/admin/ia`,
        });
      } else if (
        current.interestsWithSearch >= MIN_SEARCHES_FOR_RATE_ALERT &&
        trailingRate > 0 &&
        currentRate < trailingRate * MATCH_RATE_DROP_THRESHOLD
      ) {
        alerts.push({
          id: `${SECTION_KEY}:match-rate-drop`,
          platform: "clf-monorepo",
          title: "Cayó la tasa de coincidencia del reconocimiento facial",
          detail:
            `La tasa bajó a ${currentRate} % cuando la última semana venía en ${trailingRate} %. ` +
            "Conviene revisar la calidad de indexación y los umbrales de similitud.",
          severity: "high",
          urgency: "today",
          affectedCount: current.interestsWithSearch,
          since: null,
          actionUrl: `${options.adminBaseUrl}/admin/ia`,
        });
      }

      if (current.photosAnalyzedError > 0) {
        alerts.push({
          id: `${SECTION_KEY}:analysis-errors`,
          platform: "clf-monorepo",
          title: "Análisis de fotos con error",
          detail:
            `${current.photosAnalyzedError} fotos terminaron con error en el análisis. ` +
            "Esas fotos no van a aparecer en las búsquedas por rostro.",
          severity: "medium",
          urgency: "today",
          affectedCount: current.photosAnalyzedError,
          since: null,
          actionUrl: `${options.adminBaseUrl}/admin/procesamiento-fotos`,
        });
      }

      return {
        alerts,
        section: {
          key: SECTION_KEY,
          title: SECTION_TITLE,
          status: "ok",
          error: null,
          groups: [
            {
              title: "Búsquedas por rostro",
              metrics: [
                buildMetric({
                  key: "searches",
                  label: "Búsquedas realizadas",
                  value: current.interestsWithSearch,
                  format: "count",
                  previousValue: previous.interestsWithSearch,
                  sevenDayAverage: trailing.interestsWithSearch / 7,
                }),
                buildMetric({
                  key: "searchesWithMatch",
                  label: "Búsquedas con resultado",
                  value: current.interestsWithAnyMatch,
                  format: "count",
                  previousValue: previous.interestsWithAnyMatch,
                  sevenDayAverage: trailing.interestsWithAnyMatch / 7,
                }),
                buildMetric({
                  key: "matchRate",
                  label: "Tasa de coincidencia",
                  value: currentRate,
                  format: "percent",
                  previousValue: previousRate,
                  sevenDayAverage: trailingRate,
                  hint: "Porcentaje de búsquedas que devolvieron al menos una foto.",
                }),
                buildMetric({
                  key: "matchEvents",
                  label: "Coincidencias encontradas",
                  value: current.matchEvents,
                  format: "count",
                  previousValue: previous.matchEvents,
                  sevenDayAverage: trailing.matchEvents / 7,
                }),
              ],
            },
            {
              title: "Procesamiento",
              metrics: [
                buildMetric({
                  key: "analysisDone",
                  label: "Fotos analizadas",
                  value: current.photosAnalyzedDone,
                  format: "count",
                  previousValue: previous.photosAnalyzedDone,
                  sevenDayAverage: trailing.photosAnalyzedDone / 7,
                }),
                buildMetric({
                  key: "facesDetected",
                  label: "Rostros detectados",
                  value: current.facesDetected,
                  format: "count",
                  previousValue: previous.facesDetected,
                  sevenDayAverage: trailing.facesDetected / 7,
                }),
                buildMetric({
                  key: "analysisPending",
                  label: "Fotos en cola de análisis",
                  value: current.photosAnalyzedPending,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "analysisError",
                  label: "Análisis con error",
                  value: current.photosAnalyzedError,
                  format: "count",
                  previousValue: previous.photosAnalyzedError,
                  sevenDayAverage: null,
                }),
              ],
            },
          ],
          tables: [],
        },
      };
    },
  };
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

```bash
pnpm --filter @repo/ops-daily-report test
```

Esperado: 41 tests en verde.

- [ ] **Paso 5: Commit**

```bash
git add packages/ops-daily-report/src/collectors/face-recognition.ts packages/ops-daily-report/src/collectors/face-recognition.test.ts
git commit -m "feat(ops-report): colector de salud del reconocimiento facial"
```

---

### Task 8: Ensamblado del informe

**Archivos:**
- Crear: `packages/ops-daily-report/src/report/build.ts`
- Crear: `packages/ops-daily-report/src/report/build.test.ts`
- Crear: `packages/ops-daily-report/src/index.ts`

**Interfaces:**
- Consume: `Collector`, `runCollector`, `rankAlerts`, `DayWindow`, `DailyReportSnapshot`.
- Produce: `function buildDailyReport(input: { window: DayWindow; collectors: Collector[]; now: Date }): Promise<DailyReportSnapshot>`

- [ ] **Paso 1: Escribir el test que falla**

`packages/ops-daily-report/src/report/build.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveArgentinaDayWindow } from "../window/day-window";
import { buildDailyReport } from "./build";
import type { Collector } from "./run-collector";

const NOW = new Date("2026-08-24T03:00:00.000Z");
const WINDOW = resolveArgentinaDayWindow(NOW);

function okCollector(key: string): Collector {
  return {
    key,
    title: key,
    async run() {
      return {
        section: { key, title: key, status: "ok", error: null, groups: [], tables: [] },
        alerts: [],
      };
    },
  };
}

function failingCollector(key: string): Collector {
  return {
    key,
    title: key,
    async run(): Promise<never> {
      throw new Error("se cayó");
    },
  };
}

test("con todos los colectores bien el informe queda completo", async () => {
  const snapshot = await buildDailyReport({
    window: WINDOW,
    collectors: [okCollector("a"), okCollector("b")],
    now: NOW,
  });

  assert.equal(snapshot.status, "complete");
  assert.equal(snapshot.sections.length, 2);
  assert.deepEqual(snapshot.failedSections, []);
  assert.equal(snapshot.reportDate, "2026-08-23");
});

test("si un colector falla el informe sale parcial pero sale", async () => {
  const snapshot = await buildDailyReport({
    window: WINDOW,
    collectors: [okCollector("a"), failingCollector("b")],
    now: NOW,
  });

  assert.equal(snapshot.status, "partial");
  assert.deepEqual(snapshot.failedSections, ["b"]);
  assert.equal(snapshot.sections.length, 2);
});

test("si fallan todos el informe queda marcado como fallido", async () => {
  const snapshot = await buildDailyReport({
    window: WINDOW,
    collectors: [failingCollector("a"), failingCollector("b")],
    now: NOW,
  });

  assert.equal(snapshot.status, "failed");
  assert.equal(snapshot.alerts.length, 2);
});

test("las alertas llegan ya ordenadas por urgencia", async () => {
  const lowCollector: Collector = {
    key: "baja",
    title: "baja",
    async run() {
      return {
        section: { key: "baja", title: "baja", status: "ok", error: null, groups: [], tables: [] },
        alerts: [
          {
            id: "baja",
            platform: "platform",
            title: "Baja",
            detail: "",
            severity: "low",
            urgency: "informational",
            affectedCount: null,
            since: null,
          },
        ],
      };
    },
  };

  const urgentCollector: Collector = {
    key: "urgente",
    title: "urgente",
    async run() {
      return {
        section: {
          key: "urgente",
          title: "urgente",
          status: "ok",
          error: null,
          groups: [],
          tables: [],
        },
        alerts: [
          {
            id: "urgente",
            platform: "platform",
            title: "Urgente",
            detail: "",
            severity: "critical",
            urgency: "immediate",
            affectedCount: null,
            since: null,
          },
        ],
      };
    },
  };

  const snapshot = await buildDailyReport({
    window: WINDOW,
    collectors: [lowCollector, urgentCollector],
    now: NOW,
  });

  assert.deepEqual(
    snapshot.alerts.map((item) => item.id),
    ["urgente", "baja"],
  );
});

test("registra cuánto tardó en generarse", async () => {
  const snapshot = await buildDailyReport({
    window: WINDOW,
    collectors: [okCollector("a")],
    now: NOW,
  });

  assert.ok(snapshot.generationMs >= 0);
  assert.equal(snapshot.timeZone, "America/Argentina/Buenos_Aires");
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
pnpm --filter @repo/ops-daily-report test
```

Esperado: FALLA con módulo `./build` no encontrado.

- [ ] **Paso 3: Implementar**

`packages/ops-daily-report/src/report/build.ts`:

```ts
import { rankAlerts } from "../alerts/rank";
import type { ReportAlert } from "../contracts/alert";
import type { DailyReportSnapshot, DailyReportStatus, ReportSection } from "../contracts/snapshot";
import type { DayWindow } from "../window/day-window";
import { runCollector, type Collector } from "./run-collector";

export type BuildDailyReportInput = {
  window: DayWindow;
  collectors: Collector[];
  /** Momento de generación; se inyecta para que los tests sean deterministas. */
  now: Date;
};

function resolveStatus(total: number, failed: number): DailyReportStatus {
  if (failed === 0) return "complete";
  if (failed >= total) return "failed";
  return "partial";
}

export async function buildDailyReport(
  input: BuildDailyReportInput,
): Promise<DailyReportSnapshot> {
  const startedAt = Date.now();

  // Los colectores no dependen entre sí, así que corren en paralelo.
  const results = await Promise.all(input.collectors.map((collector) => runCollector(collector)));

  const sections: ReportSection[] = results.map((result) => result.section);
  const alerts: ReportAlert[] = results.flatMap((result) => result.alerts);
  const failedSections = sections.filter((section) => section.status === "failed").map((s) => s.key);

  return {
    reportDate: input.window.reportDate,
    timeZone: input.window.timeZone,
    generatedAt: input.now.toISOString(),
    generationMs: Date.now() - startedAt,
    status: resolveStatus(sections.length, failedSections.length),
    sections,
    alerts: rankAlerts(alerts),
    failedSections,
  };
}
```

`packages/ops-daily-report/src/index.ts`:

```ts
/**
 * @repo/ops-daily-report — Informe Diario DNX.
 *
 * Lógica pura de recolección y armado. No importa Prisma ni proveedores de
 * correo: los datos entran por los puertos definidos en `contracts/ports`.
 */

export {
  REPORT_TIME_ZONE,
  resolveArgentinaDayWindow,
  type DateRange,
  type DayWindow,
} from "./window/day-window";

export * from "./contracts/index";

export { alertScore, rankAlerts } from "./alerts/rank";

export {
  runCollector,
  type Collector,
  type CollectorResult,
} from "./report/run-collector";

export { buildDailyReport, type BuildDailyReportInput } from "./report/build";

export {
  createClfMonorepoCollector,
  type ClfMonorepoOptions,
} from "./collectors/clf-monorepo";

export {
  createIncidentsCollector,
  type IncidentsOptions,
} from "./collectors/incidents";

export {
  createFaceRecognitionCollector,
  type FaceRecognitionOptions,
} from "./collectors/face-recognition";
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

```bash
pnpm --filter @repo/ops-daily-report test
pnpm --filter @repo/ops-daily-report typecheck
pnpm --filter @repo/ops-daily-report lint
```

Esperado: 46 tests en verde, sin errores.

- [ ] **Paso 5: Commit**

```bash
git add packages/ops-daily-report/src
git commit -m "feat(ops-report): ensamblado del informe y fachada del paquete"
```

---

### Task 9: Tablas de persistencia del informe

**Archivos:**
- Modificar: `packages/db/prisma/schema.prisma` (agregar al final)
- Crear: `packages/db/src/daily-report-repository.ts`
- Crear: `packages/db/src/daily-report-repository.test.ts`
- Modificar: `packages/db/package.json` (agregar el export y el script de test)

**Interfaces:**
- Consume: `DailyReportSnapshot` de `@repo/ops-daily-report`.
- Produce:
  - `function saveDailyReportSnapshot(client, snapshot): Promise<{ id: string }>`
  - `function recordDailyReportDelivery(client, input): Promise<void>`
  - `function findDailyReportSnapshot(client, reportDate): Promise<DailyReportSnapshot | null>`
  - `function listDailyReportSnapshots(client, limit): Promise<DailyReportSnapshotSummary[]>`

- [ ] **Paso 1: Agregar los modelos al esquema**

Agregar al final de `packages/db/prisma/schema.prisma`:

```prisma
/// Estado de generación de un informe diario DNX.
enum DnxDailyReportStatus {
  COMPLETE
  PARTIAL
  FAILED
}

/// Resultado del envío de un informe diario por un canal.
enum DnxDailyReportDeliveryStatus {
  SENT
  FAILED
  SKIPPED
}

/// Informe Diario DNX — una fila por día calendario argentino.
model DnxDailyReportSnapshot {
  id             String                       @id @default(cuid())
  /// Día informado (YYYY-MM-DD, calendario argentino). Único por día.
  reportDate     String                       @unique
  timeZone       String                       @default("America/Argentina/Buenos_Aires")
  status         DnxDailyReportStatus         @default(COMPLETE)
  /// Snapshot completo serializado (DailyReportSnapshot de @repo/ops-daily-report).
  payload        Json
  generationMs   Int                          @default(0)
  /// Claves de las secciones que no se pudieron generar.
  failedSections String[]                     @default([])
  /// Cantidad de alertas críticas, desnormalizada para el listado del panel.
  criticalAlerts Int                          @default(0)
  createdAt      DateTime                     @default(now())
  updatedAt      DateTime                     @updatedAt
  deliveries     DnxDailyReportDelivery[]

  @@index([createdAt])
  @@index([status])
}

/// Intento de envío de un informe diario.
model DnxDailyReportDelivery {
  id                String                       @id @default(cuid())
  snapshotId        String
  channel           String                       @default("email")
  recipient         String
  status            DnxDailyReportDeliveryStatus
  providerMessageId String?
  error             String?
  sentAt            DateTime                     @default(now())
  snapshot          DnxDailyReportSnapshot       @relation(fields: [snapshotId], references: [id], onDelete: Cascade)

  @@index([snapshotId])
  @@index([status, sentAt])
}
```

- [ ] **Paso 2: Generar la migración**

> **Cuidado:** este paso escribe en la base de datos apuntada por `packages/db/.env`. Verificar antes que sea la base de desarrollo, no producción.

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite
head -3 packages/db/.env   # confirmar host de desarrollo antes de seguir
pnpm --filter @repo/db exec prisma migrate dev --name add-dnx-daily-report
pnpm --filter @repo/db exec prisma generate
```

Esperado: migración creada en `packages/db/prisma/migrations/` y cliente regenerado.

- [ ] **Paso 3: Escribir el test que falla**

`packages/db/src/daily-report-repository.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { countCriticalAlerts, toSnapshotRow } from "./daily-report-repository";

const SNAPSHOT = {
  reportDate: "2026-08-23",
  timeZone: "America/Argentina/Buenos_Aires",
  generatedAt: "2026-08-24T03:00:05.000Z",
  generationMs: 5000,
  status: "partial" as const,
  sections: [],
  failedSections: ["fotoffice"],
  alerts: [
    {
      id: "a",
      platform: "platform" as const,
      title: "A",
      detail: "",
      severity: "critical" as const,
      urgency: "immediate" as const,
      affectedCount: null,
      since: null,
    },
    {
      id: "b",
      platform: "platform" as const,
      title: "B",
      detail: "",
      severity: "medium" as const,
      urgency: "today" as const,
      affectedCount: null,
      since: null,
    },
  ],
};

test("cuenta solo las alertas críticas", () => {
  assert.equal(countCriticalAlerts(SNAPSHOT), 1);
});

test("traduce el estado del informe al enum de la base", () => {
  const row = toSnapshotRow(SNAPSHOT);

  assert.equal(row.status, "PARTIAL");
  assert.equal(row.reportDate, "2026-08-23");
  assert.equal(row.generationMs, 5000);
  assert.deepEqual(row.failedSections, ["fotoffice"]);
  assert.equal(row.criticalAlerts, 1);
});

test("un informe completo se traduce a COMPLETE", () => {
  const row = toSnapshotRow({ ...SNAPSHOT, status: "complete", failedSections: [] });

  assert.equal(row.status, "COMPLETE");
});

test("un informe totalmente fallido se traduce a FAILED", () => {
  const row = toSnapshotRow({ ...SNAPSHOT, status: "failed" });

  assert.equal(row.status, "FAILED");
});
```

- [ ] **Paso 4: Correr el test y verificar que falla**

```bash
pnpm --filter @repo/db exec tsx --test src/daily-report-repository.test.ts
```

Esperado: FALLA con módulo `./daily-report-repository` no encontrado.

- [ ] **Paso 5: Implementar**

`packages/db/src/daily-report-repository.ts`:

```ts
/**
 * Persistencia del Informe Diario DNX.
 *
 * El snapshot completo se guarda como JSON: el panel lo lee tal cual, sin
 * recalcular, y la comparativa del día siguiente puede leer el valor de ayer
 * sin volver a consultar toda la base.
 */

import type { DailyReportSnapshot } from "@repo/ops-daily-report";
import type { PrismaClient } from "@prisma/client";

export type DailyReportStatusRow = "COMPLETE" | "PARTIAL" | "FAILED";

export type DailyReportSnapshotRow = {
  reportDate: string;
  timeZone: string;
  status: DailyReportStatusRow;
  payload: DailyReportSnapshot;
  generationMs: number;
  failedSections: string[];
  criticalAlerts: number;
};

export type DailyReportSnapshotSummary = {
  id: string;
  reportDate: string;
  status: DailyReportStatusRow;
  criticalAlerts: number;
  failedSections: string[];
  createdAt: Date;
};

const STATUS_MAP: Record<DailyReportSnapshot["status"], DailyReportStatusRow> = {
  complete: "COMPLETE",
  partial: "PARTIAL",
  failed: "FAILED",
};

export function countCriticalAlerts(snapshot: DailyReportSnapshot): number {
  return snapshot.alerts.filter((alert) => alert.severity === "critical").length;
}

export function toSnapshotRow(snapshot: DailyReportSnapshot): DailyReportSnapshotRow {
  return {
    reportDate: snapshot.reportDate,
    timeZone: snapshot.timeZone,
    status: STATUS_MAP[snapshot.status],
    payload: snapshot,
    generationMs: snapshot.generationMs,
    failedSections: snapshot.failedSections,
    criticalAlerts: countCriticalAlerts(snapshot),
  };
}

/** Guarda el informe del día; si ya existía uno para esa fecha, lo reemplaza. */
export async function saveDailyReportSnapshot(
  client: PrismaClient,
  snapshot: DailyReportSnapshot,
): Promise<{ id: string }> {
  const row = toSnapshotRow(snapshot);

  const saved = await client.dnxDailyReportSnapshot.upsert({
    where: { reportDate: row.reportDate },
    create: {
      reportDate: row.reportDate,
      timeZone: row.timeZone,
      status: row.status,
      payload: row.payload as unknown as object,
      generationMs: row.generationMs,
      failedSections: row.failedSections,
      criticalAlerts: row.criticalAlerts,
    },
    update: {
      timeZone: row.timeZone,
      status: row.status,
      payload: row.payload as unknown as object,
      generationMs: row.generationMs,
      failedSections: row.failedSections,
      criticalAlerts: row.criticalAlerts,
    },
    select: { id: true },
  });

  return saved;
}

export type RecordDeliveryInput = {
  snapshotId: string;
  recipient: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  providerMessageId?: string | null;
  error?: string | null;
};

export async function recordDailyReportDelivery(
  client: PrismaClient,
  input: RecordDeliveryInput,
): Promise<void> {
  await client.dnxDailyReportDelivery.create({
    data: {
      snapshotId: input.snapshotId,
      channel: "email",
      recipient: input.recipient,
      status: input.status,
      providerMessageId: input.providerMessageId ?? null,
      error: input.error ?? null,
    },
  });
}

export async function findDailyReportSnapshot(
  client: PrismaClient,
  reportDate: string,
): Promise<DailyReportSnapshot | null> {
  const found = await client.dnxDailyReportSnapshot.findUnique({
    where: { reportDate },
    select: { payload: true },
  });

  return found ? (found.payload as unknown as DailyReportSnapshot) : null;
}

export async function listDailyReportSnapshots(
  client: PrismaClient,
  limit = 30,
): Promise<DailyReportSnapshotSummary[]> {
  const rows = await client.dnxDailyReportSnapshot.findMany({
    orderBy: { reportDate: "desc" },
    take: limit,
    select: {
      id: true,
      reportDate: true,
      status: true,
      criticalAlerts: true,
      failedSections: true,
      createdAt: true,
    },
  });

  return rows as DailyReportSnapshotSummary[];
}
```

- [ ] **Paso 6: Registrar el export y el script de test en `@repo/db`**

En `packages/db/package.json`, agregar dentro de `"exports"`:

```json
    "./daily-report-repository": "./src/daily-report-repository.ts"
```

Agregar dentro de `"dependencies"`:

```json
    "@repo/ops-daily-report": "workspace:*"
```

Agregar dentro de `"scripts"`:

```json
    "test:daily-report": "tsx --test src/daily-report-repository.test.ts"
```

- [ ] **Paso 7: Correr el test y verificar que pasa**

```bash
pnpm install
pnpm --filter @repo/db test:daily-report
```

Esperado: 4 tests en verde.

- [ ] **Paso 8: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations packages/db/src/daily-report-repository.ts packages/db/src/daily-report-repository.test.ts packages/db/package.json pnpm-lock.yaml
git commit -m "feat(db): persistencia del informe diario DNX"
```

---

### Task 10: Plantilla de correo `ops.daily-report`

**Archivos:**
- Modificar: `packages/communications/src/templates/definitions/types.ts`
- Modificar: `packages/communications/src/templates/locales/types.ts`
- Modificar: `packages/communications/src/templates/locales/es-AR.ts`
- Crear: `packages/communications/src/templates/definitions/ops-daily-report.ts`
- Modificar: `packages/communications/src/templates/definitions/index.ts`
- Crear: `packages/communications/src/templates/ops-daily-report.test.ts`
- Modificar: `packages/communications/package.json` (agregar el test al script)

**Interfaces:**
- Consume: `EmailLayout`, `EmailHeading`, `EmailParagraph`, `EmailInfoBox`, `EmailButton`, `EmailDivider` de `templates/components`.
- Produce: `opsDailyReportTemplate: CommunicationTemplateDefinition<"ops.daily-report">` con payload:
  `{ reportDate: string; status: string; criticalCount: number; alertsBlock: string; summaryBlock: string; panelUrl?: string; failedSectionsNote?: string }`

**Nota de diseño:** la plantilla recibe **texto ya armado**, no el snapshot completo. El paquete de comunicaciones no debe conocer los contratos del informe; quien arma los bloques es la app anfitriona (Task 12). Así la plantilla queda simple, validable y sin acoplarse a la forma del informe.

- [ ] **Paso 1: Escribir el test que falla**

`packages/communications/src/templates/ops-daily-report.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { createEmailTemplateEngine, createTemplateRegistry } from "../index";
import { opsDailyReportTemplate } from "./definitions/ops-daily-report";

function render(data: unknown) {
  const registry = createTemplateRegistry();
  registry.register(opsDailyReportTemplate as never);
  const engine = createEmailTemplateEngine({ registry });
  return engine.render({
    templateId: "ops.daily-report",
    brandId: "dnx",
    locale: "es-AR",
    data,
  });
}

const BASE = {
  reportDate: "23/08/2026",
  status: "Completo",
  criticalCount: 0,
  alertsBlock: "Sin alertas para atender.",
  summaryBlock: "Pedidos pagados: 12",
};

test("el asunto incluye la fecha del informe", async () => {
  const rendered = await render(BASE);

  assert.match(rendered.subject, /23\/08\/2026/);
});

test("el asunto avisa cuántas alertas críticas hay", async () => {
  const rendered = await render({ ...BASE, criticalCount: 3 });

  assert.match(rendered.subject, /3 alertas críticas/);
});

test("sin alertas críticas el asunto no las menciona", async () => {
  const rendered = await render(BASE);

  assert.doesNotMatch(rendered.subject, /crítica/i);
});

test("el cuerpo HTML incluye las alertas y el resumen", async () => {
  const rendered = await render({
    ...BASE,
    alertsBlock: "Cola de correos trabada",
    summaryBlock: "Facturación: 120.000 ARS",
  });

  assert.match(rendered.html, /Cola de correos trabada/);
  assert.match(rendered.html, /Facturación/);
});

test("la versión en texto plano también trae el contenido", async () => {
  const rendered = await render({ ...BASE, alertsBlock: "Pagos sin conciliar" });

  assert.match(rendered.text, /Pagos sin conciliar/);
  assert.match(rendered.text, /23\/08\/2026/);
});

test("incluye el botón al panel cuando se pasa la URL", async () => {
  const rendered = await render({ ...BASE, panelUrl: "https://compramelafoto.com/admin/informe-diario" });

  assert.match(rendered.html, /informe-diario/);
});

test("rechaza un informe sin fecha", async () => {
  await assert.rejects(() => render({ ...BASE, reportDate: "" }));
});

test("muestra la nota cuando hubo secciones que fallaron", async () => {
  const rendered = await render({
    ...BASE,
    failedSectionsNote: "No se pudo obtener: FotOffice",
  });

  assert.match(rendered.html, /No se pudo obtener: FotOffice/);
  assert.match(rendered.text, /No se pudo obtener: FotOffice/);
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite
pnpm --filter @repo/communications exec tsx --test src/templates/ops-daily-report.test.ts
```

Esperado: FALLA con módulo `./definitions/ops-daily-report` no encontrado.

- [ ] **Paso 3: Registrar el identificador y el payload**

En `packages/communications/src/templates/definitions/types.ts`, reemplazar la línea de identificadores:

```ts
export const COMMUNICATION_TEMPLATE_IDS = [
  "system.test",
  "user.welcome",
  "ops.daily-report",
] as const;
```

Y agregar dentro de `CommunicationTemplatePayloadMap`, después de `"user.welcome"`:

```ts
  "ops.daily-report": {
    /** Fecha del día informado, ya formateada para mostrar (DD/MM/AAAA). */
    reportDate: string;
    /** Estado del informe en texto: Completo / Parcial / Fallido. */
    status: string;
    /** Cantidad de alertas críticas, para el asunto. */
    criticalCount: number;
    /** Bloque de alertas ya armado por la app anfitriona. */
    alertsBlock: string;
    /** Bloque de números clave ya armado por la app anfitriona. */
    summaryBlock: string;
    /** Enlace al panel con el detalle completo. */
    panelUrl?: string;
    /** Aviso de secciones que no se pudieron generar. */
    failedSectionsNote?: string;
  };
```

- [ ] **Paso 4: Agregar los textos al idioma**

En `packages/communications/src/templates/locales/types.ts`, agregar dentro de `LocaleBundle`, después de `userWelcome`:

```ts
  opsDailyReport: {
    subject: (reportDate: string) => string;
    subjectWithAlerts: (reportDate: string, criticalCount: number) => string;
    heading: string;
    intro: (reportDate: string) => string;
    alertsTitle: string;
    summaryTitle: string;
    defaultCta: string;
    statusLabel: (status: string) => string;
  };
```

En `packages/communications/src/templates/locales/es-AR.ts`, agregar la clave correspondiente al objeto exportado, siguiendo el estilo de las existentes:

```ts
  opsDailyReport: {
    subject: (reportDate: string) => `Informe DNX — ${reportDate}`,
    subjectWithAlerts: (reportDate: string, criticalCount: number) =>
      `Informe DNX — ${reportDate} — ${criticalCount} ${
        criticalCount === 1 ? "alerta crítica" : "alertas críticas"
      }`,
    heading: "Informe diario de la suite",
    intro: (reportDate: string) =>
      `Resumen de la actividad del ${reportDate} en todas las plataformas.`,
    alertsTitle: "Requiere tu atención",
    summaryTitle: "Números del día",
    defaultCta: "Ver el informe completo",
    statusLabel: (status: string) => `Estado del informe: ${status}`,
  },
```

- [ ] **Paso 5: Implementar la plantilla**

`packages/communications/src/templates/definitions/ops-daily-report.ts`:

```ts
import {
  EmailButton,
  EmailDivider,
  EmailHeading,
  EmailInfoBox,
  EmailLayout,
  EmailParagraph,
} from "../components/index";
import { toPlainText } from "../security/escape";
import {
  asRecord,
  optionalStringField,
  requireStringField,
  type CommunicationTemplateDefinition,
  type CommunicationTemplatePayloadMap,
  type TemplateRenderContext,
} from "./types";

type Data = CommunicationTemplatePayloadMap["ops.daily-report"];

function buildContent(input: TemplateRenderContext<Data>): string {
  const { data, brand, copy, allowHttp } = input;

  const parts = [
    EmailHeading(copy.opsDailyReport.heading, brand),
    EmailParagraph(copy.opsDailyReport.intro(data.reportDate), brand),
    EmailHeading(copy.opsDailyReport.alertsTitle, brand),
    EmailInfoBox(data.alertsBlock, brand),
    EmailHeading(copy.opsDailyReport.summaryTitle, brand),
    EmailInfoBox(data.summaryBlock, brand),
  ];

  if (data.failedSectionsNote) {
    parts.push(EmailParagraph(data.failedSectionsNote, brand, { muted: true }));
  }

  if (data.panelUrl) {
    parts.push(EmailButton(copy.opsDailyReport.defaultCta, data.panelUrl, brand, { allowHttp }));
  }

  parts.push(EmailParagraph(copy.opsDailyReport.statusLabel(data.status), brand, { muted: true }));
  parts.push(EmailDivider(brand));

  return parts.join("\n");
}

export const opsDailyReportTemplate: CommunicationTemplateDefinition<"ops.daily-report"> = {
  id: "ops.daily-report",
  channel: "email",

  validate(data) {
    const record = asRecord(data);
    if (!record) {
      return { ok: false, errors: ["El payload debe ser un objeto."] };
    }

    const errors: string[] = [];
    const reportDate = requireStringField(record, "reportDate", errors);
    const status = requireStringField(record, "status", errors);
    const alertsBlock = requireStringField(record, "alertsBlock", errors);
    const summaryBlock = requireStringField(record, "summaryBlock", errors);
    const panelUrl = optionalStringField(record, "panelUrl", errors);
    const failedSectionsNote = optionalStringField(record, "failedSectionsNote", errors);

    const rawCount = record.criticalCount;
    const criticalCount =
      typeof rawCount === "number" && Number.isFinite(rawCount) && rawCount >= 0
        ? Math.trunc(rawCount)
        : undefined;
    if (criticalCount === undefined) {
      errors.push("Campo obligatorio inválido: criticalCount");
    }

    if (
      errors.length > 0 ||
      !reportDate ||
      !status ||
      !alertsBlock ||
      !summaryBlock ||
      criticalCount === undefined
    ) {
      return { ok: false, errors };
    }

    return {
      ok: true,
      data: {
        reportDate,
        status,
        criticalCount,
        alertsBlock,
        summaryBlock,
        ...(panelUrl ? { panelUrl } : {}),
        ...(failedSectionsNote ? { failedSectionsNote } : {}),
      },
    };
  },

  renderSubject(input) {
    const { data, copy } = input;
    return data.criticalCount > 0
      ? copy.opsDailyReport.subjectWithAlerts(data.reportDate, data.criticalCount)
      : copy.opsDailyReport.subject(data.reportDate);
  },

  renderPreheader(input) {
    return `${input.copy.opsDailyReport.heading} — ${input.data.reportDate}`;
  },

  renderHtml(input) {
    const subject = this.renderSubject(input);
    return EmailLayout({
      brand: input.brand,
      localeCopy: input.copy.common,
      preheader: this.renderPreheader?.(input) ?? input.copy.common.preheaderFallback,
      contentHtml: buildContent(input),
      title: subject,
      allowHttp: input.allowHttp,
    });
  },

  renderText(input) {
    const { data, brand, copy } = input;
    const lines = [
      copy.opsDailyReport.heading,
      "",
      copy.opsDailyReport.intro(data.reportDate),
      "",
      copy.opsDailyReport.alertsTitle.toUpperCase(),
      data.alertsBlock,
      "",
      copy.opsDailyReport.summaryTitle.toUpperCase(),
      data.summaryBlock,
    ];

    if (data.failedSectionsNote) {
      lines.push("", data.failedSectionsNote);
    }
    if (data.panelUrl) {
      lines.push("", `${copy.opsDailyReport.defaultCta}: ${data.panelUrl}`);
    }

    lines.push(
      "",
      copy.opsDailyReport.statusLabel(data.status),
      "",
      brand.footerText ?? brand.displayName,
      copy.common.transactionalNotice,
    );

    return toPlainText(lines.join("\n"));
  },
};
```

- [ ] **Paso 6: Registrar la plantilla en el índice**

En `packages/communications/src/templates/definitions/index.ts`:

Agregar el export:

```ts
export { opsDailyReportTemplate } from "./ops-daily-report";
```

Agregar el import junto a los otros:

```ts
import { opsDailyReportTemplate } from "./ops-daily-report";
```

Y sumarlo a la lista por defecto:

```ts
export const DEFAULT_TEMPLATES: AnyCommunicationTemplateDefinition[] = [
  systemTestTemplate as unknown as AnyCommunicationTemplateDefinition,
  userWelcomeTemplate as unknown as AnyCommunicationTemplateDefinition,
  opsDailyReportTemplate as unknown as AnyCommunicationTemplateDefinition,
];
```

- [ ] **Paso 7: Agregar el test al script del paquete**

En `packages/communications/package.json`, agregar `src/templates/ops-daily-report.test.ts` al final de la lista del script `"test"`.

- [ ] **Paso 8: Correr los tests y verificar que pasan**

```bash
pnpm --filter @repo/communications test
pnpm --filter @repo/communications typecheck
```

Esperado: todos en verde, incluidos los 8 nuevos. Si `exports.test.ts` verifica la lista de identificadores de plantilla, actualizarlo para incluir `ops.daily-report`.

- [ ] **Paso 9: Commit**

```bash
git add packages/communications
git commit -m "feat(communications): plantilla de correo del informe diario"
```

---

### Task 11: Adaptadores Prisma de los puertos en ComprameLaFoto

**Archivos:**
- Crear: `apps/compramelafoto/lib/daily-report/prisma-sales-port.ts`
- Crear: `apps/compramelafoto/lib/daily-report/prisma-incidents-port.ts`
- Crear: `apps/compramelafoto/lib/daily-report/prisma-face-recognition-port.ts`
- Crear: `apps/compramelafoto/lib/daily-report/prisma-ports.test.ts`
- Modificar: `apps/compramelafoto/package.json` (agregar la dependencia)

**Interfaces:**
- Consume: `ClfSalesPort`, `IncidentsPort`, `FaceRecognitionPort`, `PaidOrderRow` de `@repo/ops-daily-report`.
- Produce:
  - `function createPrismaSalesPort(client: PrismaClient): ClfSalesPort`
  - `function createPrismaIncidentsPort(client: PrismaClient): IncidentsPort`
  - `function createPrismaFaceRecognitionPort(client: PrismaClient): FaceRecognitionPort`
  - `function toPaidOrderRow(order: OrderWithRelations): PaidOrderRow` (exportada para poder testear la traducción sin base)

- [ ] **Paso 1: Agregar la dependencia**

En `apps/compramelafoto/package.json`, dentro de `"dependencies"`:

```json
    "@repo/ops-daily-report": "workspace:*"
```

Luego:

```bash
pnpm install
```

- [ ] **Paso 2: Escribir el test que falla**

`apps/compramelafoto/lib/daily-report/prisma-ports.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { toPaidOrderRow } from "./prisma-sales-port";

test("totalCents se lee como pesos enteros, no como centavos", () => {
  const row = toPaidOrderRow({
    id: 1,
    totalCents: 25_000,
    origin: "STANDARD_CHECKOUT",
    album: {
      id: 10,
      title: "Torneo Apertura",
      user: { id: 7, name: "Ana Pérez", email: "ana@example.com" },
    },
    items: [{ quantity: 2 }, { quantity: 1 }],
  });

  assert.equal(row.totalArs, 25_000);
});

test("suma las cantidades de los ítems como fotos vendidas", () => {
  const row = toPaidOrderRow({
    id: 1,
    totalCents: 1_000,
    origin: "STANDARD_CHECKOUT",
    album: {
      id: 10,
      title: "Torneo",
      user: { id: 7, name: "Ana Pérez", email: "ana@example.com" },
    },
    items: [{ quantity: 2 }, { quantity: 3 }],
  });

  assert.equal(row.itemCount, 5);
});

test("cuando el fotógrafo no tiene nombre se usa el correo", () => {
  const row = toPaidOrderRow({
    id: 1,
    totalCents: 1_000,
    origin: "STANDARD_CHECKOUT",
    album: {
      id: 10,
      title: "Torneo",
      user: { id: 7, name: null, email: "sinnombre@example.com" },
    },
    items: [],
  });

  assert.equal(row.photographerName, "sinnombre@example.com");
});

test("el origen de canje se traduce al valor del contrato", () => {
  const row = toPaidOrderRow({
    id: 1,
    totalCents: 0,
    origin: "PACK_REDEMPTION",
    album: {
      id: 10,
      title: "Torneo",
      user: { id: 7, name: "Ana", email: "ana@example.com" },
    },
    items: [],
  });

  assert.equal(row.origin, "PACK_REDEMPTION");
});

test("el origen de preventa se conserva y no se confunde con checkout", () => {
  const row = toPaidOrderRow({
    id: 1,
    totalCents: 0,
    origin: "PREVENTA_PACK",
    album: {
      id: 10,
      title: "Torneo",
      user: { id: 7, name: "Ana", email: "ana@example.com" },
    },
    items: [],
  });

  assert.equal(row.origin, "PREVENTA_PACK");
});

test("un origen desconocido se normaliza a checkout estándar", () => {
  const row = toPaidOrderRow({
    id: 1,
    totalCents: 0,
    origin: "ALGO_NUEVO",
    album: {
      id: 10,
      title: "Torneo",
      user: { id: 7, name: "Ana", email: "ana@example.com" },
    },
    items: [],
  });

  assert.equal(row.origin, "STANDARD_CHECKOUT");
});
```

- [ ] **Paso 3: Correr el test y verificar que falla**

```bash
pnpm --filter compramelafoto exec tsx --test lib/daily-report/prisma-ports.test.ts
```

Esperado: FALLA con módulo `./prisma-sales-port` no encontrado.

- [ ] **Paso 4: Implementar el adaptador de ventas**

`apps/compramelafoto/lib/daily-report/prisma-sales-port.ts`:

```ts
/**
 * Adaptador Prisma del puerto de ventas del Informe Diario.
 *
 * CUIDADO: `Order.totalCents` guarda PESOS ENTEROS, no centavos. El nombre
 * quedó por compatibilidad histórica y está documentado así en el esquema.
 * Nunca dividir por cien acá.
 */

import type { PrismaClient } from "@prisma/client";
import type { ClfSalesPort, DateRange, OrderOriginKey, PaidOrderRow } from "@repo/ops-daily-report";

export type OrderWithRelations = {
  id: number;
  totalCents: number;
  origin: string;
  album: {
    id: number;
    title: string;
    user: { id: number; name: string | null; email: string };
  };
  items: Array<{ quantity: number }>;
};

function normalizeOrigin(origin: string): OrderOriginKey {
  if (origin === "PACK_REDEMPTION") return "PACK_REDEMPTION";
  if (origin === "PREVENTA_PACK") return "PREVENTA_PACK";
  return "STANDARD_CHECKOUT";
}

export function toPaidOrderRow(order: OrderWithRelations): PaidOrderRow {
  return {
    orderId: order.id,
    totalArs: order.totalCents,
    photographerId: order.album.user.id,
    photographerName: order.album.user.name?.trim() || order.album.user.email,
    albumId: order.album.id,
    albumTitle: order.album.title,
    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
    origin: normalizeOrigin(order.origin),
  };
}

export function createPrismaSalesPort(client: PrismaClient): ClfSalesPort {
  return {
    async paidOrders(range: DateRange): Promise<PaidOrderRow[]> {
      const orders = await client.order.findMany({
        where: {
          status: "PAID",
          isTest: false,
          createdAt: { gte: range.start, lt: range.end },
        },
        select: {
          id: true,
          totalCents: true,
          origin: true,
          album: {
            select: {
              id: true,
              title: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
          items: { select: { quantity: true } },
        },
      });

      return orders.map((order) => toPaidOrderRow(order as OrderWithRelations));
    },

    async countPendingOrders(range: DateRange): Promise<number> {
      return client.order.count({
        where: {
          status: "PENDING",
          isTest: false,
          createdAt: { gte: range.start, lt: range.end },
        },
      });
    },

    async countNewUsers(range: DateRange): Promise<number> {
      return client.user.count({
        where: { createdAt: { gte: range.start, lt: range.end } },
      });
    },

    async countNewAlbums(range: DateRange): Promise<number> {
      return client.album.count({
        where: { createdAt: { gte: range.start, lt: range.end } },
      });
    },

    async countUploadedPhotos(range: DateRange): Promise<number> {
      return client.photo.count({
        where: { createdAt: { gte: range.start, lt: range.end } },
      });
    },
  };
}
```

> Si `User` o `Photo` no tienen la columna `createdAt` con ese nombre exacto, verificar en `packages/db/prisma/schema.prisma` y ajustar el campo antes de continuar. El resto del adaptador no cambia.

- [ ] **Paso 5: Implementar el adaptador de incidentes**

`apps/compramelafoto/lib/daily-report/prisma-incidents-port.ts`:

```ts
/**
 * Adaptador Prisma del puerto de incidentes técnicos.
 *
 * Se apoya en `loadPlatformHealthSnapshot()`, que ya calcula el estado de las
 * colas y los trabajos en segundo plano para el panel de salud de plataforma.
 */

import type { PrismaClient } from "@prisma/client";
import type { IncidentsPort, JobHealth, QueueHealth } from "@repo/ops-daily-report";

import { loadPlatformHealthSnapshot } from "@/lib/admin/platform-health";

const MS_PER_HOUR = 60 * 60 * 1000;

export function createPrismaIncidentsPort(client: PrismaClient): IncidentsPort {
  return {
    async emailQueue(): Promise<QueueHealth> {
      const [pending, failed, oldest] = await Promise.all([
        client.emailQueue.count({ where: { status: "PENDING" } }),
        client.emailQueue.count({ where: { status: "FAILED" } }),
        client.emailQueue.findFirst({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);

      return { pending, failed, oldestPendingAt: oldest?.createdAt ?? null };
    },

    async unreconciledPaidOrders(olderThanHours: number) {
      const cutoff = new Date(Date.now() - olderThanHours * MS_PER_HOUR);

      // Pagado en MercadoPago pero sin entrega digital registrada.
      const where = {
        status: "PAID" as const,
        isTest: false,
        digitalDeliveredAt: null,
        createdAt: { lt: cutoff },
      };

      const [count, oldest] = await Promise.all([
        client.order.count({ where }),
        client.order.findFirst({
          where,
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);

      return { count, oldestAt: oldest?.createdAt ?? null };
    },

    async openFraudAlerts() {
      // `FraudAlert.status` guarda OPEN / ACKNOWLEDGED / RESOLVED / FALSE_POSITIVE.
      // Solo OPEN significa "nadie la miró todavía".
      const where = { status: "OPEN" };

      const [count, oldest] = await Promise.all([
        client.fraudAlert.count({ where }),
        client.fraudAlert.findFirst({
          where,
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);

      return { count, oldestAt: oldest?.createdAt ?? null };
    },

    async jobHealth(): Promise<JobHealth[]> {
      const health = await loadPlatformHealthSnapshot();

      return [
        {
          label: "Generación de ZIP",
          pending: health.zip.byStatus.PENDING ?? 0,
          failed: health.zip.byStatus.FAILED ?? 0,
          stuck: health.zip.stuckOver1h,
          oldestPendingAt: null,
        },
        {
          label: "Ingesta de cámara",
          pending: health.ftp.queuePending,
          failed: health.ftp.queueFailed,
          stuck: health.ftp.workerStatus === "offline" ? health.ftp.queuePending : 0,
          oldestPendingAt: null,
        },
        {
          label: "Lectura de datos EXIF",
          pending: health.exif.pending,
          failed: health.exif.byStatus.ERROR ?? 0,
          stuck: 0,
          oldestPendingAt: null,
        },
      ];
    },
  };
}
```

> Verificar en el esquema el nombre real del campo que marca una alerta de fraude como resuelta (`FraudAlert`). Si no es `resolvedAt`, ajustar el `where` de `openFraudAlerts`. Verificar también las claves de `health.zip.byStatus` y `health.exif.byStatus` en `apps/compramelafoto/lib/admin/platform-health.ts` antes de dar el paso por terminado.

- [ ] **Paso 6: Implementar el adaptador de reconocimiento facial**

`apps/compramelafoto/lib/daily-report/prisma-face-recognition-port.ts`:

```ts
/**
 * Adaptador Prisma del puerto de reconocimiento facial.
 *
 * La "búsqueda por rostro" del comprador queda registrada en `AlbumInterest`,
 * y cada coincidencia encontrada en `FaceMatchEvent`.
 */

import type { PrismaClient } from "@prisma/client";
import type { DateRange, FaceRecognitionPort, FaceRecognitionStats } from "@repo/ops-daily-report";

export function createPrismaFaceRecognitionPort(client: PrismaClient): FaceRecognitionPort {
  return {
    async stats(range: DateRange): Promise<FaceRecognitionStats> {
      const createdInRange = { createdAt: { gte: range.start, lt: range.end } };

      const [
        photosAnalyzedDone,
        photosAnalyzedPending,
        photosAnalyzedError,
        facesDetected,
        matchEvents,
        interestsWithSearch,
        interestsWithAnyMatch,
        oldestPending,
      ] = await Promise.all([
        client.photoAnalysisJob.count({
          where: { status: "DONE", updatedAt: { gte: range.start, lt: range.end } },
        }),
        client.photoAnalysisJob.count({ where: { status: "PENDING" } }),
        client.photoAnalysisJob.count({
          where: { status: "ERROR", updatedAt: { gte: range.start, lt: range.end } },
        }),
        client.faceDetection.count({ where: createdInRange }),
        client.faceMatchEvent.count({ where: createdInRange }),
        // Solo cuentan como búsqueda por rostro los intereses que llegaron a
        // indexar una selfie: `faceId` es el identificador que devuelve
        // Rekognition. Sin él no hubo búsqueda biométrica.
        client.albumInterest.count({
          where: { ...createdInRange, faceId: { not: null } },
        }),
        client.albumInterest.count({
          where: { ...createdInRange, faceId: { not: null }, faceMatchEvents: { some: {} } },
        }),
        client.photoAnalysisJob.findFirst({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);

      return {
        photosAnalyzedDone,
        photosAnalyzedPending,
        photosAnalyzedError,
        facesDetected,
        matchEvents,
        interestsWithSearch,
        interestsWithAnyMatch,
        oldestPendingAt: oldestPending?.createdAt ?? null,
      };
    },
  };
}
```

> Verificar el nombre de la relación inversa de `FaceMatchEvent` en `AlbumInterest` dentro del esquema. Si no se llama `faceMatchEvents`, ajustar el filtro de `interestsWithAnyMatch`.

- [ ] **Paso 7: Correr el test y verificar que pasa**

```bash
pnpm --filter compramelafoto exec tsx --test lib/daily-report/prisma-ports.test.ts
```

Esperado: 6 tests en verde.

- [ ] **Paso 8: Verificar tipos de la app**

```bash
pnpm --filter compramelafoto typecheck
```

Esperado: sin errores. Si aparecen errores por nombres de campo, corregirlos según el esquema real y volver a correr.

- [ ] **Paso 9: Commit**

```bash
git add apps/compramelafoto/lib/daily-report apps/compramelafoto/package.json pnpm-lock.yaml
git commit -m "feat(clf): adaptadores Prisma del informe diario"
```

---

### Task 12: Generación, envío y tarea programada

**Archivos:**
- Crear: `apps/compramelafoto/lib/daily-report/render-blocks.ts`
- Crear: `apps/compramelafoto/lib/daily-report/render-blocks.test.ts`
- Crear: `apps/compramelafoto/lib/daily-report/run-daily-report.ts`
- Crear: `apps/compramelafoto/app/api/cron/daily-report/route.ts`
- Modificar: `apps/compramelafoto/vercel.json`
- Modificar: `turbo.json` (declarar las variables nuevas)
- Modificar: `apps/compramelafoto/.env.example`

**Interfaces:**
- Consume: todo lo anterior.
- Produce:
  - `function renderAlertsBlock(alerts: ReportAlert[]): string`
  - `function renderSummaryBlock(sections: ReportSection[]): string`
  - `function renderFailedSectionsNote(sections: ReportSection[]): string | undefined`
  - `function formatReportDate(reportDate: string): string`
  - `function runDailyReport(options: { now: Date }): Promise<{ reportDate: string; status: string; delivered: boolean }>`

- [ ] **Paso 1: Escribir el test que falla**

`apps/compramelafoto/lib/daily-report/render-blocks.test.ts`:

```ts
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
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
pnpm --filter compramelafoto exec tsx --test lib/daily-report/render-blocks.test.ts
```

Esperado: FALLA con módulo `./render-blocks` no encontrado.

- [ ] **Paso 3: Implementar los bloques de texto**

`apps/compramelafoto/lib/daily-report/render-blocks.ts`:

```ts
/**
 * Traducción del informe a los bloques de texto que consume la plantilla de
 * correo. Vive en la app y no en `@repo/communications` para que el paquete de
 * comunicaciones no dependa de la forma del informe.
 */

import {
  PLATFORM_LABELS,
  URGENCY_LABELS,
  type ReportAlert,
  type ReportMetric,
  type ReportSection,
} from "@repo/ops-daily-report";

const numberFormatter = new Intl.NumberFormat("es-AR");

export function formatReportDate(reportDate: string): string {
  const [year, month, day] = reportDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatValue(metric: ReportMetric): string {
  switch (metric.format) {
    case "currencyArs":
      return `${numberFormatter.format(metric.value)} ARS`;
    case "percent":
      return `${metric.value} %`;
    case "duration":
      return `${numberFormatter.format(metric.value)} ms`;
    default:
      return numberFormatter.format(metric.value);
  }
}

function formatChange(metric: ReportMetric): string {
  if (metric.changeRatio === null) return "";
  const percent = Math.round(metric.changeRatio * 100);
  const sign = percent > 0 ? "+" : "";
  return ` (${sign}${percent} % vs. ayer)`;
}

export function renderAlertsBlock(alerts: ReportAlert[]): string {
  if (alerts.length === 0) {
    return "No hay alertas para atender. Todo funcionó con normalidad.";
  }

  return alerts
    .map((alert) => {
      const count = alert.affectedCount === null ? "" : ` — ${alert.affectedCount} casos`;
      return [
        `[${URGENCY_LABELS[alert.urgency]}] ${PLATFORM_LABELS[alert.platform]}: ${alert.title}${count}`,
        alert.detail,
        alert.actionUrl ? `Resolver: ${alert.actionUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export function renderSummaryBlock(sections: ReportSection[]): string {
  const parts: string[] = [];

  for (const section of sections) {
    if (section.status === "failed") continue;

    const lines: string[] = [section.title.toUpperCase()];

    for (const group of section.groups) {
      lines.push(`  ${group.title}`);
      for (const metric of group.metrics) {
        lines.push(`    ${metric.label}: ${formatValue(metric)}${formatChange(metric)}`);
      }
    }

    for (const table of section.tables) {
      lines.push(`  ${table.title}`);
      if (table.rows.length === 0) {
        lines.push(`    ${table.emptyMessage}`);
        continue;
      }
      for (const row of table.rows) {
        lines.push(`    ${row.join(" · ")}`);
      }
    }

    parts.push(lines.join("\n"));
  }

  return parts.length > 0 ? parts.join("\n\n") : "No hubo datos para informar.";
}

export function renderFailedSectionsNote(sections: ReportSection[]): string | undefined {
  const failed = sections.filter((section) => section.status === "failed");
  if (failed.length === 0) return undefined;

  const names = failed.map((section) => section.title).join(", ");
  return `No se pudo obtener: ${names}. El resto del informe es válido.`;
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

```bash
pnpm --filter compramelafoto exec tsx --test lib/daily-report/render-blocks.test.ts
```

Esperado: 7 tests en verde.

- [ ] **Paso 5: Implementar la orquestación**

`apps/compramelafoto/lib/daily-report/run-daily-report.ts`:

```ts
/**
 * Orquestación del Informe Diario DNX: arma el informe, lo guarda y lo envía.
 */

import {
  communications,
  hasCommunicationProvider,
  registerCommunicationProvider,
} from "@repo/communications";
import { createResendEmailRuntime } from "@repo/communications/email/resend-runtime";
import {
  buildDailyReport,
  createClfMonorepoCollector,
  createFaceRecognitionCollector,
  createIncidentsCollector,
  resolveArgentinaDayWindow,
} from "@repo/ops-daily-report";
import {
  countCriticalAlerts,
  recordDailyReportDelivery,
  saveDailyReportSnapshot,
} from "@repo/db/daily-report-repository";

import { prisma } from "@/lib/prisma";
import { createPrismaFaceRecognitionPort } from "./prisma-face-recognition-port";
import { createPrismaIncidentsPort } from "./prisma-incidents-port";
import { createPrismaSalesPort } from "./prisma-sales-port";
import {
  formatReportDate,
  renderAlertsBlock,
  renderFailedSectionsNote,
  renderSummaryBlock,
} from "./render-blocks";

const STATUS_LABELS = {
  complete: "Completo",
  partial: "Parcial",
  failed: "Fallido",
} as const;

function resolveRecipients(): string[] {
  /* eslint-disable turbo/no-undeclared-env-vars -- configuración del informe diario */
  const raw = process.env.DAILY_REPORT_RECIPIENTS?.trim();
  /* eslint-enable turbo/no-undeclared-env-vars */
  if (!raw) return ["dnxfotografia@gmail.com"];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveBaseUrl(): string {
  /* eslint-disable turbo/no-undeclared-env-vars -- configuración del informe diario */
  return (process.env.APP_URL || "https://compramelafoto.com").replace(/\/$/, "");
  /* eslint-enable turbo/no-undeclared-env-vars */
}

/**
 * Registra el proveedor Resend de DNX Comunicaciones.
 *
 * El módulo trae un candado deliberado: no envía nada real salvo que
 * COMMUNICATIONS_LIVE_SEND sea "true", el destinatario esté en
 * RESEND_ALLOWED_RECIPIENTS, y el llamador confirme el envío. `confirmLiveSend`
 * existe para que un script interactivo no mande correos por accidente; acá el
 * envío es la razón de ser del cron, así que se confirma en el código.
 *
 * Devuelve el remitente controlado y el motivo del bloqueo si lo hubiera.
 */
function ensureEmailProvider(): {
  from: { email: string; name: string } | null;
  dryRun: boolean;
  blockMessage?: string;
} {
  const runtime = createResendEmailRuntime({
    env: process.env,
    confirmLiveSend: true,
  });

  if (!hasCommunicationProvider("email")) {
    registerCommunicationProvider(runtime.provider);
  }

  return {
    from: runtime.from,
    dryRun: runtime.dryRun,
    ...(runtime.blockMessage ? { blockMessage: runtime.blockMessage } : {}),
  };
}

export type RunDailyReportResult = {
  reportDate: string;
  status: string;
  delivered: boolean;
  criticalAlerts: number;
};

export async function runDailyReport(options: {
  now: Date;
}): Promise<RunDailyReportResult> {
  const window = resolveArgentinaDayWindow(options.now);
  const adminBaseUrl = resolveBaseUrl();

  const snapshot = await buildDailyReport({
    window,
    now: options.now,
    collectors: [
      createClfMonorepoCollector(createPrismaSalesPort(prisma), window, { adminBaseUrl }),
      createIncidentsCollector(createPrismaIncidentsPort(prisma), window, {
        adminBaseUrl,
        now: options.now,
      }),
      createFaceRecognitionCollector(createPrismaFaceRecognitionPort(prisma), window, {
        adminBaseUrl,
      }),
    ],
  });

  const saved = await saveDailyReportSnapshot(prisma, snapshot);

  const rendered = await communications.render({
    templateId: "ops.daily-report",
    brandId: "dnx",
    locale: "es-AR",
    data: {
      reportDate: formatReportDate(snapshot.reportDate),
      status: STATUS_LABELS[snapshot.status],
      criticalCount: countCriticalAlerts(snapshot),
      alertsBlock: renderAlertsBlock(snapshot.alerts),
      summaryBlock: renderSummaryBlock(snapshot.sections),
      panelUrl: `${adminBaseUrl}/admin/informe-diario`,
      ...(renderFailedSectionsNote(snapshot.sections)
        ? { failedSectionsNote: renderFailedSectionsNote(snapshot.sections) }
        : {}),
    },
  });

  const mailer = ensureEmailProvider();

  let delivered = false;

  for (const recipient of resolveRecipients()) {
    try {
      const result = await communications.send({
        channel: "email",
        to: [{ email: recipient }],
        ...(mailer.from ? { from: mailer.from } : {}),
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      // `ok` es true solo cuando status === "success".
      delivered = delivered || result.ok;

      await recordDailyReportDelivery(prisma, {
        snapshotId: saved.id,
        recipient,
        status: result.ok ? "SENT" : result.status === "skipped" ? "SKIPPED" : "FAILED",
        providerMessageId: result.providerMessageId ?? null,
        error: result.ok
          ? null
          : (result.errorMessage ??
            mailer.blockMessage ??
            "Envío no confirmado por el proveedor."),
      });
    } catch (error) {
      await recordDailyReportDelivery(prisma, {
        snapshotId: saved.id,
        recipient,
        status: "FAILED",
        error: error instanceof Error ? error.message : "Error desconocido al enviar.",
      });
    }
  }

  return {
    reportDate: snapshot.reportDate,
    status: snapshot.status,
    delivered,
    criticalAlerts: countCriticalAlerts(snapshot),
  };
}
```

> **Ya verificado contra el código:** `CommunicationResult` expone `ok: boolean`, `status: "success" | "failed" | "scheduled" | "skipped"`, `providerMessageId?` y `errorMessage?` (no `error`). El envío real exige las tres condiciones a la vez: `COMMUNICATIONS_LIVE_SEND=true`, el destinatario dentro de `RESEND_ALLOWED_RECIPIENTS` y `confirmLiveSend: true` en el código. Si falta alguna, el runtime queda en modo simulado, el informe igual se genera y se guarda, y la entrega se registra como `SKIPPED` con el motivo.

- [ ] **Paso 6: Implementar la ruta de la tarea programada**

`apps/compramelafoto/app/api/cron/daily-report/route.ts`:

```ts
/**
 * Cron: genera y envía el Informe Diario DNX.
 * Se ejecuta a las 03:00 UTC = 00:00 de Argentina.
 * Auth: Bearer CRON_SECRET (o x-cron-secret).
 */
import { NextRequest, NextResponse } from "next/server";

import { runDailyReport } from "@/lib/daily-report/run-daily-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorize(req: NextRequest): boolean {
  /* eslint-disable turbo/no-undeclared-env-vars -- cron auth */
  const secret = process.env.CRON_SECRET?.trim();
  /* eslint-enable turbo/no-undeclared-env-vars */
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = req.headers.get("x-cron-secret")?.trim() || "";
  return bearer === secret || alt === secret;
}

function isEnabled(): boolean {
  /* eslint-disable turbo/no-undeclared-env-vars -- configuración del informe diario */
  return process.env.DAILY_REPORT_ENABLED !== "false";
  /* eslint-enable turbo/no-undeclared-env-vars */
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!isEnabled()) {
    return NextResponse.json(
      { ok: true, paused: true, reason: "DAILY_REPORT_ENABLED=false" },
      { status: 200 },
    );
  }

  try {
    const result = await runDailyReport({ now: new Date() });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido.",
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Paso 7: Programar la tarea**

En `apps/compramelafoto/vercel.json`, agregar al arreglo `"crons"`:

```json
    { "path": "/api/cron/daily-report", "schedule": "0 3 * * *" }
```

> `0 3 * * *` en UTC son las 00:00 de Argentina. No cambiar a `0 0 * * *`.

- [ ] **Paso 8: Declarar las variables nuevas**

En `turbo.json`, agregar al arreglo `globalEnv` las que falten:

```json
    "DAILY_REPORT_RECIPIENTS",
    "DAILY_REPORT_ENABLED",
    "RESEND_FROM_EMAIL",
    "RESEND_FROM_NAME",
    "RESEND_ALLOWED_RECIPIENTS",
    "COMMUNICATIONS_LIVE_SEND",
    "COMMUNICATIONS_ENVIRONMENT",
```

En `apps/compramelafoto/.env.example`, agregar al final:

```bash
# Informe Diario DNX
DAILY_REPORT_RECIPIENTS=dnxfotografia@gmail.com
DAILY_REPORT_ENABLED=true

# DNX Comunicaciones — necesario para que el informe se envíe de verdad.
# Sin las tres juntas el runtime queda en modo simulado y el correo no sale.
RESEND_FROM_EMAIL=info@compramelafoto.com
RESEND_FROM_NAME=DNX Suite
RESEND_ALLOWED_RECIPIENTS=dnxfotografia@gmail.com
COMMUNICATIONS_LIVE_SEND=true
COMMUNICATIONS_ENVIRONMENT=production
```

> `info@compramelafoto.com` es el remitente que ya usa `apps/compramelafoto/lib/email-sender.ts` por defecto, así que su dominio está verificado en Resend.

- [ ] **Paso 9: Verificación completa**

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite
pnpm --filter @repo/ops-daily-report test
pnpm --filter @repo/communications test
pnpm --filter @repo/db test:daily-report
pnpm --filter compramelafoto exec tsx --test lib/daily-report/prisma-ports.test.ts
pnpm --filter compramelafoto exec tsx --test lib/daily-report/render-blocks.test.ts
pnpm --filter compramelafoto typecheck
pnpm --filter compramelafoto lint
```

Esperado: todo en verde.

- [ ] **Paso 10: Prueba en vivo contra la base de desarrollo**

```bash
pnpm --filter compramelafoto dev
```

En otra terminal, con `CRON_SECRET` en el `.env` local:

```bash
curl -s -H "x-cron-secret: $(grep '^CRON_SECRET=' apps/compramelafoto/.env | cut -d= -f2-)" \
  http://localhost:3000/api/cron/daily-report | head -40
```

Esperado: una respuesta JSON con `ok: true`, `reportDate` del día anterior y `status`. Verificar que la fila quedó guardada:

```bash
pnpm --filter @repo/db exec prisma studio
```

Buscar la tabla `DnxDailyReportSnapshot` y confirmar que hay una fila con la fecha correcta.

> Para probar el correo sin enviar de verdad, dejar `COMMUNICATIONS_LIVE_SEND=false`. Para probar el envío real, poner `COMMUNICATIONS_LIVE_SEND=true` y `RESEND_ALLOWED_RECIPIENTS=dnxfotografia@gmail.com`.

- [ ] **Paso 11: Commit**

```bash
git add apps/compramelafoto turbo.json
git commit -m "feat(clf): cron y envío del informe diario DNX"
```

---

## Autorrevisión del plan

**Cobertura del spec (Etapa 1):**

| Requisito del spec | Tarea |
|---|---|
| Paquete `@repo/ops-daily-report` con recolección aislada | 1, 2, 5 |
| Ventana horaria argentina, cron a las 03:00 UTC | 1, 12 |
| Contratos de métrica, alerta y snapshot | 2 |
| Motor de alertas por gravedad y urgencia | 3 |
| Tolerancia a fallos de colectores | 4, 8 |
| ComprameLaFoto monorepo: ventas y ranking de fotógrafos | 5 |
| Incidentes técnicos reutilizando `platform-health` | 6, 11 |
| Reconocimiento facial con tasa de coincidencia | 7 |
| Tablas `DnxDailyReportSnapshot` y `DnxDailyReportDelivery` | 9 |
| Plantilla `ops.daily-report` en DNX Comunicaciones | 10 |
| Envío a `dnxfotografia@gmail.com` | 12 |
| Variables `DAILY_REPORT_RECIPIENTS` y `DAILY_REPORT_ENABLED` | 12 |

**Fuera de esta etapa (van a las siguientes, según el spec):** panel `/admin/informe-diario` (Etapa 2, aunque el correo ya enlaza a esa ruta), Clickatón (Etapa 2), ComprameLaFoto legacy y FotoRank (Etapa 3), InfoSpot y FotOffice (Etapa 4).

**Nota:** el correo de la Etapa 1 enlaza a `/admin/informe-diario`, que todavía no existe. Es aceptable y deliberado: el enlace queda listo y la Etapa 2 lo activa. Si molesta ver un enlace roto durante la Etapa 1, quitar la línea `panelUrl` de `run-daily-report.ts` y reponerla en la Etapa 2.

**Consistencia de tipos verificada:** `DayWindow`/`DateRange` (Task 1) se usan igual en 5, 6, 7, 8 y 11. `ReportMetric`/`ReportAlert`/`ReportSection` (Task 2) se usan igual en 3, 4, 5, 6, 7, 8, 9 y 12. `Collector`/`CollectorResult` (Task 4) se producen en 5, 6, 7 y se consumen en 8 y 12. `ClfSalesPort`/`IncidentsPort`/`FaceRecognitionPort` (Task 5) se implementan en 11 y se consumen en 12. `DailyReportSnapshot` (Task 2) se persiste en 9 y se renderiza en 12.

**Verificado contra el código antes de ejecutar el plan:**

| Punto | Resultado |
|---|---|
| `FraudAlert` | Tiene `status` (OPEN/ACKNOWLEDGED/RESOLVED/FALSE_POSITIVE) y `resolvedAt`. Se filtra por `status: "OPEN"`. |
| `User.createdAt`, `Photo.createdAt` | Existen. |
| `AlbumInterest.faceMatchEvents` | Existe. Además tiene `faceId`, que marca si hubo búsqueda biométrica real. |
| `platform-health.ts` | Expone `zip.byStatus`, `zip.stuckOver1h`, `ftp.queuePending`, `ftp.queueFailed`, `ftp.workerStatus`, `exif.pending`, `exif.byStatus`. Todos usados tal cual. |
| `CommunicationResult` | `ok`, `status`, `providerMessageId?`, `errorMessage?`. Corregido en el plan. |
| Candado de envío | Requiere `COMMUNICATIONS_LIVE_SEND=true` + allowlist + `confirmLiveSend: true`. Resuelto en `ensureEmailProvider()`. |

| `OrderOrigin` | Tiene TRES valores: `STANDARD_CHECKOUT`, `PACK_REDEMPTION`, `PREVENTA_PACK`. El contrato y la normalización los cubren a los tres. |
| Remitente | `info@compramelafoto.com`, ya en uso por `email-sender.ts`, con dominio verificado en Resend. |

---

## Notas de la ejecución real (2026-08-24)

Lo que se desvió del plan al implementarlo, y por qué:

| Punto del plan | Qué pasó realmente |
|---|---|
| `prisma migrate dev` | **No se pudo usar.** La base de staging tiene 5 migraciones de otra rama (FotOffice: auditoría de socios, invitaciones, tarifas por módulo) que no están en esta rama, y además le falta `Album.scanProtectionEnabled` de la rama anterior. Prisma proponía resetear la base entera. Se escribió `20260824130000_add_dnx_daily_report/migration.sql` a mano y se aplicó con `prisma db execute` + `prisma migrate resolve --applied`. Solo agrega tipos y tablas nuevas; no toca nada existente. |
| Correr los tests de la app | `apps/compramelafoto` no tiene `tsx` instalado. Se usa el de otro paquete, como ya hacen los demás scripts de test de esa app: `pnpm --filter @repo/ops-daily-report exec tsx --tsconfig ../../apps/compramelafoto/tsconfig.json --test ...`. Quedó como script `test:daily-report`. |
| `registerCommunicationProvider(provider)` | La firma real es `(channel, provider, options?)`. Corregido. |
| Comentarios `eslint-disable turbo/no-undeclared-env-vars` | Ese plugin **no** está configurado en `apps/compramelafoto` (sí en InfoSpot). Los comentarios generaban 11 errores de lint. Se quitaron. |
| `typecheck` de la app | Agota la memoria de Node con la configuración por defecto. Requiere `NODE_OPTIONS='--max-old-space-size=8192'`, en línea con los 7 GB que ya usa el build de Vercel. |
| Mayúsculas en el resumen | El plan usaba `section.title.toUpperCase()`, que convertía "ComprameLaFoto" en "COMPRAMELAFOTO" y "FotOffice" en "FOTOFFICE". Se reemplazó por `── Título ──`, que respeta las mayúsculas de cada marca. |
| Script de vista previa | No estaba en el plan. Se agregó `scripts/daily-report-preview.ts` (`pnpm --filter compramelafoto report:preview`) para generar el informe sin enviarlo. Usa un puerto de incidentes propio porque `loadPlatformHealthSnapshot()` depende de alias de Next y no corre fuera del servidor. |

### Verificación realizada

- **158 tests** en verde: 47 del paquete, 91 de comunicaciones, 4 de persistencia, 16 de la app.
- **Typecheck y lint** sin errores propios en los cuatro paquetes tocados.
- **Ejecución real contra la base de staging**: el informe se generó completo en 5,5 s y detectó una incidencia verdadera (2 correos en cola desde hacía 766 horas).
- **Prueba de integración del ranking**, sembrando datos con SQL dentro de una transacción revertida: 3 pedidos contados y el marcado `isTest` excluido; 39.000 ARS sin dividir por cien; ranking ordenado correctamente (Beto 30.000 antes que Ana 9.000). La base quedó intacta.

### Pendiente para que el correo llegue de verdad

Cargar en Vercel, en el proyecto ComprameLaFoto: `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`,
`RESEND_ALLOWED_RECIPIENTS`, `COMMUNICATIONS_LIVE_SEND=true`, `COMMUNICATIONS_ENVIRONMENT=production`,
`DAILY_REPORT_RECIPIENTS`. Sin ellas el informe se genera y se guarda, pero la entrega
queda registrada como omitida.
