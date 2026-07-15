# 64 — Dominio, OAuth y contenido mínimo de lanzamiento (Etapa 22W)

**Fecha:** 2026-07-15  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD docs (push 22W):** ver commits de esta etapa  
**Production health:** `db:ok` · `version=ef63026` · deploy `dpl_H2rbr7k…`  
**Estado etapa:**

```text
BLOCKED_BY_CONTENT_SOURCE
```

OAuth humano: **PENDING_HUMAN** (debe completarse en el dominio).  
`READY_FOR_DOMAIN_GO_LIVE`: **NO**  
Anuncio público: **NO-GO**

No incluye emails, cookies, tokens, secretos ni URLs de DB.

Relacionados: [51](./51-go-live-master-checklist.md) · [62](./62-editorial-roles-and-day-one-content-gate.md) · [63](./63-oauth-human-and-day-one-content-readiness.md)

---

## 1. Auditoría inicial

| Área | Estado inicial | Acción |
|------|----------------|--------|
| DNS apex `infospot.com.ar` | Resuelve · 2 addrs | Ninguna |
| DNS www | Resuelve · **308** → apex | Mantener |
| SSL | Válido · ~89 días · SAN OK | Ninguna |
| Vercel domain | apex + www + alias **verified** | Ninguna |
| App URL / OAuth callback | Ya `infospot.com.ar` | Sin cambio env |
| Migración focal | Pendiente | **Aplicada** (SAFE_ADDITIVE) |
| Eventos futuros IS | 0 | Esperar fuente |
| Noticias DRAFT | 4 | Auditar / no publicar |
| Coberturas | inventario existente | Sin cobertura Día 1 autorizada |
| Convocatorias | 0 abiertas públicas futuras | Ocultar bloque |

Working tree: cambios ajenos (Clickatón, CLF `.gitignore`, commit local Fotorank no Infospot) — **no mezclados**.

---

## 2. Migración `infospot_editorial_cover_focal`

| Campo | Valor |
|-------|-------|
| Nombre | `20260714120000_infospot_editorial_cover_focal` |
| SQL | `ALTER TABLE "InfoSpotEditorialPhotoUsage" ADD COLUMN "focalX" DOUBLE PRECISION;` + `focalY` |
| CREATE/DROP/DELETE/TRUNCATE | **No** |
| UPDATE backfill | **No** |
| Defaults / índices / constraints | Nullable · sin índice nuevo |
| Código Production | Ya usa `focalX`/`focalY` con fallback `0.5` |
| Clasificación | **`SAFE_ADDITIVE`** |

### Deploy Production

| Paso | Resultado |
|------|-----------|
| Conteo previo | articles 4 · events 41 · photos 7 · usages 8 · assets 7 · placements 0 |
| `prisma migrate deploy` | Applied `20260714120000_infospot_editorial_cover_focal` |
| Status | **Database schema is up to date!** |
| Conteo posterior | Idéntico |
| Columnas | `focalX`, `focalY` presentes |
| validate | OK |

No `db push` / `migrate reset` / `resolve`.

---

## 3. Dominio definitivo

| Check | Resultado |
|-------|-----------|
| `https://infospot.com.ar/` | **200** · mismo health `ef63026` |
| `www` → apex | **308** |
| HSTS | presente |
| `/ingresar` | **200** |
| `/redaccion` anónimo | **307** → login |
| robots / sitemap | **200** |
| Canonical / OG | host `www.infospot.com.ar` / dominio |
| JSON-LD | presente |
| Search Console | **No** configurado (correcto) |

Sitio **no** anunciado.

---

## 4. Variables públicas / OAuth config

| Variable (nombre) | Host efectivo |
|-------------------|---------------|
| `APP_URL` | `infospot.com.ar` |
| `AUTH_URL` | `infospot.com.ar` |
| `NEXT_PUBLIC_INFOSPOT_URL` | `infospot.com.ar` |
| `GOOGLE_REDIRECT_URI` | `https://infospot.com.ar/api/auth/google/callback` |

| Start host | `redirect_uri` | Alineado |
|------------|----------------|----------|
| `infospot.com.ar` | dominio | **Sí** |
| alias Vercel | dominio | Cookie mismatch si se inicia en alias |

Cliente OAuth: **reutilizado** (no recreado). Callbacks FotoRank / alias: **no eliminados**.

---

## 5. OAuth humano

| Paso | Resultado |
|------|-----------|
| OAuth start (dominio) | **307** → Google |
| Host inicial requerido | `infospot.com.ar` |
| Redirect URI | `/api/auth/google/callback` en dominio |
| Google / callback / cookie / sesión / rol / redacción | **PENDING_HUMAN** |

**Instrucción:** abrir exactamente `https://infospot.com.ar/ingresar` → Continuar con Google → cuenta editorial → verificar `/redaccion`.

No se cambió Google Cloud. Si aparece `redirect_uri_mismatch` → `BLOCKED_BY_GOOGLE_REDIRECT_URI` (URI exacta arriba).

---

## 6. Contenido Día 1

### CLF (Ruta A)

| Métrica | Cantidad |
|---------|---------:|
| Futuros PUBLIC + slug | **0** |
| Futuros cualquier visibility | 1 (no importable) |
| Sync escritura | **No** |

### Manual (Ruta B)

Sin fuentes oficiales nuevas suministradas por el usuario en esta etapa → **no** se crearon eventos inventados.

### Noticias DRAFT existentes

| # | Clasificación | Faltantes |
|---|---------------|-----------|
| 1 | `REAL_NEEDS_SOURCE` | fuente, SEO, portada (excerpt ago) |
| 2 | `OBSOLETE` | relato pasado — no agenda |
| 3 | `REAL_NEEDS_SOURCE` | categoría, fuente, SEO, portada (julio) |
| 4 | `REAL_NEEDS_SOURCE` | categoría, fuente, SEO, portada (julio) |

Ninguna `REAL_COMPLETE`. **0** PUBLISHED. No convertidas a DEMO.

### Cobertura / convocatoria

```text
NO_AUTHORIZED_COVERAGE_AVAILABLE
NO_OPEN_PHOTOGRAPHER_CALL_AVAILABLE
```

### Criterio GO contenido

```text
NO_GO_CONTENT_EMPTY
```

(Inventario futuro PUBLIC insuficiente; drafts incompletos.)

### Home Día 1 (plan, sin placements)

| Bloque | Candidato | Estado | Acción al publicar |
|--------|-----------|--------|--------------------|
| HERO | Presentación / nota 1 si se completa | DRAFT incompleto | placement HERO |
| Próximos | — | sin eventos futuros | sync/manual reales |
| Destacados | DRAFT 3–4 si se completan | incompletos | publicar |
| Últimas | idem | incompletos | publicar |
| Cobertura | — | faltante no bloqueante técnico | opcional |
| Fotógrafos | — | vacío digno | ocultar |

---

## 7. Validaciones

| Check | Resultado |
|-------|-----------|
| `test:google-oauth-start` | OK |
| `test:clf-event-sync` | OK |
| migrate status | up to date |
| health alias + dominio | `db:ok` |
| Smoke OAuth humano | PENDING |
| Redeploy env | **No requerido** (ya alineado) |

---

## 8. Cleanup

Sin smoke DRAFT nuevo en 22W. Conteos estables. **0** DEMO/smoke PUBLISHED.

---

## 9. Readiness

| Pregunta | Respuesta |
|----------|-----------|
| DNS/SSL/dominio | **GO técnico** |
| Migración focal | **Aplicada** |
| Host Production canónico | **Dominio** |
| OAuth humano cerrado | **No** |
| Contenido mínimo lanzamiento | **No** |
| `READY_FOR_DOMAIN_GO_LIVE` | **NO** |
| Google Cloud recreado | **No** |
| Roles autoasignados | **No** |
| Contenido inventado | **No** |
| Anuncio público | **No** |

### Launch Readiness

~96% plataforma · **bloqueantes:** OAuth humano + fuentes de eventos futuros reales.

### Próximos pasos

1. Operador: OAuth en `https://infospot.com.ar/ingresar`.  
2. Proveer ≥3 eventos futuros verificables (CLF PUBLIC+slug o fuentes oficiales).  
3. Completar fuente/SEO/portada de drafts REAL (incl. presentación `presentacion-info-spot` de 22X).  
4. Re-evaluar `READY_FOR_DOMAIN_GO_LIVE`.

**Seguimiento 22X:** [65](./65-human-oauth-and-real-launch-content-gate.md) — `BLOCKED_BY_CONTENT_SOURCE` · OAuth **PENDING_HUMAN**.  
**Seguimiento 22Y:** [66](./66-verified-launch-content-and-final-gate.md) — etapa detenida: siguen faltando ≥3 fuentes/eventos verificables.
