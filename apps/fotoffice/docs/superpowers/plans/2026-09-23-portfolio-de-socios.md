# Portfolio de socios — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada socio arme su portfolio desde el portal y que la institución lo publique en su sitio web, en dos páginas: el directorio y la ficha de cada socio.

**Architecture:** Un módulo `portfolio` encendible por workspace, con dos tablas propias (`FotofficeMemberPortfolio` y `FotofficeMemberPortfolioPhoto`) que no duplican la presencia profesional ya guardada en `Member`. Una única función pura decide si un portfolio está al aire a partir de siete hechos; todas las pantallas la consultan. Las fotos suben directo del navegador a R2 con URL firmada, porque las funciones de Vercel cortan en 4,5 MB, y el servidor verifica el objeto subido antes de registrarlo.

**Tech Stack:** Next.js (App Router, server actions), Prisma sobre Postgres (Neon), Vitest, Cloudflare R2 vía `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, `@dnd-kit` para ordenar arrastrando, Tailwind con las variables `--fo-*`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-09-23-portfolio-de-socios-design.md`

## Global Constraints

- **Todo el texto de cara al usuario, en español rioplatense.** Los identificadores, nombres de archivo y claves técnicas, en inglés, como el resto de la app.
- **La palabra "socio" nunca se escribe fija en pantalla.** Sale del vocabulario del workspace (`loadPersonVocabulary`, `lib/vocabulario/`). Las direcciones sí son fijas.
- **Clave del módulo:** `"portfolio"`. Segmento público: `socios`. Ruta del portal: `/portal/portfolio`. Ruta del panel: `/portfolios`.
- **Tope de fotos por socio: 20.** Constante `PORTFOLIO_MAX_PHOTOS`, validada en el servidor.
- **Umbral de deuda: 3 cargos vencidos.** Constante `PORTFOLIO_OVERDUE_LIMIT`.
- **Ningún id de socio ni de workspace se toma del cliente.** El socio sale de `loadPortalContext(user.id)`; el workspace, de su ficha.
- **Namespace R2:** `fotoffice/member-portfolio/{workspaceId}`. Nunca se borra una key fuera del namespace de FOTOFFICE.
- **Una dependencia nueva rompe otras apps.** Sólo se declara `@aws-sdk/s3-request-presigner`, que ya está resuelta en el lockfile (la usan CompraMeLaFoto y FotoRank) en la misma versión mayor que el SDK que FOTOFFICE ya tiene. No se agrega ninguna otra.
- **Las migraciones se escriben a mano** en `packages/db/prisma/migrations/YYYYMMDDHHMMSS_nombre/migration.sql`. No se corre `prisma migrate dev` contra ninguna base compartida.
- **Los tests se corren siempre desde `apps/fotoffice`** con `pnpm test`. El build de FOTOFFICE chequea tipos **e incluye los tests**: un test roto rompe producción.
- Línea de base al empezar: **263 archivos, 3261 tests, 0 fallas.**

---

## Estructura de archivos

**Módulo nuevo — `apps/fotoffice/lib/portfolio/`**

| Archivo | Responsabilidad |
|---|---|
| `constants.ts` | Clave del módulo, tope de fotos, umbral de deuda, segmento público |
| `visibility.ts` | La función pura que decide si un portfolio está al aire, y por qué no |
| `visibility-labels.ts` | El texto que lee el socio para cada motivo |
| `slug.ts` | Derivación del `publicSlug` con desambiguación |
| `repository.ts` | Lecturas y escrituras del portfolio de un socio (portal) |
| `public-queries.ts` | Las dos lecturas públicas: directorio y ficha |
| `admin-queries.ts` | La lectura del panel de la institución |

**Imágenes — `apps/fotoffice/lib/images/`**

| Archivo | Cambio |
|---|---|
| `presets.ts` | Preset `memberPortfolioPhoto`, y soporte de presets sin proporción forzada |
| `r2-key-policy.ts` | Prefijo `memberPortfolioPhoto` |
| `r2-presign.ts` | **Nuevo.** URL firmada de subida y verificación del objeto subido |

**Acciones y rutas**

| Archivo | Responsabilidad |
|---|---|
| `app/actions/portfolio.ts` | Acciones del socio: registrar, ordenar, destacar, borrar, publicar |
| `app/actions/portfolio-admin.ts` | Acciones de la institución: bajar, publicar igual |
| `app/api/portal/portfolio/upload-url/route.ts` | Devuelve la URL firmada. El archivo no pasa por acá |

**Pantallas**

| Archivo | Responsabilidad |
|---|---|
| `app/portal/portfolio/page.tsx` | La pantalla del socio |
| `components/portal/portfolio/*` | Grilla ordenable, subidor, cartel de estado |
| `app/w/[workspaceSlug]/socios/page.tsx` | El directorio público |
| `app/w/[workspaceSlug]/socios/[portfolioSlug]/page.tsx` | La ficha pública |
| `app/(shell)/portfolios/page.tsx` | El listado del panel |

**Modificados**

| Archivo | Cambio |
|---|---|
| `packages/db/prisma/schema.prisma` | Dos modelos, dos valores de enum, relaciones en `Member` y `Workspace` |
| `apps/fotoffice/lib/modules/registry.ts` | Alta del módulo |
| `apps/fotoffice/lib/website/public-modules.ts` | Entrada de la página pública, con etiqueta por vocabulario |
| `apps/fotoffice/lib/portal/menu.ts` | Entrada del portal |
| `apps/fotoffice/package.json` | `@aws-sdk/s3-request-presigner` |

---

# ETAPA 1 — Base y regla

## Task 1: Constantes y alta del módulo en el catálogo

**Files:**
- Create: `apps/fotoffice/lib/portfolio/constants.ts`
- Modify: `apps/fotoffice/lib/modules/registry.ts`
- Test: `apps/fotoffice/lib/modules/registry.test.ts`

**Interfaces:**
- Produces: `PORTFOLIO_MODULE_KEY = "portfolio"`, `PORTFOLIO_MAX_PHOTOS = 20`, `PORTFOLIO_OVERDUE_LIMIT = 3`, `PORTFOLIO_PUBLIC_SEGMENT = "socios"`

- [x] **Step 1: Escribir el test que falla**

En `apps/fotoffice/lib/modules/registry.test.ts`, agregar:

```ts
it("el módulo portfolio está en el catálogo, disponible y con su ruta", () => {
  const def = getModuleDefinition(PORTFOLIO_MODULE_KEY);
  expect(def).toBeDefined();
  expect(def?.status).toBe("AVAILABLE");
  expect(def?.route).toBe("/portfolios");
  expect(def?.category).toBe("INSTITUTIONAL");
});
```

Agregar el import `import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";` al encabezado del archivo.

- [x] **Step 2: Correr el test y verificar que falla**

Run: `cd apps/fotoffice && pnpm test -- registry`
Expected: FAIL — no resuelve `@/lib/portfolio/constants`.

- [x] **Step 3: Crear las constantes**

`apps/fotoffice/lib/portfolio/constants.ts`:

```ts
/** Misma clave que `WorkspaceFeatureModule.moduleKey`. */
export const PORTFOLIO_MODULE_KEY = "portfolio";

/**
 * Tope de fotos por socio. Se valida en el servidor: un tope que sólo vive en el botón no es
 * un tope.
 */
export const PORTFOLIO_MAX_PHOTOS = 20;

/**
 * Cargos vencidos impagos a partir de los cuales el portfolio deja de mostrarse.
 *
 * Es una aproximación de la regla del estatuto (3 cuotas SEGUIDAS, o 5 alternadas en 24
 * meses), que todavía no está calculada en ningún lado: los umbrales existen en
 * `MembershipDuesSettings` y ningún código los lee. Cuando ese cálculo exista, se cambia la
 * condición dentro de `portfolioVisibility` y nada más.
 */
export const PORTFOLIO_OVERDUE_LIMIT = 3;

/**
 * Segmento bajo `/w/[slug]/`. Fijo a propósito: si siguiera al vocabulario del workspace,
 * cambiar una palabra en Configuración rompería todos los enlaces ya publicados.
 */
export const PORTFOLIO_PUBLIC_SEGMENT = "socios";
```

- [x] **Step 4: Dar de alta el módulo**

En `apps/fotoffice/lib/modules/registry.ts`, agregar el import y la entrada junto a los otros módulos institucionales (antes de `governance`):

```ts
  {
    key: PORTFOLIO_MODULE_KEY,
    label: "Portfolios",
    description:
      "Cada persona arma su galería y la publica en el sitio de la institución: obra, presentación y contacto.",
    category: "INSTITUTIONAL",
    order: 145,
    route: "/portfolios",
    status: "AVAILABLE",
  },
```

- [x] **Step 5: Correr los tests y verificar que pasan**

Run: `cd apps/fotoffice && pnpm test -- registry`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/portfolio/constants.ts apps/fotoffice/lib/modules/registry.ts apps/fotoffice/lib/modules/registry.test.ts
git commit -m "Dar de alta el módulo de portfolios en el catálogo"
```

---

## Task 2: La regla única de visibilidad

Es el corazón del módulo y no toca la base: siete hechos entran, una respuesta sale. Se construye antes que cualquier pantalla porque es lo que después nadie vuelve a mirar.

**Files:**
- Create: `apps/fotoffice/lib/portfolio/visibility.ts`
- Test: `apps/fotoffice/lib/portfolio/visibility.test.ts`

**Interfaces:**
- Consumes: `PORTFOLIO_OVERDUE_LIMIT` (Task 1)
- Produces:
  - `type PortfolioHiddenReason = "MODULE_DISABLED" | "HIDDEN_BY_ADMIN" | "MEMBER_NOT_ACTIVE" | "NO_CONSENT" | "NO_PHOTOS" | "NOT_PUBLISHED_BY_MEMBER" | "OVERDUE_DUES"`
  - `type PortfolioVisibilityFacts = { moduleEnabled: boolean; hiddenByAdminAt: Date | null; memberStatus: "ACTIVE" | "SUSPENDED" | "INACTIVE"; directoryOptIn: boolean; photoCount: number; memberPublished: boolean; overdueCount: number; adminForcePublish: boolean }`
  - `type PortfolioVisibility = { visible: true } | { visible: false; reason: PortfolioHiddenReason }`
  - `function portfolioVisibility(facts: PortfolioVisibilityFacts): PortfolioVisibility`

- [x] **Step 1: Escribir los tests que fallan**

`apps/fotoffice/lib/portfolio/visibility.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { portfolioVisibility, type PortfolioVisibilityFacts } from "./visibility";

/** Un portfolio que cumple las siete condiciones. Cada test rompe una sola. */
const alAire: PortfolioVisibilityFacts = {
  moduleEnabled: true,
  hiddenByAdminAt: null,
  memberStatus: "ACTIVE",
  directoryOptIn: true,
  photoCount: 5,
  memberPublished: true,
  overdueCount: 0,
  adminForcePublish: false,
};

describe("portfolioVisibility", () => {
  it("con las siete condiciones cumplidas, se ve", () => {
    expect(portfolioVisibility(alAire)).toEqual({ visible: true });
  });

  it("módulo apagado: no se ve", () => {
    expect(portfolioVisibility({ ...alAire, moduleEnabled: false })).toEqual({
      visible: false,
      reason: "MODULE_DISABLED",
    });
  });

  it("bajado por la institución: no se ve", () => {
    expect(portfolioVisibility({ ...alAire, hiddenByAdminAt: new Date() })).toEqual({
      visible: false,
      reason: "HIDDEN_BY_ADMIN",
    });
  });

  it("socio dado de baja: no se ve", () => {
    expect(portfolioVisibility({ ...alAire, memberStatus: "INACTIVE" })).toEqual({
      visible: false,
      reason: "MEMBER_NOT_ACTIVE",
    });
  });

  it("socio suspendido: no se ve", () => {
    expect(portfolioVisibility({ ...alAire, memberStatus: "SUSPENDED" })).toEqual({
      visible: false,
      reason: "MEMBER_NOT_ACTIVE",
    });
  });

  it("sin consentimiento: no se ve, aunque el socio lo haya publicado", () => {
    expect(portfolioVisibility({ ...alAire, directoryOptIn: false })).toEqual({
      visible: false,
      reason: "NO_CONSENT",
    });
  });

  it("sin fotos: no se ve", () => {
    expect(portfolioVisibility({ ...alAire, photoCount: 0 })).toEqual({
      visible: false,
      reason: "NO_PHOTOS",
    });
  });

  it("el socio no lo publicó: no se ve", () => {
    expect(portfolioVisibility({ ...alAire, memberPublished: false })).toEqual({
      visible: false,
      reason: "NOT_PUBLISHED_BY_MEMBER",
    });
  });

  it("con 3 cargos vencidos: no se ve", () => {
    expect(portfolioVisibility({ ...alAire, overdueCount: 3 })).toEqual({
      visible: false,
      reason: "OVERDUE_DUES",
    });
  });

  it("con 2 cargos vencidos todavía se ve: el umbral es 3", () => {
    expect(portfolioVisibility({ ...alAire, overdueCount: 2 })).toEqual({ visible: true });
  });

  it("la institución puede publicarlo igual pese a la deuda", () => {
    expect(
      portfolioVisibility({ ...alAire, overdueCount: 9, adminForcePublish: true }),
    ).toEqual({ visible: true });
  });

  it("publicar igual NO saltea nada más que la deuda", () => {
    expect(
      portfolioVisibility({ ...alAire, directoryOptIn: false, adminForcePublish: true }),
    ).toEqual({ visible: false, reason: "NO_CONSENT" });
  });

  it("lo decidido por la institución se informa antes que lo que depende del socio", () => {
    // Le falta todo, pero además la institución lo bajó: decirle "subí una foto" sería mentira.
    expect(
      portfolioVisibility({
        ...alAire,
        hiddenByAdminAt: new Date(),
        directoryOptIn: false,
        photoCount: 0,
        memberPublished: false,
      }),
    ).toEqual({ visible: false, reason: "HIDDEN_BY_ADMIN" });
  });

  it("entre las del socio, primero la que desbloquea: consentimiento, después fotos", () => {
    expect(
      portfolioVisibility({ ...alAire, directoryOptIn: false, photoCount: 0 }),
    ).toEqual({ visible: false, reason: "NO_CONSENT" });
  });

  it("la deuda se informa última: es la más probable de ser un falso positivo", () => {
    expect(
      portfolioVisibility({ ...alAire, photoCount: 0, overdueCount: 5 }),
    ).toEqual({ visible: false, reason: "NO_PHOTOS" });
  });
});
```

- [x] **Step 2: Correr y verificar que falla**

Run: `cd apps/fotoffice && pnpm test -- visibility`
Expected: FAIL — no existe `./visibility`.

- [x] **Step 3: Escribir la implementación**

`apps/fotoffice/lib/portfolio/visibility.ts`:

```ts
import { PORTFOLIO_OVERDUE_LIMIT } from "./constants";

/**
 * La única función que decide si el portfolio de alguien está al aire.
 *
 * Por qué una sola y no un chequeo por pantalla: cuando la regla vive repartida, las
 * pantallas se desincronizan y aparece el caso en que el directorio lista a alguien cuya
 * ficha devuelve 404. Es la misma lección que dejaron los avisos de álbum listo.
 *
 * Devuelve el motivo, no un booleano: el portal necesita decirle al socio qué le falta.
 */

export type PortfolioHiddenReason =
  /** El módulo no está habilitado en esta institución. */
  | "MODULE_DISABLED"
  /** La institución lo bajó, con motivo. */
  | "HIDDEN_BY_ADMIN"
  /** Baja o suspensión. Las dos las decide una persona, nunca el sistema. */
  | "MEMBER_NOT_ACTIVE"
  /** No dio el consentimiento para publicarse. */
  | "NO_CONSENT"
  /** Todavía no subió ninguna foto. */
  | "NO_PHOTOS"
  /** Tiene fotos pero no prendió el interruptor. */
  | "NOT_PUBLISHED_BY_MEMBER"
  /** Figura con cargos vencidos por encima del umbral. */
  | "OVERDUE_DUES";

export type PortfolioVisibilityFacts = {
  moduleEnabled: boolean;
  hiddenByAdminAt: Date | null;
  memberStatus: "ACTIVE" | "SUSPENDED" | "INACTIVE";
  directoryOptIn: boolean;
  photoCount: number;
  memberPublished: boolean;
  /** Cargos vencidos con saldo, tal como los cuenta `lib/membership/balance.ts`. */
  overdueCount: number;
  /** El perdón de deuda que puede dar la institución. No saltea ninguna otra condición. */
  adminForcePublish: boolean;
};

export type PortfolioVisibility =
  | { visible: true }
  | { visible: false; reason: PortfolioHiddenReason };

/**
 * El orden de los chequeos es el orden en que se le informan al socio, y no es caprichoso:
 *
 * 1. Primero lo que decidió la institución. Si alguien bajó el portfolio, decirle al socio
 *    que le falta subir una foto es mentirle.
 * 2. Después lo que el socio puede resolver, empezando por lo que desbloquea todo lo demás.
 * 3. La deuda, al final. Es la condición más probable de ser un falso positivo mientras la
 *    migración del historial de pagos siga incompleta, así que sólo se la menciona cuando ya
 *    no queda nada más por corregir.
 */
export function portfolioVisibility(facts: PortfolioVisibilityFacts): PortfolioVisibility {
  if (!facts.moduleEnabled) return { visible: false, reason: "MODULE_DISABLED" };
  if (facts.hiddenByAdminAt !== null) return { visible: false, reason: "HIDDEN_BY_ADMIN" };
  if (facts.memberStatus !== "ACTIVE") return { visible: false, reason: "MEMBER_NOT_ACTIVE" };
  if (!facts.directoryOptIn) return { visible: false, reason: "NO_CONSENT" };
  if (facts.photoCount < 1) return { visible: false, reason: "NO_PHOTOS" };
  if (!facts.memberPublished) return { visible: false, reason: "NOT_PUBLISHED_BY_MEMBER" };
  if (!facts.adminForcePublish && facts.overdueCount >= PORTFOLIO_OVERDUE_LIMIT) {
    return { visible: false, reason: "OVERDUE_DUES" };
  }
  return { visible: true };
}
```

- [x] **Step 4: Correr y verificar que pasan los 15**

Run: `cd apps/fotoffice && pnpm test -- visibility`
Expected: PASS, 15 tests.

- [x] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/portfolio/visibility.ts apps/fotoffice/lib/portfolio/visibility.test.ts
git commit -m "La regla única que decide si un portfolio está al aire"
```

---

## Task 3: El texto que lee el socio para cada motivo

**Files:**
- Create: `apps/fotoffice/lib/portfolio/visibility-labels.ts`
- Test: `apps/fotoffice/lib/portfolio/visibility-labels.test.ts`

**Interfaces:**
- Consumes: `PortfolioHiddenReason` (Task 2), `PersonVocabulary` de `@/lib/vocabulario/personas`
- Produces: `function hiddenReasonMessage(reason: PortfolioHiddenReason): { title: string; detail: string; action: { label: string; href: string } | null }`

- [x] **Step 1: Escribir el test que falla**

`apps/fotoffice/lib/portfolio/visibility-labels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hiddenReasonMessage } from "./visibility-labels";
import type { PortfolioHiddenReason } from "./visibility";

const TODOS: PortfolioHiddenReason[] = [
  "MODULE_DISABLED",
  "HIDDEN_BY_ADMIN",
  "MEMBER_NOT_ACTIVE",
  "NO_CONSENT",
  "NO_PHOTOS",
  "NOT_PUBLISHED_BY_MEMBER",
  "OVERDUE_DUES",
];

describe("hiddenReasonMessage", () => {
  it("todos los motivos tienen texto: ninguno deja al socio sin explicación", () => {
    for (const reason of TODOS) {
      const m = hiddenReasonMessage(reason);
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.detail.length).toBeGreaterThan(0);
    }
  });

  it("la deuda ofrece ir a la cuenta: es lo único que el socio puede hacer al respecto", () => {
    expect(hiddenReasonMessage("OVERDUE_DUES").action).toEqual({
      label: "Ver mis cuotas",
      href: "/portal/cuotas",
    });
  });

  it("lo que decidió la institución no ofrece ninguna acción al socio", () => {
    expect(hiddenReasonMessage("HIDDEN_BY_ADMIN").action).toBeNull();
    expect(hiddenReasonMessage("MEMBER_NOT_ACTIVE").action).toBeNull();
    expect(hiddenReasonMessage("MODULE_DISABLED").action).toBeNull();
  });

  it("la deuda se explica sin acusar: puede ser un error de la migración", () => {
    const detalle = hiddenReasonMessage("OVERDUE_DUES").detail;
    expect(detalle).toContain("figurás");
    expect(detalle).toContain("Secretaría");
  });
});
```

- [x] **Step 2: Correr y verificar que falla**

Run: `cd apps/fotoffice && pnpm test -- visibility-labels`
Expected: FAIL.

- [x] **Step 3: Escribir la implementación**

`apps/fotoffice/lib/portfolio/visibility-labels.ts`:

```ts
import type { PortfolioHiddenReason } from "./visibility";

export type HiddenReasonMessage = {
  title: string;
  detail: string;
  action: { label: string; href: string } | null;
};

/**
 * Qué lee el socio cuando su portfolio no está al aire.
 *
 * Dos reglas de escritura:
 *
 * 1. **Nunca desaparecer en silencio.** Ver la propia obra fuera del sitio sin explicación es
 *    peor que la causa.
 * 2. **La deuda se informa sin acusar.** La migración del historial de pagos está incompleta
 *    —hay socios al día que figuran debiendo—, así que el texto dice "figurás con" y ofrece
 *    la salida humana, no una acusación.
 */
const MENSAJES: Record<PortfolioHiddenReason, HiddenReasonMessage> = {
  MODULE_DISABLED: {
    title: "Los portfolios no están habilitados",
    detail: "Tu institución todavía no activó esta sección. Lo que cargues queda guardado.",
    action: null,
  },
  HIDDEN_BY_ADMIN: {
    title: "Tu portfolio fue bajado del sitio",
    detail:
      "La administración lo sacó de la web. Tus fotos siguen guardadas. Escribile a la Secretaría para saber por qué.",
    action: null,
  },
  MEMBER_NOT_ACTIVE: {
    title: "Tu portfolio no se está mostrando",
    detail:
      "Tu ficha no figura activa en este momento. Tus fotos siguen guardadas y vuelven a verse apenas se regularice.",
    action: null,
  },
  NO_CONSENT: {
    title: "Falta que autorices la publicación",
    detail:
      "Para que tu portfolio aparezca en el sitio necesitamos que autorices publicar tu nombre y tus datos profesionales. Lo podés dar de baja cuando quieras.",
    action: { label: "Ir a mi perfil", href: "/portal/perfil" },
  },
  NO_PHOTOS: {
    title: "Todavía no subiste ninguna foto",
    detail: "Subí al menos una para que tu portfolio pueda publicarse.",
    action: null,
  },
  NOT_PUBLISHED_BY_MEMBER: {
    title: "Tu portfolio está listo, pero sin publicar",
    detail: "Tenés todo en orden. Prendé el interruptor de abajo para que se vea en el sitio.",
    action: null,
  },
  OVERDUE_DUES: {
    title: "Tu portfolio no se está mostrando",
    detail:
      "Figurás con cuotas vencidas. Si ya las pagaste, avisale a la Secretaría: puede publicarlo igual sin que tengas que hacer nada más.",
    action: { label: "Ver mis cuotas", href: "/portal/cuotas" },
  },
};

export function hiddenReasonMessage(reason: PortfolioHiddenReason): HiddenReasonMessage {
  return MENSAJES[reason];
}
```

- [x] **Step 4: Correr y verificar que pasan**

Run: `cd apps/fotoffice && pnpm test -- visibility-labels`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/portfolio/visibility-labels.ts apps/fotoffice/lib/portfolio/visibility-labels.test.ts
git commit -m "El texto que explica al socio por qué su portfolio no se ve"
```

---

## Task 4: La dirección pública de cada portfolio

**Files:**
- Create: `apps/fotoffice/lib/portfolio/slug.ts`
- Test: `apps/fotoffice/lib/portfolio/slug.test.ts`

**Interfaces:**
- Consumes: `slugify` de `@/lib/slug`
- Produces: `function derivePortfolioSlug(params: { firstName: string; lastName: string; taken: ReadonlySet<string> }): string`

- [x] **Step 1: Escribir los tests que fallan**

`apps/fotoffice/lib/portfolio/slug.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { derivePortfolioSlug } from "./slug";

const sinTomar = new Set<string>();

describe("derivePortfolioSlug", () => {
  it("nombre y apellido, en minúsculas y con guion", () => {
    expect(derivePortfolioSlug({ firstName: "Juan", lastName: "Pérez", taken: sinTomar }))
      .toBe("juan-perez");
  });

  it("saca las tildes y la eñe", () => {
    expect(derivePortfolioSlug({ firstName: "Iñaki", lastName: "Muñoz", taken: sinTomar }))
      .toBe("inaki-munoz");
  });

  it("desambigua con un sufijo cuando ya está tomado", () => {
    expect(
      derivePortfolioSlug({
        firstName: "Juan",
        lastName: "Pérez",
        taken: new Set(["juan-perez"]),
      }),
    ).toBe("juan-perez-2");
  });

  it("sigue subiendo el sufijo mientras siga tomado", () => {
    expect(
      derivePortfolioSlug({
        firstName: "Juan",
        lastName: "Pérez",
        taken: new Set(["juan-perez", "juan-perez-2", "juan-perez-3"]),
      }),
    ).toBe("juan-perez-4");
  });

  it("un nombre que no deja ninguna letra usable no rompe: cae en 'socio'", () => {
    expect(derivePortfolioSlug({ firstName: "***", lastName: "///", taken: sinTomar }))
      .toBe("socio");
  });

  it("y ese caso degradado también desambigua", () => {
    expect(
      derivePortfolioSlug({ firstName: "***", lastName: "///", taken: new Set(["socio"]) }),
    ).toBe("socio-2");
  });
});
```

- [x] **Step 2: Correr y verificar que falla**

Run: `cd apps/fotoffice && pnpm test -- portfolio/slug`
Expected: FAIL.

- [x] **Step 3: Escribir la implementación**

`apps/fotoffice/lib/portfolio/slug.ts`:

```ts
import { slugify } from "@/lib/slug";

/**
 * La dirección pública de un portfolio: `/w/{institución}/socios/juan-perez`.
 *
 * Se calcula UNA sola vez, al crear el portfolio, y no vuelve a cambiar aunque el socio
 * cambie de apellido: una dirección publicada que deja de funcionar es un enlace roto en el
 * sitio de otro.
 *
 * No se usa el número de socio. Expone el padrón y no le dice nada a quien llega.
 */
export function derivePortfolioSlug(params: {
  firstName: string;
  lastName: string;
  taken: ReadonlySet<string>;
}): string {
  const base = slugify(`${params.firstName} ${params.lastName}`) || "socio";
  if (!params.taken.has(base)) return base;

  // Arranca en 2: el primero no lleva sufijo, así que el segundo homónimo es el 2.
  let n = 2;
  while (params.taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
```

- [x] **Step 4: Correr y verificar que pasan**

Run: `cd apps/fotoffice && pnpm test -- portfolio/slug`
Expected: PASS, 6 tests.

- [x] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/portfolio/slug.ts apps/fotoffice/lib/portfolio/slug.test.ts
git commit -m "La dirección pública de cada portfolio"
```

---

## Task 5: Las tablas y su migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260923120000_fotoffice_member_portfolio/migration.sql`

**Interfaces:**
- Produces: `prisma.fotofficeMemberPortfolio`, `prisma.fotofficeMemberPortfolioPhoto`, y los valores `PORTFOLIO_HIDDEN` / `PORTFOLIO_RESTORED` de `MemberAuditAction`

- [x] **Step 1: Agregar los modelos al schema**

En `packages/db/prisma/schema.prisma`, después de `model MemberAudit`:

```prisma
/// El portfolio de un socio: una galería, con una foto destacada.
///
/// NO guarda la presencia profesional (presentación, especialidades, redes, sitio): eso vive
/// en `Member` desde el alta y se lee de ahí. Duplicarlo sería garantizar que algún día digan
/// cosas distintas.
model FotofficeMemberPortfolio {
  id          String @id @default(cuid())
  workspaceId String
  memberId    String @unique

  /// Dirección pública: `/w/{slug}/socios/{publicSlug}`. Se calcula al crear y NO se
  /// recalcula si el socio cambia de apellido — una dirección publicada que deja de funcionar
  /// es un enlace roto en el sitio de otro.
  publicSlug String

  /// El interruptor del socio. Arranca apagado: tener un portfolio y publicarlo son dos actos
  /// distintos.
  memberPublished   Boolean   @default(false)
  memberPublishedAt DateTime?

  /// La foto que representa al socio en el directorio. SetNull: si se borra esa foto el
  /// portfolio sigue existiendo y la destacada pasa a ser la primera que quede.
  coverPhotoId String? @unique

  /// La bajada de la institución. Los tres campos van juntos: nunca se baja sin motivo.
  hiddenByAdminAt     DateTime?
  hiddenByAdminUserId Int?
  hiddenReason        String?

  /// El perdón de deuda. Saltea SOLO la condición de cargos vencidos, ninguna otra — ver
  /// `lib/portfolio/visibility.ts`. Existe porque la migración del historial de pagos está
  /// incompleta y hay socios al día que figuran debiendo: una regla automática sin forma
  /// humana de contradecirla es una trampa.
  adminForcePublish Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace     Workspace                       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  member        Member                          @relation(fields: [memberId], references: [id], onDelete: Cascade)
  hiddenByUser  User?                           @relation("PortfolioHiddenBy", fields: [hiddenByAdminUserId], references: [id], onDelete: SetNull)
  photos        FotofficeMemberPortfolioPhoto[] @relation("PortfolioPhotos")
  coverPhoto    FotofficeMemberPortfolioPhoto?  @relation("PortfolioCoverPhoto", fields: [coverPhotoId], references: [id], onDelete: SetNull)

  /// Dos socios de la misma institución no pueden compartir dirección. Dos de instituciones
  /// distintas sí: las direcciones viven bajo `/w/{slug}/`.
  @@unique([workspaceId, publicSlug])
  @@index([workspaceId])
}

/// Una foto del portfolio de un socio.
model FotofficeMemberPortfolioPhoto {
  id          String @id @default(cuid())
  portfolioId String

  /// Key dentro del bucket compartido del monorepo, bajo `fotoffice/member-portfolio/`.
  r2Key       String
  url         String
  contentType String
  sizeBytes   Int
  /// Se guardan para reservar el espacio de cada foto antes de que cargue: sin esto la
  /// galería salta mientras se arma.
  width       Int
  height      Int

  /// El orden que eligió el socio. Denso dentro de un portfolio, arranca en 0.
  order Int
  title String?
  year  Int?

  createdAt DateTime @default(now())

  portfolio  FotofficeMemberPortfolio  @relation("PortfolioPhotos", fields: [portfolioId], references: [id], onDelete: Cascade)
  coverOf    FotofficeMemberPortfolio? @relation("PortfolioCoverPhoto")

  @@index([portfolioId, order])
}
```

En `model Member`, agregar a las relaciones:

```prisma
  portfolio FotofficeMemberPortfolio?
```

En `model Workspace`, agregar:

```prisma
  memberPortfolios FotofficeMemberPortfolio[]
```

En `model User`, agregar:

```prisma
  portfoliosHidden FotofficeMemberPortfolio[] @relation("PortfolioHiddenBy")
```

En `enum MemberAuditAction`, agregar al final:

```prisma
  /// La institución bajó el portfolio del sitio. Exige motivo, como la suspensión y la baja.
  PORTFOLIO_HIDDEN
  /// La institución lo volvió a publicar, o lo publicó pese a la deuda.
  PORTFOLIO_RESTORED
```

- [x] **Step 2: Escribir la migración a mano**

`packages/db/prisma/migrations/20260923120000_fotoffice_member_portfolio/migration.sql`:

```sql
-- Portfolio de socios de FOTOFFICE.
-- Se escribe a mano: `prisma migrate dev` no se corre contra ninguna base compartida.

ALTER TYPE "MemberAuditAction" ADD VALUE IF NOT EXISTS 'PORTFOLIO_HIDDEN';
ALTER TYPE "MemberAuditAction" ADD VALUE IF NOT EXISTS 'PORTFOLIO_RESTORED';

CREATE TABLE "FotofficeMemberPortfolio" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "memberPublished" BOOLEAN NOT NULL DEFAULT false,
    "memberPublishedAt" TIMESTAMP(3),
    "coverPhotoId" TEXT,
    "hiddenByAdminAt" TIMESTAMP(3),
    "hiddenByAdminUserId" INTEGER,
    "hiddenReason" TEXT,
    "adminForcePublish" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeMemberPortfolio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FotofficeMemberPortfolioPhoto" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT,
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeMemberPortfolioPhoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotofficeMemberPortfolio_memberId_key" ON "FotofficeMemberPortfolio"("memberId");
CREATE UNIQUE INDEX "FotofficeMemberPortfolio_coverPhotoId_key" ON "FotofficeMemberPortfolio"("coverPhotoId");
CREATE UNIQUE INDEX "FotofficeMemberPortfolio_workspaceId_publicSlug_key" ON "FotofficeMemberPortfolio"("workspaceId", "publicSlug");
CREATE INDEX "FotofficeMemberPortfolio_workspaceId_idx" ON "FotofficeMemberPortfolio"("workspaceId");
CREATE INDEX "FotofficeMemberPortfolioPhoto_portfolioId_order_idx" ON "FotofficeMemberPortfolioPhoto"("portfolioId", "order");

ALTER TABLE "FotofficeMemberPortfolio" ADD CONSTRAINT "FotofficeMemberPortfolio_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeMemberPortfolio" ADD CONSTRAINT "FotofficeMemberPortfolio_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeMemberPortfolio" ADD CONSTRAINT "FotofficeMemberPortfolio_hiddenByAdminUserId_fkey" FOREIGN KEY ("hiddenByAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FotofficeMemberPortfolio" ADD CONSTRAINT "FotofficeMemberPortfolio_coverPhotoId_fkey" FOREIGN KEY ("coverPhotoId") REFERENCES "FotofficeMemberPortfolioPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FotofficeMemberPortfolioPhoto" ADD CONSTRAINT "FotofficeMemberPortfolioPhoto_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "FotofficeMemberPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

> **Ojo con el `ALTER TYPE`.** Postgres no permite usar un valor de enum recién agregado dentro de la misma transacción en que se lo agregó. Esta migración no lo usa —sólo lo declara—, así que es seguro. Si una migración futura necesitara insertarlo, va en un archivo aparte.

- [x] **Step 3: Regenerar el cliente y verificar que el schema es válido**

Run: `cd packages/db && pnpm exec prisma generate`
Expected: "Generated Prisma Client" sin errores.

- [x] **Step 4: Verificar que la migración es SQL válido contra una base descartable**

Run: `cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite && docker compose up -d postgres && cd packages/db && pnpm exec prisma migrate deploy`
Expected: aplica todas las migraciones, incluida la nueva, sin error.

Si Docker no está disponible, dejar constancia en el informe de la etapa y verificar el SQL en la etapa 5 contra una rama de prueba de Neon. **Nunca contra `development`.**

- [x] **Step 5: Correr los tests para confirmar que nada se rompió**

Run: `cd apps/fotoffice && pnpm test`
Expected: PASS, 3261 tests o más.

- [x] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260923120000_fotoffice_member_portfolio
git commit -m "Las tablas del portfolio de socios"
```

---

## Task 6: El preset de imagen y el namespace de R2

**Files:**
- Modify: `apps/fotoffice/lib/images/presets.ts`
- Modify: `apps/fotoffice/lib/images/r2-key-policy.ts`
- Modify: `apps/fotoffice/components/image-upload-field.tsx:95-105`
- Test: `apps/fotoffice/lib/images/r2-key-policy.test.ts`, `apps/fotoffice/lib/images/presets.test.ts`

**Interfaces:**
- Produces: `IMAGE_PRESETS.memberPortfolioPhoto`, `FOTOFFICE_R2_PREFIXES.memberPortfolioPhoto = "fotoffice/member-portfolio"`, y el campo opcional `aspectRatioFree?: boolean` en `ImagePreset`

- [x] **Step 1: Escribir los tests que fallan**

Crear `apps/fotoffice/lib/images/presets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { IMAGE_PRESETS } from "./presets";

describe("preset memberPortfolioPhoto", () => {
  it("no fuerza proporción: es obra, no un logo cuadrado", () => {
    expect(IMAGE_PRESETS.memberPortfolioPhoto.aspectRatioFree).toBe(true);
  });

  it("admite hasta 10 MB: una foto de autor no entra en 3", () => {
    expect(IMAGE_PRESETS.memberPortfolioPhoto.maxFileSizeBytes).toBe(10 * 1024 * 1024);
  });

  it("acepta los tres formatos que el servidor sabe reconocer por firma binaria", () => {
    expect([...IMAGE_PRESETS.memberPortfolioPhoto.acceptedFormats].sort()).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
  });

  it("ningún otro preset queda con proporción libre por accidente", () => {
    const libres = Object.values(IMAGE_PRESETS).filter((p) => p.aspectRatioFree);
    expect(libres.map((p) => p.key)).toEqual(["memberPortfolioPhoto"]);
  });
});
```

En `apps/fotoffice/lib/images/r2-key-policy.test.ts`, agregar:

```ts
it("las fotos de portfolio viven en su propio namespace y son borrables", () => {
  const key = "fotoffice/member-portfolio/ws-1/abc.jpg";
  expect(isFotofficeOwnedR2Key(key)).toBe(true);
  expect(assertFotofficeDeletableR2Key(key)).toBe(key);
});

it("una key de otra app sigue sin ser borrable", () => {
  expect(() => assertFotofficeDeletableR2Key("albums/123/foto.jpg")).toThrow();
});
```

- [x] **Step 2: Correr y verificar que fallan**

Run: `cd apps/fotoffice && pnpm test -- images`
Expected: FAIL.

- [x] **Step 3: Agregar el prefijo de R2**

En `apps/fotoffice/lib/images/r2-key-policy.ts`, dentro de `FOTOFFICE_R2_PREFIXES`:

```ts
  memberPortfolioPhoto: "fotoffice/member-portfolio",
```

- [x] **Step 4: Agregar el campo y el preset**

En `apps/fotoffice/lib/images/presets.ts`, en el tipo `ImagePreset`, después de `aspectRatioTolerance`:

```ts
  /**
   * Sin proporción recomendada: cada imagen es la que es. Lo usa la obra de un fotógrafo,
   * donde hay panorámicas, verticales y cuadradas, y avisar que "se aleja de la proporción"
   * sería decidir por él. `aspectRatio` sigue estando porque el tipo lo exige y el visor lo
   * usa como caja por defecto, pero no se valida.
   */
  aspectRatioFree?: boolean;
```

Y el preset nuevo dentro de `IMAGE_PRESETS`:

```ts
  memberPortfolioPhoto: {
    key: "memberPortfolioPhoto",
    label: "Foto de portfolio",
    widthRecommended: 2400,
    heightRecommended: 1600,
    aspectRatio: { width: 3, height: 2 },
    aspectRatioTolerance: 1,
    aspectRatioFree: true,
    minWidth: 1000,
    minHeight: 1000,
    maxFileSizeBytes: 10 * MB,
    acceptedFormats: ["image/jpeg", "image/webp", "image/png"],
    objectFit: "contain",
  },
```

> `minWidth` y `minHeight` en 1000 con proporción libre significan "el lado mayor de 1000 px"; la comprobación de dimensiones vive en el cliente y se ajusta en el Step 5.

- [x] **Step 5: Respetar la proporción libre en el campo de subida**

En `apps/fotoffice/components/image-upload-field.tsx:95-105`, envolver la comprobación de proporción:

```ts
    if (!preset!.aspectRatioFree) {
      const recommendedRatio = preset!.aspectRatio.width / preset!.aspectRatio.height;
      if (Math.abs(actualRatio - recommendedRatio) / recommendedRatio > preset!.aspectRatioTolerance) {
        // ...el aviso existente, sin cambios
      }
    }
```

Y, para el mínimo de dimensiones con proporción libre, comparar contra el lado mayor en lugar de exigir los dos:

```ts
    const ladoMayor = Math.max(naturalWidth, naturalHeight);
    const cumpleMinimo = preset!.aspectRatioFree
      ? ladoMayor >= Math.max(preset!.minWidth, preset!.minHeight)
      : naturalWidth >= preset!.minWidth && naturalHeight >= preset!.minHeight;
```

Reemplazar la condición del mínimo existente por `cumpleMinimo`.

- [x] **Step 6: Correr y verificar que pasan**

Run: `cd apps/fotoffice && pnpm test -- images`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add apps/fotoffice/lib/images apps/fotoffice/components/image-upload-field.tsx
git commit -m "Preset de foto de portfolio, sin proporción forzada"
```

---

---

## Lo que cambió al ejecutar la Etapa 1 *(30/09/2026)*

Cuatro desviaciones respecto de lo planificado, todas verificadas:

1. **La migración quedó fechada `20260930120000`**, no `20260923120000`. Entre la escritura del
   plan y su ejecución entraron seis migraciones nuevas; una fechada antes de otras ya aplicadas
   se aplica fuera de orden.
2. **La historia de migraciones del repo no se puede reproducir desde cero.**
   `20260911120000_video_frames_face_recognition` espera la tabla `VideoAsset`, que su propia
   historia no crea, así que `prisma migrate deploy` desde una base vacía corta ahí. Es una
   condición previa del repo, no de esta obra. La verificación se hizo por otro camino: construir
   la base con el esquema **anterior** a este cambio, aplicar esta migración encima y comparar
   contra el esquema nuevo. El diff salió vacío — coincidencia exacta.
3. **Hizo falta una tarea que el plan no tenía:** dar de alta la ficha del módulo en
   `lib/landing/catalogo.ts`. Lo pidió un test que ya existía (`catalogo.test.ts`), que vigila que
   todo módulo encendible se cuente en la portada de venta. Sin eso, el módulo se enciende y nadie
   se entera de que existe.
4. **El chequeo de tipos necesita `--max-old-space-size=8192`.** Con la memoria por defecto,
   `tsc` muere por falta de memoria antes de terminar, y ese corte parece un éxito: `pnpm exec`
   devuelve 0. Correrlo sin la memoria extra es no chequear nada. Encontró un error real que los
   tests no ven, porque vitest no chequea tipos.

**Estado al cerrar la etapa:** 269 archivos de test, 3327 tests, 0 fallas. Tipos limpios.

# ETAPA 2 — El socio lo arma

## Task 7: URL firmada de subida y verificación del objeto

La pieza con más filo del módulo: cuando el archivo no pasa por el servidor, la validación de contenido tampoco. Hay que recuperarla del otro lado.

**Files:**
- Create: `apps/fotoffice/lib/images/r2-presign.ts`
- Modify: `apps/fotoffice/package.json`
- Test: `apps/fotoffice/lib/images/r2-presign.test.ts`

**Interfaces:**
- Consumes: `generateFotofficeR2Key`, `getFotofficeR2PublicUrl`, `isFotofficeR2Configured` de `./r2-client`; `sniffImageFormat` de `./validation`; `assertSafeFotofficeR2Key` de `./r2-key-policy`
- Produces:
  - `function createFotofficeUploadUrl(params: { prefix: string; originalFilename: string; contentType: string }): Promise<{ uploadUrl: string; key: string; publicUrl: string }>`
  - `function verifyUploadedImage(params: { key: string; maxFileSizeBytes: number; acceptedFormats: readonly string[] }): Promise<{ ok: true; sizeBytes: number; contentType: string } | { ok: false; error: string }>`

- [x] **Step 1: Declarar la dependencia**

En `apps/fotoffice/package.json`, en `dependencies`, junto a `@aws-sdk/client-s3`:

```json
    "@aws-sdk/s3-request-presigner": "^3.972.0",
```

Run: `cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite && pnpm install`
Expected: instala reusando la resolución que ya existe. **Verificar con `git diff pnpm-lock.yaml` que el único cambio es el de FOTOFFICE**: el lockfile es de todos, y una resolución movida rompe otras apps.

- [x] **Step 2: Escribir el test que falla**

`apps/fotoffice/lib/images/r2-presign.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("./r2-client", () => ({
  isFotofficeR2Configured: () => true,
  getFotofficeR2PublicUrl: (key: string) => `https://cdn.example/${key}`,
  generateFotofficeR2Key: (name: string, prefix: string) => `${prefix}/fixed-${name}`,
  getFotofficeR2Client: () => ({ send: sendMock }),
  FOTOFFICE_R2_BUCKET: "dnx",
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://r2.example/firmada"),
}));

const { createFotofficeUploadUrl, verifyUploadedImage } = await import("./r2-presign");

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22]);

describe("createFotofficeUploadUrl", () => {
  it("devuelve la URL firmada, la key y la dirección pública final", async () => {
    const r = await createFotofficeUploadUrl({
      prefix: "fotoffice/member-portfolio/ws-1",
      originalFilename: "obra.jpg",
      contentType: "image/jpeg",
    });
    expect(r.uploadUrl).toBe("https://r2.example/firmada");
    expect(r.key).toBe("fotoffice/member-portfolio/ws-1/fixed-obra.jpg");
    expect(r.publicUrl).toBe("https://cdn.example/fotoffice/member-portfolio/ws-1/fixed-obra.jpg");
  });

  it("rechaza un content-type que el preset no admite antes de firmar nada", async () => {
    await expect(
      createFotofficeUploadUrl({
        prefix: "fotoffice/member-portfolio/ws-1",
        originalFilename: "x.svg",
        contentType: "image/svg+xml",
      }),
    ).rejects.toThrow();
  });
});

describe("verifyUploadedImage", () => {
  beforeEach(() => sendMock.mockReset());

  it("acepta un JPEG dentro del tope", async () => {
    sendMock
      .mockResolvedValueOnce({ ContentLength: 1024 })
      .mockResolvedValueOnce({ Body: { transformToByteArray: async () => JPEG } });
    const r = await verifyUploadedImage({
      key: "fotoffice/member-portfolio/ws-1/a.jpg",
      maxFileSizeBytes: 10 * 1024 * 1024,
      acceptedFormats: ["image/jpeg"],
    });
    expect(r).toEqual({ ok: true, sizeBytes: 1024, contentType: "image/jpeg" });
  });

  it("rechaza un objeto más grande que el tope, aunque el navegador haya dicho que no lo era", async () => {
    sendMock.mockResolvedValueOnce({ ContentLength: 50 * 1024 * 1024 });
    const r = await verifyUploadedImage({
      key: "fotoffice/member-portfolio/ws-1/a.jpg",
      maxFileSizeBytes: 10 * 1024 * 1024,
      acceptedFormats: ["image/jpeg"],
    });
    expect(r.ok).toBe(false);
  });

  it("rechaza un archivo que no es una imagen, aunque se llame .jpg", async () => {
    sendMock
      .mockResolvedValueOnce({ ContentLength: 100 })
      .mockResolvedValueOnce({
        Body: { transformToByteArray: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]) },
      });
    const r = await verifyUploadedImage({
      key: "fotoffice/member-portfolio/ws-1/a.jpg",
      maxFileSizeBytes: 10 * 1024 * 1024,
      acceptedFormats: ["image/jpeg"],
    });
    expect(r.ok).toBe(false);
  });

  it("rechaza una key fuera del namespace de FotoOffice", async () => {
    const r = await verifyUploadedImage({
      key: "albums/999/robada.jpg",
      maxFileSizeBytes: 10 * 1024 * 1024,
      acceptedFormats: ["image/jpeg"],
    });
    expect(r.ok).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 3: Correr y verificar que falla**

Run: `cd apps/fotoffice && pnpm test -- r2-presign`
Expected: FAIL.

- [x] **Step 4: Exponer el cliente y el bucket desde `r2-client.ts`**

En `apps/fotoffice/lib/images/r2-client.ts`, exportar el cliente y el nombre del bucket que hoy son internos (sin cambiar nada más):

```ts
export function getFotofficeR2Client(): S3Client { /* devuelve el cliente ya construido en el módulo */ }
export const FOTOFFICE_R2_BUCKET = process.env.R2_BUCKET ?? "";
```

Ajustar los nombres a los que el archivo ya usa internamente; el objetivo es sólo dejarlos accesibles, no reescribir la construcción del cliente.

- [x] **Step 5: Escribir `r2-presign.ts`**

```ts
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  FOTOFFICE_R2_BUCKET,
  generateFotofficeR2Key,
  getFotofficeR2Client,
  getFotofficeR2PublicUrl,
} from "./r2-client";
import { assertFotofficeDeletableR2Key } from "./r2-key-policy";
import { sniffImageFormat } from "./validation";

/** Los únicos tipos que el servidor sabe verificar por firma binaria. */
const TIPOS_FIRMABLES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Un minuto alcanza para empezar una subida. No es la duración de la subida en sí. */
const VENCIMIENTO_SEGUNDOS = 60;

/**
 * Dónde subir una imagen sin que el archivo pase por el servidor.
 *
 * Las funciones de Vercel rechazan cualquier pedido de más de 4,5 MB con
 * `413 FUNCTION_PAYLOAD_TOO_LARGE`. Para un logo alcanza; para la obra de un fotógrafo, no.
 * Es la misma forma que ya usa el módulo de Cursos con los videos de las clases.
 */
export async function createFotofficeUploadUrl(params: {
  prefix: string;
  originalFilename: string;
  contentType: string;
}): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  if (!(TIPOS_FIRMABLES as readonly string[]).includes(params.contentType)) {
    throw new Error("Sólo se admiten imágenes JPG, PNG o WebP.");
  }

  const key = generateFotofficeR2Key(params.originalFilename, params.prefix);
  // Rechaza cualquier key fuera del namespace de FotoOffice antes de firmar nada.
  assertFotofficeDeletableR2Key(key);

  const uploadUrl = await getSignedUrl(
    getFotofficeR2Client(),
    new PutObjectCommand({
      Bucket: FOTOFFICE_R2_BUCKET,
      Key: key,
      ContentType: params.contentType,
    }),
    { expiresIn: VENCIMIENTO_SEGUNDOS },
  );

  return { uploadUrl, key, publicUrl: getFotofficeR2PublicUrl(key) };
}

/**
 * Qué se subió de verdad.
 *
 * Con subida directa, el navegador es el único que vio el archivo, y el navegador miente: el
 * `Content-Type` lo pone él y el tamaño puede no ser el que declaró. Acá se lee el objeto ya
 * subido —su tamaño real y sus primeros bytes— y se decide con eso. Sin este paso, la subida
 * directa es un agujero por donde entra cualquier cosa con nombre de foto.
 */
export async function verifyUploadedImage(params: {
  key: string;
  maxFileSizeBytes: number;
  acceptedFormats: readonly string[];
}): Promise<{ ok: true; sizeBytes: number; contentType: string } | { ok: false; error: string }> {
  let key: string;
  try {
    key = assertFotofficeDeletableR2Key(params.key);
  } catch {
    return { ok: false, error: "No pudimos verificar el archivo subido." };
  }

  const client = getFotofficeR2Client();

  const head = await client.send(
    new HeadObjectCommand({ Bucket: FOTOFFICE_R2_BUCKET, Key: key }),
  );
  const sizeBytes = head.ContentLength ?? 0;
  if (sizeBytes <= 0) return { ok: false, error: "El archivo llegó vacío. Probá de nuevo." };
  if (sizeBytes > params.maxFileSizeBytes) {
    const maxMb = Math.round(params.maxFileSizeBytes / (1024 * 1024));
    return { ok: false, error: `La foto supera el máximo de ${maxMb} MB.` };
  }

  // Sólo los primeros bytes: alcanza para la firma binaria y no baja la foto entera.
  const head16 = await client.send(
    new GetObjectCommand({ Bucket: FOTOFFICE_R2_BUCKET, Key: key, Range: "bytes=0-15" }),
  );
  const bytes = await (head16.Body as { transformToByteArray: () => Promise<Uint8Array> })
    .transformToByteArray();

  const format = sniffImageFormat(bytes);
  if (!format || !params.acceptedFormats.includes(format)) {
    return { ok: false, error: "El archivo no es una imagen JPG, PNG o WebP válida." };
  }

  return { ok: true, sizeBytes, contentType: format };
}
```

- [x] **Step 6: Correr y verificar que pasan**

Run: `cd apps/fotoffice && pnpm test -- r2-presign`
Expected: PASS, 6 tests.

- [x] **Step 7: Commit**

```bash
git add apps/fotoffice/lib/images/r2-presign.ts apps/fotoffice/lib/images/r2-presign.test.ts apps/fotoffice/lib/images/r2-client.ts apps/fotoffice/package.json pnpm-lock.yaml
git commit -m "Subida directa a R2 con verificación del objeto subido"
```

---

## Task 8: El repositorio del portfolio de un socio

**Files:**
- Create: `apps/fotoffice/lib/portfolio/repository.ts`
- Test: `apps/fotoffice/lib/portfolio/repository.test.ts`

**Interfaces:**
- Consumes: `derivePortfolioSlug` (Task 4), `portfolioVisibility` (Task 2), `isModuleEnabledForWorkspace` de `@/lib/modules/gating`, `computeMemberBalance` de `@/lib/membership/balance` (usar el nombre real que exporte ese archivo)
- Produces:
  - `type PortfolioPhotoView = { id: string; url: string; width: number; height: number; order: number; title: string | null; year: number | null; isCover: boolean }`
  - `type PortfolioView = { id: string; publicSlug: string; memberPublished: boolean; photos: PortfolioPhotoView[]; visibility: PortfolioVisibility }`
  - `function ensurePortfolio(params: { workspaceId: string; memberId: string; firstName: string; lastName: string }): Promise<{ id: string; publicSlug: string }>`
  - `function loadPortfolioForMember(params: { workspaceId: string; memberId: string }): Promise<PortfolioView>`

- [x] **Step 1: Escribir los tests que fallan**

`apps/fotoffice/lib/portfolio/repository.test.ts` — con el mismo patrón de mock de `@repo/db` que usa `lib/modules/gating.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, findManyMock, createMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  findManyMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    fotofficeMemberPortfolio: {
      findUnique: findUniqueMock,
      findMany: findManyMock,
      create: createMock,
    },
  },
}));

const { ensurePortfolio } = await import("./repository");

describe("ensurePortfolio", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    findManyMock.mockReset();
    createMock.mockReset();
  });

  it("si ya existe, lo devuelve sin crear nada", async () => {
    findUniqueMock.mockResolvedValueOnce({ id: "p1", publicSlug: "juan-perez" });
    const r = await ensurePortfolio({
      workspaceId: "ws-1", memberId: "m-1", firstName: "Juan", lastName: "Pérez",
    });
    expect(r).toEqual({ id: "p1", publicSlug: "juan-perez" });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("si no existe, lo crea con el slug derivado del nombre", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    findManyMock.mockResolvedValueOnce([]);
    createMock.mockResolvedValueOnce({ id: "p2", publicSlug: "juan-perez" });
    await ensurePortfolio({
      workspaceId: "ws-1", memberId: "m-1", firstName: "Juan", lastName: "Pérez",
    });
    expect(createMock).toHaveBeenCalledWith({
      data: { workspaceId: "ws-1", memberId: "m-1", publicSlug: "juan-perez" },
      select: { id: true, publicSlug: true },
    });
  });

  it("desambigua contra los slugs ya tomados en ESA institución", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    findManyMock.mockResolvedValueOnce([{ publicSlug: "juan-perez" }]);
    createMock.mockResolvedValueOnce({ id: "p3", publicSlug: "juan-perez-2" });
    await ensurePortfolio({
      workspaceId: "ws-1", memberId: "m-9", firstName: "Juan", lastName: "Pérez",
    });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ publicSlug: "juan-perez-2" }) }),
    );
  });

  it("los slugs tomados se buscan sólo dentro del workspace: dos instituciones no colisionan", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    findManyMock.mockResolvedValueOnce([]);
    createMock.mockResolvedValueOnce({ id: "p4", publicSlug: "juan-perez" });
    await ensurePortfolio({
      workspaceId: "ws-2", memberId: "m-1", firstName: "Juan", lastName: "Pérez",
    });
    expect(findManyMock).toHaveBeenCalledWith({
      where: { workspaceId: "ws-2" },
      select: { publicSlug: true },
    });
  });
});
```

- [x] **Step 2: Correr y verificar que falla**

Run: `cd apps/fotoffice && pnpm test -- portfolio/repository`
Expected: FAIL.

- [x] **Step 3: Implementar `ensurePortfolio` y `loadPortfolioForMember`**

`apps/fotoffice/lib/portfolio/repository.ts`. `ensurePortfolio` busca por `memberId`, y si no hay fila junta los slugs del workspace, deriva el suyo y crea. `loadPortfolioForMember` trae el portfolio con sus fotos ordenadas por `order`, consulta `isModuleEnabledForWorkspace`, lee `directoryOptIn` y `status` del socio y el `overdueCount` del balance, y arma la respuesta pasando los siete hechos por `portfolioVisibility`.

```ts
export async function ensurePortfolio(params: {
  workspaceId: string;
  memberId: string;
  firstName: string;
  lastName: string;
}): Promise<{ id: string; publicSlug: string }> {
  const existente = await prisma.fotofficeMemberPortfolio.findUnique({
    where: { memberId: params.memberId },
    select: { id: true, publicSlug: true },
  });
  if (existente) return existente;

  const tomados = await prisma.fotofficeMemberPortfolio.findMany({
    where: { workspaceId: params.workspaceId },
    select: { publicSlug: true },
  });

  const publicSlug = derivePortfolioSlug({
    firstName: params.firstName,
    lastName: params.lastName,
    taken: new Set(tomados.map((t) => t.publicSlug)),
  });

  return prisma.fotofficeMemberPortfolio.create({
    data: { workspaceId: params.workspaceId, memberId: params.memberId, publicSlug },
    select: { id: true, publicSlug: true },
  });
}
```

> **Carrera entre dos pestañas.** Dos llamadas simultáneas pueden derivar el mismo slug y una de las dos choca contra `@@unique([workspaceId, publicSlug])`. Envolver el `create` en un `try/catch` de `P2002` que reintente una vez releyendo los tomados. Un reintento alcanza: el caso es raro y el segundo intento ya ve el slug del primero.

- [x] **Step 4: Correr y verificar que pasan**

Run: `cd apps/fotoffice && pnpm test -- portfolio/repository`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/portfolio/repository.ts apps/fotoffice/lib/portfolio/repository.test.ts
git commit -m "Lectura y creación del portfolio de un socio"
```

---

## Task 9: La ruta que entrega la URL firmada

**Files:**
- Create: `apps/fotoffice/app/api/portal/portfolio/upload-url/route.ts`
- Test: `apps/fotoffice/lib/portfolio/upload-guard.test.ts`
- Create: `apps/fotoffice/lib/portfolio/upload-guard.ts`

**Interfaces:**
- Consumes: `loadPortalContext` de `@/lib/portal/access`, `createFotofficeUploadUrl` (Task 7), `PORTFOLIO_MAX_PHOTOS` (Task 1)
- Produces: `function canAcceptAnotherPhoto(photoCount: number): { ok: true } | { ok: false; error: string }`

- [x] **Step 1: Escribir el test que falla**

`apps/fotoffice/lib/portfolio/upload-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canAcceptAnotherPhoto } from "./upload-guard";

describe("canAcceptAnotherPhoto", () => {
  it("con 19 fotos todavía entra una más", () => {
    expect(canAcceptAnotherPhoto(19)).toEqual({ ok: true });
  });

  it("con 20 ya no: el tope se valida en el servidor, no en el botón", () => {
    const r = canAcceptAnotherPhoto(20);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("20");
  });

  it("un conteo mayor al tope (datos viejos) tampoco deja subir", () => {
    expect(canAcceptAnotherPhoto(25).ok).toBe(false);
  });
});
```

- [x] **Step 2: Correr y verificar que falla**

Run: `cd apps/fotoffice && pnpm test -- upload-guard`
Expected: FAIL.

- [x] **Step 3: Implementar la guarda**

```ts
import { PORTFOLIO_MAX_PHOTOS } from "./constants";

/**
 * El tope, del lado del servidor. El contador de la pantalla es una cortesía; esto es la
 * regla — un tope que sólo vive en el botón no es un tope.
 */
export function canAcceptAnotherPhoto(
  photoCount: number,
): { ok: true } | { ok: false; error: string } {
  if (photoCount >= PORTFOLIO_MAX_PHOTOS) {
    return {
      ok: false,
      error: `Llegaste al máximo de ${PORTFOLIO_MAX_PHOTOS} fotos. Borrá alguna para subir otra.`,
    };
  }
  return { ok: true };
}
```

- [x] **Step 4: Escribir la ruta**

`apps/fotoffice/app/api/portal/portfolio/upload-url/route.ts`, con la misma estructura que `app/api/portal/foto/route.ts`:

1. `const user = await requireAuth()`
2. `const context = await loadPortalContext(user.id)`; sin contexto → 403 `"No encontramos tu ficha de socio."`
3. Si el módulo no está habilitado en `context.workspace.id` → 404.
4. `ensurePortfolio(...)` y contar sus fotos; `canAcceptAnotherPhoto` → 400 con su mensaje.
5. `createFotofficeUploadUrl({ prefix: 'fotoffice/member-portfolio/' + context.workspace.id, originalFilename, contentType })`.
6. Responder `{ uploadUrl, key, publicUrl }`.

**El `contentType` llega del cliente y sólo sirve para firmar.** La verdad sobre el archivo se establece después de la subida, en Task 10. El `prefix` se arma en el servidor con el `workspaceId` de la sesión: así es estructuralmente imposible escribir en el namespace de otra institución.

- [x] **Step 5: Correr los tests y el chequeo de tipos**

Run: `cd apps/fotoffice && pnpm test && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: PASS y sin errores de tipos.

- [x] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/portfolio/upload-guard.ts apps/fotoffice/lib/portfolio/upload-guard.test.ts apps/fotoffice/app/api/portal/portfolio/upload-url
git commit -m "La ruta que entrega la URL firmada para subir una foto"
```

---

## Task 10: Las acciones del socio

**Files:**
- Create: `apps/fotoffice/app/actions/portfolio.ts`
- Test: `apps/fotoffice/app/actions/portfolio.test.ts`

**Interfaces:**
- Consumes: `loadPortalContext`, `ensurePortfolio`, `verifyUploadedImage`, `canAcceptAnotherPhoto`, `IMAGE_PRESETS.memberPortfolioPhoto`, `deleteFotofficeR2Object`
- Produces (todas server actions, todas resuelven el socio desde la sesión):
  - `registerPortfolioPhotoAction(input: { key: string; width: number; height: number }): Promise<{ ok: true; photoId: string } | { ok: false; error: string }>`
  - `reorderPortfolioPhotosAction(input: { orderedIds: string[] }): Promise<{ ok: boolean; error?: string }>`
  - `setPortfolioCoverAction(input: { photoId: string }): Promise<{ ok: boolean; error?: string }>`
  - `updatePortfolioPhotoAction(input: { photoId: string; title: string | null; year: number | null }): Promise<{ ok: boolean; error?: string }>`
  - `deletePortfolioPhotoAction(input: { photoId: string }): Promise<{ ok: boolean; error?: string }>`
  - `setPortfolioPublishedAction(input: { published: boolean }): Promise<{ ok: boolean; error?: string }>`

- [x] **Step 1: Escribir los tests que fallan**

Los cuatro que cubren lo que puede salir mal de verdad:

```ts
it("registrar: rechaza una foto que no pasó la verificación del objeto subido", async () => {
  // verifyUploadedImage devuelve { ok: false } → la acción no escribe nada en la base
});

it("registrar: la primera foto queda como destacada automáticamente", async () => {
  // portfolio sin fotos → tras registrar, coverPhotoId === el id de esa foto
});

it("borrar: una foto de OTRO socio no se borra, aunque se mande su id", async () => {
  // la consulta filtra por portfolioId del socio de la sesión → 0 filas → error, y R2 intacto
});

it("borrar la destacada: la destacada pasa a ser la primera que quede", async () => {
  // coverPhotoId apunta a la de menor `order` tras el borrado
});

it("reordenar: ids que no son del socio se ignoran", async () => {
  // sólo se actualizan las fotos cuyo portfolioId es el suyo
});

it("publicar sin consentimiento devuelve error y no prende el interruptor", async () => {
  // directoryOptIn false → { ok: false }, memberPublished sigue en false
});
```

Escribirlos completos siguiendo el patrón de mock de `@repo/db` de Task 8.

- [x] **Step 2: Correr y verificar que fallan**

Run: `cd apps/fotoffice && pnpm test -- actions/portfolio`
Expected: FAIL.

- [x] **Step 3: Implementar las acciones**

Reglas que valen para las seis:

- Arrancan con `requireAuth()` + `loadPortalContext(user.id)`. **Ningún id de socio, portfolio o workspace se acepta del cliente.**
- Toda consulta sobre una foto filtra además por el `portfolioId` del socio de la sesión. Un id de otro no encuentra fila, y no encontrar fila es un error, no un no-op silencioso.
- `registerPortfolioPhotoAction` llama a `verifyUploadedImage` **antes** de escribir, con `maxFileSizeBytes` y `acceptedFormats` del preset. Si falla, borra el objeto de R2 y devuelve el error: un archivo rechazado no se queda ocupando lugar.
- `deletePortfolioPhotoAction` borra la fila y después el objeto de R2 con `deleteFotofficeR2Object`; si era la destacada, reasigna a la de menor `order`.
- `setPortfolioPublishedAction` con `published: true` verifica `directoryOptIn` y que haya al menos una foto; si falta alguna, devuelve el error en lugar de prender el interruptor.
- Todas terminan con `revalidatePath("/portal/portfolio")`, y las que cambian lo público además `revalidatePath("/w/[workspaceSlug]/socios", "page")`.

- [x] **Step 4: Correr y verificar que pasan**

Run: `cd apps/fotoffice && pnpm test -- actions/portfolio`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/fotoffice/app/actions/portfolio.ts apps/fotoffice/app/actions/portfolio.test.ts
git commit -m "Las acciones con las que el socio arma su portfolio"
```

---

## Task 11: La pantalla del socio

**Files:**
- Create: `apps/fotoffice/app/portal/portfolio/page.tsx`
- Create: `apps/fotoffice/components/portal/portfolio/portfolio-status-card.tsx`
- Create: `apps/fotoffice/components/portal/portfolio/portfolio-photo-grid.tsx`
- Create: `apps/fotoffice/components/portal/portfolio/portfolio-uploader.tsx`
- Modify: `apps/fotoffice/lib/portal/menu.ts`
- Test: `apps/fotoffice/lib/portal/menu.test.ts`

**Interfaces:**
- Consumes: `loadPortfolioForMember` (Task 8), `hiddenReasonMessage` (Task 3), las seis acciones (Task 10)

- [x] **Step 1: Escribir el test del menú**

En `apps/fotoffice/lib/portal/menu.test.ts` (crearlo si no existe, con el patrón de los otros tests de catálogo):

```ts
it("Mi portfolio está en el menú del portal y exige el módulo", () => {
  const item = PORTAL_MENU.find((i) => i.href === "/portal/portfolio");
  expect(item).toBeDefined();
  expect(item?.requiresModule).toBe(PORTFOLIO_MODULE_KEY);
  expect(item?.built).toBe(true);
});

it("su etiqueta no dice la palabra 'socio': el vocabulario lo resuelve la institución", () => {
  const item = PORTAL_MENU.find((i) => i.href === "/portal/portfolio");
  expect(item?.label.toLowerCase()).not.toContain("socio");
});
```

- [x] **Step 2: Correr y verificar que falla**

Run: `cd apps/fotoffice && pnpm test -- portal/menu`
Expected: FAIL.

- [x] **Step 3: Agregar la entrada al menú**

En `apps/fotoffice/lib/portal/menu.ts`, con `order: 45` (después de "Mi perfil", con el que está emparentado):

```ts
  {
    order: 45,
    label: "Mi portfolio",
    href: "/portal/portfolio",
    description: "Tus fotos, publicadas en el sitio de la institución.",
    icon: "camera",
    requiresModule: PORTFOLIO_MODULE_KEY,
    built: true,
  },
```

- [x] **Step 4: Escribir la pantalla**

`app/portal/portfolio/page.tsx` — server component. Resuelve `requireAuth()` → `loadPortalContext` → `loadPortfolioForMember`. Si el módulo no está habilitado, `notFound()`. Tres bloques, en este orden:

1. **`PortfolioStatusCard`** — recibe `visibility`. Si `visible`, un cartel verde con el enlace a la ficha pública. Si no, el `hiddenReasonMessage(reason)` con su título, su detalle y su botón cuando lo hay.
2. **`PortfolioPhotoGrid`** — client component. Grilla ordenable con `@dnd-kit/sortable` (`DndContext` + `SortableContext` + `arrayMove`), que al soltar llama a `reorderPortfolioPhotosAction` con los ids en su nuevo orden. Cada foto: la estrella de destacada (`setPortfolioCoverAction`), título y año en línea (`updatePortfolioPhotoAction`, al perder el foco) y borrar con confirmación (`deletePortfolioPhotoAction`). Encabezado con el contador "N de 20".
3. **`PortfolioUploader`** — client component. Por cada archivo elegido: `POST /api/portal/portfolio/upload-url` → `PUT` del archivo contra `uploadUrl` con `Content-Type` → leer alto y ancho con `createImageBitmap` → `registerPortfolioPhotoAction({ key, width, height })`. Barra de progreso por archivo y el error de cada uno junto al suyo, no un error global: cuando fallan tres de diez, un cartel único no dice cuáles.
4. **El interruptor de publicar**, al final, con `setPortfolioPublishedAction`. Si la acción devuelve el error de consentimiento, el cartel ofrece el enlace a `/portal/perfil`.

Clases: las `fo-card`, `fo-btn` y variables `--fo-*` que ya usa el resto del portal. Nada de colores sueltos.

- [x] **Step 5: Verificar en el navegador**

Run: `cd apps/fotoffice && pnpm dev` (puerto 3010) y entrar a `/portal/portfolio` con un socio de prueba.

Comprobar: subir una foto de más de 5 MB (tiene que entrar — es la prueba de que la subida directa funciona), reordenar arrastrando y recargar, marcar destacada, borrar, y que el cartel de estado diga la verdad en cada paso.

- [x] **Step 6: Correr todos los tests**

Run: `cd apps/fotoffice && pnpm test`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add apps/fotoffice/app/portal/portfolio apps/fotoffice/components/portal/portfolio apps/fotoffice/lib/portal/menu.ts apps/fotoffice/lib/portal/menu.test.ts
git commit -m "La pantalla donde el socio arma su portfolio"
```

---

---

## Lo que cambió al ejecutar la Etapa 2 *(30/09/2026)*

1. **La verificación en el navegador quedó pendiente, y no por falta de ganas.** El worktree no
   tiene archivo de entorno, así que el servidor local no tiene base de datos: la pantalla fallaría
   por eso y no por el código. Y aunque la tuviera, **la migración no está aplicada en ninguna
   base**, así que leer las tablas del portfolio daría error. Es la etapa 5, y toca infraestructura
   compartida: no se hace de callado.

   En su lugar se corrió `pnpm build`, que compila todas las páginas y es lo que detecta errores de
   frontera cliente/servidor —la clase de error que los tests no ven en código de interfaz—.
   Compiló limpio y las dos rutas nuevas aparecen en el mapa: `/portal/portfolio` y
   `/api/portal/portfolio/upload-url`.

2. **`pnpm lint` ya fallaba antes de esta obra.** Tres errores de `react-hooks/set-state-in-effect`
   en `hero-block-view.tsx` y `mass-grading-screen.tsx`, más avisos en `approve.ts`. Ninguno es de
   estos archivos. No se tocaron: arreglarlos es otra obra.

3. **Un chequeo de seguridad que el plan no tenía.** `registerPortfolioPhotoAction` verifica que la
   key caiga en el namespace de **esta** institución, no sólo en el de FotoOffice. Sin eso, alguien
   podía pedir una URL firmada para su propio workspace y después registrar la key de otro: la foto
   de otra institución aparecería en su portfolio. Tiene su test.

4. **`export const maxDuration` y un export de conveniencia salieron del archivo de ruta.** Un
   archivo `route.ts` de Next sólo admite los métodos HTTP y su configuración; exportar otra cosa
   desde ahí no es válido. El preset lo importa el componente directamente.

**Estado al cerrar la etapa:** 273 archivos de test, 3394 tests, 0 fallas. Tipos limpios. Build
compilando.

# ETAPA 3 — El sitio lo muestra

## Task 12: La página del módulo en el sitio, con etiqueta por vocabulario

**Files:**
- Modify: `apps/fotoffice/lib/website/public-modules.ts`
- Test: `apps/fotoffice/lib/website/public-modules.test.ts`

**Interfaces:**
- Produces: campo `labelFromVocabulary?: "personPlural"` en `PublicModulePage`, y `function resolvePublicModuleLabel(page: PublicModulePage, vocabulary: PersonVocabulary): string`

- [x] **Step 1: Escribir los tests que fallan**

```ts
it("el portfolio aporta la página /socios al sitio", () => {
  const page = PUBLIC_MODULE_PAGES.find((p) => p.moduleKey === PORTFOLIO_MODULE_KEY);
  expect(page?.segment).toBe("socios");
});

it("su segmento queda reservado: una página del dueño no puede taparlo", () => {
  expect(isSiteSegmentReserved("socios")).toBe(true);
});

it("con el módulo apagado, la página no entra al menú", () => {
  const pages = publicModulePagesFor(new Set(["courses-sales"]));
  expect(pages.some((p) => p.segment === "socios")).toBe(false);
});

it("la etiqueta sigue el vocabulario de la institución", () => {
  const page = PUBLIC_MODULE_PAGES.find((p) => p.moduleKey === PORTFOLIO_MODULE_KEY)!;
  const vocab = personVocabulary({ singular: "voluntario", plural: "voluntarios" });
  expect(resolvePublicModuleLabel(page, vocab)).toBe("Voluntarios");
});

it("sin vocabulario propio, la etiqueta es la de por defecto", () => {
  const page = PUBLIC_MODULE_PAGES.find((p) => p.moduleKey === PORTFOLIO_MODULE_KEY)!;
  expect(resolvePublicModuleLabel(page, personVocabulary(null))).toBe("Socios");
});

it("una página sin vocabulario declarado conserva su etiqueta fija", () => {
  const cursos = PUBLIC_MODULE_PAGES.find((p) => p.segment === "cursos")!;
  const vocab = personVocabulary({ singular: "voluntario", plural: "voluntarios" });
  expect(resolvePublicModuleLabel(cursos, vocab)).toBe("Cursos");
});
```

- [x] **Step 2: Correr y verificar que fallan**

Run: `cd apps/fotoffice && pnpm test -- public-modules`
Expected: FAIL.

- [x] **Step 3: Implementar**

Agregar el campo al tipo, la entrada nueva con `order: 25`, y el resolvedor que capitaliza la primera letra del plural del vocabulario. Reemplazar el comentario existente *"Ojo: el vocabulario por workspace todavía no se aplica acá"* por la explicación de que ahora se aplica cuando la entrada lo declara, y de que **el segmento nunca sigue al vocabulario** porque cambiar una palabra no puede romper enlaces publicados.

- [x] **Step 4: Usar el resolvedor donde se arma el menú público**

Buscar el consumidor de `publicModulePagesFor` en `lib/website/site-nav.ts` y pasar cada entrada por `resolvePublicModuleLabel`, cargando el vocabulario con `loadPersonVocabulary(workspaceId)`.

- [x] **Step 5: Correr y verificar que pasan**

Run: `cd apps/fotoffice && pnpm test -- public-modules site-nav`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/website/public-modules.ts apps/fotoffice/lib/website/public-modules.test.ts apps/fotoffice/lib/website/site-nav.ts
git commit -m "La página de portfolios entra al sitio con la palabra de cada institución"
```

---

## Task 13: Las lecturas públicas

**Files:**
- Create: `apps/fotoffice/lib/portfolio/public-queries.ts`
- Test: `apps/fotoffice/lib/portfolio/public-queries.test.ts`

**Interfaces:**
- Produces:
  - `type DirectoryEntry = { publicSlug: string; displayName: string; businessName: string | null; specialties: string[]; coverUrl: string | null; coverWidth: number | null; coverHeight: number | null }`
  - `function loadPublicDirectory(workspaceId: string): Promise<DirectoryEntry[]>`
  - `function loadPublicPortfolio(params: { workspaceId: string; publicSlug: string }): Promise<PublicPortfolio | null>`

- [x] **Step 1: Escribir los tests que fallan**

Los que importan son los de exclusión — que lo que no debe verse, no se vea:

```ts
it("el directorio no lista a quien no dio consentimiento", async () => { /* ... */ });
it("el directorio no lista a quien no publicó su portfolio", async () => { /* ... */ });
it("el directorio no lista a quien no tiene fotos", async () => { /* ... */ });
it("el directorio no lista a un socio dado de baja", async () => { /* ... */ });
it("el directorio no lista a quien tiene 3 cargos vencidos", async () => { /* ... */ });
it("sí lista a quien tiene 3 cargos vencidos y la institución publicó igual", async () => { /* ... */ });
it("el directorio no lista un portfolio bajado por la institución", async () => { /* ... */ });
it("la ficha de alguien que no está al aire devuelve null: no hay puerta lateral", async () => { /* ... */ });
it("ordena alfabéticamente por apellido", async () => { /* ... */ });
```

El último es el que cierra el agujero clásico: que el directorio filtre bien pero la ficha se abra igual escribiendo la dirección exacta.

- [x] **Step 2: Correr y verificar que fallan**

Run: `cd apps/fotoffice && pnpm test -- public-queries`
Expected: FAIL.

- [x] **Step 3: Implementar**

Las dos funciones traen sus candidatos de la base y **filtran con `portfolioVisibility`**, la misma función que usa el portal. No se reescribe la condición en SQL: si se escribiera dos veces, un día dirían cosas distintas — que es exactamente el modo de falla que la regla única existe para evitar.

El `overdueCount` de cada socio se calcula en una sola consulta agregada sobre `MembershipCharge` para todo el workspace, no una por socio: el directorio de una institución con 150 socios no puede hacer 150 viajes a la base.

- [x] **Step 4: Correr y verificar que pasan**

Run: `cd apps/fotoffice && pnpm test -- public-queries`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/portfolio/public-queries.ts apps/fotoffice/lib/portfolio/public-queries.test.ts
git commit -m "Las lecturas públicas del directorio y la ficha"
```

---

## Task 14: El directorio y la ficha

**Files:**
- Create: `apps/fotoffice/app/w/[workspaceSlug]/socios/page.tsx`
- Create: `apps/fotoffice/app/w/[workspaceSlug]/socios/[portfolioSlug]/page.tsx`
- Create: `apps/fotoffice/components/public/portfolio/portfolio-gallery.tsx`

**Interfaces:**
- Consumes: `loadPublicDirectory`, `loadPublicPortfolio` (Task 13), `isModuleEnabledForWorkspace`, `loadPersonVocabulary`

- [x] **Step 1: Escribir el directorio**

Mismo encabezado que `app/w/[workspaceSlug]/cursos/page.tsx`: resolver `branding` por `publicSlug`, `notFound()` si no hay, `notFound()` si el módulo no está habilitado.

Grilla de tarjetas con la foto destacada (con `width`/`height` para que no salte), el nombre, el estudio y las especialidades. Filtro por especialidad resuelto por query string (`?especialidad=retrato`), que funciona sin JavaScript. Título de la página: el plural del vocabulario, capitalizado. Si no hay nadie publicado, un texto sobrio — nunca una grilla de huecos.

- [x] **Step 2: Escribir la ficha**

`notFound()` si el módulo está apagado o si `loadPublicPortfolio` devuelve `null` — que es el mismo 404, a propósito: quien prueba direcciones no debe poder distinguir "no existe" de "existe y no está publicado".

Presentación, especialidades, enlaces al sitio y redes (con `rel="noopener noreferrer"`), y la galería. `generateMetadata` con título, descripción y `openGraph.images` apuntando a la foto destacada.

- [x] **Step 3: Escribir el visor**

`portfolio-gallery.tsx`, client component: grilla que abre la foto a pantalla completa, con flechas, Escape para cerrar y foco atrapado dentro del visor mientras está abierto.

- [x] **Step 4: Verificar en el navegador**

Run: `cd apps/fotoffice && pnpm dev`

Comprobar, con el módulo encendido en un workspace de prueba: el directorio lista sólo a quien corresponde; la ficha abre; la ficha de alguien despublicado da 404; con el módulo apagado las dos dan 404 y la entrada desaparece del menú; y en un teléfono (`resize` a 375 px) no hay desborde horizontal.

- [x] **Step 5: Correr todos los tests**

Run: `cd apps/fotoffice && pnpm test`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/fotoffice/app/w/\[workspaceSlug\]/socios apps/fotoffice/components/public/portfolio
git commit -m "El directorio y la ficha pública de cada portfolio"
```

---

---

## Lo que cambió al ejecutar la Etapa 3 *(01/10/2026)*

1. **La Task 15 no se hizo, y no por olvido: el sitemap no existe.** El plan daba por sentado que
   había uno al que agregarle las fichas. No lo hay — `sitemap.xml` figura sólo como segmento
   *reservado* en `public-modules.ts`, con el comentario "No se usa todavía".

   Hacerla habría significado construir el sitemap de todo el sitio público —portada, páginas de
   módulo, páginas del dueño— y encima un `robots.txt` que lo anuncie, porque un sitemap que nada
   referencia no lo lee nadie. Eso es una obra del módulo Sitio web, no de esta, y decidirla no me
   corresponde. **Queda pendiente y declarada.** Las fichas ya tienen su `generateMetadata` con
   Open Graph, que es lo que hace falta para que compartir un enlace se vea bien; lo que falta es
   que un buscador las descubra sola.

2. **El vocabulario del sitio necesitó más que `public-modules.ts`.** Para que el menú diga la
   palabra de cada institución hubo que llevarla hasta ahí: `PublicSite` ahora carga
   `personVocabulary`, el armazón se lo pasa a `buildSiteNav`, y `buildSiteNav` lo recibe como
   opcional para que ningún caller viejo cambie de comportamiento.

3. **El filtro por especialidad quedó por la dirección**, no por JavaScript: funciona sin scripts,
   se puede compartir como enlace y queda en el historial. Para una lista de este tamaño, filtrar
   en memoria alcanza.

4. **El visor es un `<dialog>` nativo.** El foco atrapado y Escape los maneja el navegador. Hecho a
   mano falla casi siempre en el mismo caso: quien navega con teclado termina tabulando por detrás
   del visor abierto.

5. **Verificado por compilación, no en el navegador** — por lo mismo que la etapa 2: no hay base
   contra la que correr. `pnpm build` compila limpio y las tres rutas conviven, con el segmento fijo
   `socios` ganándole al comodín `[...rest]` del constructor de páginas.

**Estado al cerrar la etapa:** 274 archivos de test, 3428 tests, 0 fallas. Tipos limpios. Build
compilando.

## Task 15: Las fichas en el sitemap — NO HECHA (ver la nota al pie de la etapa)

**Files:**
- Modify: el `sitemap.xml` del sitio público (buscarlo con `git grep -l sitemap apps/fotoffice/app`)
- Test: el test del sitemap si existe; si no, crearlo

- [ ] **Step 1: Escribir el test**

```ts
it("el sitemap incluye las fichas publicadas y ninguna otra", async () => { /* ... */ });
it("con el módulo apagado, el sitemap no incluye ninguna ficha", async () => { /* ... */ });
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd apps/fotoffice && pnpm test -- sitemap`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Agregar las entradas usando `loadPublicDirectory`, que ya filtra con la regla única.

- [ ] **Step 4: Correr y verificar que pasa. Commit**

```bash
git commit -am "Las fichas publicadas entran al sitemap"
```

---

# ETAPA 4 — La institución lo controla

## Task 16: Bajar y publicar igual

**Files:**
- Create: `apps/fotoffice/app/actions/portfolio-admin.ts`
- Create: `apps/fotoffice/lib/portfolio/admin-queries.ts`
- Test: `apps/fotoffice/app/actions/portfolio-admin.test.ts`

**Interfaces:**
- Produces:
  - `hidePortfolioAction(input: { portfolioId: string; reason: string }): Promise<{ ok: boolean; error?: string }>`
  - `restorePortfolioAction(input: { portfolioId: string; reason: string }): Promise<{ ok: boolean; error?: string }>`
  - `forcePublishPortfolioAction(input: { portfolioId: string; reason: string; force: boolean }): Promise<{ ok: boolean; error?: string }>`
  - `loadPortfoliosForAdmin(workspaceId: string): Promise<AdminPortfolioRow[]>`

- [x] **Step 1: Escribir los tests que fallan**

```ts
it("bajar exige motivo: sin él no escribe nada", async () => { /* ... */ });
it("bajar registra PORTFOLIO_HIDDEN en la auditoría del socio, con el motivo y quién fue", async () => { /* ... */ });
it("restaurar limpia los tres campos de la bajada y registra PORTFOLIO_RESTORED", async () => { /* ... */ });
it("publicar igual NO toca la deuda: sólo prende adminForcePublish", async () => { /* ... */ });
it("un portfolio de OTRO workspace no se puede bajar, aunque se mande su id", async () => { /* ... */ });
it("quien no es OWNER ni ADMIN del workspace no puede bajar nada", async () => { /* ... */ });
```

Los dos últimos son los que cierran el módulo: el aislamiento entre instituciones y el permiso.

- [x] **Step 2: Correr y verificar que fallan**

Run: `cd apps/fotoffice && pnpm test -- portfolio-admin`
Expected: FAIL.

- [x] **Step 3: Implementar**

Las tres acciones resuelven el workspace activo desde la sesión —igual que el resto de `app/actions/`— y **filtran cada `update` por ese `workspaceId`**: un id de otra institución no encuentra fila. El motivo es obligatorio y se valida antes de escribir. Cada acción escribe su fila en `MemberAudit` con `actorUserId`, `actorLabel` y `reason`, dentro de la misma transacción que el cambio: una bajada sin su registro de auditoría es peor que no haberla hecho.

`loadPortfoliosForAdmin` devuelve una fila por socio con portfolio: nombre, cantidad de fotos, si publicó, y el resultado de `portfolioVisibility` para poder mostrar el estado real con su motivo.

- [x] **Step 4: Correr y verificar que pasan**

Run: `cd apps/fotoffice && pnpm test -- portfolio-admin`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/fotoffice/app/actions/portfolio-admin.ts apps/fotoffice/app/actions/portfolio-admin.test.ts apps/fotoffice/lib/portfolio/admin-queries.ts
git commit -m "La institución puede bajar un portfolio y publicarlo igual"
```

---

## Task 17: La pantalla del panel

**Files:**
- Create: `apps/fotoffice/app/(shell)/portfolios/page.tsx`
- Create: `apps/fotoffice/components/portfolios/portfolio-admin-row.tsx`

- [x] **Step 1: Escribir la pantalla**

Server component con el guard del shell que usan las otras pantallas del panel, más `isModuleEnabledForWorkspace` → `notFound()`.

Tres números arriba: cuántos publicados, cuántos armados sin publicar, cuántos socios sin portfolio. Ese tercero es el que vuelve la pantalla útil: dice a quién hay que recordarle que cargue sus fotos.

La tabla: nombre, fotos, estado con su motivo, y las dos acciones. Cada una abre un diálogo que **exige el motivo** antes de habilitar el botón.

- [x] **Step 2: Verificar en el navegador**

Run: `cd apps/fotoffice && pnpm dev`

Bajar un portfolio con motivo y comprobar que desaparece del directorio público y que el motivo figura en el historial del socio. Publicar igual uno con deuda y comprobar que aparece.

- [x] **Step 3: Correr todos los tests. Commit**

```bash
git add apps/fotoffice/app/\(shell\)/portfolios apps/fotoffice/components/portfolios
git commit -m "El panel desde el que la institución mira y controla los portfolios"
```

---

---

## Lo que cambió al ejecutar la Etapa 4 *(01/10/2026)*

1. **El umbral de deuda se ratificó en 3.** Durante la etapa surgió la duda de si "al día" debía
   significar *cualquier* cuota vencida. Se confirmó que no: el umbral queda en 3, como se diseñó.
   Con la migración de pagos viejos todavía incompleta, bajar el umbral a 1 haría desaparecer de
   golpe a los 48 socios cuyos pagos previos a 10/2025 no se importaron.

2. **`MemberAuditSource` no tiene `PANEL`.** Sus valores son `MANUAL`, `CSV_IMPORT` y `SYSTEM`; lo
   que corresponde es `MANUAL`. Los tests no lo detectaron porque Prisma está simulado — lo
   encontró el chequeo de tipos. Quedó un test que lo fija.

3. **`PageHeader` no recibe `icon`.** Sólo `title`, `description` y `actions`.

4. **Dos listas de nombres reservados pedían la ruta nueva**, cada una con su propio test:
   `RESERVED_SLUGS` en `lib/entrada/institution-shortcut.ts` y `FOTOFFICE_RESERVED_SLUGS` en
   `lib/website/reserved-slugs.ts`. Es la red que impide que una institución llamada "Portfolios"
   tape la pantalla del panel. El plan no las mencionaba; los tests sí.

5. **Se agregó `lib/portfolio/admin-access.ts`**, que el plan no preveía. Devuelve `null` en vez de
   redirigir, porque lo usan las acciones: un `redirect` dentro de una server action convierte un
   "no tenés permiso" en una navegación que nadie pidió. OWNER y ADMIN pueden; **STAFF no**.

6. **Verificado por compilación, no en el navegador**, por lo mismo que las etapas 2 y 3.

**Estado al cerrar la etapa:** 276 archivos de test, 3455 tests, 0 fallas. Tipos limpios. Build
compilando.

# ETAPA 5 — Encendido

## Task 18: Dejarlo andando

Esta etapa es configuración, no código. Cada paso deja su evidencia en el informe.

- [ ] **Step 1: CORS del bucket**

El bucket de R2 tiene que aceptar `PUT` desde el dominio de FOTOFFICE. Sin esto el navegador rechaza la subida y el error no dice por qué.

Usar la herramienta `r2_cors_update` del MCP de DNX. **Agregar el origen, no reemplazar la configuración**: el bucket es compartido con las otras apps del monorepo y pisar su CORS rompe las subidas de CompraMeLaFoto y FotoRank.

- [ ] **Step 2: Aplicar la migración**

Aplicar `20260923120000_fotoffice_member_portfolio` en la base de FOTOFFICE, que es la rama **`development`** del proyecto de Neon — *no* la rama llamada `production`, que es la de CompraMeLaFoto.

Registrarla en `_prisma_migrations` con el checksum de una base sana. El SQL aplicado sin registrar desincroniza la tabla de migraciones y el próximo deploy falla por algo que no tiene que ver.

Verificar después: `SELECT count(*) FROM "FotofficeMemberPortfolio";` tiene que devolver 0, no un error. Una columna sin aplicar no rompe sólo la pantalla nueva: rompe toda lectura del modelo.

- [ ] **Step 3: Encender el módulo**

Insertar la fila en `WorkspaceFeatureModule` con `moduleKey = 'portfolio'` y `enabled = true` para los workspaces que lo vayan a usar. Encender un módulo son dos cosas: el código y la base. Con el código desplegado y sin la fila, no pasa nada.

- [ ] **Step 4: La prueba de punta a punta, en producción**

Las diez comprobaciones de §11 de la spec, con un socio real de prueba. Subir al menos una foto de más de 5 MB: es la prueba de que la subida directa anda de verdad y no estamos apoyados en el fallback.

- [ ] **Step 5: Escribir el informe de la obra**

`apps/fotoffice/docs/portfolio/informe-etapa-1.md`: qué quedó andando, qué no, y qué hace falta para lo que falta.

---

## Autorrevisión del plan

**Cobertura de la spec:**

| Sección de la spec | Tarea |
|---|---|
| §3 Los datos | Task 5 |
| §3 `publicSlug` | Task 4 |
| §4 La regla única | Task 2 |
| §4 El riesgo del falso deudor | Tasks 3 y 16 |
| §5 El socio lo arma | Tasks 8, 9, 10, 11 |
| §6 La institución lo controla | Tasks 16 y 17 |
| §7 El sitio público | Tasks 12, 13, 14, 15 |
| §7 Etiqueta por vocabulario | Task 12 |
| §8 Las fotos, preset y namespace | Task 6 |
| §8 Subida directa | Tasks 7 y 9 |
| §8 Borrado de una foto | Task 10 |
| §10 Etapas | La numeración de este plan |
| §11 Verificación | Tasks 11, 14, 17 (navegador) y 18 (punta a punta) |

Sin huecos.

**Nombres, verificados entre tareas:** `PORTFOLIO_MODULE_KEY`, `PORTFOLIO_MAX_PHOTOS`, `PORTFOLIO_OVERDUE_LIMIT`, `PORTFOLIO_PUBLIC_SEGMENT` (Task 1) se usan igual en 2, 9, 11 y 12. `portfolioVisibility` / `PortfolioVisibilityFacts` / `PortfolioHiddenReason` (Task 2) se consumen igual en 3, 8, 13 y 16. `derivePortfolioSlug` (Task 4) en 8. `createFotofficeUploadUrl` / `verifyUploadedImage` (Task 7) en 9 y 10. `IMAGE_PRESETS.memberPortfolioPhoto` (Task 6) en 7 y 10.

**Una deuda registrada a propósito:** la condición de deuda usa `overdueCount`, no la regla del estatuto. Está explicada en la spec §4 y encerrada en una sola función para que el día que exista el cálculo de morosidad se cambie en un solo lugar.
