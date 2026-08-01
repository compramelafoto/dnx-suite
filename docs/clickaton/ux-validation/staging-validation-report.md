# Staging validation report — Etapa 03 Imp. 01

**Palabra clave:** `Clickatón UX`  
**Fecha de prueba:** 2026-08-01  
**Estado general Imp. 01:** `PARTIAL` (histórico)  
**Estado schema Imp. 02:** `RESOLVED` / etapa recuperación `DONE`  
**Repo:** branch `migration-legacy-clf-to-monorepo` + cambios locales sin commit  
**Deploy staging actual:** `dpl_6Q942pMuz31pwcAtNv8xCikrJvxM` → `https://clickaton-staging.vercel.app`  
**Nota Imp. 02:** migraciones Prisma aplicadas a Neon staging; P2022 cerrado. Ver `schema-drift-recovery-report.md`.

---

## Entorno utilizado

| Check | Resultado |
|-------|-----------|
| URL staging | `https://clickaton-staging.vercel.app` |
| Staging responde | Sí (marketing 200) |
| DB staging | `/api/public/health/db` → `ok:true`, host `ep-round-fog-a4xgibtv-pooler`, `publishedEditions: 11` |
| ¿Producción? | No (Neon staging; no se usó host productivo) |
| `.env.local` local | Denylist production → no usado para ops |
| Flags social LIVE | No ejercidos; no se publicó |
| Mercado Pago TEST | No alcanzado (Brick bloqueado) |
| Resend | No se enviaron correos reales |
| Disco | ~5 GiB libres; capturas JPEG |

---

## Perfiles utilizados

| Perfil | Uso |
|--------|-----|
| Visitante sin sesión | Completo en marketing + auth gates |
| Participante (varios estados) | **No** — sin fixtures de sesión |
| Administrador general/operativo | **No** — sin credenciales |
| Usuario sin permisos | Solo redirect login en `/admin` |
| Edición preparada | Datos en DB (11) pero lectura pública rota por schema |

---

## Rutas abiertas (browser / HTTP)

**22 rutas** tocadas (incluye auth redirects, 404, legales, marketing, maratones, health).

Clasificación agregada (matriz detalle en `staging-route-matrix.md`):

| Resultado | Cantidad |
|-----------|----------|
| PASS | 9 |
| PASS_WITH_OBSERVATIONS | 5 |
| FAIL | 4 |
| BLOCKED | 18+ (admin/mi-cuenta autenticado/checkout profundo) |
| OUT_OF_SCOPE | 3 (jurado FotoRank, tienda operativa, publicación LIVE) |

---

## Recorridos

| # | Recorrido | Estado |
|---|-----------|--------|
| 01 | Navegación pública | `PASS_WITH_OBSERVATIONS` — clara, ES, menú mobile OK; agenda vacía por error Prisma |
| 02 | Inscripción | `BLOCKED` / `FAIL` precursor — detalle 500 |
| 03 | Checkout + Brick | `BRICK_STAGING_BLOCKED` |
| 04 | Mi cuenta | Auth redirect OK; contenido `BLOCKED` |
| 05–13 | Admin / finanzas / cronograma / etc. | `BLOCKED` sin sesión |
| 14 | Errores / vacíos | 404 OK; error boundary `/maratones` usable en copy; empty home por catch |

---

## Hallazgos principales

### P0

Ninguno de seguridad/doble cobro observado (no se cobró).

### P1

1. ~~**Prisma P2022** — `coverImageVerticalUrl`~~ → **RESOLVED** en Imp. 02 (`migrate deploy` + smoke 200).  
2. ~~**Links legales auth**~~ → **RESOLVED** en deploy staging (`/legal/*`).

### P2

1. Home muestra “próximamente / sin inscripciones” pese a 11 ediciones en DB (efecto del fallo de listado).  
2. Checkout/Brick no usable en staging hasta reparar schema + funnel.

### P3

Copy marketing residual de prelanzamiento; pulido visual menor no abordado.

---

## Correcciones realizadas (locales, sin deploy)

1. `packages/auth-ui/src/brand/clickaton.ts` → URLs `/legal/*`.  
2. `maratones/page.tsx` → try/catch → empty state.  
3. `maratones/[slug]/page.tsx` → try/catch → 404 / offer degradada.  
4. Tests: assertion brand legal + `e2e/public-ux-smoke.spec.ts` + soft 500 en pilot smoke.  
5. Probe script `apps/clickaton/scripts/ux-staging-browser-probe.mjs`.

**No** se modificaron rutas API, permisos, estados persistidos, integraciones, validadores, cálculos ni lógica comercial.

---

## Capturas

Carpeta: `docs/clickaton/ux-validation/screenshots/` (JPEG desktop + 390 y muestras 320/360/430/tablet en home).  
Raw probe: `browser-probe-raw.json`.  
**Overflow involuntario:** 0 en rutas públicas sondeadas.

---

## Tests / calidad

| Suite | Resultado |
|-------|-----------|
| `test:public-ux` … `test:global-ux` | PASS |
| Typecheck (`tsc --noEmit`) | PASS |
| Lint (archivos tocados) | PASS (warning ignore auth-ui path) |
| E2E `env-smoke` + `public-ux-smoke` | 16/16 PASS |
| Build | PASS |

Selfchecks de cobro/email productivos: **no ejecutados** (riesgo / fuera de alcance seguro).

---

## Riesgos

1. Staging sigue 500 en maratones hasta migración o deploy del degradado.  
2. Fixes legales no visibles hasta redeploy.  
3. Validación admin/Brick incompleta → no declarar usabilidad operativa total.

---

## Commit / push / deploy

**No** se hizo commit, push ni deploy (pedido explícito).

## Imp. 03 (2026-08-01)

- Estado autenticado: **PARTIAL** — ver `staging-authenticated-validation-report.md`.
- Fixtures TEST UX + guard deploy: ver `staging-test-fixtures.md`, `staging-deploy-safety.md`.
- Brick: `BRICK_STAGING_BLOCKED`. Auth paneles prioritarios: PASS.
