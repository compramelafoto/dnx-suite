# RELEASE 10B.2 — Preflight

**Fecha:** 2026-07-28  
**Etapa:** Creación y validación de infraestructura productiva Clickatón  
**Rama:** `migration-legacy-clf-to-monorepo`

---

## Git

| Ítem | Valor |
|------|-------|
| Rama | `migration-legacy-clf-to-monorepo` |
| HEAD (inicio 10B.2) | `36a2936` (`docs(clickaton): add RELEASE 10B.1 staging unblock reports`) |
| Commits clave previos | `6a896cb` (Prisma externals), `bf76c69` (rhel engine), `f81b422` (health DB), `3870015` (release controlado) |
| Working tree | WIP ajeno amplio (InfoSpot editorial/recommendations, FotoRank P0-09, etc.) — **no tocado** |
| Scope 10B.2 | Solo Clickatón prod infra + CTA owner MP + docs `RELEASE_10B2_*` |

### Commits recientes (contexto)

```
36a2936 docs(clickaton): add RELEASE 10B.1 staging unblock reports
6a896cb fix(clickaton): avoid transpilePackages conflict with Prisma externals
bf76c69 fix(clickaton): include Prisma rhel query engine on Vercel
f81b422 fix(clickaton): add public DB health diagnostic for staging Prisma 500
8d59ce0 docs(clickaton): add RELEASE 10B deploy report
```

---

## Herramientas

| Tool | Estado |
|------|--------|
| Vercel CLI | autenticado (`compramelafoto` / team `compramelafotos-projects`) |
| Neon CLI | autenticado (org `Dnx` / `org-bold-morning-27184918`) |
| `gh` | **no autenticado** → `gh auth login` requerido para PR |
| Auth0 | **N/A** — identidad = DNX + Google OAuth |

---

## Vercel Production

| Campo | Valor |
|-------|-------|
| Proyecto | `clickaton-dnxsuite` |
| Project ID | `prj_wo7NXldJbGlkklHnxPjRtdd9xDn0` |
| Team | `compramelafotos-projects` |
| Dominio | `maratonfotografica.com` (+ `www`) |
| Root directory | `apps/clickaton` |
| Framework | Next.js |
| Node | 24.x |
| Production deploy (pre-10B.2) | `dpl_9NfxexC75mUSQE7JRJoYn3m8JnDY` (~6d, READY) |
| Preview reciente | ERROR en rama (no bloquear identidad DB) |

### Staging (referencia, no redeployear en 10B.2 salvo emergencia)

| Campo | Valor |
|-------|-------|
| Proyecto | `clickaton-staging` |
| Alias | `https://clickaton-staging.vercel.app` |
| Deploy OK 10B.1 | `dpl_Hd8qr2HPwdECd8yDvVMmKgUaPKc1` |
| `/maratones` | 200 |
| Health DB | `ok:true`, host `ep-divine-smoke…`, 6 published |

---

## Neon (organización)

| Proyecto | ID | Uso |
|----------|-----|-----|
| `clickaton-production` | `bitter-math-56019731` | **Production Clickatón (nuevo 10B.2)** |
| `clickaton-staging` | `plain-sky-50672248` | Staging |
| `infospot-production` | `wandering-pine-79918137` | **no usar** |
| `compramelafoto` / staging / `dnx-suite-staging` | varios | **no usar** |

Permisos: creación de proyecto/branch OK (se creó `clickaton-production`).

---

## Matriz Neon objetivo 10B.2

| Entorno | Proyecto Neon | Branch | DB | Host parcial | Estado |
|---------|---------------|--------|-----|--------------|--------|
| Staging | `clickaton-staging` (`plain-sky-50672248`) | `clickaton-staging` | `clickaton_staging` | `ep-divine-smoke-av8hmt7s*` | OK (10B.1) |
| Production | `clickaton-production` (`bitter-math-56019731`) | `production` (`br-billowing-paper-aw1nrj9t`) | `clickaton_production` | `ep-silent-haze-awfh50a5*` | Creada + migrada (vacía de negocio) |
| Backup prod | mismo proyecto | `backup-10b2-pre-migrate` (`br-misty-mode-aw7bpi6h`) | (branch snapshot) | — | Verificable |

---

## Variables Production (preflight)

Hallazgo crítico al abrir 10B.2: varias keys existían en Vercel Production como **Encrypted con valor vacío** (placeholders). Se regeneraron/recargaron valores reales (URLs apex, secrets, DB Neon Production, Resend desde key local de org, Google desde `.env.local` Clickatón).

| Grupo | Estado preflight |
|-------|------------------|
| `DATABASE_URL` / `DIRECT_URL` → Neon Production | PRESENT (host `ep-silent-haze…` / DB `clickaton_production`) |
| Google OAuth | PRESENT |
| URLs públicas apex | PRESENT (tras corrección) |
| Crons / webhook / vault / AUTH_SECRET | PRESENT (tras regeneración) |
| `DNX_SOCIAL_PUBLISHER_LIVE=false` | PRESENT |
| Owner onboarding flag `true` / manual OAuth `false` | PRESENT |
| `RESEND_API_KEY` | PRESENT (cargada; no en repo) |
| `CLICKATON_MP_CLIENT_ID` / `SECRET` | **MISSING** (bloquea botón OAuth LIVE) |
| Phrase autorización manual Daniel | **MISSING** / manual=`false` (correcto hasta ventana) |
| R2 storage | **MISSING** (welcome cards / media; no bloquea check-env 10A) |

Nota CLI: `vercel env pull` / `env run` en modo agente **redacta** sensibles a `""` — la verificación de host DB se hace vía Neon + deploy runtime (`/api/public/health/db`).

---

## Auth / MP / Email

| Ítem | Estado |
|------|--------|
| Auth0 | N/A |
| Google callback prod | `https://maratonfotografica.com/api/auth/google/callback` |
| Tammy email esperado | `tammyytamer@gmail.com` (sin password) |
| MP redirect prod | `https://maratonfotografica.com/api/clickaton/payments/mercadopago/callback` |
| App MP LIVE credentials | **ausentes** en Vercel |
| Resend | key cargada en Production env |

---

## Restricciones de etapa (recordatorio)

**Autorizado:** Neon prod, backup, migrate deploy, vars, Auth Google, preparar MP OAuth, preview, redeploy, smoke sin cobros, PR si `gh` ok.  
**No autorizado:** abrir inscripciones, pagos reales, OAuth en nombre de Tammy, social LIVE, borrar DBs, `prisma db push`, redeploy sin healthcheck de infra.

---

## Riesgo detectado en preflight

Durante la sesión se detectó contaminación de shell (`DATABASE_URL` exportada) que hacía parecer que Staging apuntaba a Production. Se forzó restauración de Staging a `ep-divine-smoke…/clickaton_staging`. El deploy Staging vivo 10B.1 seguía sano (`health` con divine-smoke).
