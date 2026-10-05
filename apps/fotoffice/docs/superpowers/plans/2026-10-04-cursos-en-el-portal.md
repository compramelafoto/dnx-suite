# Los cursos viven en el portal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** que quien compra un curso grabado lo vea en el portal de FOTOFFICE con su cuenta (se
le crea si no la tiene), que el socio activo tome gratis los cursos marcados para socios, y que
el alumno que no es socio vea la invitación a asociarse.

**Architecture:** el acceso al curso (`CourseAccess`) deja de llevar un token y pasa a llevar la
cuenta (`userId`) y un origen (`PURCHASE` o `MEMBER_BENEFIT`). Al aprobarse el pago se busca o
crea la cuenta por correo y se manda un único correo ("ya está en tu portal" o "creá tu
contraseña"). El portal reconoce un segundo tipo de persona, el alumno, con un menú propio; el
aula se muda a `/portal/cursos` y el avance se guarda contra la sesión.

**Tech Stack:** Next 16 (App Router, `params` como `Promise`), Prisma sobre Postgres (Neon),
vitest, `@repo/auth` (sesión, `createOpaqueToken`, `requireNormalizedIdentityEmail`), Cloudflare
Stream (ya integrado), Resend vía `lib/communications/send-email`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-04-cursos-en-el-portal-design.md`.
Reemplaza la entrada al aula de
`apps/fotoffice/docs/superpowers/plans/2026-10-03-cursos-grabados-etapa-2-aula.md` (Tasks 1-11
ya ejecutadas en esta rama; su Task 12 queda reemplazada por la Task 9 de este plan).

## Global Constraints

- Idioma de todo lo visible y de los comentarios: **español**. Identificadores según el archivo
  que se toque (`lib/course-classroom` mezcla español e inglés; seguí el estilo del archivo).
- Antes de escribir código de Next, leé la guía correspondiente en `node_modules/next/dist/docs/`
  (lo exige `apps/fotoffice/AGENTS.md`). `params` y `searchParams` son `Promise`.
- Tests: `pnpm --filter fotoffice test` (un archivo: `pnpm --filter fotoffice test <ruta>`).
  Vitest sólo levanta `lib/**/*.test.ts` y `app/**/*.test.ts`. Base al empezar: 348 archivos /
  4264 tests verdes.
- Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`.
  Puede morir por memoria y devolver 0: desconfiá si termina en segundos sin salida tras un
  cambio grande; si el cliente Prisma está viejo, `pnpm --filter @repo/db exec prisma generate`.
- **Ninguna dependencia nueva**: el lockfile es compartido por toda la suite.
- Fechas visibles en **hora argentina** (`fechaLegibleArgentina` de
  `lib/course-classroom/access-rules.ts`) y montos en **pesos**.
- La migración `20261004120000_cursos_aula_alumno` **no está aplicada en ninguna base**: se
  corrige en el lugar. El despliegue no corre `prisma migrate deploy`.
- **Un socio entra al portal y ve exactamente lo mismo que hoy** (requisito de la spec, §6).
- Nunca escribir en un log un token crudo, una contraseña ni un enlace con token.
- Trabajar en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite-wt-cursos-e2`,
  rama `feat/fotoffice-cursos-aula`. En un worktree, el servidor de desarrollo es
  `next dev --webpack`.

---

## Hallazgos que cambian lo que dice la spec

1. **El panel no permite cargar el precio de un curso grabado, y lo borra.** El formulario
   `components/presential-courses/course-editor-form.tsx` no tiene campos `priceArs`,
   `accessMonths` ni `completionPercent`, y las acciones de `app/actions/presential-courses.ts`
   leen `priceArs` del formulario: como no viene, cada guardado lo pone en `null`. Hoy un curso
   grabado no se puede vender desde el panel. La Task 6 lo arregla junto con el interruptor
   "Gratis para socios".
2. **El enlace de "crear contraseña" de `@repo/auth` vence en 1 hora** (`DNX_PASSWORD_RESET_TTL_MS`)
   y `requestPasswordReset` manda su propio correo. Para un correo de bienvenida eso no sirve:
   el plan crea el `PasswordResetToken` desde FOTOFFICE con `createOpaqueToken` y **7 días** de
   validez. `/recuperar/[token]` lo acepta igual: `resetPasswordWithToken` sólo mira `expiresAt`.
3. **El menú del socio ya tiene la sección "Cursos"** (`lib/portal/menu.ts`, `built: false`). Se
   enciende cuando el módulo de cursos está habilitado, no "sólo si compró alguno": el socio
   tiene que poder encontrar los cursos gratis antes de tener uno.

## Estructura de archivos

**Nuevos:**

| Archivo | Responsabilidad |
|---|---|
| `lib/course-classroom/account.ts` (+ test) | Buscar o crear la cuenta del comprador; crear el enlace de contraseña de 7 días |
| `lib/course-classroom/alumno.ts` (+ test) | ¿Esta cuenta tiene cursos? ¿De qué institución? Accesos pendientes de otorgar |
| `lib/course-classroom/mis-cursos.ts` (+ test) | Armar Mis cursos: qué cursos ve la persona, agrupados por institución, con su avance |
| `lib/course-classroom/beneficio.ts` (+ test) | Cursos gratis para socios: cuáles le tocan y anotarse |
| `lib/course-classroom/asociarse.ts` (+ test) | ¿Hay que invitar a asociarse? ¿A dónde? |
| `lib/portal/viewer.ts` (+ test) | Quién mira el portal: socio, alumno o nadie |
| `app/portal/cursos/page.tsx` | Mis cursos |
| `app/portal/cursos/[courseId]/clase/[lessonId]/page.tsx` | La clase |
| `app/portal/cursos/actions.ts` | Anotarme gratis |
| `app/api/portal/cursos/avance/route.ts` | Avance autenticado por sesión |

**Modificados:** `packages/db/prisma/schema.prisma`, la migración
`packages/db/prisma/migrations/20261004120000_cursos_aula_alumno/migration.sql`,
`lib/course-classroom/{access-rules,email,grant}.ts` y sus tests, `app/portal/layout.tsx`,
`app/portal/page.tsx`, `components/portal/portal-shell.tsx`, `lib/portal/{menu,user-kind}.ts`,
`lib/post-login.ts`, `app/elegir-perfil/page.tsx`, `components/presential-courses/course-editor-form.tsx`,
`app/actions/presential-courses.ts`, `components/presential-courses/recorded-course-section.tsx`,
`app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx`,
`app/w/[workspaceSlug]/cursos/[courseSlug]/inscripcion/success/page.tsx`,
`components/presential-courses/public-course-enrollment-form.tsx`.

**Borrados (Task 3):** `lib/course-classroom/lookup.ts`, `app/aula/` entero,
`app/api/aula/` entero, `app/actions/course-classroom.ts`.

Las rutas `lib/...`, `app/...` y `components/...` son relativas a `apps/fotoffice/`.

---

### Task 1: Cuándo vale un acceso

**Files:**
- Modify: `lib/course-classroom/access-rules.ts`
- Test: `lib/course-classroom/access-rules.test.ts`

**Interfaces:**
- Produces:
  - `type OrigenAcceso = "PURCHASE" | "MEMBER_BENEFIT"`
  - `type EstadoAccesoAlCurso = "VIGENTE" | "VENCIDO" | "REVOCADO" | "SIN_SOCIO"`
  - `estadoDeAccesoAlCurso(acceso: { origin: OrigenAcceso; expiresAt: Date | null; revokedAt: Date | null }, contexto: { esSocioActivo: boolean }, ahora: Date): EstadoAccesoAlCurso`
- `estadoDelAcceso` (el viejo) queda hasta la Task 3, que lo borra.

- [ ] **Step 1: Agregar el test que falla al final de `access-rules.test.ts`**

Sumá `estadoDeAccesoAlCurso` al import existente del archivo.

```ts
describe("cuándo vale un acceso al curso", () => {
  const ahora = new Date(Date.UTC(2026, 9, 4));
  const vence = new Date(Date.UTC(2027, 9, 4));

  it("comprado y no vencido: vale, sea socio o no", () => {
    const acceso = { origin: "PURCHASE" as const, expiresAt: vence, revokedAt: null };
    expect(estadoDeAccesoAlCurso(acceso, { esSocioActivo: false }, ahora)).toBe("VIGENTE");
    expect(estadoDeAccesoAlCurso(acceso, { esSocioActivo: true }, ahora)).toBe("VIGENTE");
  });

  it("comprado y vencido: no vale aunque sea socio", () => {
    const acceso = { origin: "PURCHASE" as const, expiresAt: ahora, revokedAt: null };
    expect(estadoDeAccesoAlCurso(acceso, { esSocioActivo: true }, ahora)).toBe("VENCIDO");
  });

  it("de beneficio: vale sólo mientras es socio activo, sin vencimiento por fecha", () => {
    const acceso = { origin: "MEMBER_BENEFIT" as const, expiresAt: null, revokedAt: null };
    expect(estadoDeAccesoAlCurso(acceso, { esSocioActivo: true }, ahora)).toBe("VIGENTE");
    expect(estadoDeAccesoAlCurso(acceso, { esSocioActivo: false }, ahora)).toBe("SIN_SOCIO");
  });

  it("revocado gana sobre todo", () => {
    const revokedAt = new Date(Date.UTC(2026, 9, 1));
    expect(
      estadoDeAccesoAlCurso({ origin: "PURCHASE", expiresAt: vence, revokedAt }, { esSocioActivo: true }, ahora),
    ).toBe("REVOCADO");
    expect(
      estadoDeAccesoAlCurso({ origin: "MEMBER_BENEFIT", expiresAt: null, revokedAt }, { esSocioActivo: true }, ahora),
    ).toBe("REVOCADO");
  });

  it("una compra sin fecha de vencimiento (dato roto) no castiga a quien pagó", () => {
    expect(
      estadoDeAccesoAlCurso({ origin: "PURCHASE", expiresAt: null, revokedAt: null }, { esSocioActivo: false }, ahora),
    ).toBe("VIGENTE");
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-classroom/access-rules.test.ts`
Expected: FAIL — `estadoDeAccesoAlCurso is not a function`.

- [ ] **Step 3: Implementar, al final de `access-rules.ts`**

```ts
export type OrigenAcceso = "PURCHASE" | "MEMBER_BENEFIT";
export type EstadoAccesoAlCurso = "VIGENTE" | "VENCIDO" | "REVOCADO" | "SIN_SOCIO";

/**
 * Si una persona puede ver un curso ahora.
 *
 * Lo comprado vale hasta su vencimiento, sea socio o no: lo pagó. Lo tomado gratis por ser
 * socio vale mientras siga siendo socio activo, sin fecha: si queda suspendido o se da de baja
 * deja de verse, y vuelve con su avance al reactivarse (spec §4).
 */
export function estadoDeAccesoAlCurso(
  acceso: { origin: OrigenAcceso; expiresAt: Date | null; revokedAt: Date | null },
  contexto: { esSocioActivo: boolean },
  ahora: Date,
): EstadoAccesoAlCurso {
  if (acceso.revokedAt) return "REVOCADO";
  if (acceso.origin === "MEMBER_BENEFIT") return contexto.esSocioActivo ? "VIGENTE" : "SIN_SOCIO";
  // Una compra siempre nace con vencimiento. Si faltara, no se le quita el curso a quien pagó.
  if (!acceso.expiresAt) return "VIGENTE";
  return ahora.getTime() < acceso.expiresAt.getTime() ? "VIGENTE" : "VENCIDO";
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/course-classroom/access-rules.test.ts`
Expected: PASS (los anteriores + 5 nuevos).

- [ ] **Step 5: Commit**

```bash
git add lib/course-classroom/access-rules.ts lib/course-classroom/access-rules.test.ts
git commit -m "Cursos en el portal: cuándo vale un acceso comprado o de beneficio de socio"
```

---

### Task 2: La cuenta del comprador y los correos

**Files:**
- Create: `lib/course-classroom/account.ts`, `lib/course-classroom/account.test.ts`
- Modify: `lib/course-classroom/email.ts`, `lib/course-classroom/email.test.ts`

**Interfaces:**
- Consumes: `createOpaqueToken`, `requireNormalizedIdentityEmail` de `@repo/auth`;
  `escaparHtml`, `fechaLegibleArgentina` (existentes).
- Produces (`account.ts`):
  - `DIAS_ENLACE_CONTRASENA = 7`
  - `type CuentaDelAlumno = { userId: number; creada: boolean; puedeEntrar: boolean }`
  - `type CuentaDeps = { buscar: (email: string) => Promise<{ id: number; password: string | null; googleId: string | null; isBlocked: boolean } | null>; crear: (email: string) => Promise<{ id: number }> }`
  - `asegurarCuentaDelAlumno(email: string, deps?: CuentaDeps): Promise<CuentaDelAlumno | null>` — `null` si el correo es inválido o la cuenta está bloqueada.
  - `type EnlaceDeps = { guardar: (fila: { userId: number; tokenHash: string; expiresAt: Date }) => Promise<void> }`
  - `crearEnlaceParaContrasena(userId: number, base: string, ahora?: Date, deps?: EnlaceDeps): Promise<string>` → `"<base>/recuperar/<token>"`
- Produces (`email.ts`):
  - `type InvitacionASociarse = { institucion: string; url: string }`
  - `buildCursoEnTuPortalEmailBody(input: { studentName: string; courseTitle: string; portalUrl: string; expiresAt: Date | null; invitacion: InvitacionASociarse | null }, signature: RenderedEmailSignature | null): { html: string; text: string }`
  - `buildBienvenidaAlumnoEmailBody(input: { studentName: string; courseTitle: string; crearContrasenaUrl: string; loginUrl: string; expiresAt: Date | null; invitacion: InvitacionASociarse | null }, signature: RenderedEmailSignature | null): { html: string; text: string }`
  - `sendCursoEnTuPortalEmail(input: <el de buildCursoEnTuPortalEmailBody> & { to: string; signature?: RenderedEmailSignature | null }): Promise<{ sent: true } | { sent: false; reason: string }>` — asunto `Tu curso ya está en tu portal: <curso>`
  - `sendBienvenidaAlumnoEmail(input: <el de buildBienvenidaAlumnoEmailBody> & { to: string; signature?: RenderedEmailSignature | null }): Promise<{ sent: true } | { sent: false; reason: string }>` — asunto `Bienvenido: tu acceso a <curso>`
- Las funciones viejas de `email.ts` (`enlaceDelAula`, `buildClassroomAccessEmailBody`,
  `sendClassroomAccessEmail`) quedan hasta la Task 3.

- [ ] **Step 1: Escribir el test de la cuenta**

```ts
// lib/course-classroom/account.test.ts
import { describe, expect, it, vi } from "vitest";
import { hashOpaqueToken } from "@repo/auth";
import {
  asegurarCuentaDelAlumno,
  crearEnlaceParaContrasena,
  DIAS_ENLACE_CONTRASENA,
  type CuentaDeps,
} from "./account";

function deps(existente: Awaited<ReturnType<CuentaDeps["buscar"]>>): CuentaDeps {
  return {
    buscar: vi.fn().mockResolvedValue(existente),
    crear: vi.fn().mockResolvedValue({ id: 99 }),
  };
}

describe("la cuenta del comprador", () => {
  it("si no existe, la crea con el correo normalizado", async () => {
    const d = deps(null);
    const r = await asegurarCuentaDelAlumno("  Ana@Example.COM ", d);
    expect(d.buscar).toHaveBeenCalledWith("ana@example.com");
    expect(d.crear).toHaveBeenCalledWith("ana@example.com");
    expect(r).toEqual({ userId: 99, creada: true, puedeEntrar: false });
  });

  it("si existe con contraseña, la usa y puede entrar", async () => {
    const d = deps({ id: 7, password: "hash", googleId: null, isBlocked: false });
    expect(await asegurarCuentaDelAlumno("ana@example.com", d)).toEqual({ userId: 7, creada: false, puedeEntrar: true });
    expect(d.crear).not.toHaveBeenCalled();
  });

  it("con Google y sin contraseña también puede entrar", async () => {
    const d = deps({ id: 7, password: null, googleId: "g-1", isBlocked: false });
    expect((await asegurarCuentaDelAlumno("ana@example.com", d))?.puedeEntrar).toBe(true);
  });

  it("existente sin contraseña ni Google: hay que mandarle a crear la contraseña", async () => {
    const d = deps({ id: 7, password: null, googleId: null, isBlocked: false });
    expect((await asegurarCuentaDelAlumno("ana@example.com", d))?.puedeEntrar).toBe(false);
  });

  it("una cuenta bloqueada no recibe cursos", async () => {
    const d = deps({ id: 7, password: "hash", googleId: null, isBlocked: true });
    expect(await asegurarCuentaDelAlumno("ana@example.com", d)).toBeNull();
  });

  it("un correo inválido no crea nada", async () => {
    const d = deps(null);
    expect(await asegurarCuentaDelAlumno("no-es-correo", d)).toBeNull();
    expect(d.buscar).not.toHaveBeenCalled();
  });
});

describe("el enlace para crear la contraseña", () => {
  it("dura 7 días y en la base queda sólo el hash", async () => {
    const guardar = vi.fn().mockResolvedValue(undefined);
    const ahora = new Date(Date.UTC(2026, 9, 4, 12));
    const url = await crearEnlaceParaContrasena(7, "https://fotoffice.com/", ahora, { guardar });

    expect(url.startsWith("https://fotoffice.com/recuperar/")).toBe(true);
    const token = url.split("/recuperar/")[1];
    const fila = guardar.mock.calls[0][0];
    expect(fila.userId).toBe(7);
    expect(fila.tokenHash).toBe(hashOpaqueToken(token));
    expect(fila.tokenHash).not.toBe(token);
    expect(fila.expiresAt.getTime() - ahora.getTime()).toBe(DIAS_ENLACE_CONTRASENA * 24 * 60 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-classroom/account.test.ts`
Expected: FAIL — `Failed to resolve import "./account"`. Si falla en cambio porque `@repo/auth`
no exporta `hashOpaqueToken`, revisá `packages/auth/src/index.ts` (lo exporta en la línea ~21) y
reportalo.

- [ ] **Step 3: Implementar `account.ts`**

```ts
// lib/course-classroom/account.ts
import "server-only";
import { prisma } from "@repo/db";
import { createOpaqueToken, requireNormalizedIdentityEmail } from "@repo/auth";

/**
 * La cuenta de quien compra un curso.
 *
 * El curso se ve en el portal, así que el comprador necesita una cuenta. Se busca por el correo
 * de la inscripción; si no existe, se crea sin contraseña con `role: "CUSTOMER"`, igual que la
 * activación de socios (`app/actions/member-activation.ts`). Sin contraseña no hay login
 * posible: la cuenta no da acceso a nada hasta que su dueño elija una (o entre con Google).
 *
 * Si alguien compra con un correo ajeno, el enlace para crear la contraseña le llega al dueño
 * de ese correo: nadie se queda con la cuenta de otro.
 */

export const DIAS_ENLACE_CONTRASENA = 7;

export type CuentaDelAlumno = { userId: number; creada: boolean; puedeEntrar: boolean };

export type CuentaDeps = {
  buscar: (
    email: string,
  ) => Promise<{ id: number; password: string | null; googleId: string | null; isBlocked: boolean } | null>;
  crear: (email: string) => Promise<{ id: number }>;
};

function cuentaDepsPorDefecto(): CuentaDeps {
  return {
    buscar: (email) =>
      prisma.user.findUnique({
        where: { email },
        select: { id: true, password: true, googleId: true, isBlocked: true },
      }),
    // `upsert` y no `create`: dos avisos de pago simultáneos no pueden producir dos cuentas.
    crear: (email) =>
      prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, role: "CUSTOMER" },
        select: { id: true },
      }),
  };
}

export async function asegurarCuentaDelAlumno(
  emailCrudo: string,
  deps: CuentaDeps = cuentaDepsPorDefecto(),
): Promise<CuentaDelAlumno | null> {
  let email: string;
  try {
    email = requireNormalizedIdentityEmail(emailCrudo);
  } catch {
    return null;
  }

  const existente = await deps.buscar(email);
  if (existente) {
    if (existente.isBlocked) return null;
    return {
      userId: existente.id,
      creada: false,
      puedeEntrar: Boolean(existente.password) || Boolean(existente.googleId),
    };
  }
  const creada = await deps.crear(email);
  return { userId: creada.id, creada: true, puedeEntrar: false };
}

export type EnlaceDeps = {
  guardar: (fila: { userId: number; tokenHash: string; expiresAt: Date }) => Promise<void>;
};

function enlaceDepsPorDefecto(): EnlaceDeps {
  return {
    guardar: async (fila) => {
      await prisma.passwordResetToken.create({ data: fila });
    },
  };
}

/**
 * El enlace del correo de bienvenida para elegir la contraseña.
 *
 * No usa `requestPasswordReset` de `@repo/auth` por dos razones: manda su propio correo (y la
 * persona recibiría dos) y su enlace vence en una hora, que para una bienvenida no alcanza.
 * Crea la misma fila (`PasswordResetToken`) con 7 días: `/recuperar/[token]` la acepta igual.
 */
export async function crearEnlaceParaContrasena(
  userId: number,
  base: string,
  ahora: Date = new Date(),
  deps: EnlaceDeps = enlaceDepsPorDefecto(),
): Promise<string> {
  const { rawToken, tokenHash } = createOpaqueToken();
  const expiresAt = new Date(ahora.getTime() + DIAS_ENLACE_CONTRASENA * 24 * 60 * 60 * 1000);
  await deps.guardar({ userId, tokenHash, expiresAt });
  return `${base.replace(/\/+$/, "")}/recuperar/${rawToken}`;
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/course-classroom/account.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Agregar los tests de los correos nuevos a `email.test.ts`**

Sumá los imports `buildCursoEnTuPortalEmailBody` y `buildBienvenidaAlumnoEmailBody`.

```ts
describe("correo: el curso ya está en tu portal", () => {
  const base = {
    studentName: "Ana <b>",
    courseTitle: "Retrato",
    portalUrl: "https://fotoffice.com/portal/cursos",
    expiresAt: new Date(Date.UTC(2027, 9, 4, 2)),
    invitacion: null,
  };

  it("lleva el botón al portal y el vencimiento en fecha argentina", () => {
    const { html, text } = buildCursoEnTuPortalEmailBody(base, null);
    expect(html).toContain('href="https://fotoffice.com/portal/cursos"');
    expect(text).toContain("https://fotoffice.com/portal/cursos");
    expect(text).toContain("3 de octubre de 2027");
    expect(html).toContain("Ana &lt;b&gt;");
  });

  it("sin vencimiento (beneficio) no inventa una fecha", () => {
    const { text } = buildCursoEnTuPortalEmailBody({ ...base, expiresAt: null }, null);
    expect(text).not.toMatch(/hasta el/);
  });

  it("con invitación, suma la línea para asociarse", () => {
    const { html, text } = buildCursoEnTuPortalEmailBody(
      { ...base, invitacion: { institucion: "SFPR", url: "https://fotoffice.com/w/sfpr/asociarse" } },
      null,
    );
    expect(html).toContain('href="https://fotoffice.com/w/sfpr/asociarse"');
    expect(text).toContain("Hacete socio de SFPR");
  });
});

describe("correo: bienvenida con creación de contraseña", () => {
  const base = {
    studentName: "Ana",
    courseTitle: "Retrato",
    crearContrasenaUrl: "https://fotoffice.com/recuperar/tok",
    loginUrl: "https://fotoffice.com/login?next=/portal/cursos",
    expiresAt: new Date(Date.UTC(2027, 9, 4, 2)),
    invitacion: null,
  };

  it("lleva el botón para crear la contraseña y la alternativa de entrar", () => {
    const { html, text } = buildBienvenidaAlumnoEmailBody(base, null);
    expect(html).toContain('href="https://fotoffice.com/recuperar/tok"');
    expect(html).toContain('href="https://fotoffice.com/login?next=/portal/cursos"');
    expect(text).toContain("Crear mi contraseña");
    expect(text).toContain("Google");
  });

  it("la firma entra una sola vez", () => {
    const firma = { html: "<p>Firma SFPR</p>", text: "Firma SFPR" };
    const { html, text } = buildBienvenidaAlumnoEmailBody(base, firma);
    expect(html.split("Firma SFPR").length - 1).toBe(1);
    expect(text.split("Firma SFPR").length - 1).toBe(1);
  });
});
```

- [ ] **Step 6: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-classroom/email.test.ts`
Expected: FAIL — `buildCursoEnTuPortalEmailBody is not a function`.

- [ ] **Step 7: Implementar en `email.ts` (al final, sin tocar lo existente)**

```ts
export type InvitacionASociarse = { institucion: string; url: string };

function bloqueInvitacion(invitacion: InvitacionASociarse | null): { html: string; text: string[] } {
  if (!invitacion) return { html: "", text: [] };
  const institucion = escaparHtml(invitacion.institucion);
  return {
    html: `\n  <p>¿Todavía no sos socio? <a href="${escaparHtml(invitacion.url)}">Hacete socio de ${institucion}</a>.</p>`,
    text: ["", `¿Todavía no sos socio? Hacete socio de ${invitacion.institucion}: ${invitacion.url}`],
  };
}

function lineaVencimiento(expiresAt: Date | null): string | null {
  return expiresAt ? `Tenés acceso hasta el ${fechaLegibleArgentina(expiresAt)}.` : null;
}

function firmaHtml(signature: RenderedEmailSignature | null): string {
  return signature ? `\n  <div id="fo-signature" style="margin-top:16px;">${signature.html}</div>` : "";
}

type CursoEnTuPortalInput = {
  studentName: string;
  courseTitle: string;
  portalUrl: string;
  expiresAt: Date | null;
  invitacion: InvitacionASociarse | null;
};

/** Para quien ya tiene cómo entrar al portal: el curso apareció ahí. */
export function buildCursoEnTuPortalEmailBody(
  input: CursoEnTuPortalInput,
  signature: RenderedEmailSignature | null,
): { html: string; text: string } {
  const nombre = escaparHtml(input.studentName);
  const curso = escaparHtml(input.courseTitle);
  const vence = lineaVencimiento(input.expiresAt);
  const invitacion = bloqueInvitacion(input.invitacion);

  const html = `
<div>
  <p>Hola ${nombre},</p>
  <p><strong>${curso}</strong> ya está en tu portal.</p>
  <p><a href="${escaparHtml(input.portalUrl)}">Ir a mis cursos</a></p>${vence ? `\n  <p>${vence}</p>` : ""}${invitacion.html}
  <p>Gracias por elegirnos.</p>${firmaHtml(signature)}
</div>
`.trim();

  const text = [
    `Hola ${input.studentName},`,
    "",
    `${input.courseTitle} ya está en tu portal.`,
    "",
    `Ir a mis cursos: ${input.portalUrl}`,
    ...(vence ? [vence] : []),
    ...invitacion.text,
    "",
    "Gracias por elegirnos.",
    ...(signature ? ["", signature.text] : []),
  ].join("\n");

  return { html, text };
}

type BienvenidaInput = {
  studentName: string;
  courseTitle: string;
  crearContrasenaUrl: string;
  loginUrl: string;
  expiresAt: Date | null;
  invitacion: InvitacionASociarse | null;
};

/** Para quien todavía no puede entrar: elige su contraseña (o entra con Google) y ve el curso. */
export function buildBienvenidaAlumnoEmailBody(
  input: BienvenidaInput,
  signature: RenderedEmailSignature | null,
): { html: string; text: string } {
  const nombre = escaparHtml(input.studentName);
  const curso = escaparHtml(input.courseTitle);
  const vence = lineaVencimiento(input.expiresAt);
  const invitacion = bloqueInvitacion(input.invitacion);

  const html = `
<div>
  <p>Hola ${nombre},</p>
  <p>Tu pago fue aprobado. <strong>${curso}</strong> te espera en tu portal.</p>
  <p>Para entrar, elegí tu contraseña:</p>
  <p><a href="${escaparHtml(input.crearContrasenaUrl)}">Crear mi contraseña</a></p>
  <p>Si usás Gmail, también podés <a href="${escaparHtml(input.loginUrl)}">entrar con Google</a> usando este mismo correo.</p>${vence ? `\n  <p>${vence}</p>` : ""}${invitacion.html}
  <p>Gracias por elegirnos.</p>${firmaHtml(signature)}
</div>
`.trim();

  const text = [
    `Hola ${input.studentName},`,
    "",
    `Tu pago fue aprobado. ${input.courseTitle} te espera en tu portal.`,
    "",
    `Crear mi contraseña: ${input.crearContrasenaUrl}`,
    `O entrar con Google usando este mismo correo: ${input.loginUrl}`,
    ...(vence ? ["", vence] : []),
    ...invitacion.text,
    "",
    "Gracias por elegirnos.",
    ...(signature ? ["", signature.text] : []),
  ].join("\n");

  return { html, text };
}

export async function sendCursoEnTuPortalEmail(
  input: CursoEnTuPortalInput & { to: string; signature?: RenderedEmailSignature | null },
): Promise<{ sent: true } | { sent: false; reason: string }> {
  const { html, text } = buildCursoEnTuPortalEmailBody(input, input.signature ?? null);
  const outcome = await sendTransactionalEmail({
    to: input.to,
    subject: `Tu curso ya está en tu portal: ${input.courseTitle}`,
    html,
    text,
  });
  return outcome.status === "SENT" ? { sent: true } : { sent: false, reason: outcome.detail };
}

export async function sendBienvenidaAlumnoEmail(
  input: BienvenidaInput & { to: string; signature?: RenderedEmailSignature | null },
): Promise<{ sent: true } | { sent: false; reason: string }> {
  const { html, text } = buildBienvenidaAlumnoEmailBody(input, input.signature ?? null);
  const outcome = await sendTransactionalEmail({
    to: input.to,
    subject: `Bienvenido: tu acceso a ${input.courseTitle}`,
    html,
    text,
  });
  return outcome.status === "SENT" ? { sent: true } : { sent: false, reason: outcome.detail };
}
```

- [ ] **Step 8: Correr los tests y verlos pasar**

Run: `pnpm --filter fotoffice test lib/course-classroom`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/course-classroom/account.ts lib/course-classroom/account.test.ts lib/course-classroom/email.ts lib/course-classroom/email.test.ts
git commit -m "Cursos en el portal: la cuenta del comprador y los correos de bienvenida"
```

---

### Task 3: El acceso es de la persona

El cambio de fondo: el acceso deja de llevar un token y pasa a llevar la cuenta. Todo lo que
dependía del token se borra en esta misma tarea, para que la rama nunca quede sin compilar.

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelos `User`, `Course`, `CourseAccess`; enum `CourseEnrollmentPaymentMethod`)
- Modify (regenerar): `packages/db/prisma/migrations/20261004120000_cursos_aula_alumno/migration.sql`
- Create: `lib/course-classroom/alumno.ts`, `lib/course-classroom/alumno.test.ts`
- Modify: `lib/course-classroom/grant.ts`, `lib/course-classroom/grant.test.ts`, `lib/course-classroom/grant-otorgar.test.ts`
- Modify: `lib/course-classroom/email.ts`, `email.test.ts` (borrar lo viejo), `access-rules.ts`, `access-rules.test.ts` (borrar `estadoDelAcceso`)
- Modify: `app/w/[workspaceSlug]/cursos/[courseSlug]/inscripcion/success/page.tsx`
- Delete: `lib/course-classroom/lookup.ts`, `app/aula/` (entero), `app/api/aula/` (entero), `app/actions/course-classroom.ts`

**Interfaces:**
- Consumes: `asegurarCuentaDelAlumno`, `crearEnlaceParaContrasena` (Task 2); `sendCursoEnTuPortalEmail`, `sendBienvenidaAlumnoEmail`, `type InvitacionASociarse` (Task 2); `calcularVencimiento`; `appUrl()` de `@/lib/app-url`.
- Produces (esquema):
  - `CourseAccess { id, workspaceId, courseId, enrollmentId @unique, userId Int, origin CourseAccessOrigin @default(PURCHASE), grantedAt, expiresAt DateTime?, revokedAt?, createdAt, updatedAt }` con `@@unique([userId, courseId])`; relación `User.courseAccesses`.
  - `enum CourseAccessOrigin { PURCHASE MEMBER_BENEFIT }`; `Course.freeForMembers Boolean @default(false)`; `CourseEnrollmentPaymentMethod` suma `MEMBER_BENEFIT`.
- Produces (`grant.ts`):
  - `type OtorgarResultado = { ok: true; accessId: string; expiresAt: Date | null; nuevo: boolean } | { ok: false; reason: "inscripcion_no_encontrada" | "inscripcion_no_aprobada" | "no_es_grabado" }`
  - `otorgarAccesoPorCompra(input: { enrollmentId: string; userId: number }, ahora?: Date): Promise<OtorgarResultado>`
  - `type AvisoDeps = { asegurarCuenta: typeof asegurarCuentaDelAlumno; otorgar: typeof otorgarAccesoPorCompra; invitacionASociarse: (workspaceId: string, userId: number) => Promise<InvitacionASociarse | null>; crearEnlaceContrasena: (userId: number, base: string) => Promise<string>; enviarCursoListo: typeof sendCursoEnTuPortalEmail; enviarBienvenida: typeof sendBienvenidaAlumnoEmail; cargarFirma: (workspaceId: string) => Promise<RenderedEmailSignature | null>; base: string }`
  - `avisarAccesoAlAula(input: { enrollmentId: string; workspaceId: string; to: string; studentName: string; courseTitle: string }, deps?: AvisoDeps): Promise<{ avisado: boolean; motivo?: string }>` — misma firma de entrada que hoy; nunca lanza.
- Produces (`alumno.ts`):
  - `tieneCursos(userId: number): Promise<boolean>`
  - `type PendientesDeps = { buscarPendientes: (userId: number) => Promise<string[]>; otorgar: (input: { enrollmentId: string; userId: number }) => Promise<unknown> }`
  - `otorgarAccesosPendientes(userId: number, deps?: PendientesDeps): Promise<number>`

- [ ] **Step 1: Cambiar el esquema**

En `model CourseAccess`, reemplazá el comentario de cabecera y los campos por:

```prisma
/// El acceso de una persona a un curso grabado.
///
/// Es de la **cuenta** (`userId`): el curso se ve en el portal con usuario y contraseña. Puede
/// venir de una compra (`PURCHASE`, vence según `Course.accessMonths`) o de ser socio
/// (`MEMBER_BENEFIT`, sin vencimiento: vale mientras sea socio activo). La regla vive en
/// `lib/course-classroom/access-rules.ts` (`estadoDeAccesoAlCurso`).
model CourseAccess {
  id           String                 @id @default(cuid())
  workspaceId  String
  courseId     String
  /// La inscripción que lo originó. Si una persona compra un curso que tenía de beneficio, el
  /// acceso pasa a la inscripción paga.
  enrollmentId String                 @unique
  userId       Int
  origin       CourseAccessOrigin     @default(PURCHASE)
  grantedAt    DateTime               @default(now())
  /// Null en los de beneficio de socio.
  expiresAt    DateTime?
  revokedAt    DateTime?
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt
  workspace    Workspace              @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  course       Course                 @relation(fields: [courseId], references: [id], onDelete: Cascade)
  enrollment   CourseEnrollment       @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  user         User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  progress     CourseLessonProgress[]

  /// Una persona, un acceso por curso: su avance no se parte en dos.
  @@unique([userId, courseId])
  @@index([workspaceId, courseId])
}
```

Junto a los otros enums de cursos (después de `enum CourseLessonVideoStatus`):

```prisma
enum CourseAccessOrigin {
  PURCHASE
  MEMBER_BENEFIT
}
```

En `enum CourseEnrollmentPaymentMethod`, debajo de `MERCADO_PAGO`, agregá `MEMBER_BENEFIT`.

En `model Course`, debajo de `completionPercent`:

```prisma
  /// El socio activo de la institución lo toma gratis desde su portal; el público lo paga.
  freeForMembers        Boolean            @default(false)
```

En `model User` (empieza en la línea ~36), junto a las otras listas de relaciones, agregá
`courseAccesses CourseAccess[]`.

- [ ] **Step 2: Validar, generar y regenerar el SQL de la migración**

Desde `packages/db` (si `validate` pide `DATABASE_URL`/`DIRECT_URL`, pasá valores falsos en el
comando: no se conecta a nada):

```bash
pnpm exec prisma validate && pnpm exec prisma generate
git show origin/main:packages/db/prisma/schema.prisma > /private/tmp/claude-501/schema-anterior.prisma
pnpm exec prisma migrate diff --from-schema-datamodel /private/tmp/claude-501/schema-anterior.prisma --to-schema-datamodel prisma/schema.prisma --script > /private/tmp/claude-501/migracion.sql
```

Reemplazá **todo** el contenido de
`prisma/migrations/20261004120000_cursos_aula_alumno/migration.sql` por esa salida. Revisala:
tiene que crear `CourseAccess` (con `userId`, `origin`, `expiresAt` nullable, sin `tokenHash`),
`CourseLessonProgress`, el enum `CourseAccessOrigin`, agregar `MEMBER_BENEFIT` a
`CourseEnrollmentPaymentMethod` (`ALTER TYPE ... ADD VALUE`), la columna `Course.freeForMembers`,
los índices (incluido `CourseAccess_userId_courseId_key`) y las claves foráneas, entre ellas
`CourseAccess_userId_fkey` hacia `"User"`. **Nada más**: si aparece algo ajeno a esto, alguien
tocó el esquema en otra rama; sacalo y avisá. No apliques la migración en ninguna base.

- [ ] **Step 3: Borrar lo que dependía del token**

```bash
git rm -r app/aula app/api/aula app/actions/course-classroom.ts lib/course-classroom/lookup.ts
```

En `email.ts` borrá `enlaceDelAula`, `buildClassroomAccessEmailBody`, `sendClassroomAccessEmail`
y el tipo `CuerpoInput` (y sus tests en `email.test.ts`). Conservá `escaparHtml`.

En `access-rules.ts` borrá `estadoDelAcceso` y `type EstadoAcceso` (y sus tests).

`"aula"` se queda en `RESERVED_SLUGS` y en `FOTOFFICE_ONLY_SEGMENTS`: reservar un nombre que
ya no se usa no rompe nada, y evita que una institución lo tome.

- [ ] **Step 4: Escribir el test de `otorgarAccesoPorCompra`**

Reemplazá el contenido de `grant-otorgar.test.ts` por:

```ts
// lib/course-classroom/grant-otorgar.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@repo/db";

const m = vi.hoisted(() => ({
  enrollmentFindUnique: vi.fn(),
  accessFindUnique: vi.fn(),
  accessCreate: vi.fn(),
  accessUpdate: vi.fn(),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    prisma: {
      courseEnrollment: { findUnique: m.enrollmentFindUnique },
      courseAccess: { findUnique: m.accessFindUnique, create: m.accessCreate, update: m.accessUpdate },
    },
  };
});

const { otorgarAccesoPorCompra } = await import("./grant");

const ahora = new Date(Date.UTC(2026, 9, 4, 12));
const inscripcion = {
  id: "insc-1",
  workspaceId: "ws-1",
  courseId: "curso-1",
  paymentStatus: "APPROVED",
  course: { deliveryMode: "RECORDED", accessMonths: 12 },
};

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.enrollmentFindUnique.mockResolvedValue(inscripcion);
  m.accessFindUnique.mockResolvedValue(null);
  m.accessCreate.mockResolvedValue({ id: "acc-1" });
  m.accessUpdate.mockResolvedValue({ id: "acc-1" });
});

describe("otorgar el acceso por una compra", () => {
  it("crea el acceso de la persona, con vencimiento", async () => {
    const r = await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora);
    expect(r).toEqual({ ok: true, accessId: "acc-1", expiresAt: new Date(Date.UTC(2027, 9, 4, 12)), nuevo: true });
    expect(m.accessCreate.mock.calls[0][0].data).toMatchObject({
      userId: 7,
      enrollmentId: "insc-1",
      courseId: "curso-1",
      origin: "PURCHASE",
    });
  });

  it("no aprobada, no grabada o inexistente: no da nada", async () => {
    m.enrollmentFindUnique.mockResolvedValueOnce({ ...inscripcion, paymentStatus: "PENDING" });
    expect(await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora)).toEqual({ ok: false, reason: "inscripcion_no_aprobada" });
    m.enrollmentFindUnique.mockResolvedValueOnce({ ...inscripcion, course: { deliveryMode: "PRESENCIAL", accessMonths: 12 } });
    expect(await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora)).toEqual({ ok: false, reason: "no_es_grabado" });
    m.enrollmentFindUnique.mockResolvedValueOnce(null);
    expect(await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora)).toEqual({ ok: false, reason: "inscripcion_no_encontrada" });
    expect(m.accessCreate).not.toHaveBeenCalled();
  });

  it("el mismo aviso de pago dos veces no duplica nada", async () => {
    m.accessFindUnique.mockResolvedValue({ id: "acc-1", enrollmentId: "insc-1", origin: "PURCHASE", expiresAt: new Date(Date.UTC(2027, 9, 4, 12)) });
    const r = await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora);
    expect(r).toMatchObject({ ok: true, nuevo: false });
    expect(m.accessCreate).not.toHaveBeenCalled();
    expect(m.accessUpdate).not.toHaveBeenCalled();
  });

  it("si lo tenía de beneficio y lo compra, pasa a comprado con vencimiento", async () => {
    m.accessFindUnique.mockResolvedValue({ id: "acc-1", enrollmentId: "insc-gratis", origin: "MEMBER_BENEFIT", expiresAt: null });
    const r = await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora);
    expect(r).toMatchObject({ ok: true, accessId: "acc-1", nuevo: true });
    expect(m.accessUpdate.mock.calls[0][0].data).toMatchObject({
      origin: "PURCHASE",
      enrollmentId: "insc-1",
      expiresAt: new Date(Date.UTC(2027, 9, 4, 12)),
      revokedAt: null,
    });
  });

  it("si lo vuelve a comprar antes de que venza, gana el vencimiento más lejano", async () => {
    const masLejos = new Date(Date.UTC(2028, 0, 1));
    m.accessFindUnique.mockResolvedValue({ id: "acc-1", enrollmentId: "insc-0", origin: "PURCHASE", expiresAt: masLejos });
    await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora);
    expect(m.accessUpdate.mock.calls[0][0].data.expiresAt).toEqual(masLejos);
  });

  it("si otro pedido lo creó al mismo tiempo (P2002), lo toma como existente", async () => {
    m.accessCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("único", { code: "P2002", clientVersion: "x" }),
    );
    m.accessFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "acc-9", enrollmentId: "insc-1", origin: "PURCHASE", expiresAt: null });
    expect(await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora)).toMatchObject({ ok: true, accessId: "acc-9", nuevo: false });
  });
});
```

- [ ] **Step 5: Escribir el test del aviso**

Reemplazá el contenido de `grant.test.ts` por:

```ts
// lib/course-classroom/grant.test.ts
import { describe, expect, it, vi } from "vitest";
import { avisarAccesoAlAula, type AvisoDeps } from "./grant";

const input = { enrollmentId: "insc-1", workspaceId: "ws-1", to: "ana@example.com", studentName: "Ana", courseTitle: "Retrato" };
const vence = new Date(Date.UTC(2027, 9, 4));

function deps(parcial: Partial<AvisoDeps> = {}): AvisoDeps {
  return {
    asegurarCuenta: vi.fn().mockResolvedValue({ userId: 7, creada: false, puedeEntrar: true }),
    otorgar: vi.fn().mockResolvedValue({ ok: true, accessId: "acc-1", expiresAt: vence, nuevo: true }),
    invitacionASociarse: vi.fn().mockResolvedValue(null),
    crearEnlaceContrasena: vi.fn().mockResolvedValue("https://fotoffice.com/recuperar/tok"),
    enviarCursoListo: vi.fn().mockResolvedValue({ sent: true }),
    enviarBienvenida: vi.fn().mockResolvedValue({ sent: true }),
    cargarFirma: vi.fn().mockResolvedValue(null),
    base: "https://fotoffice.com",
    ...parcial,
  };
}

describe("avisar el acceso", () => {
  it("quien ya puede entrar recibe 'ya está en tu portal'", async () => {
    const d = deps();
    expect(await avisarAccesoAlAula(input, d)).toEqual({ avisado: true });
    expect(d.otorgar).toHaveBeenCalledWith({ enrollmentId: "insc-1", userId: 7 });
    expect(d.enviarCursoListo).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@example.com", portalUrl: "https://fotoffice.com/portal/cursos", expiresAt: vence }),
    );
    expect(d.enviarBienvenida).not.toHaveBeenCalled();
    expect(d.crearEnlaceContrasena).not.toHaveBeenCalled();
  });

  it("quien no puede entrar recibe la bienvenida con el enlace para crear la contraseña", async () => {
    const d = deps({ asegurarCuenta: vi.fn().mockResolvedValue({ userId: 8, creada: true, puedeEntrar: false }) });
    expect(await avisarAccesoAlAula(input, d)).toEqual({ avisado: true });
    expect(d.crearEnlaceContrasena).toHaveBeenCalledWith(8, "https://fotoffice.com");
    expect(d.enviarBienvenida).toHaveBeenCalledWith(
      expect.objectContaining({
        crearContrasenaUrl: "https://fotoffice.com/recuperar/tok",
        loginUrl: "https://fotoffice.com/login?next=/portal/cursos",
      }),
    );
  });

  it("lleva la invitación a asociarse cuando corresponde", async () => {
    const invitacion = { institucion: "SFPR", url: "https://fotoffice.com/w/sfpr/asociarse" };
    const d = deps({ invitacionASociarse: vi.fn().mockResolvedValue(invitacion) });
    await avisarAccesoAlAula(input, d);
    expect(d.invitacionASociarse).toHaveBeenCalledWith("ws-1", 7);
    expect(d.enviarCursoListo).toHaveBeenCalledWith(expect.objectContaining({ invitacion }));
  });

  it("un acceso que ya existía no manda otro correo", async () => {
    const d = deps({ otorgar: vi.fn().mockResolvedValue({ ok: true, accessId: "acc-1", expiresAt: vence, nuevo: false }) });
    expect((await avisarAccesoAlAula(input, d)).avisado).toBe(false);
    expect(d.enviarCursoListo).not.toHaveBeenCalled();
  });

  it("sin cuenta posible (correo inválido o bloqueada) no otorga ni manda", async () => {
    const d = deps({ asegurarCuenta: vi.fn().mockResolvedValue(null) });
    expect(await avisarAccesoAlAula(input, d)).toEqual({ avisado: false, motivo: "sin_cuenta" });
    expect(d.otorgar).not.toHaveBeenCalled();
  });

  it("sin dirección de la aplicación no hace nada", async () => {
    const d = deps({ base: "" });
    expect(await avisarAccesoAlAula(input, d)).toEqual({ avisado: false, motivo: "sin_app_url" });
    expect(d.asegurarCuenta).not.toHaveBeenCalled();
  });

  it("nunca lanza: el pago ya está aprobado", async () => {
    const d = deps({ otorgar: vi.fn().mockRejectedValue(new Error("base caída")) });
    await expect(avisarAccesoAlAula(input, d)).resolves.toEqual({ avisado: false, motivo: "error" });
  });

  it("un correo rechazado se informa sin lanzar", async () => {
    const d = deps({ enviarCursoListo: vi.fn().mockResolvedValue({ sent: false, reason: "rechazado" }) });
    expect(await avisarAccesoAlAula(input, d)).toEqual({ avisado: false, motivo: "rechazado" });
  });
});
```

- [ ] **Step 6: Correrlos y ver que fallan**

Run: `pnpm --filter fotoffice test lib/course-classroom/grant.test.ts lib/course-classroom/grant-otorgar.test.ts`
Expected: FAIL — `otorgarAccesoPorCompra is not a function` y aserciones de `AvisoDeps`.

- [ ] **Step 7: Reescribir `grant.ts`**

Reemplazá todo el archivo por:

```ts
// lib/course-classroom/grant.ts
import "server-only";
import { Prisma, prisma } from "@repo/db";
import type { RenderedEmailSignature } from "@repo/communications/signature";
import { loadWorkspaceSignature } from "@/lib/communications/load-workspace-signature";
import { logCourseEvent } from "@/lib/presential-courses/log";
import { appUrl } from "@/lib/app-url";
import { calcularVencimiento } from "./access-rules";
import { asegurarCuentaDelAlumno, crearEnlaceParaContrasena } from "./account";
import { sendBienvenidaAlumnoEmail, sendCursoEnTuPortalEmail, type InvitacionASociarse } from "./email";

export type OtorgarResultado =
  | { ok: true; accessId: string; expiresAt: Date | null; nuevo: boolean }
  | { ok: false; reason: "inscripcion_no_encontrada" | "inscripcion_no_aprobada" | "no_es_grabado" };

/**
 * Da a una persona el acceso que pagó.
 *
 * Idempotente por inscripción: el mismo aviso de pago dos veces no duplica nada. Si la persona
 * ya tenía el curso —de beneficio de socio, o de una compra anterior— el acceso existente pasa
 * a esta compra (`@@unique([userId, courseId])`): no se parte el avance. Lo pagado no depende
 * de ser socio, y el vencimiento nunca se acorta.
 */
export async function otorgarAccesoPorCompra(
  input: { enrollmentId: string; userId: number },
  ahora: Date = new Date(),
): Promise<OtorgarResultado> {
  const inscripcion = await prisma.courseEnrollment.findUnique({
    where: { id: input.enrollmentId },
    select: {
      id: true,
      workspaceId: true,
      courseId: true,
      paymentStatus: true,
      course: { select: { deliveryMode: true, accessMonths: true } },
    },
  });
  if (!inscripcion) return { ok: false, reason: "inscripcion_no_encontrada" };
  if (inscripcion.paymentStatus !== "APPROVED") return { ok: false, reason: "inscripcion_no_aprobada" };
  if (inscripcion.course.deliveryMode !== "RECORDED") return { ok: false, reason: "no_es_grabado" };

  const clave = { userId_courseId: { userId: input.userId, courseId: inscripcion.courseId } };
  const vence = calcularVencimiento(ahora, inscripcion.course.accessMonths);
  const existente = await prisma.courseAccess.findUnique({
    where: clave,
    select: { id: true, enrollmentId: true, origin: true, expiresAt: true },
  });

  if (existente) {
    if (existente.enrollmentId === inscripcion.id) {
      return { ok: true, accessId: existente.id, expiresAt: existente.expiresAt, nuevo: false };
    }
    const expiresAt =
      existente.origin === "PURCHASE" && existente.expiresAt && existente.expiresAt > vence
        ? existente.expiresAt
        : vence;
    await prisma.courseAccess.update({
      where: { id: existente.id },
      data: { origin: "PURCHASE", enrollmentId: inscripcion.id, expiresAt, revokedAt: null },
    });
    return { ok: true, accessId: existente.id, expiresAt, nuevo: true };
  }

  try {
    const creado = await prisma.courseAccess.create({
      data: {
        workspaceId: inscripcion.workspaceId,
        courseId: inscripcion.courseId,
        enrollmentId: inscripcion.id,
        userId: input.userId,
        origin: "PURCHASE",
        grantedAt: ahora,
        expiresAt: vence,
      },
      select: { id: true },
    });
    return { ok: true, accessId: creado.id, expiresAt: vence, nuevo: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const ganador = await prisma.courseAccess.findUnique({
        where: clave,
        select: { id: true, expiresAt: true },
      });
      if (ganador) return { ok: true, accessId: ganador.id, expiresAt: ganador.expiresAt, nuevo: false };
    }
    throw error;
  }
}

export type AvisoDeps = {
  asegurarCuenta: typeof asegurarCuentaDelAlumno;
  otorgar: typeof otorgarAccesoPorCompra;
  invitacionASociarse: (workspaceId: string, userId: number) => Promise<InvitacionASociarse | null>;
  crearEnlaceContrasena: (userId: number, base: string) => Promise<string>;
  enviarCursoListo: typeof sendCursoEnTuPortalEmail;
  enviarBienvenida: typeof sendBienvenidaAlumnoEmail;
  cargarFirma: (workspaceId: string) => Promise<RenderedEmailSignature | null>;
  base: string;
};

function depsPorDefecto(): AvisoDeps {
  return {
    asegurarCuenta: (email) => asegurarCuentaDelAlumno(email),
    otorgar: (input) => otorgarAccesoPorCompra(input),
    // La Task 8 conecta la invitación real. Hasta entonces, sin invitación.
    invitacionASociarse: async () => null,
    crearEnlaceContrasena: (userId, base) => crearEnlaceParaContrasena(userId, base),
    enviarCursoListo: sendCursoEnTuPortalEmail,
    enviarBienvenida: sendBienvenidaAlumnoEmail,
    cargarFirma: loadWorkspaceSignature,
    base: appUrl(),
  };
}

/**
 * Después de aprobarse el pago de un curso grabado: cuenta, acceso y un solo correo.
 *
 * **Nunca lanza**: se llama con el pago ya aprobado, y nada de esto puede deshacerlo. Si algo
 * falla, la persona igual puede entrar con "Olvidé mi contraseña", y Mis cursos le otorga el
 * acceso que falte (`otorgarAccesosPendientes`).
 */
export async function avisarAccesoAlAula(
  input: { enrollmentId: string; workspaceId: string; to: string; studentName: string; courseTitle: string },
  deps: AvisoDeps = depsPorDefecto(),
): Promise<{ avisado: boolean; motivo?: string }> {
  try {
    if (!deps.base) {
      logCourseEvent("aula_sin_aviso", { enrollmentId: input.enrollmentId, motivo: "sin_app_url" });
      return { avisado: false, motivo: "sin_app_url" };
    }
    const cuenta = await deps.asegurarCuenta(input.to);
    if (!cuenta) {
      logCourseEvent("aula_sin_aviso", { enrollmentId: input.enrollmentId, motivo: "sin_cuenta" });
      return { avisado: false, motivo: "sin_cuenta" };
    }
    const acceso = await deps.otorgar({ enrollmentId: input.enrollmentId, userId: cuenta.userId });
    if (!acceso.ok || !acceso.nuevo) {
      const motivo = acceso.ok ? "ya_existia" : acceso.reason;
      logCourseEvent("aula_sin_aviso", { enrollmentId: input.enrollmentId, motivo });
      return { avisado: false, motivo };
    }

    const [invitacion, firma] = await Promise.all([
      deps.invitacionASociarse(input.workspaceId, cuenta.userId),
      deps.cargarFirma(input.workspaceId),
    ]);
    const comun = {
      to: input.to,
      studentName: input.studentName,
      courseTitle: input.courseTitle,
      expiresAt: acceso.expiresAt,
      invitacion,
      signature: firma,
    };
    const envio = cuenta.puedeEntrar
      ? await deps.enviarCursoListo({ ...comun, portalUrl: `${deps.base}/portal/cursos` })
      : await deps.enviarBienvenida({
          ...comun,
          crearContrasenaUrl: await deps.crearEnlaceContrasena(cuenta.userId, deps.base),
          loginUrl: `${deps.base}/login?next=/portal/cursos`,
        });

    if (!envio.sent) {
      logCourseEvent("aula_correo_no_enviado", { enrollmentId: input.enrollmentId, motivo: envio.reason });
      return { avisado: false, motivo: envio.reason };
    }
    logCourseEvent("aula_acceso_avisado", {
      enrollmentId: input.enrollmentId,
      workspaceId: input.workspaceId,
      cuentaNueva: cuenta.creada,
    });
    return { avisado: true };
  } catch (error) {
    console.error("[fotoffice][cursos] no se pudo dar el acceso al curso", {
      enrollmentId: input.enrollmentId,
      motivo: error instanceof Error ? error.message : "desconocido",
    });
    return { avisado: false, motivo: "error" };
  }
}
```

- [ ] **Step 8: Correr los tests del aviso y verlos pasar**

Run: `pnpm --filter fotoffice test lib/course-classroom/grant.test.ts lib/course-classroom/grant-otorgar.test.ts`
Expected: PASS (8 + 6 tests).

- [ ] **Step 9: Escribir el test de `alumno.ts`**

```ts
// lib/course-classroom/alumno.test.ts
import { describe, expect, it, vi } from "vitest";
import { otorgarAccesosPendientes } from "./alumno";

describe("otorgar los accesos que faltan", () => {
  it("otorga cada inscripción pendiente a la persona", async () => {
    const otorgar = vi.fn().mockResolvedValue({ ok: true });
    const n = await otorgarAccesosPendientes(7, {
      buscarPendientes: vi.fn().mockResolvedValue(["insc-1", "insc-2"]),
      otorgar,
    });
    expect(n).toBe(2);
    expect(otorgar).toHaveBeenCalledWith({ enrollmentId: "insc-1", userId: 7 });
    expect(otorgar).toHaveBeenCalledWith({ enrollmentId: "insc-2", userId: 7 });
  });

  it("si una falla, sigue con las demás", async () => {
    const otorgar = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce({ ok: true });
    const n = await otorgarAccesosPendientes(7, {
      buscarPendientes: vi.fn().mockResolvedValue(["insc-1", "insc-2"]),
      otorgar,
    });
    expect(n).toBe(1);
  });
});
```

- [ ] **Step 10: Implementar `alumno.ts`**

```ts
// lib/course-classroom/alumno.ts
import "server-only";
import { prisma } from "@repo/db";
import { otorgarAccesoPorCompra } from "./grant";

/**
 * La persona como alumna: si tiene cursos y qué le falta otorgar.
 *
 * "Tener cursos" cuenta también una inscripción aprobada a un grabado que todavía no tiene su
 * acceso (porque algo falló después del pago): así esa persona igual entra al portal, y Mis
 * cursos se lo repara.
 */

async function correoDe(userId: number): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email ?? null;
}

export async function tieneCursos(userId: number): Promise<boolean> {
  const accesos = await prisma.courseAccess.count({ where: { userId } });
  if (accesos > 0) return true;
  const email = await correoDe(userId);
  if (!email) return false;
  const pendientes = await prisma.courseEnrollment.count({
    where: {
      email: { equals: email, mode: "insensitive" },
      paymentStatus: "APPROVED",
      course: { deliveryMode: "RECORDED" },
    },
  });
  return pendientes > 0;
}

export type PendientesDeps = {
  buscarPendientes: (userId: number) => Promise<string[]>;
  otorgar: (input: { enrollmentId: string; userId: number }) => Promise<unknown>;
};

function pendientesDepsPorDefecto(): PendientesDeps {
  return {
    buscarPendientes: async (userId) => {
      const email = await correoDe(userId);
      if (!email) return [];
      const filas = await prisma.courseEnrollment.findMany({
        where: {
          email: { equals: email, mode: "insensitive" },
          paymentStatus: "APPROVED",
          course: { deliveryMode: "RECORDED" },
          access: { is: null },
          // Una inscripción de beneficio nunca queda pendiente: se otorga en el mismo acto.
          paymentMethod: "MERCADO_PAGO",
        },
        select: { id: true },
      });
      return filas.map((f) => f.id);
    },
    otorgar: (input) => otorgarAccesoPorCompra(input),
  };
}

/** Devuelve cuántos otorgó. Nunca lanza por una inscripción: sigue con la siguiente. */
export async function otorgarAccesosPendientes(
  userId: number,
  deps: PendientesDeps = pendientesDepsPorDefecto(),
): Promise<number> {
  const pendientes = await deps.buscarPendientes(userId);
  let otorgados = 0;
  for (const enrollmentId of pendientes) {
    try {
      await deps.otorgar({ enrollmentId, userId });
      otorgados++;
    } catch (error) {
      console.error("[fotoffice][cursos] no se pudo otorgar un acceso pendiente", {
        enrollmentId,
        motivo: error instanceof Error ? error.message : "desconocido",
      });
    }
  }
  return otorgados;
}
```

- [ ] **Step 11: La pantalla de pago aprobado**

En `app/w/[workspaceSlug]/cursos/[courseSlug]/inscripcion/success/page.tsx`, en el bloque
`{approved && enrollment.course.deliveryMode === "RECORDED" ? (...) : null}`, reemplazá el
título, el párrafo y el enlace por:

```tsx
            <h2 className="font-semibold">Tu curso está en tu portal</h2>
            <p className="text-sm text-[var(--fo-muted)]">
              Te mandamos un correo con cómo entrar. Si ya tenés cuenta en el portal, entrá con
              tu usuario y contraseña de siempre.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/portal/cursos" className="fo-btn fo-btn-primary text-sm">
                Ir a mis cursos
              </Link>
              <Link href="/recuperar" className="text-sm text-[var(--fo-accent)] underline self-center">
                No tengo contraseña
              </Link>
            </div>
```

El correo de la persona ya no se muestra: esta página la abre cualquiera con el `enrollmentId`.

- [ ] **Step 12: Suite y tipos**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde y sin errores. Si algún test fuera de `lib/course-classroom` importaba lo
borrado (`reenviarEnlaces`, `lookup`, `estadoDelAcceso`), borrá esos casos y decilo en el reporte.
`enrollment-workflow-acceso.test.ts` simula `avisarAccesoAlAula`: debe seguir pasando sin cambios.

- [ ] **Step 13: Commit**

```bash
git add -A packages/db/prisma apps/fotoffice
git commit -m "Cursos en el portal: el acceso es de la persona, no de un enlace"
```

---

### Task 4: El portal acepta al alumno

**Files:**
- Create: `lib/portal/viewer.ts`, `lib/portal/viewer.test.ts`
- Modify: `lib/portal/user-kind.ts` (+ `user-kind.test.ts`), `lib/post-login.ts` (+ `post-login.test.ts`, `post-login-member.test.ts`)
- Modify: `lib/portal/menu.ts` (+ `menu.test.ts`), `components/portal/portal-shell.tsx`
- Modify: `app/portal/layout.tsx`, `app/portal/page.tsx`, `app/elegir-perfil/page.tsx`

**Interfaces:**
- Consumes: `loadPortalContext`, `type PortalContext` (`lib/portal/access.ts`); `tieneCursos` (Task 3).
- Produces:
  - `type PortalViewer = { kind: "MEMBER"; context: PortalContext } | { kind: "STUDENT"; userId: number; fullName: string; workspace: { id: string; name: string } }`
  - `type ViewerDeps = { cargarSocio: (userId: number) => Promise<PortalContext | null>; cargarAlumno: (userId: number) => Promise<{ fullName: string; workspace: { id: string; name: string } } | null> }`
  - `resolvePortalViewer(userId: number, deps?: ViewerDeps): Promise<PortalViewer | null>`
  - `FotofficeUserKind` suma `"STUDENT"`.
  - `resolveStudentPortalMenu(opciones: { asociarseHref: string | null }): ResolvedPortalItem[]`
  - `PortalShell` acepta `member.memberNumber: string | null`.

- [ ] **Step 1: Escribir el test de quién mira el portal**

```ts
// lib/portal/viewer.test.ts
import { describe, expect, it, vi } from "vitest";
import { resolvePortalViewer, type ViewerDeps } from "./viewer";

const socio = {
  member: { id: "m1", firstName: "Ana", lastName: "Paz", memberNumber: "12", joinedAt: new Date(0), categoryName: null },
  workspace: { id: "ws-1", name: "SFPR" },
};
const alumno = { fullName: "Ana Paz", workspace: { id: "ws-1", name: "SFPR" } };

function deps(s: unknown, a: unknown): ViewerDeps {
  return { cargarSocio: vi.fn().mockResolvedValue(s), cargarAlumno: vi.fn().mockResolvedValue(a) };
}

describe("quién mira el portal", () => {
  it("el socio activo es socio, tenga o no cursos", async () => {
    const d = deps(socio, alumno);
    expect(await resolvePortalViewer(7, d)).toEqual({ kind: "MEMBER", context: socio });
    expect(d.cargarAlumno).not.toHaveBeenCalled();
  });

  it("sin ficha de socio pero con cursos es alumno", async () => {
    expect(await resolvePortalViewer(7, deps(null, alumno))).toEqual({
      kind: "STUDENT",
      userId: 7,
      fullName: "Ana Paz",
      workspace: { id: "ws-1", name: "SFPR" },
    });
  });

  it("sin nada, no entra", async () => {
    expect(await resolvePortalViewer(7, deps(null, null))).toBeNull();
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/portal/viewer.test.ts`
Expected: FAIL — `Failed to resolve import "./viewer"`.

- [ ] **Step 3: Implementar `viewer.ts`**

```ts
// lib/portal/viewer.ts
import "server-only";
import { prisma } from "@repo/db";
import { loadPortalContext, type PortalContext } from "./access";

/**
 * Quién está mirando el portal.
 *
 * Dos tipos de persona: el **socio** (ficha `ACTIVE` con su cuenta) ve el portal de siempre; el
 * **alumno** (tiene cursos y no es socio activo) ve Mis cursos y la invitación a asociarse.
 *
 * Ser socio gana siempre: un socio con cursos sigue siendo socio. `loadPortalContext` no
 * cambia y sigue siendo sólo de socios — cada pantalla de socios lo pide por su cuenta, así que
 * un alumno no puede llegar a ninguna de ellas.
 */

export type PortalViewer =
  | { kind: "MEMBER"; context: PortalContext }
  | { kind: "STUDENT"; userId: number; fullName: string; workspace: { id: string; name: string } };

export type ViewerDeps = {
  cargarSocio: (userId: number) => Promise<PortalContext | null>;
  cargarAlumno: (userId: number) => Promise<{ fullName: string; workspace: { id: string; name: string } } | null>;
};

/**
 * La institución del alumno es la de su curso más reciente; el nombre, el de esa inscripción.
 * Si sólo tiene una inscripción aprobada sin acceso todavía (algo falló después del pago), se
 * toma de ahí: Mis cursos le otorga el acceso al entrar.
 */
async function cargarAlumnoPorDefecto(userId: number) {
  const acceso = await prisma.courseAccess.findFirst({
    where: { userId },
    orderBy: { grantedAt: "desc" },
    select: {
      enrollment: { select: { name: true } },
      course: { select: { workspace: { select: { id: true, name: true } } } },
    },
  });
  if (acceso) return { fullName: acceso.enrollment.name, workspace: acceso.course.workspace };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return null;
  const inscripcion = await prisma.courseEnrollment.findFirst({
    where: {
      email: { equals: user.email, mode: "insensitive" },
      paymentStatus: "APPROVED",
      course: { deliveryMode: "RECORDED" },
    },
    orderBy: { createdAt: "desc" },
    select: { name: true, workspace: { select: { id: true, name: true } } },
  });
  return inscripcion ? { fullName: inscripcion.name, workspace: inscripcion.workspace } : null;
}

export async function resolvePortalViewer(
  userId: number,
  deps: ViewerDeps = { cargarSocio: loadPortalContext, cargarAlumno: cargarAlumnoPorDefecto },
): Promise<PortalViewer | null> {
  const context = await deps.cargarSocio(userId);
  if (context) return { kind: "MEMBER", context };
  const alumno = await deps.cargarAlumno(userId);
  return alumno ? { kind: "STUDENT", userId, ...alumno } : null;
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/portal/viewer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: El tipo "alumno" al iniciar sesión — tests primero**

En `lib/portal/user-kind.test.ts`, antes del `await import("./user-kind")`:

```ts
const { tieneCursosMock } = vi.hoisted(() => ({ tieneCursosMock: vi.fn() }));
vi.mock("@/lib/course-classroom/alumno", () => ({ tieneCursos: tieneCursosMock }));
```

En el `beforeEach`: `tieneCursosMock.mockReset().mockResolvedValue(false);`. Y estos casos:

```ts
  it("sin equipo ni ficha pero con cursos es alumno", async () => {
    tieneCursosMock.mockResolvedValue(true);
    expect(await resolveFotofficeUserKind(7)).toBe("STUDENT");
  });

  it("el socio con cursos sigue siendo socio", async () => {
    memberFindFirstMock.mockResolvedValue({ id: "mem-1" });
    tieneCursosMock.mockResolvedValue(true);
    expect(await resolveFotofficeUserKind(7)).toBe("MEMBER");
  });

  it("el equipo con cursos sigue siendo equipo", async () => {
    membershipCountMock.mockResolvedValue(1);
    tieneCursosMock.mockResolvedValue(true);
    expect(await resolveFotofficeUserKind(7)).toBe("TEAM");
  });
```

En `lib/post-login.test.ts` y `lib/post-login-member.test.ts`, agregá el mismo `vi.mock` de
`@/lib/course-classroom/alumno` (con `tieneCursos` en `false` por defecto) para que los casos
existentes no cambien. En `post-login.test.ts` sumá:

```ts
describe("resolveFotofficePostLoginDestination — alumno", () => {
  beforeEach(resetMocks);

  it("quien sólo tiene cursos va a Mis cursos, no a la bienvenida", async () => {
    userFindUniqueMock.mockResolvedValueOnce({ id: 3, email: "ana@example.com", name: "Ana", role: "CUSTOMER", globalRole: "USER" });
    workspaceMembershipFindManyMock.mockResolvedValue([]);
    tieneCursosMock.mockResolvedValue(true);
    const dest = await resolveFotofficePostLoginDestination({ userId: 3 });
    expect(dest).toEqual({ path: "/portal/cursos", workspaceId: null });
  });
});
```

(`tieneCursosMock` es el `vi.fn()` hoisted que agregaste en ese archivo.)

- [ ] **Step 6: Correrlos y ver que fallan**

Run: `pnpm --filter fotoffice test lib/portal/user-kind.test.ts lib/post-login.test.ts`
Expected: FAIL en los casos nuevos (devuelve `"NEW"` y `/bienvenida`).

- [ ] **Step 7: Implementar el tipo alumno**

En `lib/portal/user-kind.ts`: agregá a `FotofficeUserKind` (antes de `"NEW"`):

```ts
  /** No es equipo ni socio activo, pero tiene cursos. Va a Mis cursos en el portal. */
  | "STUDENT"
```

y reemplazá el final de `resolveFotofficeUserKind`:

```ts
  if (member) return "MEMBER";
  return (await tieneCursos(userId)) ? "STUDENT" : "NEW";
```

(con `import { tieneCursos } from "@/lib/course-classroom/alumno";` y quitando el
`return member ? "MEMBER" : "NEW";` anterior).

En `lib/post-login.ts`, justo después del bloque
`if (await findClaimableMembership(...)) { return { path: "/soy-socio", ... }; }`:

```ts
  // Alguien que compró un curso y no es socio ni equipo: su lugar es Mis cursos. Va después
  // de `/soy-socio` a propósito: si además es un socio sin vincular, eso se resuelve primero.
  if (kind === "STUDENT") return { path: "/portal/cursos", workspaceId: null };
```

- [ ] **Step 8: Correr los tests y verlos pasar**

Run: `pnpm --filter fotoffice test lib/portal lib/post-login.test.ts lib/post-login-member.test.ts`
Expected: PASS, incluidos todos los casos que ya existían.

- [ ] **Step 9: El menú del alumno y la sección Cursos del socio — tests primero**

En `lib/portal/menu.test.ts`, agregá (sumando `resolveStudentPortalMenu` al import):

```ts
describe("menú del alumno", () => {
  it("Mis cursos y, si hay a dónde, Hacete socio", () => {
    const items = resolveStudentPortalMenu({ asociarseHref: "/w/sfpr/asociarse" });
    expect(items.map((i) => [i.label, i.href, i.state])).toEqual([
      ["Mis cursos", "/portal/cursos", "DISPONIBLE"],
      ["Hacete socio", "/w/sfpr/asociarse", "DISPONIBLE"],
    ]);
  });

  it("sin formulario de Asociarse publicado, sólo Mis cursos", () => {
    expect(resolveStudentPortalMenu({ asociarseHref: null }).map((i) => i.label)).toEqual(["Mis cursos"]);
  });
});

describe("la sección Cursos del socio", () => {
  it("está disponible cuando el módulo de cursos está habilitado", () => {
    const items = resolvePortalMenu(new Set([COURSES_SALES_MODULE_KEY]));
    expect(items.find((i) => i.href === "/portal/cursos")?.state).toBe("DISPONIBLE");
  });
});
```

(importá `COURSES_SALES_MODULE_KEY` de `@/lib/courses-sales/constants` si el test no lo tiene).
Si algún test existente afirma que "Cursos" está en `PROXIMAMENTE`, actualizalo: es el cambio
pedido.

- [ ] **Step 10: Implementar en `menu.ts`**

En el ítem `order: 80` de `PORTAL_MENU`: `built: true` y
`description: "Tus cursos y los que te tocan gratis por ser {persona}."`.

Al final del archivo:

```ts
/**
 * El menú de quien tiene cursos y no es socio: sólo lo suyo y la invitación a asociarse.
 * Ninguna sección de socios aparece, ni siquiera como "Próximamente": no le corresponde.
 */
export function resolveStudentPortalMenu(opciones: { asociarseHref: string | null }): ResolvedPortalItem[] {
  const items: ResolvedPortalItem[] = [
    {
      order: 80,
      label: "Mis cursos",
      href: "/portal/cursos",
      description: "Tus cursos y tu avance.",
      icon: "school",
      built: true,
      primary: true,
      state: "DISPONIBLE",
    },
  ];
  if (opciones.asociarseHref) {
    items.push({
      order: 90,
      label: "Hacete socio",
      href: opciones.asociarseHref,
      description: "Sumate a la institución.",
      icon: "institution",
      built: true,
      primary: true,
      state: "DISPONIBLE",
    });
  }
  return items;
}
```

Run: `pnpm --filter fotoffice test lib/portal/menu.test.ts`
Expected: PASS.

- [ ] **Step 11: El marco sin número de socio**

En `components/portal/portal-shell.tsx`, el tipo de `member` pasa a
`memberNumber: string | null`. Donde se muestra
`{vocabulary.Singular} N° <span ...>{member.memberNumber}</span>` (línea ~55), mostralo sólo si
`member.memberNumber` no es `null`; si es `null`, mostrá en su lugar `Alumno`. Revisá que
ninguna otra parte del archivo use `memberNumber` sin esa condición.

- [ ] **Step 12: El layout y la portada**

En `app/portal/layout.tsx`, reemplazá `const context = await loadPortalContext(user.id);` y el
`if (!context) {...}` por:

```tsx
  const viewer = await resolvePortalViewer(user.id);

  if (!viewer) {
    // Ni socio ni alumno: no tiene nada que hacer acá. Si administra una institución se lo
    // devuelve a su panel; si no, al inicio de sesión.
    const kind = await resolveFotofficeUserKind(user.id);
    redirect(kind === "TEAM" ? "/workspace" : "/login");
  }

  if (viewer.kind === "STUDENT") {
    const [branding, vocabulary] = await Promise.all([
      prisma.fotofficeWorkspaceBranding.findUnique({
        where: { workspaceId: viewer.workspace.id },
        select: { commercialName: true, logoUrl: true },
      }),
      loadPersonVocabulary(viewer.workspace.id),
    ]);
    return (
      <PortalShell
        // La Task 8 conecta "Hacete socio".
        items={resolveStudentPortalMenu({ asociarseHref: null })}
        vocabulary={vocabulary}
        institution={{
          name: branding?.commercialName?.trim() || viewer.workspace.name,
          logoUrl: branding?.logoUrl ?? null,
        }}
        member={{ fullName: viewer.fullName, memberNumber: null, category: null, photoUrl: null }}
      >
        {children}
      </PortalShell>
    );
  }

  const context = viewer.context;
```

Imports: `resolvePortalViewer` de `@/lib/portal/viewer`, `resolveStudentPortalMenu` de
`@/lib/portal/menu`. Quitá el import de `loadPortalContext` si ya no se usa. El resto del layout
(la rama del socio) **no cambia**.

En `app/portal/page.tsx`, en el `if (!context) {...}`: antes del `redirect` existente, agregá
`redirect("/portal/cursos")` cuando la persona tenga cursos:

```tsx
  if (!context) {
    if (await tieneCursos(user.id)) redirect("/portal/cursos");
    // ...lo que ya estaba
```

(import de `tieneCursos` de `@/lib/course-classroom/alumno`). Así un alumno que entra a una
pantalla de socios —que redirigen a `/portal`— termina en Mis cursos.

- [ ] **Step 13: El selector de perfil**

En `app/elegir-perfil/page.tsx`, después de la lista de perfiles, si
`await tieneCursos(user.id)` es verdadero, mostrá un enlace con el mismo estilo de tarjeta que
usan los perfiles:

```tsx
        <Link href="/portal/cursos" className="fo-card block hover:border-[var(--fo-accent)]">
          <p className="font-medium">Mis cursos</p>
          <p className="text-sm text-[var(--fo-muted)]">Los cursos que compraste o tomaste.</p>
        </Link>
```

Abrí el archivo primero y adaptá las clases a las de las tarjetas existentes; el contenido es el
de arriba.

- [ ] **Step 14: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde y sin errores. **Si cambió el resultado de algún test existente del portal
o del inicio de sesión que no sea "Cursos" en el menú, frená y reportalo**: es el requisito de que
el socio vea lo mismo que hoy.

```bash
git add lib/portal lib/post-login.ts lib/post-login.test.ts lib/post-login-member.test.ts components/portal/portal-shell.tsx app/portal/layout.tsx app/portal/page.tsx app/elegir-perfil/page.tsx
git commit -m "Cursos en el portal: el portal reconoce al alumno con un menú propio"
```

---

### Task 5: El aula dentro del portal

**Files:**
- Create: `lib/course-classroom/mis-cursos.ts`, `lib/course-classroom/mis-cursos.test.ts`
- Create: `app/portal/cursos/page.tsx`, `app/portal/cursos/[courseId]/clase/[lessonId]/page.tsx`
- Create: `app/api/portal/cursos/avance/route.ts`

**Interfaces:**
- Consumes: `estadoDeAccesoAlCurso` (Task 1); `otorgarAccesosPendientes` (Task 3);
  `armarAula`, `duracionLegible`, `fechaLegibleArgentina`, `numeroDeInscripcion`, `textoDeMarca`,
  `aplicarReporte`, `leerReporte`, `esChoqueDeCreacion` (etapa 2); `signPlaybackToken`,
  `playbackIframeUrl`, `DURACION_PERMISO_SEGUNDOS`, `StreamError`; `LessonPlayer`; `requireAuth()`.
- Produces:
  - `type CursoDeMisCursos = { accessId: string; courseId: string; title: string; origin: "PURCHASE" | "MEMBER_BENEFIT"; expiresAt: Date | null; porcentaje: number; siguienteClaseId: string | null }`
  - `type GrupoDeMisCursos = { workspace: { id: string; name: string }; cursos: CursoDeMisCursos[] }`
  - `agruparMisCursos(accesos: AccesoParaMisCursos[], sociaActivaEn: ReadonlySet<string>, ahora: Date): GrupoDeMisCursos[]`
  - `type AccesoParaMisCursos = { id: string; origin: "PURCHASE" | "MEMBER_BENEFIT"; expiresAt: Date | null; revokedAt: Date | null; course: { id: string; title: string; workspace: { id: string; name: string }; lessons: Array<{ id: string; title: string; durationSeconds: number | null; videoStatus: string; sortOrder: number }> }; progress: Array<{ lessonId: string; completedAt: Date | null; lastPositionSeconds: number }> }`
  - `cargarMisCursos(userId: number): Promise<GrupoDeMisCursos[]>`
  - `cargarAccesoVigente(userId: number, courseId: string): Promise<AccesoVigente | null>` — el acceso de esa persona a ese curso, sólo si vale ahora, con lo que necesita la clase (lecciones con `videoUid` y `description`, `enrollment { id, name, dni }`, `progress`).
  - `POST /api/portal/cursos/avance` con `{ courseId, lessonId, positionSeconds, watchedSinceLastReport }`.

- [ ] **Step 1: Escribir el test de Mis cursos**

```ts
// lib/course-classroom/mis-cursos.test.ts
import { describe, expect, it } from "vitest";
import { agruparMisCursos, type AccesoParaMisCursos } from "./mis-cursos";

const ahora = new Date(Date.UTC(2026, 9, 4));
const sfpr = { id: "ws-1", name: "SFPR" };
const otra = { id: "ws-2", name: "Otra" };

function acceso(p: Partial<AccesoParaMisCursos> & { id: string }): AccesoParaMisCursos {
  return {
    origin: "PURCHASE",
    expiresAt: new Date(Date.UTC(2027, 9, 4)),
    revokedAt: null,
    course: {
      id: `curso-${p.id}`,
      title: `Curso ${p.id}`,
      workspace: sfpr,
      lessons: [
        { id: "c1", title: "Uno", durationSeconds: 60, videoStatus: "READY", sortOrder: 1 },
        { id: "c2", title: "Dos", durationSeconds: 60, videoStatus: "READY", sortOrder: 2 },
      ],
    },
    progress: [],
    ...p,
  };
}

describe("Mis cursos", () => {
  it("agrupa por institución y calcula el avance y la clase que sigue", () => {
    const grupos = agruparMisCursos(
      [
        acceso({ id: "a", progress: [{ lessonId: "c1", completedAt: ahora, lastPositionSeconds: 60 }] }),
        acceso({ id: "b", course: { ...acceso({ id: "b" }).course, workspace: otra } }),
      ],
      new Set(),
      ahora,
    );
    expect(grupos.map((g) => g.workspace.name)).toEqual(["SFPR", "Otra"]);
    expect(grupos[0].cursos[0]).toMatchObject({ porcentaje: 50, siguienteClaseId: "c2" });
    expect(grupos[1].cursos[0]).toMatchObject({ porcentaje: 0, siguienteClaseId: "c1" });
  });

  it("no muestra lo vencido, lo revocado ni el beneficio sin socio activo", () => {
    const grupos = agruparMisCursos(
      [
        acceso({ id: "vencido", expiresAt: ahora }),
        acceso({ id: "revocado", revokedAt: ahora }),
        acceso({ id: "gratis", origin: "MEMBER_BENEFIT", expiresAt: null }),
      ],
      new Set(),
      ahora,
    );
    expect(grupos).toEqual([]);
  });

  it("el beneficio se ve si es socia activa de esa institución", () => {
    const grupos = agruparMisCursos(
      [acceso({ id: "gratis", origin: "MEMBER_BENEFIT", expiresAt: null })],
      new Set(["ws-1"]),
      ahora,
    );
    expect(grupos[0].cursos[0].origin).toBe("MEMBER_BENEFIT");
  });

  it("con todo visto, la clase que sigue es la primera (para volver a ver)", () => {
    const grupos = agruparMisCursos(
      [
        acceso({
          id: "a",
          progress: [
            { lessonId: "c1", completedAt: ahora, lastPositionSeconds: 60 },
            { lessonId: "c2", completedAt: ahora, lastPositionSeconds: 60 },
          ],
        }),
      ],
      new Set(),
      ahora,
    );
    expect(grupos[0].cursos[0]).toMatchObject({ porcentaje: 100, siguienteClaseId: "c1" });
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-classroom/mis-cursos.test.ts`
Expected: FAIL — `Failed to resolve import "./mis-cursos"`.

- [ ] **Step 3: Implementar `mis-cursos.ts`**

```ts
// lib/course-classroom/mis-cursos.ts
import { prisma } from "@repo/db";
import { estadoDeAccesoAlCurso, type OrigenAcceso } from "./access-rules";
import { armarAula } from "./aula";

/**
 * Lo que ve una persona en Mis cursos: sólo los accesos que valen ahora, agrupados por
 * institución, con su avance y la clase por la que seguir.
 */

export type AccesoParaMisCursos = {
  id: string;
  origin: OrigenAcceso;
  expiresAt: Date | null;
  revokedAt: Date | null;
  course: {
    id: string;
    title: string;
    workspace: { id: string; name: string };
    lessons: Array<{ id: string; title: string; durationSeconds: number | null; videoStatus: string; sortOrder: number }>;
  };
  progress: Array<{ lessonId: string; completedAt: Date | null; lastPositionSeconds: number }>;
};

export type CursoDeMisCursos = {
  accessId: string;
  courseId: string;
  title: string;
  origin: OrigenAcceso;
  expiresAt: Date | null;
  porcentaje: number;
  siguienteClaseId: string | null;
};

export type GrupoDeMisCursos = { workspace: { id: string; name: string }; cursos: CursoDeMisCursos[] };

export function agruparMisCursos(
  accesos: AccesoParaMisCursos[],
  sociaActivaEn: ReadonlySet<string>,
  ahora: Date,
): GrupoDeMisCursos[] {
  const grupos = new Map<string, GrupoDeMisCursos>();
  for (const a of accesos) {
    const estado = estadoDeAccesoAlCurso(a, { esSocioActivo: sociaActivaEn.has(a.course.workspace.id) }, ahora);
    if (estado !== "VIGENTE") continue;
    const { clases, porcentaje } = armarAula(a.course.lessons, a.progress);
    const siguiente = clases.find((c) => !c.completada) ?? clases[0] ?? null;
    const grupo = grupos.get(a.course.workspace.id) ?? { workspace: a.course.workspace, cursos: [] };
    grupo.cursos.push({
      accessId: a.id,
      courseId: a.course.id,
      title: a.course.title,
      origin: a.origin,
      expiresAt: a.expiresAt,
      porcentaje,
      siguienteClaseId: siguiente?.id ?? null,
    });
    grupos.set(a.course.workspace.id, grupo);
  }
  return [...grupos.values()];
}

async function institucionesDondeEsSociaActiva(userId: number): Promise<Set<string>> {
  const fichas = await prisma.member.findMany({
    where: { userId, status: "ACTIVE" },
    select: { workspaceId: true },
  });
  return new Set(fichas.map((f) => f.workspaceId));
}

const seleccionDeLecciones = {
  orderBy: { sortOrder: "asc" as const },
  select: { id: true, title: true, description: true, durationSeconds: true, videoStatus: true, videoUid: true, sortOrder: true },
};

export async function cargarMisCursos(userId: number): Promise<GrupoDeMisCursos[]> {
  const [accesos, socia] = await Promise.all([
    prisma.courseAccess.findMany({
      where: { userId },
      orderBy: { grantedAt: "desc" },
      select: {
        id: true,
        origin: true,
        expiresAt: true,
        revokedAt: true,
        course: {
          select: {
            id: true,
            title: true,
            workspace: { select: { id: true, name: true } },
            lessons: seleccionDeLecciones,
          },
        },
        progress: { select: { lessonId: true, completedAt: true, lastPositionSeconds: true } },
      },
    }),
    institucionesDondeEsSociaActiva(userId),
  ]);
  return agruparMisCursos(accesos, socia, new Date());
}

/** El acceso de esta persona a este curso, sólo si vale ahora. Lo usan la clase y el avance. */
export async function cargarAccesoVigente(userId: number, courseId: string) {
  const acceso = await prisma.courseAccess.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: {
      id: true,
      origin: true,
      expiresAt: true,
      revokedAt: true,
      enrollment: { select: { id: true, name: true, dni: true } },
      course: { select: { id: true, title: true, workspaceId: true, lessons: seleccionDeLecciones } },
      progress: { select: { lessonId: true, completedAt: true, lastPositionSeconds: true } },
    },
  });
  if (!acceso) return null;
  const socia = acceso.origin === "MEMBER_BENEFIT" ? await institucionesDondeEsSociaActiva(userId) : new Set<string>();
  const estado = estadoDeAccesoAlCurso(acceso, { esSocioActivo: socia.has(acceso.course.workspaceId) }, new Date());
  return estado === "VIGENTE" ? acceso : null;
}

export type AccesoVigente = NonNullable<Awaited<ReturnType<typeof cargarAccesoVigente>>>;
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pnpm --filter fotoffice test lib/course-classroom/mis-cursos.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: La página Mis cursos**

```tsx
// app/portal/cursos/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { cargarMisCursos } from "@/lib/course-classroom/mis-cursos";
import { otorgarAccesosPendientes } from "@/lib/course-classroom/alumno";
import { fechaLegibleArgentina } from "@/lib/course-classroom/access-rules";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis cursos",
  robots: { index: false, follow: false },
};

/**
 * Los cursos de la persona. La guarda del portal (layout) ya decidió que es socio o alumno.
 *
 * Antes de listar, repara: si después de un pago aprobado algo falló y el acceso no se creó,
 * se crea acá. Es idempotente.
 */
export default async function MisCursosPage() {
  const user = await requireAuth();
  await otorgarAccesosPendientes(user.id);
  const grupos = await cargarMisCursos(user.id);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mis cursos</h1>
      </header>

      {grupos.length === 0 ? (
        <section className="fo-card text-sm text-[var(--fo-muted)]">Todavía no tenés cursos.</section>
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.workspace.id} className="space-y-3">
            {grupos.length > 1 ? <h2 className="text-lg font-semibold">{grupo.workspace.name}</h2> : null}
            <ul className="grid gap-3 md:grid-cols-2">
              {grupo.cursos.map((curso) => (
                <li key={curso.accessId} className="fo-card space-y-3">
                  <div className="space-y-1">
                    <p className="font-medium">{curso.title}</p>
                    <p className="text-xs text-[var(--fo-muted)]">
                      {curso.origin === "MEMBER_BENEFIT"
                        ? "Gratis por ser socio"
                        : curso.expiresAt
                          ? `Acceso hasta el ${fechaLegibleArgentina(curso.expiresAt)}`
                          : ""}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--fo-border)]" aria-hidden>
                    <div className="h-full bg-[var(--fo-accent)]" style={{ width: `${curso.porcentaje}%` }} />
                  </div>
                  <p className="text-xs text-[var(--fo-muted)]">{curso.porcentaje}% visto</p>
                  {curso.siguienteClaseId ? (
                    <Link
                      href={`/portal/cursos/${curso.courseId}/clase/${curso.siguienteClaseId}`}
                      className="fo-btn fo-btn-primary inline-flex text-sm"
                    >
                      {curso.porcentaje === 0 ? "Empezar" : curso.porcentaje === 100 ? "Volver a ver" : "Seguir mirando"}
                    </Link>
                  ) : (
                    <p className="text-sm text-[var(--fo-muted)]">Las clases todavía se están preparando.</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 6: La clase**

```tsx
// app/portal/cursos/[courseId]/clase/[lessonId]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { requireAuth } from "@/lib/auth";
import { cargarAccesoVigente } from "@/lib/course-classroom/mis-cursos";
import { numeroDeInscripcion } from "@/lib/course-classroom/access-rules";
import { armarAula } from "@/lib/course-classroom/aula";
import { textoDeMarca } from "@/lib/course-classroom/watermark";
import { DURACION_PERMISO_SEGUNDOS, playbackIframeUrl, signPlaybackToken, StreamError } from "@/lib/courses-video/stream";
import { clientIp } from "@/lib/geocode/rate-limit";
import { logCourseEvent } from "@/lib/presential-courses/log";
import { LessonPlayer } from "@/components/course-classroom/lesson-player";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clase",
  robots: { index: false, follow: false },
  referrer: "strict-origin",
};

export default async function ClasePage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const user = await requireAuth();
  const acceso = await cargarAccesoVigente(user.id, courseId);
  const volver = (
    <Link href="/portal/cursos" className="text-sm text-[var(--fo-accent)] underline">
      Volver a mis cursos
    </Link>
  );

  if (!acceso) {
    return (
      <div className="fo-card space-y-3 text-center">
        <p className="font-semibold">No tenés acceso a este curso.</p>
        {volver}
      </div>
    );
  }

  const { clases } = armarAula(acceso.course.lessons, acceso.progress);
  const indice = clases.findIndex((c) => c.id === lessonId);
  const leccion = acceso.course.lessons.find((l) => l.id === lessonId);
  if (indice === -1 || !leccion?.videoUid) {
    return (
      <div className="fo-card space-y-3 text-center">
        <p className="font-semibold">Esta clase no está disponible.</p>
        {volver}
      </div>
    );
  }
  const clase = clases[indice];
  const anterior = clases[indice - 1];
  const siguiente = clases[indice + 1];

  let iframeUrl: string | null = null;
  try {
    iframeUrl = playbackIframeUrl(
      signPlaybackToken({ videoUid: leccion.videoUid, ttlSeconds: DURACION_PERMISO_SEGUNDOS }),
      { startSeconds: clase.retomarDesde },
    );
  } catch (error) {
    if (!(error instanceof StreamError)) throw error;
    console.error("[fotoffice][cursos] no se pudo firmar la reproducción", { lessonId, motivo: error.message });
  }

  // Registro de reproducciones. El origen va hasheado para no escribir la IP en claro en el
  // log; sirve para contar lugares distintos, no es anonimización fuerte (SHA-256 sin sal).
  const origen = createHash("sha256").update(clientIp(new Headers(await headers()))).digest("hex").slice(0, 12);
  logCourseEvent("aula_reproduccion_autorizada", { accessId: acceso.id, lessonId, origen, firmada: iframeUrl !== null });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        {volver}
        <p className="text-sm text-[var(--fo-muted)]">
          {acceso.course.title} · Clase {indice + 1} de {clases.length}
        </p>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{clase.title}</h1>

      {iframeUrl ? (
        <LessonPlayer
          key={lessonId}
          iframeUrl={iframeUrl}
          marca={textoDeMarca({
            nombre: acceso.enrollment.name,
            dni: acceso.enrollment.dni,
            numero: numeroDeInscripcion(acceso.enrollment.id),
          })}
          reporte={{ url: "/api/portal/cursos/avance", lessonId, courseId }}
        />
      ) : (
        <div className="fo-card text-sm text-[var(--fo-muted)]">El video no está disponible en este momento.</div>
      )}

      {leccion.description ? (
        <section className="fo-card">
          <p className="whitespace-pre-line text-sm leading-relaxed">{leccion.description}</p>
        </section>
      ) : null}

      <nav className="flex justify-between gap-3">
        {anterior ? (
          <Link href={`/portal/cursos/${courseId}/clase/${anterior.id}`} prefetch={false} className="fo-btn fo-btn-secondary text-sm">
            ← {anterior.title}
          </Link>
        ) : (
          <span />
        )}
        {siguiente ? (
          <Link href={`/portal/cursos/${courseId}/clase/${siguiente.id}`} prefetch={false} className="fo-btn fo-btn-primary text-sm">
            {siguiente.title} →
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
```

`LessonPlayer` hoy recibe `reporte: { url: string; lessonId: string } | null`. Agregale
`courseId?: string` a ese tipo y mandalo en el cuerpo del `fetch` cuando venga:
`body: JSON.stringify({ courseId: reporte.courseId, lessonId: ..., positionSeconds: ..., watchedSinceLastReport: ... })`.

- [ ] **Step 7: El avance con sesión — test del cuerpo primero**

En `lib/course-classroom/report-schema.test.ts`, agregá:

```ts
  it("acepta y exige el curso", () => {
    expect(leerReporte({ courseId: "k1", lessonId: "c1", positionSeconds: 1, watchedSinceLastReport: 1 })).toEqual({
      ok: true,
      reporte: { courseId: "k1", lessonId: "c1", positionSeconds: 1, watchedSinceLastReport: 1 },
    });
    expect(leerReporte({ lessonId: "c1", positionSeconds: 1, watchedSinceLastReport: 1 }).ok).toBe(false);
  });
```

y actualizá el caso existente "acepta un reporte bien formado" para que incluya `courseId: "k1"`
en la entrada y en la salida.

Run: `pnpm --filter fotoffice test lib/course-classroom/report-schema.test.ts` → FAIL.

En `report-schema.ts`, agregá `courseId: z.string().min(1).max(40),` al esquema y
`courseId: string;` al tipo de retorno. Run otra vez → PASS.

- [ ] **Step 8: La ruta del avance**

```ts
// app/api/portal/cursos/avance/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { cargarAccesoVigente } from "@/lib/course-classroom/mis-cursos";
import { aplicarReporte } from "@/lib/course-classroom/progress-rules";
import { leerReporte } from "@/lib/course-classroom/report-schema";
import { esChoqueDeCreacion } from "@/lib/course-classroom/choque-de-creacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lo que el reproductor informa cada 15 segundos. La persona sale de la sesión, nunca del
 * cuerpo; la desconfianza sobre los segundos vive en `aplicarReporte`.
 */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const leido = leerReporte(await request.json().catch(() => null));
  if (!leido.ok) return NextResponse.json({ ok: false }, { status: 400 });

  const acceso = await cargarAccesoVigente(user.id, leido.reporte.courseId);
  if (!acceso) return NextResponse.json({ ok: false }, { status: 403 });
  const clase = acceso.course.lessons.find((l) => l.id === leido.reporte.lessonId && l.videoStatus === "READY");
  if (!clase) return NextResponse.json({ ok: false }, { status: 404 });

  const clave = { accessId_lessonId: { accessId: acceso.id, lessonId: clase.id } };
  const previo = await prisma.courseLessonProgress.findUnique({ where: clave });
  const nuevo = aplicarReporte({
    previo,
    reporte: leido.reporte,
    ahora: new Date(),
    duracionSegundos: clase.durationSeconds,
  });
  try {
    await prisma.courseLessonProgress.upsert({
      where: clave,
      create: { accessId: acceso.id, lessonId: clase.id, ...nuevo },
      update: nuevo,
    });
  } catch (error) {
    // Dos reportes simultáneos crearon la misma fila: el otro ya la guardó.
    if (esChoqueDeCreacion(error)) return NextResponse.json({ ok: true, completada: false });
    throw error;
  }
  return NextResponse.json({ ok: true, completada: nuevo.completedAt !== null });
}
```

Confirmá antes que `getAuthUser` existe en `lib/auth.ts` y devuelve `null` sin sesión (el
informe de exploración lo nombra junto a `requireAuth`). Si su nombre o firma es otra, usá la
equivalente que no redirige: una ruta de API tiene que responder 401, no redirigir a `/login`.

- [ ] **Step 9: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde y sin errores.

```bash
git add lib/course-classroom app/portal/cursos app/api/portal components/course-classroom
git commit -m "Cursos en el portal: Mis cursos y la clase, con el avance guardado contra la sesión"
```

---

### Task 6: Vender un curso grabado desde el panel

**Files:**
- Modify: `components/presential-courses/course-editor-form.tsx`
- Modify: `app/actions/presential-courses.ts`
- Create: `app/actions/course-sale-fields.ts`, `app/actions/course-sale-fields.test.ts`
- Modify: `app/(shell)/dashboard/courses/[courseId]/page.tsx` (pasar `freeForMembers` al formulario)

**Interfaces:**
- Produces:
  - `leerCamposDeVenta(formData: FormData): { priceArs: number | null; accessMonths: number; completionPercent: number; freeForMembers: boolean }`
  - `courseSchema` (en `presential-courses.ts`) suma `freeForMembers: z.boolean().default(false)`; `normalizeCourseInput` lo devuelve.
  - `CourseEditorForm` acepta `initial.freeForMembers?: boolean`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// app/actions/course-sale-fields.test.ts
import { describe, expect, it } from "vitest";
import { leerCamposDeVenta } from "./course-sale-fields";

function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

describe("los campos de venta del curso", () => {
  it("lee precio, meses, porcentaje y gratis para socios", () => {
    expect(
      leerCamposDeVenta(form({ priceArs: "45000", accessMonths: "6", completionPercent: "90", freeForMembers: "on" })),
    ).toEqual({ priceArs: 45000, accessMonths: 6, completionPercent: 90, freeForMembers: true });
  });

  it("sin los campos, usa los valores por defecto y no inventa un precio", () => {
    expect(leerCamposDeVenta(form({}))).toEqual({
      priceArs: null,
      accessMonths: 12,
      completionPercent: 80,
      freeForMembers: false,
    });
  });

  it("un precio con coma decimal se entiende", () => {
    expect(leerCamposDeVenta(form({ priceArs: "45000,50" })).priceArs).toBe(45000.5);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test app/actions/course-sale-fields.test.ts`
Expected: FAIL — `Failed to resolve import "./course-sale-fields"`.

- [ ] **Step 3: Implementar**

```ts
// app/actions/course-sale-fields.ts
/**
 * Los campos con los que se vende un curso grabado, leídos del formulario del panel.
 *
 * Existen porque el formulario no los tenía: el precio de un grabado no se podía cargar, y
 * cada guardado lo dejaba en null porque la acción leía un campo que no venía.
 */
export function leerCamposDeVenta(formData: FormData): {
  priceArs: number | null;
  accessMonths: number;
  completionPercent: number;
  freeForMembers: boolean;
} {
  const precio = formData.get("priceArs")?.toString().trim().replace(",", ".");
  return {
    priceArs: precio ? Number(precio) : null,
    accessMonths: Number(formData.get("accessMonths")?.toString() || 12),
    completionPercent: Number(formData.get("completionPercent")?.toString() || 80),
    freeForMembers: formData.get("freeForMembers") === "on",
  };
}
```

No lleva `"use server"`: es un ayudante puro que importan las acciones (un archivo `"use server"`
sólo puede exportar funciones asíncronas).

Run: `pnpm --filter fotoffice test app/actions/course-sale-fields.test.ts` → PASS (3 tests).

- [ ] **Step 4: Usarlo en las acciones**

En `app/actions/presential-courses.ts`:
- En `courseSchema`, debajo de `completionPercent`: `freeForMembers: z.boolean().default(false),`.
- En `normalizeCourseInput`, debajo de `completionPercent: parsed.completionPercent,`:
  `freeForMembers: parsed.freeForMembers,`.
- En las dos acciones que arman el curso desde `formData` (crear, ~línea 380, y actualizar,
  ~línea 420), reemplazá las tres líneas `priceArs: ...`, `accessMonths: ...` y
  `completionPercent: ...` por `...leerCamposDeVenta(formData),`.
- Import: `import { leerCamposDeVenta } from "./course-sale-fields";`.
- Si hay una función que duplica un curso (la línea ~253 copia `priceArs` y `accessMonths` de
  `source`), agregá ahí `freeForMembers: source.freeForMembers`.

- [ ] **Step 5: Los campos en el formulario**

En `components/presential-courses/course-editor-form.tsx`, sumá `freeForMembers?: boolean` al
tipo de `initial`, y después del bloque de `deliveryMode` agregá una sección (con las mismas
clases `fo-field-stack`, `fo-label` y `fo-input` que usa el resto del archivo):

```tsx
        <fieldset className="space-y-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-4">
          <legend className="px-1 text-sm font-semibold">Venta del curso grabado</legend>
          <p className="text-xs text-[var(--fo-muted)]">
            Sólo se usa si la modalidad es Grabado. Los presenciales llevan el precio en cada edición.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="priceArs">Precio (pesos)</label>
              <input id="priceArs" name="priceArs" inputMode="decimal" defaultValue={initial?.priceArs ?? ""} className="fo-input" />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="accessMonths">Meses de acceso</label>
              <input id="accessMonths" name="accessMonths" type="number" min={1} max={120} defaultValue={initial?.accessMonths ?? 12} className="fo-input" />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="completionPercent">% visto para terminarlo</label>
              <input id="completionPercent" name="completionPercent" type="number" min={1} max={100} defaultValue={initial?.completionPercent ?? 80} className="fo-input" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="freeForMembers" defaultChecked={initial?.freeForMembers ?? false} />
            Gratis para socios: el socio activo lo toma sin pagar desde su portal; el público paga el precio.
          </label>
        </fieldset>
```

En `app/(shell)/dashboard/courses/[courseId]/page.tsx`, donde arma `initial` (líneas ~79-80,
junto a `priceArs` y `accessMonths`), agregá `freeForMembers: course.freeForMembers,` y, si no
está, `completionPercent: course.completionPercent,`.

- [ ] **Step 6: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde y sin errores.

```bash
git add app/actions/course-sale-fields.ts app/actions/course-sale-fields.test.ts app/actions/presential-courses.ts components/presential-courses/course-editor-form.tsx "app/(shell)/dashboard/courses/[courseId]/page.tsx"
git commit -m "Cursos grabados: el panel carga el precio, el plazo y 'gratis para socios' (antes se borraba el precio)"
```

---

### Task 7: Cursos gratis para socios

**Files:**
- Create: `lib/course-classroom/beneficio.ts`, `lib/course-classroom/beneficio.test.ts`
- Create: `app/portal/cursos/actions.ts`
- Modify: `app/portal/cursos/page.tsx` (bloque "Gratis para vos")
- Modify: `app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx`, `components/presential-courses/recorded-course-section.tsx` (aviso)

**Interfaces:**
- Consumes: `loadPortalContext` (sólo socios); `cargarMisCursos`.
- Produces:
  - `puedeAnotarseGratis(input: { esSocioActivo: boolean; curso: { freeForMembers: boolean; status: string; deliveryMode: string; workspaceId: string } | null; workspaceDelSocio: string | null; yaTieneAcceso: boolean }): { ok: true } | { ok: false; motivo: string }`
  - `cursosGratisParaSocio(workspaceId: string, userId: number): Promise<Array<{ id: string; title: string; shortDescription: string | null }>>`
  - `anotarseGratis(input: { userId: number; courseId: string }): Promise<{ ok: true } | { ok: false; motivo: string }>`
  - server action `anotarmeGratisAction(courseId: string): Promise<void>` (redirige a la primera clase o vuelve con error)
  - `RecordedCourseSection` acepta `gratisParaSocios: { institucion: string } | null`.

- [ ] **Step 1: Escribir el test de la regla**

```ts
// lib/course-classroom/beneficio.test.ts
import { describe, expect, it } from "vitest";
import { puedeAnotarseGratis } from "./beneficio";

const curso = { freeForMembers: true, status: "PUBLISHED", deliveryMode: "RECORDED", workspaceId: "ws-1" };
const base = { esSocioActivo: true, curso, workspaceDelSocio: "ws-1", yaTieneAcceso: false };

describe("quién se anota gratis", () => {
  it("socio activo, curso grabado publicado y gratis para socios de su institución", () => {
    expect(puedeAnotarseGratis(base)).toEqual({ ok: true });
  });

  it.each([
    ["no es socio activo", { esSocioActivo: false }],
    ["el curso no es gratis para socios", { curso: { ...curso, freeForMembers: false } }],
    ["el curso no está publicado", { curso: { ...curso, status: "DRAFT" } }],
    ["el curso no es grabado", { curso: { ...curso, deliveryMode: "PRESENCIAL" } }],
    ["es de otra institución", { workspaceDelSocio: "ws-2" }],
    ["ya lo tiene", { yaTieneAcceso: true }],
    ["el curso no existe", { curso: null }],
  ])("no puede si %s", (_motivo, cambio) => {
    expect(puedeAnotarseGratis({ ...base, ...cambio }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test lib/course-classroom/beneficio.test.ts`
Expected: FAIL — `Failed to resolve import "./beneficio"`.

- [ ] **Step 3: Implementar `beneficio.ts`**

```ts
// lib/course-classroom/beneficio.ts
import { Prisma, prisma } from "@repo/db";
import { loadPortalContext } from "@/lib/portal/access";
import { logCourseEvent } from "@/lib/presential-courses/log";

/**
 * Cursos gratis para socios: el público los paga, el socio activo de esa institución los toma
 * sin pagar desde su portal. El acceso que se da es `MEMBER_BENEFIT`: deja de verse si deja de
 * ser socio activo (spec §8).
 */

export function puedeAnotarseGratis(input: {
  esSocioActivo: boolean;
  curso: { freeForMembers: boolean; status: string; deliveryMode: string; workspaceId: string } | null;
  workspaceDelSocio: string | null;
  yaTieneAcceso: boolean;
}): { ok: true } | { ok: false; motivo: string } {
  if (!input.esSocioActivo || !input.workspaceDelSocio) return { ok: false, motivo: "Sólo para socios activos." };
  if (!input.curso || input.curso.status !== "PUBLISHED" || input.curso.deliveryMode !== "RECORDED") {
    return { ok: false, motivo: "Este curso no está disponible." };
  }
  if (!input.curso.freeForMembers) return { ok: false, motivo: "Este curso no es gratis para socios." };
  if (input.curso.workspaceId !== input.workspaceDelSocio) return { ok: false, motivo: "Este curso es de otra institución." };
  if (input.yaTieneAcceso) return { ok: false, motivo: "Ya tenés este curso." };
  return { ok: true };
}

export async function cursosGratisParaSocio(workspaceId: string, userId: number) {
  return prisma.course.findMany({
    where: {
      workspaceId,
      freeForMembers: true,
      status: "PUBLISHED",
      deliveryMode: "RECORDED",
      accesses: { none: { userId } },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, shortDescription: true },
  });
}

/**
 * Anota gratis a un socio. Todo se comprueba de nuevo acá, en el servidor: el botón del portal
 * no es una garantía. La inscripción queda en $0, aprobada y marcada como beneficio, para que
 * figure en los números y se sepa quién lo tomó.
 */
export async function anotarseGratis(input: { userId: number; courseId: string }): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const [socio, curso, user, existente] = await Promise.all([
    loadPortalContext(input.userId),
    prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true, title: true, workspaceId: true, freeForMembers: true, status: true, deliveryMode: true },
    }),
    prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } }),
    prisma.courseAccess.findUnique({
      where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
      select: { id: true },
    }),
  ]);

  const regla = puedeAnotarseGratis({
    esSocioActivo: socio !== null,
    curso,
    workspaceDelSocio: socio?.workspace.id ?? null,
    yaTieneAcceso: existente !== null,
  });
  if (!regla.ok) return regla;

  const ficha = await prisma.member.findUnique({
    where: { id: socio!.member.id },
    select: { firstName: true, lastName: true, dni: true, phone: true },
  });

  try {
    await prisma.$transaction(async (tx) => {
      const inscripcion = await tx.courseEnrollment.create({
        data: {
          workspaceId: curso!.workspaceId,
          courseId: curso!.id,
          name: `${ficha?.firstName ?? ""} ${ficha?.lastName ?? ""}`.trim() || (user?.email ?? ""),
          email: user?.email ?? "",
          whatsapp: ficha?.phone ?? "",
          dni: ficha?.dni ?? "",
          paymentStatus: "APPROVED",
          paymentMethod: "MEMBER_BENEFIT",
          paymentProvider: "MEMBER_BENEFIT",
          amountArs: new Prisma.Decimal(0),
          platformFeePercent: new Prisma.Decimal(0),
          platformFeeArs: new Prisma.Decimal(0),
          netAmountArs: new Prisma.Decimal(0),
        },
        select: { id: true },
      });
      await tx.courseAccess.create({
        data: {
          workspaceId: curso!.workspaceId,
          courseId: curso!.id,
          enrollmentId: inscripcion.id,
          userId: input.userId,
          origin: "MEMBER_BENEFIT",
          expiresAt: null,
        },
      });
    });
  } catch (error) {
    // Doble clic: el otro pedido ya lo anotó.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: true };
    throw error;
  }
  logCourseEvent("beneficio_socio_anotado", { courseId: curso!.id, memberId: socio!.member.id });
  return { ok: true };
}
```

Antes de escribirlo, abrí `model Member` en el esquema y confirmá los nombres de los campos de
documento y teléfono (acá se suponen `dni` y `phone`). Si se llaman distinto, usá los reales; si
no existen, dejá cadena vacía. `CourseEnrollment.whatsapp` y `dni` son obligatorios: no pueden
quedar `undefined`.

Run: `pnpm --filter fotoffice test lib/course-classroom/beneficio.test.ts` → PASS (8 tests).

- [ ] **Step 4: La acción del portal**

```ts
// app/portal/cursos/actions.ts
"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { anotarseGratis } from "@/lib/course-classroom/beneficio";

export async function anotarmeGratisAction(courseId: string): Promise<void> {
  const user = await requireAuth();
  const r = await anotarseGratis({ userId: user.id, courseId });
  redirect(r.ok ? "/portal/cursos" : `/portal/cursos?aviso=${encodeURIComponent(r.motivo)}`);
}
```

(El `aviso` es un texto fijo de la regla, nunca un dato personal.)

- [ ] **Step 5: "Gratis para vos" en Mis cursos**

En `app/portal/cursos/page.tsx`:
- la firma pasa a `export default async function MisCursosPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> })` y se lee `const { aviso } = await searchParams;`;
- después de cargar los grupos: `const socio = await loadPortalContext(user.id);` y
  `const gratis = socio ? await cursosGratisParaSocio(socio.workspace.id, user.id) : [];`;
- debajo del `<header>`, si hay `aviso`, un `<p className="fo-card text-sm">` con el texto;
- al final, si `gratis.length > 0`:

```tsx
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Gratis para vos</h2>
        <p className="text-sm text-[var(--fo-muted)]">Por ser socio, estos cursos no te cuestan nada.</p>
        <ul className="grid gap-3 md:grid-cols-2">
          {gratis.map((curso) => (
            <li key={curso.id} className="fo-card space-y-2">
              <p className="font-medium">{curso.title}</p>
              {curso.shortDescription ? (
                <p className="text-sm text-[var(--fo-muted)] line-clamp-2">{curso.shortDescription}</p>
              ) : null}
              <form action={anotarmeGratisAction.bind(null, curso.id)}>
                <button type="submit" className="fo-btn fo-btn-primary text-sm">Anotarme</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
```

(imports: `loadPortalContext`, `cursosGratisParaSocio`, `anotarmeGratisAction`).

- [ ] **Step 6: El aviso en la página de venta**

En `RecordedCourseSection`, sumá la prop `gratisParaSocios: { institucion: string } | null` y,
antes del precio:

```tsx
      {gratisParaSocios ? (
        <p className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-accent)]/40 p-3 text-sm">
          <strong>Gratis para socios de {gratisParaSocios.institucion}.</strong>{" "}
          <a href={`${appUrl}/login?next=/portal/cursos`} className="text-[var(--fo-accent)] underline">
            Entrá a tu portal
          </a>{" "}
          y anotate sin pagar.
        </p>
      ) : null}
```

En `app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx`, pasá
`gratisParaSocios={presentialCourse.freeForMembers ? { institucion: branding.commercialName } : null}`.
Si `appUrl` está vacío, el enlace queda relativo (`/login?...`): está bien.

En `components/presential-courses/public-course-enrollment-form.tsx`, debajo del campo de
correo, agregá el aviso de la spec:

```tsx
            <p className="text-xs text-[var(--fo-muted)]">
              Si ya entrás al portal, usá el mismo correo: el curso va a aparecer en tu cuenta.
            </p>
```

- [ ] **Step 7: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde y sin errores.

```bash
git add lib/course-classroom/beneficio.ts lib/course-classroom/beneficio.test.ts app/portal/cursos components/presential-courses "app/w/[workspaceSlug]/cursos/[courseSlug]/page.tsx"
git commit -m "Cursos en el portal: el socio activo se anota gratis a los cursos para socios"
```

---

### Task 8: "Hacete socio"

**Files:**
- Create: `lib/course-classroom/asociarse.ts`, `lib/course-classroom/asociarse.test.ts`
- Modify: `lib/course-classroom/grant.ts` (dependencia `invitacionASociarse` por defecto)
- Modify: `app/portal/layout.tsx` (menú del alumno), `app/portal/cursos/page.tsx` (tarjeta)

**Interfaces:**
- Consumes: `isModuleEnabledForWorkspace`, `MEMBERS_MODULE_KEY`, `getWorkspaceCollectionStatus`,
  `getActiveFeeValue` (las mismas que usa `app/w/[workspaceSlug]/asociarse/page.tsx`).
- Produces:
  - `asociarseAbierto(input: { moduloSocios: boolean; puedeCobrar: boolean; hayValorCuota: boolean }): boolean`
  - `invitacionASociarse(workspaceId: string, userId: number): Promise<InvitacionASociarse | null>` — `null` si es socio activo de esa institución o si Asociarse no está abierto. `url` absoluta (`appUrl()` + `/w/<publicSlug>/asociarse`) para el correo.
  - `rutaAsociarse(workspaceId: string, userId: number): Promise<string | null>` — la misma decisión, con la ruta relativa `/w/<publicSlug>/asociarse` para el portal.

- [ ] **Step 1: Escribir el test**

```ts
// lib/course-classroom/asociarse.test.ts
import { describe, expect, it } from "vitest";
import { asociarseAbierto } from "./asociarse";

describe("¿está abierto Asociarse?", () => {
  it("sólo con el módulo de socios, cobros conectados y valor de cuota", () => {
    expect(asociarseAbierto({ moduloSocios: true, puedeCobrar: true, hayValorCuota: true })).toBe(true);
    expect(asociarseAbierto({ moduloSocios: false, puedeCobrar: true, hayValorCuota: true })).toBe(false);
    expect(asociarseAbierto({ moduloSocios: true, puedeCobrar: false, hayValorCuota: true })).toBe(false);
    expect(asociarseAbierto({ moduloSocios: true, puedeCobrar: true, hayValorCuota: false })).toBe(false);
  });
});
```

Run: `pnpm --filter fotoffice test lib/course-classroom/asociarse.test.ts` → FAIL (no existe).

- [ ] **Step 2: Implementar**

```ts
// lib/course-classroom/asociarse.ts
import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { getWorkspaceCollectionStatus } from "@/lib/payments/connect/status";
import { getActiveFeeValue } from "@/lib/membership/settings";
import type { InvitacionASociarse } from "./email";

/**
 * Cuándo invitar a alguien a asociarse y a dónde.
 *
 * El criterio de "abierto" es el mismo de `/w/<institución>/asociarse`: sin módulo de socios,
 * sin cobros conectados o sin valor de cuota, ese formulario no se publica — y una invitación
 * a un formulario cerrado sería una promesa rota.
 */
export function asociarseAbierto(input: { moduloSocios: boolean; puedeCobrar: boolean; hayValorCuota: boolean }): boolean {
  return input.moduloSocios && input.puedeCobrar && input.hayValorCuota;
}

async function decidir(workspaceId: string, userId: number): Promise<{ ruta: string; institucion: string } | null> {
  const [socio, branding, moduloSocios, cobros, valorCuota] = await Promise.all([
    prisma.member.findFirst({ where: { userId, workspaceId, status: "ACTIVE" }, select: { id: true } }),
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId },
      select: { publicSlug: true, commercialName: true },
    }),
    isModuleEnabledForWorkspace(workspaceId, MEMBERS_MODULE_KEY),
    getWorkspaceCollectionStatus(workspaceId),
    getActiveFeeValue(workspaceId, null, new Date()),
  ]);
  if (socio || !branding) return null;
  if (!asociarseAbierto({ moduloSocios, puedeCobrar: cobros.canCharge, hayValorCuota: Boolean(valorCuota) })) return null;
  return { ruta: `/w/${branding.publicSlug}/asociarse`, institucion: branding.commercialName };
}

export async function rutaAsociarse(workspaceId: string, userId: number): Promise<string | null> {
  return (await decidir(workspaceId, userId))?.ruta ?? null;
}

export async function invitacionASociarse(workspaceId: string, userId: number): Promise<InvitacionASociarse | null> {
  const d = await decidir(workspaceId, userId);
  const base = appUrl();
  if (!d || !base) return null;
  return { institucion: d.institucion, url: `${base}${d.ruta}` };
}

/** Los cursos gratis para socios de esa institución, para el argumento de la tarjeta. */
export async function cursosGratisDeLaInstitucion(workspaceId: string) {
  return prisma.course.findMany({
    where: { workspaceId, freeForMembers: true, status: "PUBLISHED", deliveryMode: "RECORDED" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true },
  });
}
```

Run: `pnpm --filter fotoffice test lib/course-classroom/asociarse.test.ts` → PASS.

- [ ] **Step 3: Conectarlo**

- `grant.ts`, en `depsPorDefecto`: `invitacionASociarse: (workspaceId, userId) => invitacionASociarse(workspaceId, userId),`
  (import desde `./asociarse`) y borrá el comentario "La Task 8 conecta...".
- `app/portal/layout.tsx`, rama alumno: `items={resolveStudentPortalMenu({ asociarseHref: await rutaAsociarse(viewer.workspace.id, viewer.userId) })}`
  y borrá el comentario "La Task 8 conecta...".
- `app/portal/cursos/page.tsx`: si **no** hay `socio` (`loadPortalContext` dio `null`), por
  cada grupo de `grupos` calculá `rutaAsociarse(grupo.workspace.id, user.id)` y
  `cursosGratisDeLaInstitucion(grupo.workspace.id)`. Para cada grupo con ruta, arriba de la
  lista de cursos, mostrá:

```tsx
            <aside className="fo-card space-y-2 border-[var(--fo-accent)]/40">
              <p className="font-semibold">Hacete socio de {grupo.workspace.name}</p>
              {gratisDeLaInstitucion.length > 0 ? (
                <>
                  <p className="text-sm text-[var(--fo-muted)]">Y estos cursos te salen gratis:</p>
                  <ul className="list-disc pl-5 text-sm">
                    {gratisDeLaInstitucion.map((c) => (
                      <li key={c.id}>{c.title}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-[var(--fo-muted)]">Sumate a la institución y accedé a sus beneficios.</p>
              )}
              <a href={ruta} className="fo-btn fo-btn-primary inline-flex text-sm">Quiero ser socio</a>
            </aside>
```

  (Resolvé los datos por grupo antes del `return`, con `Promise.all`, en un arreglo paralelo a
  `grupos`; no hagas consultas dentro del JSX.)

- `grant.test.ts` no cambia: inyecta `invitacionASociarse`.

- [ ] **Step 4: Suite, tipos y commit**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice exec tsc --noEmit`
Expected: verde y sin errores.

```bash
git add lib/course-classroom/asociarse.ts lib/course-classroom/asociarse.test.ts lib/course-classroom/grant.ts app/portal/layout.tsx app/portal/cursos/page.tsx
git commit -m "Cursos en el portal: la invitación a hacerse socio, en el portal y en el correo"
```

---

### Task 9: Despliegue y prueba real

Nada de esta tarea se hace sin que Daniel lo apruebe en el momento.

- [ ] **Step 1: Build completo** — `pnpm --filter fotoffice build` sin errores.
- [ ] **Step 2: Push y Pull Request** de `feat/fotoffice-cursos-aula` contra `main`. El cuerpo
  cuenta las dos etapas (aula y cursos en el portal), los hallazgos (no se podía comprar un
  grabado; el panel borraba el precio) y esta lista de verificación.
- [ ] **Step 3: Migración** en las cinco bases, antes del despliegue, con
  `packages/db/scripts/migraciones-cinco-bases.mts --bases <json fuera del repo>` (primero sin
  `--aplicar`, después `--aplicar --solo 20261004120000_cursos_aula_alumno`).
- [ ] **Step 4: Variables y servicios** (la lista de la etapa 2, Task 12, Steps 4-5b): las
  cuatro `STREAM_*`, el seguimiento de clics de Resend **apagado** (el correo de bienvenida lleva
  un enlace para crear contraseña), `APP_URL` = `NEXT_PUBLIC_APP_URL`, y el dominio canónico
  dentro de `allowedOrigins`.
- [ ] **Step 5: Prueba de punta a punta**, con un curso grabado de prueba (precio bajo,
  "Gratis para socios" encendido, una clase de muestra y una normal en "Lista"):
  1. Desde el panel, cargar el precio y guardar dos veces: el precio sigue ahí.
  2. **Un no socio** (correo sin cuenta) compra con pago real → le llega "Bienvenido" con
     "Crear mi contraseña" → la crea → entra a Mis cursos → ve el curso, la clase reproduce con
     la marca de agua, ve la tarjeta "Hacete socio" (si Asociarse está abierto en esa institución).
  3. Consultar `CourseLessonProgress` tras dos minutos de video: `secondsWatched` cerca de 120.
  4. **Un socio activo** entra al portal: ve todo lo de siempre más "Cursos"; en "Gratis para
     vos" se anota sin pagar y mira una clase.
  5. Suspender a ese socio desde el panel: el curso gratis deja de verse. Reactivarlo: vuelve
     con su avance.
  6. Copiar el `src` del iframe en otra pestaña y anotar lo que pasa (criterio de la spec de
     etapa 2: no debe reproducir).
- [ ] **Step 6: Dejar escrito el estado** en `docs/fotoffice/ESTADO-ACTUAL.md`, bloque de Cursos.

---

## Fuera de este plan

Precio rebajado para socios, cursos exclusivos para socios, vincular una compra hecha con otro
correo, pantalla de inscriptos y avance en el panel, aviso de cuenta compartida, materiales de
clase, consultas (etapa 3) y certificado (etapa 4).
