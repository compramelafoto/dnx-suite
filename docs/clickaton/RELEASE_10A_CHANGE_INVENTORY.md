# RELEASE 10A — Inventario de cambios (working tree)

**Fecha auditoría:** 2026-07-28  
**Repo:** `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite`  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD:** `aa92de8e80ae2510db3255f694ad03c348bcd720`  
**Remote:** `origin` → `https://github.com/compramelafoto/dnx-suite.git`  
**Tracking:** ahead 24 vs `origin/migration-legacy-clf-to-monorepo`  
**Working tree:** sucio — **266** paths modificados/nuevos (sin commit en 10A)

## Preflight

| Ítem | Estado |
|------|--------|
| Lockfile | `pnpm-lock.yaml` modificado |
| Symlinks | solo `node_modules` (workspace links) |
| Conflictos git | ninguno detectado |
| `.env` en árbol | presentes locales (no stagear); ver matriz env |
| Docker | CLI `docker` **no disponible** en este host |
| Auth0 CLI | **no instalado** (y Auth0 **no** es la identidad real) |
| `gh` | CLI presente, **sin login** |
| Vercel CLI | autenticado (`compramelafoto`) |
| Neon DB (packages/db) | **unreachable** (`P1001`) al momento de la auditoría |

## Clasificación (conteo)

| Bucket | Paths |
|--------|------:|
| Clickatón | 114 |
| FotoRank (app + migraciones FR mezcladas) | 48 |
| WIP ajeno — Infospot | 49 |
| DNX Payments | 18 |
| Migraciones Prisma (carpetas nuevas) | 9+ |
| Documentación Clickatón | 8 |
| DB/schema | 4 |
| Documentación otra | 4 |
| Workspace tooling | 3 |
| Social Publisher / Promotions / Media Composition | ~5 |
| WIP ajeno — otras apps / packages | ~6 |

---

## INCLUIR EN RELEASE (Clickatón + dependencias críticas)

### Apps / Clickatón

- Panel: precios, finanzas, promociones, social, consignas, cronograma, export inscripciones
- Flujo público: wizard, productos incluidos, timeline, resumen/pago
- Checkout DNX Payments + allocations + finance snapshot
- Crons: `expire-registration-holds`, `fotorank-sync`, `welcome-cards`, `social-publish`
- Seeds: `seed-argentina-2026-edition.ts`, config `config/editions/argentina-2026.ts`
- Script seguro: `scripts/release-check-env.ts`

### Packages

- `packages/db` — schema + migraciones Clickatón/DNX listadas en plan de migraciones
- `packages/payments` — edition checkout, owner OAuth, allocations bridge
- `packages/promotions`
- `packages/media-composition`
- `packages/social-publisher`

### Docs (esta etapa)

- `docs/clickaton/RELEASE_10A_*.md`

### Tooling mínimo

- `apps/clickaton/package.json` / `vercel.json`
- `pnpm-lock.yaml` **solo si** las deps nuevas de packages anteriores lo requieren
- `turbo.json` / `.gitignore` **solo** tras revisar que no arrastren WIP ajeno

---

## EXCLUIR (WIP ajeno — no descartar, no stagear)

- `apps/infospot/**` (49 paths)
- `packages/editorial-intelligence/**`
- `packages/recommendations/**`
- `apps/compramelafoto/next-env.d.ts` (ruido tipado)
- `apps/dnx-sales-assistant/config/pricing/...` (ajeno)
- `services/dnx-mcp/src/platforms/platforms/fotorank.ts` salvo decisión explícita de catálogo MCP
- Migraciones FotoRank P0 **si** el release Clickatón se hace selectivo y staging/prod Clickatón no debe arrastrar FR WIP:
  - `20260728120000_fotorank_p0_01_registration_rules_fee_assets`
  - `20260728140000_fotorank_p0_06_entry_upload_exif_checklist`
  - `20260728160000_fotorank_p0_07_jury_anonymization_rules_storage`

> **No** hacer `git reset` / `checkout --` sobre WIP ajeno.

---

## REVISAR

| Área | Motivo |
|------|--------|
| `apps/fotorank/**` (UI/login/public-api) | Puede ser necesario para sync Clickatón↔FotoRank; también hay cambios P0 concurrentes |
| Migraciones FotoRank P0 | Misma cadena Prisma; riesgo de acoplar releases |
| `docs/fotorank/**`, `docs/infospot/**`, `docs/social-publisher/**` | Docs paralelos |
| `packages/db/prisma/scripts/seed-santa-fe-en-foco.ts` | No es Argentina 2026 |
| Selfchecks checkout/persistence | Fallan por `CONSENT_REQUIRED` (regresión de seeds de test) |

---

## ARCHIVOS MIXTOS

| Path | Por qué |
|------|---------|
| `packages/db/prisma/schema.prisma` | Modelos Clickatón + FotoRank + Infospot en un solo schema |
| `pnpm-lock.yaml` | Deps de varios packages del monorepo |
| `turbo.json` | Pipeline global |
| `.gitignore` | Posible impacto cross-app |

---

## RIESGOS

1. **Staging selectivo difícil:** un solo `schema.prisma` + migraciones ordenadas; no se puede “omitir” una migración intermedia sin romper checksum.
2. **FotoRank P0 en la misma cola** que Clickatón 28-jul → deploy de DB Clickatón puede exigir aplicar FR P0.
3. **Working tree grande** → alto riesgo de stagear Infospot por accidente.
4. **Neon inaccesible** desde este host → no se pudo confirmar `_prisma_migrations` remoto.
5. **Staging Vercel en ERROR** (último deploy fallido).
6. **Producción** (`clickaton-dnxsuite`) tiene muy pocas env vars listadas vs staging.

---

## Comandos sugeridos de staging selectivo

```bash
# 1) Ver solo Clickatón + pagos + docs 10A
git status --porcelain | rg 'apps/clickaton|packages/(db|payments|promotions|media-composition|social-publisher)|docs/clickaton/RELEASE_10A|pnpm-lock|turbo.json|package.json|apps/clickaton/package.json'

# 2) Stage explícito (ejemplo — ajustar tras revisión humana)
git add apps/clickaton \
  packages/payments \
  packages/promotions \
  packages/media-composition \
  packages/social-publisher \
  packages/db/prisma/schema.prisma \
  packages/db/prisma/migrations/20260728010000_clickaton_edition_commercial_fields \
  packages/db/prisma/migrations/20260728020000_clickaton_registration_price_phases \
  packages/db/prisma/migrations/20260728030000_dnx_promotions \
  packages/db/prisma/migrations/20260728040000_clickaton_merch_fulfillment \
  packages/db/prisma/migrations/20260728050000_clickaton_edition_finance_soft_refs \
  packages/db/prisma/migrations/20260728060000_dnx_payment_order_allocation \
  packages/db/prisma/migrations/20260728070000_clickaton_fotorank_sync \
  packages/db/prisma/migrations/20260728080000_clickaton_welcome_cards \
  packages/db/prisma/migrations/20260728090000_dnx_social_publisher \
  packages/db/prisma/migrations/20260728100000_clickaton_timeline_prompts \
  packages/db/prisma/migrations/20260728180000_clickaton_price_phase_products_and_store \
  docs/clickaton/RELEASE_10A_*.md \
  package.json apps/clickaton/package.json pnpm-lock.yaml

# 3) NO agregar
# apps/infospot packages/editorial-intelligence packages/recommendations

# 4) Verificar staged
git diff --cached --stat
```

**Nota Prisma:** si el entorno destino aún no tiene migraciones FR P0 y el schema las requiere, habrá que **incluirlas** o **separar release de schema** en 10B con decisión explícita. No forzar en 10A.

---

## No hecho en 10A

- commit / push / deploy
- apertura de inscripciones
- pagos LIVE
- migraciones productivas
