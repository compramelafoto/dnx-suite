# Identidad de la DB compartida Staging

**Fecha:** 2026-07-29 (10B.6.1)  
**Método:** health HTTP + `vercel env pull` + `psql` read-only sobre preview local (sin imprimir secretos)

---

## Declaración oficial

```text
DNX_STAGING_IDENTITY_DATABASE
```

| Campo | Valor sanitizado |
| ----- | ---------------- |
| Host | `ep-round-fog-a4xgibtv…` |
| DB | `neondb` |
| Apps que la usan hoy | ComprameLaFoto **monorepo** Preview; dnx-mcp local readonly |
| ClickatonEdition | **ausente** (pre-import) |
| Users | **3** (seeds `@clf.dnx.test`) |
| Sessions | 40 |
| Migraciones Prisma | 45 |
| ¿Production? | **No** |

### Por qué es la candidata correcta

1. Evidencia real de uso por ComprameLaFoto monorepo Preview (no solo por nombre).  
2. Contiene tablas de identidad (`User`, `UserSession`, passwords bcrypt seeds).  
3. Host denylist del cutover la distingue de Production (`ep-dawn-dew…`).  
4. ADR-002 Estrategia A — DB identidad compartida.

### Limitaciones actuales

- No contiene aún dominio Clickatón ni admins operativos (Daniel/Tammy/Rodrigo).  
- FotoRank Preview **no** la usa (`ep-empty-moon…`).  
- No es por sí sola “identidad cross-app lista” hasta cutover + alineación FotoRank.

---

## Origen Clickatón Staging (vivo)

| Campo | Valor |
| ----- | ----- |
| Health | `https://clickaton-staging.vercel.app/api/public/health/db` |
| ok | true |
| publishedEditions | **6** |
| Neon project | `plain-sky-50672248` / branch `clickaton-staging` |
| Host | `ep-divine-smoke-av8hmt7s*` |
| DB | `clickaton_staging` |
| Vercel `DATABASE_URL` | **Encrypted** → pull vacío |

---

## FotoRank Preview

| Campo | Valor |
| ----- | ----- |
| Host | `ep-empty-moon-ad4teeyd…` |
| ¿Misma que destino? | **NO** |
| SQL con pull Preview | password authentication failed |

---

## Desbloqueo

Ver acción única en `docs/auth/DNX_CROSS_APP_STAGING_VALIDATION.md` (`NEON_API_KEY`).
