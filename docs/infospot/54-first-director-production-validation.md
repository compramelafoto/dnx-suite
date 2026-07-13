# 54 — Validación primer Director en Production

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Alias:** `https://infospot-dnxsuite.vercel.app`  
**Precondición:** login Google operativo (ver [55](./55-google-login-production-fix.md))

No incluye emails ni secretos.

---

## Objetivo

Validar el bootstrap del primer Director **después** de que exista exactamente **1** User creado por OAuth Google.

---

## Checklist

| # | Paso | Estado esperado |
|---|------|-----------------|
| 1 | Abrir `/ingresar` en alias Production | 200 |
| 2 | Clic «Continuar con Google» | Navega a `/api/auth/google` → Google |
| 3 | Completar consentimiento | Callback `/api/auth/google/callback` |
| 4 | Sin rol Info Spot | Destino `/ingresar/acceso-pendiente` |
| 5 | Neon Production | **1** User · **0** `InfoSpotUserRole` |
| 6 | Exportar email en shell (no en chat/docs) | `INFOSPOT_DIRECTOR_EMAIL` |
| 7 | Grant | `pnpm --filter @repo/db db:grant-infospot-director` |
| 8 | Re-login / refresh | Acceso a `/redaccion` |
| 9 | Rol | `INFOSPOT_DIRECTOR` ACTIVE |

**No** crear User a mano. **No** hardcodear email. **No** asignar Director antes del paso 5.

---

## Comando grant (referencia)

```bash
export INFOSPOT_DIRECTOR_EMAIL="<email-autorizado>"
# DATABASE_URL / DIRECT_URL de Info Spot Production
pnpm --filter @repo/db db:grant-infospot-director
```

---

## Códigos de parada

| Código | Significado |
|--------|-------------|
| `BLOCKED_BY_FIRST_DIRECTOR_LOGIN` | Aún 0 users / login incompleto |
| `BLOCKED_BY_DUPLICATE_IDENTITY` | Más de un User con el mismo email |
| `READY_FOR_DNS_AND_PUBLICATION` | Solo tras Director + contenido día 1 + DNS plan |

---

## Relación con go-live

Ver [51](./51-go-live-master-checklist.md) (T-1 / T-30) y [53](./53-director-and-day1-content.md).
