# 59 — Migrar perfiles públicos a Production (22R-C)

**Fecha:** 2026-07-14  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Estado de etapa:** **`COMPLETE`**  
**Neon:** `infospot-production` / `ep-bitter-salad…`  
**Alias:** `https://infospot-dnxsuite.vercel.app`  
**App Production:** `1dc8831` · health `db:ok`  
**Código onboarding:** desde `fb3d236` (22R-B); sin redeploy requerido en 22R-C (solo DB)

No incluye emails, URLs de DB ni secretos.  
Base: [`57-public-profile-onboarding-and-editorial-access.md`](./57-public-profile-onboarding-and-editorial-access.md).

---

## 1. Auditoría inicial (pre-migrate)

| Área | Estado inicial |
|------|----------------|
| Users | 3 |
| DnxUserProfile | **no existía** |
| InfoSpotUserPreferences | **no existía** |
| InfoSpotUserRole | 3 (2 Director ACTIVE · 1 Redactor ACTIVE) |
| PhotographerSalesSettings | 0 |
| OrganizerPublicProfile | 0 |
| User.role | 3 × CUSTOMER |
| Migración pendiente | `20260714010000_dnx_public_profiles_and_infospot_preferences` |
| Artículos / eventos / coberturas | 4 / 41 / 120 |
| Invitaciones | 1 |

Git: `migration-legacy-clf-to-monorepo` · HEAD = remoto `1dc8831` · dirty ajeno: `apps/compramelafoto/.gitignore` (no mezclado).

---

## 2. Clasificación SQL

Migración `20260714010000_…`:

- CREATE TYPE ×3 · CREATE TABLE ×2 · índices · UNIQUE · FK `ON DELETE CASCADE`
- **Sin** DROP / DELETE / TRUNCATE
- **Sin** tocar `User.role` / `InfoSpotUserRole` / `DnxAppInvitation`

**Clasificación:** `SAFE_WITH_BACKFILL`

Neon PITR: `history_retention_seconds=86400` (24h).  
`PRE_MIGRATE_TS`: `2026-07-14T07:15:27Z`

---

## 3. Aplicación

| Paso | Resultado |
|------|-----------|
| Host confirmado | `bitter-salad` (no dawn-dew / no CLF) |
| `prisma migrate deploy` | OK · migración aplicada |
| `prisma migrate status` | **Database schema is up to date** |
| `db:backfill-dnx-user-profiles` | `users:3` · customer 3 · photographer 0 · organizer 0 · `onboardingMarked:3` |
| Re-backfill idempotente | mismos conteos · sin duplicados |

---

## 4. Post-validación

| Check | Resultado |
|-------|-----------|
| Users | 3 (sin cambio) |
| DnxUserProfile | 3 × CUSTOMER ACTIVE · source `CLF_EXISTING` |
| InfoSpotUserPreferences | 3 · onboardingCompleted 3 |
| InfoSpotUserRole | 3 sin cambio (2 Director · 1 Redactor) |
| User.role | 3 × CUSTOMER (sin degradación) |
| Usuarios sin CUSTOMER | 0 |
| Duplicados perfil | 0 |
| `test:post-login-destination` | OK |
| Health Production | `db:ok` · `1dc8831` |
| `/completar-perfil` sin sesión | 307 (redirect auth) |
| `/ingresar` · `/ingresar/acceso-pendiente` | 200 |

Usuarios editoriales existentes quedan con onboarding marcado → no se fuerza `/completar-perfil` en su próximo login.

---

## 5. Fuera de alcance (respetado)

- Sin DNS / Search Console / Google Cloud  
- Sin publicar contenido / seeds DEMO  
- Sin `db push` / `migrate reset`  
- Sin cambios R2 / CLF destructivos  
- Sin merge · sin tocar `.gitignore` CLF  

---

## 6. Operación manual restante

Validar en navegador (cuenta real):

1. Login Google → destino según `loadPostLoginDestination`  
2. Usuario editorial → `/redaccion` o `next` seguro (sin acceso-pendiente injustificado)  
3. Usuario público nuevo sin perfiles → `/completar-perfil`  
4. `next=/redaccion` sin rol editorial → acceso-pendiente **sin** bloquear cuenta pública
