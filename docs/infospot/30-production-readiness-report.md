# Info Spot — Informe de preparación para producción (Etapas 12–13)

**Fecha:** 2026-07-12  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Alcance:** QA visual (E12) + gate operativo staging join/jobs/Safari/storage (E13).  
**Restricción:** producción **no** migrada; sin merge a main; sin features nuevas.

---

## 1. Resumen ejecutivo

Las superficies públicas principales de Info Spot (home, ficha de evento, artículo de cobertura, galería) fueron validadas en Chromium headless en 5 viewports (E12). Se corrigieron defectos reales de privacidad de ubicación, fechas inválidas, accesibilidad de galería e hidratación.

**Etapa 13:** se validó la matriz de políticas join/cupos/licencia + sync inbound dry-run + rutas cron seguras + Safari WebKit (home). **No** se ejecutó join/leave HTTP contra producción. Ver detalle en [`31-final-staging-gate.md`](./31-final-staging-gate.md).

**Decisión actual:** **NO-GO** a producción hasta disponer de CLF staging writable (URL no-prod), R2 real y smoke join/leave/iOS completo.

---

## 2. Navegadores y resoluciones

| Entorno | Resolución | Resultado |
|---------|------------|-----------|
| Chromium (Playwright) | 1440×900 | OK — sin overflow; HTTP 200 |
| Chromium | 1280×800 | OK |
| Chromium | 768×1024 | OK |
| Chromium | 390×844 | OK |
| Chromium | 375×667 | OK |
| Safari WebKit (Playwright) | 390×844 | OK home local + `infospot-dnxsuite.vercel.app` (E13); iPhone real pendiente |

Base local: `http://localhost:3004` (Info Spot con env de staging).  
Referencia staging Vercel: `https://infospot-dnxsuite.vercel.app` (sin secretos en este informe).

---

## 3. URLs de prueba (smoke E11)

Sin secretos ni IDs internos sensibles:

| Superficie | Path |
|------------|------|
| Home | `/` |
| Evento próximo / convocatoria | `/eventos/smoke-e11-event-a` |
| Evento con cobertura | `/eventos/smoke-e11-event-c` |
| Evento ubicación HIDDEN | `/eventos/smoke-e11-event-e` |
| Artículo multi-fotógrafo | `/noticias/smoke-e11-article-c` |
| Artículo álbum DELETED | `/noticias/smoke-e11-article-d` |
| Artículo foto REVOKED | `/noticias/smoke-e11-article-e` |

Script: `apps/infospot/lib/smoke/qa-visual.ts` (Playwright opcional vía `PLAYWRIGHT_MODULE`).

---

## 4. Datos smoke

Semilla: `pnpm --filter infospot smoke:seed` (`e11-smoke-seed.ts`).

Incluye: eventos próximos / convocatoria / finalizado; coberturas 1 y N fotógrafos; álbum AVAILABLE; álbum HIDDEN/DELETED; foto licencia REVOKED; evento `locationVisibility: HIDDEN`.

**Limpieza:** `pnpm --filter infospot smoke:cleanup` al cierre de la etapa (obligatorio antes de declarar staging limpio).

---

## 5. Problemas encontrados

### Bloqueantes (corregidos en rama)

| ID | Problema | Impacto |
|----|----------|---------|
| B1 | Home 500 — `Invalid time value` en “Buscan fotógrafos” | Home caía |
| B2 | Artículo 500 — `startAt.toISOString is not a function` tras `unstable_cache` | Cobertura pública caía |
| B3 | Ficha evento HIDDEN filtraba mal en metadata/JSON-LD/UI | Riesgo de exposición de calle/coords |

### Importantes (corregidos)

| ID | Problema | Impacto |
|----|----------|---------|
| I1 | `<a>` anidado: `ArticleCard` + `CategoryBadge` link | Hidratación + HTML inválido |
| I2 | Galería: foco, Escape, swipe, índice absoluto, hit targets | A11y lightbox |
| I3 | SearchField disabled: mismatch `caret-color` | Warning hidratación header |

### Mejoras posteriores

| ID | Nota |
|----|------|
| M1 | Imágenes smoke con host inexistente → `ERR_NAME_NOT_RESOLVED` (no código) |
| M2 | Next Image quality 95 no listada en `images.qualities` |
| M3 | QA Safari / CLF join-leave en browser real pendiente |
| M4 | Leaflet bundle / CLS: sin regresión crítica medida; optimizar en etapa perf |
| M5 | Editor redacción / Centro coberturas / Selector: validados por etapas 8–11 + tests; smoke UI autenticado no re-corrido completo en E12 |

---

## 6. Correcciones realizadas (commits)

En `migration-legacy-clf-to-monorepo` (E12):

| SHA | Mensaje |
|-----|---------|
| `f5c76ee` | `fix(infospot): prevent hidden location data exposure` |
| `a93cac5` | `fix(infospot): harden home date formatting against invalid values` |
| `0ea2dd8` | `fix(infospot): rehydrate coverage dates after cache serialization` |
| `d9d974f` | `fix(infospot): improve coverage gallery keyboard and focus a11y` |
| `1a4710a` | `fix(infospot): avoid nested anchors in article cards` |
| `fd445e7` | `chore(infospot): add etapa 12 visual qa smoke script` |
| `c5445d9` | `docs(infospot): production readiness report etapa 12` |
| `87b5d45` | `fix(infospot): keep etapa 12 qa script out of app typecheck` |

---

## 7. Resultados por superficie

### Home
Banner / fallback / secciones de distribución / cards / CTA / estados vacíos: HTTP 200; sin overflow horizontal; jerarquía editorial preservada; fechas robustas.

### Eventos
Próximo / con cobertura / HIDDEN: placeholder «Ubicación informada a los participantes»; sin calle secreta ni coords en body; JSON-LD respeta visibility.

### Artículos
Título, bajada, créditos, galería, related, JSON-LD/OG: OK post-fix fechas. REVOKED muestra placeholder comercial. Álbum DELETED no empuja CTA de compra.

### Galería
Teclado (abrir / Escape), swipe, foco en cerrar, `draggable=false`, sin URL de original ni storage keys en HTML revisado.

### Redacción / Coberturas / Selector / Distribución
Cubiertos en etapas previas + tests unitarios. E12 no reabrió features; sin defectos nuevos bloqueantes detectados en smoke público.

### CLF join/leave
App CLF no levantada en esta sesión local. Contratos e idempotencia documentados en docs 22/28; **smoke browser join/leave = pendiente operativo** (no bloquea merge de fixes E12; sí condiciona go-live conjunto).

---

## 8. Accesibilidad

- Navegación teclado lightbox: OK tras fix.
- Foco visible en controles lightbox: OK.
- Labels / alt en fotos editoriales: presentes en view model.
- Nested interactive (`a` in `a`): corregido.
- Contraste / mapa: sin fallos WCAG AA evidentes en smoke; mapa HIDDEN no renderiza coords privadas.

---

## 9. Performance (cualitativo)

- Above-the-fold: hero/stock con `priority` / eager donde aplica.
- Lazy en grids.
- Cache cobertura 120s + rehidratación Date.
- Sin optimización prematura adicional en E12.
- Hallazgo menor: quality 95 del logo.

---

## 10. Consola y red

| Antes | Después |
|-------|---------|
| Nested `<a>`, hydration fail en home | Resuelto |
| 500 home / artículos smoke | Resuelto |
| `ERR_NAME_NOT_RESOLVED` en assets smoke | Esperable (hosts fake) |
| Imágenes rotas reales de prod | No observadas en paths locales sanos |

---

## 11. Dependencias operativas

| Área | Estado |
|------|--------|
| Variables staging/prod | Documentadas en `10-launch-checklist.md` / `13-production-deploy.md` |
| R2 | Requerido para uploads reales |
| CLF read/write | Readonly + provisioning; join real pendiente smoke |
| Geocoding | Presente; visibility pública filtrada |
| Licencia editorial | Policy CONTRACT (Etapa 11) |
| Cron / workers | Plan en `29-jobs-and-workers-plan.md` — no asumir prod sin jobs |
| Migraciones | Solo `migrate deploy` en ventana controlada; **nunca** `db push` / `migrate reset` |

---

## 12. Checklist de producción

- [ ] Backup DB antes de migrate
- [ ] `prisma migrate deploy` (staging → luego prod en ventana)
- [ ] Variables prod alineadas (sin secretos en repo)
- [ ] Dominio + `NEXT_PUBLIC_INFOSPOT_URL`
- [ ] Cache / CDN / R2 CORS
- [ ] Jobs / workers activos si hay sync/provisioning
- [ ] Smoke post-deploy (home, evento, noticia, `/api/health`)
- [ ] Plan de rollback (redeploy previous + migrate down solo si hay plan escrito)
- [ ] Confirmar ausencia de datos smoke en staging/prod

---

## 13. Bloqueantes residuales para go-live

1. Smoke CLF join/leave/cupos en **staging CLF** (URL ≠ producción) con write seguro.
2. R2/storage staging con assets reales y derivados.
3. Jobs/cron de sync + reconcile comerciales activos en staging (rutas listas; no en prod).
4. Safari/iOS real (mapa + galería); WebKit headless solo home.
5. Worker async de derivados si fotos grandes degradan el editor.
6. Ventana de migración a producción **aún no autorizada**.

Detalle: [`31-final-staging-gate.md`](./31-final-staging-gate.md).

---

## 14. Confirmaciones

- Producción **no** fue migrada en Etapa 12.
- No se usó `db push` ni `migrate reset`.
- Fixes pusheados únicamente a `migration-legacy-clf-to-monorepo` (verificar en cierre de sesión).
- Informe listo para gate de salida.
