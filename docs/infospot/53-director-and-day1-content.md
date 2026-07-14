# 53 — Director + contenido día 1 (Etapas 22K / 22L)

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Alias:** `https://infospot-dnxsuite.vercel.app`  
**Production:** `fa55a2d` · health `db:ok` · schema up to date  
**Estado de etapa (actualizado 22U):** roles editoriales **validados** · contenido Día 1 **`COMPLETE_PENDING_REAL_CONTENT`** — ver [62](./62-editorial-roles-and-day-one-content-gate.md)  
**Estado producto objetivo:** `READY_FOR_DNS_AND_PUBLICATION` — **aún no** (faltan eventos futuros reales + cutover dominio)  
**Launch Readiness:** **~96%** (ops); contenido agenda futura = bloqueante soft  
**Dominio `infospot.com.ar`:** **NO-GO**

No incluye emails, secretos ni URLs de base de datos.

Ver: [`52-pre-dns-production-closure.md`](./52-pre-dns-production-closure.md), [`51-go-live-master-checklist.md`](./51-go-live-master-checklist.md), [`44-editorial-operations-manual.md`](./44-editorial-operations-manual.md), [`55-google-login-production-fix.md`](./55-google-login-production-fix.md), [`54-first-director-production-validation.md`](./54-first-director-production-validation.md), [`62-editorial-roles-and-day-one-content-gate.md`](./62-editorial-roles-and-day-one-content-gate.md).

---

## 0. Reintentos 22L / 22M (evidencia)

| Check | 22L | 22M |
|-------|-----|-----|
| `User` count Neon Production | **0** | **0** |
| `InfoSpotUserRole` | **0** | **0** |
| `INFOSPOT_DIRECTOR_EMAIL` en shell del agente | Ausente | **Ausente** |
| OAuth start `/api/auth/google` | 307 OK | 307 visto (~15:53) |
| Callback `/api/auth/google/callback` en logs | **No** | **No** |
| Health / schema | `db:ok` / up to date | igual |

**22M:** precondiciones del prompt **no cumplidas** en el entorno del agente (sin email exportado; sin User creado). No se ejecutó grant.


---

## 1. Matriz

### Histórico 22K/L (bloqueado por primer login)

| Área | Estado |
|------|--------|
| Usuarios | **0** |
| Director | **Inexistente** |
| Noticias DRAFT / PUBLISHED | 0 / 0 |
| Eventos futuros | **0** (40 DRAFT finalizados) |
| Coberturas / convocatorias / placements | 0 |

### Reconfirmado 22U (Production)

| Área | Estado |
|------|--------|
| Users | **3** |
| Director / Redactor ACTIVE | **2** / **1** (`VALID_*`) |
| Noticias DRAFT / PUBLISHED | **4** / **0** |
| Eventos futuros | **0** (41 DRAFT históricos) |
| Coberturas / placements | **120** / **0** |

---

## 2. Código de parada

### Histórico 22K–22M

```text
BLOCKED_BY_FIRST_DIRECTOR_LOGIN
```

**No** se creó usuario artificial. **No** se ejecutó grant. **No** se inventó email.

### 22U

```text
COMPLETE_PENDING_REAL_CONTENT
```

Roles editoriales desbloqueados; falta agenda futura verificable + OAuth browser humano. Dominio sigue **NO-GO**.

### Desbloqueo (orden estricto)

1. Confirmar deploy con fix 22O ([55](./55-google-login-production-fix.md)): CTA Google = enlace a `/api/auth/google`.  
2. Abrir **exactamente** https://infospot-dnxsuite.vercel.app/ingresar (alias Production, no preview).  
3. Completar **Google** hasta volver a la app.  
   - Sin rol Info Spot → destino esperado `/ingresar/acceso-pendiente` (normal).  
4. Confirmar en Neon Production exactamente **1** `User`.  
5. En la shell del agente (sin pegar el email en el chat ni en docs):

```bash
export INFOSPOT_DIRECTOR_EMAIL="<email-autorizado>"
# DATABASE_URL / DIRECT_URL de Info Spot Production (bitter-salad)
pnpm --filter @repo/db db:grant-infospot-director
```

6. Seguir [54](./54-first-director-production-validation.md) y re-lanzar validación `/redaccion` + borradores día 1.

Si hay duplicados del mismo email → `BLOCKED_BY_DUPLICATE_IDENTITY`.

---

## 3. Contenido día 1 (sin inventar)

Plan intacto: 3–6 eventos futuros reales, 3–5 noticias, ≥1 cobertura autorizada, HERO el día D. Todo en **DRAFT** hasta DNS. No seeds DEMO.

---

## 4. GO / NO-GO

| Pregunta | Respuesta |
|----------|-----------|
| ¿`READY_FOR_DNS_AND_PUBLICATION`? | **NO** |
| ¿Redeploy? | **No** |
| ¿App Production modificada? | **No** (`fa55a2d`) |
| Próximo paso | Deploy fix Google ([55](./55-google-login-production-fix.md)) → OAuth completo → grant ([54](./54-first-director-production-validation.md)) |
