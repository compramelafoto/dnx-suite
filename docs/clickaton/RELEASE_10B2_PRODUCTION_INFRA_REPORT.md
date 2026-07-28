# RELEASE 10B.2 — Informe de infraestructura productiva

**Fecha:** 2026-07-28  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD docs/código CTA:** `d897799`  
**Preflight:** `RELEASE_10B2_PREFLIGHT.md`

## Estado final

**PENDING PRODUCTION VARIABLES**

Infraestructura Neon Production + migraciones + URLs/secrets productivos + redeploy de `maratonfotografica.com` quedaron operativos.  
**Falta** `CLICKATON_MP_CLIENT_ID` / `CLICKATON_MP_CLIENT_SECRET` (y autorización manual de Daniel) para habilitar el botón real “Conectar Mercado Pago”.  
**PR** no creado: `gh` sin login.  
**Tammy OAuth** no ejecutado (fuera de etapa / sin app MP).

No se declara `READY FOR TAMMY OAUTH` porque el botón LIVE permanece bloqueado sin credenciales de app MP.

---

### 1. Neon Production

| Campo | Valor |
|-------|-------|
| Proyecto | `clickaton-production` (`bitter-math-56019731`) |
| Branch | `production` (`br-billowing-paper-aw1nrj9t`) |
| DB | `clickaton_production` |
| Owner role | `clickaton_production_owner` |
| Host parcial | `ep-silent-haze-awfh50a5*` (pooler / direct) |
| Evidencia runtime | health prod → `databaseHostHint=ep-silent-haze-awfh50a5-pooler` |

| Entorno | Proyecto Neon | Branch | DB | Host parcial | Estado |
|---------|---------------|--------|-----|--------------|--------|
| Staging | `clickaton-staging` | `clickaton-staging` | `clickaton_staging` | `ep-divine-smoke-av8hmt7s*` | OK |
| Production | `clickaton-production` | `production` | `clickaton_production` | `ep-silent-haze-awfh50a5*` | OK (nueva, vacía de negocio) |

No se reutilizó Staging ni DBs de InfoSpot/FotoRank/CLF.

### 2. Backup

| Ítem | Valor |
|------|-------|
| Branch backup | `backup-10b2-pre-migrate` (`br-misty-mode-aw7bpi6h`) |
| Fecha | 2026-07-28T16:44:02Z |
| Nota | DB Production nueva/vacía al momento del backup pre-migrate; snapshot verificable en Neon |

### 3. Migraciones

| Ítem | Valor |
|------|-------|
| Comando | `prisma migrate deploy` (solo migraciones trackeadas; WIP local P0-09/ranking **no** aplicadas) |
| Resultado | **85** migraciones — schema up to date |
| Conteos negocio | `ClickatonEdition=0`, `User=0`, `ClickatonRegistration=0` |
| Seeds | ninguno no seguro; sin inventar concurso FotoRank; sin abrir inscripciones |

### 4. Proyecto Vercel

| Campo | Valor |
|-------|-------|
| Proyecto | `clickaton-dnxsuite` (`prj_wo7NXldJbGlkklHnxPjRtdd9xDn0`) |
| Dominio | `maratonfotografica.com` (+ www) |
| Root | `apps/clickaton` |
| Build | `cd ../.. && pnpm --filter clickaton build` |
| Install | `cd ../.. && pnpm install` |
| Node | 24.x |

### 5. Commit / deploy

| Ítem | Valor |
|------|-------|
| Commit mínimo exigido | `6a896cb` |
| Commit con CTA + preflight | `d897799` |
| Preview | `dpl_AfD7euqMyXqfb9MwEVdbF7pG8dof` READY (HTTP probes bloqueados por Vercel SSO Protection) |
| Production | `dpl_3Noyia8BkbUyFLPEoTCDKaDPriiy` READY |
| Alias | `https://maratonfotografica.com` |
| Fecha deploy | 2026-07-28 (~17:09–17:12 UTC) |

### 6. Variables productivas

| Variable / grupo | Estado |
|------------------|--------|
| `DATABASE_URL` / `DIRECT_URL` → Neon Production | PRESENT |
| `APP_URL` / `AUTH_URL` / `NEXT_PUBLIC_APP_URL` / `CLICKATON_PUBLIC_*` apex | PRESENT |
| `CLICKATON_PUBLIC_DATA_SOURCE=prisma` | PRESENT |
| `DNX_ENVIRONMENT=production` | PRESENT |
| `DNX_SOCIAL_PUBLISHER_LIVE=false` | PRESENT |
| `CLICKATON_ALLOW_SEARCH_INDEXING=false` | PRESENT |
| Google client id/secret | PRESENT |
| `AUTH_SECRET`, cron secrets, webhook secret, vault key, QR secret | PRESENT (regenerados 10B.2) |
| `EMAIL_FROM` | PRESENT |
| `RESEND_API_KEY` | PRESENT |
| `CLICKATON_MP_REDIRECT_URI` prod callback | PRESENT |
| `DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED=true` | PRESENT |
| `DNX_CLICKATON_MP_OWNER_OAUTH_MANUAL_AUTHORIZED=false` | PRESENT (correcto hasta ventana Daniel) |
| `DNX_CLICKATON_MP_OWNER_OAUTH_AUTHORIZATION_PHRASE` | MISSING (esperado) |
| `CLICKATON_MP_CLIENT_ID` | **MISSING** |
| `CLICKATON_MP_CLIENT_SECRET` | **MISSING** |
| R2 / storage | MISSING (no bloquea check-env 10A) |

Hallazgo: keys previas existían como Encrypted **vacías**; se reescribieron con valores reales.  
CLI agent no puede leer sensibles vía `env pull`/`env run` (redactados a `""`); validación de DB por health runtime.

### 7. check-env

`CLICKATON_RELEASE_ENV=production pnpm --filter clickaton release:check-env` con env productivo inyectado:

- **blocks=0**, warns=0  
- INFO: Social Publisher LIVE off  
- Warning de producto (no block): MP client ausente (requiredFor=[])

### 8. Auth0

**N/A.** Identidad = DNX + Google OAuth.  
Callback esperado: `https://maratonfotografica.com/api/auth/google/callback`.  
Usuario Tammy: `tammyytamer@gmail.com` (sin password). Login humano Tammy **no automatizado** en esta etapa.

### 9–12. Mercado Pago OAuth LIVE / callback / reconnect / revoke

| Ítem | Estado |
|------|--------|
| App MP LIVE credentials | **MISSING** en Vercel |
| Redirect URI documentada | `https://maratonfotografica.com/api/clickaton/payments/mercadopago/callback` |
| Callback route prod | **401** sin sesión (cableado) |
| Connect route | **401** sin sesión |
| Reconnect / revoke | **405** en GET (métodos POST esperados) |
| UI CTA “Conectar Mercado Pago” | Código en `cuenta-owner`; **bloqueado** hasta app MP + autorización manual |
| OAuth ejecutado por Tammy | **NO** |

### 13–15. R2 / Resend / Crons

| Ítem | Estado |
|-------|--------|
| R2 | MISSING |
| Resend | PRESENT |
| `/api/cron/payments-reconciliation` | 401 sin secret |
| `/api/cron/welcome-cards` | 401 |
| `/api/cron/social-publish` | 401 |
| `/api/cron/fotorank-sync` | 401 |
| Social LIVE | `false` |

### 16–17. Preview / Production

| Superficie | Resultado |
|------------|-----------|
| Preview build | READY; SSO Protection impide smoke HTTP anónimo |
| Production `/` | **200** |
| Production `/maratones` | **200** |
| Production health DB | **ok:true**, host Production, `publishedEditions=0` |
| Production `/login` | **200** |
| `/admin` | 307 → login |
| Staging isolation | health sigue `ep-divine-smoke…`, 6 editions |

### 18–21. DB health / maratones / login / Tammy

| Check | Resultado |
|-------|-----------|
| DB health prod | OK → Neon Production |
| `/maratones` | 200 (0 ediciones publicadas — DB nueva vacía) |
| Login página | 200 |
| Tammy panel + botón LIVE | **pendiente** (falta app MP + login humano + manual auth) |

### 22. PR

`gh auth status` → **not logged in**.  
Acción exacta:

```bash
gh auth login
gh pr create --base main --head migration-legacy-clf-to-monorepo \
  --title "feat(clickaton): production infra 10B.2 (inscripciones cerradas, Tammy OAuth pendiente)" \
  --body-file docs/clickaton/RELEASE_10B2_PRODUCTION_INFRA_REPORT.md
```

(Ajustar `--base` si la rama de producción del repo no es `main`.)

### 23. Riesgos

1. **MP CLIENT ausente** → Tammy no puede completar OAuth LIVE.  
2. **DB Production vacía** (0 ediciones) — distinto de Staging (6); falta seed/migración de contenido production-safe si se espera catálogo público.  
3. Deploy CLI local puede incluir WIP del working tree fuera del commit; preferible redeploy desde git limpio si hay duda.  
4. Secrets regenerados en Production (cron/auth/vault/webhook) — rotar cualquier copia antigua.  
5. Staging: se reafirmó `DATABASE_URL` a divine-smoke tras incidente de shell contamination; no redeploy Staging en esta etapa.  
6. Preview env add falló (conflictos/branch); Preview no usable para smoke anónimo por SSO.

### 24. Rollback

- Vercel: `vercel rollback` / redeploy `dpl_9NfxexC75mUSQE7JRJoYn3m8JnDY` (prod previo).  
- Neon: branch `backup-10b2-pre-migrate`; no borrar `production` sin plan.  
- Kill switches: inscripciones off; `DNX_SOCIAL_PUBLISHER_LIVE=false`; OAuth manual `false`; sin MP client.

### 25. Acciones para llegar a READY FOR TAMMY OAUTH

1. Cargar en Production (y registrar en app MP LIVE):  
   - `CLICKATON_MP_CLIENT_ID`  
   - `CLICKATON_MP_CLIENT_SECRET`  
   - Redirect + webhook URLs apex  
2. Cuando Daniel autorice la ventana:  
   - `DNX_CLICKATON_MP_OWNER_OAUTH_AUTHORIZATION_PHRASE=AUTORIZO CONECTAR LA CUENTA OWNER REAL EXCLUSIVA DE CLICKATÓN`  
   - `DNX_CLICKATON_MP_OWNER_OAUTH_MANUAL_AUTHORIZED=true`  
3. Redeploy Production (o esperar que env tome efecto según plataforma).  
4. Tammy inicia sesión con Google (`tammyytamer@gmail.com`) → panel finanzas → **Conectar Mercado Pago** (ella acepta permisos).  
5. `gh auth login` + abrir PR.  
6. (Opcional) seed production-safe de ediciones si el catálogo público debe listar maratones.

---

## Smoke Production (resumen)

| Path | HTTP |
|------|------|
| `/` | 200 |
| `/maratones` | 200 |
| `/api/public/health/db` | 200 `ok:true` silent-haze / 0 editions |
| `/login` | 200 |
| `/admin` | 307 |
| MP connect/callback | 401 |
| Crons (sin secret) | 401 |

Inscripciones: siguen cerradas (no se habilitaron). Sin cobros. Social LIVE off.
