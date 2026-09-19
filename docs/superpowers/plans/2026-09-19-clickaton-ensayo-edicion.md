# Ensayo de edición (Clickatón) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a los administradores, dentro de cada edición de Clickatón, un chequeo automático de la configuración y un ensayo del recorrido completo del participante con un reloj que se puede mover a cualquier fecha y hora.

**Architecture:** El simulador no reimplementa reglas: invoca las mismas funciones que usa el sitio público, inyectándoles un `EditionClock`. El chequeo es de sólo lectura. El ensayo tiene dos modos: en seco (repositorios en memoria, cero escrituras) y completo (sobre una copia descartable de la edición, marcada con `isOpsFixture: true`, que se borra al final).

**Tech Stack:** Next.js (App Router, server actions), TypeScript, Prisma (`@repo/db`), `tsx --test` (node:test + `node:assert/strict`), Tailwind con el design system `ck-*`.

**Spec:** `docs/clickaton/CLICKATON_ENSAYO_DE_EDICION.md`

## Global Constraints

- **No se agregan columnas a `packages/db/prisma/schema.prisma`.** El schema es compartido por cinco bases Neon y cada campo nuevo hay que aplicarlo a mano en las cinco. Todo se apoya en campos existentes (`isOpsFixture`).
- **El reloj simulado nunca sale del servidor.** Sin cookies, sin cabeceras, sin parámetros de URL que lo propaguen.
- Todo texto visible va en **castellano rioplatense**, comprensible para alguien que no programa.
- Todos los parámetros nuevos de reloj son **opcionales con `systemClock()` por defecto**: el comportamiento en producción no cambia.
- Tests con `node:test` + `node:assert/strict`, nombres de helpers y variables en español, siguiendo `lib/timeline/prompt-gate.test.ts`.
- Cada archivo nuevo se registra en `package.json` como script `test:*` o `selfcheck:*`.
- Toda página y server action del admin arranca con `requireClickatonAdmin`.
- Clases de color: usar sólo las que existen en el design system. `bg-ck-card` y otras cinco **no existen** y se pintan transparentes sin avisar; seguir el patrón de las pantallas admin vecinas (`Card`, `Badge`, `text-ck-text`, `text-ck-text-muted`).

---

## Estructura de archivos

```
apps/clickaton/
  lib/edition-rehearsal/
    domain/
      types.ts                    Severidad, Hallazgo, ResultadoPaso, ResultadoEnsayo
      checks.ts                   reglas puras del chequeo (sin Prisma)
      checks.test.ts
      timeline-presets.ts         atajos del reloj a partir del cronograma
      timeline-presets.test.ts
    application/
      load-edition-snapshot.ts    lee de Prisma y arma la foto que consumen las reglas
      run-edition-check.ts        orquesta el chequeo
      run-dry-rehearsal.ts        los diez pasos, en seco
      clone-edition.ts            copia descartable
      discard-edition.ts          borrado con guardián de isOpsFixture
      run-full-rehearsal.ts       los diez pasos, escribiendo sobre la copia
    ui/
      rehearsal-presentation.ts   textos en castellano
      rehearsal-presentation.test.ts
    actions.ts                    server actions (chequeo, ensayo seco, ensayo completo)
  app/admin/(panel)/ediciones/[editionId]/ensayo/
    page.tsx
    RehearsalClient.tsx
  components/admin/editions/EditionDetailActions.tsx   (modificar: agregar pestaña)
  lib/public-registration/application/public-registration-service.ts  (modificar: clock)
  scripts/edition-rehearsal.selfcheck.ts
```

---

## Etapa 1 — El reloj llega a la inscripción

### Task 1: Reloj inyectable en el servicio de inscripción

**Files:**
- Modify: `apps/clickaton/lib/public-registration/application/public-registration-service.ts`
- Test: `apps/clickaton/lib/public-registration/application/registration-clock.test.ts` (crear)

**Interfaces:**
- Consumes: `EditionClock`, `systemClock`, `fixedClock` de `@/lib/timeline/clock`.
- Produces: `createPublicRegistrationService({ repo, rateLimit?, rateLimitSubject?, confirmFree?, promotions?, clock? })` — `clock?: EditionClock`, por defecto `systemClock()`. El servicio resuelve toda fecha con `clock.now()`.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/clickaton/lib/public-registration/application/registration-clock.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { fixedClock } from "@/lib/timeline/clock";
import { createPublicRegistrationService } from "./public-registration-service";
import { createInMemoryPublicRegistrationRepository } from "../infrastructure/in-memory-public-registration-repository";

test("la fase de precio se resuelve con el reloj inyectado, no con la hora real", async () => {
  const repo = createInMemoryPublicRegistrationRepository();
  // La edición y su fase viven en el repo en memoria; la fase temprana rige
  // hasta el 2026-10-01 y la tardía desde esa fecha.
  const servicio = createPublicRegistrationService({
    repo,
    clock: fixedClock(new Date("2026-09-20T12:00:00.000Z")),
  });

  const contexto = await servicio.getContext("clickaton-demo");
  assert.equal(contexto.ok, true);
});

test("sin reloj inyectado el servicio usa la hora real", () => {
  const repo = createInMemoryPublicRegistrationRepository();
  const servicio = createPublicRegistrationService({ repo });
  assert.ok(typeof servicio.getContext === "function");
});
```

> Nota para el implementador: el repositorio en memoria expone helpers para
> sembrar edición, entradas y fases. Leer su API real antes de escribir el test
> y ajustar la siembra para que la primera aserción distinga de verdad una fase
> de otra — el test debe fallar si el servicio ignora el reloj.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter clickaton exec tsx --test lib/public-registration/application/registration-clock.test.ts`
Expected: FAIL — `clock` no existe en las dependencias del servicio.

- [ ] **Step 3: Agregar `clock` a las dependencias**

En `createPublicRegistrationService`, sumar al tipo de `deps`:

```ts
  /** Reloj de la edición. Por defecto la hora real; se inyecta en ensayos. */
  clock?: EditionClock | null;
```

y en el cuerpo:

```ts
  const clock = deps.clock ?? systemClock();
```

Reemplazar cada `new Date()` del archivo por `clock.now()`. Los tres puntos son:
`resolveCurrentPricePhase(phases, new Date())` (línea ~385), y los `const now = new Date()` de las líneas ~395 y ~605. Propagar `clock.now()` como el `now` que ya aceptan `createExpirePendingRegistrationsUseCase` y `createCheckoutEligibilityUseCase`.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter clickaton exec tsx --test lib/public-registration/application/registration-clock.test.ts`
Expected: PASS

- [ ] **Step 5: Verificar que no se rompió nada**

Run: `pnpm --filter clickaton selfcheck:public-registration-reservation && pnpm --filter clickaton selfcheck:public-registration-hardening && pnpm --filter clickaton selfcheck:registration-funnel-11b`
Expected: los tres terminan en OK.

- [ ] **Step 6: Registrar el test y commitear**

Agregar a `package.json`:

```json
    "test:registration-clock": "tsx --test lib/public-registration/application/registration-clock.test.ts",
```

```bash
git add apps/clickaton/lib/public-registration apps/clickaton/package.json
git commit -m "Inyectar el reloj de la edición en el servicio de inscripción"
```

---

## Etapa 2 — El chequeo de configuración

### Task 2: Tipos y reglas puras del chequeo

**Files:**
- Create: `apps/clickaton/lib/edition-rehearsal/domain/types.ts`
- Create: `apps/clickaton/lib/edition-rehearsal/domain/checks.ts`
- Test: `apps/clickaton/lib/edition-rehearsal/domain/checks.test.ts`

**Interfaces:**
- Produces:
  - `type Severidad = "BIEN" | "ATENCION" | "BLOQUEANTE"`
  - `type Hallazgo = { id: string; rubro: Rubro; severidad: Severidad; titulo: string; detalle: string; comoArreglar: string | null; enlace: string | null }`
  - `type Rubro = "PUBLICACION" | "VENTA" | "CRONOGRAMA" | "CONSIGNAS" | "ACREDITACION" | "SUBIDA" | "CORREOS" | "ADMISION"`
  - `type FotoDeEdicion = { ... }` — la foto de sólo lectura que consumen las reglas (definida en `types.ts`, sin tipos de Prisma).
  - `revisarEdicion(foto: FotoDeEdicion, clock?: EditionClock): Hallazgo[]`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `checks.test.ts`. Los dos casos centrales son las roturas ya vividas:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { fixedClock } from "@/lib/timeline/clock";
import { revisarEdicion } from "./checks";
import type { FotoDeEdicion } from "./types";

const AHORA = fixedClock(new Date("2026-09-19T15:00:00.000Z"));

function edicionSana(over: Partial<FotoDeEdicion> = {}): FotoDeEdicion {
  return {
    id: "ed1",
    slug: "clickaton-test",
    nombre: "Clickatón de prueba",
    publicada: true,
    inscripcionHabilitada: true,
    zonaHoraria: "America/Argentina/Buenos_Aires",
    comienzaEl: new Date("2026-10-10T19:00:00.000Z"),
    terminaEl: new Date("2026-10-10T23:00:00.000Z"),
    inscripcionAbreEl: new Date("2026-09-01T12:00:00.000Z"),
    inscripcionCierraEl: new Date("2026-10-09T23:59:00.000Z"),
    fasesDePrecio: [
      {
        id: "f1",
        nombre: "General",
        comienzaEl: new Date("2026-09-01T12:00:00.000Z"),
        terminaEl: new Date("2026-10-09T23:59:00.000Z"),
      },
    ],
    entradas: [{ id: "t1", nombre: "General", precio: 15000, agotada: false, cupo: 300 }],
    tieneCronogramaActivo: true,
    eventos: [],
    consignas: [
      { id: "c1", estado: "READY", capturaAbreEl: null, capturaCierraEl: null, subidaAbreEl: null, subidaCierraEl: null },
    ],
    acreditacionHabilitada: true,
    hayConfiguracionDeSubida: true,
    hayConfiguracionDeAdmision: true,
    mercadoPagoConectado: true,
    ...over,
  };
}

test("una edición sana no tiene hallazgos bloqueantes", () => {
  const hallazgos = revisarEdicion(edicionSana(), AHORA);
  assert.equal(hallazgos.filter((h) => h.severidad === "BLOQUEANTE").length, 0);
});

test("consignas en DRAFT son bloqueantes y explican la consecuencia", () => {
  const hallazgos = revisarEdicion(
    edicionSana({
      consignas: [
        { id: "c1", estado: "DRAFT", capturaAbreEl: null, capturaCierraEl: null, subidaAbreEl: null, subidaCierraEl: null },
      ],
    }),
    AHORA,
  );
  const hallazgo = hallazgos.find((h) => h.id === "consignas-en-borrador");
  assert.ok(hallazgo, "falta el hallazgo de consignas en borrador");
  assert.equal(hallazgo.severidad, "BLOQUEANTE");
  assert.match(hallazgo.detalle, /no (se )?libera/i);
});

test("una edición sin ninguna consigna es bloqueante", () => {
  const hallazgos = revisarEdicion(edicionSana({ consignas: [] }), AHORA);
  assert.ok(hallazgos.some((h) => h.id === "sin-consignas" && h.severidad === "BLOQUEANTE"));
});

test("la fase de precio que vence antes que la ventana de inscripción es bloqueante", () => {
  const hallazgos = revisarEdicion(
    edicionSana({
      inscripcionCierraEl: new Date("2026-10-09T23:59:00.000Z"),
      fasesDePrecio: [
        {
          id: "f1",
          nombre: "General",
          comienzaEl: new Date("2026-09-01T12:00:00.000Z"),
          terminaEl: new Date("2026-09-25T23:59:00.000Z"),
        },
      ],
    }),
    AHORA,
  );
  const hallazgo = hallazgos.find((h) => h.id === "fase-de-precio-mas-corta-que-la-ventana");
  assert.ok(hallazgo, "falta el hallazgo de las dos fechas de inscripción");
  assert.equal(hallazgo.severidad, "BLOQUEANTE");
});

test("sin ninguna fase de precio vigente no se puede vender", () => {
  const hallazgos = revisarEdicion(edicionSana({ fasesDePrecio: [] }), AHORA);
  assert.ok(hallazgos.some((h) => h.id === "sin-fase-de-precio" && h.severidad === "BLOQUEANTE"));
});

test("la captura que cierra después de la subida es bloqueante", () => {
  const hallazgos = revisarEdicion(
    edicionSana({
      consignas: [
        {
          id: "c1",
          estado: "READY",
          capturaAbreEl: new Date("2026-10-10T19:00:00.000Z"),
          capturaCierraEl: new Date("2026-10-10T23:00:00.000Z"),
          subidaAbreEl: new Date("2026-10-10T19:00:00.000Z"),
          subidaCierraEl: new Date("2026-10-10T21:00:00.000Z"),
        },
      ],
    }),
    AHORA,
  );
  assert.ok(
    hallazgos.some((h) => h.id === "captura-cierra-despues-que-la-subida" && h.severidad === "BLOQUEANTE"),
  );
});

test("sin cronograma activo es bloqueante", () => {
  const hallazgos = revisarEdicion(edicionSana({ tieneCronogramaActivo: false }), AHORA);
  assert.ok(hallazgos.some((h) => h.id === "sin-cronograma" && h.severidad === "BLOQUEANTE"));
});

test("edición no publicada avisa pero no bloquea", () => {
  const hallazgos = revisarEdicion(edicionSana({ publicada: false }), AHORA);
  const hallazgo = hallazgos.find((h) => h.id === "edicion-no-publicada");
  assert.ok(hallazgo);
  assert.equal(hallazgo.severidad, "ATENCION");
});

test("Mercado Pago desconectado con entradas pagas es bloqueante", () => {
  const hallazgos = revisarEdicion(edicionSana({ mercadoPagoConectado: false }), AHORA);
  assert.ok(hallazgos.some((h) => h.id === "mercado-pago-sin-conectar" && h.severidad === "BLOQUEANTE"));
});

test("Mercado Pago desconectado con edición gratuita no molesta", () => {
  const hallazgos = revisarEdicion(
    edicionSana({
      mercadoPagoConectado: false,
      entradas: [{ id: "t1", nombre: "Gratuita", precio: 0, agotada: false, cupo: 300 }],
    }),
    AHORA,
  );
  assert.equal(hallazgos.filter((h) => h.id === "mercado-pago-sin-conectar").length, 0);
});

test("todo hallazgo trae título y detalle legibles", () => {
  const hallazgos = revisarEdicion(edicionSana({ consignas: [], fasesDePrecio: [] }), AHORA);
  for (const h of hallazgos) {
    assert.ok(h.titulo.length > 0, `hallazgo ${h.id} sin título`);
    assert.ok(h.detalle.length > 0, `hallazgo ${h.id} sin detalle`);
  }
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm --filter clickaton exec tsx --test lib/edition-rehearsal/domain/checks.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Escribir `types.ts` y `checks.ts`**

`types.ts` define `Severidad`, `Rubro`, `Hallazgo`, `FotoDeEdicion` y sus subtipos
(`FaseDePrecio`, `EntradaDeEdicion`, `ConsignaDeEdicion`) exactamente con los campos
que usa el test. Sin importar nada de Prisma.

`checks.ts` exporta `revisarEdicion(foto, clock = systemClock())` que aplica un control
por función pequeña (`revisarPublicacion`, `revisarVenta`, `revisarCronograma`,
`revisarConsignas`, `revisarAcreditacion`, `revisarSubida`, `revisarAdmision`) y
concatena los hallazgos. Cada control devuelve `Hallazgo[]`.

Reglas, una por `id`:

| `id` | Severidad | Condición |
|---|---|---|
| `edicion-no-publicada` | ATENCION | `!publicada` |
| `inscripcion-deshabilitada` | ATENCION | `!inscripcionHabilitada` |
| `sin-fase-de-precio` | BLOQUEANTE | `fasesDePrecio.length === 0` y alguna entrada con `precio > 0` |
| `fase-de-precio-mas-corta-que-la-ventana` | BLOQUEANTE | la última `terminaEl` de las fases es anterior a `inscripcionCierraEl` |
| `sin-entradas` | BLOQUEANTE | `entradas.length === 0` |
| `entradas-agotadas` | ATENCION | todas `agotada` |
| `mercado-pago-sin-conectar` | BLOQUEANTE | `!mercadoPagoConectado` y alguna entrada con `precio > 0` |
| `sin-cronograma` | BLOQUEANTE | `!tieneCronogramaActivo` |
| `cronograma-invertido` | BLOQUEANTE | `comienzaEl` posterior a `terminaEl` |
| `sin-consignas` | BLOQUEANTE | `consignas.length === 0` |
| `consignas-en-borrador` | BLOQUEANTE | alguna con `estado === "DRAFT"` |
| `captura-cierra-despues-que-la-subida` | BLOQUEANTE | alguna con `capturaCierraEl > subidaCierraEl` |
| `sin-ventanas-de-captura` | ATENCION | alguna sin `capturaAbreEl` |
| `acreditacion-apagada` | ATENCION | `!acreditacionHabilitada` |
| `sin-configuracion-de-subida` | BLOQUEANTE | `!hayConfiguracionDeSubida` |
| `sin-configuracion-de-admision` | ATENCION | `!hayConfiguracionDeAdmision` |

Cuando una condición no se cumple, el control emite el hallazgo equivalente con
severidad `BIEN` (para que la pantalla pueda mostrar los verdes además de los rojos).

El `detalle` del hallazgo `consignas-en-borrador` debe decir explícitamente que el
cronograma no libera las consignas en borrador y que los participantes verían la
cuenta regresiva en cero sin contenido. El de
`fase-de-precio-mas-corta-que-la-ventana` debe decir que extender la inscripción son
dos fechas y que con una sola la venta se corta sola.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `pnpm --filter clickaton exec tsx --test lib/edition-rehearsal/domain/checks.test.ts`
Expected: PASS, los once tests.

- [ ] **Step 5: Registrar y commitear**

```json
    "test:edition-rehearsal-checks": "tsx --test lib/edition-rehearsal/domain/checks.test.ts",
```

```bash
git add apps/clickaton/lib/edition-rehearsal apps/clickaton/package.json
git commit -m "Reglas del chequeo de edición"
```

---

### Task 3: Leer la edición real y armar la foto

**Files:**
- Create: `apps/clickaton/lib/edition-rehearsal/application/load-edition-snapshot.ts`
- Create: `apps/clickaton/lib/edition-rehearsal/application/run-edition-check.ts`

**Interfaces:**
- Consumes: `FotoDeEdicion`, `revisarEdicion` de Task 2.
- Produces:
  - `cargarFotoDeEdicion(editionId: string): Promise<FotoDeEdicion | null>`
  - `correrChequeoDeEdicion(editionId: string, clock?: EditionClock): Promise<{ ok: true; hallazgos: Hallazgo[] } | { ok: false; mensaje: string }>`

- [ ] **Step 1: Escribir `load-edition-snapshot.ts`**

Una sola consulta Prisma con `include` de `pricePhases`, `ticketTypes`, `prompts`,
`timelines` (sólo el activo), `uploadConfig`, `accreditationConfig`, `admissionConfig`.
Mapear cada campo de Prisma al nombre en castellano de `FotoDeEdicion`. La conexión de
Mercado Pago se resuelve como lo hace hoy `app/admin/(panel)/integraciones/diagnostico/page.tsx`
(buscar la `dnxFinancialIdentity` del owner y mirar el estado de su `paymentAccounts[0]`).

Devuelve `null` si la edición no existe.

- [ ] **Step 2: Escribir `run-edition-check.ts`**

```ts
export async function correrChequeoDeEdicion(editionId: string, clock: EditionClock = systemClock()) {
  try {
    const foto = await cargarFotoDeEdicion(editionId);
    if (!foto) return { ok: false as const, mensaje: "No encontramos esa edición." };
    return { ok: true as const, hallazgos: revisarEdicion(foto, clock) };
  } catch {
    return { ok: false as const, mensaje: "No pudimos leer la edición. Revisá la conexión e intentá de nuevo." };
  }
}
```

- [ ] **Step 3: Verificar que compila**

Run: `pnpm --filter clickaton check-types`
Expected: sin errores.

- [ ] **Step 4: Commitear**

```bash
git add apps/clickaton/lib/edition-rehearsal/application
git commit -m "Leer la edición real para el chequeo"
```

---

### Task 4: La pestaña y la pantalla del chequeo

**Files:**
- Create: `apps/clickaton/lib/edition-rehearsal/ui/rehearsal-presentation.ts`
- Test: `apps/clickaton/lib/edition-rehearsal/ui/rehearsal-presentation.test.ts`
- Create: `apps/clickaton/lib/edition-rehearsal/actions.ts`
- Create: `apps/clickaton/app/admin/(panel)/ediciones/[editionId]/ensayo/page.tsx`
- Create: `apps/clickaton/app/admin/(panel)/ediciones/[editionId]/ensayo/RehearsalClient.tsx`
- Modify: `apps/clickaton/components/admin/editions/EditionDetailActions.tsx`

**Interfaces:**
- Produces:
  - `presentarSeveridad(s: Severidad): { etiqueta: string; variante: "success" | "warning" | "danger" }`
  - `presentarRubro(r: Rubro): string`
  - `resumirHallazgos(hallazgos: Hallazgo[]): { bloqueantes: number; atenciones: number; bien: number; veredicto: string }`
  - server action `chequearEdicionAction(editionId: string)`

- [ ] **Step 1: Test de presentación**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { presentarSeveridad, presentarRubro, resumirHallazgos } from "./rehearsal-presentation";

test("cada severidad tiene etiqueta en castellano", () => {
  assert.equal(presentarSeveridad("BIEN").etiqueta, "Todo bien");
  assert.equal(presentarSeveridad("ATENCION").etiqueta, "Atención");
  assert.equal(presentarSeveridad("BLOQUEANTE").etiqueta, "Bloqueante");
});

test("cada rubro tiene nombre en castellano", () => {
  assert.equal(presentarRubro("CONSIGNAS"), "Consignas");
  assert.equal(presentarRubro("ACREDITACION"), "Acreditación");
});

test("el veredicto avisa cuando hay bloqueantes", () => {
  const resumen = resumirHallazgos([
    { id: "x", rubro: "CONSIGNAS", severidad: "BLOQUEANTE", titulo: "t", detalle: "d", comoArreglar: null, enlace: null },
  ]);
  assert.equal(resumen.bloqueantes, 1);
  assert.match(resumen.veredicto, /no está lista/i);
});

test("sin hallazgos graves el veredicto es positivo", () => {
  const resumen = resumirHallazgos([
    { id: "x", rubro: "VENTA", severidad: "BIEN", titulo: "t", detalle: "d", comoArreglar: null, enlace: null },
  ]);
  assert.equal(resumen.bloqueantes, 0);
  assert.match(resumen.veredicto, /lista/i);
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm --filter clickaton exec tsx --test lib/edition-rehearsal/ui/rehearsal-presentation.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar la presentación**

Sin lógica de negocio: sólo traducción de estados a texto y conteo.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `pnpm --filter clickaton exec tsx --test lib/edition-rehearsal/ui/rehearsal-presentation.test.ts`
Expected: PASS

- [ ] **Step 5: Server action**

`actions.ts` con `"use server"`. `chequearEdicionAction` llama a `requireClickatonAdmin`
y devuelve `correrChequeoDeEdicion(editionId)`.

- [ ] **Step 6: La pantalla**

`page.tsx` (server component): `requireClickatonAdmin`, carga la edición con
`getEditionById`, `notFound()` si no existe, y renderiza `AdminPageHeader` con
breadcrumbs (`Ediciones` → nombre → `Ensayo`) más `<RehearsalClient editionId editionName />`.

`RehearsalClient.tsx` (`"use client"`): botón "Revisar todo" que llama a la action,
muestra el veredicto arriba y los hallazgos agrupados por rubro, cada uno con su
`Badge` de severidad, el detalle, el cómo arreglarlo y el enlace. Usar `Card`, `Badge`
y `Button` del design system, como las pantallas admin vecinas.

- [ ] **Step 7: Agregar la pestaña**

En `components/admin/editions/EditionDetailActions.tsx`, sumar al final de `MODULES`:

```ts
  { key: "ensayo", label: "Ensayo" },
```

- [ ] **Step 8: Verificar**

Run: `pnpm --filter clickaton check-types && pnpm --filter clickaton lint`
Expected: sin errores ni advertencias.

- [ ] **Step 9: Commitear**

```json
    "test:edition-rehearsal-ux": "tsx --test lib/edition-rehearsal/ui/rehearsal-presentation.test.ts",
```

```bash
git add apps/clickaton
git commit -m "Pantalla de chequeo de la edición"
```

---

## Etapa 3 — El ensayo en seco

### Task 5: Atajos del reloj

**Files:**
- Create: `apps/clickaton/lib/edition-rehearsal/domain/timeline-presets.ts`
- Test: `apps/clickaton/lib/edition-rehearsal/domain/timeline-presets.test.ts`

**Interfaces:**
- Produces: `calcularAtajosDeReloj(foto: FotoDeEdicion, clock?: EditionClock): AtajoDeReloj[]` donde `AtajoDeReloj = { id: string; etiqueta: string; momento: Date | null; porQue: string }`.

- [ ] **Step 1: Test que falla**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { fixedClock } from "@/lib/timeline/clock";
import { calcularAtajosDeReloj } from "./timeline-presets";
import type { FotoDeEdicion } from "./types";

const AHORA = fixedClock(new Date("2026-09-19T15:00:00.000Z"));

function foto(over: Partial<FotoDeEdicion> = {}): FotoDeEdicion {
  // Reutilizar el mismo armador que checks.test.ts, exportado desde un helper
  // compartido si hace falta; no duplicar a mano.
  return { /* ...misma edición sana... */ } as FotoDeEdicion;
}

test("el atajo de inicio de la maratón usa la fecha de comienzo", () => {
  const atajos = calcularAtajosDeReloj(foto(), AHORA);
  const inicio = atajos.find((a) => a.id === "inicio-de-la-maraton");
  assert.ok(inicio);
  assert.equal(inicio.momento?.toISOString(), "2026-10-10T19:00:00.000Z");
});

test("un cronograma incompleto devuelve el atajo con momento nulo, no rompe", () => {
  const atajos = calcularAtajosDeReloj(foto({ comienzaEl: null }), AHORA);
  const inicio = atajos.find((a) => a.id === "inicio-de-la-maraton");
  assert.ok(inicio);
  assert.equal(inicio.momento, null);
});

test("siempre existe el atajo de ahora", () => {
  const atajos = calcularAtajosDeReloj(foto(), AHORA);
  const ahora = atajos.find((a) => a.id === "ahora");
  assert.equal(ahora?.momento?.toISOString(), "2026-09-19T15:00:00.000Z");
});

test("los atajos vienen ordenados cronológicamente", () => {
  const atajos = calcularAtajosDeReloj(foto(), AHORA).filter((a) => a.momento !== null);
  const tiempos = atajos.map((a) => a.momento.getTime());
  assert.deepEqual(tiempos, [...tiempos].sort((a, b) => a - b));
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm --filter clickaton exec tsx --test lib/edition-rehearsal/domain/timeline-presets.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

Atajos: `ahora`, `tres-dias-antes`, `apertura-de-inscripcion`, `antes-del-cierre-de-inscripcion`
(un minuto antes), `inicio-de-la-maraton`, `liberacion-de-consignas` (resuelto con
`resolvePromptGate`), `mitad-de-la-captura`, `cierre-de-captura`,
`entre-captura-y-subida`, `cierre-de-subida`, `despues-de-todo`. Cada uno con su
`porQue` en castellano. Momento `null` cuando el dato no está cargado.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `pnpm --filter clickaton exec tsx --test lib/edition-rehearsal/domain/timeline-presets.test.ts`
Expected: PASS

- [ ] **Step 5: Commitear**

```json
    "test:edition-rehearsal-presets": "tsx --test lib/edition-rehearsal/domain/timeline-presets.test.ts",
```

```bash
git add apps/clickaton
git commit -m "Atajos del reloj del ensayo"
```

---

### Task 6: Los diez pasos, en seco

**Files:**
- Create: `apps/clickaton/lib/edition-rehearsal/application/run-dry-rehearsal.ts`
- Create: `apps/clickaton/scripts/edition-rehearsal.selfcheck.ts`

**Interfaces:**
- Produces:
  - `type ResultadoPaso = { numero: number; nombre: string; estado: "PASO" | "FALLO" | "NO_CORRESPONDE"; queVeria: string; detalle: string; comoArreglar: string | null }`
  - `type ResultadoEnsayo = { momentoSimulado: string; pasos: ResultadoPaso[]; veredicto: string }`
  - `correrEnsayoEnSeco(input: { editionId: string; momento: Date }): Promise<{ ok: true; resultado: ResultadoEnsayo } | { ok: false; mensaje: string }>`

- [ ] **Step 1: Escribir el selfcheck que falla**

`scripts/edition-rehearsal.selfcheck.ts` arma dos ediciones en memoria y comprueba el
comportamiento que da sentido a toda la herramienta:

```ts
/**
 * Self-check del ensayo en seco.
 * pnpm --filter clickaton selfcheck:edition-rehearsal
 */
import assert from "node:assert/strict";
import { fixedClock } from "@/lib/timeline/clock";
import { correrPasosEnSeco } from "@/lib/edition-rehearsal/application/run-dry-rehearsal";

// 1. Una edición sana, parada en el momento de la liberación: los diez pasos pasan.
{
  const resultado = await correrPasosEnSeco({
    foto: edicionSana(),
    clock: fixedClock(new Date("2026-10-10T19:05:00.000Z")),
  });
  const fallidos = resultado.pasos.filter((p) => p.estado === "FALLO");
  assert.deepEqual(fallidos.map((p) => p.numero), [], "una edición sana no debería fallar ningún paso");
}

// 2. Consignas en DRAFT: falla exactamente el paso 8.
{
  const resultado = await correrPasosEnSeco({
    foto: edicionConConsignasEnBorrador(),
    clock: fixedClock(new Date("2026-10-10T19:05:00.000Z")),
  });
  const fallidos = resultado.pasos.filter((p) => p.estado === "FALLO").map((p) => p.numero);
  assert.ok(fallidos.includes(8), "las consignas en borrador deben romper el paso 8");
}

// 3. Fase de precio vencida: falla el paso 2.
{
  const resultado = await correrPasosEnSeco({
    foto: edicionConFaseDePrecioVencida(),
    clock: fixedClock(new Date("2026-10-01T12:00:00.000Z")),
  });
  const fallidos = resultado.pasos.filter((p) => p.estado === "FALLO").map((p) => p.numero);
  assert.ok(fallidos.includes(2), "la fase de precio vencida debe romper el paso 2");
}

// 4. Antes de la apertura: los pasos posteriores no son error, son "todavía no".
{
  const resultado = await correrPasosEnSeco({
    foto: edicionSana(),
    clock: fixedClock(new Date("2026-08-01T12:00:00.000Z")),
  });
  assert.equal(resultado.pasos.filter((p) => p.estado === "FALLO").length, 0);
  assert.ok(resultado.pasos.some((p) => p.estado === "NO_CORRESPONDE"));
}

console.log("edition-rehearsal.selfcheck: OK");
```

> El selfcheck usa `correrPasosEnSeco({ foto, clock })` —la función pura sobre una foto
> ya cargada— mientras que la server action usa `correrEnsayoEnSeco({ editionId, momento })`,
> que carga la foto de Prisma y delega. Así el selfcheck no necesita base de datos.

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm --filter clickaton exec tsx scripts/edition-rehearsal.selfcheck.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar los pasos**

`run-dry-rehearsal.ts` exporta `correrPasosEnSeco({ foto, clock })` y
`correrEnsayoEnSeco({ editionId, momento })`. Cada paso es una función chica que
devuelve un `ResultadoPaso`, invocando la función real de producción:

1. `presentRegistrationCta` sobre la foto → `queVeria` es la etiqueta del botón.
2. `createPublicRegistrationService({ repo: repoEnMemoria, clock }).createRegistration(...)`.
3. `confirmFreeRegistration` o el adaptador de prueba de pagos, según el precio.
4. `sendParticipantFunnelEmail({ ..., dryRunBuildOnly: true })` → `queVeria` es el asunto.
5. `buildCredentialPreviewVariables` → `queVeria` es el código visible.
6. `evaluateAccreditationEligibility` → `queVeria` es el color del semáforo del escáner.
7. estado en vivo calculado con `resolvePromptGate` → cuenta regresiva o consignas.
8. `resolvePromptGate` con las consignas de la foto → cuántas consignas ve.
9. `resolveEffectiveWindows` + `getUploadWindowState` + `evaluateCaptureDate` con una foto
   de prueba de EXIF sintético cuya fecha de captura cae dentro de la ventana.
10. `evaluateSubmission` sobre esa foto.

Un paso cuyo momento todavía no llegó devuelve `NO_CORRESPONDE`, no `FALLO`.
Un paso que falla corta los siguientes marcándolos `NO_CORRESPONDE` con el detalle
"no se pudo llegar hasta acá".

- [ ] **Step 4: Correr y verificar que pasa**

Run: `pnpm --filter clickaton exec tsx scripts/edition-rehearsal.selfcheck.ts`
Expected: `edition-rehearsal.selfcheck: OK`

- [ ] **Step 5: Commitear**

```json
    "selfcheck:edition-rehearsal": "tsx scripts/edition-rehearsal.selfcheck.ts",
```

```bash
git add apps/clickaton
git commit -m "Ensayo del participante en seco"
```

---

### Task 7: La pantalla del ensayo con el reloj

**Files:**
- Modify: `apps/clickaton/lib/edition-rehearsal/actions.ts`
- Modify: `apps/clickaton/app/admin/(panel)/ediciones/[editionId]/ensayo/RehearsalClient.tsx`

**Interfaces:**
- Produces: server action `ensayarEnSecoAction(editionId: string, momentoIso: string)`.

- [ ] **Step 1: Server action**

`ensayarEnSecoAction` con `requireClickatonAdmin`, valida que `momentoIso` sea una fecha
real, y llama a `correrEnsayoEnSeco`.

- [ ] **Step 2: La interfaz**

En `RehearsalClient.tsx`, debajo del chequeo: un selector de fecha y hora que arranca en
la hora actual, la fila de atajos (botones que fijan el momento) y el botón "Ensayar el
recorrido". El resultado se muestra como una lista de diez pasos, cada uno con su
estado, lo que vería la persona y —si falló— cómo arreglarlo.

Mostrar siempre, arriba del resultado, el momento simulado en hora de la edición, con
un cartel que aclare que es una simulación y que nadie más ve esa hora.

- [ ] **Step 3: Verificar**

Run: `pnpm --filter clickaton check-types && pnpm --filter clickaton lint`
Expected: sin errores.

- [ ] **Step 4: Commitear**

```bash
git add apps/clickaton
git commit -m "Reloj movible y recorrido en la pantalla de ensayo"
```

---

## Etapa 4 — El ensayo completo

### Task 8: Clonar la edición

**Files:**
- Create: `apps/clickaton/lib/edition-rehearsal/application/clone-edition.ts`

**Interfaces:**
- Produces: `clonarEdicionParaEnsayo(editionId: string): Promise<{ ok: true; copiaId: string; copiaSlug: string } | { ok: false; mensaje: string }>`

- [ ] **Step 1: Implementar**

En una transacción Prisma: crea la `ClickatonEdition` copia con `isOpsFixture: true`,
`isPublished: false`, `status: "DRAFT"`, `slug: \`${original.slug}-ensayo-${Date.now()}\``
y `name: \`[ENSAYO] ${original.name}\``. Copia `pricePhases`, `ticketTypes`, el timeline
activo con sus eventos, `prompts`, `uploadConfig`, `accreditationConfig`,
`admissionConfig` y `sequence`. No copia sedes, sponsors, banners ni contenidos.

- [ ] **Step 2: Verificar que compila**

Run: `pnpm --filter clickaton check-types`
Expected: sin errores.

- [ ] **Step 3: Commitear**

```bash
git add apps/clickaton/lib/edition-rehearsal/application/clone-edition.ts
git commit -m "Clonar una edición para el ensayo"
```

---

### Task 9: Borrar la copia, con guardián

**Files:**
- Create: `apps/clickaton/lib/edition-rehearsal/application/discard-edition.ts`
- Create: `apps/clickaton/lib/edition-rehearsal/application/discard-guard.ts`
- Test: `apps/clickaton/lib/edition-rehearsal/application/discard-guard.test.ts`

**Interfaces:**
- Produces:
  - `sePuedeDescartar(edicion: { id: string; isOpsFixture: boolean; isPublished: boolean }): { ok: boolean; motivo: string | null }`
  - `descartarEdicionDeEnsayo(copiaId: string): Promise<{ ok: true; borrado: Record<string, number> } | { ok: false; mensaje: string }>`

- [ ] **Step 1: Test del guardián**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { sePuedeDescartar } from "./discard-guard";

test("una edición de ensayo se puede descartar", () => {
  const r = sePuedeDescartar({ id: "c1", isOpsFixture: true, isPublished: false });
  assert.equal(r.ok, true);
});

test("una edición real NUNCA se puede descartar", () => {
  const r = sePuedeDescartar({ id: "real", isOpsFixture: false, isPublished: true });
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? "", /no es una copia de ensayo/i);
});

test("una edición sin el flag tampoco se descarta aunque no esté publicada", () => {
  const r = sePuedeDescartar({ id: "real", isOpsFixture: false, isPublished: false });
  assert.equal(r.ok, false);
});

test("una copia publicada por error no se descarta sin revisar", () => {
  const r = sePuedeDescartar({ id: "c1", isOpsFixture: true, isPublished: true });
  assert.equal(r.ok, false);
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm --filter clickaton exec tsx --test lib/edition-rehearsal/application/discard-guard.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar el guardián y el borrado**

`discard-guard.ts` es puro. `discard-edition.ts` lee la edición, **aplica el guardián y
aborta si dice que no**, y recién entonces borra en transacción: submissions, decisiones
de admisión, check-ins, credenciales, inscripciones, consignas, eventos, timeline,
configuraciones, fases, entradas, secuencia y por último la edición. Devuelve cuántas
filas borró de cada tabla.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `pnpm --filter clickaton exec tsx --test lib/edition-rehearsal/application/discard-guard.test.ts`
Expected: PASS

- [ ] **Step 5: Commitear**

```json
    "test:edition-rehearsal-discard": "tsx --test lib/edition-rehearsal/application/discard-guard.test.ts",
```

```bash
git add apps/clickaton
git commit -m "Borrado de la copia de ensayo con guardián"
```

---

### Task 10: El ensayo completo de punta a punta

**Files:**
- Create: `apps/clickaton/lib/edition-rehearsal/application/run-full-rehearsal.ts`
- Modify: `apps/clickaton/lib/edition-rehearsal/actions.ts`
- Modify: `apps/clickaton/app/admin/(panel)/ediciones/[editionId]/ensayo/RehearsalClient.tsx`

**Interfaces:**
- Produces:
  - `correrEnsayoCompleto(input: { editionId: string; momento: Date }): Promise<{ ok: true; resultado: ResultadoEnsayo; copiaId: string; borrado: Record<string, number> | null; avisoDeLimpieza: string | null } | { ok: false; mensaje: string }>`
  - server action `ensayarCompletoAction(editionId: string, momentoIso: string, nombreEscrito: string)`

- [ ] **Step 1: Implementar el recorrido**

`correrEnsayoCompleto` clona, corre los diez pasos escribiendo de verdad sobre la copia
(inscripción en la base, foto real subida a R2, credencial emitida, check-in
registrado), y en un `finally` descarta la copia. Si el descarte falla, devuelve
`avisoDeLimpieza` con el `copiaId` a la vista.

El participante ficticio usa `ensayo+<editionId>@clickaton.test` y nombre
"Participante de ensayo".

- [ ] **Step 2: Server action con confirmación**

`ensayarCompletoAction` exige que `nombreEscrito` coincida exactamente con el nombre de
la edición; si no, devuelve un error pidiendo escribirlo bien. Después,
`requireClickatonAdmin` y el ensayo.

- [ ] **Step 3: La interfaz**

Una tercera tarjeta, visualmente separada, titulada "Ensayo completo". Explica en dos
líneas qué hace (crea una copia descartable, prueba de verdad, borra todo), pide
escribir el nombre de la edición, y al terminar muestra los diez pasos más el resumen
de qué se creó y qué se borró.

- [ ] **Step 4: Verificar todo junto**

Run: `pnpm --filter clickaton check-types && pnpm --filter clickaton lint && pnpm --filter clickaton selfcheck:edition-rehearsal && pnpm --filter clickaton exec tsx --test lib/edition-rehearsal/domain/*.test.ts lib/edition-rehearsal/ui/*.test.ts lib/edition-rehearsal/application/*.test.ts`
Expected: todo en verde.

- [ ] **Step 5: Commitear**

```bash
git add apps/clickaton
git commit -m "Ensayo completo sobre una copia descartable"
```

---

## Self-review del plan

**Cobertura del spec:**

| Sección del spec | Tarea |
|---|---|
| 4.2 El reloj | Task 1 |
| 5 El chequeo | Tasks 2, 3, 4 |
| 6.1 El reloj movible | Task 5, 7 |
| 6.2 Los diez pasos | Task 6 |
| 6.3 Modo en seco | Task 6, 7 |
| 4.3 La copia descartable | Tasks 8, 9 |
| 6.4 Modo completo | Task 10 |
| 7 Seguridad | Tasks 4, 9, 10 |
| 9 Pruebas | Tasks 2, 5, 6, 9 |

**Pendiente asumido:** el "bucket R2 alcanzable" del rubro Subida del spec se resuelve
en Task 3 como una comprobación de configuración presente, no como un ping a R2: hacer
red dentro de un chequeo que se quiere instantáneo lo volvería lento e intermitente. La
subida real a R2 sí se prueba en el paso 9 del ensayo completo (Task 10), que es donde
corresponde.
