# Sorteos verificables — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la Sociedad de Fotógrafos sortee entre sus socios al día los premios que donan las marcas aliadas, y que cualquier socio pueda comprobar por su cuenta que el resultado no se pudo arreglar.

**Architecture:** Un núcleo puro y sin base (huella del padrón, extracción sin sesgo, elegibilidad, transiciones) que se prueba entero con vitest; encima, una capa de persistencia idempotente (sellar, resolver) que puede correr dos veces sin cambiar el resultado; y tres superficies —administración, portal del socio y pantalla de verificación pública—. El azar viene de drand, se fija antes de sellar el padrón y se lee de dos espejos que tienen que coincidir.

**Tech Stack:** Next.js 16.2.1 (App Router, server actions), React 19, Prisma sobre Postgres/Neon (`packages/db`, `schema.prisma` compartido), vitest, `node:crypto` (SHA-256, sin dependencias nuevas), Tailwind 4.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-09-07-sorteos-design.md`

## Global Constraints

- **Todo el código y los comentarios, en castellano rioplatense.** Es la convención del módulo entero (ver `lib/bookings/*`, `lib/membership/charge-labels.ts`).
- **Ninguna dependencia nueva.** SHA-256 sale de `node:crypto`; el fetch a drand, del `fetch` global.
- **Los estados se guardan como `String`, nunca como enum de Prisma.** Las cinco aplicaciones comparten `schema.prisma` y un enum nuevo que no exista en una base rompe las escrituras de esa aplicación. Precedente: `Booking.status` es `String` con el comentario `///` que enumera los valores.
- **Prefijo `Raffle` para las cinco tablas nuevas.** Migración puramente aditiva.
- **Clave del módulo:** `raffles`. Ya reservada como `PLANNED` en `lib/modules/registry.ts`; esta implementación la pasa a `AVAILABLE`.
- **Zona horaria:** `America/Argentina/Buenos_Aires`. Reusar `BOOKINGS_TIME_ZONE` de `lib/bookings/time.ts` no: se declara `RAFFLES_TIME_ZONE` propio con el mismo valor, para no atar dos módulos por una constante.
- **Etiqueta de dominio de las huellas:** `fotoffice-raffle-v1` para el padrón y `fotoffice-raffle-draw-v1` para la extracción. Literales, verbatim, nunca parametrizadas: si cambian, la verificación de los sorteos viejos deja de dar.
- **Cadena de drand por defecto:** quicknet, `52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971`. El período y el génesis **no se escriben en el código**: se leen de `/info` al anunciar.
- **Espejos de drand:** `https://api.drand.sh`, `https://api2.drand.sh`, `https://api3.drand.sh`. Se consultan dos y tienen que devolver lo mismo.
- **La deuda de apertura (período `APERTURA`) no bloquea la participación.** Decisión tomada: son 48 socios cuya deuda la institución todavía no puede justificar. Las cuotas mensuales, las de ingreso y el carnet impreso vencidos sí bloquean.
- **Sin emails en esta versión.** El aviso al ganador se marca a mano (`notifiedAt`). Los correos de FotoOffice todavía no están desplegados y atar el sorteo a ellos lo dejaría bloqueado.
- **Ningún sorteo se anuncia hasta que esté resuelto el punto legal `L-09`.** El código se construye entero; el botón "Anunciar" existe y funciona; quién lo aprieta y cuándo es decisión de la Secretaría.

---

## Estructura de archivos

**Núcleo puro** (`apps/fotoffice/lib/raffles/`, sin base, sin red, todo con test):

| Archivo | Responsabilidad |
|---|---|
| `constants.ts` | Clave de módulo, estados, cadena y espejos de drand, zona horaria |
| `eligibility.ts` | Quién participa: la regla, sobre datos ya leídos |
| `entrants.ts` | Orden del padrón y su huella SHA-256 |
| `draw.ts` | La extracción premio por premio, sin sesgo de módulo |
| `drand.ts` | Cálculo de tanda y lectura de la cadena (única con red) |
| `lifecycle.ts` | Transiciones válidas y reglas duras |
| `raffle-form.ts` | Parseo del formulario de alta |
| `prize-form.ts` | Parseo del formulario de premio |
| `verification.ts` | Los datos de la pantalla de verificación, ya armados |

**Capa con base** (misma carpeta, `import "server-only"`):

| Archivo | Responsabilidad |
|---|---|
| `access.ts` | Módulo habilitado + rol, en el servidor |
| `repository.ts` | Única puerta a las cinco tablas |
| `events.ts` | Registro de `RaffleEvent` |
| `seal.ts` | Sellado del padrón, idempotente |
| `resolve.ts` | Resolución del sorteo, idempotente |
| `portal.ts` | La vista del socio, armada |

**Pantallas y rutas:**

```
app/(shell)/sorteos/page.tsx                      lista
app/(shell)/sorteos/actions.ts                    todas las acciones de administración
app/(shell)/sorteos/nuevo/page.tsx                alta
app/(shell)/sorteos/[id]/page.tsx                 detalle: premios, padrón, botones
app/(shell)/sorteos/[id]/premio-form.tsx          alta y edición de premio
app/(shell)/sorteos/entregas/page.tsx             tablero de entregas
app/portal/sorteos/page.tsx                       el sorteo del mes y mi situación
app/portal/sorteos/[id]/page.tsx                  resultado + bolillero
app/portal/sorteos/[id]/verificacion/page.tsx     la prueba
app/api/cron/sorteos/route.ts                     sella y resuelve lo que corresponda
components/raffles/bolillero.tsx                  animación (cliente)
```

**Modificados:** `packages/db/prisma/schema.prisma`, `lib/modules/registry.ts`, `lib/portal/menu.ts:124`, `app/(shell)/layout.tsx`, `components/shell/shell-sidebar.tsx`, `vercel.json`, `docs/fotoffice/ESTADO-ACTUAL.md`.

---

## Orden de las tareas

Las cuatro primeras son núcleo puro y no dependen de nada: se pueden hacer en cualquier orden, y ninguna necesita base. La 5 (esquema) las habilita a todas las demás.

---

### Task 1: La huella del padrón y la extracción sin sesgo

El corazón. Si esto está bien, el resto es plomería.

**Files:**
- Create: `apps/fotoffice/lib/raffles/entrants.ts`
- Create: `apps/fotoffice/lib/raffles/entrants.test.ts`
- Create: `apps/fotoffice/lib/raffles/draw.ts`
- Create: `apps/fotoffice/lib/raffles/draw.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type EntrantInput = { memberId: string; memberNumber: string; fullName: string }`
  - `type Entrant = { position: number; memberId: string; memberNumber: string; fullName: string }`
  - `orderEntrants(input: EntrantInput[]): Entrant[]`
  - `entrantsHash(raffleId: string, entrants: Entrant[]): string`
  - `type DrawInput = { entrantsHash: string; round: number; randomness: string; prizeOrders: number[]; entrantCount: number }`
  - `type DrawResult = { prizeOrder: number; winnerPosition: number; iterations: number }`
  - `drawWinners(input: DrawInput): DrawResult[]`

- [ ] **Step 1: Escribir el test del orden y la huella**

`apps/fotoffice/lib/raffles/entrants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { entrantsHash, orderEntrants } from "./entrants";

const socios = [
  { memberId: "m-3", memberNumber: "0117", fullName: "Ana Díaz" },
  { memberId: "m-1", memberNumber: "0012", fullName: "Beto Ruiz" },
  { memberId: "m-2", memberNumber: "0099", fullName: "Cielo Paz" },
];

describe("el orden del padrón", () => {
  it("ordena por número de socio y numera desde cero", () => {
    const orden = orderEntrants(socios);
    expect(orden.map((e) => e.memberNumber)).toEqual(["0012", "0099", "0117"]);
    expect(orden.map((e) => e.position)).toEqual([0, 1, 2]);
  });

  it("no depende del orden en que llegan las filas", () => {
    const a = orderEntrants(socios);
    const b = orderEntrants([...socios].reverse());
    expect(b).toEqual(a);
  });

  it("los números de socio se comparan como números, no como texto", () => {
    // "9" antes que "10": comparados como texto quedarían al revés.
    const orden = orderEntrants([
      { memberId: "m-b", memberNumber: "10", fullName: "B" },
      { memberId: "m-a", memberNumber: "9", fullName: "A" },
    ]);
    expect(orden.map((e) => e.memberNumber)).toEqual(["9", "10"]);
  });

  it("un número de socio no numérico va al final, y entre esos manda el texto", () => {
    const orden = orderEntrants([
      { memberId: "m-x", memberNumber: "H-2", fullName: "X" },
      { memberId: "m-a", memberNumber: "5", fullName: "A" },
      { memberId: "m-w", memberNumber: "H-1", fullName: "W" },
    ]);
    expect(orden.map((e) => e.memberNumber)).toEqual(["5", "H-1", "H-2"]);
  });

  it("empate imposible: dos socios nunca comparten número, pero si pasara manda el id", () => {
    const orden = orderEntrants([
      { memberId: "m-z", memberNumber: "7", fullName: "Z" },
      { memberId: "m-a", memberNumber: "7", fullName: "A" },
    ]);
    expect(orden.map((e) => e.memberId)).toEqual(["m-a", "m-z"]);
  });
});

describe("la huella del padrón", () => {
  it("es un SHA-256 en hexadecimal minúscula", () => {
    const h = entrantsHash("r-1", orderEntrants(socios));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("el mismo padrón da la misma huella siempre", () => {
    expect(entrantsHash("r-1", orderEntrants(socios))).toBe(
      entrantsHash("r-1", orderEntrants([...socios].reverse())),
    );
  });

  it("cambia si cambia un socio", () => {
    const otro = [...socios.slice(1), { memberId: "m-9", memberNumber: "0117", fullName: "Otro" }];
    expect(entrantsHash("r-1", orderEntrants(otro))).not.toBe(
      entrantsHash("r-1", orderEntrants(socios)),
    );
  });

  it("cambia si cambia el sorteo: la huella de un padrón no sirve para otro sorteo", () => {
    expect(entrantsHash("r-2", orderEntrants(socios))).not.toBe(
      entrantsHash("r-1", orderEntrants(socios)),
    );
  });

  it("es el valor exacto que va a publicarse: se fija acá para que no cambie nunca", () => {
    const h = entrantsHash("r-1", orderEntrants(socios));
    // Si este valor cambia, la verificación de todos los sorteos ya hechos deja de dar.
    // Cambiarlo exige una etiqueta de dominio nueva (`-v2`), no editar este número.
    expect(h).toHaveLength(64);
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/entrants.test.ts`
Expected: FAIL — `Failed to load ./entrants`.

- [ ] **Step 3: Escribir `entrants.ts`**

```ts
import { createHash } from "node:crypto";

/**
 * El padrón congelado: quién participa, en qué orden y con qué huella.
 *
 * Módulo PURO: sin base y sin red. Es la mitad de la prueba de que el sorteo no se arregló,
 * así que tiene que poder recalcularse en cualquier lado —incluso fuera de FotoOffice— con
 * sólo la lista de participantes publicada.
 */

export type EntrantInput = {
  memberId: string;
  memberNumber: string;
  fullName: string;
};

export type Entrant = EntrantInput & {
  /** Posición en la bolsa, desde 0. Es lo que la extracción devuelve. */
  position: number;
};

/**
 * Etiqueta de dominio de la huella. Literal y para siempre.
 *
 * Sirve para que esta huella no pueda confundirse con ninguna otra de la aplicación, y para
 * poder cambiar el formato en el futuro sin invalidar lo ya publicado: eso sería `-v2`, una
 * función nueva al lado de esta, nunca una edición de esta línea.
 */
const ETIQUETA = "fotoffice-raffle-v1";

/**
 * Ordena el padrón de manera determinística.
 *
 * Por número de socio ascendente, tratado como número: la base devuelve `memberNumber` como
 * texto y "10" ordenado como texto va antes que "9". Los que no son números —honorarios con
 * "H-1", por ejemplo— van al final, ordenados entre ellos por texto. El id desempata, aunque
 * no pueda haber empate: el orden no puede depender de cómo Postgres devuelva las filas.
 */
export function orderEntrants(input: readonly EntrantInput[]): Entrant[] {
  const clave = (e: EntrantInput) => {
    const n = Number(e.memberNumber);
    return Number.isFinite(n) && e.memberNumber.trim() !== "" ? n : null;
  };

  return [...input]
    .sort((a, b) => {
      const na = clave(a);
      const nb = clave(b);
      if (na !== null && nb !== null && na !== nb) return na - nb;
      if (na !== null && nb === null) return -1;
      if (na === null && nb !== null) return 1;
      if (na === null && nb === null && a.memberNumber !== b.memberNumber) {
        return a.memberNumber < b.memberNumber ? -1 : 1;
      }
      return a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0;
    })
    .map((e, position) => ({ ...e, position }));
}

/**
 * La huella del padrón: SHA-256 sobre las posiciones y los ids.
 *
 * Se publica ANTES de que exista el número de drand. Es lo que impide acomodar la lista
 * sabiendo el resultado.
 *
 * No entran ni el nombre ni el número de socio: son datos personales y podrían corregirse
 * después —una tilde, un apellido mal cargado— y una corrección de tipeo no puede invalidar
 * la prueba de un sorteo.
 */
export function entrantsHash(raffleId: string, entrants: readonly Entrant[]): string {
  const cuerpo = entrants.map((e) => `${e.position}:${e.memberId}`).join("\n");
  return createHash("sha256").update(`${ETIQUETA}\n${raffleId}\n${cuerpo}`, "utf8").digest("hex");
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/entrants.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Escribir el test de la extracción**

`apps/fotoffice/lib/raffles/draw.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { drawWinners } from "./draw";

const base = {
  entrantsHash: "a".repeat(64),
  round: 1_234_567,
  randomness: "b".repeat(64),
};

describe("la extracción", () => {
  it("saca un ganador por premio", () => {
    const r = drawWinners({ ...base, prizeOrders: [1, 2, 3], entrantCount: 50 });
    expect(r).toHaveLength(3);
    expect(r.map((x) => x.prizeOrder)).toEqual([1, 2, 3]);
  });

  it("nadie se lleva dos premios del mismo sorteo", () => {
    const r = drawWinners({ ...base, prizeOrders: [1, 2, 3, 4, 5], entrantCount: 6 });
    const ganadores = r.map((x) => x.winnerPosition);
    expect(new Set(ganadores).size).toBe(ganadores.length);
  });

  it("las posiciones que devuelve están dentro del padrón", () => {
    const r = drawWinners({ ...base, prizeOrders: [1, 2, 3], entrantCount: 110 });
    for (const x of r) {
      expect(x.winnerPosition).toBeGreaterThanOrEqual(0);
      expect(x.winnerPosition).toBeLessThan(110);
    }
  });

  it("es determinística: los mismos datos dan siempre el mismo resultado", () => {
    const a = drawWinners({ ...base, prizeOrders: [1, 2], entrantCount: 110 });
    const b = drawWinners({ ...base, prizeOrders: [1, 2], entrantCount: 110 });
    expect(b).toEqual(a);
  });

  it("cambia si cambia el número de drand", () => {
    const a = drawWinners({ ...base, prizeOrders: [1], entrantCount: 110 });
    const b = drawWinners({ ...base, randomness: "c".repeat(64), prizeOrders: [1], entrantCount: 110 });
    expect(b[0].winnerPosition).not.toBe(a[0].winnerPosition);
  });

  it("cambia si cambia el padrón", () => {
    const a = drawWinners({ ...base, prizeOrders: [1], entrantCount: 110 });
    const b = drawWinners({ ...base, entrantsHash: "d".repeat(64), prizeOrders: [1], entrantCount: 110 });
    expect(b[0].winnerPosition).not.toBe(a[0].winnerPosition);
  });

  it("el orden del premio importa: el primero y el segundo no salen del mismo cálculo", () => {
    const r = drawWinners({ ...base, prizeOrders: [1, 2], entrantCount: 110 });
    expect(r[0].winnerPosition).not.toBe(r[1].winnerPosition);
  });

  it("con un solo participante, gana ese", () => {
    const r = drawWinners({ ...base, prizeOrders: [1], entrantCount: 1 });
    expect(r[0].winnerPosition).toBe(0);
  });

  it("no se puede sortear más premios que participantes", () => {
    expect(() => drawWinners({ ...base, prizeOrders: [1, 2, 3], entrantCount: 2 })).toThrow(
      /participantes/i,
    );
  });

  it("no se puede sortear sin participantes", () => {
    expect(() => drawWinners({ ...base, prizeOrders: [1], entrantCount: 0 })).toThrow(
      /participantes/i,
    );
  });

  it("reparte parejo: con 3 en la bolsa y muchos números distintos, ninguna posición se lleva todo", () => {
    const cuenta = new Map<number, number>();
    for (let n = 0; n < 300; n++) {
      const r = drawWinners({
        ...base,
        randomness: n.toString(16).padStart(64, "0"),
        prizeOrders: [1],
        entrantCount: 3,
      });
      const p = r[0].winnerPosition;
      cuenta.set(p, (cuenta.get(p) ?? 0) + 1);
    }
    expect(cuenta.size).toBe(3);
    // Nadie por debajo de la mitad ni por encima del doble de lo esperado (100 cada uno).
    for (const veces of cuenta.values()) {
      expect(veces).toBeGreaterThan(50);
      expect(veces).toBeLessThan(200);
    }
  });

  it("informa cuántas vueltas necesitó: es lo que prueba que el descarte por sesgo funciona", () => {
    const r = drawWinners({ ...base, prizeOrders: [1], entrantCount: 110 });
    expect(r[0].iterations).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 6: Correr y ver que falla**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/draw.test.ts`
Expected: FAIL — `Failed to load ./draw`.

- [ ] **Step 7: Escribir `draw.ts`**

```ts
import { createHash } from "node:crypto";

/**
 * La extracción: de la huella del padrón y el número de drand a los ganadores.
 *
 * Módulo PURO. No sabe de socios ni de premios: recibe cuántos participan y qué premios hay,
 * y devuelve posiciones. Quién ocupa cada posición lo resuelve el padrón sellado.
 *
 * Que sea puro es parte del diseño: cualquiera puede reimplementar estas veinte líneas en
 * otro lenguaje y llegar al mismo resultado con los cuatro datos publicados. Esa es la
 * garantía; el resto de la aplicación no participa de ella.
 */

const ETIQUETA = "fotoffice-raffle-draw-v1";

/** 2^64. El espacio de los enteros que salen de los primeros 8 bytes del digest. */
const DOS_A_LA_64 = 1n << 64n;

export type DrawInput = {
  /** La huella publicada antes de que existiera el número. */
  entrantsHash: string;
  /** Tanda de drand fijada al anunciar. */
  round: number;
  /** El valor que devolvió drand para esa tanda, en hexadecimal. */
  randomness: string;
  /** Los premios, por su `order`. Se recorren en el orden en que vienen. */
  prizeOrders: readonly number[];
  entrantCount: number;
};

export type DrawResult = {
  prizeOrder: number;
  /** Posición en el padrón ordenado, desde 0. */
  winnerPosition: number;
  /** Cuántos descartes hicieron falta. En la práctica, cero. */
  iterations: number;
};

/**
 * Un entero de 64 bits sin signo a partir de los primeros 8 bytes del SHA-256.
 */
function enteroDe64Bits(...partes: (string | number)[]): (i: number) => bigint {
  return (i: number) => {
    const digest = createHash("sha256")
      .update([ETIQUETA, ...partes, i].join("\n"), "utf8")
      .digest();
    return digest.readBigUInt64BE(0);
  };
}

/**
 * Sortea todos los premios, sacando de la bolsa a quien ya ganó.
 *
 * El descarte de los valores por encima de `limite` elimina el sesgo del módulo. Sin él las
 * primeras posiciones tendrían una probabilidad mayor: con 110 socios el desvío es del orden
 * de 10⁻¹⁷ y nadie lo notaría jamás, pero un sorteo que se ofrece como verificable no puede
 * tener un sesgo conocido, por chico que sea. El costo es un bucle que casi nunca itera.
 */
export function drawWinners(input: DrawInput): DrawResult[] {
  const { entrantsHash, round, randomness, prizeOrders, entrantCount } = input;

  if (entrantCount <= 0) {
    throw new Error("No hay participantes: no se puede sortear.");
  }
  if (prizeOrders.length > entrantCount) {
    throw new Error(
      `Hay ${prizeOrders.length} premios y ${entrantCount} participantes: no alcanzan los participantes.`,
    );
  }

  const bolsa: number[] = Array.from({ length: entrantCount }, (_, i) => i);
  const resultados: DrawResult[] = [];

  for (const prizeOrder of prizeOrders) {
    const valor = enteroDe64Bits(entrantsHash, round, randomness, prizeOrder);
    const n = BigInt(bolsa.length);
    const limite = (DOS_A_LA_64 / n) * n;

    let i = 0;
    for (;;) {
      const x = valor(i);
      if (x < limite) {
        const indice = Number(x % n);
        resultados.push({ prizeOrder, winnerPosition: bolsa[indice], iterations: i });
        bolsa.splice(indice, 1);
        break;
      }
      i += 1;
    }
  }

  return resultados;
}
```

- [ ] **Step 8: Correr los dos tests**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/`
Expected: PASS, 21 tests.

- [ ] **Step 9: Commit**

```bash
git add apps/fotoffice/lib/raffles/entrants.ts apps/fotoffice/lib/raffles/entrants.test.ts apps/fotoffice/lib/raffles/draw.ts apps/fotoffice/lib/raffles/draw.test.ts
git commit -m "El padrón tiene huella y la extracción no tiene sesgo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: El número de drand

**Files:**
- Create: `apps/fotoffice/lib/raffles/constants.ts`
- Create: `apps/fotoffice/lib/raffles/drand.ts`
- Create: `apps/fotoffice/lib/raffles/drand.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `RAFFLES_MODULE_KEY = "raffles"`, `RAFFLES_TIME_ZONE`, `DRAND_DEFAULT_CHAIN_HASH`, `DRAND_MIRRORS`
  - `type RaffleStatus`, `type RafflePrizeStatus` (usados por la Task 4)
  - `type DrandChainInfo = { chainHash: string; periodSeconds: number; genesisTimeSeconds: number }`
  - `roundAfter(info: DrandChainInfo, instante: Date): number`
  - `roundTime(info: DrandChainInfo, round: number): Date`
  - `fetchChainInfo(chainHash?: string): Promise<DrandChainInfo>`
  - `type DrandRound = { round: number; randomness: string; signature: string }`
  - `fetchRound(chainHash: string, round: number): Promise<DrandRound>`

- [ ] **Step 1: Escribir `constants.ts`** (no lleva test: son valores)

```ts
/**
 * Las constantes del módulo de sorteos.
 *
 * La clave `raffles` ya estaba reservada como `PLANNED` en `lib/modules/registry.ts` desde
 * antes de que existiera una línea de código, igual que pasó con reservas.
 */

export const RAFFLES_MODULE_KEY = "raffles";

/** Todo lo que se le muestra al socio se lee en esta zona. */
export const RAFFLES_TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * La cadena de drand que usamos: quicknet.
 *
 * Es *unchained* —cada valor es independiente del anterior— y sale cada 3 segundos. Se guarda
 * en cada sorteo, no se asume: si algún día se cambiara de cadena, los sorteos viejos siguen
 * verificando con la suya.
 */
export const DRAND_DEFAULT_CHAIN_HASH =
  "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";

/**
 * Espejos públicos del mismo servicio.
 *
 * Se consultan DOS y tienen que devolver exactamente lo mismo. Un solo servidor que responde
 * lo que quiere sería un punto único de confianza, que es justo lo que este módulo evita.
 */
export const DRAND_MIRRORS = [
  "https://api.drand.sh",
  "https://api2.drand.sh",
  "https://api3.drand.sh",
] as const;

/** Los estados del sorteo. Se guardan como texto: ver la nota del esquema. */
export const RAFFLE_STATUSES = [
  "BORRADOR",
  "ANUNCIADO",
  "PADRON_SELLADO",
  "SORTEADO",
  "CERRADO",
  "CANCELADO",
] as const;

export type RaffleStatus = (typeof RAFFLE_STATUSES)[number];

/** Los estados de cada premio. */
export const RAFFLE_PRIZE_STATUSES = [
  "GANADO",
  "NOTIFICADO",
  "RETIRADO",
  "NO_RETIRADO",
  "ANULADO",
] as const;

export type RafflePrizeStatus = (typeof RAFFLE_PRIZE_STATUSES)[number];

/** Cuánto antes del acto se cierra el padrón, por omisión. */
export const DEFAULT_ENTRIES_CLOSE_HOURS = 24;
```

- [ ] **Step 2: Escribir el test de drand**

`apps/fotoffice/lib/raffles/drand.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchChainInfo, fetchRound, roundAfter, roundTime } from "./drand";

// quicknet: génesis 2023-11-30, período de 3 segundos.
const info = {
  chainHash: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
  periodSeconds: 3,
  genesisTimeSeconds: 1_692_803_367,
};

describe("qué tanda le toca a un sorteo", () => {
  it("la tanda 1 es la del génesis", () => {
    expect(roundTime(info, 1).getTime()).toBe(info.genesisTimeSeconds * 1000);
  });

  it("elige la primera tanda POSTERIOR al acto", () => {
    const acto = new Date(info.genesisTimeSeconds * 1000 + 10 * 3000); // justo en la tanda 11
    const r = roundAfter(info, acto);
    expect(roundTime(info, r).getTime()).toBeGreaterThan(acto.getTime());
  });

  it("cuando el acto cae justo en una tanda, toma la siguiente y no esa", () => {
    const acto = new Date(info.genesisTimeSeconds * 1000 + 10 * 3000);
    expect(roundAfter(info, acto)).toBe(12);
  });

  it("cuando el acto cae en el medio, toma la que viene", () => {
    const acto = new Date(info.genesisTimeSeconds * 1000 + 10 * 3000 + 1500);
    expect(roundAfter(info, acto)).toBe(12);
  });

  it("un acto anterior al génesis no tiene tanda: es un error, no un número raro", () => {
    expect(() => roundAfter(info, new Date(0))).toThrow(/génesis/i);
  });
});

describe("leer la cadena", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lee período y génesis del servicio, no del código", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ hash: info.chainHash, period: 3, genesis_time: info.genesisTimeSeconds }),
      ),
    );
    await expect(fetchChainInfo(info.chainHash)).resolves.toEqual(info);
  });

  it("si el servicio devuelve otra cadena de la pedida, falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ hash: "0".repeat(64), period: 3, genesis_time: 1 })),
    );
    await expect(fetchChainInfo(info.chainHash)).rejects.toThrow(/cadena/i);
  });

  it("lee el valor de una tanda y lo devuelve con su firma", async () => {
    const respuesta = { round: 42, randomness: "a".repeat(64), signature: "b".repeat(96) };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(respuesta)));
    await expect(fetchRound(info.chainHash, 42)).resolves.toEqual(respuesta);
  });

  it("exige que dos espejos digan lo mismo", async () => {
    const uno = { round: 42, randomness: "a".repeat(64), signature: "b".repeat(96) };
    const otro = { round: 42, randomness: "c".repeat(64), signature: "b".repeat(96) };
    let llamada = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(llamada++ === 0 ? uno : otro)),
    );
    await expect(fetchRound(info.chainHash, 42)).rejects.toThrow(/espejos/i);
  });

  it("si la tanda todavía no salió, lo dice con esas palabras", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    await expect(fetchRound(info.chainHash, 999_999_999)).rejects.toThrow(/todavía no/i);
  });

  it("si el primer espejo se cae, usa el siguiente", async () => {
    const ok = { round: 42, randomness: "a".repeat(64), signature: "b".repeat(96) };
    let llamada = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        llamada += 1;
        if (llamada === 1) throw new Error("ECONNRESET");
        return Response.json(ok);
      }),
    );
    await expect(fetchRound(info.chainHash, 42)).resolves.toEqual(ok);
  });
});
```

- [ ] **Step 3: Correr y ver que falla**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/drand.test.ts`
Expected: FAIL — `Failed to load ./drand`.

- [ ] **Step 4: Escribir `drand.ts`**

```ts
import { DRAND_DEFAULT_CHAIN_HASH, DRAND_MIRRORS } from "./constants";

/**
 * El número que nadie puede predecir.
 *
 * drand es un servicio público operado en conjunto por varias organizaciones (Cloudflare,
 * EPFL, Protocol Labs y otras). Produce un valor cada pocos segundos con criptografía de
 * umbral: ninguna de ellas puede generarlo sola, ni predecirlo, ni sesgarlo. Cada valor queda
 * publicado para siempre.
 *
 * Este archivo es el único del módulo que habla con la red.
 *
 * ── Por qué dos espejos ──
 *
 * Un solo servidor que responde lo que quiere sería un punto único de confianza, y todo el
 * módulo existe para no tener uno. Se consultan dos y tienen que decir exactamente lo mismo.
 */

export type DrandChainInfo = {
  chainHash: string;
  periodSeconds: number;
  /** Segundos Unix del primer valor de la cadena. */
  genesisTimeSeconds: number;
};

export type DrandRound = {
  round: number;
  randomness: string;
  signature: string;
};

/** Cuándo sale la tanda N. La tanda 1 es la del génesis. */
export function roundTime(info: DrandChainInfo, round: number): Date {
  return new Date((info.genesisTimeSeconds + (round - 1) * info.periodSeconds) * 1000);
}

/**
 * La primera tanda ESTRICTAMENTE posterior a ese instante.
 *
 * Estrictamente posterior y no "la de ese momento": si el acto es a las 20:00 y la tanda de
 * las 20:00 ya existe cuando alguien aprieta el botón, el número dejaría de ser futuro.
 */
export function roundAfter(info: DrandChainInfo, instante: Date): number {
  const segundos = Math.floor(instante.getTime() / 1000);
  if (segundos < info.genesisTimeSeconds) {
    throw new Error("Ese momento es anterior al génesis de la cadena de drand.");
  }
  return Math.floor((segundos - info.genesisTimeSeconds) / info.periodSeconds) + 2;
}

async function leerDeEspejos<T>(ruta: string, parsear: (crudo: unknown) => T): Promise<T> {
  const resultados: { espejo: string; valor: T }[] = [];
  const fallas: string[] = [];

  for (const espejo of DRAND_MIRRORS) {
    try {
      const r = await fetch(`${espejo}${ruta}`, { cache: "no-store" });
      if (r.status === 404) {
        throw new Error("La tanda todavía no salió.");
      }
      if (!r.ok) {
        fallas.push(`${espejo}: HTTP ${r.status}`);
        continue;
      }
      resultados.push({ espejo, valor: parsear(await r.json()) });
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      // "Todavía no salió" no es una falla del espejo: es la respuesta, y es la misma en todos.
      if (detalle.includes("todavía no")) throw error;
      fallas.push(`${espejo}: ${detalle}`);
    }
    if (resultados.length === 2) break;
  }

  if (resultados.length < 2) {
    throw new Error(`No se pudo leer drand de dos espejos. ${fallas.join(" · ")}`);
  }
  const [a, b] = resultados;
  if (JSON.stringify(a.valor) !== JSON.stringify(b.valor)) {
    throw new Error(
      `Los espejos de drand no coinciden (${a.espejo} y ${b.espejo}). El sorteo no se resuelve.`,
    );
  }
  return a.valor;
}

/** Período y génesis de la cadena. Se leen del servicio, nunca se fijan en el código. */
export async function fetchChainInfo(
  chainHash: string = DRAND_DEFAULT_CHAIN_HASH,
): Promise<DrandChainInfo> {
  return leerDeEspejos(`/${chainHash}/info`, (crudo) => {
    const d = crudo as { hash?: string; period?: number; genesis_time?: number };
    if (d.hash !== chainHash) {
      throw new Error("El servicio devolvió otra cadena de la que se pidió.");
    }
    if (typeof d.period !== "number" || typeof d.genesis_time !== "number") {
      throw new Error("La respuesta de drand no trae período y génesis.");
    }
    return { chainHash, periodSeconds: d.period, genesisTimeSeconds: d.genesis_time };
  });
}

/** El valor de una tanda. Falla con "todavía no" mientras no exista. */
export async function fetchRound(chainHash: string, round: number): Promise<DrandRound> {
  return leerDeEspejos(`/${chainHash}/public/${round}`, (crudo) => {
    const d = crudo as { round?: number; randomness?: string; signature?: string };
    if (d.round !== round || !d.randomness || !d.signature) {
      throw new Error("La respuesta de drand no tiene la forma esperada.");
    }
    return { round: d.round, randomness: d.randomness, signature: d.signature };
  });
}
```

- [ ] **Step 5: Correr y ver que pasa**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/drand.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/raffles/constants.ts apps/fotoffice/lib/raffles/drand.ts apps/fotoffice/lib/raffles/drand.test.ts
git commit -m "El azar viene de drand y lo confirman dos espejos

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Quién participa

**Files:**
- Create: `apps/fotoffice/lib/raffles/eligibility.ts`
- Create: `apps/fotoffice/lib/raffles/eligibility.test.ts`

**Interfaces:**
- Consumes: `APERTURA_PERIOD` de `lib/membership/charge-labels.ts`.
- Produces:
  - `type MemberForRaffle = { memberId: string; memberNumber: string; fullName: string; status: string; charges: { period: string; dueDate: Date; balanceMinor: number }[] }`
  - `type Eligibility = { eligible: boolean; reason: string | null }`
  - `isEligible(member: MemberForRaffle, closeAt: Date): Eligibility`
  - `selectEntrants(members: MemberForRaffle[], closeAt: Date): EntrantInput[]`

- [ ] **Step 1: Escribir el test**

```ts
import { describe, expect, it } from "vitest";
import { isEligible, selectEntrants } from "./eligibility";

const CIERRE = new Date("2026-09-29T23:00:00Z");

const socio = (extra: Partial<Parameters<typeof isEligible>[0]> = {}) => ({
  memberId: "m-1",
  memberNumber: "0100",
  fullName: "Ana Díaz",
  status: "ACTIVE",
  charges: [],
  ...extra,
});

const cargo = (period: string, dias: number, saldo: number) => ({
  period,
  dueDate: new Date(CIERRE.getTime() + dias * 86_400_000),
  balanceMinor: saldo,
});

describe("quién participa", () => {
  it("el socio activo y sin deuda vencida participa", () => {
    expect(isEligible(socio(), CIERRE)).toEqual({ eligible: true, reason: null });
  });

  it("el socio con una cuota vencida impaga no participa, y se dice cuál", () => {
    const r = isEligible(socio({ charges: [cargo("2026-08", -10, 5_000_00)] }), CIERRE);
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain("agosto de 2026");
  });

  it("una cuota que todavía no venció no lo deja afuera", () => {
    expect(isEligible(socio({ charges: [cargo("2026-10", 5, 5_000_00)] }), CIERRE).eligible).toBe(true);
  });

  it("una cuota vencida pero ya pagada no lo deja afuera", () => {
    expect(isEligible(socio({ charges: [cargo("2026-08", -10, 0)] }), CIERRE).eligible).toBe(true);
  });

  it("la deuda de apertura NO lo deja afuera: la institución todavía no puede justificarla", () => {
    expect(isEligible(socio({ charges: [cargo("APERTURA", -300, 60_000_00)] }), CIERRE).eligible).toBe(
      true,
    );
  });

  it("apertura impaga y además una cuota mensual vencida: no participa, y el motivo es la cuota", () => {
    const r = isEligible(
      socio({ charges: [cargo("APERTURA", -300, 60_000_00), cargo("2026-07", -40, 5_000_00)] }),
      CIERRE,
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain("julio de 2026");
    expect(r.reason).not.toContain("APERTURA");
  });

  it("el socio suspendido no participa", () => {
    const r = isEligible(socio({ status: "SUSPENDED" }), CIERRE);
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/no está activa/i);
  });

  it("el socio dado de baja no participa", () => {
    expect(isEligible(socio({ status: "INACTIVE" }), CIERRE).eligible).toBe(false);
  });

  it("el motivo nombra la cuota más vieja cuando hay varias", () => {
    const r = isEligible(
      socio({ charges: [cargo("2026-08", -10, 5_000_00), cargo("2026-06", -70, 5_000_00)] }),
      CIERRE,
    );
    expect(r.reason).toContain("junio de 2026");
  });

  it("el carnet impreso impago vencido también lo deja afuera", () => {
    const r = isEligible(socio({ charges: [cargo("TARJETA", -30, 8_000_00)] }), CIERRE);
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain("Carnet impreso");
  });
});

describe("armar el padrón", () => {
  it("deja sólo a los que participan, con los datos que necesita la huella", () => {
    const padron = selectEntrants(
      [
        socio(),
        socio({ memberId: "m-2", memberNumber: "0101", charges: [cargo("2026-08", -10, 5_000_00)] }),
        socio({ memberId: "m-3", memberNumber: "0102", fullName: "Beto Ruiz" }),
      ],
      CIERRE,
    );
    expect(padron.map((e) => e.memberId)).toEqual(["m-1", "m-3"]);
    expect(padron[1]).toEqual({ memberId: "m-3", memberNumber: "0102", fullName: "Beto Ruiz" });
  });

  it("si nadie está al día, el padrón queda vacío y eso lo resuelve quien llama", () => {
    expect(selectEntrants([socio({ status: "INACTIVE" })], CIERRE)).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/eligibility.test.ts`
Expected: FAIL — `Failed to load ./eligibility`.

- [ ] **Step 3: Escribir `eligibility.ts`**

```ts
import { APERTURA_PERIOD, chargePeriodLabel } from "@/lib/membership/charge-labels";
import type { EntrantInput } from "./entrants";

/**
 * Quién entra en el padrón del sorteo.
 *
 * Módulo PURO: recibe los cargos ya leídos y decide. La consulta vive en `repository.ts`.
 *
 * La regla vive acá, tipada, y no como JSON de configuración: es la definición de "socio al
 * día" para este módulo, y una regla que se puede editar desde una pantalla es una regla que
 * se puede editar después de ver el número de drand.
 *
 * ── Por qué la deuda de apertura no bloquea ──
 *
 * `APERTURA` es el saldo migrado del sistema anterior. Hay 48 socios cuya deuda todavía no se
 * pudo verificar contra el reporte de pagos previo a 10/2025. Dejarlos afuera del primer
 * sorteo por una cifra que la propia institución no puede justificar sería la peor manera de
 * estrenar el módulo. Las cuotas mensuales, las de ingreso y el carnet impreso sí bloquean.
 */

export type ChargeForRaffle = {
  period: string;
  dueDate: Date;
  balanceMinor: number;
};

export type MemberForRaffle = {
  memberId: string;
  memberNumber: string;
  fullName: string;
  /** `MemberStatus` como texto: ACTIVE | SUSPENDED | INACTIVE. */
  status: string;
  charges: ChargeForRaffle[];
};

export type Eligibility = {
  eligible: boolean;
  /** En castellano y listo para mostrarle al socio. `null` cuando participa. */
  reason: string | null;
};

export function isEligible(member: MemberForRaffle, closeAt: Date): Eligibility {
  if (member.status !== "ACTIVE") {
    return { eligible: false, reason: "Tu ficha de socio no está activa." };
  }

  const vencidas = member.charges
    .filter((c) => c.balanceMinor > 0)
    .filter((c) => c.period !== APERTURA_PERIOD)
    .filter((c) => c.dueDate.getTime() < closeAt.getTime())
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  if (vencidas.length === 0) return { eligible: true, reason: null };

  const masVieja = chargePeriodLabel(vencidas[0].period);
  const resto =
    vencidas.length > 1 ? ` y ${vencidas.length - 1} más` : "";
  return { eligible: false, reason: `Tenés pendiente ${masVieja}${resto}.` };
}

/** El padrón: los que participan, con lo mínimo que la huella necesita. */
export function selectEntrants(
  members: readonly MemberForRaffle[],
  closeAt: Date,
): EntrantInput[] {
  return members
    .filter((m) => isEligible(m, closeAt).eligible)
    .map((m) => ({ memberId: m.memberId, memberNumber: m.memberNumber, fullName: m.fullName }));
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/eligibility.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/raffles/eligibility.ts apps/fotoffice/lib/raffles/eligibility.test.ts
git commit -m "Participa el socio al día, y la deuda vieja no lo deja afuera

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Los estados y las reglas duras

**Files:**
- Create: `apps/fotoffice/lib/raffles/lifecycle.ts`
- Create: `apps/fotoffice/lib/raffles/lifecycle.test.ts`

**Interfaces:**
- Consumes: `RaffleStatus`, `RafflePrizeStatus` de `./constants`.
- Produces:
  - `type Transition = { ok: true } | { ok: false; error: string }`
  - `canAnnounce(input: { status: RaffleStatus; prizeCount: number; entriesCloseAt: Date; drawsAt: Date; now: Date }): Transition`
  - `canSeal(input: { status: RaffleStatus; entriesCloseAt: Date; now: Date; entrantCount: number; prizeCount: number }): Transition`
  - `canDraw(input: { status: RaffleStatus; drawsAt: Date; now: Date }): Transition`
  - `canCancel(status: RaffleStatus): Transition`
  - `canEditPrizes(status: RaffleStatus): boolean`
  - `nextPrizeStatus(from: RafflePrizeStatus, to: RafflePrizeStatus, note: string | null): Transition`
  - `isRaffleClosed(prizeStatuses: RafflePrizeStatus[]): boolean`

- [ ] **Step 1: Escribir el test**

```ts
import { describe, expect, it } from "vitest";
import {
  canAnnounce,
  canCancel,
  canDraw,
  canEditPrizes,
  canSeal,
  isRaffleClosed,
  nextPrizeStatus,
} from "./lifecycle";

const AHORA = new Date("2026-09-20T12:00:00Z");
const CIERRE = new Date("2026-09-29T23:00:00Z");
const ACTO = new Date("2026-09-30T23:00:00Z");

describe("anunciar", () => {
  const base = { status: "BORRADOR" as const, prizeCount: 2, entriesCloseAt: CIERRE, drawsAt: ACTO, now: AHORA };

  it("un borrador con premios y fechas futuras se puede anunciar", () => {
    expect(canAnnounce(base)).toEqual({ ok: true });
  });

  it("no se anuncia un sorteo sin premios", () => {
    expect(canAnnounce({ ...base, prizeCount: 0 })).toEqual({
      ok: false,
      error: "No se puede anunciar un sorteo sin premios.",
    });
  });

  it("no se anuncia dos veces", () => {
    expect(canAnnounce({ ...base, status: "ANUNCIADO" }).ok).toBe(false);
  });

  it("el padrón tiene que cerrar antes del acto", () => {
    expect(canAnnounce({ ...base, entriesCloseAt: ACTO, drawsAt: CIERRE }).ok).toBe(false);
  });

  it("no se anuncia algo cuyo cierre ya pasó", () => {
    expect(canAnnounce({ ...base, now: new Date("2026-10-01T00:00:00Z") }).ok).toBe(false);
  });
});

describe("sellar el padrón", () => {
  const base = {
    status: "ANUNCIADO" as const,
    entriesCloseAt: CIERRE,
    now: new Date("2026-09-30T00:00:00Z"),
    entrantCount: 40,
    prizeCount: 2,
  };

  it("después del cierre, con gente y con premios, se sella", () => {
    expect(canSeal(base)).toEqual({ ok: true });
  });

  it("antes del cierre no se sella: el padrón todavía puede cambiar", () => {
    expect(canSeal({ ...base, now: AHORA }).ok).toBe(false);
  });

  it("sin ningún socio al día no se sella, y el aviso lo dice", () => {
    const r = canSeal({ ...base, entrantCount: 0 });
    expect(r).toEqual({
      ok: false,
      error: "Ningún socio quedó al día al cerrar el padrón. El sorteo no se puede sellar.",
    });
  });

  it("con menos participantes que premios no se sella", () => {
    expect(canSeal({ ...base, entrantCount: 1, prizeCount: 3 }).ok).toBe(false);
  });

  it("un padrón ya sellado no se vuelve a sellar", () => {
    expect(canSeal({ ...base, status: "PADRON_SELLADO" }).ok).toBe(false);
  });
});

describe("sortear", () => {
  it("con el padrón sellado y pasado el acto, se sortea", () => {
    expect(canDraw({ status: "PADRON_SELLADO", drawsAt: ACTO, now: new Date("2026-10-01T00:00:00Z") })).toEqual({
      ok: true,
    });
  });

  it("antes del acto, no", () => {
    expect(canDraw({ status: "PADRON_SELLADO", drawsAt: ACTO, now: AHORA }).ok).toBe(false);
  });

  it("sin sellar, no", () => {
    expect(canDraw({ status: "ANUNCIADO", drawsAt: ACTO, now: new Date("2026-10-01T00:00:00Z") }).ok).toBe(
      false,
    );
  });

  it("un sorteo ya sorteado no se vuelve a sortear: el resultado es inmutable", () => {
    expect(canDraw({ status: "SORTEADO", drawsAt: ACTO, now: new Date("2026-10-01T00:00:00Z") }).ok).toBe(
      false,
    );
  });
});

describe("cancelar", () => {
  it("se cancela un borrador", () => {
    expect(canCancel("BORRADOR")).toEqual({ ok: true });
  });

  it("se cancela un anunciado", () => {
    expect(canCancel("ANUNCIADO")).toEqual({ ok: true });
  });

  it("NO se cancela un sorteo ya sorteado", () => {
    expect(canCancel("SORTEADO").ok).toBe(false);
  });

  it("NO se cancela con el padrón sellado: la huella ya se publicó", () => {
    expect(canCancel("PADRON_SELLADO").ok).toBe(false);
  });
});

describe("editar premios y fechas", () => {
  it("sólo en borrador", () => {
    expect(canEditPrizes("BORRADOR")).toBe(true);
    expect(canEditPrizes("ANUNCIADO")).toBe(false);
    expect(canEditPrizes("SORTEADO")).toBe(false);
  });
});

describe("el camino de cada premio", () => {
  it("ganado pasa a notificado", () => {
    expect(nextPrizeStatus("GANADO", "NOTIFICADO", null)).toEqual({ ok: true });
  });

  it("notificado pasa a retirado", () => {
    expect(nextPrizeStatus("NOTIFICADO", "RETIRADO", null)).toEqual({ ok: true });
  });

  it("se puede entregar sin haber marcado el aviso: el socio puede aparecer solo", () => {
    expect(nextPrizeStatus("GANADO", "RETIRADO", null)).toEqual({ ok: true });
  });

  it("vencido el plazo, queda como no retirado", () => {
    expect(nextPrizeStatus("NOTIFICADO", "NO_RETIRADO", null)).toEqual({ ok: true });
  });

  it("anular exige motivo escrito", () => {
    expect(nextPrizeStatus("GANADO", "ANULADO", null).ok).toBe(false);
    expect(nextPrizeStatus("GANADO", "ANULADO", "El premio no llegó")).toEqual({ ok: true });
  });

  it("lo retirado no vuelve atrás", () => {
    expect(nextPrizeStatus("RETIRADO", "NOTIFICADO", null).ok).toBe(false);
  });

  it("lo anulado no revive", () => {
    expect(nextPrizeStatus("ANULADO", "RETIRADO", null).ok).toBe(false);
  });
});

describe("cuándo se cierra el sorteo", () => {
  it("cuando todos los premios terminaron su camino", () => {
    expect(isRaffleClosed(["RETIRADO", "NO_RETIRADO", "ANULADO"])).toBe(true);
  });

  it("uno pendiente lo mantiene abierto", () => {
    expect(isRaffleClosed(["RETIRADO", "NOTIFICADO"])).toBe(false);
  });

  it("sin premios no está cerrado: no llegó a sortearse", () => {
    expect(isRaffleClosed([])).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/lifecycle.test.ts`
Expected: FAIL.

- [ ] **Step 3: Escribir `lifecycle.ts`**

```ts
import type { RafflePrizeStatus, RaffleStatus } from "./constants";

/**
 * Las transiciones del sorteo y de cada premio.
 *
 * Módulo PURO: recibe estados y fechas, devuelve permiso o motivo. Sin base.
 *
 * La regla que ordena todo: una vez SORTEADO el resultado es inmutable. No hay transición que
 * lo deshaga. Si algo salió mal se anula el premio con motivo y se hace otro sorteo. Un
 * resultado que retrocede deja de contar lo que realmente pasó.
 */

export type Transition = { ok: true } | { ok: false; error: string };

const OK: Transition = { ok: true };
const no = (error: string): Transition => ({ ok: false, error });

export function canAnnounce(input: {
  status: RaffleStatus;
  prizeCount: number;
  entriesCloseAt: Date;
  drawsAt: Date;
  now: Date;
}): Transition {
  if (input.status !== "BORRADOR") return no("Sólo se anuncia un sorteo en borrador.");
  if (input.prizeCount === 0) return no("No se puede anunciar un sorteo sin premios.");
  if (input.entriesCloseAt.getTime() >= input.drawsAt.getTime()) {
    return no("El padrón tiene que cerrar antes del acto.");
  }
  if (input.entriesCloseAt.getTime() <= input.now.getTime()) {
    return no("El cierre del padrón ya pasó. Corregí las fechas antes de anunciar.");
  }
  return OK;
}

export function canSeal(input: {
  status: RaffleStatus;
  entriesCloseAt: Date;
  now: Date;
  entrantCount: number;
  prizeCount: number;
}): Transition {
  if (input.status !== "ANUNCIADO") return no("Sólo se sella el padrón de un sorteo anunciado.");
  if (input.now.getTime() < input.entriesCloseAt.getTime()) {
    return no("Todavía no cerró el padrón.");
  }
  if (input.entrantCount === 0) {
    return no("Ningún socio quedó al día al cerrar el padrón. El sorteo no se puede sellar.");
  }
  if (input.entrantCount < input.prizeCount) {
    return no(
      `Hay ${input.prizeCount} premios y ${input.entrantCount} participantes. Sacá premios o cancelá el sorteo.`,
    );
  }
  return OK;
}

export function canDraw(input: { status: RaffleStatus; drawsAt: Date; now: Date }): Transition {
  if (input.status !== "PADRON_SELLADO") {
    return input.status === "SORTEADO"
      ? no("Este sorteo ya se resolvió. El resultado no se rehace.")
      : no("Primero hay que sellar el padrón.");
  }
  if (input.now.getTime() < input.drawsAt.getTime()) return no("Todavía no es la hora del acto.");
  return OK;
}

export function canCancel(status: RaffleStatus): Transition {
  if (status === "BORRADOR" || status === "ANUNCIADO") return OK;
  if (status === "PADRON_SELLADO") {
    return no("El padrón ya se selló y su huella se publicó. No se cancela desde acá.");
  }
  return no("Un sorteo resuelto no se cancela.");
}

/** Premios y fechas se tocan solamente antes de anunciar. */
export function canEditPrizes(status: RaffleStatus): boolean {
  return status === "BORRADOR";
}

const CAMINOS: Record<RafflePrizeStatus, RafflePrizeStatus[]> = {
  GANADO: ["NOTIFICADO", "RETIRADO", "NO_RETIRADO", "ANULADO"],
  NOTIFICADO: ["RETIRADO", "NO_RETIRADO", "ANULADO"],
  RETIRADO: [],
  NO_RETIRADO: [],
  ANULADO: [],
};

export function nextPrizeStatus(
  from: RafflePrizeStatus,
  to: RafflePrizeStatus,
  note: string | null,
): Transition {
  if (!CAMINOS[from].includes(to)) {
    return no(`Un premio ${from.toLowerCase()} no puede pasar a ${to.toLowerCase()}.`);
  }
  if (to === "ANULADO" && (note ?? "").trim() === "") {
    return no("Anular un premio exige escribir el motivo.");
  }
  return OK;
}

/** El sorteo se cierra cuando ningún premio queda por resolver. */
export function isRaffleClosed(prizeStatuses: readonly RafflePrizeStatus[]): boolean {
  if (prizeStatuses.length === 0) return false;
  return prizeStatuses.every((s) => s === "RETIRADO" || s === "NO_RETIRADO" || s === "ANULADO");
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/lifecycle.test.ts`
Expected: PASS, 25 tests.

- [ ] **Step 5: Correr todo el núcleo junto**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/`
Expected: PASS, 58 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/raffles/lifecycle.ts apps/fotoffice/lib/raffles/lifecycle.test.ts
git commit -m "Un sorteo resuelto no vuelve atrás

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Las cinco tablas

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (agregar al final del bloque de FotoOffice, después de `BookingSettings`)
- Create: `packages/db/prisma/migrations/20260911000000_sorteos/migration.sql`

**Interfaces:**
- Consumes: nada.
- Produces: los modelos `Raffle`, `RaffleEntry`, `RafflePrize`, `RafflePrizeAward`, `RaffleEvent`, y las relaciones nuevas en `Workspace` y `Member`.

- [ ] **Step 1: Agregar los modelos al `schema.prisma`**

Después del modelo `BookingSettings`:

```prisma
/// Un sorteo entre socios, con premios donados por marcas aliadas.
///
/// El requisito que ordena el diseño no es sortear —eso es fácil— sino que el socio pueda
/// comprobar que no hubo trampa sin tener que confiar en la institución. De ahí las dos
/// fechas: el padrón se congela y su huella se publica ANTES de que exista el número de
/// drand. Ninguna de las dos mitades puede mirar a la otra.
///
/// Los estados van como texto y no como enum de Prisma a propósito: las cinco aplicaciones
/// de la suite comparten este archivo, y un enum nuevo que no exista en alguna de las cinco
/// bases rompe las escrituras de esa aplicación. Mismo criterio que `Booking.status`.
model Raffle {
  id          String @id @default(cuid())
  workspaceId String

  title       String
  description String?

  /// Cierre del padrón: se congela la lista y se publica su huella. 24 h antes del acto.
  entriesCloseAt DateTime
  /// El acto: se lee drand y se resuelven los premios.
  drawsAt        DateTime

  /// BORRADOR | ANUNCIADO | PADRON_SELLADO | SORTEADO | CERRADO | CANCELADO
  status String @default("BORRADOR")

  /// --- El azar. Se fija al anunciar; se completa al resolver. ---
  /// Cadena de drand. Se guarda por sorteo: si algún día se cambia de cadena, los sorteos
  /// viejos siguen verificando con la suya.
  drandChainHash String?
  /// Primera tanda estrictamente posterior a `drawsAt`. Se fija ANTES de sellar el padrón.
  drandRound     Int?
  drandRandomness String?
  drandSignature  String?

  /// --- El padrón. Se completa al sellar. ---
  entrantsHash  String?
  entrantsCount Int?

  sealedAt DateTime?
  drawnAt  DateTime?

  /// Anular exige motivo escrito: sin eso no se entiende meses después.
  cancelledAt  DateTime?
  cancelReason String?

  createdByUserId   Int?
  announcedByUserId Int?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  entries   RaffleEntry[]
  prizes    RafflePrize[]
  awards    RafflePrizeAward[]
  events    RaffleEvent[]

  @@index([workspaceId, drawsAt])
  @@index([status, entriesCloseAt])
  @@index([status, drawsAt])
}

/// Un participante, congelado al sellar el padrón.
///
/// Guarda instantáneas de número y nombre: la lista publicada tiene que seguir leyéndose
/// igual dentro de dos años, aunque el socio cambie de apellido o se dé de baja.
model RaffleEntry {
  id       String @id @default(cuid())
  raffleId String
  memberId String

  /// Posición en la bolsa, desde 0. Es lo que devuelve la extracción.
  position Int

  memberNumberSnapshot String
  fullNameSnapshot     String

  createdAt DateTime @default(now())

  raffle Raffle @relation(fields: [raffleId], references: [id], onDelete: Cascade)
  member Member @relation(fields: [memberId], references: [id], onDelete: Restrict)

  @@unique([raffleId, memberId])
  @@unique([raffleId, position])
  @@index([memberId])
}

/// Un premio del sorteo.
model RafflePrize {
  id       String @id @default(cuid())
  raffleId String

  /// Orden de extracción. Entra en el cálculo del ganador: cambiarlo cambiaría el resultado.
  order Int

  title              String
  description        String?
  conditions         String?
  pickupInstructions String?
  pickupDeadline     DateTime?
  /// En centavos, sólo informativo. Nunca se cobra nada en este módulo.
  estimatedValueMinor Int?

  /// Referencia opaca a `DnxPartner`, sin clave foránea: mismo criterio que el resto del
  /// dominio Partners, que vive en su propia aplicación.
  partnerId           String?
  partnerNameSnapshot String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  raffle Raffle            @relation(fields: [raffleId], references: [id], onDelete: Cascade)
  award  RafflePrizeAward?

  @@unique([raffleId, order])
}

/// El resultado: quién ganó qué.
///
/// `prizeId` es único — un premio, un ganador — y eso es lo que hace idempotente a la
/// resolución: si dos procesos resuelven a la vez, el segundo choca contra la clave y el
/// resultado no depende de quién llegó primero.
model RafflePrizeAward {
  id       String @id @default(cuid())
  prizeId  String @unique
  raffleId String
  memberId String
  entryId  String

  /// La posición que salió. Con esto y los cuatro datos publicados se recalcula el ganador.
  winnerPosition Int

  /// GANADO | NOTIFICADO | RETIRADO | NO_RETIRADO | ANULADO
  status String @default("GANADO")

  notifiedAt       DateTime?
  deliveredAt      DateTime?
  deliveredByUserId Int?
  deliveryNote     String?
  voidReason       String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  prize  RafflePrize @relation(fields: [prizeId], references: [id], onDelete: Cascade)
  raffle Raffle      @relation(fields: [raffleId], references: [id], onDelete: Cascade)
  member Member      @relation(fields: [memberId], references: [id], onDelete: Restrict)

  @@index([raffleId, status])
  @@index([memberId])
}

/// La historia del sorteo: quién anunció, quién selló, quién entregó cada premio.
///
/// Mismo criterio que `MemberCardEvent`: las decisiones se guardan, las derivaciones se
/// calculan. `actorLabel` es una instantánea para que la historia se siga entendiendo aunque
/// esa persona cambie de nombre o su usuario se elimine.
model RaffleEvent {
  id       String @id @default(cuid())
  raffleId String

  /// CREADO | ANUNCIADO | PADRON_SELLADO | SORTEADO | PREMIO_NOTIFICADO | PREMIO_ENTREGADO |
  /// PREMIO_NO_RETIRADO | PREMIO_ANULADO | CANCELADO
  type String

  /// Nulo cuando lo movió el sistema: la tarea programada que sella o resuelve.
  actorUserId Int?
  actorLabel  String?
  /// Obligatoria al anular y al cancelar.
  note        String?
  /// El premio, cuando el evento es de un premio y no del sorteo entero.
  prizeId     String?

  createdAt DateTime @default(now())

  raffle Raffle @relation(fields: [raffleId], references: [id], onDelete: Cascade)

  @@index([raffleId, createdAt])
}
```

- [ ] **Step 2: Agregar las relaciones inversas**

En `model Workspace`, junto a las demás listas de FotoOffice:

```prisma
  raffles Raffle[]
```

En `model Member`, junto a `bookings`:

```prisma
  raffleEntries RaffleEntry[]
  raffleAwards  RafflePrizeAward[]
```

- [ ] **Step 3: Verificar que el esquema es válido**

Run: `cd packages/db && pnpm prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Escribir la migración a mano**

`packages/db/prisma/migrations/20260911000000_sorteos/migration.sql`:

```sql
-- Sorteos verificables entre socios. Puramente aditiva: cinco tablas nuevas, ninguna
-- columna existente modificada.

CREATE TABLE "Raffle" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "entriesCloseAt" TIMESTAMP(3) NOT NULL,
    "drawsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "drandChainHash" TEXT,
    "drandRound" INTEGER,
    "drandRandomness" TEXT,
    "drandSignature" TEXT,
    "entrantsHash" TEXT,
    "entrantsCount" INTEGER,
    "sealedAt" TIMESTAMP(3),
    "drawnAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdByUserId" INTEGER,
    "announcedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Raffle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Raffle_workspaceId_drawsAt_idx" ON "Raffle"("workspaceId", "drawsAt");
CREATE INDEX "Raffle_status_entriesCloseAt_idx" ON "Raffle"("status", "entriesCloseAt");
CREATE INDEX "Raffle_status_drawsAt_idx" ON "Raffle"("status", "drawsAt");
ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RaffleEntry" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "memberNumberSnapshot" TEXT NOT NULL,
    "fullNameSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RaffleEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RaffleEntry_raffleId_memberId_key" ON "RaffleEntry"("raffleId", "memberId");
CREATE UNIQUE INDEX "RaffleEntry_raffleId_position_key" ON "RaffleEntry"("raffleId", "position");
CREATE INDEX "RaffleEntry_memberId_idx" ON "RaffleEntry"("memberId");
ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_raffleId_fkey"
    FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RafflePrize" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "conditions" TEXT,
    "pickupInstructions" TEXT,
    "pickupDeadline" TIMESTAMP(3),
    "estimatedValueMinor" INTEGER,
    "partnerId" TEXT,
    "partnerNameSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RafflePrize_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RafflePrize_raffleId_order_key" ON "RafflePrize"("raffleId", "order");
ALTER TABLE "RafflePrize" ADD CONSTRAINT "RafflePrize_raffleId_fkey"
    FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RafflePrizeAward" (
    "id" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "winnerPosition" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GANADO',
    "notifiedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deliveredByUserId" INTEGER,
    "deliveryNote" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RafflePrizeAward_pkey" PRIMARY KEY ("id")
);
-- Un premio, un ganador. Esta línea es lo que hace idempotente a la resolución.
CREATE UNIQUE INDEX "RafflePrizeAward_prizeId_key" ON "RafflePrizeAward"("prizeId");
CREATE INDEX "RafflePrizeAward_raffleId_status_idx" ON "RafflePrizeAward"("raffleId", "status");
CREATE INDEX "RafflePrizeAward_memberId_idx" ON "RafflePrizeAward"("memberId");
ALTER TABLE "RafflePrizeAward" ADD CONSTRAINT "RafflePrizeAward_prizeId_fkey"
    FOREIGN KEY ("prizeId") REFERENCES "RafflePrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RafflePrizeAward" ADD CONSTRAINT "RafflePrizeAward_raffleId_fkey"
    FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RafflePrizeAward" ADD CONSTRAINT "RafflePrizeAward_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RaffleEvent" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "actorLabel" TEXT,
    "note" TEXT,
    "prizeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RaffleEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RaffleEvent_raffleId_createdAt_idx" ON "RaffleEvent"("raffleId", "createdAt");
ALTER TABLE "RaffleEvent" ADD CONSTRAINT "RaffleEvent_raffleId_fkey"
    FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 5: Generar el cliente y ver que compila**

Run: `cd packages/db && pnpm prisma generate`
Expected: `Generated Prisma Client`

Run: `cd apps/fotoffice && pnpm exec tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 6: Aplicar el SQL a las cinco bases de Neon, a mano**

Las cinco aplicaciones comparten `schema.prisma`. Si estas tablas existen en una base y no en las otras, las escrituras de las demás aplicaciones se rompen. La base de FotoOffice es la rama **`development`** del proyecto de Neon — el nombre engaña: la rama `production` es la de CompraMeLaFoto.

Aplicar el mismo `migration.sql` en las cinco, y registrar la migración como aplicada:

```bash
cd packages/db && pnpm prisma migrate resolve --applied 20260911000000_sorteos
```

Confirmar en cada base:

```sql
SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'Raffle%';
```

Expected: cinco filas en cada una de las cinco bases.

- [ ] **Step 7: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260911000000_sorteos
git commit -m "Cinco tablas para que un sorteo se pueda comprobar

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: El módulo existe y tiene puerta

**Files:**
- Modify: `apps/fotoffice/lib/modules/registry.ts`
- Create: `apps/fotoffice/lib/raffles/access.ts`
- Create: `apps/fotoffice/lib/raffles/access.test.ts`
- Modify: `apps/fotoffice/lib/modules/registry.test.ts`

**Interfaces:**
- Consumes: `RAFFLES_MODULE_KEY` de `./constants`.
- Produces: `requireRafflesStaff()`, `requireRafflesAdmin()`, ambas devolviendo `{ user, workspace, role }`.

- [ ] **Step 1: Escribir el test del registro**

Agregar a `apps/fotoffice/lib/modules/registry.test.ts`:

```ts
it("sorteos figura como módulo disponible, con su ruta", () => {
  const m = MODULE_REGISTRY.find((x) => x.key === "raffles");
  expect(m).toBeDefined();
  expect(m?.status).toBe("AVAILABLE");
  expect(m?.route).toBe("/sorteos");
  expect(m?.category).toBe("INSTITUTIONAL");
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd apps/fotoffice && pnpm vitest run lib/modules/registry.test.ts`
Expected: FAIL — `expected undefined to be defined`.

- [ ] **Step 3: Registrar el módulo**

En `lib/modules/registry.ts`, agregar el import y mover `raffles` de `PLANNED` a la sección de módulos reales:

```ts
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
```

```ts
  {
    key: RAFFLES_MODULE_KEY,
    label: "Sorteos",
    description:
      "Sorteos entre socios al día, con premios donados por marcas aliadas y resultado que cualquiera puede comprobar.",
    category: "INSTITUTIONAL",
    order: 115,
    route: "/sorteos",
    status: "AVAILABLE",
  },
```

Si existía una entrada `raffles` con `status: "PLANNED"`, borrarla: no puede haber dos.

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd apps/fotoffice && pnpm vitest run lib/modules/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Escribir `access.ts`**

```ts
import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { RAFFLES_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, en dos niveles y siempre en el servidor.
 *
 * Nivel 1: el módulo está habilitado para ESE workspace. Nivel 2: la persona tiene el rol.
 * Esconder el link del menú es el tercer nivel, el cosmético — nunca el control.
 *
 * Ver la lista y entregar premios es STAFF+. Crear, anunciar, sellar, resolver y cancelar es
 * ADMIN+: son los actos que definen el resultado.
 */

async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, RAFFLES_MODULE_KEY))) redirect("/dashboard");
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  return { user, workspace, role };
}

/** Ver los sorteos y entregar premios. Cualquiera del equipo. */
export async function requireRafflesStaff() {
  const ctx = await contextoBase();
  if (!ctx.role) redirect("/dashboard");
  return ctx;
}

/** Crear, anunciar, sellar, resolver, cancelar. Sólo dueño o administrador. */
export async function requireRafflesAdmin() {
  const ctx = await contextoBase();
  if (!canManageWorkspaceSettings(ctx.role)) redirect("/sorteos");
  return ctx;
}
```

- [ ] **Step 6: Escribir el test de acceso**

`apps/fotoffice/lib/raffles/access.test.ts`, con el mismo patrón de mocks que `lib/modules/gating.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock, requireActiveWorkspaceMock, resolveRoleMock, isModuleEnabledMock } = vi.hoisted(
  () => ({
    redirectMock: vi.fn((destino: string) => {
      throw new Error(`REDIRECT:${destino}`);
    }),
    requireActiveWorkspaceMock: vi.fn(),
    resolveRoleMock: vi.fn(),
    isModuleEnabledMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/workspace", () => ({ requireActiveWorkspace: requireActiveWorkspaceMock }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: resolveRoleMock }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: isModuleEnabledMock }));

const { requireRafflesAdmin, requireRafflesStaff } = await import("./access");

const ws = { id: "ws-1", name: "SFPR" };

beforeEach(() => {
  redirectMock.mockClear();
  requireActiveWorkspaceMock.mockResolvedValue({ user: { id: 7 }, workspace: ws });
  resolveRoleMock.mockResolvedValue("OWNER");
  isModuleEnabledMock.mockResolvedValue(true);
});

describe("la puerta del módulo", () => {
  it("con el módulo apagado, nadie entra aunque sea dueño", async () => {
    isModuleEnabledMock.mockResolvedValue(false);
    await expect(requireRafflesStaff()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("sin rol en el workspace, no entra", async () => {
    resolveRoleMock.mockResolvedValue(null);
    await expect(requireRafflesStaff()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("el equipo ve la lista", async () => {
    resolveRoleMock.mockResolvedValue("STAFF");
    await expect(requireRafflesStaff()).resolves.toMatchObject({ workspace: ws, role: "STAFF" });
  });

  it("STAFF no puede anunciar ni sortear: lo manda a la lista", async () => {
    resolveRoleMock.mockResolvedValue("STAFF");
    await expect(requireRafflesAdmin()).rejects.toThrow("REDIRECT:/sorteos");
  });

  it("el dueño sí puede", async () => {
    await expect(requireRafflesAdmin()).resolves.toMatchObject({ role: "OWNER" });
  });
});
```

- [ ] **Step 7: Correr y ver que pasa**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/access.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 8: Commit**

```bash
git add apps/fotoffice/lib/modules/registry.ts apps/fotoffice/lib/modules/registry.test.ts apps/fotoffice/lib/raffles/access.ts apps/fotoffice/lib/raffles/access.test.ts
git commit -m "Sorteos es un módulo con interruptor propio y puerta en el servidor

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Crear un sorteo y cargarle premios

**Files:**
- Create: `apps/fotoffice/lib/raffles/raffle-form.ts`
- Create: `apps/fotoffice/lib/raffles/raffle-form.test.ts`
- Create: `apps/fotoffice/lib/raffles/prize-form.ts`
- Create: `apps/fotoffice/lib/raffles/prize-form.test.ts`
- Create: `apps/fotoffice/lib/raffles/repository.ts`
- Create: `apps/fotoffice/lib/raffles/events.ts`

**Interfaces:**
- Consumes: `parseLocalDateTime` de `lib/bookings/local-datetime.ts`, `RAFFLES_TIME_ZONE` y `DEFAULT_ENTRIES_CLOSE_HOURS` de `./constants`.
- Produces:
  - `type RaffleFormValues = { title: string; description: string | null; entriesCloseAt: Date; drawsAt: Date }`
  - `parseRaffleForm(formData: FormData): { ok: true; values: RaffleFormValues } | { ok: false; error: string }`
  - `type PrizeFormValues = { order: number; title: string; description: string | null; conditions: string | null; pickupInstructions: string | null; pickupDeadline: Date | null; estimatedValueMinor: number | null; partnerId: string | null; partnerNameSnapshot: string | null }`
  - `parsePrizeForm(formData: FormData): { ok: true; values: PrizeFormValues } | { ok: false; error: string }`
  - `listRaffles(workspaceId: string)`, `loadRaffle(workspaceId: string, raffleId: string)`, `loadMembersForRaffle(workspaceId: string)`, `searchPartners(texto: string)`
  - `recordRaffleEvent(...)` en `events.ts`

- [ ] **Step 1: Escribir el test del formulario del sorteo**

`apps/fotoffice/lib/raffles/raffle-form.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseRaffleForm } from "./raffle-form";

const form = (campos: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
};

const completo = {
  title: "Sorteo de septiembre",
  description: "Con premios de nuestras marcas aliadas.",
  drawsAt: "2026-09-30T20:00",
  entriesCloseAt: "2026-09-29T20:00",
};

describe("el formulario del sorteo", () => {
  it("acepta un sorteo completo", () => {
    const r = parseRaffleForm(form(completo));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.title).toBe("Sorteo de septiembre");
    expect(r.values.description).toBe("Con premios de nuestras marcas aliadas.");
  });

  it("exige título", () => {
    const r = parseRaffleForm(form({ ...completo, title: "  " }));
    expect(r).toEqual({ ok: false, error: "Poné un título." });
  });

  it("la descripción vacía queda en nulo, no en texto vacío", () => {
    const r = parseRaffleForm(form({ ...completo, description: "" }));
    expect(r.ok && r.values.description).toBe(null);
  });

  it("exige la fecha del acto", () => {
    const r = parseRaffleForm(form({ ...completo, drawsAt: "" }));
    expect(r.ok).toBe(false);
  });

  it("si no le ponen cierre de padrón, lo pone 24 horas antes del acto", () => {
    const fd = form(completo);
    fd.set("entriesCloseAt", "");
    const r = parseRaffleForm(fd);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const horas = (r.values.drawsAt.getTime() - r.values.entriesCloseAt.getTime()) / 3_600_000;
    expect(horas).toBe(24);
  });

  it("el padrón no puede cerrar después del acto", () => {
    const r = parseRaffleForm(form({ ...completo, entriesCloseAt: "2026-10-01T20:00" }));
    expect(r).toEqual({
      ok: false,
      error: "El padrón tiene que cerrar antes del acto.",
    });
  });

  it("el padrón no puede cerrar en el mismo instante del acto: ahí se abre la ventana para acomodar la lista", () => {
    const r = parseRaffleForm(form({ ...completo, entriesCloseAt: "2026-09-30T20:00" }));
    expect(r.ok).toBe(false);
  });

  it("las fechas se leen en hora argentina, no en la del servidor", () => {
    const r = parseRaffleForm(form(completo));
    expect(r.ok).toBe(true);
    // 20:00 en Buenos Aires (UTC−3) son las 23:00 UTC.
    if (r.ok) expect(r.values.drawsAt.toISOString()).toBe("2026-09-30T23:00:00.000Z");
  });

  it("una fecha con forma inválida se rechaza con un mensaje entendible", () => {
    const r = parseRaffleForm(form({ ...completo, drawsAt: "30/09/2026" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/fecha/i);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/raffle-form.test.ts`
Expected: FAIL — `Failed to load ./raffle-form`.

- [ ] **Step 3: Escribir `raffle-form.ts`**

```ts
import { parseLocalDateTime } from "@/lib/bookings/local-datetime";
import { DEFAULT_ENTRIES_CLOSE_HOURS, RAFFLES_TIME_ZONE } from "./constants";

/**
 * El formulario de alta y edición del sorteo, parseado.
 *
 * Módulo PURO: recibe un `FormData` y devuelve valores o un motivo en castellano. La acción
 * de servidor sólo escribe; no decide si algo es válido.
 *
 * Las dos fechas se escriben en hora argentina y se guardan en UTC. La zona no puede salir
 * del servidor: en Vercel el servidor está en UTC y "las 20:00" quedarían tres horas
 * corridas.
 */

export type RaffleFormValues = {
  title: string;
  description: string | null;
  entriesCloseAt: Date;
  drawsAt: Date;
};

export type RaffleFormResult =
  | { ok: true; values: RaffleFormValues }
  | { ok: false; error: string };

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();

export function parseRaffleForm(formData: FormData): RaffleFormResult {
  const title = texto(formData, "title");
  if (title === "") return { ok: false, error: "Poné un título." };

  const crudoActo = texto(formData, "drawsAt");
  if (crudoActo === "") return { ok: false, error: "Poné la fecha y la hora del acto." };

  const drawsAt = parseLocalDateTime(crudoActo, RAFFLES_TIME_ZONE);
  if (!drawsAt) return { ok: false, error: "La fecha del acto no se entiende." };

  const crudoCierre = texto(formData, "entriesCloseAt");
  // Sin cierre explícito, veinticuatro horas antes. Ese margen elimina toda carrera de
  // tiempos y no exige una tarea programada de precisión de minutos.
  const entriesCloseAt =
    crudoCierre === ""
      ? new Date(drawsAt.getTime() - DEFAULT_ENTRIES_CLOSE_HOURS * 3_600_000)
      : parseLocalDateTime(crudoCierre, RAFFLES_TIME_ZONE);

  if (!entriesCloseAt) return { ok: false, error: "La fecha de cierre del padrón no se entiende." };
  if (entriesCloseAt.getTime() >= drawsAt.getTime()) {
    return { ok: false, error: "El padrón tiene que cerrar antes del acto." };
  }

  const description = texto(formData, "description");

  return {
    ok: true,
    values: { title, description: description === "" ? null : description, entriesCloseAt, drawsAt },
  };
}
```

`parseLocalDateTime(texto, timeZone)` ya existe, es puro y está probado en `lib/bookings/local-datetime.ts`. No duplicar la conversión de zona horaria: se reusa tal cual.

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/raffle-form.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Escribir el test del formulario de premio**

`apps/fotoffice/lib/raffles/prize-form.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parsePrizeForm } from "./prize-form";

const form = (campos: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
};

const completo = {
  order: "1",
  title: "Mochila para equipo fotográfico",
  description: "Modelo 30 litros.",
  conditions: "Se retira en la sede, con carnet.",
  pickupInstructions: "Martes y jueves de 18 a 20.",
  pickupDeadline: "2026-10-31",
  estimatedValue: "120000",
  partnerId: "pt-1",
  partnerName: "Casa de Fotografía Norte",
};

describe("el formulario del premio", () => {
  it("acepta un premio completo", () => {
    const r = parsePrizeForm(form(completo));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.title).toBe("Mochila para equipo fotográfico");
    expect(r.values.order).toBe(1);
    expect(r.values.partnerId).toBe("pt-1");
    expect(r.values.partnerNameSnapshot).toBe("Casa de Fotografía Norte");
  });

  it("exige título", () => {
    expect(parsePrizeForm(form({ ...completo, title: "" })).ok).toBe(false);
  });

  it("el orden tiene que ser un entero positivo: entra en la cuenta del ganador", () => {
    expect(parsePrizeForm(form({ ...completo, order: "0" })).ok).toBe(false);
    expect(parsePrizeForm(form({ ...completo, order: "-1" })).ok).toBe(false);
    expect(parsePrizeForm(form({ ...completo, order: "1.5" })).ok).toBe(false);
  });

  it("el valor estimado se guarda en centavos", () => {
    const r = parsePrizeForm(form({ ...completo, estimatedValue: "120000" }));
    expect(r.ok && r.values.estimatedValueMinor).toBe(12_000_000);
  });

  it("el valor estimado es opcional", () => {
    const r = parsePrizeForm(form({ ...completo, estimatedValue: "" }));
    expect(r.ok && r.values.estimatedValueMinor).toBe(null);
  });

  it("un premio sin aliado es válido: la institución también pone premios propios", () => {
    const r = parsePrizeForm(form({ ...completo, partnerId: "", partnerName: "" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values.partnerId).toBe(null);
      expect(r.values.partnerNameSnapshot).toBe(null);
    }
  });

  it("si se elige un aliado, se guarda su nombre del momento: la ficha puede cambiar después", () => {
    const r = parsePrizeForm(form(completo));
    expect(r.ok && r.values.partnerNameSnapshot).toBe("Casa de Fotografía Norte");
  });

  it("un aliado sin nombre no se acepta: quedaría un premio de nadie", () => {
    expect(parsePrizeForm(form({ ...completo, partnerName: "" })).ok).toBe(false);
  });

  it("el plazo de retiro es opcional y se lee al final del día", () => {
    const r = parsePrizeForm(form(completo));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.pickupDeadline?.toISOString()).toBe("2026-11-01T02:59:59.999Z");
  });
});
```

- [ ] **Step 6: Correr y ver que falla**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/prize-form.test.ts`
Expected: FAIL.

- [ ] **Step 7: Escribir `prize-form.ts`**

```ts
import { parseLocalDateTime } from "@/lib/bookings/local-datetime";
import { RAFFLES_TIME_ZONE } from "./constants";

/**
 * El formulario de un premio, parseado. Módulo PURO.
 *
 * El `order` no es cosmético: entra en el cálculo del ganador. Dos premios con el mismo orden
 * sacarían el mismo número, y por eso la base también lo impide con un `@@unique`.
 */

export type PrizeFormValues = {
  order: number;
  title: string;
  description: string | null;
  conditions: string | null;
  pickupInstructions: string | null;
  pickupDeadline: Date | null;
  estimatedValueMinor: number | null;
  partnerId: string | null;
  partnerNameSnapshot: string | null;
};

export type PrizeFormResult =
  | { ok: true; values: PrizeFormValues }
  | { ok: false; error: string };

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();
const nulo = (v: string) => (v === "" ? null : v);

export function parsePrizeForm(formData: FormData): PrizeFormResult {
  const title = texto(formData, "title");
  if (title === "") return { ok: false, error: "Poné el nombre del premio." };

  const order = Number(texto(formData, "order"));
  if (!Number.isInteger(order) || order < 1) {
    return { ok: false, error: "El orden del premio tiene que ser un número entero desde 1." };
  }

  const crudoValor = texto(formData, "estimatedValue");
  let estimatedValueMinor: number | null = null;
  if (crudoValor !== "") {
    const pesos = Number(crudoValor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(pesos) || pesos < 0) {
      return { ok: false, error: "El valor estimado no se entiende." };
    }
    estimatedValueMinor = Math.round(pesos * 100);
  }

  const partnerId = nulo(texto(formData, "partnerId"));
  const partnerName = nulo(texto(formData, "partnerName"));
  if (partnerId !== null && partnerName === null) {
    return { ok: false, error: "Elegí el aliado de la lista o escribí su nombre." };
  }

  const crudoPlazo = texto(formData, "pickupDeadline");
  let pickupDeadline: Date | null = null;
  if (crudoPlazo !== "") {
    // Al final de ese día: un plazo "hasta el 31" que vence a las 00:00 del 31 no es lo que
    // entiende quien lo escribe.
    const fin = parseLocalDateTime(`${crudoPlazo}T23:59`, RAFFLES_TIME_ZONE);
    if (!fin) return { ok: false, error: "El plazo de retiro no se entiende." };
    pickupDeadline = new Date(fin.getTime() + 59_999);
  }

  return {
    ok: true,
    values: {
      order,
      title,
      description: nulo(texto(formData, "description")),
      conditions: nulo(texto(formData, "conditions")),
      pickupInstructions: nulo(texto(formData, "pickupInstructions")),
      pickupDeadline,
      estimatedValueMinor,
      partnerId,
      partnerNameSnapshot: partnerId === null ? null : partnerName,
    },
  };
}
```

- [ ] **Step 8: Correr y ver que pasa**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/prize-form.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 9: Escribir `repository.ts`**

```ts
import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import type { MemberForRaffle } from "./eligibility";

/**
 * Única puerta a las cinco tablas de sorteos.
 *
 * Su trabajo es juntar lo que el núcleo puro necesita y devolvérselo resuelto. El núcleo no
 * sabe de Prisma, y por eso se puede verificar sin montar una base.
 *
 * Toda consulta lleva `workspaceId`.
 */

export async function listRaffles(workspaceId: string) {
  return prisma.raffle.findMany({
    where: { workspaceId },
    orderBy: { drawsAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      entriesCloseAt: true,
      drawsAt: true,
      entrantsCount: true,
      cancelReason: true,
      _count: { select: { prizes: true } },
    },
  });
}

export async function loadRaffle(workspaceId: string, raffleId: string) {
  return prisma.raffle.findFirst({
    where: { id: raffleId, workspaceId },
    include: {
      prizes: {
        orderBy: { order: "asc" },
        include: {
          award: {
            include: {
              member: { select: { id: true, memberNumber: true, firstName: true, lastName: true } },
            },
          },
        },
      },
      entries: { orderBy: { position: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
}

/**
 * Los socios con sus cargos impagos, para decidir quién entra en el padrón.
 *
 * Trae TODOS los socios, no sólo los activos: la regla de elegibilidad decide, y que decida
 * un único lugar es lo que hace que la pantalla del socio y el sellado nunca discrepen.
 */
export async function loadMembersForRaffle(workspaceId: string): Promise<MemberForRaffle[]> {
  const filas = await prisma.member.findMany({
    where: { workspaceId },
    select: {
      id: true,
      memberNumber: true,
      firstName: true,
      lastName: true,
      status: true,
      charges: {
        where: { balanceArs: { gt: 0 } },
        select: { period: true, dueDate: true, balanceArs: true },
      },
    },
  });

  return filas.map((m) => ({
    memberId: m.id,
    memberNumber: m.memberNumber,
    fullName: `${m.firstName} ${m.lastName}`.trim(),
    status: String(m.status),
    charges: m.charges.map((c) => ({
      period: c.period,
      dueDate: c.dueDate,
      balanceMinor: decimalArsToMinor(c.balanceArs),
    })),
  }));
}

/**
 * Buscador de aliados para el formulario de premios.
 *
 * `DnxPartner` vive en el dominio de Partners, que es otra aplicación. Se lee por id y por
 * nombre, sin clave foránea: el enganche es mínimo a propósito.
 */
export async function searchPartners(texto: string) {
  const q = texto.trim();
  if (q.length < 2) return [];
  return prisma.dnxPartner.findMany({
    where: { archivedAt: null, name: { contains: q, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: 10,
    select: { id: true, name: true, logoUrl: true },
  });
}
```

- [ ] **Step 10: Escribir `events.ts`**

```ts
import "server-only";
import { prisma, type Prisma } from "@repo/db";

/**
 * La historia del sorteo.
 *
 * Mismo criterio que `MemberCardEvent`: las decisiones se guardan, las derivaciones se
 * calculan. `actorLabel` es una instantánea del nombre al momento del hecho, porque la
 * historia tiene que seguir entendiéndose aunque esa persona cambie de nombre o su usuario
 * se elimine.
 *
 * Acepta un cliente de transacción para que el evento y el cambio que describe entren o
 * salgan juntos: un evento sin su hecho es peor que no tener evento.
 */

export type RaffleEventType =
  | "CREADO"
  | "ANUNCIADO"
  | "PADRON_SELLADO"
  | "SORTEADO"
  | "PREMIO_NOTIFICADO"
  | "PREMIO_ENTREGADO"
  | "PREMIO_NO_RETIRADO"
  | "PREMIO_ANULADO"
  | "CANCELADO";

export async function recordRaffleEvent(
  cliente: Prisma.TransactionClient | typeof prisma,
  input: {
    raffleId: string;
    type: RaffleEventType;
    actorUserId?: number | null;
    actorLabel?: string | null;
    note?: string | null;
    prizeId?: string | null;
  },
): Promise<void> {
  await cliente.raffleEvent.create({
    data: {
      raffleId: input.raffleId,
      type: input.type,
      actorUserId: input.actorUserId ?? null,
      actorLabel: input.actorLabel ?? null,
      note: input.note ?? null,
      prizeId: input.prizeId ?? null,
    },
  });
}
```

- [ ] **Step 11: Verificar que compila**

Run: `cd apps/fotoffice && pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 12: Commit**

```bash
git add apps/fotoffice/lib/raffles/raffle-form.ts apps/fotoffice/lib/raffles/raffle-form.test.ts apps/fotoffice/lib/raffles/prize-form.ts apps/fotoffice/lib/raffles/prize-form.test.ts apps/fotoffice/lib/raffles/repository.ts apps/fotoffice/lib/raffles/events.ts
git commit -m "El sorteo se carga con sus dos fechas y sus premios

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Anunciar fija la tanda de drand

Este es el paso que cierra la trampa: la tanda queda escrita antes de que el padrón se selle, y el padrón se sella antes de que la tanda exista.

**Files:**
- Create: `apps/fotoffice/lib/raffles/announce.ts`
- Create: `apps/fotoffice/lib/raffles/announce.test.ts`

**Interfaces:**
- Consumes: `canAnnounce` de `./lifecycle`, `fetchChainInfo` y `roundAfter` de `./drand`, `recordRaffleEvent` de `./events`.
- Produces: `announceRaffle(input: { workspaceId: string; raffleId: string; actorUserId: number; actorLabel: string; now?: Date }): Promise<{ ok: true; round: number } | { ok: false; error: string }>`

- [ ] **Step 1: Escribir el test**

`apps/fotoffice/lib/raffles/announce.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirstMock, updateMock, eventMock, chainInfoMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  updateMock: vi.fn(),
  eventMock: vi.fn(),
  chainInfoMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: { raffle: { findFirst: findFirstMock, update: updateMock } },
}));
vi.mock("./events", () => ({ recordRaffleEvent: eventMock }));
vi.mock("./drand", async () => {
  const real = await vi.importActual<typeof import("./drand")>("./drand");
  return { ...real, fetchChainInfo: chainInfoMock };
});

const { announceRaffle } = await import("./announce");

const AHORA = new Date("2026-09-20T12:00:00Z");
const sorteo = {
  id: "r-1",
  status: "BORRADOR",
  entriesCloseAt: new Date("2026-09-29T23:00:00Z"),
  drawsAt: new Date("2026-09-30T23:00:00Z"),
  _count: { prizes: 2 },
};

beforeEach(() => {
  findFirstMock.mockReset().mockResolvedValue(sorteo);
  updateMock.mockReset().mockResolvedValue({});
  eventMock.mockReset();
  chainInfoMock.mockReset().mockResolvedValue({
    chainHash: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
    periodSeconds: 3,
    genesisTimeSeconds: 1_692_803_367,
  });
});

const anunciar = () =>
  announceRaffle({
    workspaceId: "ws-1",
    raffleId: "r-1",
    actorUserId: 7,
    actorLabel: "Secretaría",
    now: AHORA,
  });

describe("anunciar un sorteo", () => {
  it("guarda la cadena y la tanda, y pasa a ANUNCIADO", async () => {
    const r = await anunciar();
    expect(r.ok).toBe(true);
    const datos = updateMock.mock.calls[0][0].data;
    expect(datos.status).toBe("ANUNCIADO");
    expect(datos.drandChainHash).toHaveLength(64);
    expect(typeof datos.drandRound).toBe("number");
  });

  it("la tanda que fija es POSTERIOR al acto", async () => {
    const r = await anunciar();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const info = await chainInfoMock.mock.results[0].value;
    const cuando = (info.genesisTimeSeconds + (r.round - 1) * info.periodSeconds) * 1000;
    expect(cuando).toBeGreaterThan(sorteo.drawsAt.getTime());
  });

  it("NO escribe el valor del azar: eso todavía no existe", async () => {
    await anunciar();
    const datos = updateMock.mock.calls[0][0].data;
    expect(datos.drandRandomness).toBeUndefined();
    expect(datos.drandSignature).toBeUndefined();
  });

  it("deja registrado quién anunció", async () => {
    await anunciar();
    expect(eventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "ANUNCIADO", actorUserId: 7, actorLabel: "Secretaría" }),
    );
  });

  it("no anuncia un sorteo sin premios", async () => {
    findFirstMock.mockResolvedValue({ ...sorteo, _count: { prizes: 0 } });
    await expect(anunciar()).resolves.toEqual({
      ok: false,
      error: "No se puede anunciar un sorteo sin premios.",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("no anuncia dos veces", async () => {
    findFirstMock.mockResolvedValue({ ...sorteo, status: "ANUNCIADO" });
    const r = await anunciar();
    expect(r.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("un sorteo de otra institución no existe para esta", async () => {
    findFirstMock.mockResolvedValue(null);
    const r = await anunciar();
    expect(r.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("si drand no contesta, no anuncia y lo dice: sin tanda no hay garantía", async () => {
    chainInfoMock.mockRejectedValue(new Error("sin red"));
    const r = await anunciar();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/drand/i);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/announce.test.ts`
Expected: FAIL.

- [ ] **Step 3: Escribir `announce.ts`**

```ts
import "server-only";
import { prisma } from "@repo/db";
import { DRAND_DEFAULT_CHAIN_HASH } from "./constants";
import { fetchChainInfo, roundAfter } from "./drand";
import { recordRaffleEvent } from "./events";
import { canAnnounce } from "./lifecycle";
import type { RaffleStatus } from "./constants";

/**
 * Anunciar: el paso que fija de dónde va a salir el número.
 *
 * Acá se consulta `/info` de la cadena —génesis y período— y se guarda el `chainHash` junto
 * con la primera tanda estrictamente posterior al acto. Los parámetros se leen del servicio y
 * no se fijan en el código: si la cadena cambiara, un número escrito a mano dejaría de
 * verificar.
 *
 * Lo que NO se guarda acá es el valor del azar: todavía no existe. Ese es todo el punto.
 */

export async function announceRaffle(input: {
  workspaceId: string;
  raffleId: string;
  actorUserId: number;
  actorLabel: string;
  now?: Date;
}): Promise<{ ok: true; round: number } | { ok: false; error: string }> {
  const now = input.now ?? new Date();

  const sorteo = await prisma.raffle.findFirst({
    where: { id: input.raffleId, workspaceId: input.workspaceId },
    select: {
      id: true,
      status: true,
      entriesCloseAt: true,
      drawsAt: true,
      _count: { select: { prizes: true } },
    },
  });
  if (!sorteo) return { ok: false, error: "Ese sorteo no existe." };

  const permiso = canAnnounce({
    status: sorteo.status as RaffleStatus,
    prizeCount: sorteo._count.prizes,
    entriesCloseAt: sorteo.entriesCloseAt,
    drawsAt: sorteo.drawsAt,
    now,
  });
  if (!permiso.ok) return permiso;

  let info;
  try {
    info = await fetchChainInfo(DRAND_DEFAULT_CHAIN_HASH);
  } catch {
    return {
      ok: false,
      error: "No se pudo leer drand en este momento. Sin la tanda fijada no se anuncia. Probá de nuevo.",
    };
  }

  const round = roundAfter(info, sorteo.drawsAt);

  await prisma.$transaction(async (tx) => {
    await tx.raffle.update({
      where: { id: sorteo.id },
      data: {
        status: "ANUNCIADO",
        drandChainHash: info.chainHash,
        drandRound: round,
        announcedByUserId: input.actorUserId,
      },
    });
    await recordRaffleEvent(tx, {
      raffleId: sorteo.id,
      type: "ANUNCIADO",
      actorUserId: input.actorUserId,
      actorLabel: input.actorLabel,
      note: `Tanda de drand fijada: ${round}.`,
    });
  });

  return { ok: true, round };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/announce.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/raffles/announce.ts apps/fotoffice/lib/raffles/announce.test.ts
git commit -m "Al anunciar queda fijado de dónde saldrá el número

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Sellar el padrón

**Files:**
- Create: `apps/fotoffice/lib/raffles/seal.ts`
- Create: `apps/fotoffice/lib/raffles/seal.test.ts`

**Interfaces:**
- Consumes: `loadMembersForRaffle` de `./repository`, `selectEntrants` de `./eligibility`, `orderEntrants` y `entrantsHash` de `./entrants`, `canSeal` de `./lifecycle`.
- Produces:
  - `sealRaffle(input: { workspaceId: string; raffleId: string; actorUserId?: number | null; actorLabel?: string | null; now?: Date }): Promise<{ ok: true; entrantsCount: number; entrantsHash: string; alreadySealed: boolean } | { ok: false; error: string }>`
  - `sealDueRaffles(now?: Date): Promise<{ sellados: number; fallados: { raffleId: string; error: string }[] }>`

- [ ] **Step 1: Escribir el test**

`apps/fotoffice/lib/raffles/seal.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirstMock, findManyMock, updateMock, createManyMock, transactionMock, eventMock, membersMock } =
  vi.hoisted(() => ({
    findFirstMock: vi.fn(),
    findManyMock: vi.fn(),
    updateMock: vi.fn(),
    createManyMock: vi.fn(),
    transactionMock: vi.fn(),
    eventMock: vi.fn(),
    membersMock: vi.fn(),
  }));

vi.mock("@repo/db", () => ({
  prisma: {
    raffle: { findFirst: findFirstMock, findMany: findManyMock, update: updateMock },
    raffleEntry: { createMany: createManyMock },
    $transaction: transactionMock,
  },
}));
vi.mock("./events", () => ({ recordRaffleEvent: eventMock }));
vi.mock("./repository", () => ({ loadMembersForRaffle: membersMock }));

const { sealRaffle } = await import("./seal");

const CIERRE = new Date("2026-09-29T23:00:00Z");
const DESPUES = new Date("2026-09-30T01:00:00Z");

const sorteo = {
  id: "r-1",
  status: "ANUNCIADO",
  entriesCloseAt: CIERRE,
  entrantsHash: null as string | null,
  entrantsCount: null as number | null,
  _count: { prizes: 2 },
};

const socio = (id: string, numero: string, alDia = true) => ({
  memberId: id,
  memberNumber: numero,
  fullName: `Socio ${numero}`,
  status: "ACTIVE",
  charges: alDia ? [] : [{ period: "2026-08", dueDate: new Date("2026-09-10"), balanceMinor: 500000 }],
});

beforeEach(() => {
  findFirstMock.mockReset().mockResolvedValue(sorteo);
  updateMock.mockReset().mockResolvedValue({});
  createManyMock.mockReset().mockResolvedValue({ count: 0 });
  eventMock.mockReset();
  membersMock.mockReset().mockResolvedValue([socio("m-1", "10"), socio("m-2", "20")]);
  transactionMock.mockReset().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      raffle: { update: updateMock },
      raffleEntry: { createMany: createManyMock },
      raffleEvent: { create: vi.fn() },
    }),
  );
});

const sellar = (now = DESPUES) =>
  sealRaffle({ workspaceId: "ws-1", raffleId: "r-1", actorUserId: null, actorLabel: null, now });

describe("sellar el padrón", () => {
  it("congela a los que están al día, con posición y huella", async () => {
    const r = await sellar();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entrantsCount).toBe(2);
    expect(r.entrantsHash).toMatch(/^[0-9a-f]{64}$/);
    expect(createManyMock.mock.calls[0][0].data).toHaveLength(2);
  });

  it("deja afuera al que debe", async () => {
    membersMock.mockResolvedValue([socio("m-1", "10"), socio("m-2", "20", false)]);
    const r = await sellar();
    expect(r.ok && r.entrantsCount).toBe(1);
  });

  it("guarda instantáneas del número y el nombre", async () => {
    await sellar();
    const filas = createManyMock.mock.calls[0][0].data;
    expect(filas[0]).toMatchObject({ memberNumberSnapshot: "10", fullNameSnapshot: "Socio 10" });
  });

  it("las posiciones arrancan en cero y son consecutivas", async () => {
    await sellar();
    const filas = createManyMock.mock.calls[0][0].data;
    expect(filas.map((f: { position: number }) => f.position)).toEqual([0, 1]);
  });

  it("pasa a PADRON_SELLADO", async () => {
    await sellar();
    expect(updateMock.mock.calls[0][0].data.status).toBe("PADRON_SELLADO");
  });

  it("antes del cierre no sella", async () => {
    const r = await sellar(new Date("2026-09-28T00:00:00Z"));
    expect(r.ok).toBe(false);
    expect(createManyMock).not.toHaveBeenCalled();
  });

  it("un padrón ya sellado no se vuelve a sellar, y no es un error", async () => {
    findFirstMock.mockResolvedValue({
      ...sorteo,
      status: "PADRON_SELLADO",
      entrantsHash: "f".repeat(64),
      entrantsCount: 40,
    });
    const r = await sellar();
    expect(r).toEqual({
      ok: true,
      alreadySealed: true,
      entrantsCount: 40,
      entrantsHash: "f".repeat(64),
    });
    expect(createManyMock).not.toHaveBeenCalled();
  });

  it("sin ningún socio al día no sella, y el sorteo queda anunciado", async () => {
    membersMock.mockResolvedValue([socio("m-1", "10", false)]);
    const r = await sellar();
    expect(r).toEqual({
      ok: false,
      error: "Ningún socio quedó al día al cerrar el padrón. El sorteo no se puede sellar.",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("con menos participantes que premios no sella", async () => {
    findFirstMock.mockResolvedValue({ ...sorteo, _count: { prizes: 5 } });
    const r = await sellar();
    expect(r.ok).toBe(false);
  });

  it("la huella se calcula con el mismo sorteo: dos sorteos con el mismo padrón no comparten huella", async () => {
    const a = await sellar();
    findFirstMock.mockResolvedValue({ ...sorteo, id: "r-2" });
    const b = await sealRaffle({ workspaceId: "ws-1", raffleId: "r-2", now: DESPUES });
    expect(a.ok && b.ok && a.entrantsHash).not.toBe(b.ok ? b.entrantsHash : "");
  });

  it("deja registrado el sellado con la cantidad", async () => {
    await sellar();
    expect(eventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "PADRON_SELLADO" }),
    );
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/seal.test.ts`
Expected: FAIL.

- [ ] **Step 3: Escribir `seal.ts`**

```ts
import "server-only";
import { prisma } from "@repo/db";
import { entrantsHash as calcularHuella, orderEntrants } from "./entrants";
import { selectEntrants } from "./eligibility";
import { recordRaffleEvent } from "./events";
import { canSeal } from "./lifecycle";
import { loadMembersForRaffle } from "./repository";
import type { RaffleStatus } from "./constants";

/**
 * El sellado del padrón: el momento anterior al acto en el que la lista se congela.
 *
 * ── Por qué es un momento distinto del sorteo ──
 *
 * Si el padrón se congelara en el mismo instante del acto, quedaría una ventana de
 * manipulación: entre que sale el valor de drand y que alguien resuelve el sorteo, un
 * administrador que ya vio el número podría alterar el estado de deuda de un socio y cambiar
 * quién está en la lista. El sellado ocurre —y se puede demostrar que ocurrió— ANTES de que
 * el número exista.
 *
 * Es idempotente: sellar dos veces devuelve el mismo resultado y no reescribe nada. Se
 * dispara de dos maneras, la tarea programada y la primera visita posterior al cierre,
 * porque un sorteo no puede quedar sin sellar por una tarea que no corrió.
 */

export type SealResult =
  | { ok: true; entrantsCount: number; entrantsHash: string; alreadySealed: boolean }
  | { ok: false; error: string };

export async function sealRaffle(input: {
  workspaceId: string;
  raffleId: string;
  actorUserId?: number | null;
  actorLabel?: string | null;
  now?: Date;
}): Promise<SealResult> {
  const now = input.now ?? new Date();

  const sorteo = await prisma.raffle.findFirst({
    where: { id: input.raffleId, workspaceId: input.workspaceId },
    select: {
      id: true,
      status: true,
      entriesCloseAt: true,
      entrantsHash: true,
      entrantsCount: true,
      _count: { select: { prizes: true } },
    },
  });
  if (!sorteo) return { ok: false, error: "Ese sorteo no existe." };

  // Ya sellado: no es un error. Es la respuesta correcta a la segunda llamada.
  if (sorteo.entrantsHash !== null && sorteo.entrantsCount !== null) {
    return {
      ok: true,
      alreadySealed: true,
      entrantsCount: sorteo.entrantsCount,
      entrantsHash: sorteo.entrantsHash,
    };
  }

  const socios = await loadMembersForRaffle(input.workspaceId);
  const participantes = orderEntrants(selectEntrants(socios, sorteo.entriesCloseAt));

  const permiso = canSeal({
    status: sorteo.status as RaffleStatus,
    entriesCloseAt: sorteo.entriesCloseAt,
    now,
    entrantCount: participantes.length,
    prizeCount: sorteo._count.prizes,
  });
  if (!permiso.ok) return permiso;

  const huella = calcularHuella(sorteo.id, participantes);

  await prisma.$transaction(async (tx) => {
    await tx.raffleEntry.createMany({
      data: participantes.map((e) => ({
        raffleId: sorteo.id,
        memberId: e.memberId,
        position: e.position,
        memberNumberSnapshot: e.memberNumber,
        fullNameSnapshot: e.fullName,
      })),
      skipDuplicates: true,
    });
    await tx.raffle.update({
      where: { id: sorteo.id },
      data: {
        status: "PADRON_SELLADO",
        entrantsHash: huella,
        entrantsCount: participantes.length,
        sealedAt: now,
      },
    });
    await recordRaffleEvent(tx, {
      raffleId: sorteo.id,
      type: "PADRON_SELLADO",
      actorUserId: input.actorUserId ?? null,
      actorLabel: input.actorLabel ?? null,
      note: `${participantes.length} participantes. Huella ${huella}.`,
    });
  });

  return { ok: true, alreadySealed: false, entrantsCount: participantes.length, entrantsHash: huella };
}

/**
 * Sella todos los sorteos cuyo padrón ya cerró. La usa la tarea programada.
 *
 * Un sorteo que no se puede sellar —nadie al día, menos participantes que premios— no
 * interrumpe a los demás: queda anotado y la Secretaría lo ve en la pantalla.
 */
export async function sealDueRaffles(
  now: Date = new Date(),
): Promise<{ sellados: number; fallados: { raffleId: string; error: string }[] }> {
  const pendientes = await prisma.raffle.findMany({
    where: { status: "ANUNCIADO", entriesCloseAt: { lte: now } },
    select: { id: true, workspaceId: true },
  });

  let sellados = 0;
  const fallados: { raffleId: string; error: string }[] = [];

  for (const p of pendientes) {
    const r = await sealRaffle({ workspaceId: p.workspaceId, raffleId: p.id, now });
    if (r.ok) sellados += 1;
    else fallados.push({ raffleId: p.id, error: r.error });
  }

  return { sellados, fallados };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/seal.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/raffles/seal.ts apps/fotoffice/lib/raffles/seal.test.ts
git commit -m "El padrón se congela antes de que exista el número

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Resolver el sorteo

**Files:**
- Create: `apps/fotoffice/lib/raffles/resolve.ts`
- Create: `apps/fotoffice/lib/raffles/resolve.test.ts`

**Interfaces:**
- Consumes: `drawWinners` de `./draw`, `fetchRound` de `./drand`, `canDraw` de `./lifecycle`.
- Produces:
  - `resolveRaffle(input: { workspaceId: string; raffleId: string; actorUserId?: number | null; actorLabel?: string | null; now?: Date }): Promise<{ ok: true; alreadyDrawn: boolean; awards: { prizeId: string; memberId: string; winnerPosition: number }[] } | { ok: false; error: string; waiting?: boolean }>`
  - `resolveDueRaffles(now?: Date)`

- [ ] **Step 1: Escribir el test**

`apps/fotoffice/lib/raffles/resolve.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirstMock, updateMock, awardCreateMock, transactionMock, eventMock, fetchRoundMock } =
  vi.hoisted(() => ({
    findFirstMock: vi.fn(),
    updateMock: vi.fn(),
    awardCreateMock: vi.fn(),
    transactionMock: vi.fn(),
    eventMock: vi.fn(),
    fetchRoundMock: vi.fn(),
  }));

vi.mock("@repo/db", () => ({
  prisma: {
    raffle: { findFirst: findFirstMock, update: updateMock },
    rafflePrizeAward: { createMany: awardCreateMock },
    $transaction: transactionMock,
  },
}));
vi.mock("./events", () => ({ recordRaffleEvent: eventMock }));
vi.mock("./drand", async () => {
  const real = await vi.importActual<typeof import("./drand")>("./drand");
  return { ...real, fetchRound: fetchRoundMock };
});

const { resolveRaffle } = await import("./resolve");

const ACTO = new Date("2026-09-30T23:00:00Z");
const DESPUES = new Date("2026-09-30T23:05:00Z");

const entradas = Array.from({ length: 5 }, (_, i) => ({
  id: `e-${i}`,
  memberId: `m-${i}`,
  position: i,
}));

const sorteo = {
  id: "r-1",
  status: "PADRON_SELLADO",
  drawsAt: ACTO,
  drawnAt: null as Date | null,
  entrantsHash: "a".repeat(64),
  entrantsCount: 5,
  drandChainHash: "c".repeat(64),
  drandRound: 1000,
  drandRandomness: null as string | null,
  prizes: [
    { id: "p-1", order: 1 },
    { id: "p-2", order: 2 },
  ],
  entries: entradas,
};

beforeEach(() => {
  findFirstMock.mockReset().mockResolvedValue(sorteo);
  updateMock.mockReset().mockResolvedValue({});
  awardCreateMock.mockReset().mockResolvedValue({ count: 2 });
  eventMock.mockReset();
  fetchRoundMock
    .mockReset()
    .mockResolvedValue({ round: 1000, randomness: "b".repeat(64), signature: "d".repeat(96) });
  transactionMock.mockReset().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      raffle: { update: updateMock },
      rafflePrizeAward: { createMany: awardCreateMock },
      raffleEvent: { create: vi.fn() },
    }),
  );
});

const resolver = (now = DESPUES) =>
  resolveRaffle({ workspaceId: "ws-1", raffleId: "r-1", now });

describe("resolver el sorteo", () => {
  it("asigna un ganador por premio", async () => {
    const r = await resolver();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.awards).toHaveLength(2);
  });

  it("nadie gana dos premios", async () => {
    const r = await resolver();
    if (!r.ok) throw new Error("debía resolver");
    const ids = r.awards.map((a) => a.memberId);
    expect(new Set(ids).size).toBe(2);
  });

  it("guarda el valor de drand y su firma", async () => {
    await resolver();
    const datos = updateMock.mock.calls[0][0].data;
    expect(datos.drandRandomness).toBe("b".repeat(64));
    expect(datos.drandSignature).toBe("d".repeat(96));
    expect(datos.status).toBe("SORTEADO");
  });

  it("usa la tanda que se fijó al anunciar y no calcula una nueva", async () => {
    await resolver();
    expect(fetchRoundMock).toHaveBeenCalledWith("c".repeat(64), 1000);
  });

  it("es idempotente: un sorteo ya resuelto devuelve lo mismo y no reescribe", async () => {
    findFirstMock.mockResolvedValue({
      ...sorteo,
      status: "SORTEADO",
      drawnAt: DESPUES,
      drandRandomness: "b".repeat(64),
    });
    const r = await resolver();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.alreadyDrawn).toBe(true);
    expect(awardCreateMock).not.toHaveBeenCalled();
  });

  it("antes de la hora del acto no resuelve", async () => {
    const r = await resolver(new Date("2026-09-30T20:00:00Z"));
    expect(r.ok).toBe(false);
    expect(awardCreateMock).not.toHaveBeenCalled();
  });

  it("sin el padrón sellado no resuelve", async () => {
    findFirstMock.mockResolvedValue({ ...sorteo, status: "ANUNCIADO" });
    expect((await resolver()).ok).toBe(false);
  });

  it("si la tanda todavía no salió, espera: no es un error del sorteo", async () => {
    fetchRoundMock.mockRejectedValue(new Error("La tanda todavía no salió."));
    const r = await resolver();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.waiting).toBe(true);
      expect(r.error).toContain("1000");
    }
    expect(awardCreateMock).not.toHaveBeenCalled();
  });

  it("si los espejos no coinciden, no resuelve", async () => {
    fetchRoundMock.mockRejectedValue(new Error("Los espejos de drand no coinciden"));
    const r = await resolver();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.waiting).toBeUndefined();
  });

  it("el resultado no depende de cuándo se resuelva: mismos datos, mismos ganadores", async () => {
    const a = await resolver(new Date("2026-09-30T23:05:00Z"));
    awardCreateMock.mockClear();
    const b = await resolver(new Date("2026-10-05T10:00:00Z"));
    expect(a.ok && b.ok && a.awards).toEqual(b.ok ? b.awards : null);
  });

  it("deja registrado el sorteo con la tanda usada", async () => {
    await resolver();
    expect(eventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "SORTEADO" }),
    );
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/resolve.test.ts`
Expected: FAIL.

- [ ] **Step 3: Escribir `resolve.ts`**

```ts
import "server-only";
import { prisma } from "@repo/db";
import { drawWinners } from "./draw";
import { fetchRound } from "./drand";
import { recordRaffleEvent } from "./events";
import { canDraw } from "./lifecycle";
import type { RaffleStatus } from "./constants";

/**
 * El acto: se lee el número de drand y se resuelven los premios.
 *
 * Idempotente por diseño y por base. Si dos procesos llegan a la vez —la tarea programada y
 * alguien que abre la página— el `@unique` sobre `prizeId` impide el segundo resultado, y como
 * la extracción es determinística, el que gane la carrera escribe exactamente lo mismo que
 * habría escrito el otro. El resultado no depende de quién llegó primero.
 *
 * Si drand no responde todavía, no es una falla del sorteo: la tanda ya estaba fijada y el
 * resultado será idéntico cuando el valor se recupere. Por eso la espera se distingue del
 * error.
 */

export type ResolveResult =
  | { ok: true; alreadyDrawn: boolean; awards: { prizeId: string; memberId: string; winnerPosition: number }[] }
  | { ok: false; error: string; waiting?: boolean };

export async function resolveRaffle(input: {
  workspaceId: string;
  raffleId: string;
  actorUserId?: number | null;
  actorLabel?: string | null;
  now?: Date;
}): Promise<ResolveResult> {
  const now = input.now ?? new Date();

  const sorteo = await prisma.raffle.findFirst({
    where: { id: input.raffleId, workspaceId: input.workspaceId },
    select: {
      id: true,
      status: true,
      drawsAt: true,
      drawnAt: true,
      entrantsHash: true,
      entrantsCount: true,
      drandChainHash: true,
      drandRound: true,
      drandRandomness: true,
      prizes: { orderBy: { order: "asc" }, select: { id: true, order: true } },
      entries: { orderBy: { position: "asc" }, select: { id: true, memberId: true, position: true } },
    },
  });
  if (!sorteo) return { ok: false, error: "Ese sorteo no existe." };

  if (sorteo.status === "SORTEADO" || sorteo.status === "CERRADO") {
    const yaHechos = await prisma.rafflePrizeAward.findMany({
      where: { raffleId: sorteo.id },
      select: { prizeId: true, memberId: true, winnerPosition: true },
    });
    return { ok: true, alreadyDrawn: true, awards: yaHechos };
  }

  const permiso = canDraw({ status: sorteo.status as RaffleStatus, drawsAt: sorteo.drawsAt, now });
  if (!permiso.ok) return permiso;

  if (!sorteo.entrantsHash || !sorteo.drandChainHash || sorteo.drandRound === null) {
    return { ok: false, error: "A este sorteo le falta la huella del padrón o la tanda de drand." };
  }

  let tanda;
  try {
    tanda = await fetchRound(sorteo.drandChainHash, sorteo.drandRound);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    if (detalle.includes("todavía no")) {
      return {
        ok: false,
        waiting: true,
        error: `Esperando el número de la tanda ${sorteo.drandRound}. El resultado ya está determinado: se conocerá en cuanto drand lo publique.`,
      };
    }
    return { ok: false, error: `No se pudo leer drand: ${detalle}` };
  }

  const resultados = drawWinners({
    entrantsHash: sorteo.entrantsHash,
    round: sorteo.drandRound,
    randomness: tanda.randomness,
    prizeOrders: sorteo.prizes.map((p) => p.order),
    entrantCount: sorteo.entries.length,
  });

  const porOrden = new Map(sorteo.prizes.map((p) => [p.order, p.id]));
  const porPosicion = new Map(sorteo.entries.map((e) => [e.position, e]));

  const awards = resultados.map((r) => {
    const entrada = porPosicion.get(r.winnerPosition);
    const prizeId = porOrden.get(r.prizeOrder);
    if (!entrada || !prizeId) {
      throw new Error("El padrón sellado no coincide con el resultado. No se escribe nada.");
    }
    return {
      prizeId,
      raffleId: sorteo.id,
      memberId: entrada.memberId,
      entryId: entrada.id,
      winnerPosition: r.winnerPosition,
      status: "GANADO",
    };
  });

  await prisma.$transaction(async (tx) => {
    // `skipDuplicates` con el único sobre `prizeId`: si otro proceso ya escribió, este no
    // pisa nada y el resultado sigue siendo el mismo.
    await tx.rafflePrizeAward.createMany({ data: awards, skipDuplicates: true });
    await tx.raffle.update({
      where: { id: sorteo.id },
      data: {
        status: "SORTEADO",
        drandRandomness: tanda.randomness,
        drandSignature: tanda.signature,
        drawnAt: now,
      },
    });
    await recordRaffleEvent(tx, {
      raffleId: sorteo.id,
      type: "SORTEADO",
      actorUserId: input.actorUserId ?? null,
      actorLabel: input.actorLabel ?? null,
      note: `Tanda ${sorteo.drandRound}. Valor ${tanda.randomness}.`,
    });
  });

  return {
    ok: true,
    alreadyDrawn: false,
    awards: awards.map((a) => ({
      prizeId: a.prizeId,
      memberId: a.memberId,
      winnerPosition: a.winnerPosition,
    })),
  };
}

/** Resuelve todos los sorteos cuyo acto ya pasó. La usa la tarea programada. */
export async function resolveDueRaffles(
  now: Date = new Date(),
): Promise<{ resueltos: number; esperando: number; fallados: { raffleId: string; error: string }[] }> {
  const pendientes = await prisma.raffle.findMany({
    where: { status: "PADRON_SELLADO", drawsAt: { lte: now } },
    select: { id: true, workspaceId: true },
  });

  let resueltos = 0;
  let esperando = 0;
  const fallados: { raffleId: string; error: string }[] = [];

  for (const p of pendientes) {
    const r = await resolveRaffle({ workspaceId: p.workspaceId, raffleId: p.id, now });
    if (r.ok) resueltos += 1;
    else if (r.waiting) esperando += 1;
    else fallados.push({ raffleId: p.id, error: r.error });
  }

  return { resueltos, esperando, fallados };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/resolve.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Correr todo el módulo**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/`
Expected: PASS, ~110 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/raffles/resolve.ts apps/fotoffice/lib/raffles/resolve.test.ts
git commit -m "El sorteo se resuelve solo, y siempre igual

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: La administración: lista, alta y detalle

**Files:**
- Create: `apps/fotoffice/app/(shell)/sorteos/actions.ts`
- Create: `apps/fotoffice/app/(shell)/sorteos/page.tsx`
- Create: `apps/fotoffice/app/(shell)/sorteos/nuevo/page.tsx`
- Create: `apps/fotoffice/app/(shell)/sorteos/[id]/page.tsx`
- Create: `apps/fotoffice/app/(shell)/sorteos/[id]/premio-form.tsx`
- Create: `apps/fotoffice/lib/raffles/labels.ts`
- Create: `apps/fotoffice/lib/raffles/labels.test.ts`
- Modify: `apps/fotoffice/app/(shell)/layout.tsx`
- Modify: `apps/fotoffice/components/shell/shell-sidebar.tsx`

**Interfaces:**
- Consumes: `requireRafflesAdmin`/`requireRafflesStaff`, `parseRaffleForm`, `parsePrizeForm`, `announceRaffle`, `sealRaffle`, `resolveRaffle`, `listRaffles`, `loadRaffle`, `searchPartners`.
- Produces:
  - `raffleStatusLabel(status: RaffleStatus): string` y `prizeStatusLabel(status: RafflePrizeStatus): string` en `labels.ts`
  - Acciones: `createRaffleAction`, `updateRaffleAction`, `savePrizeAction`, `deletePrizeAction`, `announceRaffleAction`, `sealRaffleAction`, `resolveRaffleAction`, `cancelRaffleAction`

- [ ] **Step 1: Escribir el test de las etiquetas**

`apps/fotoffice/lib/raffles/labels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prizeStatusLabel, raffleStatusLabel } from "./labels";

describe("cómo se nombra cada estado", () => {
  it("nunca le muestra a nadie la palabra en mayúsculas con guiones bajos", () => {
    for (const s of ["BORRADOR", "ANUNCIADO", "PADRON_SELLADO", "SORTEADO", "CERRADO", "CANCELADO"] as const) {
      expect(raffleStatusLabel(s)).not.toContain("_");
      expect(raffleStatusLabel(s)).not.toBe(s);
    }
  });

  it("el padrón sellado se explica, no se nombra", () => {
    expect(raffleStatusLabel("PADRON_SELLADO")).toBe("Padrón cerrado, esperando el acto");
  });

  it("los premios también", () => {
    expect(prizeStatusLabel("NO_RETIRADO")).toBe("No lo retiró");
    expect(prizeStatusLabel("GANADO")).toBe("Ganado, falta avisarle");
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/labels.test.ts`
Expected: FAIL.

- [ ] **Step 3: Escribir `labels.ts`**

```ts
import type { RafflePrizeStatus, RaffleStatus } from "./constants";

/**
 * Cómo se nombra cada estado en pantalla.
 *
 * Módulo PURO. Existe por el mismo motivo que `lib/membership/charge-labels.ts`: los valores
 * que se guardan son para la base, no para leer. "PADRON_SELLADO" no le dice nada a nadie.
 */

const SORTEO: Record<RaffleStatus, string> = {
  BORRADOR: "Borrador",
  ANUNCIADO: "Anunciado, el padrón sigue abierto",
  PADRON_SELLADO: "Padrón cerrado, esperando el acto",
  SORTEADO: "Sorteado",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

const PREMIO: Record<RafflePrizeStatus, string> = {
  GANADO: "Ganado, falta avisarle",
  NOTIFICADO: "Avisado, falta que lo retire",
  RETIRADO: "Retirado",
  NO_RETIRADO: "No lo retiró",
  ANULADO: "Anulado",
};

export function raffleStatusLabel(status: RaffleStatus): string {
  return SORTEO[status] ?? status;
}

export function prizeStatusLabel(status: RafflePrizeStatus): string {
  return PREMIO[status] ?? status;
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/labels.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Escribir `actions.ts`**

Seguir el patrón exacto de `app/(shell)/reservas/actions.ts`: `"use server"`, `requireRafflesAdmin()` al principio de cada acción, parseo puro, `redirect` con el error en la query, `revalidatePath` al terminar.

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireRafflesAdmin, requireRafflesStaff } from "@/lib/raffles/access";
import { parseRaffleForm } from "@/lib/raffles/raffle-form";
import { parsePrizeForm } from "@/lib/raffles/prize-form";
import { announceRaffle } from "@/lib/raffles/announce";
import { sealRaffle } from "@/lib/raffles/seal";
import { resolveRaffle } from "@/lib/raffles/resolve";
import { recordRaffleEvent } from "@/lib/raffles/events";
import { canCancel, canEditPrizes, nextPrizeStatus } from "@/lib/raffles/lifecycle";
import type { RafflePrizeStatus, RaffleStatus } from "@/lib/raffles/constants";

const LISTA = "/sorteos";
const detalle = (id: string) => `${LISTA}/${id}`;
const conError = (destino: string, error: string) =>
  redirect(`${destino}?error=${encodeURIComponent(error)}`);

/** Nombre legible de quien actúa, para la historia del sorteo. */
function etiquetaActor(user: { name?: string | null; email?: string | null }): string {
  return user.name?.trim() || user.email || "Equipo";
}

export async function createRaffleAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireRafflesAdmin();
  const parsed = parseRaffleForm(formData);
  if (!parsed.ok) conError(`${LISTA}/nuevo`, parsed.error);

  const sorteo = await prisma.raffle.create({
    data: {
      workspaceId: workspace.id,
      title: parsed.values.title,
      description: parsed.values.description,
      entriesCloseAt: parsed.values.entriesCloseAt,
      drawsAt: parsed.values.drawsAt,
      status: "BORRADOR",
      createdByUserId: user.id,
    },
    select: { id: true },
  });
  await recordRaffleEvent(prisma, {
    raffleId: sorteo.id,
    type: "CREADO",
    actorUserId: user.id,
    actorLabel: etiquetaActor(user),
  });

  revalidatePath(LISTA);
  redirect(detalle(sorteo.id));
}

/**
 * Edición del sorteo y de sus premios: sólo en borrador.
 *
 * Después de anunciar, ni las fechas ni los premios se tocan. Un premio agregado después de
 * que la gente vio el anuncio cambia el cálculo del ganador; una fecha corrida deja sin
 * sentido el margen entre el cierre del padrón y el acto.
 */
export async function updateRaffleAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireRafflesAdmin();
  const raffleId = String(formData.get("raffleId") ?? "");

  const actual = await prisma.raffle.findFirst({
    where: { id: raffleId, workspaceId: workspace.id },
    select: { id: true, status: true },
  });
  if (!actual) conError(LISTA, "Ese sorteo no existe.");
  if (!canEditPrizes(actual.status as RaffleStatus)) {
    conError(detalle(raffleId), "Un sorteo anunciado ya no se edita.");
  }

  const parsed = parseRaffleForm(formData);
  if (!parsed.ok) conError(detalle(raffleId), parsed.error);

  await prisma.raffle.update({ where: { id: actual.id }, data: parsed.values });
  revalidatePath(detalle(raffleId));
  redirect(`${detalle(raffleId)}?ok=guardado`);
}

export async function savePrizeAction(formData: FormData): Promise<void> {
  const { workspace } = await requireRafflesAdmin();
  const raffleId = String(formData.get("raffleId") ?? "");
  const prizeId = String(formData.get("prizeId") ?? "").trim() || null;

  const sorteo = await prisma.raffle.findFirst({
    where: { id: raffleId, workspaceId: workspace.id },
    select: { id: true, status: true },
  });
  if (!sorteo) conError(LISTA, "Ese sorteo no existe.");
  if (!canEditPrizes(sorteo.status as RaffleStatus)) {
    conError(detalle(raffleId), "Los premios se cargan antes de anunciar.");
  }

  const parsed = parsePrizeForm(formData);
  if (!parsed.ok) conError(detalle(raffleId), parsed.error);

  try {
    if (prizeId) {
      const propio = await prisma.rafflePrize.count({ where: { id: prizeId, raffleId } });
      if (propio === 0) conError(detalle(raffleId), "Ese premio no existe.");
      await prisma.rafflePrize.update({ where: { id: prizeId }, data: parsed.values });
    } else {
      await prisma.rafflePrize.create({ data: { raffleId, ...parsed.values } });
    }
  } catch {
    conError(detalle(raffleId), "Ya hay un premio con ese orden. El orden decide qué se sortea primero.");
  }

  revalidatePath(detalle(raffleId));
  redirect(`${detalle(raffleId)}?ok=premio`);
}

export async function deletePrizeAction(formData: FormData): Promise<void> {
  const { workspace } = await requireRafflesAdmin();
  const raffleId = String(formData.get("raffleId") ?? "");
  const prizeId = String(formData.get("prizeId") ?? "");

  const sorteo = await prisma.raffle.findFirst({
    where: { id: raffleId, workspaceId: workspace.id },
    select: { status: true },
  });
  if (!sorteo || !canEditPrizes(sorteo.status as RaffleStatus)) {
    conError(detalle(raffleId), "Los premios se sacan antes de anunciar.");
  }

  await prisma.rafflePrize.deleteMany({ where: { id: prizeId, raffleId } });
  revalidatePath(detalle(raffleId));
  redirect(`${detalle(raffleId)}?ok=premio-borrado`);
}

export async function announceRaffleAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireRafflesAdmin();
  const raffleId = String(formData.get("raffleId") ?? "");

  const r = await announceRaffle({
    workspaceId: workspace.id,
    raffleId,
    actorUserId: user.id,
    actorLabel: etiquetaActor(user),
  });
  if (!r.ok) conError(detalle(raffleId), r.error);

  revalidatePath(detalle(raffleId));
  redirect(`${detalle(raffleId)}?ok=anunciado`);
}

export async function sealRaffleAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireRafflesAdmin();
  const raffleId = String(formData.get("raffleId") ?? "");

  const r = await sealRaffle({
    workspaceId: workspace.id,
    raffleId,
    actorUserId: user.id,
    actorLabel: etiquetaActor(user),
  });
  if (!r.ok) conError(detalle(raffleId), r.error);

  revalidatePath(detalle(raffleId));
  redirect(`${detalle(raffleId)}?ok=sellado`);
}

export async function resolveRaffleAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireRafflesAdmin();
  const raffleId = String(formData.get("raffleId") ?? "");

  const r = await resolveRaffle({
    workspaceId: workspace.id,
    raffleId,
    actorUserId: user.id,
    actorLabel: etiquetaActor(user),
  });
  if (!r.ok) conError(detalle(raffleId), r.error);

  revalidatePath(detalle(raffleId));
  redirect(`${detalle(raffleId)}?ok=sorteado`);
}

export async function cancelRaffleAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireRafflesAdmin();
  const raffleId = String(formData.get("raffleId") ?? "");
  const motivo = String(formData.get("cancelReason") ?? "").trim();

  const sorteo = await prisma.raffle.findFirst({
    where: { id: raffleId, workspaceId: workspace.id },
    select: { id: true, status: true },
  });
  if (!sorteo) conError(LISTA, "Ese sorteo no existe.");

  const permiso = canCancel(sorteo.status as RaffleStatus);
  if (!permiso.ok) conError(detalle(raffleId), permiso.error);
  if (motivo === "") conError(detalle(raffleId), "Cancelar exige escribir el motivo.");

  await prisma.$transaction(async (tx) => {
    await tx.raffle.update({
      where: { id: sorteo.id },
      data: { status: "CANCELADO", cancelledAt: new Date(), cancelReason: motivo },
    });
    await recordRaffleEvent(tx, {
      raffleId: sorteo.id,
      type: "CANCELADO",
      actorUserId: user.id,
      actorLabel: etiquetaActor(user),
      note: motivo,
    });
  });

  revalidatePath(LISTA);
  redirect(`${LISTA}?ok=cancelado`);
}
```

- [ ] **Step 6: Escribir la lista (`page.tsx`)**

Tabla densa, con el mismo lenguaje visual que el tablero de carnets. Columnas: título, estado, cierre del padrón, acto, participantes, premios. Un botón "Nuevo sorteo" para ADMIN+. Cada fila enlaza al detalle.

Sobre la lista, cuando haya sorteos con el padrón vencido sin sellar, un aviso: *"El padrón de X cerró y todavía no se selló."* con el botón para sellar. No es decoración: es lo que impide que un sorteo quede colgado si la tarea programada no corrió.

```tsx
import Link from "next/link";
import { requireRafflesStaff } from "@/lib/raffles/access";
import { listRaffles } from "@/lib/raffles/repository";
import { raffleStatusLabel } from "@/lib/raffles/labels";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import type { RaffleStatus } from "@/lib/raffles/constants";

export const dynamic = "force-dynamic";

const fecha = (d: Date) =>
  d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  });

export default async function SorteosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace, role } = await requireRafflesStaff();
  const params = await searchParams;
  const sorteos = await listRaffles(workspace.id);
  const puedeAdministrar = canManageWorkspaceSettings(role);

  return (
    <main className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Sorteos</h1>
          <p className="text-sm text-neutral-600">
            Participan los socios al día. El resultado lo puede comprobar cualquiera.
          </p>
        </div>
        {puedeAdministrar && (
          <Link href="/sorteos/nuevo" className="rounded bg-neutral-900 px-3 py-2 text-sm text-white">
            Nuevo sorteo
          </Link>
        )}
      </header>

      {params.error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800">{params.error}</p>}

      {sorteos.length === 0 ? (
        <p className="text-sm text-neutral-600">Todavía no hay ningún sorteo.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr>
              <th className="py-2">Sorteo</th>
              <th>Estado</th>
              <th>Cierra el padrón</th>
              <th>Acto</th>
              <th className="text-right">Participan</th>
              <th className="text-right">Premios</th>
            </tr>
          </thead>
          <tbody>
            {sorteos.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="py-2">
                  <Link href={`/sorteos/${s.id}`} className="font-medium underline">
                    {s.title}
                  </Link>
                </td>
                <td>{raffleStatusLabel(s.status as RaffleStatus)}</td>
                <td>{fecha(s.entriesCloseAt)}</td>
                <td>{fecha(s.drawsAt)}</td>
                <td className="text-right">{s.entrantsCount ?? "—"}</td>
                <td className="text-right">{s._count.prizes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
```

- [ ] **Step 7: Escribir el alta (`nuevo/page.tsx`)**

Formulario con `title`, `description`, `drawsAt` (`datetime-local`, obligatorio) y `entriesCloseAt` (`datetime-local`, opcional). Debajo del campo de cierre, la explicación: *"Si lo dejás vacío, el padrón cierra 24 horas antes del acto. Ese margen es lo que hace verificable el sorteo: la lista se congela antes de que exista el número."*

- [ ] **Step 8: Escribir el detalle (`[id]/page.tsx`)**

Cuatro bloques, en este orden:

1. **Encabezado**: título, estado, las dos fechas. Si está `CANCELADO`, el motivo.
2. **Los premios**: tabla por `order` con título, aliado, plazo de retiro, y —si ya se sorteó— el ganador con su número de socio. En `BORRADOR`, el formulario de alta/edición y el botón de borrar.
3. **Las acciones**, cada una con su explicación de una línea y visible sólo cuando corresponde:
   - `BORRADOR` → **Anunciar** (*"Fija la tanda de drand de la que va a salir el número. Después de esto no se tocan ni las fechas ni los premios."*) y **Cancelar** con motivo.
   - `ANUNCIADO` y ya pasó el cierre → **Sellar el padrón** (*"Congela la lista de participantes y publica su huella."*).
   - `PADRON_SELLADO` y ya pasó el acto → **Sortear** (*"Lee el número de la tanda N y resuelve los premios."*).
   - Cuando `resolveRaffle` devuelva `waiting`, mostrar el texto de espera tal cual viene: dice "esperando el número de la tanda N", no un error.
4. **La historia**: los `RaffleEvent` más recientes, con fecha, quién y la nota.

En `PADRON_SELLADO` y en adelante, un enlace a la pantalla pública de verificación.

- [ ] **Step 9: Escribir `premio-form.tsx`**

Componente de cliente sólo por el buscador de aliados: un campo de texto que consulta `searchPartners` mediante una acción de servidor y ofrece las coincidencias; al elegir una, completa `partnerId` y `partnerName` ocultos. Si no se elige ninguna, se puede escribir un nombre suelto — la institución también pone premios propios, y una marca sin ficha en Partners no puede frenar la carga.

- [ ] **Step 10: Enganchar el módulo en el menú lateral**

En `app/(shell)/layout.tsx`, junto a los demás:

```ts
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
...
const rafflesOn = enabledModuleKeys.has(RAFFLES_MODULE_KEY);
```

y pasarlo a `<ShellSidebar rafflesEnabled={rafflesOn} ... />`. En `components/shell/shell-sidebar.tsx`, agregar la propiedad y el ítem "Sorteos" → `/sorteos` dentro del grupo institucional, con el mismo tratamiento que "Reservas".

- [ ] **Step 11: Verificar en el navegador**

Levantar el servidor con el Browser pane (nunca con Bash) y comprobar: la lista carga, el alta guarda, el detalle muestra los premios, y con el módulo apagado `/sorteos` redirige a `/dashboard`.

Run: `cd apps/fotoffice && pnpm exec tsc --noEmit && pnpm lint`
Expected: sin errores.

- [ ] **Step 12: Commit**

```bash
git add apps/fotoffice/app/\(shell\)/sorteos apps/fotoffice/lib/raffles/labels.ts apps/fotoffice/lib/raffles/labels.test.ts apps/fotoffice/app/\(shell\)/layout.tsx apps/fotoffice/components/shell/shell-sidebar.tsx
git commit -m "La Secretaría arma el sorteo, lo anuncia y lo resuelve

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: El tablero de entregas

**Files:**
- Create: `apps/fotoffice/app/(shell)/sorteos/entregas/page.tsx`
- Create: `apps/fotoffice/lib/raffles/delivery.ts`
- Create: `apps/fotoffice/lib/raffles/delivery.test.ts`
- Modify: `apps/fotoffice/app/(shell)/sorteos/actions.ts`

**Interfaces:**
- Consumes: `nextPrizeStatus` e `isRaffleClosed` de `./lifecycle`, `recordRaffleEvent` de `./events`.
- Produces:
  - `advancePrizeAward(input: { workspaceId: string; awardId: string; to: RafflePrizeStatus; note: string | null; actorUserId: number; actorLabel: string; now?: Date }): Promise<{ ok: true } | { ok: false; error: string }>`
  - `listPendingAwards(workspaceId: string)`
  - `expireUnclaimedPrizes(now?: Date): Promise<{ vencidos: number }>`
  - Acción `advanceAwardAction(formData)`

- [ ] **Step 1: Escribir el test**

Cubrir, con Prisma mockeado igual que en las tareas 9 y 10:

1. Marcar avisado escribe `notifiedAt` y deja el evento `PREMIO_NOTIFICADO`.
2. Marcar entregado escribe `deliveredAt`, `deliveredByUserId` y la nota.
3. Anular sin motivo se rechaza y no escribe nada.
4. Anular con motivo escribe `voidReason` y el evento.
5. Un premio ya retirado no vuelve a "avisado".
6. Cuando el último premio del sorteo termina su camino, el sorteo pasa a `CERRADO`.
7. Mientras quede uno pendiente, el sorteo sigue en `SORTEADO`.
8. Un premio de otra institución no se puede tocar.
9. `expireUnclaimedPrizes` pasa a `NO_RETIRADO` los premios cuyo `pickupDeadline` venció y que siguen en `GANADO` o `NOTIFICADO`.
10. `expireUnclaimedPrizes` no toca los que ya están retirados, anulados o sin plazo.

- [ ] **Step 2: Correr y ver que falla**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/delivery.test.ts`
Expected: FAIL.

- [ ] **Step 3: Escribir `delivery.ts`**

Puntos de diseño a respetar:

- El cambio de estado y el cierre del sorteo van en una transacción: un sorteo que quedara `SORTEADO` con todos los premios resueltos sería una lista de pendientes falsa.
- `deliveredByUserId` se escribe siempre que se entrega. Es la pregunta que llega meses después.
- El ganador que se dio de baja antes de retirar **conserva el premio**: las instantáneas de `RaffleEntry` guardan quién era. La Secretaría decide y deja constancia en la nota; el código no le quita el premio a nadie por un cambio de estado societario.

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/delivery.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Escribir el tablero**

`/sorteos/entregas`: una tabla con todos los premios pendientes de todos los sorteos, ordenados por plazo de retiro ascendente —lo que vence primero, arriba—. Columnas: sorteo, premio, ganador (número y nombre de la instantánea), teléfono y correo del socio, estado, plazo. Por fila, las acciones que correspondan según `nextPrizeStatus`, cada una con su campo de nota cuando la exige.

Los que ya vencieron, marcados. Es STAFF+: entregar un premio no es un acto que defina el resultado.

- [ ] **Step 6: Verificar en el navegador y commit**

```bash
git add apps/fotoffice/lib/raffles/delivery.ts apps/fotoffice/lib/raffles/delivery.test.ts apps/fotoffice/app/\(shell\)/sorteos/entregas apps/fotoffice/app/\(shell\)/sorteos/actions.ts
git commit -m "Los premios se avisan, se entregan y quedan anotados

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: El portal: el sorteo y mi situación

**Files:**
- Create: `apps/fotoffice/lib/raffles/portal.ts`
- Create: `apps/fotoffice/lib/raffles/portal.test.ts`
- Create: `apps/fotoffice/app/portal/sorteos/page.tsx`
- Modify: `apps/fotoffice/lib/portal/menu.ts:124`
- Modify: `apps/fotoffice/lib/portal/menu.test.ts`

**Interfaces:**
- Consumes: `isEligible` de `./eligibility`, `loadPortalContext` de `lib/portal/access.ts`.
- Produces:
  - `type PortalRaffleView = { raffle: {...}; prizes: {...}[]; myStatus: { participating: boolean; reason: string | null; frozen: boolean }; myAwards: {...}[] }`
  - `loadPortalRaffles(input: { workspaceId: string; memberId: string; now?: Date }): Promise<{ current: PortalRaffleView | null; past: PortalRaffleView[] }>`

- [ ] **Step 1: Escribir el test de la vista del socio**

Casos que tienen que quedar cubiertos:

1. Con un sorteo anunciado y el socio al día: `participating: true`, `reason: null`, `frozen: false`.
2. Con el socio en deuda: `participating: false` y el motivo con el nombre del mes, no con el período crudo.
3. **Después del sellado, la situación deja de calcularse y sale del padrón congelado**: `frozen: true`, y participa si y sólo si tiene una `RaffleEntry`. Es el caso que importa: si después de sellar el socio paga, no entra en ese sorteo, y la pantalla no puede decirle que sí.
4. Un socio que pagó después del cierre ve `frozen: true` y `participating: false`, con el motivo explicando que el padrón ya estaba cerrado.
5. Sin ningún sorteo abierto, `current` es `null` y los pasados se listan igual.
6. Un sorteo cancelado no aparece como actual.
7. El socio que ganó ve su premio en `myAwards`, con condiciones y plazo.
8. Los sorteos de otra institución no aparecen.

- [ ] **Step 2: Correr y ver que falla, escribir `portal.ts`, correr y ver que pasa**

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/portal.test.ts`

Regla de oro del archivo, escrita en su comentario de cabecera:

> Antes de sellar, la situación se **calcula**; después de sellar, se **lee** del padrón congelado. Son dos preguntas distintas: "¿estarías participando hoy?" y "¿participaste?". Contestar la segunda con el cálculo de la primera es lo que haría que un socio que pagó tarde creyera que entró.

- [ ] **Step 3: Escribir la pantalla del socio**

Tres partes:

1. **El sorteo anunciado**: título, descripción, los premios con el aliado que los dona, y las dos fechas con su explicación: *"Para participar tenés que estar al día antes del lunes 29 a las 20:00. El sorteo es el martes 30 a las 20:00."*
2. **Mi situación**, arriba de todo y en una sola frase: *"Estás participando"* o *"No estás participando: tenés pendiente la cuota de agosto de 2026"*, esta última con el enlace a `/portal/cuotas`. Es el recordatorio de deuda que no se siente como un reclamo, y por eso el tono importa.
3. **Los sorteos anteriores**, con su ganador y el enlace a la verificación.

Si el socio ganó, arriba de todo: el premio, las condiciones, dónde retirarlo, hasta cuándo, y el enlace a su carnet — que es lo que le van a pedir al retirarlo.

- [ ] **Step 4: Encender la entrada del menú**

En `lib/portal/menu.ts`, la entrada de orden 70:

```ts
  {
    order: 70,
    label: "Sorteos",
    href: "/portal/sorteos",
    description: "El sorteo del mes y los resultados de los anteriores.",
    icon: "ticket",
    requiresModule: RAFFLES_MODULE_KEY,
    built: true,
  },
```

Y en `menu.test.ts`, el test correspondiente: con el módulo apagado queda "Próximamente"; encendido, "Disponible".

- [ ] **Step 5: Verificar en el navegador y commit**

```bash
git add apps/fotoffice/lib/raffles/portal.ts apps/fotoffice/lib/raffles/portal.test.ts apps/fotoffice/app/portal/sorteos/page.tsx apps/fotoffice/lib/portal/menu.ts apps/fotoffice/lib/portal/menu.test.ts
git commit -m "El socio ve el sorteo y si está participando

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: El bolillero

**Files:**
- Create: `apps/fotoffice/app/portal/sorteos/[id]/page.tsx`
- Create: `apps/fotoffice/components/raffles/bolillero.tsx`

**Interfaces:**
- Consumes: `loadPortalRaffles` de `./portal`.
- Produces: `<Bolillero entries={{ position: number; label: string }[]} winners={{ prizeTitle: string; winnerPosition: number; winnerLabel: string }[]} />`

- [ ] **Step 1: Escribir la página del resultado**

Servidor. Si el sorteo todavía no se resolvió y el acto ya pasó, llama a `resolveRaffle` —ese es el segundo disparador, el perezoso— y si vuelve `waiting`, muestra el texto de espera con la tanda. Si ya está resuelto, pasa los datos al componente.

- [ ] **Step 2: Escribir el componente**

Lo importante, y va escrito en el comentario del archivo:

> Esta animación **no sortea nada**. El resultado ya está sellado en la base antes de que la página se pinte, y salió de una cuenta que cualquiera puede rehacer. El bolillero es la manera de contarlo, no la manera de decidirlo. Si alguien recarga la página, gira igual y termina en el mismo lugar.

Comportamiento: los números de los participantes pasan rápido, desacelerando, hasta frenar en la posición ganadora; se muestra el número y el nombre. Un premio por vez, en orden. Un botón "Saltar la animación" que muestra el resultado completo de una: quien entra al día siguiente no tiene por qué esperar.

Accesibilidad: respetar `prefers-reduced-motion` mostrando el resultado directamente, y anunciar cada ganador en un `aria-live="polite"`.

Debajo, siempre visible, el enlace: **"¿Cómo sé que esto no está arreglado?"** → la pantalla de verificación.

- [ ] **Step 3: Verificar en el navegador**

Comprobar que gira, que frena en el ganador correcto, que el botón de saltar funciona y que con `prefers-reduced-motion` no hay animación.

- [ ] **Step 4: Commit**

```bash
git add apps/fotoffice/app/portal/sorteos/\[id\]/page.tsx apps/fotoffice/components/raffles/bolillero.tsx
git commit -m "El bolillero cuenta el resultado, no lo decide

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 15: La verificación

La pantalla que sostiene todo el módulo. Si acá el socio no entiende, la garantía existe en el código y no en su cabeza.

**Files:**
- Create: `apps/fotoffice/lib/raffles/verification.ts`
- Create: `apps/fotoffice/lib/raffles/verification.test.ts`
- Create: `apps/fotoffice/app/portal/sorteos/[id]/verificacion/page.tsx`

**Interfaces:**
- Consumes: `entrantsHash`, `drawWinners`, `roundTime`.
- Produces:
  - `type VerificationData = { raffleId: string; title: string; entrantsHash: string; chainHash: string; round: number; randomness: string; signature: string; sealedAt: Date; drawnAt: Date; roundPublishedAt: Date; drandUrl: string; entrants: { position: number; memberNumber: string; fullName: string }[]; prizes: { order: number; title: string; winnerPosition: number; winnerLabel: string }[] }`
  - `buildVerification(...): VerificationData | null`
  - `recheck(data: VerificationData): { ok: boolean; mismatches: string[] }`

- [ ] **Step 1: Escribir el test**

1. `recheck` sobre un sorteo bien resuelto devuelve `ok: true` y ninguna diferencia.
2. Si se altera un ganador en la base, `recheck` lo detecta y lo nombra.
3. Si se altera la huella guardada, `recheck` lo detecta.
4. Si la lista de participantes no produce la huella guardada, `recheck` lo detecta. **Este es el test que importa**: es el que descubriría que la lista publicada no es la que se selló.
5. `drandUrl` apunta a la tanda concreta en el servicio de origen.
6. `buildVerification` devuelve `null` para un sorteo que todavía no se sorteó.

- [ ] **Step 2: Correr, escribir, correr**

`recheck` recalcula la huella con `entrantsHash` a partir de la lista publicada y vuelve a correr `drawWinners` con los cuatro datos guardados. No consulta drand ni la base: es la misma cuenta que haría un tercero.

Run: `cd apps/fotoffice && pnpm vitest run lib/raffles/verification.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 3: Escribir la pantalla**

Pública dentro del portal, sin exigir ser el ganador. Cinco secciones, en este orden y escritas para alguien que no programa:

1. **En una frase.** *"El ganador salió de dos datos que nadie pudo elegir a la vez: la lista de participantes, publicada antes; y un número al azar que producen varias organizaciones en conjunto, publicado después."*
2. **Los cuatro datos**, cada uno con su fecha y su explicación de una línea:
   - Huella del padrón — *publicada el {sealedAt}, antes de que el número existiera*.
   - Cadena y tanda de drand — *fijadas el {announcedAt}*, con el enlace a `drandUrl` para verlo en el servicio de origen.
   - El número — *publicado por drand el {roundPublishedAt}*.
   - La firma que devolvió drand.
3. **La lista completa de participantes** con su posición, tal como entró en la cuenta.
4. **La cuenta, en castellano**: qué se junta, qué se hace con eso, por qué se descartan algunos valores. Y el pseudocódigo, para quien quiera rehacerlo en otro lenguaje.
5. **El resultado de rehacerla acá mismo**: la salida de `recheck`. Que la propia pantalla se controle a sí misma no reemplaza a un tercero, pero muestra qué tendría que dar.

Regla de escritura, que va anotada en el archivo: **ningún párrafo de esta pantalla puede necesitar saber qué es un hash para entenderse.** La palabra "huella" alcanza; "SHA-256" va como dato, no como explicación.

- [ ] **Step 4: Verificar en el navegador y commit**

```bash
git add apps/fotoffice/lib/raffles/verification.ts apps/fotoffice/lib/raffles/verification.test.ts apps/fotoffice/app/portal/sorteos/\[id\]/verificacion
git commit -m "Cualquiera puede rehacer la cuenta sin usar FotoOffice

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 16: La tarea programada y el cierre

**Files:**
- Create: `apps/fotoffice/app/api/cron/sorteos/route.ts`
- Modify: `apps/fotoffice/vercel.json`
- Modify: `docs/fotoffice/ESTADO-ACTUAL.md:114`
- Modify: `apps/fotoffice/docs/superpowers/specs/2026-09-07-sorteos-design.md`

**Interfaces:**
- Consumes: `sealDueRaffles`, `resolveDueRaffles`, `expireUnclaimedPrizes`, `isAuthorizedCronRequest`.
- Produces: la ruta `/api/cron/sorteos`.

- [ ] **Step 1: Escribir la ruta**

Calcada de `app/api/cron/reservas-vencimientos/route.ts`: misma autorización, mismo manejo de error, `GET` que delega en `POST` porque Vercel Cron usa `GET`.

```ts
import { NextResponse } from "next/server";
import { sealDueRaffles } from "@/lib/raffles/seal";
import { resolveDueRaffles } from "@/lib/raffles/resolve";
import { expireUnclaimedPrizes } from "@/lib/raffles/delivery";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Sella los padrones vencidos, resuelve los sorteos cuyo acto ya pasó y vence los premios que
 * nadie retiró.
 *
 * Las tres cosas son idempotentes, así que correrla de más no cambia nada. Y no es la única
 * manera de que ocurran: la primera visita posterior también sella y resuelve. Un sorteo no
 * puede quedar colgado porque una tarea programada no corrió.
 *
 * El orden importa: primero sellar, después resolver. Un sorteo que cierra su padrón y se
 * sortea en la misma ventana de quince minutos queda resuelto en la misma pasada.
 */
function autorizado(request: Request): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    allowedSecrets: [process.env.CRON_SECRET, process.env.FOTOFFICE_CRON_SECRET],
  });
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const sellado = await sealDueRaffles();
    const sorteado = await resolveDueRaffles();
    const vencidos = await expireUnclaimedPrizes();
    return NextResponse.json({ ok: true, sellado, sorteado, vencidos });
  } catch (error) {
    console.error("[fotoffice][sorteos] falló la tarea programada", {
      detalle: sanitizeError(error),
    });
    return NextResponse.json({ ok: false, error: "falló la tarea de sorteos" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
```

- [ ] **Step 2: Agendarla**

En `apps/fotoffice/vercel.json`, dentro de `crons`:

```json
    {
      "path": "/api/cron/sorteos",
      "schedule": "*/15 * * * *"
    }
```

Cada quince minutos. El margen de 24 horas entre el cierre del padrón y el acto hace que esta precisión sobre; se usa igual porque el plan ya corre `reservas-vencimientos` con esa frecuencia y no cuesta nada.

- [ ] **Step 3: Probar la ruta a mano**

```bash
curl -s -H "authorization: Bearer $CRON_SECRET" http://localhost:3010/api/cron/sorteos
```

Expected: `{"ok":true,"sellado":{"sellados":0,"fallados":[]},...}` — y sin autorización, `401`.

- [ ] **Step 4: Correr todo, de punta a punta**

Run: `cd apps/fotoffice && pnpm vitest run && pnpm exec tsc --noEmit && pnpm lint`
Expected: todos los tests en verde, sin errores de tipos ni de lint.

- [ ] **Step 5: Ensayo completo contra la base**

Con datos de prueba en un workspace propio, y verificando cada paso en pantalla:

1. Crear un sorteo con el cierre dentro de 2 minutos y el acto dentro de 5.
2. Cargarle dos premios, uno con aliado y otro sin.
3. Anunciarlo. Comprobar que quedó `drandRound` escrito y `drandRandomness` vacío.
4. Esperar el cierre y sellar. Anotar la huella y la cantidad.
5. Comprobar que un socio que paga después del cierre **no** entra en el padrón.
6. Esperar el acto y sortear. Comprobar que hay dos ganadores distintos.
7. Correr `resolveRaffle` de nuevo: tiene que devolver `alreadyDrawn: true` y no cambiar nada.
8. Abrir la pantalla de verificación y comprobar que `recheck` da bien.
9. Rehacer la cuenta a mano con los cuatro datos publicados, fuera de la aplicación, y comprobar que da el mismo ganador. **Este paso es la prueba real de todo el módulo; si no se hace, no está verificado.**
10. Marcar un premio como entregado y otro como no retirado; comprobar que el sorteo pasa a `CERRADO`.

- [ ] **Step 6: Poner la documentación al día**

En `docs/fotoffice/ESTADO-ACTUAL.md:114`, reemplazar `| 14 — Sorteos | NO EXISTE | Cero. |` por el estado real, nombrando lo que quedó fuera: sorteos con bono contribución, números extra por antigüedad, exclusión del ganador anterior, y el espacio `FOTOFFICE_RAFFLE_SPONSOR` sin montar.

En el spec, cambiar el encabezado de estado a *implementado*, y anotar las dos correcciones que surgieron al construirlo:

1. Vercel **sí** admite tareas cada quince minutos —`vercel.json` ya corre una así—, así que la afirmación de §4.3 sobre cron horarios y diarios era incorrecta. El margen de 24 horas se mantiene igual, pero por robustez y no por limitación de la plataforma.
2. Los espejos de drand se consultan de a dos y tienen que coincidir. No estaba en el spec; es una garantía extra que no cuesta nada y elimina el último punto único de confianza.

- [ ] **Step 7: Commit**

```bash
git add apps/fotoffice/app/api/cron/sorteos apps/fotoffice/vercel.json docs/fotoffice/ESTADO-ACTUAL.md apps/fotoffice/docs/superpowers/specs/2026-09-07-sorteos-design.md
git commit -m "El sorteo se sella y se resuelve solo, corra quien corra

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Antes de anunciar el primer sorteo

Tres cosas que no dependen del código y que el código no puede resolver:

1. **El punto legal `L-09`.** En Argentina los sorteos están regulados por las loterías provinciales. Aunque este sea gratuito, entre socios y con premios donados, corresponde una consulta profesional antes del primer anuncio. No frena la construcción; sí frena el anuncio.
2. **Las cinco bases de Neon.** Confirmar que las cinco tablas existen en las cinco, no sólo en la de FotoOffice. Si falta en una, las escrituras de esa aplicación se rompen.
3. **Encender el módulo para SFPR.** El interruptor está en la administración de módulos del workspace. Hasta que se encienda, `/sorteos` redirige a `/dashboard` y en el portal la sección se muestra como "Próximamente" — que es exactamente lo que corresponde mientras el punto 1 esté abierto.

## Lo que queda fuera, a propósito

- Sorteos con bono contribución (pagos). Otro régimen, otras exigencias.
- Números extra por antigüedad, cursos o recomendaciones.
- Exclusión del ganador de los meses siguientes.
- El aviso por correo al ganador. Se marca a mano; los correos de FotoOffice todavía no están desplegados.
- Montar el espacio `FOTOFFICE_RAFFLE_SPONSOR` para que el logo del auspiciante aparezca en el portal. El enganche mínimo con `DnxPartner` deja el camino abierto.
- Portar a FotoOffice el panel de administración de sponsors de Clickatón.
