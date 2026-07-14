# 61 — Validación Production de Home adaptativa (22T)

**Fecha:** 2026-07-14  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Estado de etapa:** **`COMPLETE_WITH_PROFILE_FIXTURES_LIMITED`**  
**HEAD remoto:** `0641a25`  
**Commits 22S:** `a0c93a1` (feat) · `5a231a1` (docs)

No incluye secretos ni emails. Google Cloud **no** recreado. `infospot.com.ar` **no** lanzado públicamente (sin cutover DNS/OAuth día D).

---

## 1. Matriz inicial

| Área | Estado |
|------|--------|
| HEAD remoto | `0641a25` |
| Production previa | `1dc8831` · `dpl_HanqYmsg…` / `ev4yocaz7` · health `db:ok` |
| CUSTOMER ACTIVE | 15 (Preview/staging DB usada en QA auth) |
| PHOTOGRAPHER ACTIVE | 8 |
| ORGANIZER ACTIVE | 1 |
| Roles editoriales | DIRECTOR 1 · REDACTOR 4 · COLABORADOR 1 |
| Home previa en Production | Sin resolver 22S (commit anterior a `a0c93a1`) |

Combos ACTIVE observados (sin PII): `CUSTOMER`×6 · `CUSTOMER+PHOTOGRAPHER`×8 · `CUSTOMER+ORGANIZER`×1. Sin triple perfil.

---

## 2. Diff 22S auditado

| Control | Resultado |
|---------|-----------|
| Fuente de perfiles | `listActivePublicProfiles` → `DnxUserProfile` ACTIVE (no `User.role`) |
| Resolver | `resolveHomeExperience()` |
| Cookie | `infospot_home_experience` HttpOnly · solo modos ACTIVE · no muta DB |
| Valor manipulado | Ignorado (CUSTOMER-only + cookie ORGANIZER → sigue CUSTOMER) |
| CTAs públicos | Sin `/redaccion` / `/admin` |
| Panel editorial | `InfoSpotUserRole` / admin vía `resolveSiteHeaderChrome` |
| Open redirect | No observado en switcher (form action server-side) |

---

## 3. Cache / personalización

| Check | Resultado |
|-------|-----------|
| `export const dynamic = "force-dynamic"` en `/` | Sí |
| `Cache-Control` Home | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `unstable_cache` | Solo `getCachedHomepageCore` (contenido público compartido) |
| Experiencia / CTAs por usuario | Resueltos por request (auth + cookie) |
| Fuga entre usuarios | **No** (HTML distinto por modo; cache privada) |

---

## 4. Tests / build pre-deploy

| Check | Resultado |
|-------|-----------|
| `test:home-experience` | OK |
| `test:post-login-destination` | OK |
| `test:distribution` | OK |
| `test:google-oauth-start` | OK |
| `check-types` | OK |
| `build` Info Spot | OK (`/` dinámica) |
| Prisma validate (staging local) | OK · schema up to date |
| Migraciones aplicadas en esta etapa | **Ninguna** |

---

## 5. Preview

| Ítem | Valor |
|------|-------|
| Deployment | `dpl_5Nexmgp3Si79EfqewYbtjLmfGTyV` |
| URL | `infospot-dnxsuite-n1wov2ier-…vercel.app` |
| Commit | `0641a25` |
| Estado | Ready |
| Health | `db:ok` · version `0641a25` |

### QA anónimo (Preview)

- Home 200 · hero plataforma · publicar evento · sin «Ver como» · sin `/redaccion` · sin leak de cookie name · rutas públicas 200 · `/redaccion` 307.

### QA autenticado (Preview / DB compartida con env local)

| Caso | Resultado |
|------|-----------|
| CUSTOMER sin editorial | Sin Panel · `/redaccion` 307 forbidden |
| PHOTOGRAPHER público | «Ver como» si multi · sin Panel · `/redaccion` 307 |
| ORGANIZER público | CTAs publicar · sin Panel · `/redaccion` 307 |
| Multi CUSTOMER+PHOTOGRAPHER | Default PHOTOGRAPHER · cookie CUSTOMER cambia HTML |
| Multi CUSTOMER+ORGANIZER | Default ORGANIZER · selector Descubrir/Organizador |
| Cookie forjada sin perfil | Ignorada |
| DIRECTOR | Panel + `/redaccion` 200 · Home pública intacta |
| Cleanup sesiones smoke | Eliminadas |

Limitación fixtures: no hay PHOTOGRAPHER u ORGANIZER ACTIVE sin CUSTOMER; PHOTOGRAPHER+ORGANIZER sin CUSTOMER no existe.

---

## 6. Production

| Ítem | Valor |
|------|-------|
| Deploy | `dpl_GUdFRJyVZJ8hXBfwR1iQ6pJcDudA` (promote desde Preview) |
| URL deploy | `infospot-dnxsuite-5gx691nmj-…vercel.app` |
| Alias | `https://infospot-dnxsuite.vercel.app` |
| Commit servido | **`0641a25`** |
| Health | `status=ok` · `db=ok` · `version=0641a25` |
| Dominio propio | **No** asociado/lanzado en esta etapa |

### Smoke Production

| Check | Resultado |
|-------|-----------|
| Anónimo Home | 200 · guest · sin «Ver como» · sin `/redaccion` · cache privada |
| `/redaccion` anónimo | 307 |
| Auth Production | **No repetido** — `DATABASE_URL` Production es **sensitive** (CLI no exporta valor). Sesiones mintadas en staging no aplican a Production runtime. |

---

## 7. Responsive / a11y / consola

Validación estructural (código + HTML):

- Switcher: `role="group"` · `aria-pressed` · `min-h-9`
- Sin selector en guest
- Home `force-dynamic` (sin HTML personalizado cacheado en CDN)

QA visual viewport-by-viewport y Lighthouse completo: **no** ejecutados en browser automatizado en esta etapa (sin regresión de layout introducida; sin cambios CSS de esta etapa).

---

## 8. Seguridad confirmada

- Cookie no concede capacidades ni roles.
- No se autoasignaron permisos editoriales.
- No se creó contenido / DEMO.
- No se modificó Prisma / OAuth / CLF / ComprameLaFoto.
- Cambio ajeno `apps/compramelafoto/.gitignore` **no** incluido.

---

## 9. Readiness

| Área | Estado |
|------|--------|
| Alias Vercel + Home 22S | **GO operativo** |
| Auth Home perfiles (Preview) | **OK** |
| Auth Home perfiles (Production) | Pendiente acceso DB sensitive / login OAuth real |
| Dominio `infospot.com.ar` | **NO-GO** (DNS/OAuth/Search Console día D) |
| Google Cloud | No configurado / no recreado |

**Launch Readiness estimado:** ~96% (sin cambio material por dominio).

---

## 10. Siguiente etapa recomendada

1. Smoke autenticado Production vía OAuth Director real (o export autorizado de `DATABASE_URL`).  
2. Checklist día D dominio ([`51`](./51-go-live-master-checklist.md)).  
3. No mezclar con features nuevas de Home.
