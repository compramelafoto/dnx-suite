# 63 — OAuth humano + readiness contenido Día 1 (Etapa 22V)

**Fecha:** 2026-07-15  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD local/remoto (al auditar):** `842f0c0`  
**Production health:** `db:ok` · `version=ef63026` (posterior a `db5987d`)  
**Deploy Production observado:** `dpl_H2rbr7k…` (Ready)  
**Dominio anuncio público:** **NO-GO**  
**Actualización 22X:** OAuth humano sigue **PENDING_HUMAN**; CLF PUBLIC futuros = **0**; creada nota DRAFT `presentacion-info-spot`; decisión **`BLOCKED_BY_CONTENT_SOURCE`**. Ver [65](./65-human-oauth-and-real-launch-content-gate.md).

**Actualización 22W:** DNS/SSL OK · migrate focal **aplicada** · OAuth humano sigue PENDING · contenido `BLOCKED_BY_CONTENT_SOURCE` — ver [64](./64-domain-oauth-and-minimum-launch-content.md).  
**Estado etapa (cierre 22V):**

```text
COMPLETE_PENDING_REAL_CONTENT
```

No incluye emails, cookies, tokens, secretos ni URLs de DB.

Relacionado: [62](./62-editorial-roles-and-day-one-content-gate.md) · [51](./51-go-live-master-checklist.md) · [64](./64-domain-oauth-and-minimum-launch-content.md) · [65](./65-human-oauth-and-real-launch-content-gate.md)

---

## 1. Auditoría mínima

| Ítem | Estado |
|------|--------|
| Rama | `migration-legacy-clf-to-monorepo` |
| Working tree Info Spot | Limpio (docs 22V) |
| Cambio ajeno preservado | `apps/compramelafoto/.gitignore` (+ docs clickaton ajenos — **no mezclar**) |
| Health alias / dominio apex | `db:ok` |
| Schema Production | **up to date** (focal aplicada en 22W — [64](./64-domain-oauth-and-minimum-launch-content.md)); en 22V estaba pendiente `20260714120000_infospot_editorial_cover_focal` |
| Noticias DRAFT / PUBLISHED | **4** / **0** |
| Eventos futuros Info Spot | **0** |
| Eventos DRAFT históricos | 41 |
| Coberturas (count) | 121 |
| Placements | 0 |

---

## 2. OAuth humano

### Hallazgo crítico (host mismatch)

| Inicio OAuth | `redirect_uri` host | Cookie host | Resultado esperado |
|--------------|---------------------|-------------|--------------------|
| Alias `*.vercel.app` | `infospot.com.ar` | alias | **`COOKIE_OR_HOST_ERROR`** (cookie CSRF no viaja al callback) |
| `https://infospot.com.ar` | `infospot.com.ar` | dominio | Hosts alineados — vía correcta para smoke humano |

Env Production (nombres): `GOOGLE_REDIRECT_URI`, `APP_URL`, `AUTH_URL`, `NEXT_PUBLIC_INFOSPOT_URL` apuntan al **dominio**. DNS apex **resuelve** y `/api/health` responde **200**.

**No** se modificó Google Cloud. **No** se eliminaron URIs de FotoRank. **No** se recreó el cliente OAuth.

### Registro smoke humano

| Paso | Resultado |
|------|-----------|
| Inicio OAuth | **307** → Google (alias y dominio) |
| Pantalla Google | **PENDING_HUMAN** (requiere cuenta editorial en navegador) |
| Callback | No cerrado por el agente |
| Sesión creada | Pendiente de flujo humano |
| Rol leído | Pendiente |
| Redirect final | Pendiente |
| Acceso a Redacción | Pendiente |

**Instrucción al operador:** completar Google desde **`https://infospot.com.ar/ingresar`** (mismo host que `redirect_uri`). **No** usar el alias para el consentimiento.

### Clasificación si se insiste en alias

```text
COOKIE_OR_HOST_ERROR
```

(Si Google rechazara el URI de dominio, sería `GOOGLE_REDIRECT_URI_MISMATCH` — no observado en start; falta evidencia de error Google en browser.)

Código de etapa OAuth: **`MANUAL_BROWSER_INTERRUPTED`** (+ diagnóstico de host).

---

## 3. Eventos futuros CLF (readonly)

Fuente: Neon CLF prod (`compramelafoto` / `falling-darkness…` · branch `production`). Solo lectura.

Filtro: `PUBLIC` · no archivados · `startsAt >= now` · `shareSlug` no nulo · take 10.

| Estado | Cantidad |
|--------|---------:|
| Elegibles futuros | **0** |
| Con geo | 0 |
| Con portada | 0 |
| Con descripción | 0 |
| Con convocatoria abierta | 0 |
| Incompletos | 0 |
| Duplicados | 0 |
| Rechazados | 0 |

Contexto adicional (no importable como agenda pública):

| Métrica CLF | Cantidad |
|-------------|---------:|
| Futuros cualquier visibility (no archivados) | **1** |
| Futuros PUBLIC | **0** |
| Futuros PUBLIC + slug | **0** |
| Pasados PUBLIC + slug | 41 |

**Sync inbound:** no ejecutado en modo escritura (sin candidatos públicos futuros). Dry-run de importación **bloqueado** por inventario vacío.

Códigos:

```text
NO_OPEN_PHOTOGRAPHER_CALL_AVAILABLE
```

(sin evento público futuro)

---

## 4. Sync / idempotencia

| Paso | Resultado |
|------|-----------|
| Selección 3–6 | **0** candidatos |
| Sync limitado | **No ejecutado** (sin fuentes seguras) |
| Idempotencia | N/A |

No se importaron eventos finalizados.

---

## 5. Noticias / cobertura / convocatoria

### Noticias DRAFT existentes (Production)

4 DRAFT ya presentes (sin crear piezas nuevas inventadas):

| Pieza (metadatos) | Tag | Categoría | Fuente | SEO | Portada | Observación |
|-------------------|-----|-----------|--------|-----|---------|-------------|
| A | NEEDS_REVIEW | sí | no | no | no | Excerpt con fecha futura (ago) — falta fuente/SEO/portada |
| B | REAL | no | no | no | no | Excerpt jul — incompleta |
| C | REAL | no | no | no | no | Excerpt jul — incompleta |
| D | REAL | no | no | no | no | Relato de edición ya ocurrida — no agenda futura |

Clasificación editorial: **`NEEDS_SOURCE_CONFIRMATION`** / incompletas. **No** enviadas a revisión. **No** publicadas.

Presentación Info Spot / agenda / previas nuevas: **no creadas** (faltan eventos públicos futuros verificables para anclar agenda).

### Cobertura

```text
NO_AUTHORIZED_COVERAGE_AVAILABLE
```

Sin selección de álbum con licencia editorial confirmada en esta etapa. Inventario de coberturas existente no promovido a Día 1.

### Convocatoria

```text
NO_OPEN_PHOTOGRAPHER_CALL_AVAILABLE
```

---

## 6. Inventario Día 1

| Tipo | Objetivo | Disponible | Listo para revisión |
|------|---------:|-----------:|--------------------:|
| Eventos futuros | 3–6 | **0** | 0 |
| Noticias | 3–5 | **4** DRAFT (incompletas) | **0** |
| Cobertura | 1 | 0 autorizada nueva | 0 |
| Convocatoria | 1 | 0 | 0 |

**¿Alcanza para lanzamiento?** **No.**

---

## 7. Plan Home Día 1 (sin placements)

| Bloque | Candidato | Datos faltantes | Acción Día D |
|--------|-----------|-----------------|--------------|
| HERO | Presentación (aún no DRAFT cerrada) | fuente/SEO/portada | Publicar + placement |
| Próximos | — | eventos PUBLIC futuros CLF | Sync → DRAFT → publicar |
| Destacados | DRAFT B/C si se completan | categoría/fuente/SEO/portada | Publicar |
| Últimas | idem | idem | Publicar |
| Cobertura | — | álbum licenciado | Publicar |
| Fotógrafos | — | convocatoria abierta | Activar CTA |

Home actual estable con **0** PUBLISHED.

---

## 8. Cleanup

Sin fixtures técnicos nuevos creados en 22V. Conservado inventario real. **0** DEMO/smoke publicados. Placements técnicos: 0.

---

## 9. Validaciones afectadas

| Check | Resultado |
|-------|-----------|
| `test:google-oauth-start` | OK |
| `test:clf-event-sync` | OK |
| migrate status Production | 1 pendiente (no deploy) |
| Health | `db:ok` |
| Smoke OAuth humano | **PENDING_HUMAN** |
| Lint/typecheck/build | No requeridos (sin cambio de código app) |

---

## 10. Readiness

| Pregunta | Respuesta |
|----------|-----------|
| ¿`READY_FOR_DOMAIN_GO_LIVE`? | **NO** |
| ¿Estado documentado? | **`COMPLETE_PENDING_REAL_CONTENT`** |
| ¿OAuth humano cerrado? | **No** — usar host dominio |
| ¿Contenido futuro publicable? | **No** — 0 eventos PUBLIC futuros CLF |
| ¿Anunciar dominio? | **NO-GO** |
| ¿Cambiar Google Cloud ahora? | **No** (salvo URI faltante evidenciada en browser) |

### Próximos pasos

1. Operador: login Google desde `https://infospot.com.ar/ingresar` → confirmar `/redaccion`.  
2. Cuando exista ≥1 evento CLF **PUBLIC** futuro con `shareSlug`: dry-run → sync limitado 3–6 DRAFT.  
3. Completar fuentes/SEO/portada de noticias REAL existentes.  
4. Re-evaluar `READY_FOR_DOMAIN_GO_LIVE` solo con inventario mínimo.
