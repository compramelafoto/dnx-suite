# 62 — Gate roles editoriales + contenido Día 1 (Etapa 22U)

**Fecha:** 2026-07-14  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD docs (al escribir):** `dae4b2a` (ancestro Production `06a8701`)  
**Alias Production:** `https://infospot-dnxsuite.vercel.app`  
**Deploy observado:** `dpl_5YhNoZC3…` · health `db:ok` · `version=06a8701`  
**Dominio propio:** **NO-GO** (sin cutover DNS / Search Console / anuncio)

No incluye emails, IDs personales, tokens, cookies ni URLs de base de datos.

---

## Estado de etapa

| Gate | Código |
|------|--------|
| Roles / sesión / permisos (ops) | **PASS** (22U) |
| OAuth humano (22V/22W) | **PENDING_HUMAN** — iniciar en `https://infospot.com.ar/ingresar` · [63](./63-oauth-human-and-day-one-content-readiness.md) · [64](./64-domain-oauth-and-minimum-launch-content.md) |
| Contenido Día 1 | **`BLOCKED_BY_CONTENT_SOURCE`** (0 eventos PUBLIC futuros; drafts incompletos) |
| Migración focal (22W) | **Aplicada** en Production (`SAFE_ADDITIVE`) |
| Objetivo `READY_FOR_DOMAIN_GO_LIVE` | **NO** |
| Dominio anuncio público | **NO-GO** |

```text
BLOCKED_BY_CONTENT_SOURCE
```

Motivo (22W): CLF prod sigue con **0** PUBLIC futuros + slug; no se inventaron eventos. DNS/SSL/canónicos de dominio **OK**; migrate focal aplicada.

---

## 1. Auditoría inicial (Production Neon)

| Área | Estado inicial |
|------|----------------|
| Users | 3 |
| CUSTOMER ACTIVE | 3 |
| PHOTOGRAPHER ACTIVE | 0 |
| ORGANIZER ACTIVE | 0 |
| Director ACTIVE | 2 |
| Redactor ACTIVE | 1 |
| Noticias DRAFT | 4 |
| Noticias PUBLISHED | 0 |
| Noticias IN_REVIEW | 0 |
| Eventos futuros | 0 |
| Eventos DRAFT (histórico sync) | 41 |
| Coberturas | 120 |
| Convocatorias publicables (Home) | 0 (sin eventos futuros publicados) |
| Placements activos | 0 |
| Preferencias / onboarding | 3 / completado |
| Schema | up to date (40 migraciones · ninguna aplicada en 22U) |
| Sesiones activas (antes del cleanup smoke) | 6 |

Working tree ajeno: `apps/compramelafoto/.gitignore` — **no mezclado**.

---

## 2. Auditoría de membresías editoriales

Tres membresías ACTIVE. Sin duplicados, sin huérfanas, sin usuarios bloqueados. Todas con perfil **CUSTOMER ACTIVE** y onboarding marcado.

| Membresía | Clasificación | canPublish | CUSTOMER | Onboarding | PHOTO/ORG |
|-----------|---------------|------------|----------|------------|-----------|
| A | `VALID_DIRECTOR` | true | sí | sí | no / no |
| B | `VALID_DIRECTOR` | true | sí | sí | no / no |
| C | `VALID_REDACTOR` | true | sí | sí | no / no |

**Política no cambiada.** El Redactor Production tiene `canPublish: true` (equivalente operativo a publicación directa / distribución según matriz del manual). No se revocó ni se modificó ningún rol.

---

## 3. Smoke OAuth real

| Paso | Resultado |
|------|-----------|
| OAuth start (`/api/auth/google`) | **307** hacia Google |
| Google (consentimiento browser) | **PENDING_HUMAN** — requiere cuenta editorial autorizada |
| Callback | No cerrado por el agente |
| Sesión | Validada vía smoke de sesión corta mint (Director / Redactor) + cleanup |
| Perfil público | CUSTOMER; sin PHOTO/ORG |
| Rol editorial | Reconocido en rutas `/redaccion` |
| Redirect final (sesión mint) | `/redaccion`; `/completar-perfil` → **307** a redacción (onboarding ya OK) |

**Observación pre-dominio:** el `redirect_uri` emitido por Production apunta al host canónico de dominio (`infospot.com.ar`), coherente con canonical/OG/sitemap actuales. El cutover DNS sigue **NO-GO**; el operador debe completar Google en el host autorizado en Cloud Console.

---

## 4–5. Sesión Director / Redactor (Production)

Smoke autenticado con sesiones temporales (revocadas al final).

| Ruta / acción | Director | Redactor |
|---------------|----------|----------|
| `/redaccion` | 200 | 200 |
| `/redaccion/asistente` | 200 | 200 |
| `/redaccion/eventos` | 200 | 200 |
| `/redaccion/coberturas` | 200 | 200 |
| `/redaccion/distribucion` | 200 | 200 (`canPublish`) |
| `/admin/usuarios` | 200 | **307** forbidden |
| Cleanup R2 | autorizado (400 body vacío) | **403** |
| Crear / editar / revisión (policy + smoke DRAFT) | sí | sí |
| Publicar | sí (no ejercido a PUBLISHED en Prod) | sí por flag (no ejercido) |

### Matriz operativa observada

| Acción | Director | Redactor (Prod, `canPublish=true`) |
|--------|:--------:|:----------------------------------:|
| Crear | ✓ | ✓ |
| Editar | ✓ | ✓ |
| Enviar a revisión | ✓ | ✓ |
| Publicar | ✓ | ✓ (flag) |
| Despublicar | ✓ | ✓ (flag) |
| Distribución | ✓ | ✓ (flag) |
| Usuarios | ✓ | ✗ |
| Cleanup R2 | ✓ | ✗ |

Fuente de verdad de código: `packages/db/src/infospot-permissions.ts` + [44](./44-editorial-operations-manual.md) §9.

---

## 6. Permisos negativos

| Actor | Resultado |
|-------|-----------|
| Anónimo Home | 200 · sin «Ver como» · sin Panel · sin `/redaccion` |
| Anónimo `/redaccion` | **307** → login |
| CUSTOMER sin rol editorial | Home OK · `/redaccion` → acceso pendiente / forbidden (policy) |
| Cookie Home | no concede roles ni capacidades |

No se crearon usuarios nuevos.

---

## 7. Home adaptativa (cuenta editorial)

| Check | Resultado |
|-------|-----------|
| Experiencia pública CUSTOMER | Conservada |
| Acceso Redacción en chrome | Visible con membresía |
| «Ver como» | Ausente (solo CUSTOMER ACTIVE; sin PHOTO/ORG en Prod — **válido**) |
| Cache Home | `private, no-cache, no-store` |
| Mezcla rol editorial ↔ selector público | No observada |

---

## 8–9. Smoke editorial temporal + cleanup

| Paso | Resultado |
|------|-----------|
| Crear DRAFT técnico | OK |
| Enviar a revisión → devolver a DRAFT | OK |
| Publicar | **No** ejecutado |
| Cleanup artículo / observaciones | OK · `22u-smoke-*` = 0 |
| PUBLISHED | **0** |
| Roles / perfiles / eventos reales | Sin alteración |
| Sesiones smoke | **2** revocadas |

---

## 10. Contenido disponible (candidatos Día 1)

| Candidato | Tipo | Fuente | Fecha | Estado | Faltantes |
|-----------|------|--------|-------|--------|-----------|
| Noticias existentes (×4) | Noticia | Redacción Prod | — | DRAFT | 3 sin categoría; fuentes/SEO incompletos; 1 `NEEDS_REVIEW` |
| Eventos sync histórico (×41) | Evento | CLF inbound | pasados | DRAFT | **No** sirven como agenda futura |
| Coberturas (×120) | Cobertura | Sync / legado | — | inventario | Licencia/álbum autorizado + selección Día 1 pendiente |
| CLF futuros públicos + slug | Evento | CLF readonly (env local) | — | **0** | Esperar eventos reales futuros / sync Prod |
| Convocatoria abierta | Convocatoria | CLF | — | **0** | Requiere evento futuro + política pública |

**No inventado. No publicado.**

---

## 11. Sync CLF dry-run

```bash
pnpm --filter infospot sync:clf-events -- --dry-run --limit 10
```

| Resultado | Valor |
|-----------|-------|
| Escrituras | **Ninguna** (`dryRun: true`) |
| Escaneados | 10 (últimos públicos con slug; **no** filtro futuro en listado sync) |
| would_create / would_update | 7 / 3 |
| Futuros públicos+slug (query dedicada) | **0** |

Clasificación Día 1: sin candidatos futuros importables ahora. Importación real **bloqueada** hasta aprobación editorial + existencia de eventos futuros.

---

## 12. Preparación contenido Día 1

| Objetivo | Hecho |
|----------|-------|
| 3–5 noticias DRAFT nuevas reales | **No** — insuficientes fuentes verificables nuevas; enriquecer las 4 existentes |
| 3–6 eventos futuros DRAFT | **No** — 0 futuros disponibles |
| 1 cobertura DRAFT autorizada | Pendiente selección de álbum con licencia |
| 1 convocatoria | Pendiente confirmación CLF |

Plan documentado; estado contenido: **`COMPLETE_PENDING_REAL_CONTENT`**.

---

## 13. Plan Home Día 1 (sin activar placements)

| Bloque | Pieza candidata | Acción Día D |
|--------|-----------------|--------------|
| HERO | Nota de presentación (aún por cerrar en DRAFT) | Publicar → placement HERO |
| Destacados | 2–3 noticias REAL revisadas | Publicar + prioridad editorial |
| Próximos | 3–6 eventos futuros post-sync | Publicar agenda |
| Coberturas | 1 cobertura con álbum autorizado | Publicar + vínculo |
| Fotógrafos | 1 convocatoria CLF abierta | Solo si CLF confirma |

Home actual estable con **0** PUBLISHED (hero plataforma / empty states).

---

## 14. Orden de publicación (no ejecutar)

1. Nota de presentación  
2. Agenda inicial  
3. Eventos futuros  
4. Convocatoria válida  
5. Cobertura  
6. Activar HERO  
7. Verificar Home  
8. Verificar SEO  
9. Anunciar dominio  

| Pieza | Responsable | Estado | Checklist | Placement | Rollback | Dependencia |
|-------|-------------|--------|-----------|-----------|----------|-------------|
| Presentación | Director | DRAFT pendiente | Fuentes + SEO | HERO | unpublish | — |
| Agenda / eventos | Director + Redactor | Bloqueado por futuros | Sync dry-run → import | Próximos | unpublish | CLF futuros |
| Convocatoria | Director | Bloqueado | Política CLF | Fotógrafos | retirar CTA | Evento futuro |
| Cobertura | Redactor → Director | Inventario 120 | Licencia álbum | Coberturas | unpublish | Álbum autorizado |

---

## 15. SEO pre-dominio

| Configuración | Ahora (alias sirve app) | Día D |
|---------------|-------------------------|-------|
| App URL | Alias Vercel | `infospot.com.ar` / `www` |
| Canonical | Ya apunta a `www.infospot.com.ar` | Confirmar DNS + SSL |
| OAuth callback | Host de dominio en `redirect_uri` | Mismo host + Console |
| Sitemap / robots Host | Dominio | Dominio vivo |
| OG URL / imagen | Host `www.infospot.com.ar` | Dominio vivo |
| JSON-LD | Presente (`NewsMediaOrganization`) | Revisar URL logo |
| Search Console | **No** | Día D+ |

Sitemap/robots/JSON-LD **válidos estructuralmente**; el host canónico adelantado es coherente con el plan de cutover, no con DNS público aún.

---

## 16. Validaciones técnicas

| Check | Resultado |
|-------|-----------|
| `test:google-oauth-start` | OK |
| `test:editorial-workflow` (+ eventos) | OK |
| `test:editorial-assistant` | OK |
| `test:post-login-destination` | OK |
| `test:home-experience` | OK |
| `test:distribution` | OK |
| `test:coverage` | OK |
| `test:r2-cleanup` | OK |
| `check-types` | OK (re-ejecutado) |
| `build` Info Spot | OK |
| Prisma validate | OK |
| `migrate status` Production | **Database schema is up to date!** |
| lint | **FAIL conocido** — warnings turbo `no-undeclared-env-vars` en R2 CLF (`max-warnings 0`); sin errores de lógica 22U |
| Health | `db:ok` |
| Smoke público | OK |
| Smoke Director / Redactor | OK + cleanup |

Migraciones **no** aplicadas.

---

## 17. Readiness

| Pregunta | Respuesta |
|----------|-----------|
| ¿Roles editoriales listos? | **Sí** |
| ¿OAuth start OK? | **Sí** |
| ¿OAuth browser cerrado por humano? | **Pendiente** |
| ¿Contenido Día 1 listo para publicar? | **No** (`COMPLETE_PENDING_REAL_CONTENT`) |
| ¿Dominio GO? | **NO-GO** |
| ¿Redeploy obligatorio 22U? | **No** (solo docs) |

### Próximos pasos

1. Operador: completar Google OAuth con cuenta editorial en el host autorizado.  
2. Cuando existan eventos CLF públicos futuros: dry-run → import DRAFT (máx. 3–6) con aprobación.  
3. Completar 3–5 noticias REAL + 1 cobertura licenciada en DRAFT.  
4. Día D: checklist [51](./51-go-live-master-checklist.md).

---

## Relacionados

- [44](./44-editorial-operations-manual.md)  
- [51](./51-go-live-master-checklist.md)  
- [53](./53-director-and-day1-content.md)  
- [54](./54-first-director-production-validation.md)  
- [61](./61-adaptive-home-production-validation.md)  
