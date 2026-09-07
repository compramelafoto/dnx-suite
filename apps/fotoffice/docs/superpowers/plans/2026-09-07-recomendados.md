# Recomendados en FOTOFFICE — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada socio activo tenga un enlace propio para recomendar colegas y que, cuando el recomendado termina de pagar su ingreso, una cuota mensual del recomendante quede bonificada en el porcentaje que fije la institución.

**Architecture:** El descuento se aplica sobre el cargo (`MembershipCharge.balanceArs`) apenas se gana, no en el checkout. Así el circuito de cobro —Mercado Pago y cobro manual— no se toca: ve una cuota que vale menos, y la comisión de plataforma, que se calcula sobre lo imputado, sale correcta sola. Las reglas de plata viven en módulos puros con tests; el acceso a base queda en una capa fina encima.

**Tech Stack:** Next.js (App Router, server actions), Prisma sobre Postgres/Neon, vitest (`pnpm test`, entorno node, sin base), Tailwind con variables `--fo-*`.

**Spec:** `docs/superpowers/specs/2026-09-07-recomendados-design.md`

## Global Constraints

- **Vocabulario obligatorio:** «recomendación», «recomendado», «recomendante», «bonificación». La palabra «referido» NO puede aparecer en código, base, comentarios ni pantallas.
- **Todo el texto de cara al usuario, en español rioplatense.** Comentarios de código en español, explicando el *por qué*, siguiendo el estilo del resto de `lib/membership/`.
- **Plata en centavos enteros** dentro de la lógica; `Decimal` sólo en el borde con la base. Helpers existentes: `decimalArsToMinor` y `minorToDecimalString` en `lib/membership/money.ts`.
- **Cargos elegibles: sólo `concept === "MENSUAL"`.** Nunca `INGRESO`, nunca `OTRO` (credencial impresa y arrastre `APERTURA`).
- **El módulo arranca apagado** (`recommendationEnabled = false`). Con el módulo apagado, nada del comportamiento actual cambia.
- **Nada de lo nuevo puede hacer fallar un pago.** Todo lo que cuelga de `completeApplicationIfPaid` es silencioso: registra en consola y no propaga.
- Tests: `pnpm test` desde `apps/fotoffice`. Los tests no tienen base: la lógica testeable tiene que ser pura.
- Migración Prisma: `packages/db/prisma/migrations/20260907120000_fotoffice_recomendados/migration.sql`, escrita a mano siguiendo el formato de las vecinas.

---

### Task 1: Reglas puras de la bonificación

**Files:**
- Create: `lib/membership/recommendation.ts`
- Test: `lib/membership/recommendation.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type BenefitCharge = { id: string; concept: string; period: string; dueDate: Date; amountMinor: number; balanceMinor: number }`
  - `type BenefitStatus = "PENDIENTE" | "APLICADA" | "ANULADA"`
  - `isBenefitEligibleCharge(charge: { concept: string; period: string; balanceMinor: number }): boolean`
  - `pickChargeForBenefit(charges: BenefitCharge[], excludeChargeIds: readonly string[]): BenefitCharge | null`
  - `benefitDiscountMinor(input: { amountMinor: number; balanceMinor: number; percent: number }): number`
  - `canVoidBenefit(input: { status: BenefitStatus; appliedChargeBalanceMinor: number | null }): { ok: true } | { ok: false; reason: string }`
  - `shouldAwardBenefit(input: { enabled: boolean; percent: number; recommenderMemberId: string | null; recommenderStatus: string | null; newMemberId: string; alreadyAwarded: boolean }): { award: true; percent: number } | { award: false; reason: string }`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `lib/membership/recommendation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  benefitDiscountMinor,
  canVoidBenefit,
  isBenefitEligibleCharge,
  pickChargeForBenefit,
  shouldAwardBenefit,
  type BenefitCharge,
} from "./recommendation";

const CUOTA = 4700000; // $47.000,00

function cargo(period: string, extra: Partial<BenefitCharge> = {}): BenefitCharge {
  const [anio, mes] = period.split("-").map(Number);
  return {
    id: `c-${period}`,
    concept: "MENSUAL",
    period,
    dueDate: new Date(Date.UTC(anio ?? 2026, (mes ?? 1) - 1, 10)),
    amountMinor: CUOTA,
    balanceMinor: CUOTA,
    ...extra,
  };
}

describe("isBenefitEligibleCharge", () => {
  it("acepta una cuota mensual impaga", () => {
    expect(isBenefitEligibleCharge({ concept: "MENSUAL", period: "2026-09", balanceMinor: CUOTA })).toBe(true);
  });

  it("rechaza el ingreso: el beneficio es sobre la cuota, no sobre el alta", () => {
    expect(isBenefitEligibleCharge({ concept: "INGRESO", period: "2026-09", balanceMinor: CUOTA })).toBe(false);
  });

  it("rechaza la credencial impresa y la reimpresión", () => {
    expect(isBenefitEligibleCharge({ concept: "OTRO", period: "TARJETA", balanceMinor: CUOTA })).toBe(false);
    expect(isBenefitEligibleCharge({ concept: "OTRO", period: "TARJETA-2026-09", balanceMinor: CUOTA })).toBe(false);
  });

  it("rechaza el arrastre del sistema anterior", () => {
    expect(isBenefitEligibleCharge({ concept: "OTRO", period: "APERTURA", balanceMinor: CUOTA })).toBe(false);
  });

  it("rechaza una cuota ya cancelada", () => {
    expect(isBenefitEligibleCharge({ concept: "MENSUAL", period: "2026-09", balanceMinor: 0 })).toBe(false);
  });
});

describe("pickChargeForBenefit", () => {
  it("elige la cuota impaga más antigua", () => {
    const elegido = pickChargeForBenefit([cargo("2026-09"), cargo("2026-07"), cargo("2026-08")], []);
    expect(elegido?.id).toBe("c-2026-07");
  });

  it("saltea las cuotas que ya tienen una bonificación: una por cuota", () => {
    const elegido = pickChargeForBenefit([cargo("2026-07"), cargo("2026-08")], ["c-2026-07"]);
    expect(elegido?.id).toBe("c-2026-08");
  });

  it("ignora el ingreso, la credencial y el arrastre", () => {
    const elegido = pickChargeForBenefit(
      [
        cargo("INGRESO-1", { concept: "INGRESO", period: "2026-06" }),
        cargo("APERTURA", { concept: "OTRO", period: "APERTURA" }),
        cargo("2026-08"),
      ],
      [],
    );
    expect(elegido?.id).toBe("c-2026-08");
  });

  it("sin cuotas elegibles devuelve null: la bonificación espera", () => {
    expect(pickChargeForBenefit([cargo("2026-07", { balanceMinor: 0 })], [])).toBeNull();
  });
});

describe("benefitDiscountMinor", () => {
  it("el 100% bonifica la cuota entera, sin centavos perdidos", () => {
    expect(benefitDiscountMinor({ amountMinor: CUOTA, balanceMinor: CUOTA, percent: 100 })).toBe(CUOTA);
  });

  it("el 50% bonifica la mitad", () => {
    expect(benefitDiscountMinor({ amountMinor: CUOTA, balanceMinor: CUOTA, percent: 50 })).toBe(CUOTA / 2);
  });

  it("nunca supera el saldo pendiente: no genera saldo a favor", () => {
    expect(benefitDiscountMinor({ amountMinor: CUOTA, balanceMinor: 1000000, percent: 100 })).toBe(1000000);
  });

  it("redondea hacia abajo, en contra del descuento", () => {
    expect(benefitDiscountMinor({ amountMinor: 333, balanceMinor: 333, percent: 33.33 })).toBe(110);
  });

  it("un porcentaje en cero no descuenta nada", () => {
    expect(benefitDiscountMinor({ amountMinor: CUOTA, balanceMinor: CUOTA, percent: 0 })).toBe(0);
  });
});

describe("canVoidBenefit", () => {
  it("una bonificación pendiente se puede anular", () => {
    expect(canVoidBenefit({ status: "PENDIENTE", appliedChargeBalanceMinor: null })).toEqual({ ok: true });
  });

  it("una aplicada a una cuota impaga se puede anular: el importe vuelve al saldo", () => {
    expect(canVoidBenefit({ status: "APLICADA", appliedChargeBalanceMinor: 1000000 })).toEqual({ ok: true });
  });

  it("una aplicada a una cuota ya pagada NO se puede anular", () => {
    const r = canVoidBenefit({ status: "APLICADA", appliedChargeBalanceMinor: 0 });
    expect(r.ok).toBe(false);
  });

  it("una ya anulada no se vuelve a anular", () => {
    expect(canVoidBenefit({ status: "ANULADA", appliedChargeBalanceMinor: null }).ok).toBe(false);
  });
});

describe("shouldAwardBenefit", () => {
  const base = {
    enabled: true,
    percent: 100,
    recommenderMemberId: "socio-a",
    recommenderStatus: "ACTIVE",
    newMemberId: "socio-b",
    alreadyAwarded: false,
  };

  it("acredita cuando se cumplen todas las condiciones", () => {
    expect(shouldAwardBenefit(base)).toEqual({ award: true, percent: 100 });
  });

  it("con el módulo apagado no acredita nada", () => {
    expect(shouldAwardBenefit({ ...base, enabled: false }).award).toBe(false);
  });

  it("sin recomendante no acredita", () => {
    expect(shouldAwardBenefit({ ...base, recommenderMemberId: null }).award).toBe(false);
  });

  it("si el recomendante está de baja no acredita", () => {
    expect(shouldAwardBenefit({ ...base, recommenderStatus: "INACTIVE" }).award).toBe(false);
  });

  it("nadie se recomienda a sí mismo", () => {
    expect(shouldAwardBenefit({ ...base, recommenderMemberId: "socio-b" }).award).toBe(false);
  });

  it("no acredita dos veces por el mismo socio nuevo", () => {
    expect(shouldAwardBenefit({ ...base, alreadyAwarded: true }).award).toBe(false);
  });

  it("con porcentaje en cero no tiene sentido acreditar", () => {
    expect(shouldAwardBenefit({ ...base, percent: 0 }).award).toBe(false);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
cd apps/fotoffice && pnpm test lib/membership/recommendation.test.ts
```

Esperado: FAIL, «Failed to load .../recommendation.ts».

- [ ] **Step 3: Escribir el módulo**

Crear `lib/membership/recommendation.ts`:

```ts
/**
 * Reglas de la bonificación por recomendar un colega.
 *
 * Módulo PURO: sin base y sin red. Acá vive lo que puede estar mal de formas caras —qué
 * cuota se bonifica, por cuánto, y cuándo se puede deshacer—, así que se verifica sin
 * montar nada.
 *
 * Todo en centavos enteros. Los importes viven en la base como `Decimal`; la conversión
 * pasa en el borde y de acá para adentro no hay coma flotante en la plata.
 */

import { APERTURA_PERIOD, isPrintedCardCharge } from "./charge-labels";

export type BenefitCharge = {
  id: string;
  concept: string;
  /** `YYYY-MM`, o una etiqueta reservada como `APERTURA` o `TARJETA`. */
  period: string;
  dueDate: Date;
  /** Valor original de la cuota, sobre el que se calcula el porcentaje. */
  amountMinor: number;
  /** Saldo pendiente. El descuento nunca puede superarlo. */
  balanceMinor: number;
};

export type BenefitStatus = "PENDIENTE" | "APLICADA" | "ANULADA";

/**
 * ¿Esta cuota puede recibir una bonificación?
 *
 * Sólo las mensuales impagas. El ingreso queda afuera porque el beneficio es sobre la cuota
 * y no sobre el alta; la credencial impresa, porque es un costo real que la institución paga
 * al imprentero; y el arrastre `APERTURA`, porque es deuda traída del sistema anterior y
 * bonificarla mezclaría el beneficio con una migración que ni siquiera reconcilia para todos.
 */
export function isBenefitEligibleCharge(charge: {
  concept: string;
  period: string;
  balanceMinor: number;
}): boolean {
  if (charge.concept !== "MENSUAL") return false;
  if (charge.period === APERTURA_PERIOD) return false;
  if (isPrintedCardCharge(charge.period)) return false;
  return charge.balanceMinor > 0;
}

/**
 * La cuota que recibe la bonificación: la impaga más antigua que todavía no tenga una.
 *
 * **Una bonificación por cuota.** Dos recomendados al 50% dan dos cuotas a mitad de precio,
 * no una gratis: acumularlas obligaría a explicar un saldo compuesto que nadie pidió.
 *
 * Devuelve `null` cuando no hay ninguna elegible. Eso no es un error: la bonificación queda
 * pendiente y se aplica sola sobre la cuota del mes siguiente.
 */
export function pickChargeForBenefit(
  charges: BenefitCharge[],
  excludeChargeIds: readonly string[],
): BenefitCharge | null {
  const excluidos = new Set(excludeChargeIds);
  const elegibles = charges
    .filter((c) => isBenefitEligibleCharge(c) && !excluidos.has(c.id))
    // Por vencimiento y, a igual vencimiento, por período: dos cargos del mismo día tienen
    // que quedar en un orden estable o dos ejecuciones elegirían cuotas distintas.
    .sort((a, b) => {
      const porFecha = a.dueDate.getTime() - b.dueDate.getTime();
      if (porFecha !== 0) return porFecha;
      return a.period.localeCompare(b.period);
    });
  return elegibles[0] ?? null;
}

/**
 * Cuánto se descuenta.
 *
 * El porcentaje se aplica sobre el valor original de la cuota y se acota al saldo pendiente:
 * una cuota pagada a medias se bonifica hasta lo que falta y ni un centavo más. El
 * beneficio nunca genera saldo a favor, porque saldo a favor es dinero, y esto no lo es.
 *
 * Redondeo hacia abajo, en contra del descuento: ante medio centavo en disputa, la
 * diferencia queda del lado de la institución.
 */
export function benefitDiscountMinor(input: {
  amountMinor: number;
  balanceMinor: number;
  percent: number;
}): number {
  if (input.percent <= 0 || input.amountMinor <= 0 || input.balanceMinor <= 0) return 0;
  // El porcentaje admite dos decimales; se lleva a entero antes de multiplicar para no
  // arrastrar el error de la coma flotante hasta los centavos.
  const puntos = Math.round(input.percent * 100);
  const bruto = Math.floor((input.amountMinor * puntos) / 10000);
  return Math.max(0, Math.min(bruto, input.balanceMinor));
}

/**
 * ¿Se puede anular esta bonificación?
 *
 * Anular una aplicada a una cuota **ya pagada** convertiría a un socio al día en deudor de
 * algo que ya pagó. Eso no se hace: si hubo un error, se corrige por fuera, con un ajuste
 * que quede explicado.
 */
export function canVoidBenefit(input: {
  status: BenefitStatus;
  /** Saldo actual de la cuota bonificada. `null` si todavía no se aplicó a ninguna. */
  appliedChargeBalanceMinor: number | null;
}): { ok: true } | { ok: false; reason: string } {
  if (input.status === "ANULADA") {
    return { ok: false, reason: "Esta bonificación ya estaba anulada." };
  }
  if (input.status === "PENDIENTE") return { ok: true };
  if ((input.appliedChargeBalanceMinor ?? 0) <= 0) {
    return {
      ok: false,
      reason: "La cuota bonificada ya fue pagada: anularla dejaría al socio debiendo algo que ya abonó.",
    };
  }
  return { ok: true };
}

/**
 * ¿Corresponde acreditar una bonificación por este socio nuevo?
 *
 * Las seis condiciones juntas, en un solo lugar y sin base de por medio, para que se puedan
 * verificar de a una.
 */
export function shouldAwardBenefit(input: {
  enabled: boolean;
  percent: number;
  recommenderMemberId: string | null;
  recommenderStatus: string | null;
  newMemberId: string;
  alreadyAwarded: boolean;
}): { award: true; percent: number } | { award: false; reason: string } {
  if (!input.enabled) return { award: false, reason: "El módulo de recomendaciones está apagado." };
  if (input.percent <= 0) return { award: false, reason: "El beneficio configurado es de cero." };
  if (!input.recommenderMemberId) return { award: false, reason: "El socio no llegó por una recomendación." };
  if (input.recommenderMemberId === input.newMemberId) {
    return { award: false, reason: "Nadie se recomienda a sí mismo." };
  }
  if (input.recommenderStatus !== "ACTIVE") {
    return { award: false, reason: "Quien lo recomendó ya no es socio activo." };
  }
  if (input.alreadyAwarded) return { award: false, reason: "Este alta ya otorgó su bonificación." };
  return { award: true, percent: input.percent };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
cd apps/fotoffice && pnpm test lib/membership/recommendation.test.ts
```

Esperado: PASS, 22 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/membership/recommendation.ts apps/fotoffice/lib/membership/recommendation.test.ts
git commit -m "Reglas de la cuota bonificada: qué cuota, por cuánto y hasta cuándo se puede deshacer"
```

---

### Task 2: El código del enlace de recomendación

**Files:**
- Create: `lib/membership/recommendation-code.ts`
- Test: `lib/membership/recommendation-code.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `RECOMMENDATION_CODE_LENGTH: 10`
  - `RECOMMENDATION_CODE_ALPHABET: string`
  - `generateRecommendationCode(randomBytes: (n: number) => Uint8Array): string`
  - `normalizeRecommendationCode(raw: string | null | undefined): string | null`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `lib/membership/recommendation-code.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  RECOMMENDATION_CODE_ALPHABET,
  RECOMMENDATION_CODE_LENGTH,
  generateRecommendationCode,
  normalizeRecommendationCode,
} from "./recommendation-code";

/** Bytes previsibles: el test no puede depender del azar. */
function bytesFijos(valores: number[]): (n: number) => Uint8Array {
  return (n) => Uint8Array.from(Array.from({ length: n }, (_, i) => valores[i % valores.length] ?? 0));
}

describe("generateRecommendationCode", () => {
  it("devuelve un código del largo esperado", () => {
    const code = generateRecommendationCode(bytesFijos([0, 1, 2, 3, 4]));
    expect(code).toHaveLength(RECOMMENDATION_CODE_LENGTH);
  });

  it("usa solo el alfabeto sin caracteres ambiguos", () => {
    const code = generateRecommendationCode(bytesFijos([7, 250, 13, 99, 128]));
    for (const ch of code) expect(RECOMMENDATION_CODE_ALPHABET).toContain(ch);
  });

  it("no contiene los caracteres que se confunden al dictarlos", () => {
    for (const ambiguo of ["0", "O", "1", "I", "L"]) {
      expect(RECOMMENDATION_CODE_ALPHABET).not.toContain(ambiguo);
    }
  });
});

describe("normalizeRecommendationCode", () => {
  it("acepta el código tal cual", () => {
    expect(normalizeRecommendationCode("ABCDEFGHJK")).toBe("ABCDEFGHJK");
  });

  it("tolera minúsculas y espacios: se copia y se pega a mano", () => {
    expect(normalizeRecommendationCode("  abcdefghjk  ")).toBe("ABCDEFGHJK");
  });

  it("rechaza un largo distinto", () => {
    expect(normalizeRecommendationCode("ABC")).toBeNull();
  });

  it("rechaza caracteres fuera del alfabeto", () => {
    expect(normalizeRecommendationCode("ABCDEFGHJ0")).toBeNull();
  });

  it("vacío o ausente es null, no un error", () => {
    expect(normalizeRecommendationCode(null)).toBeNull();
    expect(normalizeRecommendationCode("")).toBeNull();
    expect(normalizeRecommendationCode(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
cd apps/fotoffice && pnpm test lib/membership/recommendation-code.test.ts
```

Esperado: FAIL por módulo inexistente.

- [ ] **Step 3: Escribir el módulo**

Crear `lib/membership/recommendation-code.ts`:

```ts
/**
 * El código del enlace de recomendación de un socio.
 *
 * Módulo PURO: recibe la fuente de azar por parámetro para que el resultado se pueda
 * verificar sin depender de `crypto`.
 *
 * El código es **opaco a propósito**. Podría ser el número de socio —más corto y más fácil
 * de dictar—, pero entonces cualquiera podría probar números y atribuirse altas ajenas, o
 * deducir cuántos socios tiene la institución. Un código sin relación con el padrón no
 * revela nada y no se adivina.
 */

/**
 * Sin `0`, `O`, `1`, `I` ni `L`: el enlace se dicta por teléfono y se copia a mano, y esos
 * cinco caracteres son los que se confunden.
 */
export const RECOMMENDATION_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Diez caracteres sobre 31 símbolos: más de 8×10^14 combinaciones. Suficiente y corto. */
export const RECOMMENDATION_CODE_LENGTH = 10;

export function generateRecommendationCode(randomBytes: (n: number) => Uint8Array): string {
  const alfabeto = RECOMMENDATION_CODE_ALPHABET;
  const bytes = randomBytes(RECOMMENDATION_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < RECOMMENDATION_CODE_LENGTH; i++) {
    code += alfabeto[(bytes[i] ?? 0) % alfabeto.length];
  }
  return code;
}

/**
 * Normaliza lo que llega por la URL o pegado en un campo.
 *
 * Devuelve `null` ante cualquier cosa que no tenga forma de código. Quien lo use debe tratar
 * ese `null` como «no vino ninguna recomendación», nunca como un error de la persona: un
 * enlace mal copiado no puede impedirle asociarse.
 */
export function normalizeRecommendationCode(raw: string | null | undefined): string | null {
  const limpio = (raw ?? "").trim().toUpperCase();
  if (limpio.length !== RECOMMENDATION_CODE_LENGTH) return null;
  for (const ch of limpio) {
    if (!RECOMMENDATION_CODE_ALPHABET.includes(ch)) return null;
  }
  return limpio;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
cd apps/fotoffice && pnpm test lib/membership/recommendation-code.test.ts
```

Esperado: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/membership/recommendation-code.ts apps/fotoffice/lib/membership/recommendation-code.test.ts
git commit -m "El código del enlace de recomendación: opaco, corto y sin caracteres que se confundan"
```

---

### Task 3: Base de datos — campos, modelo y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelos `Member`, `MembershipApplication`, `MembershipDuesSettings`; modelo y enum nuevos)
- Create: `packages/db/prisma/migrations/20260907120000_fotoffice_recomendados/migration.sql`

**Interfaces:**
- Consumes: nada.
- Produces: `prisma.membershipRecommendationBenefit`, `Member.recommendationCode`, `Member.recommendedByMemberId`, `MembershipApplication.recommenderMemberId`, `MembershipDuesSettings.recommendationEnabled` y `.recommendationBenefitPercent`.

- [ ] **Step 1: Agregar los campos a `Member`**

En `packages/db/prisma/schema.prisma`, dentro de `model Member`, después de `originInstitution`:

```prisma
  /// Código del enlace de recomendación de este socio. Se genera la primera vez que entra a
  /// la pantalla de recomendaciones: generarlo para los 152 socios de una sola vez llenaría
  /// el padrón de códigos que nadie va a usar.
  recommendationCode    String? @unique
  /// Quién lo recomendó, si se asoció entrando por el enlace de otro socio. Se copia desde la
  /// solicitud al aprobar y queda para siempre en la ficha: ante cualquier eventualidad, la
  /// pregunta «¿quién lo trajo?» se responde sin depender de una solicitud que puede
  /// archivarse.
  recommendedByMemberId String?
```

Y en el bloque de relaciones del mismo modelo, junto a `category`:

```prisma
  /// Autorrelación. SetNull, no Cascade: dar de baja al recomendante no puede borrar la
  /// historia del recomendado.
  recommendedBy   Member?  @relation("MemberRecommendation", fields: [recommendedByMemberId], references: [id], onDelete: SetNull)
  recommendations Member[] @relation("MemberRecommendation")
  /// Bonificaciones ganadas por recomendar, y la que originó su propia alta.
  recommendationBenefits      MembershipRecommendationBenefit[] @relation("BenefitEarner")
  originatedRecommendationBenefit MembershipRecommendationBenefit? @relation("BenefitOrigin")
```

Y un índice, junto a los `@@index` existentes:

```prisma
  @@index([workspaceId, recommendedByMemberId])
```

- [ ] **Step 2: Agregar el campo a `MembershipApplication`**

Dentro de `model MembershipApplication`, inmediatamente después de `presenterMemberId`:

```prisma
  /// Socio que lo recomendó, tomado del enlace por el que entró al formulario.
  ///
  /// NO se reutiliza `presenterMemberId`: ese es el socio que *presenta* al aspirante cuando
  /// el estatuto lo exige, con otro efecto. Compartir columna haría que un requisito
  /// estatutario y un beneficio se pisen.
  recommenderMemberId String?
```

- [ ] **Step 3: Agregar la configuración a `MembershipDuesSettings`**

Dentro de `model MembershipDuesSettings`, después de `alternateWindowMonths`:

```prisma
  /// Módulo de recomendaciones. Apagado por defecto: encenderlo es una decisión de la
  /// comisión directiva, no un default del sistema.
  recommendationEnabled        Boolean @default(false)
  /// Porcentaje de la cuota que se bonifica por cada recomendado que termina de pagar su
  /// ingreso. 100 = una cuota entera.
  recommendationBenefitPercent Decimal @default(100) @db.Decimal(5, 2)
```

- [ ] **Step 4: Agregar el modelo y el enum**

Al final del bloque de modelos de FOTOFFICE, después de `model MemberInvitation`:

```prisma
enum MembershipRecommendationBenefitStatus {
  PENDIENTE
  APLICADA
  ANULADA
}

/// Una cuota bonificada, ganada por recomendar a un colega que se asoció y pagó su ingreso.
///
/// No es dinero ni saldo a favor: es un descuento que se aplica sobre una cuota mensual
/// concreta y no puede salir de ahí.
model MembershipRecommendationBenefit {
  id          String @id @default(cuid())
  workspaceId String
  /// Socio que recomendó y gana la bonificación.
  memberId    String
  /// Socio nuevo que la originó. Único: un alta bonifica una sola vez, aunque el webhook de
  /// Mercado Pago entre dos veces. Esta restricción es el árbitro de la idempotencia.
  originMemberId String @unique

  /// Porcentaje congelado al ganarla: cambiar la configuración no reescribe el pasado.
  percent Decimal                               @db.Decimal(5, 2)
  status  MembershipRecommendationBenefitStatus @default(PENDIENTE)

  /// Cuota sobre la que se aplicó. Único: una cuota recibe una sola bonificación.
  appliedChargeId  String?   @unique
  appliedAmountArs Decimal?  @db.Decimal(12, 2)
  appliedAt        DateTime?

  /// Anulación por la Secretaría. El motivo es obligatorio al anular.
  voidedAt       DateTime?
  voidedByUserId Int?
  voidReason     String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace     Workspace         @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  member        Member            @relation("BenefitEarner", fields: [memberId], references: [id], onDelete: Cascade)
  originMember  Member            @relation("BenefitOrigin", fields: [originMemberId], references: [id], onDelete: Cascade)
  appliedCharge MembershipCharge? @relation(fields: [appliedChargeId], references: [id], onDelete: SetNull)
  voidedBy      User?             @relation("RecommendationBenefitVoider", fields: [voidedByUserId], references: [id], onDelete: SetNull)

  @@index([workspaceId, status])
  @@index([memberId, createdAt])
}
```

En `model Workspace` agregar `recommendationBenefits MembershipRecommendationBenefit[]`; en `model MembershipCharge`, `recommendationBenefit MembershipRecommendationBenefit?`; en `model User`, `voidedRecommendationBenefits MembershipRecommendationBenefit[] @relation("RecommendationBenefitVoider")`.

- [ ] **Step 5: Escribir la migración a mano**

Crear `packages/db/prisma/migrations/20260907120000_fotoffice_recomendados/migration.sql`:

```sql
-- Recomendados: enlace propio de cada socio, vínculo con quien lo trajo y cuota bonificada.

CREATE TYPE "MembershipRecommendationBenefitStatus" AS ENUM ('PENDIENTE', 'APLICADA', 'ANULADA');

ALTER TABLE "Member" ADD COLUMN "recommendationCode" TEXT;
ALTER TABLE "Member" ADD COLUMN "recommendedByMemberId" TEXT;

ALTER TABLE "MembershipApplication" ADD COLUMN "recommenderMemberId" TEXT;

ALTER TABLE "MembershipDuesSettings" ADD COLUMN "recommendationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MembershipDuesSettings" ADD COLUMN "recommendationBenefitPercent" DECIMAL(5,2) NOT NULL DEFAULT 100;

CREATE TABLE "MembershipRecommendationBenefit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "originMemberId" TEXT NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "status" "MembershipRecommendationBenefitStatus" NOT NULL DEFAULT 'PENDIENTE',
    "appliedChargeId" TEXT,
    "appliedAmountArs" DECIMAL(12,2),
    "appliedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" INTEGER,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipRecommendationBenefit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Member_recommendationCode_key" ON "Member"("recommendationCode");
CREATE INDEX "Member_workspaceId_recommendedByMemberId_idx" ON "Member"("workspaceId", "recommendedByMemberId");
CREATE UNIQUE INDEX "MembershipRecommendationBenefit_originMemberId_key" ON "MembershipRecommendationBenefit"("originMemberId");
CREATE UNIQUE INDEX "MembershipRecommendationBenefit_appliedChargeId_key" ON "MembershipRecommendationBenefit"("appliedChargeId");
CREATE INDEX "MembershipRecommendationBenefit_workspaceId_status_idx" ON "MembershipRecommendationBenefit"("workspaceId", "status");
CREATE INDEX "MembershipRecommendationBenefit_memberId_createdAt_idx" ON "MembershipRecommendationBenefit"("memberId", "createdAt");

ALTER TABLE "Member" ADD CONSTRAINT "Member_recommendedByMemberId_fkey" FOREIGN KEY ("recommendedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembershipRecommendationBenefit" ADD CONSTRAINT "MembershipRecommendationBenefit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipRecommendationBenefit" ADD CONSTRAINT "MembershipRecommendationBenefit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipRecommendationBenefit" ADD CONSTRAINT "MembershipRecommendationBenefit_originMemberId_fkey" FOREIGN KEY ("originMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipRecommendationBenefit" ADD CONSTRAINT "MembershipRecommendationBenefit_appliedChargeId_fkey" FOREIGN KEY ("appliedChargeId") REFERENCES "MembershipCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembershipRecommendationBenefit" ADD CONSTRAINT "MembershipRecommendationBenefit_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 6: Validar el schema y regenerar el cliente**

```bash
cd packages/db && pnpm exec prisma validate && pnpm exec prisma generate
```

Esperado: «The schema at prisma/schema.prisma is valid» y el cliente generado sin errores.

- [ ] **Step 7: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260907120000_fotoffice_recomendados
git commit -m "La base guarda quién recomendó a quién y la cuota que eso bonifica"
```

> **Aviso para quien despliegue:** el `schema.prisma` es compartido por las cinco aplicaciones del monorepo y la migración no se aplica sola en las cinco bases de Neon. Aplicarla en las cinco ANTES de desplegar, o las escrituras de las otras aplicaciones fallan.

---

### Task 4: La configuración del módulo

**Files:**
- Modify: `lib/membership/settings.ts`
- Modify: `app/(shell)/members/cuotas/configuracion/forms.tsx`
- Modify: `app/(shell)/members/cuotas/configuracion/page.tsx` y la acción que guarda la configuración (buscarla con `grep -rn "generationDay" app/actions`)
- Create: `lib/membership/recommendation-settings.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `DuesSettings` gana `recommendationEnabled: boolean` y `recommendationBenefitPercent: number`; `parseRecommendationPercent(raw: unknown): { ok: true; value: number } | { ok: false; error: string }` exportado desde `lib/membership/settings.ts`.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/membership/recommendation-settings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_DUES_SETTINGS, parseRecommendationPercent } from "./settings";

describe("configuración de recomendaciones", () => {
  it("el módulo arranca apagado y con la cuota entera como beneficio", () => {
    expect(DEFAULT_DUES_SETTINGS.recommendationEnabled).toBe(false);
    expect(DEFAULT_DUES_SETTINGS.recommendationBenefitPercent).toBe(100);
  });
});

describe("parseRecommendationPercent", () => {
  it("acepta un entero entre 0 y 100", () => {
    expect(parseRecommendationPercent("50")).toEqual({ ok: true, value: 50 });
  });

  it("acepta dos decimales y la coma como separador", () => {
    expect(parseRecommendationPercent("33,33")).toEqual({ ok: true, value: 33.33 });
  });

  it("rechaza más de 100: no se bonifica más que la cuota", () => {
    expect(parseRecommendationPercent("120").ok).toBe(false);
  });

  it("rechaza negativos", () => {
    expect(parseRecommendationPercent("-5").ok).toBe(false);
  });

  it("rechaza lo que no es un número", () => {
    expect(parseRecommendationPercent("mitad").ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd apps/fotoffice && pnpm test lib/membership/recommendation-settings.test.ts
```

Esperado: FAIL, `parseRecommendationPercent is not a function`.

- [ ] **Step 3: Extender `settings.ts`**

En `lib/membership/settings.ts`: agregar a `DEFAULT_DUES_SETTINGS` las claves `recommendationEnabled: false` y `recommendationBenefitPercent: 100`; agregar al tipo `DuesSettings` los campos `recommendationEnabled: boolean` y `recommendationBenefitPercent: number`; agregarlos al `select` y a las dos ramas de retorno de `getDuesSettings` (`recommendationBenefitPercent: Number(row.recommendationBenefitPercent)`, igual que `collaboratorFloorMultiple`).

Y agregar al final del archivo:

```ts
/**
 * Valida el porcentaje que escribe la Secretaría.
 *
 * Tope duro en 100: bonificar más que la cuota dejaría saldo a favor, y el beneficio nunca
 * es dinero. Se acepta la coma como separador decimal porque es lo que se escribe acá.
 */
export function parseRecommendationPercent(
  raw: unknown,
): { ok: true; value: number } | { ok: false; error: string } {
  const texto = String(raw ?? "").trim().replace(",", ".");
  if (!texto) return { ok: false, error: "Escribí el porcentaje de la cuota que se bonifica." };
  const n = Number(texto);
  if (!Number.isFinite(n)) return { ok: false, error: "El porcentaje tiene que ser un número." };
  if (n < 0 || n > 100) return { ok: false, error: "El porcentaje va de 0 a 100." };
  return { ok: true, value: Math.round(n * 100) / 100 };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
cd apps/fotoffice && pnpm test lib/membership/recommendation-settings.test.ts
```

Esperado: PASS, 6 tests.

- [ ] **Step 5: Agregar el bloque en la pantalla de configuración**

En `app/(shell)/members/cuotas/configuracion/forms.tsx`, dentro del formulario de configuración de cuotas y siguiendo exactamente el estilo de los `<label className="space-y-1 text-xs">` existentes, agregar:

```tsx
        <label className="space-y-1 text-xs">
          <span className="text-[var(--fo-muted)]">Recomendaciones</span>
          <span className="flex items-center gap-2">
            <input
              name="recommendationEnabled"
              type="checkbox"
              defaultChecked={defaults.recommendationEnabled}
            />
            <span>Los socios pueden recomendar colegas</span>
          </span>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-[var(--fo-muted)]">Cuota que se bonifica (%)</span>
          <input
            name="recommendationBenefitPercent"
            inputMode="decimal"
            defaultValue={defaults.recommendationBenefitPercent}
            className="fo-input w-full"
          />
          <span className="block text-[var(--fo-muted-soft)]">
            Por cada colega que se asocie y pague su ingreso. 100 = una cuota entera.
          </span>
        </label>
```

En la acción que guarda esta configuración (la que ya lee `generationDay`), leer los dos campos nuevos: el checkbox con `formData.get("recommendationEnabled") === "on"` y el porcentaje con `parseRecommendationPercent`, devolviendo su `error` tal cual si no valida. Guardarlos en el `upsert` de `membershipDuesSettings`.

- [ ] **Step 6: Verificar que compila**

```bash
cd apps/fotoffice && pnpm exec tsc --noEmit -p tsconfig.json
```

Esperado: sin errores.

- [ ] **Step 7: Commit**

```bash
git add apps/fotoffice/lib/membership/settings.ts apps/fotoffice/lib/membership/recommendation-settings.test.ts "apps/fotoffice/app/(shell)/members/cuotas/configuracion" apps/fotoffice/app/actions
git commit -m "La institución decide si hay recomendaciones y cuánto bonifican"
```

---

### Task 5: Capturar la recomendación en el alta

**Files:**
- Create: `lib/membership/recommendation-link.ts`
- Test: `lib/membership/recommendation-link.test.ts`
- Modify: `lib/membership/application.ts` (schema y `ParsedApplication`)
- Modify: `app/w/[workspaceSlug]/asociarse/page.tsx`
- Modify: `components/membership/application-form.tsx`
- Modify: `app/actions/membership-applications.ts` (`submitApplicationAction`)

**Interfaces:**
- Consumes: `normalizeRecommendationCode` (Task 2).
- Produces:
  - `type RecommenderCandidate = { id: string; workspaceId: string; status: string; firstName: string; lastName: string }`
  - `resolveRecommender(input: { rawCode: string | null | undefined; workspaceId: string; candidate: RecommenderCandidate | null }): { memberId: string; displayName: string } | null`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `lib/membership/recommendation-link.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveRecommender, type RecommenderCandidate } from "./recommendation-link";

const socio: RecommenderCandidate = {
  id: "socio-a",
  workspaceId: "ws-sfpr",
  status: "ACTIVE",
  firstName: "Juan",
  lastName: "Pérez",
};

describe("resolveRecommender", () => {
  it("resuelve el socio activo del mismo workspace", () => {
    expect(resolveRecommender({ rawCode: "ABCDEFGHJK", workspaceId: "ws-sfpr", candidate: socio }))
      .toEqual({ memberId: "socio-a", displayName: "Juan Pérez" });
  });

  it("sin código no hay recomendación, y no es un error", () => {
    expect(resolveRecommender({ rawCode: null, workspaceId: "ws-sfpr", candidate: null })).toBeNull();
  });

  it("un código que no existe se ignora en silencio", () => {
    expect(resolveRecommender({ rawCode: "ABCDEFGHJK", workspaceId: "ws-sfpr", candidate: null })).toBeNull();
  });

  it("un código de otra institución no vale", () => {
    expect(
      resolveRecommender({ rawCode: "ABCDEFGHJK", workspaceId: "ws-otra", candidate: socio }),
    ).toBeNull();
  });

  it("el enlace de un socio dado de baja no otorga nada", () => {
    expect(
      resolveRecommender({
        rawCode: "ABCDEFGHJK",
        workspaceId: "ws-sfpr",
        candidate: { ...socio, status: "INACTIVE" },
      }),
    ).toBeNull();
  });

  it("un código con forma inválida se ignora sin mirar el padrón", () => {
    expect(resolveRecommender({ rawCode: "no-es-un-codigo", workspaceId: "ws-sfpr", candidate: socio })).toBeNull();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
cd apps/fotoffice && pnpm test lib/membership/recommendation-link.test.ts
```

Esperado: FAIL por módulo inexistente.

- [ ] **Step 3: Escribir el módulo**

Crear `lib/membership/recommendation-link.ts`:

```ts
/**
 * De un código de enlace al socio que recomienda.
 *
 * Módulo PURO: recibe el candidato ya buscado en la base. La regla —qué código vale y
 * cuál no— se puede verificar sin montar nada, que es donde estaría el error caro:
 * atribuirle un alta al socio equivocado.
 */

import { normalizeRecommendationCode } from "./recommendation-code";

export type RecommenderCandidate = {
  id: string;
  workspaceId: string;
  status: string;
  firstName: string;
  lastName: string;
};

/**
 * Devuelve el recomendante, o `null`.
 *
 * **Nunca falla ruidosamente.** Un enlace viejo, de otra institución o de alguien que ya no
 * es socio no puede impedirle a nadie asociarse: el formulario se muestra igual, sin
 * mensajes de error, y el alta sigue su curso sin recomendación.
 */
export function resolveRecommender(input: {
  rawCode: string | null | undefined;
  workspaceId: string;
  candidate: RecommenderCandidate | null;
}): { memberId: string; displayName: string } | null {
  const code = normalizeRecommendationCode(input.rawCode);
  if (!code) return null;

  const c = input.candidate;
  if (!c) return null;
  if (c.workspaceId !== input.workspaceId) return null;
  if (c.status !== "ACTIVE") return null;

  return { memberId: c.id, displayName: `${c.firstName} ${c.lastName}`.trim() };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
cd apps/fotoffice && pnpm test lib/membership/recommendation-link.test.ts
```

Esperado: PASS, 6 tests.

- [ ] **Step 5: Aceptar el código en la solicitud**

En `lib/membership/application.ts`: agregar al schema de zod, junto a `presenterMemberId`, la línea `recommendationCode: texto(32).optional().nullable(),`; agregar `recommendationCode: string | null;` a `ParsedApplication`; y en el retorno de `parseApplication`, `recommendationCode: nulo(d.recommendationCode),`.

- [ ] **Step 6: Mostrar quién recomienda y llevar el código en el formulario**

En `app/w/[workspaceSlug]/asociarse/page.tsx`: aceptar `searchParams: Promise<{ rec?: string }>` en `Props`, resolver el código y pasarle el resultado al formulario:

```tsx
  const { rec } = await searchParams;
  const code = normalizeRecommendationCode(rec);
  const candidato = code
    ? await prisma.member.findUnique({
        where: { recommendationCode: code },
        select: { id: true, workspaceId: true, status: true, firstName: true, lastName: true },
      })
    : null;
  const recomendante = resolveRecommender({
    rawCode: rec,
    workspaceId: branding.workspaceId,
    candidate: candidato,
  });
```

Pasarle al componente `recommendation={recomendante ? { code: code!, displayName: recomendante.displayName } : null}`.

En `components/membership/application-form.tsx`: agregar la prop `recommendation: { code: string; displayName: string } | null` y, cuando exista, renderizar arriba del formulario el aviso y el campo oculto:

```tsx
      {recommendation ? (
        <>
          <input type="hidden" name="recommendationCode" value={recommendation.code} />
          <p className="fo-card p-4 text-sm">
            Te recomienda <strong>{recommendation.displayName}</strong>. Cuando termines de
            pagar tu ingreso, su próxima cuota va a tener un descuento.
          </p>
        </>
      ) : null}
```

- [ ] **Step 7: Guardar el vínculo en la solicitud**

En `submitApplicationAction` (`app/actions/membership-applications.ts`), después de `parseApplication` y antes del `create`:

```ts
  /*
    El código se resuelve en el servidor, contra el padrón, y nunca se confía en lo que vino
    del navegador. Si no resuelve, la solicitud entra igual sin recomendación: un enlace mal
    copiado no puede dejar a alguien afuera.
  */
  const code = normalizeRecommendationCode(parsed.data.recommendationCode);
  const candidato = code
    ? await prisma.member.findUnique({
        where: { recommendationCode: code },
        select: { id: true, workspaceId: true, status: true, firstName: true, lastName: true },
      })
    : null;
  const recomendante = resolveRecommender({
    rawCode: parsed.data.recommendationCode,
    workspaceId: branding.workspaceId,
    candidate: candidato,
  });

  const { recommendationCode: _code, ...datosSolicitud } = parsed.data;
```

Y cambiar el `create` a:

```ts
  await prisma.membershipApplication.create({
    data: {
      workspaceId: branding.workspaceId,
      ...datosSolicitud,
      recommenderMemberId: recomendante?.memberId ?? null,
    },
    select: { id: true },
  });
```

- [ ] **Step 8: Verificar que todo compila y los tests siguen en verde**

```bash
cd apps/fotoffice && pnpm exec tsc --noEmit -p tsconfig.json && pnpm test
```

Esperado: sin errores de tipos; toda la suite en verde.

- [ ] **Step 9: Commit**

```bash
git add apps/fotoffice/lib/membership/recommendation-link.ts apps/fotoffice/lib/membership/recommendation-link.test.ts apps/fotoffice/lib/membership/application.ts "apps/fotoffice/app/w/[workspaceSlug]/asociarse/page.tsx" apps/fotoffice/components/membership/application-form.tsx apps/fotoffice/app/actions/membership-applications.ts
git commit -m "Quien entra por el enlace de un socio queda vinculado a quien lo recomendó"
```

---

### Task 6: El vínculo queda en la ficha del socio al aprobar

**Files:**
- Modify: `lib/membership/approve.ts`
- Modify: `lib/membership/approve.test.ts`

**Interfaces:**
- Consumes: `MembershipApplication.recommenderMemberId` (Task 3).
- Produces: `ApprovalPlan.member.recommendedByMemberId: string | null`.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `lib/membership/approve.test.ts` (usando el helper de solicitud que ya exista en ese archivo; si se arma la entrada a mano, copiar la forma de los tests vecinos):

```ts
  it("el vínculo con quien lo recomendó pasa de la solicitud a la ficha del socio", () => {
    const plan = buildApproval({
      ...entradaBase(),
      application: { ...solicitudBase(), recommenderMemberId: "socio-a" },
    });
    expect(plan.member.recommendedByMemberId).toBe("socio-a");
  });

  it("sin recomendación, la ficha queda sin vínculo", () => {
    const plan = buildApproval({
      ...entradaBase(),
      application: { ...solicitudBase(), recommenderMemberId: null },
    });
    expect(plan.member.recommendedByMemberId).toBeNull();
  });
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd apps/fotoffice && pnpm test lib/membership/approve.test.ts
```

Esperado: FAIL, `recommendedByMemberId` es `undefined`.

- [ ] **Step 3: Llevar el campo por el plan de aprobación**

En `lib/membership/approve.ts`: agregar `recommenderMemberId?: string | null;` a `ApprovalInput["application"]`; agregar `recommendedByMemberId: string | null;` a `ApprovalPlan["member"]`; y en la construcción del objeto `member`, agregar:

```ts
    // El vínculo se copia acá y no se consulta después contra la solicitud: una solicitud
    // puede archivarse, y la pregunta «¿quién lo trajo?» tiene que poder responderse desde
    // la ficha para siempre.
    recommendedByMemberId: application.recommenderMemberId ?? null,
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
cd apps/fotoffice && pnpm test lib/membership/approve.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/membership/approve.ts apps/fotoffice/lib/membership/approve.test.ts
git commit -m "La ficha del socio guarda quién lo recomendó"
```

---

### Task 7: Acreditar y aplicar la bonificación

**Files:**
- Create: `lib/membership/recommendation-store.ts`
- Modify: `lib/membership/complete-application.ts`
- Modify: `lib/membership/generate-monthly.ts`

**Interfaces:**
- Consumes: `shouldAwardBenefit`, `pickChargeForBenefit`, `benefitDiscountMinor` (Task 1); `getDuesSettings` (Task 4); modelo `MembershipRecommendationBenefit` (Task 3).
- Produces:
  - `awardRecommendationBenefit(newMemberId: string): Promise<{ awarded: boolean; reason?: string }>`
  - `applyPendingBenefits(memberId: string): Promise<{ applied: number }>`
  - `ensureRecommendationCode(memberId: string): Promise<string>`

- [ ] **Step 1: Escribir el módulo de acceso a base**

Crear `lib/membership/recommendation-store.ts`:

```ts
import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { generateRecommendationCode } from "./recommendation-code";
import {
  benefitDiscountMinor,
  pickChargeForBenefit,
  shouldAwardBenefit,
  type BenefitCharge,
} from "./recommendation";
import { getDuesSettings } from "./settings";
import { decimalArsToMinor, minorToDecimalString } from "./money";

/**
 * El código del enlace de este socio, creándolo si todavía no tiene.
 *
 * Se genera cuando el socio entra por primera vez a su pantalla de recomendaciones y no al
 * crear la ficha: generarlo para los 152 socios de una sola vez llenaría el padrón de
 * códigos que nadie va a usar.
 */
export async function ensureRecommendationCode(memberId: string): Promise<string> {
  const actual = await prisma.member.findUnique({
    where: { id: memberId },
    select: { recommendationCode: true },
  });
  if (actual?.recommendationCode) return actual.recommendationCode;

  // Reintentos por si el código sorteado ya existe. Con 31^10 combinaciones la colisión es
  // improbable, pero la restricción única es el único árbitro real y hay que responderle.
  for (let intento = 0; intento < 5; intento++) {
    const code = generateRecommendationCode((n) => new Uint8Array(randomBytes(n)));
    try {
      await prisma.member.update({ where: { id: memberId }, data: { recommendationCode: code } });
      return code;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") continue;
      throw error;
    }
  }
  throw new Error("No se pudo generar un código de recomendación único.");
}

/**
 * Acredita la bonificación al socio que recomendó a este socio nuevo.
 *
 * Se la llama cuando el alta termina de pagarse. **Idempotente:** la restricción única sobre
 * `originMemberId` garantiza una sola bonificación por alta, aunque el webhook de Mercado
 * Pago entre dos veces.
 */
export async function awardRecommendationBenefit(
  newMemberId: string,
): Promise<{ awarded: boolean; reason?: string }> {
  const socioNuevo = await prisma.member.findUnique({
    where: { id: newMemberId },
    select: {
      id: true,
      workspaceId: true,
      recommendedByMemberId: true,
      recommendedBy: { select: { id: true, status: true } },
    },
  });
  if (!socioNuevo) return { awarded: false, reason: "No existe el socio." };

  const settings = await getDuesSettings(socioNuevo.workspaceId);
  const yaOtorgada = await prisma.membershipRecommendationBenefit.findUnique({
    where: { originMemberId: newMemberId },
    select: { id: true },
  });

  const decision = shouldAwardBenefit({
    enabled: settings.recommendationEnabled,
    percent: settings.recommendationBenefitPercent,
    recommenderMemberId: socioNuevo.recommendedByMemberId,
    recommenderStatus: socioNuevo.recommendedBy?.status ?? null,
    newMemberId,
    alreadyAwarded: Boolean(yaOtorgada),
  });
  if (!decision.award) return { awarded: false, reason: decision.reason };

  try {
    await prisma.membershipRecommendationBenefit.create({
      data: {
        workspaceId: socioNuevo.workspaceId,
        memberId: socioNuevo.recommendedByMemberId!,
        originMemberId: newMemberId,
        // Congelado: cambiar la configuración mañana no reescribe lo que ya se ganó.
        percent: decision.percent.toFixed(2),
      },
      select: { id: true },
    });
  } catch (error) {
    // P2002: otra ejecución la creó primero. Es el caso normal ante un webhook repetido.
    if ((error as { code?: string })?.code === "P2002") {
      return { awarded: false, reason: "Ya estaba acreditada." };
    }
    throw error;
  }

  await applyPendingBenefits(socioNuevo.recommendedByMemberId!);
  return { awarded: true };
}

/**
 * Aplica las bonificaciones pendientes de un socio sobre sus cuotas.
 *
 * Se la llama al ganar una bonificación y al generar las cuotas del mes. Si el socio está al
 * día, no hace nada y la bonificación espera: se va a aplicar sola sobre la cuota siguiente.
 *
 * Cada bonificación baja el saldo de UNA cuota. El descuento se calcula sobre el valor
 * original y se acota al saldo, así que nunca deja el saldo en negativo.
 */
export async function applyPendingBenefits(memberId: string): Promise<{ applied: number }> {
  const pendientes = await prisma.membershipRecommendationBenefit.findMany({
    where: { memberId, status: "PENDIENTE" },
    select: { id: true, percent: true },
    orderBy: { createdAt: "asc" },
  });
  if (pendientes.length === 0) return { applied: 0 };

  let aplicadas = 0;

  for (const bonificacion of pendientes) {
    const aplicado = await prisma.$transaction(async (tx) => {
      // Los cargos y las bonificaciones ya usadas se releen dentro de la transacción: entre
      // una vuelta y la siguiente pudo acreditarse un pago o generarse la cuota del mes.
      const filas = await tx.membershipCharge.findMany({
        where: { memberId, balanceArs: { gt: 0 } },
        select: { id: true, concept: true, period: true, dueDate: true, amountArs: true, balanceArs: true },
      });
      const cargos: BenefitCharge[] = filas.map((f) => ({
        id: f.id,
        concept: String(f.concept),
        period: f.period,
        dueDate: f.dueDate,
        amountMinor: decimalArsToMinor(f.amountArs),
        balanceMinor: decimalArsToMinor(f.balanceArs),
      }));

      const yaBonificados = await tx.membershipRecommendationBenefit.findMany({
        where: { memberId, status: "APLICADA", appliedChargeId: { not: null } },
        select: { appliedChargeId: true },
      });

      const cargo = pickChargeForBenefit(
        cargos,
        yaBonificados.map((b) => b.appliedChargeId!),
      );
      if (!cargo) return false;

      const descuento = benefitDiscountMinor({
        amountMinor: cargo.amountMinor,
        balanceMinor: cargo.balanceMinor,
        percent: Number(bonificacion.percent),
      });
      if (descuento <= 0) return false;

      await tx.membershipCharge.update({
        where: { id: cargo.id },
        data: { balanceArs: minorToDecimalString(cargo.balanceMinor - descuento) },
      });

      // El `status` en el where hace idempotente la aplicación: si dos ejecuciones coinciden,
      // la segunda no encuentra nada que actualizar y no vuelve a descontar.
      const marcadas = await tx.membershipRecommendationBenefit.updateMany({
        where: { id: bonificacion.id, status: "PENDIENTE" },
        data: {
          status: "APLICADA",
          appliedChargeId: cargo.id,
          appliedAmountArs: minorToDecimalString(descuento),
          appliedAt: new Date(),
        },
      });
      if (marcadas.count === 0) throw new Error("La bonificación ya había sido aplicada.");

      return true;
    });

    if (aplicado) aplicadas += 1;
    else break; // Sin cuota elegible, las que siguen tampoco la van a encontrar.
  }

  return { applied: aplicadas };
}
```

- [ ] **Step 2: Enganchar la acreditación al cierre del alta**

En `lib/membership/complete-application.ts`, dentro de `completar`, después de que la solicitud pasa a `COMPLETADA` y junto a la emisión del carnet, agregar:

```ts
  /*
    La bonificación de quien lo recomendó nace acá: recién cuando el alta está pagada. Va
    dentro del try/catch general de este módulo, que es silencioso a propósito — un pago
    acreditado es un hecho consumado y no puede deshacerse porque falle una bonificación.
  */
  try {
    await awardRecommendationBenefit(memberId);
  } catch (error) {
    console.error("[fotoffice][recomendaciones] no se pudo acreditar la bonificación", {
      memberId,
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
  }
```

Con el import correspondiente: `import { awardRecommendationBenefit } from "./recommendation-store";`

- [ ] **Step 3: Aplicar las pendientes al generar las cuotas del mes**

En `lib/membership/generate-monthly.ts`, después del bucle que crea los cargos y antes del `return`:

```ts
  /*
    Las bonificaciones pendientes se aplican sobre las cuotas recién creadas.

    Quien ganó una estando al día no tenía dónde aplicarla; esta es esa cuota. Va afuera de la
    creación de cargos y tolera fallas: una bonificación que no se aplica este mes se aplica
    el que viene, pero una cuota que no se genera deja de cobrarse.
  */
  const conPendientes = await prisma.membershipRecommendationBenefit.findMany({
    where: { workspaceId: input.workspaceId, status: "PENDIENTE" },
    select: { memberId: true },
    distinct: ["memberId"],
  });
  for (const { memberId } of conPendientes) {
    try {
      await applyPendingBenefits(memberId);
    } catch (error) {
      console.error("[fotoffice][recomendaciones] no se pudo aplicar la bonificación", {
        memberId,
        detalle: error instanceof Error ? error.message : "error desconocido",
      });
    }
  }
```

Con el import: `import { applyPendingBenefits } from "./recommendation-store";`

- [ ] **Step 4: Verificar tipos y suite**

```bash
cd apps/fotoffice && pnpm exec tsc --noEmit -p tsconfig.json && pnpm test
```

Esperado: sin errores; toda la suite en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/membership/recommendation-store.ts apps/fotoffice/lib/membership/complete-application.ts apps/fotoffice/lib/membership/generate-monthly.ts
git commit -m "Cuando el recomendado paga su ingreso, la cuota del recomendante baja"
```

---

### Task 8: La Secretaría puede anular una bonificación

**Files:**
- Create: `app/actions/recommendations.ts`
- Modify: `lib/membership/recommendation-store.ts` (agregar `voidRecommendationBenefit`)

**Interfaces:**
- Consumes: `canVoidBenefit` (Task 1).
- Produces:
  - `voidRecommendationBenefit(input: { benefitId: string; workspaceId: string; userId: number; reason: string }): Promise<{ ok: true } | { ok: false; error: string }>`
  - `voidRecommendationBenefitAction(prev, formData): Promise<{ error: string | null; ok: string | null }>`

- [ ] **Step 1: Agregar la anulación al store**

En `lib/membership/recommendation-store.ts`:

```ts
/**
 * Anula una bonificación.
 *
 * Si estaba aplicada a una cuota impaga, el importe vuelve al saldo. Si la cuota ya se pagó,
 * se rechaza: revertirla convertiría a un socio al día en deudor de algo que ya abonó.
 */
export async function voidRecommendationBenefit(input: {
  benefitId: string;
  workspaceId: string;
  userId: number;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const motivo = input.reason.trim();
  if (!motivo) return { ok: false, error: "El motivo de la anulación es obligatorio." };

  return prisma.$transaction(async (tx) => {
    const bonificacion = await tx.membershipRecommendationBenefit.findFirst({
      where: { id: input.benefitId, workspaceId: input.workspaceId },
      select: {
        id: true,
        status: true,
        appliedChargeId: true,
        appliedAmountArs: true,
        appliedCharge: { select: { id: true, balanceArs: true } },
      },
    });
    if (!bonificacion) return { ok: false as const, error: "No se encontró la bonificación." };

    const saldo = bonificacion.appliedCharge
      ? decimalArsToMinor(bonificacion.appliedCharge.balanceArs)
      : null;
    const permitido = canVoidBenefit({
      status: bonificacion.status as "PENDIENTE" | "APLICADA" | "ANULADA",
      appliedChargeBalanceMinor: saldo,
    });
    if (!permitido.ok) return { ok: false as const, error: permitido.reason };

    if (bonificacion.appliedCharge && bonificacion.appliedAmountArs) {
      const devuelto = saldo! + decimalArsToMinor(bonificacion.appliedAmountArs);
      await tx.membershipCharge.update({
        where: { id: bonificacion.appliedCharge.id },
        data: { balanceArs: minorToDecimalString(devuelto) },
      });
    }

    const anuladas = await tx.membershipRecommendationBenefit.updateMany({
      where: { id: bonificacion.id, status: { not: "ANULADA" } },
      data: {
        status: "ANULADA",
        voidedAt: new Date(),
        voidedByUserId: input.userId,
        voidReason: motivo,
      },
    });
    if (anuladas.count === 0) return { ok: false as const, error: "Esta bonificación ya estaba anulada." };

    return { ok: true as const };
  });
}
```

Agregar `canVoidBenefit` al import de `./recommendation`.

- [ ] **Step 2: Escribir la server action**

Crear `app/actions/recommendations.ts`, copiando el patrón del guard `requireSecretary` de `app/actions/membership-applications.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { voidRecommendationBenefit } from "@/lib/membership/recommendation-store";

export type RecommendationActionState = { error: string | null; ok: string | null };

/** Anula una bonificación desde la ficha del socio. Sólo la Secretaría. */
export async function voidRecommendationBenefitAction(
  _prev: RecommendationActionState | undefined,
  formData: FormData,
): Promise<RecommendationActionState> {
  const guard = await requireSecretary();
  if (!guard.ok) return { error: guard.error, ok: null };

  const benefitId = formData.get("benefitId")?.toString()?.trim();
  const memberId = formData.get("memberId")?.toString()?.trim();
  const reason = formData.get("reason")?.toString() ?? "";
  if (!benefitId || !memberId) return { error: "Bonificación inválida.", ok: null };

  const r = await voidRecommendationBenefit({
    benefitId,
    workspaceId: guard.workspaceId,
    userId: guard.user.id,
    reason,
  });
  if (!r.ok) return { error: r.error, ok: null };

  revalidatePath(`/members/${memberId}`);
  return { error: null, ok: "Bonificación anulada." };
}
```

`requireSecretary` se extrae a un módulo compartido o se replica siguiendo exactamente el guard existente en `app/actions/membership-applications.ts` (autenticación + `canManageWorkspaceCollection`).

- [ ] **Step 3: Verificar tipos**

```bash
cd apps/fotoffice && pnpm exec tsc --noEmit -p tsconfig.json
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/fotoffice/lib/membership/recommendation-store.ts apps/fotoffice/app/actions/recommendations.ts
git commit -m "La Secretaría puede anular una bonificación mientras la cuota siga impaga"
```

---

### Task 9: El portal del socio — enlace y estado de sus recomendaciones

**Files:**
- Create: `app/portal/recomendados/page.tsx`
- Create: `components/portal/recommendation-link-card.tsx`
- Modify: `app/portal/page.tsx`

**Interfaces:**
- Consumes: `ensureRecommendationCode`, `getDuesSettings`, `loadPortalContext`, `appUrl`.
- Produces: la ruta `/portal/recomendados`.

- [ ] **Step 1: La tarjeta con el enlace**

Crear `components/portal/recommendation-link-card.tsx`, componente cliente con el enlace y un botón «Copiar» (`navigator.clipboard.writeText`), más un enlace `Compartir por WhatsApp` a `https://wa.me/?text=<mensaje codificado>`. Estilo: `fo-card`, botones `fo-btn fo-btn-primary` / `fo-btn fo-btn-secondary`, como el resto del portal.

Texto del mensaje a compartir:

> «Te invito a asociarte a {institución}. Entrá por acá: {enlace}»

- [ ] **Step 2: La pantalla**

Crear `app/portal/recomendados/page.tsx`, siguiendo la estructura de `app/portal/cuotas/page.tsx` (`requireAuth` → `loadPortalContext` → `redirect("/portal")` si no hay contexto, `export const dynamic = "force-dynamic"`). La pantalla:

- Si `settings.recommendationEnabled` es `false`, redirige a `/portal`.
- Llama a `ensureRecommendationCode(context.member.id)` y arma el enlace con `appUrl()` y el `publicSlug` de `FotofficeWorkspaceBranding`.
- Muestra la tarjeta del enlace y, debajo, dos listas: **«Colegas que se asociaron gracias a vos»** (socios con `recommendedByMemberId` igual al suyo, con nombre y fecha de alta) y **«Tus cuotas bonificadas»** (sus `MembershipRecommendationBenefit`, con el estado en palabras: «Esperando tu próxima cuota», «Aplicada a la cuota de septiembre de 2026 · −$47.000,00», «Anulada»).
- Con cero recomendados, un texto que explique el beneficio con el porcentaje configurado, sin listas vacías.

- [ ] **Step 3: La entrada desde el inicio del portal**

En `app/portal/page.tsx`, agregar —sólo si el módulo está encendido— una tarjeta con el título «Recomendá a un colega», una línea explicando el beneficio con el porcentaje vigente, y un `<Link href="/portal/recomendados" className="fo-btn fo-btn-primary text-sm">` que diga «Ver mi enlace».

- [ ] **Step 4: Verificar tipos**

```bash
cd apps/fotoffice && pnpm exec tsc --noEmit -p tsconfig.json
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/app/portal/recomendados apps/fotoffice/components/portal/recommendation-link-card.tsx apps/fotoffice/app/portal/page.tsx
git commit -m "El socio tiene su enlace para recomendar y ve lo que ganó"
```

---

### Task 10: La cuota bonificada se explica sola

**Files:**
- Modify: `app/portal/cuotas/page.tsx`
- Modify: `lib/membership/account.ts`

**Interfaces:**
- Consumes: `MembershipRecommendationBenefit.appliedChargeId` (Task 3).
- Produces: `loadMemberAccount` devuelve, en cada cargo, `benefit: { discountMinor: number; originName: string } | null`.

- [ ] **Step 1: Traer la bonificación con la cuenta del socio**

En `lib/membership/account.ts`, incluir en la consulta las bonificaciones `APLICADA` del socio con su `appliedChargeId`, `appliedAmountArs` y el nombre del socio que la originó (`originMember: { select: { firstName: true, lastName: true } }`), y adjuntarlas al cargo correspondiente en el tipo de retorno.

- [ ] **Step 2: Mostrarla en la lista de cuotas**

En `app/portal/cuotas/page.tsx`, dentro del `<li>` de cada cuota, cuando `c.benefit` exista:

```tsx
                        <p className="text-xs text-[var(--fo-success)]">
                          Bonificada por tu recomendación a {c.benefit.originName} ·{" "}
                          −{formatMinorArs(c.benefit.discountMinor)}
                        </p>
```

- [ ] **Step 3: Verificar tipos y suite**

```bash
cd apps/fotoffice && pnpm exec tsc --noEmit -p tsconfig.json && pnpm test
```

Esperado: sin errores; suite en verde.

- [ ] **Step 4: Commit**

```bash
git add apps/fotoffice/lib/membership/account.ts apps/fotoffice/app/portal/cuotas/page.tsx
git commit -m "La cuota bonificada dice por qué vale menos"
```

---

### Task 11: El panel de la institución muestra el vínculo

**Files:**
- Modify: `app/(shell)/members/solicitudes/page.tsx` y `components/membership/application-card.tsx`
- Modify: `app/(shell)/members/[id]/page.tsx`

**Interfaces:**
- Consumes: `MembershipApplication.recommenderMemberId`, `Member.recommendedByMemberId`, `MembershipRecommendationBenefit` (Task 3); `voidRecommendationBenefitAction` (Task 8).
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: En la solicitud, antes de aprobar**

En la consulta de `app/(shell)/members/solicitudes/page.tsx`, traer el recomendante (`recommenderMemberId` más el `memberNumber`, `firstName` y `lastName` de ese socio) y pasarlo a `ApplicationCard`. En `components/membership/application-card.tsx`, mostrar debajo del nombre:

```tsx
        {item.recommendedBy ? (
          <p className="text-xs text-[var(--fo-muted)]">
            Recomendado por N° {item.recommendedBy.memberNumber} · {item.recommendedBy.fullName}
          </p>
        ) : null}
```

- [ ] **Step 2: En la ficha del socio**

En `app/(shell)/members/[id]/page.tsx`, agregar una `<section className="fo-card space-y-3">` titulada «RECOMENDACIONES» (mismo `<h2>` que las secciones vecinas) con tres cosas:

- **Quién lo recomendó:** nombre y número de socio, o «Se asoció por su cuenta».
- **A quiénes recomendó:** lista de socios con su número y fecha de alta.
- **Bonificaciones:** cada una con su estado en palabras, el importe si está aplicada, y —si `canVoidBenefit` lo permite— un formulario chico con un campo «Motivo» y un botón «Anular» que llama a `voidRecommendationBenefitAction`.

- [ ] **Step 3: Verificar tipos**

```bash
cd apps/fotoffice && pnpm exec tsc --noEmit -p tsconfig.json
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add "apps/fotoffice/app/(shell)/members/solicitudes/page.tsx" apps/fotoffice/components/membership/application-card.tsx "apps/fotoffice/app/(shell)/members/[id]/page.tsx"
git commit -m "El panel muestra quién recomendó a quién y qué bonificó"
```

---

### Task 12: El aviso al recomendante

**Files:**
- Modify: `lib/communications/constants.ts`
- Create: `lib/membership/recommendation-emails.ts`
- Test: `lib/membership/recommendation-emails.test.ts`
- Modify: `lib/membership/recommendation-store.ts` (enviar el aviso al acreditar)

**Interfaces:**
- Consumes: `MEMBERSHIP_EMAIL_KEYS`, `sendAndLogEmail`, `loadWorkspaceEmailContext`.
- Produces: `buildRecommendationEarnedEmail(input: { firstName: string; recommendedName: string; institution: string; percent: number; signature: string }): { subject: string; html: string; text: string }`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/membership/recommendation-emails.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildRecommendationEarnedEmail } from "./recommendation-emails";

const base = {
  firstName: "Juan",
  recommendedName: "Ana Gómez",
  institution: "SFPR",
  percent: 100,
  signature: "Secretaría",
};

describe("buildRecommendationEarnedEmail", () => {
  it("nombra a quien se asoció", () => {
    expect(buildRecommendationEarnedEmail(base).text).toContain("Ana Gómez");
  });

  it("con el 100% dice que la próxima cuota está bonificada entera", () => {
    expect(buildRecommendationEarnedEmail(base).text).toContain("sin cargo");
  });

  it("con un porcentaje parcial lo dice tal cual", () => {
    expect(buildRecommendationEarnedEmail({ ...base, percent: 50 }).text).toContain("50%");
  });

  it("nunca usa la palabra referido", () => {
    const email = buildRecommendationEarnedEmail(base);
    expect(`${email.subject} ${email.text} ${email.html}`.toLowerCase()).not.toContain("referid");
  });

  it("no promete dinero", () => {
    const texto = buildRecommendationEarnedEmail(base).text.toLowerCase();
    expect(texto).not.toContain("cobrar");
    expect(texto).not.toContain("retirar");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd apps/fotoffice && pnpm test lib/membership/recommendation-emails.test.ts
```

Esperado: FAIL por módulo inexistente.

- [ ] **Step 3: Escribir el email**

Crear `lib/membership/recommendation-emails.ts` siguiendo exactamente el estilo de `lib/membership/application-emails.ts` (mismo armado de `subject`, `html` y `text`, misma firma al pie). Asunto: «Tu recomendación se asoció». Cuerpo: le cuenta que la persona que recomendó ya es socia, y que por eso su próxima cuota va **sin cargo** (100%) o **con un 50% de descuento** (parcial). Cierra aclarando que el beneficio se ve reflejado directamente en la cuota.

Agregar a `MEMBERSHIP_EMAIL_KEYS` en `lib/communications/constants.ts`:

```ts
  RECOMMENDATION_EARNED: "fotoffice.membership.recommendation-earned",
```

- [ ] **Step 4: Enviarlo al acreditar**

En `awardRecommendationBenefit` (`lib/membership/recommendation-store.ts`), después de `applyPendingBenefits`, enviar el aviso con `sendAndLogEmail` y `loadWorkspaceEmailContext`, envuelto en su propio `try/catch` que sólo registra en consola: un email que no sale no puede deshacer una bonificación ya acreditada.

- [ ] **Step 5: Correr los tests y verificar que pasan**

```bash
cd apps/fotoffice && pnpm test lib/membership/recommendation-emails.test.ts
```

Esperado: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/membership/recommendation-emails.ts apps/fotoffice/lib/membership/recommendation-emails.test.ts apps/fotoffice/lib/communications/constants.ts apps/fotoffice/lib/membership/recommendation-store.ts
git commit -m "Al socio le avisamos que su recomendación se asoció"
```

---

### Task 13: Verificación final

**Files:**
- Test: toda la suite
- Create: `lib/membership/recommendation-integration.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

- [ ] **Step 1: Escribir el test que fija las dos reglas de plata que cruzan módulos**

Crear `lib/membership/recommendation-integration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { benefitDiscountMinor, pickChargeForBenefit, type BenefitCharge } from "./recommendation";
import { splitMinorByPlatformFee } from "@/lib/platform-fee/fee";
import { selectChargesToPay } from "./select-charges";

const CUOTA = 4700000;

function cargo(period: string, balanceMinor = CUOTA): BenefitCharge {
  const [anio, mes] = period.split("-").map(Number);
  return {
    id: `c-${period}`,
    concept: "MENSUAL",
    period,
    dueDate: new Date(Date.UTC(anio ?? 2026, (mes ?? 1) - 1, 10)),
    amountMinor: CUOTA,
    balanceMinor,
  };
}

describe("la cuota bonificada y el cobro", () => {
  it("la comisión de la plataforma se calcula sobre lo que se paga, no sobre el valor original", () => {
    const descuento = benefitDiscountMinor({ amountMinor: CUOTA, balanceMinor: CUOTA, percent: 50 });
    const aPagar = CUOTA - descuento;

    const conBonificacion = splitMinorByPlatformFee(aPagar, 500);
    const sinBonificacion = splitMinorByPlatformFee(CUOTA, 500);

    expect(conBonificacion.feeMinor).toBeLessThan(sinBonificacion.feeMinor);
  });

  it("una cuota bonificada al 100% desaparece de lo que hay que pagar", () => {
    const descuento = benefitDiscountMinor({ amountMinor: CUOTA, balanceMinor: CUOTA, percent: 100 });
    const abiertos = [
      { id: "c-2026-08", concept: "MENSUAL", period: "2026-08", dueDate: new Date(Date.UTC(2026, 7, 10)), balanceMinor: CUOTA - descuento },
      { id: "c-2026-09", concept: "MENSUAL", period: "2026-09", dueDate: new Date(Date.UTC(2026, 8, 10)), balanceMinor: CUOTA },
    ];
    const r = selectChargesToPay(abiertos, { howMany: "ALL" });
    expect(r.ok && r.selection.totalMinor).toBe(CUOTA);
    expect(r.ok && r.selection.chargeIds).toEqual(["c-2026-09"]);
  });

  it("dos bonificaciones del 50% caen en dos cuotas distintas", () => {
    const cargos = [cargo("2026-08"), cargo("2026-09")];
    const primera = pickChargeForBenefit(cargos, []);
    const segunda = pickChargeForBenefit(cargos, [primera!.id]);
    expect(primera?.id).toBe("c-2026-08");
    expect(segunda?.id).toBe("c-2026-09");
  });
});
```

- [ ] **Step 2: Correr el test**

```bash
cd apps/fotoffice && pnpm test lib/membership/recommendation-integration.test.ts
```

Esperado: PASS, 3 tests. Si `selectChargesToPay` deja de filtrar los saldos en cero, ese test lo va a delatar.

- [ ] **Step 3: Correr toda la suite, el lint y el build**

```bash
cd apps/fotoffice && pnpm test && pnpm lint && pnpm build
```

Esperado: todo verde. Copiar la salida real al informe: no se afirma que pasa sin haberlo visto pasar.

- [ ] **Step 4: Verificar que la palabra prohibida no entró**

```bash
cd apps/fotoffice && grep -rni "referid" app lib components | grep -v node_modules
```

Esperado: sin resultados. (Los documentos de `docs/` quedan afuera: ahí la palabra aparece justamente para prohibirla.)

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/membership/recommendation-integration.test.ts
git commit -m "Queda fijado que la bonificación no le cobra comisión a nadie"
```

---

## Cierre

Antes de desplegar:

1. Aplicar `20260907120000_fotoffice_recomendados` **en las cinco bases de Neon**. El `schema.prisma` es compartido y las otras cuatro aplicaciones fallan si quedan atrás.
2. Encender el módulo desde Cuotas → Configuración y fijar el porcentaje. Sin eso, nada aparece: el módulo arranca apagado a propósito.
