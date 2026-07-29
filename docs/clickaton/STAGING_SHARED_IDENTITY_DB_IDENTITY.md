# Identidad de la DB compartida Staging (evidencia 10B.6)

**Fecha auditoría:** 2026-07-29  
**Método:** `vercel env pull` + `psql` read-only + health HTTP (sin imprimir secretos)

---

## Destino propuesto (Estrategia A)

| Campo | Valor sanitizado |
| ----- | ---------------- |
| Rol | **DB identidad Staging candidata** (CLF Preview / DNX Payments staging) |
| Host | `ep-round-fog-a4xgibtv…` |
| DB | `neondb` |
| Proyecto Vercel que la usa | `compramelafoto-dnxsuite` **Preview** |
| También en | `services/dnx-mcp/.env.local`, `apps/compramelafoto/.env.preview.local` |
| ClickatonEdition presente | **NO** (aún) |
| Users | **3** (solo seeds `@clf.dnx.test`) |
| Sessions | 40 |
| DnxUserProfile | 0 |
| Admins esperados (dnx/rodrigo/tammy) | **ausentes** |

Fingerprint usuarios destino (sin hashes):

| id | email | role | hash |
| -- | ----- | ---- | ---- |
| 1 | fotografo.staging@clf.dnx.test | PHOTOGRAPHER | bcrypt |
| 2 | admin.staging@clf.dnx.test | ADMIN | bcrypt |
| 27 | referred.smoke.15e@clf.dnx.test | PHOTOGRAPHER | bcrypt |

---

## Origen Clickatón Staging (vivo)

| Campo | Valor |
| ----- | ----- |
| Health | `https://clickaton-staging.vercel.app/api/public/health/db` |
| ok | true |
| hostHint | `ep-divine-smoke-av8hmt7s-pooler` |
| publishedEditions | **6** |
| Vercel project | `clickaton-staging` |
| `DATABASE_URL` en Vercel | **Encrypted** — `vercel env pull` → **vacío** |
| Connection string local | **No disponible** en esta sesión |

---

## FotoRank Preview (NO compartida hoy)

| Campo | Valor |
| ----- | ----- |
| Vercel Preview `DATABASE_URL` | `ep-empty-moon-ad4teeyd…` / `neondb` |
| ¿Misma que CLF Preview? | **NO** |
| Conexión con credenciales pull | **FAIL** (password authentication failed) |
| `fotorank.staging.dnxsuite.com` deploy | apunta a deployment Production (`dpl_AT7b…`) — riesgo de DB `ep-dawn-dew` |

---

## Veredicto

**No existe hoy una DB Staging donde CLF + FotoRank + Clickatón resuelvan el mismo `User.id`.**

Para cerrar 10B.6 hay que:

1. Adoptar `ep-round-fog` (u otra DB Staging única) como destino **oficial**.
2. Apuntar **FotoRank Preview** a esa misma DB.
3. Obtener URL pullable de Clickatón Staging (`ep-divine-smoke` / `clickaton_staging`).
4. Importar dominio Clickatón + reconciliar usuarios.
5. Recién entonces fixtures 1–6.
