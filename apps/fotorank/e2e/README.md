# E2E Fotorank — Jurados

## Smoke suite (validación rápida)

Tests marcados con `{ tag: "@smoke" }` cubren el núcleo actual: admin + concursos/resultados, jurado (evaluación), invitación, superficie pública.

| Spec | Qué valida |
|------|------------|
| `admin-results.spec.ts` | Login admin, org activa, listado concursos, detalle, vista resultados / ranking |
| `judge-evaluacion.spec.ts` | Login jurado demo, panel, evaluación y voto CRITERIA_BASED |
| `judge-invite.spec.ts` | Registro con token de invitación + acceso al panel (ver nota seed) |
| `public-judges.spec.ts` | Jurados del concurso (público) + perfil público del jurado |

**Fuera de smoke (suite completa):** `admin-judges.spec.ts` — crear/editar jurado con avatar y bio (más lento; seguir usando `pnpm test:e2e` antes de releases grandes).

| Spec adicional | Qué valida |
|----------------|------------|
| `judge-panel-evaluacion-bloqueada.spec.ts` | Jurado con asignación `INVITATION_SENT`: botón Evaluar deshabilitado + mensaje (`jury.panel-bloqueado@` en seed) |
| `judge-invite.spec.ts` (2.º test) | Token de invitación inexistente → error «Invitación inválida» sin sesión |

**Comandos**

- Con install de browsers: `pnpm test:e2e:smoke`
- Solo ejecutar (browsers ya instalados): `pnpm test:e2e:smoke:only`
- Equivalente directo: `pnpm exec playwright test --grep @smoke`

---

- Constantes: `constants.ts` (deben coincidir con `packages/db/prisma/seed.ts`).
- **`testIds.ts`**: mapa `TT` + `criterionInputTestId(key)` — alinear con `data-testid` en la UI.
- **`pageObjects.ts`**: `JudgeEvaluationForm`, `JudgeAdminForm`, `JudgeInviteForm` (encapsulan selectores estables).
- **`helpers.ts`**: navegación y login (`gotoWhenReady`, `loginAsAdmin` rellena email + contraseña con `E2E_ADMIN_PASSWORD` por defecto, `loginAsJudge`) + `fillAllCriteriaFromConfig` / `submitEvaluationAndExpectSuccess` (delegan en `JudgeEvaluationForm`).
- Invitación: `judge-invite.spec.ts` usa `/jurado/register?token=` vía `JudgeInviteForm`.
- Fixture imagen: `fixtures/avatar.png` (1×1 PNG) para subida en admin.
- Evaluación CRITERIA_BASED: `JudgeEvaluationForm` (`evaluation-form`, `criterion-input-*`, `evaluation-submit`, `vote-saved-message`).
- Admin jurados: `JudgeAdminForm` (`judge-admin-form`, `judge-avatar-preview-img`, `judge-bio-*`).
- Resultados admin: `admin-results.spec.ts` — org activa E2E en `/jurados` si hay varias orgs → tarjeta `fotorank-contest-card-e2e-demo-contest` → detalle → `/resultados`; tabla `fotorank-results-table` (voto CRITERIA_BASED en `seed.ts`, media **4.00**).

Ver la sección **Tests E2E** en el README del monorepo.

## Navegador / Playwright

`pnpm test:e2e` (desde `apps/fotorank`) ya corre **`playwright install`** antes de los tests.

- Solo tests (sin instalar): `pnpm test:e2e:only`
- Solo resultados admin: `pnpm test:e2e:only -- e2e/admin-results.spec.ts`
- Instalación manual: `pnpm test:e2e:install` o `pnpm exec playwright install`

**zsh / pnpm:** no pongas comentarios `# ...` en la misma línea que el comando (puede dar `unknown file attribute: C` o pasar basura a Prisma).

**Requisitos:** app en marcha (`pnpm dev`), base sembrada (`pnpm --filter @repo/db db:seed`) y `DATABASE_URL` coherente. La invitación E2E es de un solo uso hasta volver a sembrar.
