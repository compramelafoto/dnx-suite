# 53 — Director + contenido día 1 (Etapas 22K / 22L)

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Alias:** `https://infospot-dnxsuite.vercel.app`  
**Production:** `fa55a2d` · health `db:ok` · schema up to date  
**Estado de etapa:** **`BLOCKED_BY_FIRST_DIRECTOR_LOGIN`**  
**Estado producto objetivo:** `READY_FOR_DNS_AND_PUBLICATION` — **aún no alcanzado**  
**Launch Readiness:** **~96%**  
**Dominio `infospot.com.ar`:** **NO-GO**

No incluye emails, secretos ni URLs de base de datos.

Ver: [`52-pre-dns-production-closure.md`](./52-pre-dns-production-closure.md), [`51-go-live-master-checklist.md`](./51-go-live-master-checklist.md), [`44-editorial-operations-manual.md`](./44-editorial-operations-manual.md).

---

## 0. Reintento 22L (evidencia)

| Check | Resultado |
|-------|-----------|
| `User` count Neon Production | **0** |
| `InfoSpotUserRole` | **0** |
| `INFOSPOT_DIRECTOR_EMAIL` en shell / `.env*` | **Ausente** |
| Health / schema | `db:ok` · up to date |
| OAuth start `/api/auth/google` | **307** → Google · `redirect_uri` = alias `…/api/auth/google/callback` |
| Logs Production recientes | `GET /ingresar` **sí**; **no** aparece callback Google ni creación de sesión |

Interpretación: se abrió la pantalla de ingreso, pero **no se completó el flujo OAuth** (o no contra este alias Production). Por eso no hay fila en `User`.

---

## 1. Matriz

| Área | Estado |
|------|--------|
| Usuarios | **0** |
| Director | **Inexistente** |
| Noticias DRAFT / PUBLISHED | 0 / 0 |
| Eventos futuros | **0** (40 DRAFT finalizados) |
| Coberturas / convocatorias / placements | 0 |

---

## 2. Código de parada

```text
BLOCKED_BY_FIRST_DIRECTOR_LOGIN
```

**No** se creó usuario artificial. **No** se ejecutó grant. **No** se inventó email.

### Desbloqueo (orden estricto)

1. Abrir **exactamente** https://infospot-dnxsuite.vercel.app/ingresar (alias Production, no preview).  
2. Completar **Google** hasta volver a la app.  
   - Sin rol Info Spot → destino esperado `/ingresar/acceso-pendiente` (normal).  
3. Confirmar en Neon Production exactamente **1** `User`.  
4. En la shell del agente (sin pegar el email en el chat ni en docs):

```bash
export INFOSPOT_DIRECTOR_EMAIL="<email-autorizado>"
# DATABASE_URL / DIRECT_URL de Info Spot Production (bitter-salad)
pnpm --filter @repo/db db:grant-infospot-director
```

5. Re-lanzar **22L** para validar `/redaccion` + permisos Director + borradores día 1.

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
| Próximo paso | OAuth completo + `INFOSPOT_DIRECTOR_EMAIL` en shell |
