# ComprameLaFoto — Diagnóstico runtime 500 (preview)

**Fecha:** 2026-07-09  
**Reconfirmado:** 2026-07-09 (misma dpl; probes + runtime-logs NDJSON)  
**Preview URL:** `https://compramelafoto-dnxsuite-5njrysi54-compramelafotos-projects.vercel.app`  
**Deployment:** `dpl_7sehZG7UnXDjTWcjBD1ScZMndrJ5`  
**Commit:** `259cf52f24b2b8f1a734ff7b46df4ec281adb64b`  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Proyecto Vercel:** `compramelafoto-dnxsuite` (`prj_onlsJ1X9XOYyBFK0Qn5ojth4D1He`)

**Restricciones respetadas:** sin producción · sin DNS · sin deploy · sin modificar settings Vercel · sin commit.

---

## Resumen ejecutivo

Con Protection Bypass activo, las rutas **llegan a la app** (no a Vercel SSO) y responden **500**.

| Capa                                        | Causa                                                                                                                                                  | Afecta                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **A (primaria, App Router routes)**         | `ERR_REQUIRE_ESM`: Vercel `___next_launcher.cjs` hace `require()` de `route.js` ESM porque `apps/compramelafoto/package.json` tiene `"type": "module"` | `/api/auth/me`, `/api/public/albums` (y cualquier `app/**/route.js`) |
| **B (secundaria, página SSR que sí carga)** | `PrismaClientInitializationError`: credenciales DB inválidas en preview (`Authentication failed against database server`)                              | `/blog` (y, tras fix A, probablemente APIs que usen Prisma)          |

**No es:** Deployment Protection, P2021/P2022 en este deployment, ni fallo de build (`build.hasErrors: false`, state `READY`).

**Diagnóstico temporal en rutas:** **no aplicado** — los runtime logs ya exponen stack/código de error.

---

## 1. Probe HTTP con bypass

Secret vía header `x-vercel-protection-bypass` (no logueado).

| Path                 | HTTP | `content-type`             | Destino | Notas de headers                                                          |
| -------------------- | ---- | -------------------------- | ------- | ------------------------------------------------------------------------- |
| `/api/auth/me`       | 500  | `text/html; charset=utf-8` | app     | `x-matched-path: /500`, body `__next_error__`, `data-dpl-id=dpl_7sehZG7…` |
| `/api/public/albums` | 500  | `text/html; charset=utf-8` | app     | igual (`/500`)                                                            |
| `/blog`              | 500  | `text/html; charset=utf-8` | app     | `x-matched-path: /blog`, `x-powered-by: Next.js` — error SSR real         |

Sin bypass (control): **302** hacia SSO Vercel.

`vercel_validate_staging` (mismo deployment): `protectionBypass.enabled=true`, smoke `/` 200, `/checkout` 500; runtime sample vacío en el wrapper del tool (API de logs es **stream NDJSON**, no array JSON).

---

## 2. Runtime logs Vercel

**Endpoint:** `GET /v1/projects/{projectId}/deployments/{deploymentId}/runtime-logs`  
**Formato:** stream NDJSON (el cliente corta por timeout; bastan las primeras líneas post-probe).

### 2.1 `/api/public/albums` (y mismo patrón en `/api/auth/me` en probes previos)

```text
level: error
Failed to handle /api/public/albums ...
Error: require() of ES Module
  /var/task/apps/compramelafoto/.next/server/app/api/public/albums/route.js
  from /var/task/apps/compramelafoto/___next_launcher.cjs not supported.
route.js is treated as an ES module file as it is a .js file whose nearest
parent package.json contains "type": "module" ...
code: 'ERR_REQUIRE_ESM'
```

Mismo mecanismo documentado antes en `dpl_CGQfoZaiW7PU2Cu9ukpLh2wVqKEz` para `/api/auth/me`.

### 2.2 `/blog`

```text
prisma:error
Invalid `prisma.blogPost.findFirst()` invocation:
Authentication failed against database server, the provided database
credentials for `(not available)` are not valid.

Error [PrismaClientInitializationError]:
Invalid `prisma.blogCategory.findMany()` invocation:
... same authentication failure ...
digest: '1041142132'
clientVersion: '6.19.2'
```

### 2.3 Qué no apareció en este stream

| Buscado                                           | Resultado en logs de este dpl |
| ------------------------------------------------- | ----------------------------- |
| Prisma `P2021` / `P2022`                          | No                            |
| Env faltante explícita en stack de route handlers | No (los handlers ni cargan)   |
| Middleware/edge stack                             | No en sample                  |
| Import runtime genérico fuera de ESM launcher     | No                            |

---

## 3. Evidencia en repo (solo lectura)

`apps/compramelafoto/package.json`:

```json
"type": "module"
```

Eso marca **todos** los `.js` del paquete (incluido `.next/server/.../route.js` en `/var/task`) como ESM. El launcher de Vercel (`___next_launcher.cjs`) usa `require()` → `ERR_REQUIRE_ESM`.

Nota: otras apps del monorepo (`fotorank`, `fotoffice`) también declaran `"type": "module"`; el síntoma se confirma aquí por logs de **este** deployment CLF.

Env preview (conteo vía validate, **sin valores**): ~10 variables en target preview (incluye `DATABASE_URL` / `DIRECT_URL` como nombres). El error B indica que el valor efectivo en runtime **no autentica** contra Neon (credencial inválida/revocada/host incorrecto), no necesariamente “variable ausente”.

---

## 4. Causa raíz

### Causa A — Route handlers App Router

1. Build emite `route.js` bajo `apps/compramelafoto/.next/server/...`
2. En runtime, Node resuelve el `package.json` de la app con `"type": "module"`
3. `___next_launcher.cjs` hace `require(route.js)` → **`ERR_REQUIRE_ESM`**
4. Next responde página de error `__next_error__` / matching `/500`

Por eso `/api/auth/me` y `/api/public/albums` fallan **antes** de ejecutar lógica de auth/Prisma.

### Causa B — `/blog` (SSR página)

La página **sí** entra al runtime de Next lo suficiente como para invocar Prisma. Ahí falla la **inicialización/auth de Postgres** (`PrismaClientInitializationError`), no un gap de schema P2021/P2022 en este sample.

Interpretación operativa: tras corregir A, es **probable** que las APIs que usan DB muestren el mismo fallo de credenciales (u otros errores de schema/seed) en lugar del ESM.

---

## 5. Fix mínimo propuesto (no aplicado)

### Fix A (bloqueante para APIs App Router) — prioridad 1

En `apps/compramelafoto/package.json`:

- **Opción recomendada:** eliminar `"type": "module"` (Next App Router en Vercel no necesita ese campo en la app; el bundler ya decide formato de salida).
- Alternativa: `"type": "commonjs"` solo si algún script local depende de CJS explícito.

Luego: **redeploy solo preview** (git push a la rama de migración / redeploy del deployment).  
**No** tocar producción ni DNS.

Validación esperada post-fix A:

| Ruta                 | Antes             | Después (esperado)                                                  |
| -------------------- | ----------------- | ------------------------------------------------------------------- |
| `/api/auth/me`       | 500 HTML ESM      | 200/401 JSON de app (o error Prisma/auth, **no** `ERR_REQUIRE_ESM`) |
| `/api/public/albums` | 500 HTML ESM      | JSON de app o error DB explícito                                    |
| Runtime log          | `ERR_REQUIRE_ESM` | Ausente                                                             |

### Fix B (credenciales preview) — prioridad 2

1. Verificar en Vercel (UI/API read-only) que `DATABASE_URL` / `DIRECT_URL` del target **preview** apunten al Neon de staging correcto y vigentes.
2. Rotar/corregir si las credenciales fueron regeneradas en Neon y no actualizadas en preview.
3. Smoke: `prisma.$queryRaw\`SELECT 1\``o`/blog`sin`PrismaClientInitializationError`.

**No** aplicar migraciones ni seed en este ticket salvo decisión explícita posterior.

### No hacer (por ahora)

- Desactivar Deployment Protection / cambiar SSO
- Instrumentación temporal en rutas (ya hay stack en logs)
- Cambiar `type` en packages compartidos sin necesidad
- Commit/deploy desde este diagnóstico

---

## 6. Checklist de verificación post-fix

- [ ] Runtime log sin `ERR_REQUIRE_ESM` / `___next_launcher.cjs`
- [ ] `/api/auth/me` + bypass → JSON (no HTML `/500`)
- [ ] `/api/public/albums` + bypass → JSON
- [ ] `/blog` + bypass → 200 o error de dominio (no auth failure de DB)
- [ ] Producción intacta (sin alias/DNS changes)

---

## 7. Referencias

- Runtime logs: `GET /v1/projects/prj_onlsJ1X9XOYyBFK0Qn5ojth4D1He/deployments/dpl_7sehZG7UnXDjTWcjBD1ScZMndrJ5/runtime-logs`
- Diagnósticos previos: [`compramelafoto-preview-runtime-diagnostic.md`](./compramelafoto-preview-runtime-diagnostic.md), [`compramelafoto-preview-login-diagnostic.md`](./compramelafoto-preview-login-diagnostic.md)
- Bypass: [`compramelafoto-vercel-preview-protection-plan.md`](./compramelafoto-vercel-preview-protection-plan.md)
