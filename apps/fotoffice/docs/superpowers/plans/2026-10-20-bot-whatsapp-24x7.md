# Bot de WhatsApp 24/7 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Etapa 1 detallada: la Bandeja de WhatsApp (PR #441) al día con `main` y en producción
en modo simulado para DNX Estudio. Etapas 2 a 6 a alto nivel; cada una tendrá su plan detallado
cuando empiece.

**Architecture:** Se trabaja sobre la rama del PR #441 (`feat/fotoffice-bandeja-whatsapp`, worktree
`.claude/worktrees/bandeja-whatsapp`), fusionando `origin/main` dentro (no rebase: la rama ya está
publicada). La migración se renombra con un timestamp posterior al último de `main`. La búsqueda
de cliente por teléfono deja de traer todo el padrón: filtra en la base por los últimos 6 dígitos
y confirma en memoria con `mismoTelefono`.

**Tech Stack:** Next.js (versión del repo, leer `node_modules/next/dist/docs/` antes de tocar
rutas), Prisma (`packages/db`), Vitest, Postgres en Neon.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-20-bot-whatsapp-24x7-design.md`

## Global Constraints

- Todo texto visible en español rioplatense; montos en pesos, fechas en hora argentina.
- Migraciones de FOTOFFICE se aplican **a mano** en la rama Neon `development` + `prisma migrate resolve --applied`; **siempre con OK explícito de Daniel** antes de tocar producción.
- Aplicar el SQL **antes** de fusionar (una tabla que el código espera y no existe rompe el modelo entero).
- No agregar columnas a tablas existentes (`Client`, `Workspace`) en esta etapa.
- Sin dependencias nuevas (el lockfile es de todo el monorepo).
- Modo `SIMULADO` por defecto; nada habla con Meta en esta etapa.
- Comparar siempre contra `origin/main`, nunca contra `main` local.
- `typecheck` puede morir por memoria y devolver éxito: leer la salida, no sólo el código de salida.

## Review Focus

1. Un cliente con teléfono escrito "0341 15 341-9869" y el chat `5493413419869` → debe vincularse (prefiltro por 6 dígitos no lo puede perder).
2. Dos fichas con el mismo teléfono → el chat queda sin cliente (no adivina).
3. Un teléfono extranjero que termina en los mismos 6 dígitos que uno argentino → no se vincula.
4. Ficha con `phone` vacío o con menos de 6 dígitos → no rompe la consulta y no se vincula.
5. Tras la fusión con `main`, el menú y Configuración siguen mostrando todo lo que ya había en `main` (la resolución de conflictos no se "come" entradas nuevas de `main`).

---

## Etapa 1 — Bandeja al día

### Task 1: Fusionar `origin/main` en la rama del PR #441

**Files:**
- Modify (conflictos esperables): `packages/db/prisma/schema.prisma`, `apps/fotoffice/components/shell/shell-nav.tsx`, `apps/fotoffice/components/shell/shell-sidebar.tsx`, `apps/fotoffice/lib/modules/registry.ts`, `apps/fotoffice/lib/integrations/registry.ts`, `apps/fotoffice/lib/circuitos/base-en-memoria.ts`, `apps/fotoffice/app/workspace/configuracion/page.tsx`, `apps/fotoffice/lib/landing/catalogo.ts`, `apps/fotoffice/lib/entrada/institution-shortcut.ts`

- [ ] **Step 1:** En `.claude/worktrees/bandeja-whatsapp`, confirmar árbol limpio y `HEAD == origin/feat/fotoffice-bandeja-whatsapp`.
- [ ] **Step 2:** `git fetch origin && git merge origin/main`.
- [ ] **Step 3:** Resolver cada conflicto con la regla "agregar ambos": conservar todo lo de `main` y sumar lo de la Bandeja (relaciones `waConexion`/`waChats` en `Workspace`, `waChats` en `Client`, entrada "Bandeja" en el menú, módulo `whatsapp-inbox` y la integración WhatsApp en los registros).
- [ ] **Step 4:** `pnpm --filter @repo/db exec prisma format && pnpm --filter @repo/db exec prisma validate && pnpm --filter @repo/db exec prisma generate` (usar el nombre de filtro real de `packages/db/package.json`).
- [ ] **Step 5:** `cd apps/fotoffice && pnpm vitest run lib/bandeja app/actions/bandeja.test.ts app/api/webhooks/whatsapp components/bandeja app/workspace/configuracion/whatsapp lib/modules lib/integrations` → todo PASS.
- [ ] **Step 6:** `pnpm typecheck` en `apps/fotoffice` → sin errores (leer la salida).
- [ ] **Step 7:** Commit del merge: `git commit` (mensaje: "Traer main a la Bandeja de WhatsApp").

### Task 2: Renombrar la migración

**Files:**
- Rename: `packages/db/prisma/migrations/20261027100000_fotoffice_bandeja_whatsapp/` → `packages/db/prisma/migrations/20261126100000_fotoffice_bandeja_whatsapp/`
- Modify: `apps/fotoffice/lib/bandeja/migracion.test.ts:7`

- [ ] **Step 1:** Verificar que la última migración de `origin/main` sigue siendo `20261125120000_clf_agencia_flux`; si hay una posterior, usar un timestamp mayor a esa.
- [ ] **Step 2:** `git mv` de la carpeta; cambiar la ruta en `migracion.test.ts`.
- [ ] **Step 3:** Agregar a `migracion.test.ts`:

```ts
it("es la última migración del repositorio", () => {
  const { readdirSync } = require("node:fs") as typeof import("node:fs");
  const carpetas = readdirSync(join(RAIZ, "packages/db/prisma/migrations")).filter((n) => /^\d{14}_/.test(n)).sort();
  expect(carpetas.at(-1)).toBe("20261126100000_fotoffice_bandeja_whatsapp");
});
```

- [ ] **Step 4:** `pnpm vitest run lib/bandeja/migracion.test.ts` → PASS.
- [ ] **Step 5:** Calcular `shasum -a 256` del `migration.sql` y anotarlo en la descripción del PR.
- [ ] **Step 6:** Commit ("Renombrar la migración de la Bandeja después de la última de main").

### Task 3: Buscar el cliente por teléfono sin traer todo el padrón

**Files:**
- Modify: `apps/fotoffice/lib/bandeja/registro.ts:32-36`
- Modify: `apps/fotoffice/lib/bandeja/telefono.ts` (agregar `ultimos6`)
- Test: `apps/fotoffice/lib/bandeja/telefono.test.ts`, `apps/fotoffice/lib/bandeja/registro.test.ts`

**Interfaces:**
- Produces: `ultimos6(valor: string | null | undefined): string | null` en `telefono.ts`; `clienteDelTelefono(workspaceId, waId, db)` mantiene firma y resultado.

- [ ] **Step 1: Test que falla** (`telefono.test.ts`):

```ts
describe("ultimos6", () => {
  it("toma los 6 dígitos finales sin importar el formato", () => {
    expect(ultimos6("5493413419869")).toBe("419869");
    expect(ultimos6("0341 15 341-9869")).toBe("419869");
    expect(ultimos6("+54 9 341 341 9869")).toBe("419869");
  });
  it("devuelve null con menos de 6 dígitos o vacío", () => {
    expect(ultimos6("12345")).toBeNull();
    expect(ultimos6(null)).toBeNull();
    expect(ultimos6("")).toBeNull();
  });
});
```

- [ ] **Step 2:** `pnpm vitest run lib/bandeja/telefono.test.ts` → FAIL (`ultimos6` no existe).
- [ ] **Step 3: Implementar** en `telefono.ts`:

```ts
/**
 * Últimos 6 dígitos: siempre caen dentro del número de abonado (6 a 8 dígitos en Argentina), así
 * que no los alteran el 54, el 9, el 0 ni el 15. Sirve para prefiltrar en la base; la comparación
 * de verdad la hace `mismoTelefono`.
 */
export function ultimos6(valor: string | null | undefined): string | null {
  const digitos = (valor ?? "").replace(/\D/g, "");
  return digitos.length >= 6 ? digitos.slice(-6) : null;
}
```

- [ ] **Step 4:** `pnpm vitest run lib/bandeja/telefono.test.ts` → PASS.
- [ ] **Step 5: Test que falla** (`registro.test.ts`). Prisma no puede filtrar por los dígitos de un texto con espacios y guiones, así que se usa SQL crudo con parámetros:

```ts
it("clienteDelTelefono pide a la base sólo los candidatos por los últimos 6 dígitos", async () => {
  const llamadas: unknown[][] = [];
  const db = {
    $queryRaw: async (...args: unknown[]) => { llamadas.push(args); return [{ id: "c1", phone: "0341 15 341-9869" }, { id: "c2", phone: "+1 555 341 9869" }]; },
  };
  expect(await clienteDelTelefono("ws1", "5493413419869", db)).toBe("c1");
  expect(llamadas).toHaveLength(1);
  expect(JSON.stringify(llamadas[0])).toContain("419869");
});

it("no vincula si dos fichas coinciden", async () => {
  const db = { $queryRaw: async () => [{ id: "c1", phone: "3413419869" }, { id: "c2", phone: "0341 341 9869" }] };
  expect(await clienteDelTelefono("ws1", "5493413419869", db)).toBeNull();
});

it("no consulta la base si el waId no tiene 6 dígitos", async () => {
  const db = { $queryRaw: async () => { throw new Error("no debería consultar"); } };
  expect(await clienteDelTelefono("ws1", "123", db)).toBeNull();
});
```

- [ ] **Step 6:** Correr → FAIL.
- [ ] **Step 7: Implementar** en `registro.ts`:

```ts
/** Ficha con ese teléfono (si hay exactamente una). Prefiltra en la base por los últimos 6 dígitos. */
export async function clienteDelTelefono(workspaceId: string, waId: string, db: Pick<Db, "$queryRaw"> = prisma): Promise<string | null> {
  const fin = ultimos6(waId);
  if (!fin) return null;
  const fichas = await db.$queryRaw<{ id: string; phone: string | null }[]>`
    SELECT "id", "phone" FROM "Client"
    WHERE "workspaceId" = ${workspaceId}
      AND "phone" IS NOT NULL
      AND right(regexp_replace("phone", '\\D', '', 'g'), 6) = ${fin}`;
  const coinciden = fichas.filter((f) => mismoTelefono(waId, f.phone));
  return coinciden.length === 1 ? coinciden[0].id : null;
}
```

Ajustar la llamada de la línea ~144 (`clienteDelTelefono(workspaceId, ev.waId, tx)`) y el tipo del `tx` si hace falta. Verificar el nombre real de la tabla de `Client` en `schema.prisma` (`@@map`).

- [ ] **Step 8:** Correr → PASS. Correr todo `lib/bandeja` → PASS (los tests existentes que pasaban un doble con `client.findMany` se adaptan a `$queryRaw`).
- [ ] **Step 9: Probar el SQL con parámetros reales** contra una rama Neon de prueba (Prisma manda los parámetros tipados; un SQL que anda pegado a mano puede fallar con parámetros): crear rama desde `development`, correr `clienteDelTelefono` con un `workspaceId` y un teléfono de un cliente real de DNX Estudio vía script `tsx` de un solo uso, confirmar el id, borrar la rama.
- [ ] **Step 10:** Commit ("Bandeja: buscar el cliente por teléfono sin leer todo el padrón").

### Task 4: Verificar, publicar y dejar el PR en verde

- [ ] **Step 1:** `cd apps/fotoffice && pnpm test` → todo PASS.
- [ ] **Step 2:** `pnpm typecheck` → sin errores (leer la salida).
- [ ] **Step 3:** `next dev --webpack` en el worktree, entrar a `/bandeja` y a Configuración → WhatsApp, mandar un mensaje con el simulador, ver que aparece en la Bandeja y que Tomar / Devolver al bot cambian el estado. Necesita la tabla: usar la rama Neon de prueba del Task 3 con el SQL aplicado.
- [ ] **Step 4:** `git push`; actualizar la descripción del PR #441 (nueva migración + sha256, prefiltro por teléfono, enlace a este plan).
- [ ] **Step 5:** Esperar CI verde.

### Task 5: Producción en modo simulado (requiere OK de Daniel)

- [ ] **Step 1:** Pedir OK a Daniel para aplicar el SQL en producción, explicando: crea tres tablas nuevas, no toca ninguna existente.
- [ ] **Step 2:** Con el OK: aplicar `migration.sql` en la rama Neon `development` de FOTOFFICE y registrar con `prisma migrate resolve --applied 20261126100000_fotoffice_bandeja_whatsapp` (checksum del archivo).
- [ ] **Step 3:** Verificar que las tres tablas existen y que `_prisma_migrations` tiene la fila.
- [ ] **Step 4:** Fusionar el PR #441 (CI verde).
- [ ] **Step 5:** Encender el módulo de la Bandeja sólo para el workspace `dnx-estudio` (el de Daniel, **no** `dnxestudio`), en modo SIMULADO.
- [ ] **Step 6:** Probar en producción con el simulador: un mensaje entra, aparece en `/bandeja`, se responde desde el panel (en simulado no sale a Meta).
- [ ] **Step 7:** Borrar la rama Neon vieja `prueba-bandeja-whatsapp-20261009` (br-bold-thunder-adeh5hbn) y la del Task 3, con OK de Daniel.
- [ ] **Step 8:** Actualizar memoria del proyecto.

---

## Etapas siguientes (plan detallado al empezar cada una)

**Etapa 2 — Archivos entrantes.** Descarga inmediata del medio (`GET /{media-id}` → URL → bajar) en
segundo plano; R2 privado; tabla de archivos del chat (clave, mime, bytes, ancho/alto); miniaturas
en la Bandeja; "Pasar al pedido…" → `FotofficeArchivoTrabajo` con nota del ítem; tabla medida →
píxeles mínimos; link de carpeta con modo "el cliente puede subir" con vencimiento (sobre
`lib/carpetas/almacen.ts`); fixtures para el simulador.

**Etapa 3 — El bot atiende (simulado).** Canal WhatsApp en `lib/dnx-bot`; herramientas
`buscar_catalogo`, `identificar_cliente`, `armar_pedido`, `asignar_archivos`,
`enviar_link_de_pago`, `pasar_a_persona`; control de montos al enviar (como `cifras.ts`);
recordatorio único dentro de las 24 h; estado "esperando material" + botón "Material recibido";
evals con los 8 casos del spec.

**Etapa 4 — A aprobar.** Herramienta `preparar_presupuesto` sobre presupuestos + plantillas
(PR 419/423) con chat vinculado; vista "A aprobar" en Pedidos con contador; Aprobar y enviar /
Corregir / Lo atiendo yo; tarjeta del bot en el tablero.

**Etapa 5 — Meta real.** Guía para que Daniel cree la app y verifique el negocio; coexistencia;
variables; confirmar payloads reales; piloto con Camila y Sabina.

**Etapa 6 — Avisar que está listo.** Botón en el pedido que arma el texto y abre `wa.me`
(`buildWhatsappUrl`); guarda fecha y quién avisó.
