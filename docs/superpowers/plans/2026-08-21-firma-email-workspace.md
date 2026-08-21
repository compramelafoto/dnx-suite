# Firma de email institucional — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los emails de FotoOffice cierren con la firma institucional del workspace, en HTML y texto plano.

**Architecture:** Renderer puro en `@repo/communications/signature` (agnóstico de app) + mapper en FotoOffice que traduce `FotofficeWorkspaceBranding` → `EmailSignatureData`. Un solo campo nuevo en la base.

**Tech Stack:** TypeScript, node:test vía `tsx --test` (paquete), Vitest (FotoOffice), Prisma, Next.js App Router.

**Spec:** `docs/superpowers/specs/2026-08-21-firma-email-workspace-design.md`

## Global Constraints

- Esto es **firma de email**, nunca "firma digital" en nombres, comentarios ni copy visible.
- HTML de email: tablas con `role="presentation"`, estilos inline. Sin flex/grid/`<style>`/JS/formularios/SVG.
- Imágenes: solo `https:` absoluto. Nunca `javascript:`, `data:` ni rutas relativas (`/uploads/...`).
- Escapar **antes** de convertir saltos de línea a `<br>`.
- `emailSignatureNote`: texto plano, `trim`, máx **1500** caracteres, vacío → `null`.
- El renderer **nunca** dibuja `replyToEmail` (es cabecera, no cuerpo).
- El mapper **no** completa `closingText` ni campos de firmante personal.
- Ningún test envía emails reales.
- Migración aditiva y nullable.

---

### Task 1: Renderer compartido

**Files:**
- Create: `packages/communications/src/signature/types.ts`
- Create: `packages/communications/src/signature/render.ts`
- Create: `packages/communications/src/signature/index.ts`
- Test: `packages/communications/src/signature/signature.test.ts`
- Modify: `packages/communications/package.json` (añadir export `./signature` y el test al script `test`)

**Interfaces:**
- Produces: `EmailSignatureData` (campos exactos en el spec, §2) y
  `renderEmailSignature(data: EmailSignatureData): { html: string; text: string }`

- [ ] **Step 1: Escribir el test que falla**

`signature.test.ts`, con `node:test` + `node:assert/strict` (patrón de `architecture.test.ts`):

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderEmailSignature } from "./render";

test("escapa HTML, no interpreta etiquetas, normaliza CRLF", () => {
  const { html, text } = renderEmailSignature({
    organizationName: "<script>alert(1)</script>SFPR",
    institutionalNote: "Línea 1\r\nLínea 2   ",
  });
  assert.ok(!html.includes("<script>") && html.includes("&lt;script&gt;"));
  assert.ok(html.includes("Línea 1<br>Línea 2"));  // escapa, LUEGO <br>
  assert.ok(!text.includes("<") && text.includes("Línea 1\nLínea 2"));
});

test("omite el logo entero si la URL no es https absoluta", () => {
  for (const bad of ["javascript:alert(1)", "/uploads/l.png", "data:image/png;base64,AAA", "http://x.com/l.png"]) {
    const { html } = renderEmailSignature({ organizationName: "SFPR", organizationLogoUrl: bad });
    assert.ok(!html.includes("<img"), `debía omitir: ${bad}`);
  }
  const ok = renderEmailSignature({ organizationName: "SFPR", organizationLogoUrl: "https://cdn.x/l.png" });
  assert.ok(ok.html.includes("<img") && ok.html.includes('alt="SFPR"'));
  assert.ok(ok.html.includes("width=") && ok.html.includes("height="));
});

test("HTML apto para email y accesible", () => {
  const { html } = renderEmailSignature({ organizationName: "SFPR" });
  assert.ok(html.includes("<table") && html.includes('role="presentation"'));
  assert.ok(!/display:\s*(flex|grid)|<style|<script|<form|<svg/i.test(html));
  assert.ok(/font-family:[^;"]*(Arial|Helvetica)[^;"]*sans-serif/i.test(html));
});

test("sin imágenes y sin campos opcionales sigue siendo legible y sin basura", () => {
  const { html, text } = renderEmailSignature({ organizationName: "SFPR", website: "https://sfpr.org" });
  assert.ok(!/undefined|null/.test(html) && !/undefined|null/.test(text));
  assert.ok(!/\n\s*\n\s*\n/.test(text));
  assert.ok(text.includes("SFPR") && text.includes("https://sfpr.org"));  // URL visible
});

test("replyToEmail nunca se renderiza (es cabecera, no cuerpo)", () => {
  const { html, text } = renderEmailSignature({ organizationName: "SFPR", replyToEmail: "t@sfpr.test" });
  assert.ok(!html.includes("t@sfpr.test") && !text.includes("t@sfpr.test"));
});
```

- [ ] **Step 2: Correr y verificar que falla**

`pnpm --filter @repo/communications exec tsx --test src/signature/signature.test.ts`
Esperado: FAIL — `Cannot find module './render'`.

- [ ] **Step 3: Implementar**

`types.ts` con `EmailSignatureData` (copiar del spec §2, con los comentarios).
`render.ts` con helpers privados: `escapeHtml`, `safeImageUrl` (solo `https:`), `safeLinkUrl` (`http:`/`https:`), `normalizeText` (CRLF→LF, recorta espacios finales por línea), y el armado de tabla + versión texto. `index.ts` reexporta ambos.

- [ ] **Step 4: Correr y verificar que pasa** — mismo comando, esperado PASS.

- [ ] **Step 5: Registrar export y test**

En `package.json`: `"./signature": "./src/signature/index.ts"` y agregar `src/signature/signature.test.ts` al script `test`.
Correr `pnpm --filter @repo/communications test` y `... check-types`: todo verde.

- [ ] **Step 6: Commit**

```bash
git add packages/communications/src/signature packages/communications/package.json
git commit -m "feat(communications): add email signature renderer"
```

---

### Task 2: Campo en la base

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelo `FotofficeWorkspaceBranding`)
- Create: `packages/db/prisma/migrations/20260822120000_fotoffice_email_signature_note/migration.sql`

**Interfaces:**
- Produces: `FotofficeWorkspaceBranding.emailSignatureNote: String?`

- [ ] **Step 1: Agregar el campo al schema** — con el comentario `///` del spec §1.

- [ ] **Step 2: Escribir la migración**

```sql
-- AlterTable
ALTER TABLE "FotofficeWorkspaceBranding" ADD COLUMN "emailSignatureNote" TEXT;
```

- [ ] **Step 3: Validar sin conectar a producción**

`DATABASE_URL="postgresql://u:p@localhost:5432/d" DIRECT_URL="..." pnpm --filter @repo/db exec prisma validate`
Verificar que el SQL no contenga `DROP`, `TRUNCATE`, `DELETE` ni `ALTER COLUMN`.

- [ ] **Step 4: Generar el cliente** — `prisma generate` con las mismas URLs dummy.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): add emailSignatureNote to FotoOffice workspace branding"
```

---

### Task 3: Mapper de FotoOffice

**Files:**
- Create: `apps/fotoffice/lib/communications/workspace-signature.ts`
- Test: `apps/fotoffice/lib/communications/workspace-signature.test.ts`

**Interfaces:**
- Consumes: `EmailSignatureData` de `@repo/communications/signature`
- Produces: `toEmailSignatureData(branding, workspaceName): EmailSignatureData`

- [ ] **Step 1: Escribir el test que falla** (Vitest)

```ts
import { expect, it } from "vitest";
import { toEmailSignatureData } from "./workspace-signature";

const base = { commercialName: "SFPR", logoUrl: null, contactEmail: null, phone: null,
  whatsapp: null, instagram: null, website: null, city: null, accentColor: null,
  emailSignatureNote: null };

it("organizationName: comercial → workspace → FotoOffice", () => {
  expect(toEmailSignatureData(base, "WS").organizationName).toBe("SFPR");
  expect(toEmailSignatureData({ ...base, commercialName: "  " }, "Mi WS").organizationName).toBe("Mi WS");
  expect(toEmailSignatureData({ ...base, commercialName: "" }, "").organizationName).toBe("FotoOffice");
});

it("descarta logos que no sean https absolutos", () => {
  expect(toEmailSignatureData({ ...base, logoUrl: "/uploads/l.png" }, "WS").organizationLogoUrl).toBeUndefined();
  expect(toEmailSignatureData({ ...base, logoUrl: "https://cdn.x/l.png" }, "WS").organizationLogoUrl).toBe("https://cdn.x/l.png");
});

it("no completa closingText ni campos de firmante personal", () => {
  const d = toEmailSignatureData({ ...base, emailSignatureNote: "Nota" }, "WS");
  expect(d.closingText).toBeUndefined();
  expect(d.signerName).toBeUndefined();
  expect(d.signerPhotoUrl).toBeUndefined();
  expect(d.institutionalNote).toBe("Nota");
});
```

- [ ] **Step 2: Correr y verificar que falla** — `pnpm --filter fotoffice test`.

- [ ] **Step 3: Implementar** el mapper con la prioridad de nombre y el filtro de logo.

- [ ] **Step 4: Correr y verificar que pasa.**

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/communications
git commit -m "feat(fotoffice): map workspace branding to email signature data"
```

---

### Task 4: Guardado y validación de la nota

**Files:**
- Modify: `apps/fotoffice/app/workspace/configuracion/actions.ts`
- Modify: `apps/fotoffice/app/workspace/configuracion/page.tsx` (campo del formulario)
- Test: `apps/fotoffice/app/workspace/configuracion/actions.test.ts` (existe)

**Interfaces:**
- Consumes: `FotofficeWorkspaceBranding.emailSignatureNote` (Task 2)

- [ ] **Step 1: Escribir el test que falla** — extender el archivo existente:

```ts
it("guarda la nota recortada", async () => { /* formData con "  Nota  " → update con "Nota" */ });
it("vacío o solo espacios se guarda como null", async () => { /* "   " → null */ });
it("rechaza más de 1500 caracteres", async () => { /* "a".repeat(1501) → error, sin update */ });
it("preserva saltos de línea", async () => { /* "L1\nL2" → "L1\nL2" */ });
```

- [ ] **Step 2: Correr y verificar que falla.**

- [ ] **Step 3: Implementar** — leer del `formData`, `trim`, validar 1500, `|| null`, incluir en el `update`. Añadir el `<textarea name="emailSignatureNote">` con `maxLength={1500}` y texto de ayuda.

- [ ] **Step 4: Correr y verificar que pasa.**

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/app/workspace/configuracion
git commit -m "feat(fotoffice): let workspace admins edit the email signature note"
```

---

### Task 5: Preview aislado

**Files:**
- Create: `apps/fotoffice/components/communications/email-signature-preview.tsx`
- Modify: `apps/fotoffice/app/workspace/configuracion/page.tsx`
- Test: `apps/fotoffice/lib/communications/preview-isolation.test.ts`

**Interfaces:**
- Consumes: `renderEmailSignature` (Task 1), `toEmailSignatureData` (Task 3)

- [ ] **Step 1: Escribir el test que falla** — verificación sobre el código fuente, patrón ya usado en `export-isolation.test.ts`:

```ts
it("el preview usa iframe sandbox sin allow-scripts", () => {
  assert.match(src, /<iframe/);
  assert.match(src, /sandbox=""/);
  assert.doesNotMatch(src, /allow-scripts|allow-same-origin|allow-forms|allow-top-navigation/);
});
it("no usa dangerouslySetInnerHTML", () => {
  assert.doesNotMatch(src, /dangerouslySetInnerHTML/);
});
it("no envía emails", () => {
  assert.doesNotMatch(src, /sendEnrollmentApprovedEmail|api\.resend\.com|fetch\(/);
});
```

- [ ] **Step 2: Correr y verificar que falla.**

- [ ] **Step 3: Implementar** — `<iframe sandbox="" srcDoc={html} title="Vista previa de la firma">`, más el bloque de texto plano en un `<pre>`, los estados sin logo y sin nota, y el aviso: *"Esta es la firma institucional. Más adelante podrás seleccionar un firmante personal."*

- [ ] **Step 4: Correr y verificar que pasa.**

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/components/communications apps/fotoffice/lib/communications apps/fotoffice/app/workspace/configuracion
git commit -m "feat(fotoffice): preview the workspace email signature in a sandboxed iframe"
```

---

### Task 6: Integración con el email de cursos

**Files:**
- Modify: `apps/fotoffice/lib/presential-courses/email.ts`
- Test: `apps/fotoffice/lib/presential-courses/email-signature.test.ts`

**Interfaces:**
- Consumes: `renderEmailSignature` (Task 1), `toEmailSignatureData` (Task 3)

- [ ] **Step 1: Escribir el test que falla**

```ts
it("la firma aparece UNA sola vez en html y en text", () => {
  const body = buildEnrollmentEmailBody(input, signature);
  expect((body.html.match(/id="fo-signature"/g) ?? []).length).toBe(1);
  expect(body.text.split("SFPR").length - 1).toBeGreaterThanOrEqual(1);
  expect(body.html).toContain("Gracias por elegirnos");  // el cierre del template sigue
});
it("el envío incluye text además de html", () => { /* payload tiene ambas claves */ });
it("no cambia asunto ni destinatarios", () => { /* subject y to intactos */ });
```

- [ ] **Step 2: Correr y verificar que falla.**

- [ ] **Step 3: Implementar** — extraer el cuerpo a `buildEnrollmentEmailBody(input, signature)` (pura, testeable sin red), anexar `signature.html` con `id="fo-signature"` y `signature.text`, y sumar `text` al payload de Resend. **No tocar** subject, destinatarios ni reglas de cursos.

- [ ] **Step 4: Correr y verificar que pasa.**

- [ ] **Step 5: Validación completa** — `pnpm --filter fotoffice test` · `tsc --noEmit` · `eslint` · `pnpm --filter fotoffice build` · `pnpm --filter @repo/communications test`

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/presential-courses
git commit -m "feat(fotoffice): sign course emails with the workspace signature"
```

---

## Orden de aplicación en producción

1. Merge de la rama (incluye los commits del spec `4815959d` y `14dc1d33`).
2. **Aplicar la migración ANTES de promover**: `prisma migrate status` → `prisma migrate deploy`. El pipeline de Vercel **no** corre migraciones.
3. La migración es aditiva: el código anterior sigue funcionando con la columna ya creada, así que el orden migración→código es seguro.
4. Push → esperar el preview → `vercel promote` → smoke test.

## Rollback

- **Código:** promover el deployment productivo anterior.
- **Base:** no hace falta revertir. La columna es nullable y nadie más la lee; dejarla es inocuo.
- **Datos:** ninguno se modifica. Los 152 socios y el branding existente quedan intactos.

## Criterios de aceptación

- [ ] Un email de curso llega con la firma institucional del workspace, en HTML y en texto plano.
- [ ] La firma aparece **una sola vez** y el cierre del template no se duplica.
- [ ] Con las imágenes bloqueadas, la firma sigue diciendo quién envía y cómo contactarlo.
- [ ] Un `<script>` en el nombre o en la nota queda inerte en ambas versiones.
- [ ] Un logo con URL relativa, `http:`, `javascript:` o `data:` se omite sin romper el resto.
- [ ] La nota respeta saltos de línea, se recorta y rechaza más de 1500 caracteres.
- [ ] El preview se ve en un iframe sandboxed y no puede enviar emails.
- [ ] Toda la suite en verde: FotoOffice, `@repo/communications`, typecheck, lint y build.
