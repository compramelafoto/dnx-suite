# 51 — Go Live master checklist (Info Spot)

**Fecha:** 2026-07-13  
**Etapa:** 22I  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Documento maestro** para lanzar `infospot.com.ar` apenas el DNS quede operativo.  
**No incluye secretos.**

| Decisión actual | Valor |
|-----------------|--------|
| Alias Vercel operativo | **GO técnico** · `https://infospot-dnxsuite.vercel.app` |
| Dominio propio `infospot.com.ar` | **NO-GO** hasta checklist día D |
| Launch Readiness (pre-DNS) | **~96%** (22J) |
| Multimedia R2 | **COMPLETE** · `VERIFIED_WORKING` ([doc 50](./50-multimedia-production-gate.md)) |
| Production commit | **`fa55a2d`** · deploy `dpl_9Br5hao77qMeTxrGzXBjSmdUWabY` · Ready · health `db:ok` |

Referencias: [`42-production-go-live.md`](./42-production-go-live.md) · [`43-launch-readiness.md`](./43-launch-readiness.md) · [`44-editorial-operations-manual.md`](./44-editorial-operations-manual.md) · [`45-production-services-readiness.md`](./45-production-services-readiness.md) · [`50-multimedia-production-gate.md`](./50-multimedia-production-gate.md)

---

## 0. Responsables (roles)

| Rol | Responsabilidad |
|-----|-----------------|
| **Ops / Infra** | DNS DonWeb, Vercel domains/SSL, env canónicos, redeploy, health, rollback |
| **Dev** | Confirmar build/migraciones, OAuth URI, smoke técnico post-cutover |
| **Director editorial** | Primer login, seed rol Director, publicación día 1, coberturas |
| **Producto** | Criterio GO/NO-GO, anuncio público, Search Console, monitoreo negocio |

Si una sola persona cubre varios roles, ejecutar en el **orden** de este documento (no saltear cutover de URL antes de DNS).

---

## 1. Estado completo del sistema (auditoría 22I)

### 1.1 Git

| Ítem | Estado |
|------|--------|
| Rama | `migration-legacy-clf-to-monorepo` |
| HEAD local = remoto | `fc3d43d` (docs 22H) |
| Production Info Spot | Sigue **`fa55a2d`** (no se promovió docs-only) |
| Working tree Info Spot | Limpio |
| Cambio ajeno | `apps/compramelafoto/.gitignore` modificado — **ignorar / no mezclar** |

### 1.2 Production (Vercel)

| Ítem | Estado |
|------|--------|
| Proyecto | `infospot-dnxsuite` |
| Alias | `https://infospot-dnxsuite.vercel.app` |
| Deploy Production | `dpl_9Br5hao77qMeTxrGzXBjSmdUWabY` · **Ready** |
| Commit servido | **`fa55a2d`** |
| Health | `status=ok`, `db=ok`, `userSession=ok`, `version=fa55a2d` |
| Dominios Vercel | `infospot.com.ar`, `www.infospot.com.ar`, alias — **verified** |
| DNS público | **Vacío** (A/NS sin respuesta) — bloqueante dominio |
| Preview reciente | `fc3d43d` (docs) — **no** es Production |

### 1.3 Infraestructura

| Pieza | Estado | Notas |
|-------|--------|-------|
| Neon `infospot-production` | OK | `wandering-pine…` / `ep-bitter-salad…` |
| Migraciones Prisma | Parcial | Schema válido; **3 pendientes** (ver §9) — **no aplicar en 22I** |
| R2 `infospot-media` | OK | Ciclo multimedia cerrado (22G/22H) |
| CLF readonly | OK | Proxy anti-write; sync inbound deja `DRAFT` |
| Cron | OK | `*/15` clf-events-sync · `*/30` reconcile · **401** sin secret |
| OAuth Google | Presente | Redirect aún apunta a host canónico actual (alias); **actualizar día D** |
| Resend / SMTP | Ausente | Opcional — degradación segura |
| GA4 Measurement ID | Ausente | Opcional |
| `COOKIE_DOMAIN` | Vacío | Correcto hasta dominio; setear `.infospot.com.ar` solo si hace falta SSO |

**Env Production presentes (nombres):**  
`DATABASE_URL`, `DIRECT_URL`, `CRON_SECRET`, `INFOSPOT_IP_HASH_SALT`, `R2_*` (account/bucket/endpoint/public/access/secret), `CLF_READONLY_DATABASE_URL`, `COMPRAMELAFOTO_PUBLIC_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `APP_URL`, `AUTH_URL`, `NEXT_PUBLIC_INFOSPOT_URL`.

### 1.4 Contenido editorial (Neon prod, 22I)

| Recurso | Cantidad / estado |
|---------|-------------------|
| Users / roles Info Spot | **0** / ninguno |
| Categorías | **4** canónicas |
| Artículos | **0** (ningún `PUBLISHED`) |
| Eventos | **40** `DRAFT` (sync CLF) · **0** `PUBLISHED` |
| Coberturas | **0** |
| Fotos editoriales | **0** |
| Settings `publicUrl` | **Vacío** (siteName = Info Spot) |
| Home pública | **200** — hero plataforma + pitch; sin feed publicado |

Rutas públicas auditadas (alias): `/` `/noticias` `/eventos` `/publicar-evento` `/politica-editorial` `/privacidad` `/terminos` `/ingresar` → **200**; `/redaccion` → **307** (auth).

### 1.5 Multimedia

| Ítem | Estado |
|------|--------|
| Gate | COMPLETE ([50](./50-multimedia-production-gate.md)) |
| Upload / read / derivados / delete | PASS en Production |
| Residuos smoke | Ausentes (404) |
| Worker | No obligatorio pre-lanzamiento alias (`APTO_CON_LIMITACIONES`) |

### 1.6 Seguridad

| Control | Estado |
|---------|--------|
| `/redaccion` | Layout server + membresía Info Spot |
| `/api/redaccion/*` | Sesión + permisos |
| `/api/redaccion/r2-cleanup` | Solo Dirección · 401 sin sesión |
| `/api/cron/*` | Bearer `CRON_SECRET` · 401 unauth |
| Roles | Director / Redactor / Colaborador (+ SUPER_ADMIN bypass) |
| Cookies | `dnx_session` httpOnly · secure en prod · SameSite=Lax |
| HSTS | Presente (`max-age=63072000; includeSubDomains; preload`) |
| CSP / X-Frame-Options app | **No configurados** en `vercel.json` / next.config (mitigación Vercel default parcial) |
| Middleware global | **Ausente** — guards por layout/route |
| Robots | Disallow `/redaccion` `/admin` `/api/` `/invitar` `/recuperar` `/design-system` |

### 1.7 SEO

| Ítem | Estado |
|------|--------|
| `robots.txt` | 200 · Host/Sitemap = **alias vercel.app** |
| `sitemap.xml` | 200 · URLs alias + estáticas (sin artículos/eventos publicados) |
| Metadata / OG | `getSiteUrl()` → env / settings |
| Search Console | **No** configurado (día D) |
| Indexación alias | No anunciar; tratar como staging técnico |

### 1.8 Rendimiento

| Ítem | Estado |
|------|--------|
| Build local 22I | **OK** |
| Lint / typecheck | **OK** |
| Cache home | `unstable_cache` + tags; rutas `force-dynamic` limitan ISR |
| Imágenes editoriales | `<img>` lazy/eager intencional; `next/image` en brand |
| Revalidate | Path/tag en acciones editoriales + distribución |

### 1.9 Validaciones 22I (sin deploy)

| Check | Resultado |
|-------|-----------|
| lint | OK |
| typecheck | OK |
| build | OK |
| `prisma validate` | OK |
| `migrate status` (Neon prod) | **3 migraciones pendientes** (ver §9) |
| Health Production | OK · `fa55a2d` |
| Smoke multimedia | **No repetido** (aprobado 22H) |

---

## 2. Criterios GO / NO-GO

### GO dominio propio — todos obligatorios

1. DNS `infospot.com.ar` + `www` resuelven a Vercel.  
2. SSL Ready en ambos hosts.  
3. Canónicos actualizados: `NEXT_PUBLIC_INFOSPOT_URL`, `APP_URL`, `AUTH_URL` → `https://infospot.com.ar`.  
4. `InfoSpotSettings.publicUrl` = `https://infospot.com.ar` (o vacío si env manda).  
5. `GOOGLE_REDIRECT_URI` + consola OAuth con callback del dominio.  
6. Redeploy Production **después** de env (si se cambiaron).  
7. Health en dominio propio `db:ok`.  
8. Director sembrado (primer User + rol).  
9. Al menos 1 pieza de contenido `PUBLISHED` (o decisión explícita de lanzar vacío con home plataforma).  
10. `robots.txt` / `sitemap.xml` muestran Host/URLs del dominio propio.  
11. Smoke login + redacción en host final (cookie no cruzada con alias).  

### NO-GO (bloquear anuncio)

- DNS sin respuesta o SSL pending.  
- OAuth callback incorrecto (login roto).  
- Health `db` ≠ ok.  
- Sin Director y sin plan de bootstrap en T-30.  
- Writes CLF habilitados por error (`ALLOW_CLF_WRITE_FROM_INFOSPOT`).  
- Secretos expuestos / env de staging en Production.

### GO alias (ya cumplido)

Operación interna / QA en `infospot-dnxsuite.vercel.app` con media R2 y crons — **sí**. No es lanzamiento público.

---

## 3. Orden recomendado (cutover)

1. Confirmar DNS público (DonWeb).  
2. Esperar SSL Vercel.  
3. Actualizar env canónicos + OAuth redirect (Ops + Dev).  
4. Redeploy Production.  
5. Verificar health + robots + sitemap en dominio.  
6. Primer login → seed Director.  
7. Publicar contenido día 1 (o confirmar vacío intencional).  
8. Search Console + enviar sitemap.  
9. Anuncio / GO.  
10. Monitoreo Post GO.

---

## 4. Checklist cronológico — día D

Tiempos estimados son orientativos. Marcar ☐ → ☑.

### T-24 horas — Ops + Director + Producto (~60–90 min)

- [ ] Confirmar ventana de cutover y canal de incidentes.  
- [ ] Snapshot / restore point Neon prod (Ops).  
- [ ] Revisar health alias: `curl -sS https://infospot-dnxsuite.vercel.app/api/health`.  
- [ ] **Director:** si aún no hay rol — login OAuth en alias + `INFOSPOT_DIRECTOR_EMAIL=… pnpm --filter @repo/db db:grant-infospot-director` (ver [52](./52-pre-dns-production-closure.md)).  
- [ ] Inventario contenido día 1 (los 40 DRAFT están **finalizados**; no publicarlos como próximos).  
- [ ] Verificar Domains en Vercel siguen **Verified**.  
- [ ] Confirmar `ALLOW_CLF_WRITE_FROM_INFOSPOT` **ausente** en Production.  
- [ ] Preparar textos de anuncio / redes (Producto).

### T-12 horas — Ops + Dev (~30–45 min)

- [ ] Re-chequear DNS DonWeb (puede seguir vacío; no forzar GO).  
- [ ] Listar env a cambiar en cutover (sin pegar valores en chat).  
- [ ] Preparar comando/rollback: `vercel promote <dpl_previo>`.  
- [ ] Verificar crons 401 sin secret; schedules en `apps/infospot/vercel.json`.  
- [ ] Dry-run editorial en alias: login test si hay user staging; si no, planear bootstrap en T-30.  
- [ ] Confirmar CORS R2 incluye `infospot.com.ar` / `www` (ya documentado en 22B).

### T-4 horas — Ops (~45–60 min) — **solo si DNS ya responde**

- [ ] `dig infospot.com.ar` / `www` → registros Vercel.  
- [ ] SSL Ready en panel Vercel.  
- [ ] Actualizar Production: `NEXT_PUBLIC_INFOSPOT_URL`, `APP_URL`, `AUTH_URL` → `https://infospot.com.ar`.  
- [ ] Actualizar `GOOGLE_REDIRECT_URI` → `https://infospot.com.ar/api/auth/google/callback`.  
- [ ] Actualizar callback en consola Google OAuth (**sin** crear proyecto nuevo).  
- [ ] Opcional: `COOKIE_DOMAIN=.infospot.com.ar`.  
- [ ] Opcional: `RESEND_API_KEY` + `EMAIL_FROM`.  
- [ ] Opcional: `NEXT_PUBLIC_GA_MEASUREMENT_ID`.  
- [ ] **Redeploy Production** (requerido tras env).  
- [ ] Health en dominio: `curl -sS https://infospot.com.ar/api/health`.

Si DNS **aún no** responde a T-4: **detener cutover**; seguir en alias; no anunciar.

### T-1 hora — Dev + Director (~30 min)

- [ ] `robots.txt` Host = `https://infospot.com.ar`.  
- [ ] `sitemap.xml` URLs dominio propio.  
- [ ] Home / noticias / eventos **200** en dominio.  
- [ ] Login Google en dominio (cookie host correcto).  
- [ ] Seed Director: `INFOSPOT_DIRECTOR_EMAIL=… pnpm --filter @repo/db db:seed:infospot` (con URL prod, nunca imprimir).  
- [ ] Acceso `/redaccion` OK.  
- [ ] Settings: `publicUrl` alineado si se usa DB.  
- [ ] Revisar cola `DRAFT` de eventos sync (40 al 22I) — publicar solo curados.

### T-30 minutos — Director (~20–40 min)

- [ ] Publicar contenido mínimo día 1 (noticia y/o evento) **o** confirmar lanzamiento con home plataforma vacía.  
- [ ] Verificar créditos / licencias fotos si hay material CLF.  
- [ ] Ocultar/archivar DEMO si existiera (`/admin/lanzamiento`).  
- [ ] Probar convocatoria / CTA solo si hay evento publicado con call activo.  
- [ ] Confirmar que no hay secretos en UI.

### T-10 minutos — Producto + Ops (~10 min)

- [ ] Health `db:ok` en dominio.  
- [ ] Cron unauth sigue 401.  
- [ ] Criterios GO §2 todos ☑.  
- [ ] Canal de rollback listo (deployment id previo: `dpl_9Br5hao…` u otro sano).  
- [ ] Señal de GO verbal/escrita entre responsables.

### GO — Producto (~5 min)

- [ ] Anunciar URL canónica `https://infospot.com.ar`.  
- [ ] **No** promover el alias vercel.app como sitio público.  
- [ ] Abrir Search Console → propiedad dominio → enviar sitemap.  
- [ ] Registrar hora exacta de GO.

### Post GO +15 min — Ops + Director

- [ ] Health + home + una noticia/evento publicados.  
- [ ] Login / logout.  
- [ ] Una acción redacción (guardar borrador).  
- [ ] Logs Vercel: sin ráfaga 500.  
- [ ] Si falla OAuth → NO-GO parcial: rollback URI o promote deploy previo.

### Post GO +1 h — Ops + Producto

- [ ] Revisar crons ejecutados (200 con secret).  
- [ ] Sync CLF sin errores masivos.  
- [ ] Coberturas / métricas internas si aplica.  
- [ ] Confirmar indexación inicial / sin bloqueo robots.  
- [ ] Decidir si se necesita contenido adicional.

### Post GO +24 h — Producto + Director + Ops

- [ ] Tráfico / errores 24h.  
- [ ] Search Console: cobertura sitemap.  
- [ ] Revisar eventos `DRAFT` residuales.  
- [ ] Backup Neon / higiene.  
- [ ] Actualizar este doc con lecciones (fecha + % readiness final).  
- [ ] Declarar Launch Readiness dominio **100%** solo si §2 sigue cumplido.

---

## 5. Rollback rápido

| Escenario | Acción |
|-----------|--------|
| Deploy roto | `vercel promote <deployment_id_sano>` · health |
| Env canónico mal | Restaurar env alias temporalmente · redeploy · comunicar |
| OAuth roto | Corregir `GOOGLE_REDIRECT_URI` + consola · redeploy |
| DB dañada | Restore Neon snapshot (DBA) · **no** `migrate reset` |
| R2 caído | Pausar uploads; media pública existente puede seguir |
| CLF sync malo | Crons siguen auth; sync manual dry-run; no habilitar write IS→CLF |

Detalle ampliado: [`42-production-go-live.md`](./42-production-go-live.md) §13.

---

## 6. Monitoreo posterior

| Señal | Dónde | Umbral de alerta |
|-------|--------|------------------|
| Health | `/api/health` | `db` ≠ ok o 5xx |
| Errores runtime | Vercel logs | 500 sostenidos |
| Cron | Vercel cron logs | fallos repetidos ≠ 401 unauth |
| Login | Manual / soporte | imposibilidad OAuth |
| Media | R2 público | 403/ERR_NAME masivo |
| SEO | Search Console | exclusiones masivas post-cutover |

---

## 7. Incidentes esperables y acciones rápidas

| Incidente | Acción rápida |
|-----------|----------------|
| DNS propaga lento | Esperar; no anunciar; alias solo interno |
| SSL pending | Esperar Vercel; no forzar HTTP |
| Cookie no persiste | Verificar host único + `COOKIE_DOMAIN`; no mezclar alias y dominio en la misma sesión |
| `/redaccion` 307 loop | Confirmar sesión + rol Director/Redactor |
| Home vacía | Esperado sin `PUBLISHED`; publicar o aceptar vacío |
| Eventos DRAFT visibles en redacción pero no en público | Correcto; curar antes de PUBLISH |
| Upload R2 falla | Verificar env R2; no rotar keys en caliente sin plan |
| Join fotógrafo CLF falla | Revisar `COMPRAMELAFOTO_PUBLIC_URL` + estado evento en CLF |
| Sitemap aún con vercel.app | Env/settings no actualizados → corregir + redeploy |

---

## 8. Operación editorial (recordatorio día D)

Máquina de estados: `DRAFT → IN_REVIEW → PUBLISHED → UNPUBLISHED → ARCHIVED`  
([`44-editorial-operations-manual.md`](./44-editorial-operations-manual.md)).

| Acción | Quién |
|--------|-------|
| Publicar directo | Director (o Redactor con `DIRECT_PUBLISH`) |
| Aprobar cola | Director (`/admin/aprobaciones`) |
| Coberturas sync | Cron + acción manual cobertura |
| Licencia foto CLF | Política prod — Director |
| Cleanup R2 | Solo Director · keys IS |

---

## 9. Riesgos pendientes (no bloquean alias; sí condicionan dominio / higiene)

1. **DNS DonWeb** — bloqueante absoluto del GO público.  
2. **Director = 0 users** — bootstrap obligatorio en T-1 / T-30; CTA Google reparado en 22O ([55](./55-google-login-production-fix.md)).  
3. **0 contenido PUBLISHED** — lanzamiento vacío posible pero débil; planificar piezas.  
4. **3 migraciones Prisma** — **aplicadas en 22J** (schema up to date). Ver [`52-pre-dns-production-closure.md`](./52-pre-dns-production-closure.md).  
5. **Sin CSP explícita** — mejora post-lanzamiento recomendada.  
6. **Sin middleware global** — disciplina en nuevas rutas `/api`.  
7. **Resend / GA4** opcionales.  
8. **Search Console / OAuth console** — solo día D.  
9. **Working tree ajeno CLF** — no mezclar.  
10. **Info Spot fuera de Platform Catalog DNX-MCP** — `release_*` no aplica.  
11. **Director + contenido día 1** — login OAuth + `db:grant-infospot-director` ([54](./54-first-director-production-validation.md)); 0 eventos futuros entre los 40 DRAFT.

---

## 10. Recomendación 22I / actualización 22K

| Pregunta | Respuesta |
|----------|-----------|
| ¿Listo para operar en alias Vercel? | **SÍ** |
| ¿Listo para anunciar `infospot.com.ar` ahora? | **NO** |
| ¿`READY_FOR_DNS_AND_PUBLICATION`? | **NO** — `BLOCKED_BY_FIRST_DIRECTOR_LOGIN` |
| ¿Falta desarrollo de features para GO? | **NO** (faltan login Director + contenido + DNS) |
| Launch Readiness pre-DNS | **~96%** |
| Próximo paso | Deploy fix Google ([55](./55-google-login-production-fix.md)) → User → grant ([54](./54-first-director-production-validation.md)) → [53](./53-director-and-day1-content.md) |

---

## 11. Confirmaciones de etapa 22I

- No features, no Prisma, no UX, no R2, no CLF, no workflow, no Google Cloud, no Search Console, no Analytics, **no deploy**, **no merge**.  
- Smoke multimedia **no** repetido.  
- Documento maestro creado: este archivo.
