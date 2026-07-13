# 53 — Director + contenido día 1 (Etapa 22K)

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Alias:** `https://infospot-dnxsuite.vercel.app`  
**Production:** `fa55a2d` · health `db:ok` · schema up to date  
**Estado de etapa:** **`BLOCKED_BY_FIRST_DIRECTOR_LOGIN`**  
**Estado producto objetivo:** `READY_FOR_DNS_AND_PUBLICATION` — **aún no alcanzado**  
**Launch Readiness:** **~96%** (sin cambio respecto de 22J)  
**Dominio `infospot.com.ar`:** **NO-GO**

No incluye emails, secretos ni URLs de base de datos.

Ver: [`52-pre-dns-production-closure.md`](./52-pre-dns-production-closure.md), [`51-go-live-master-checklist.md`](./51-go-live-master-checklist.md), [`44-editorial-operations-manual.md`](./44-editorial-operations-manual.md).

---

## 1. Matriz inicial (22K)

| Área | Estado inicial |
|------|----------------|
| Usuarios | **0** |
| Director | **Inexistente** |
| Noticias DRAFT | 0 |
| Noticias PUBLISHED | 0 |
| Eventos futuros | **0** (40 DRAFT finalizados) |
| Coberturas | 0 |
| Convocatorias | 0 |
| Placements | 0 |

Git: rama `migration-legacy-clf-to-monorepo` · cambio ajeno CLF ignorado · migrate status **up to date** · `/redaccion` → 307 · home 200.

---

## 2. Fase Director — bloqueada

### Evidencia

| Check | Resultado |
|-------|-----------|
| `User` count Neon Production | **0** |
| `InfoSpotUserRole` | **0** |
| `INFOSPOT_DIRECTOR_EMAIL` en entorno / `.env*` | **Ausente** |
| Grant sin email | Exit 1 (guard OK) |
| Login page `/ingresar` | 200 |

**No** se creó usuario artificial.  
**No** se ejecutó grant.  
**No** se inventó email.

### Código de parada

```text
BLOCKED_BY_FIRST_DIRECTOR_LOGIN
```

### Desbloqueo (manual, orden estricto)

1. Abrir https://infospot-dnxsuite.vercel.app/ingresar  
2. Completar login Google (cuenta autorizada).  
3. Confirmar que Neon Production tiene exactamente **1** `User` nuevo.  
4. En una shell local (valores temporales, no commitear):

```bash
export INFOSPOT_DIRECTOR_EMAIL="<email-autorizado>"
# DATABASE_URL / DIRECT_URL de Info Spot Production (bitter-salad), sin imprimir
pnpm --filter @repo/db db:grant-infospot-director
```

5. Re-lanzar Etapa 22K (o continuación) para:
   - validar `/redaccion` autenticado;
   - checklist de permisos Director;
   - preparación de borradores reales día 1.

Si tras el login hay **duplicados** del mismo email → `BLOCKED_BY_DUPLICATE_IDENTITY` (no elegir arbitrariamente).

---

## 3. Contenido día 1 — plan sin inventar hechos

Los 40 eventos DRAFT siguen **todos finalizados** · **0 futuros** · **0 convocatorias**.  
No se publicaron. No se crearon borradores ficticios. No se corrieron seeds DEMO.

### Inventario mínimo recomendado (cuando exista Director)

| Pieza | Cantidad | Origen permitido | Publicar ahora |
|-------|----------|------------------|----------------|
| Eventos futuros | 3–6 | Nuevos reales o intake curado | **No** (dejar DRAFT hasta día DNS) |
| Noticias | 3–5 | Hechos verificados + créditos | **No** |
| Cobertura + fotos | ≥1 | Material CLF con licencia OK | **No** |
| Convocatoria | 0–1 | Solo si call CLF realmente abierta | **No** |
| Placement HERO | 1 | Tras primera pieza PUBLISHED (día D) | Día DNS |

### Checklist por borrador (Director)

- [ ] Título / bajada / categoría canónica  
- [ ] Fecha / autor / fuente  
- [ ] Ubicación + geo si evento  
- [ ] Portada o placeholder válido + alt + crédito  
- [ ] SEO title / description / slug  
- [ ] OG image válida  
- [ ] Relación evento/cobertura si aplica  
- [ ] `contentTag` ≠ DEMO  
- [ ] Estado **DRAFT** hasta GO DNS  

### Home pre-publicación

Sigue válida: hero de plataforma, sin bloques rotos, sin DEMO. Aceptable hasta tener PUBLISHED.

### Placements

0 actuales. No crear HERO apuntando a DRAFT. Activar el **día D** tras publicar.

---

## 4. Seguridad (sin Director)

| Check | Estado |
|-------|--------|
| Roles accidentales | Ninguno |
| Usuarios DEMO | 0 |
| `/redaccion` visitante | 307 |
| Crons / R2 cleanup | Protegidos (401 sin auth) |
| Emails en docs/commits | No |

---

## 5. GO / NO-GO

| Pregunta | Respuesta |
|----------|-----------|
| ¿`READY_FOR_DNS_AND_PUBLICATION`? | **NO** |
| ¿Bloqueo DNS? | Sí (externo) |
| ¿Bloqueo operativo restante? | **Sí — primer login + grant Director + contenido DRAFT real** |
| ¿Redeploy 22K? | **No** |
| ¿Production app modificada? | **No** (sigue `fa55a2d`) |

---

## 6. Próximo paso único

**El usuario autorizado debe iniciar sesión en el alias Production.**  
Avisar al agente con `INFOSPOT_DIRECTOR_EMAIL` (solo env) para completar grant + validación de redacción + borradores reales.
