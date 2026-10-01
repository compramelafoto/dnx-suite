# Vacantes de jurado y reparto — Plan de implementación (Parte A)

> **Para quien ejecute:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development`
> (recomendado) o `superpowers:executing-plans`, tarea por tarea. Los pasos usan
> casillas (`- [ ]`).

**Objetivo:** que el organizador declare cuántos jurados van a ser antes de saber quiénes
son, que el reparto de obras se calcule sobre esa declaración, y que quien ya está pueda
empezar a calificar sin esperar al que falta.

**Arquitectura:** el reparto no se guarda — se calcula con una rotación determinista sobre
**vacantes numeradas**, más una tabla de excepciones que sólo se escribe cuando alguien
redistribuye a mano. Se persisten dos datos: cuántas vacantes hay
(`FotorankJuryScoringSession.plannedSeats`) y qué vacante ocupa cada persona
(`FotorankJudgeAssignment.seatNumber`).

**Tecnologías:** TypeScript, Prisma, Next.js 16 App Router (Server Actions), `node:test`
con `tsx --test`. SQL aplicado a mano por MCP de Neon y registrado en `_prisma_migrations`.

**Spec:** `docs/superpowers/specs/2026-09-24-jurado-vacantes-y-portal-design.md`

## Restricciones globales

- Todo el texto visible va **en castellano rioplatense**, sin jerga técnica.
- Los comentarios de código explican **por qué**, no qué.
- Tests con `node:test` + `node:assert/strict`, registrados como script `test:*`.
- **Clickatón escribe en su propia base con su `prisma` de siempre.** Usar
  `getClickatonJuryPrisma` desde Clickatón fue un error ya corregido (PR 245).
- El chequeo de tipos de Clickatón necesita `NODE_OPTIONS="--max-old-space-size=8192"`.
- Línea de base del lint: Clickatón 196 avisos, FotoRank 71, **0 errores** en ambos.
- Nunca menos de 3 miradas por obra, salvo que haya menos de 3 jurados.

## Lo que ya existe y no hay que volver a escribir

| Pieza | Dónde | Estado |
|---|---|---|
| `repartoPorConsigna()`, `cargaDelReparto()`, `consignasDelJurado()`, `leTocaLaConsigna()` | `apps/fotorank/app/lib/fotorank/jury/repartoPorConsigna.ts` | 16 pruebas en verde |
| `minimoDeEvaluacionesPorObra()` | `apps/fotorank/app/lib/fotorank/jury/criteriosDeLaRubrica.ts` | 12 pruebas en verde |
| `FotorankJuryScoringSession.recommendedMaxEntriesPerJudge` | `packages/db/prisma/schema.prisma:14542` | Columna con default 500. **Nadie la lee** |
| `FotorankJuryScoringSession.assignmentSeed` | mismo modelo | Se escribe, **nadie la lee** |
| `assertJudgeContestAccess()` — compuerta única | `apps/fotorank/app/lib/fotorank/jury/jury-access.ts` | Devuelve `promptIds`, hoy derivado de `promptExternalId` |
| Pantalla de asignación | `apps/clickaton/app/admin/(panel)/ediciones/[editionId]/jurados/` | 130 + 234 líneas |
| Servicio de asignación | `apps/clickaton/lib/jury-assignment/` | `service.ts`, `actions.ts`, `assign-judge.ts` |

---

## Tarea 1: Cuántos jurados recomendar

**Archivos:**
- Crear: `apps/fotorank/app/lib/fotorank/jury/juradosRecomendados.ts`
- Crear: `apps/fotorank/app/lib/fotorank/jury/juradosRecomendados.test.ts`
- Modificar: `apps/fotorank/package.json` (agregar el script de prueba)

**Interfaces:**
- Consume: `minimoDeEvaluacionesPorObra(cantidadDeJurados: number): number` de
  `./criteriosDeLaRubrica`.
- Produce:
  ```ts
  export const TOPE_DE_FOTOS_POR_JURADO_POR_OMISION = 200;
  export type Recomendacion = { recomendados: number; motivo: string };
  export function juradosRecomendados(input: {
    obras: number;
    miradasPorObra: number;
    topeDeFotosPorJurado: number;
  }): Recomendacion | null;
  ```

- [ ] **Paso 1: escribir las pruebas que fallan**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  TOPE_DE_FOTOS_POR_JURADO_POR_OMISION,
  juradosRecomendados,
} from "./juradosRecomendados";

test("270 obras con 3 miradas y tope de 200 dan 5 jurados", () => {
  const r = juradosRecomendados({ obras: 270, miradasPorObra: 3, topeDeFotosPorJurado: 200 });
  assert.ok(r);
  assert.equal(r.recomendados, 5);
});

test("el motivo muestra la cuenta, no una frase vacía", () => {
  const r = juradosRecomendados({ obras: 270, miradasPorObra: 3, topeDeFotosPorJurado: 200 })!;
  assert.match(r.motivo, /270/);
  assert.match(r.motivo, /810/);
  assert.match(r.motivo, /200/);
});

/** El piso de 3 no se negocia: con menos no hay mediana ni dispersión. */
test("nunca recomienda menos de tres", () => {
  const r = juradosRecomendados({ obras: 12, miradasPorObra: 3, topeDeFotosPorJurado: 200 })!;
  assert.equal(r.recomendados, 3);
});

test("con muchas obras el número crece", () => {
  const r = juradosRecomendados({ obras: 9000, miradasPorObra: 3, topeDeFotosPorJurado: 200 })!;
  assert.equal(r.recomendados, 135);
});

test("sin obras no hay nada que recomendar", () => {
  assert.equal(juradosRecomendados({ obras: 0, miradasPorObra: 3, topeDeFotosPorJurado: 200 }), null);
});

test("un tope inválido cae en el de fábrica en vez de dividir por cero", () => {
  for (const topeDeFotosPorJurado of [0, -50, Number.NaN]) {
    const r = juradosRecomendados({ obras: 270, miradasPorObra: 3, topeDeFotosPorJurado })!;
    assert.equal(r.recomendados, 5, `tope ${topeDeFotosPorJurado}`);
  }
});

test("el tope de fábrica es 200", () => {
  assert.equal(TOPE_DE_FOTOS_POR_JURADO_POR_OMISION, 200);
});
```

- [ ] **Paso 2: correr y ver que falla**

Ejecutar desde `apps/fotorank`:
`pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/jury/juradosRecomendados.test.ts`
Esperado: FALLA con `Cannot find module './juradosRecomendados'`.

- [ ] **Paso 3: escribir la implementación mínima**

```ts
/**
 * Cuántos jurados conviene tener. **Recomienda, no bloquea.**
 *
 * El organizador conoce su concurso y puede tener razones para ir con menos
 * gente; lo que no puede es no haberse enterado. Cuando decide seguir igual,
 * la pantalla le pide una observación que queda en el historial.
 */
import { minimoDeEvaluacionesPorObra } from "./criteriosDeLaRubrica";

export const TOPE_DE_FOTOS_POR_JURADO_POR_OMISION = 200;

export type Recomendacion = { recomendados: number; motivo: string };

export function juradosRecomendados(input: {
  obras: number;
  miradasPorObra: number;
  topeDeFotosPorJurado: number;
}): Recomendacion | null {
  if (!Number.isFinite(input.obras) || input.obras < 1) return null;

  const tope =
    Number.isFinite(input.topeDeFotosPorJurado) && input.topeDeFotosPorJurado > 0
      ? input.topeDeFotosPorJurado
      : TOPE_DE_FOTOS_POR_JURADO_POR_OMISION;

  const miradas = Math.max(1, Math.floor(input.miradasPorObra));
  const evaluaciones = input.obras * miradas;
  const porCarga = Math.ceil(evaluaciones / tope);
  const piso = minimoDeEvaluacionesPorObra(Number.MAX_SAFE_INTEGER);
  const recomendados = Math.max(piso, porCarga);

  return {
    recomendados,
    motivo:
      `${input.obras} obras con ${miradas} miradas cada una son ${evaluaciones} ` +
      `evaluaciones; a ${tope} fotos por jurado hacen falta ${recomendados}.`,
  };
}
```

- [ ] **Paso 4: correr y ver que pasa**

Mismo comando del paso 2. Esperado: 7 pruebas en verde.

- [ ] **Paso 5: registrar el script y commitear**

En `apps/fotorank/package.json`, junto a `test:jury-reparto`:

```json
"test:jury-recomendados": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/jury/juradosRecomendados.test.ts",
```

```bash
git add apps/fotorank/app/lib/fotorank/jury/juradosRecomendados.ts apps/fotorank/app/lib/fotorank/jury/juradosRecomendados.test.ts apps/fotorank/package.json
git commit -m "El sistema dice cuantos jurados hacen falta para el volumen de obras"
```

---

## Tarea 2: El reparto sobre vacantes, con excepciones

**Archivos:**
- Modificar: `apps/fotorank/app/lib/fotorank/jury/repartoPorConsigna.ts`
- Modificar: `apps/fotorank/app/lib/fotorank/jury/repartoPorConsigna.test.ts`

**Interfaces:**
- Consume: `repartoPorConsigna()` ya existente, que reparte entre identificadores de
  jurado. Ahora los identificadores son **números de vacante como texto**: `"1"`, `"2"`…
- Produce:
  ```ts
  export type Excepcion = { seatNumber: number; promptExternalId: string };
  export function consignasDeLaVacante(input: {
    consignas: string[];
    vacantes: number;
    miradasPorObra: number;
    seatNumber: number;
    excepciones?: Excepcion[];
  }): Set<string>;
  ```

- [ ] **Paso 1: escribir las pruebas que fallan**

Agregar al final de `repartoPorConsigna.test.ts` (y sumar `consignasDeLaVacante` al import
de arriba del archivo):

```ts
const ONCE_IDS = ONCE;

test("la vacante 1 recibe su tanda de consignas", () => {
  const suyas = consignasDeLaVacante({
    consignas: ONCE_IDS,
    vacantes: 5,
    miradasPorObra: 3,
    seatNumber: 1,
  });
  assert.equal(suyas.size, 7);
  assert.ok(suyas.has("consigna-1"));
});

test("entre las cinco vacantes se cubren todas las consignas tres veces", () => {
  const cuenta = new Map<string, number>();
  for (let s = 1; s <= 5; s++) {
    for (const c of consignasDeLaVacante({
      consignas: ONCE_IDS, vacantes: 5, miradasPorObra: 3, seatNumber: s,
    })) {
      cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
    }
  }
  assert.equal(cuenta.size, 11);
  for (const [consigna, veces] of cuenta) {
    assert.equal(veces, 3, `${consigna} la miran ${veces} jurados`);
  }
});

/**
 * La excepción se escribe cuando el organizador redistribuye el lote de una
 * vacante que nunca se llenó. Suma, no reemplaza: la vacante original sigue
 * teniendo esa consigna, aunque no haya nadie sentado ahí.
 */
test("una excepción agrega una consigna a otra vacante", () => {
  const suyas = consignasDeLaVacante({
    consignas: ONCE_IDS,
    vacantes: 5,
    miradasPorObra: 3,
    seatNumber: 2,
    excepciones: [{ seatNumber: 2, promptExternalId: "consigna-9" }],
  });
  assert.ok(suyas.has("consigna-9"));
});

test("una excepción de otra vacante no se cuela", () => {
  const suyas = consignasDeLaVacante({
    consignas: ONCE_IDS,
    vacantes: 5,
    miradasPorObra: 3,
    seatNumber: 2,
    excepciones: [{ seatNumber: 4, promptExternalId: "consigna-9" }],
  });
  assert.equal(suyas.has("consigna-9"), false);
});

test("una vacante fuera de rango no recibe nada", () => {
  for (const seatNumber of [0, 6, -1]) {
    assert.equal(
      consignasDeLaVacante({ consignas: ONCE_IDS, vacantes: 5, miradasPorObra: 3, seatNumber }).size,
      0,
      `vacante ${seatNumber}`,
    );
  }
});
```

- [ ] **Paso 2: correr y ver que falla**

`pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/jury/repartoPorConsigna.test.ts`
Esperado: FALLA con `consignasDeLaVacante is not a function`.

- [ ] **Paso 3: escribir la implementación**

Agregar al final de `repartoPorConsigna.ts`:

```ts
export type Excepcion = { seatNumber: number; promptExternalId: string };

/**
 * Qué consignas le tocan a una vacante.
 *
 * El reparto no se guarda: se calcula acá cada vez, con la misma rotación
 * determinista. Guardarlo crearía un estado que algún día no coincide con el
 * cálculo. Lo único que se persiste son las excepciones, y sólo existen cuando
 * alguien redistribuyó a mano el lote de una vacante que quedó vacía.
 */
export function consignasDeLaVacante(input: {
  consignas: string[];
  vacantes: number;
  miradasPorObra: number;
  seatNumber: number;
  excepciones?: Excepcion[];
}): Set<string> {
  const suyas = new Set<string>();
  if (input.seatNumber < 1 || input.seatNumber > input.vacantes) return suyas;

  const numeros = Array.from({ length: input.vacantes }, (_, i) => String(i + 1));
  const pares = repartoPorConsigna({
    consignas: input.consignas,
    jurados: numeros,
    miradasPorObra: input.miradasPorObra,
  });

  for (const par of pares) {
    if (par.juradoId === String(input.seatNumber)) suyas.add(par.consignaId);
  }
  for (const e of input.excepciones ?? []) {
    if (e.seatNumber === input.seatNumber) suyas.add(e.promptExternalId);
  }
  return suyas;
}
```

- [ ] **Paso 4: correr y ver que pasa**

Mismo comando. Esperado: 21 pruebas en verde (16 anteriores + 5 nuevas).

- [ ] **Paso 5: commitear**

```bash
git add apps/fotorank/app/lib/fotorank/jury/repartoPorConsigna.ts apps/fotorank/app/lib/fotorank/jury/repartoPorConsigna.test.ts
git commit -m "El reparto se calcula sobre vacantes numeradas, no sobre personas"
```

---

## Tarea 3: Las columnas en la base

**Archivos:**
- Modificar: `packages/db/prisma/schema.prisma`
- Crear: `packages/db/prisma/migrations/20260924120000_jury_seats/migration.sql`

**Interfaces:**
- Produce: `FotorankJuryScoringSession.plannedSeats: Int?`,
  `FotorankJudgeAssignment.seatNumber: Int?`, y el modelo
  `FotorankJurySeatPromptOverride`.

- [ ] **Paso 1: escribir el SQL de la migración**

```sql
-- Cuantas vacantes de jurado abre esta sesion de puntuacion.
-- Nulo = todavia no se declaro: el reparto no se aplica y cada jurado ve todo.
ALTER TABLE "FotorankJuryScoringSession"
  ADD COLUMN IF NOT EXISTS "plannedSeats" INTEGER;

-- Que vacante ocupa esta persona. Nulo = asignacion sin reparto (como hasta ahora).
ALTER TABLE "FotorankJudgeAssignment"
  ADD COLUMN IF NOT EXISTS "seatNumber" INTEGER;

-- Excepciones al reparto: solo se escriben cuando alguien redistribuye a mano
-- el lote de una vacante que nunca se lleno.
CREATE TABLE IF NOT EXISTS "FotorankJurySeatPromptOverride" (
  "id" TEXT NOT NULL,
  "scoringSessionId" TEXT NOT NULL,
  "seatNumber" INTEGER NOT NULL,
  "promptExternalId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankJurySeatPromptOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankJurySeatPromptOverride_unico"
  ON "FotorankJurySeatPromptOverride" ("scoringSessionId", "seatNumber", "promptExternalId");

CREATE INDEX IF NOT EXISTS "FotorankJurySeatPromptOverride_sesion"
  ON "FotorankJurySeatPromptOverride" ("scoringSessionId");
```

- [ ] **Paso 2: reflejarlo en el schema de Prisma**

En `FotorankJuryScoringSession`, junto a `assignmentSeed`:

```prisma
  /// Cuántas vacantes de jurado abre esta sesión. Nulo = sin reparto.
  plannedSeats               Int?
  seatOverrides              FotorankJurySeatPromptOverride[]
```

En `FotorankJudgeAssignment`, junto a `promptExternalId`:

```prisma
  /// Qué vacante ocupa. Nulo = asignación sin reparto.
  seatNumber                 Int?
```

Y el modelo nuevo, después de `FotorankJuryScoringSession`:

```prisma
/// Excepción al reparto: sólo existe cuando alguien redistribuyó a mano.
model FotorankJurySeatPromptOverride {
  id               String   @id @default(cuid())
  scoringSessionId String
  seatNumber       Int
  promptExternalId String
  motivo           String
  createdByUserId  Int?
  createdAt        DateTime @default(now())

  scoringSession FotorankJuryScoringSession @relation(fields: [scoringSessionId], references: [id], onDelete: Cascade)

  @@unique([scoringSessionId, seatNumber, promptExternalId], map: "FotorankJurySeatPromptOverride_unico")
  @@index([scoringSessionId], map: "FotorankJurySeatPromptOverride_sesion")
}
```

- [ ] **Paso 3: regenerar el cliente y chequear tipos**

```bash
pnpm --filter @repo/db exec prisma generate
```

Después, desde `apps/clickaton`:
`NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p tsconfig.json`
Esperado: sin errores. **Si aparecen errores de tablas que sí existen, el cliente quedó
viejo: volver a correr `prisma generate`.**

- [ ] **Paso 4: aplicar el SQL en las bases**

Por MCP de Neon, con `branch_id` explícito, en **las cinco bases** donde vive el schema.
Después registrar la migración en `_prisma_migrations` de cada una, con el checksum de una
base sana — el procedimiento ya usado en migraciones anteriores de este repo.

Verificación, en cada base:

```sql
SELECT
 (SELECT count(*) FROM information_schema.columns
   WHERE table_name='FotorankJuryScoringSession' AND column_name='plannedSeats') AS col_sesion,
 (SELECT count(*) FROM information_schema.columns
   WHERE table_name='FotorankJudgeAssignment' AND column_name='seatNumber') AS col_asignacion,
 (SELECT count(*) FROM information_schema.tables
   WHERE table_name='FotorankJurySeatPromptOverride') AS tabla;
```

Esperado: `1 | 1 | 1` en cada base.

- [ ] **Paso 5: commitear**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260924120000_jury_seats/migration.sql
git commit -m "Las vacantes de jurado y sus excepciones, en la base"
```

---

## Tarea 4: Declarar las vacantes y sentar gente

**Archivos:**
- Crear: `apps/clickaton/lib/jury-assignment/vacantes.ts`
- Crear: `apps/clickaton/lib/jury-assignment/vacantes.test.ts`
- Modificar: `apps/clickaton/lib/jury-assignment/actions.ts`
- Modificar: `apps/clickaton/package.json`

**Interfaces:**
- Consume: `juradosRecomendados()`, `consignasDeLaVacante()`,
  `minimoDeEvaluacionesPorObra()`.
- Produce:
  ```ts
  export type Vacante = {
    seatNumber: number;
    judgeAccountId: string | null;
    nombre: string | null;
    consignas: string[];
  };
  export function armarVacantes(input: {
    plannedSeats: number;
    consignas: Array<{ id: string; sequence: number; titulo: string }>;
    miradasPorObra: number;
    ocupantes: Array<{ seatNumber: number | null; judgeAccountId: string; nombre: string | null }>;
    excepciones?: Array<{ seatNumber: number; promptExternalId: string }>;
  }): Vacante[];
  export function primeraVacanteLibre(vacantes: Vacante[]): number | null;
  export function sePuedeCambiarLaCantidad(input: {
    evaluacionesEnviadas: number;
  }): { ok: boolean; motivo?: string };
  ```

- [ ] **Paso 1: escribir las pruebas que fallan**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { armarVacantes, primeraVacanteLibre, sePuedeCambiarLaCantidad } from "./vacantes";

const CONSIGNAS = Array.from({ length: 11 }, (_, i) => ({
  id: `c${i + 1}`,
  sequence: i + 1,
  titulo: `Consigna ${i + 1}`,
}));

test("declarar cinco arma cinco vacantes numeradas", () => {
  const v = armarVacantes({
    plannedSeats: 5, consignas: CONSIGNAS, miradasPorObra: 3, ocupantes: [],
  });
  assert.equal(v.length, 5);
  assert.deepEqual(v.map((x) => x.seatNumber), [1, 2, 3, 4, 5]);
});

test("cada vacante trae sus consignas aunque esté vacía", () => {
  const v = armarVacantes({
    plannedSeats: 5, consignas: CONSIGNAS, miradasPorObra: 3, ocupantes: [],
  });
  assert.ok(v[0]!.consignas.length > 0, "la vacante 1 quedó sin lote");
  assert.equal(v[0]!.judgeAccountId, null);
});

test("quien está sentado aparece en su vacante", () => {
  const v = armarVacantes({
    plannedSeats: 5,
    consignas: CONSIGNAS,
    miradasPorObra: 3,
    ocupantes: [{ seatNumber: 2, judgeAccountId: "j-belen", nombre: "Belén" }],
  });
  assert.equal(v[1]!.judgeAccountId, "j-belen");
  assert.equal(v[1]!.nombre, "Belén");
  assert.equal(v[0]!.judgeAccountId, null);
});

/** Una asignación vieja, de antes del reparto, no puede desaparecer de la pantalla. */
test("un asignado sin vacante cae en la primera libre", () => {
  const v = armarVacantes({
    plannedSeats: 3,
    consignas: CONSIGNAS,
    miradasPorObra: 3,
    ocupantes: [{ seatNumber: null, judgeAccountId: "j-vieja", nombre: "Melisa" }],
  });
  assert.equal(v[0]!.judgeAccountId, "j-vieja");
});

test("la primera libre es la primera sin nadie", () => {
  const v = armarVacantes({
    plannedSeats: 3,
    consignas: CONSIGNAS,
    miradasPorObra: 3,
    ocupantes: [{ seatNumber: 1, judgeAccountId: "j-1", nombre: null }],
  });
  assert.equal(primeraVacanteLibre(v), 2);
});

test("sin vacantes libres devuelve null", () => {
  const v = armarVacantes({
    plannedSeats: 1,
    consignas: CONSIGNAS,
    miradasPorObra: 3,
    ocupantes: [{ seatNumber: 1, judgeAccountId: "j-1", nombre: null }],
  });
  assert.equal(primeraVacanteLibre(v), null);
});

test("declarar cero o menos no arma nada", () => {
  for (const plannedSeats of [0, -2]) {
    assert.deepEqual(
      armarVacantes({ plannedSeats, consignas: CONSIGNAS, miradasPorObra: 3, ocupantes: [] }),
      [],
    );
  }
});

/**
 * Cambiar la cantidad después de que alguien calificó mueve lotes: alguien
 * perdería obras que ya evaluó y otro recibiría obras que nunca vio.
 */
test("no se cambia la cantidad si ya hay evaluaciones enviadas", () => {
  const r = sePuedeCambiarLaCantidad({ evaluacionesEnviadas: 12 });
  assert.equal(r.ok, false);
  assert.match(r.motivo!, /calific/i);
});

test("sin evaluaciones enviadas se puede cambiar", () => {
  assert.deepEqual(sePuedeCambiarLaCantidad({ evaluacionesEnviadas: 0 }), { ok: true });
});
```

- [ ] **Paso 2: correr y ver que falla**

Desde `apps/clickaton`: `npx tsx --test lib/jury-assignment/vacantes.test.ts`
Esperado: FALLA con `Cannot find module './vacantes'`.

- [ ] **Paso 3: escribir la implementación**

```ts
/**
 * Las vacantes de jurado de una edición.
 *
 * Separar **cuántos** de **quiénes** es lo que deja que el jurado que ya está
 * empiece hoy: el reparto se calcula sobre vacantes numeradas, así que sumar
 * una persona más adelante no le mueve el lote a nadie.
 */
import { consignasDeLaVacante } from "./reparto";

export type Vacante = {
  seatNumber: number;
  judgeAccountId: string | null;
  nombre: string | null;
  consignas: string[];
};

export function armarVacantes(input: {
  plannedSeats: number;
  consignas: Array<{ id: string; sequence: number; titulo: string }>;
  miradasPorObra: number;
  ocupantes: Array<{ seatNumber: number | null; judgeAccountId: string; nombre: string | null }>;
  excepciones?: Array<{ seatNumber: number; promptExternalId: string }>;
}): Vacante[] {
  if (!Number.isFinite(input.plannedSeats) || input.plannedSeats < 1) return [];

  const ordenadas = [...input.consignas].sort((a, b) => a.sequence - b.sequence);
  const ids = ordenadas.map((c) => c.id);

  const vacantes: Vacante[] = [];
  for (let n = 1; n <= Math.floor(input.plannedSeats); n++) {
    vacantes.push({
      seatNumber: n,
      judgeAccountId: null,
      nombre: null,
      consignas: [
        ...consignasDeLaVacante({
          consignas: ids,
          vacantes: Math.floor(input.plannedSeats),
          miradasPorObra: input.miradasPorObra,
          seatNumber: n,
          excepciones: input.excepciones,
        }),
      ],
    });
  }

  // Primero los que ya tienen vacante; después, los de antes del reparto.
  for (const o of input.ocupantes) {
    if (o.seatNumber == null) continue;
    const v = vacantes.find((x) => x.seatNumber === o.seatNumber);
    if (v && !v.judgeAccountId) {
      v.judgeAccountId = o.judgeAccountId;
      v.nombre = o.nombre;
    }
  }
  for (const o of input.ocupantes) {
    if (o.seatNumber != null) continue;
    const libre = vacantes.find((x) => !x.judgeAccountId);
    if (libre) {
      libre.judgeAccountId = o.judgeAccountId;
      libre.nombre = o.nombre;
    }
  }

  return vacantes;
}

export function primeraVacanteLibre(vacantes: Vacante[]): number | null {
  const libre = vacantes.find((v) => !v.judgeAccountId);
  return libre ? libre.seatNumber : null;
}

export function sePuedeCambiarLaCantidad(input: {
  evaluacionesEnviadas: number;
}): { ok: boolean; motivo?: string } {
  if (input.evaluacionesEnviadas > 0) {
    return {
      ok: false,
      motivo:
        "Ya hay obras calificadas. Cambiar la cantidad de jurados ahora movería " +
        "el lote de cada uno: alguien perdería obras que ya evaluó y otro recibiría " +
        "obras que nunca vio.",
    };
  }
  return { ok: true };
}
```

**Por qué `./reparto` y no un import de FotoRank:** el repo tiene una regla explícita —
*"No importa apps/fotorank (evita Prisma y acoplamiento de build)"*, en
`apps/clickaton/data/public-marathons/fotorank-v1-types.ts`— y ninguna app importa de
otra. Cuando la misma lógica hace falta de los dos lados, el patrón del repo es
duplicarla con una nota de espejo, como ya se hizo en
`apps/clickaton/lib/jury-media/signed-link.test.ts`.

Así que antes de este paso, crear `apps/clickaton/lib/jury-assignment/reparto.ts` con el
cuerpo **idéntico** de `repartoPorConsigna()` y `consignasDeLaVacante()` de la Tarea 2, y
encabezarlo con:

```ts
/**
 * Espejo de apps/fotorank/app/lib/fotorank/jury/repartoPorConsigna.ts.
 *
 * Clickatón no importa de FotoRank a propósito —evita arrastrar Prisma y acoplar
 * los builds—, así que esta copia tiene que quedar idéntica a la original. Si
 * cambia una, cambia la otra: un reparto distinto de cada lado le mostraría al
 * jurado obras que el organizador no le asignó.
 */
```

Copiar también las 21 pruebas a `apps/clickaton/lib/jury-assignment/reparto.test.ts` y
registrarlas como `"test:reparto": "tsx --test lib/jury-assignment/reparto.test.ts"`. Son
las que avisan si las dos copias se separan.

- [ ] **Paso 4: correr y ver que pasa**

`npx tsx --test lib/jury-assignment/vacantes.test.ts`
Esperado: 9 pruebas en verde.

- [ ] **Paso 5: registrar el script y commitear**

En `apps/clickaton/package.json`:

```json
"test:vacantes": "tsx --test lib/jury-assignment/vacantes.test.ts",
```

```bash
git add apps/clickaton/lib/jury-assignment/vacantes.ts apps/clickaton/lib/jury-assignment/vacantes.test.ts apps/clickaton/package.json
git commit -m "Las vacantes se arman sin saber quien las va a ocupar"
```

---

## Tarea 5: La compuerta lee la vacante

**Archivos:**
- Modificar: `apps/fotorank/app/lib/fotorank/jury/jury-access.ts`
- Modificar: `apps/fotorank/app/lib/fotorank/jury/repartoPorConsigna.test.ts`

**Interfaces:**
- Consume: `consignasDeLaVacante()` de la Tarea 2, `assertJudgeContestAccess()` existente.
- Produce: `assertJudgeContestAccess()` sigue devolviendo `promptIds: Set<string> | null`,
  pero ahora derivado del `seatNumber` de la asignación y del `plannedSeats` de la sesión.

- [ ] **Paso 1: escribir la prueba de la regla pura que falta**

Agregar a `repartoPorConsigna.test.ts`:

```ts
test("sin vacante declarada el jurado sigue viendo todo", () => {
  const suyas = consignasDeLaVacante({
    consignas: ONCE_IDS, vacantes: 0, miradasPorObra: 3, seatNumber: 1,
  });
  assert.equal(suyas.size, 0, "sin vacantes no hay reparto que aplicar");
});
```

- [ ] **Paso 2: correr y ver que pasa o falla**

`pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/jury/repartoPorConsigna.test.ts`
Esperado: PASA con la implementación de la Tarea 2 (`seatNumber > vacantes` devuelve
vacío). Si falla, el guard de rango de la Tarea 2 está mal.

- [ ] **Paso 3: cambiar la compuerta**

En `jury-access.ts`, reemplazar el bloque que hoy calcula `promptIds` con
`consignasDelJurado(assignments)`:

```ts
  /*
   * Qué consignas le tocan. Salen de la vacante que ocupa, no de la lista de
   * asignaciones: el reparto se calcula sobre vacantes numeradas para que sumar
   * un jurado más adelante no le mueva el lote a nadie.
   *
   * `null` = todas, que es el caso cuando el organizador no declaró vacantes.
   */
  const sesion = await prisma.fotorankJuryScoringSession.findFirst({
    where: { contestId: input.contestId },
    orderBy: { createdAt: "desc" },
    select: { id: true, plannedSeats: true, minimumEvaluationsPerEntry: true },
  });

  const miVacante = assignments.find((a) => a.seatNumber != null)?.seatNumber ?? null;

  let promptIds: Set<string> | null = null;
  if (sesion?.plannedSeats && miVacante != null) {
    const consignas = await prisma.clickatonPrompt.findMany({
      where: { status: { in: ["RELEASED", "CLOSED"] } },
      orderBy: { sequence: "asc" },
      select: { id: true },
    });
    const excepciones = await prisma.fotorankJurySeatPromptOverride.findMany({
      where: { scoringSessionId: sesion.id },
      select: { seatNumber: true, promptExternalId: true },
    });
    promptIds = consignasDeLaVacante({
      consignas: consignas.map((c) => c.id),
      vacantes: sesion.plannedSeats,
      miradasPorObra: sesion.minimumEvaluationsPerEntry,
      seatNumber: miVacante,
      excepciones,
    });
  }
```

Cambiar el import: `consignasDelJurado` sale, entra `consignasDeLaVacante`.
`leTocaLaConsigna` se queda como está.

- [ ] **Paso 4: chequear tipos y correr las pruebas de jurado**

Desde `apps/fotorank`:

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p tsconfig.json
npm run test:jury:selfcheck
npm run test:jury:scoring
npm run test:jury-reparto
```

Esperado: sin errores de tipos y los tres en verde.

- [ ] **Paso 5: commitear**

```bash
git add apps/fotorank/app/lib/fotorank/jury/jury-access.ts apps/fotorank/app/lib/fotorank/jury/repartoPorConsigna.test.ts
git commit -m "La cola del jurado sale de su vacante, no de quienes esten asignados"
```

---

## Tarea 6: La pantalla del equipo de jurado

**Archivos:**
- Modificar: `apps/clickaton/app/admin/(panel)/ediciones/[editionId]/jurados/page.tsx`
- Crear: `apps/clickaton/app/admin/(panel)/ediciones/[editionId]/jurados/EquipoDeJurado.tsx`
- Modificar: `apps/clickaton/lib/jury-assignment/actions.ts`

**Interfaces:**
- Consume: `armarVacantes()`, `primeraVacanteLibre()`, `sePuedeCambiarLaCantidad()`,
  `juradosRecomendados()`.
- Produce: `declararVacantesAction(editionId, formData)` y
  `asignarAVacanteAction(editionId, formData)`, ambas server actions que devuelven
  `ResultadoDeLaPantalla` (el tipo que ya usan las acciones de ese archivo).

- [ ] **Paso 1: escribir la acción de declarar**

En `actions.ts`, con el mismo patrón que `asignarJuradoAction` (`requireClickatonAdmin()`
primero, `conexiones()` para la base):

```ts
export async function declararVacantesAction(
  editionId: string,
  formData: FormData,
): Promise<ResultadoDeLaPantalla> {
  await requireClickatonAdmin();
  const { maraton } = conexiones();

  const cuantos = Number(formData.get("cuantos") ?? 0);
  if (!Number.isFinite(cuantos) || cuantos < 1) {
    return { ok: false, mensaje: "Poné cuántos jurados van a ser." };
  }

  const db = maraton as unknown as {
    fotorankJuryScoringSession: {
      findFirst(args: unknown): Promise<{ id: string } | null>;
      update(args: unknown): Promise<unknown>;
    };
    fotorankJuryEvaluation: { count(args: unknown): Promise<number> };
  };

  const sesion = await db.fotorankJuryScoringSession.findFirst({
    where: { admissionBatch: { editionId } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!sesion) {
    return {
      ok: false,
      mensaje: "Todavía no hay una sesión de juzgamiento. Congelá el lote primero.",
    };
  }

  const enviadas = await db.fotorankJuryEvaluation.count({
    where: { scoringSessionId: sesion.id, status: { in: ["SUBMITTED", "LOCKED"] } },
  });
  const permiso = sePuedeCambiarLaCantidad({ evaluacionesEnviadas: enviadas });
  if (!permiso.ok) return { ok: false, mensaje: permiso.motivo! };

  await db.fotorankJuryScoringSession.update({
    where: { id: sesion.id },
    data: { plannedSeats: Math.floor(cuantos) },
  });
  refrescar(editionId);
  return { ok: true, mensaje: `Quedaron ${Math.floor(cuantos)} vacantes.` };
}
```

- [ ] **Paso 2: escribir la acción de sentar a alguien**

```ts
export async function asignarAVacanteAction(
  editionId: string,
  formData: FormData,
): Promise<ResultadoDeLaPantalla> {
  await requireClickatonAdmin();
  const seatNumber = Number(formData.get("seatNumber") ?? 0);
  if (!Number.isFinite(seatNumber) || seatNumber < 1) {
    return { ok: false, mensaje: "Falta indicar la vacante." };
  }
  // `asignarJuradoAction` ya valida la ficha, crea el workspace, la ficha espejo
  // y la asignación. Acá sólo se le agrega en qué vacante queda.
  formData.set("seatNumber", String(Math.floor(seatNumber)));
  return asignarJuradoAction(editionId, formData);
}
```

Y en `asignarJuradoAMaraton()` de `service.ts`, pasar `seatNumber` al `create` de la
asignación, leyéndolo del input (opcional, `number | null`).

- [ ] **Paso 3: escribir el componente de pantalla**

`EquipoDeJurado.tsx`, server component, con el mismo estilo que `PasosDelLote.tsx`
(tarjeta `Card variant="outlined"`, `ConfirmSubmitButton` para lo que cambia datos):

```tsx
/**
 * Cuántos jurados van a ser, y quién ocupa cada vacante.
 *
 * El reparto de obras se calcula sobre las vacantes, así que se puede declarar
 * "somos cinco" y empezar con dos: al tercero que llegue le espera su lote.
 */
export function EquipoDeJurado({
  editionId, vacantes, recomendacion, obras, miradasPorObra, sePuedeCambiar,
}: {
  editionId: string;
  vacantes: Vacante[];
  recomendacion: Recomendacion | null;
  obras: number;
  miradasPorObra: number;
  sePuedeCambiar: { ok: boolean; motivo?: string };
}) { /* … */ }
```

La tarjeta muestra, en este orden: el campo con la cantidad, la frase de la
recomendación tal cual viene en `motivo`, y la lista de vacantes con su ocupante y sus
consignas. Cuando `sePuedeCambiar.ok` es falso, el campo queda deshabilitado y debajo se
muestra `motivo`.

- [ ] **Paso 4: enganchar la pantalla**

En `page.tsx`, antes de la lista de jurados que ya existe: contar las obras admitidas de
la edición, leer la sesión (`plannedSeats`, `minimumEvaluationsPerEntry`,
`recommendedMaxEntriesPerJudge`), traer las consignas ordenadas por `sequence`, las
asignaciones con su `seatNumber`, y las excepciones. Armar las vacantes con
`armarVacantes()` y la recomendación con `juradosRecomendados()`.

- [ ] **Paso 5: verificar y commitear**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p tsconfig.json
npm run lint
```

Esperado: 0 errores de tipos; lint en 196 avisos, 0 errores.

```bash
git add "apps/clickaton/app/admin/(panel)/ediciones/[editionId]/jurados" apps/clickaton/lib/jury-assignment/actions.ts apps/clickaton/lib/jury-assignment/service.ts
git commit -m "Declarar cuantos jurados van a ser y sentar a cada uno en su vacante"
```

---

## Tarea 7: La vacante que nunca se llenó

**Archivos:**
- Modificar: `apps/clickaton/lib/jury-assignment/vacantes.ts`
- Modificar: `apps/clickaton/lib/jury-assignment/vacantes.test.ts`
- Modificar: `apps/clickaton/lib/jury-assignment/actions.ts`
- Modificar: `apps/clickaton/app/admin/(panel)/ediciones/[editionId]/jurados/EquipoDeJurado.tsx`

**Interfaces:**
- Produce:
  ```ts
  export function repartirLoteHuerfano(input: {
    vacantes: Vacante[];
    seatVacia: number;
  }): Array<{ seatNumber: number; promptExternalId: string }>;
  ```
  y `redistribuirVacanteAction(editionId, formData)`.

- [ ] **Paso 1: escribir las pruebas que fallan**

```ts
test("el lote de la vacante vacía se reparte entre las ocupadas", () => {
  const vacantes = armarVacantes({
    plannedSeats: 3,
    consignas: CONSIGNAS,
    miradasPorObra: 2,
    ocupantes: [
      { seatNumber: 1, judgeAccountId: "j1", nombre: "Uno" },
      { seatNumber: 2, judgeAccountId: "j2", nombre: "Dos" },
    ],
  });
  const nuevas = repartirLoteHuerfano({ vacantes, seatVacia: 3 });

  assert.ok(nuevas.length > 0, "no repartió nada");
  for (const n of nuevas) {
    assert.notEqual(n.seatNumber, 3, "se lo dio a la vacante vacía");
    assert.ok([1, 2].includes(n.seatNumber));
  }
});

test("no le da a un jurado una consigna que ya tenía", () => {
  const vacantes = armarVacantes({
    plannedSeats: 3,
    consignas: CONSIGNAS,
    miradasPorObra: 2,
    ocupantes: [
      { seatNumber: 1, judgeAccountId: "j1", nombre: "Uno" },
      { seatNumber: 2, judgeAccountId: "j2", nombre: "Dos" },
    ],
  });
  const nuevas = repartirLoteHuerfano({ vacantes, seatVacia: 3 });
  for (const n of nuevas) {
    const destino = vacantes.find((v) => v.seatNumber === n.seatNumber)!;
    assert.equal(destino.consignas.includes(n.promptExternalId), false, n.promptExternalId);
  }
});

test("si no hay nadie ocupando, no se reparte nada", () => {
  const vacantes = armarVacantes({
    plannedSeats: 3, consignas: CONSIGNAS, miradasPorObra: 2, ocupantes: [],
  });
  assert.deepEqual(repartirLoteHuerfano({ vacantes, seatVacia: 3 }), []);
});

test("una vacante ocupada no se reparte", () => {
  const vacantes = armarVacantes({
    plannedSeats: 3,
    consignas: CONSIGNAS,
    miradasPorObra: 2,
    ocupantes: [{ seatNumber: 3, judgeAccountId: "j3", nombre: "Tres" }],
  });
  assert.deepEqual(repartirLoteHuerfano({ vacantes, seatVacia: 3 }), []);
});
```

- [ ] **Paso 2: correr y ver que falla**

`npx tsx --test lib/jury-assignment/vacantes.test.ts`
Esperado: FALLA con `repartirLoteHuerfano is not a function`.

- [ ] **Paso 3: escribir la implementación**

```ts
/**
 * Reparte el lote de una vacante que nunca se llenó entre quienes sí están.
 *
 * Esto **sí** le agrega obras a gente que quizá ya terminó, y por eso no puede
 * ser automático: lo decide el organizador y queda registrado con su motivo.
 * Se reparte por turnos, y nunca se le da a alguien una consigna que ya tenía.
 */
export function repartirLoteHuerfano(input: {
  vacantes: Vacante[];
  seatVacia: number;
}): Array<{ seatNumber: number; promptExternalId: string }> {
  const vacia = input.vacantes.find((v) => v.seatNumber === input.seatVacia);
  if (!vacia || vacia.judgeAccountId) return [];

  const ocupadas = input.vacantes.filter((v) => v.judgeAccountId);
  if (ocupadas.length === 0) return [];

  const nuevas: Array<{ seatNumber: number; promptExternalId: string }> = [];
  let turno = 0;
  for (const consigna of vacia.consignas) {
    // Buscar el próximo que no la tenga, dando una vuelta completa.
    for (let i = 0; i < ocupadas.length; i++) {
      const destino = ocupadas[(turno + i) % ocupadas.length]!;
      if (!destino.consignas.includes(consigna)) {
        nuevas.push({ seatNumber: destino.seatNumber, promptExternalId: consigna });
        turno = (turno + i + 1) % ocupadas.length;
        break;
      }
    }
  }
  return nuevas;
}
```

- [ ] **Paso 4: correr y ver que pasa**

`npx tsx --test lib/jury-assignment/vacantes.test.ts`
Esperado: 13 pruebas en verde.

- [ ] **Paso 5: la acción y el botón**

En `actions.ts`, `redistribuirVacanteAction` exige un motivo escrito (como
`rejectSubmission` exige motivo público), calcula con `repartirLoteHuerfano()` y escribe
las filas en `FotorankJurySeatPromptOverride` con `createdByUserId`. En la pantalla, el
botón aparece **sólo** en las vacantes libres, con `ConfirmSubmitButton` y el texto:
*"¿Repartir las consignas de esta vacante entre los jurados que sí están? Les van a
aparecer obras nuevas."*

- [ ] **Paso 6: verificar y commitear**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p tsconfig.json
npm run lint
npm run test:vacantes
```

```bash
git add apps/clickaton/lib/jury-assignment apps/clickaton/app/admin
git commit -m "Repartir el lote de una vacante que nunca se lleno, con motivo"
```

---

## Dos cosas del spec que este plan no construye

**El aviso de "abriste más vacantes de las que prometen las bases" no se hace.** El spec
lo mencionaba cuando todavía se pensaba declarar un máximo; la decisión posterior fue
**no prometer un techo** —`minJudges` como piso, sin `maxJudges`— así que no hay nada que
superar. Construirlo sería avisar de un límite que nadie fijó.

**La frase de las bases es texto legal, no código.** *"Cada fotografía será calificada por
al menos tres integrantes del jurado"* hay que agregarla a las bases publicadas de
Clickatón, que hoy sólo dicen que *"los criterios y el proceso del jurado se publicarán
por edición"*. Va antes de abrir el juzgamiento de la 2ª edición y lo decide el
organizador, no este plan.

---

## Verificación final de la Parte A

- [ ] Los siete scripts de prueba en verde: `test:jury-recomendados`, `test:jury-reparto`,
      `test:jury-criterios`, `test:vacantes`, `test:reparto`, `test:jury:selfcheck`,
      `test:jury:scoring`.
- [ ] `tsc --noEmit` sin errores en FotoRank y en Clickatón.
- [ ] Lint en la línea de base: Clickatón 196 avisos, FotoRank 71, 0 errores.
- [ ] La migración aplicada y registrada en las cinco bases, con los tres controles en `1`.
- [ ] En producción: declarar 5 vacantes en la edición `cms78cthj0000xpc4841bihf4`, ver que
      Belén y Melisa quedan en las vacantes 1 y 2 con sus consignas, y que las otras tres
      muestran su lote esperando.

**Lo que esta parte no verifica:** que un jurado real entre y vea sólo sus consignas. Eso
necesita una sesión de jurado de verdad, que nunca se hizo, y es el primer paso de la
Parte B.
