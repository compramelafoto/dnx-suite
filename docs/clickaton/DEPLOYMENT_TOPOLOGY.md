# Clickatón — Deployment Topology

**Última actualización:** 2026-08-01 (Imp10bis)

```text
NO ASUMIR QUE UN DEPLOYMENT “PRODUCTION” DE VERCEL
PERTENECE AL PRODUCTO REAL.
VERIFICAR SIEMPRE PROJECT ID Y DOMAIN.
```

---

## Proyectos

| Campo | Staging | Producción |
| ----- | ------- | ---------- |
| Proyecto | `clickaton-staging` | `clickaton-dnxsuite` |
| Project ID parcial | `prj_MM6Bkdi8***` | `prj_wo7NXldJ***` |
| Team | `compramelafotos-projects` | mismo |
| Git repo | `compramelafoto/dnx-suite` | mismo |
| Root directory | `apps/clickaton` | `apps/clickaton` |
| Framework | Next.js | Next.js |
| Production Branch (Vercel) | `clickaton-staging` | `main` |
| Branch WIP / staging lógico | `migration-legacy-clf-to-monorepo` | **no** |
| Dominio principal | `clickaton-staging.vercel.app` | `maratonfotografica.com` |
| Ignored Build Step | ninguno | **solo construye `main`** |

### Distinción crítica

| Concepto | Significado |
| -------- | ----------- |
| `VERCEL ENVIRONMENT = Production` | Entorno principal **de ese proyecto** |
| `PRODUCT ENVIRONMENT = Staging` | Producto/lógico staging (`clickaton-staging`) |
| `PRODUCT ENVIRONMENT = Production` | Producto real (`maratonfotografica.com`) |

---

## Branches canónicas

```text
CLICKATON_PRODUCTION_BRANCH=main
CLICKATON_STAGING_BRANCH=migration-legacy-clf-to-monorepo
```

- Producción (`clickaton-dnxsuite`) auto-build **solo** desde `main`.
- Staging (`clickaton-staging`) recibe previews de la branch WIP; el Production Branch Vercel del proyecto staging sigue siendo `clickaton-staging` (promote/manual si hace falta alinear alias).

---

## Ignored Build Step (producción)

Configurado en `clickaton-dnxsuite`:

```bash
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 1; else exit 0; fi
```

Semántica Vercel:

- `exit 0` → **skip** build
- `exit 1` → **continue** build

Histórico incorrecto (causa Imp10):

```bash
# SOLO ignoraba clickaton-staging; dejaba pasar migration-legacy-*
if [ "$VERCEL_GIT_COMMIT_REF" = "clickaton-staging" ]; then exit 0; else exit 1; fi
```

---

## Links CLI locales (no versionar)

| Ruta | Proyecto linkeado |
| ---- | ----------------- |
| `apps/clickaton/.vercel` | `clickaton-staging` ✅ |
| repo root `.vercel` | `clickaton-dnxsuite` ⚠️ peligroso |
| `.gitignore` | incluye `.vercel` |

**Prohibido:** `vercel --prod` desde la raíz del monorepo sin relink explícito.

---

## Flujos

### Staging

1. Push a `migration-legacy-clf-to-monorepo`
2. `clickaton-staging` construye Preview (y/o Production del proyecto staging según branch/promote)
3. Validar en `clickaton-staging.vercel.app`
4. Guards: `pnpm --filter clickaton deployment:identity`

### Producción

1. Merge/aprobación a `main`
2. Auto-deploy `clickaton-dnxsuite` → `maratonfotografica.com`
3. Release flow / promote solo con autorización
4. Nunca desde branch WIP

### Promoción

- Staging → Producto real: **manual / release**, nunca auto desde WIP.
- Promote dentro de `clickaton-staging` (Vercel Production del proyecto staging) ≠ producto real.

---

## Prohibiciones

- No asignar `maratonfotografica.com` a `clickaton-staging`
- No auto-deploy productivo desde `migration-legacy-clf-to-monorepo`
- No deploy CLI desde root linkeado a `clickaton-dnxsuite` para trabajo staging
- No asumir “Production” = producto real
- No force push a `main`

---

## Rollback

1. Identificar deployment productivo previo sano
2. Promote/rollback solo en `clickaton-dnxsuite`
3. No tocar staging salvo necesidad
4. Conservar evidencia

---

## Checklist pre-deploy staging

- [ ] `deployment:identity` PASS (proyecto staging)
- [ ] Branch = `migration-legacy-clf-to-monorepo` (o canónica actual)
- [ ] No secretos en diff
- [ ] Ignored build prod sigue en “solo main”
- [ ] No `--prod` hacia producto real
- [ ] Webhook Communications disabled salvo go-live autorizado
