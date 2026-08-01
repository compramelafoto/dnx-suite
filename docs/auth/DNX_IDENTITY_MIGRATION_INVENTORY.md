# Inventario de migración de identidades DNX

**Etapa:** 10B.4  
**Nota:** Este inventario describe categorías y procedimiento. El dump cuantitativo por entorno requiere acceso a Staging/Production y **no incluye hashes completos**.

---

## Clasificación

| Clase | Descripción | Acción |
| ----- | ----------- | ------ |
| `UNIQUE` | Email único en la DB de identidad | Mantener |
| `DUP_EXACT` | Mismo email + mismos atributos en dos DBs | Fusionar al canónico de suite |
| `SAME_EMAIL_DIFF_ID` | Mismo email, `User.id` distintos (Clickatón vs suite) | Fusionar con alias |
| `SAME_GOOGLE_DIFF_EMAIL` | Mismo `googleId`, emails distintos | Revisión manual — no auto-merge |
| `EMAIL_UNVERIFIED` | Sin `emailVerifiedAt` | Permitir login; forzar verify en flujos sensibles |
| `PROVIDER_CONFLICT` | `googleId` choca con otro User | Bloquear link; soporte |
| `ORPHAN` | User sin memberships/perfiles/actividad | Revisar; soft-disable |
| `SOCIAL_ONLY` | `password` null + Google | OK |
| `JUDGE_PARALLEL` | Email en `FotorankJudgeAccount` y/o `User` | No fusionar automático |
| `LEGACY_BCRYPT` | Hash bcrypt | Rehash en próximo login |
| `MP_LEGACY_ON_USER` | Tokens en `User.mp*` | Bridge a `DnxPaymentAccount` + vault |

---

## Procedimiento de inventario (Staging)

```bash
# Pseudocódigo — ejecutar solo en Staging con lectura
# SELECT id, lower(trim(email)) AS email_norm, role, googleId IS NOT NULL AS has_google,
#        password IS NOT NULL AS has_password,
#        CASE WHEN password LIKE '$2%' THEN 'bcrypt' WHEN password LIKE '%:%' THEN 'scrypt' ELSE 'unknown' END AS fmt,
#        mpUserId IS NOT NULL AS has_mp_legacy
# FROM "User";
```

Comparar resultados entre:

1. DB suite (CLF / FotoRank / InfoSpot / FotoOffice)
2. DB Clickatón Staging
3. (Opcional) Production Clickatón — solo lectura, sin escritura

---

## Fusión segura

No fusionar casos ambiguos automáticamente.

Para fusiones seguras (`SAME_EMAIL_DIFF_ID` con evidencia):

1. Elegir `User.id` canónico (preferir suite / mayor actividad / con órdenes).
2. Mover perfiles, roles, relaciones, órdenes, álbumes, inscripciones, payment accounts, external identities.
3. Crear alias:

```text
UserIdentityAlias (propuesto)
- oldUserId
- canonicalUserId
- reason
- migratedAt
```

4. Auditar.
5. Desactivar duplicado (`isBlocked` o flag migrated) — **no DELETE inmediato**.

---

## Estado actual del inventario

| Entorno | Estado |
| ------- | ------ |
| Código / schema | Completo |
| Staging suite | Pendiente ejecución de query (requiere credenciales) |
| Staging Clickatón | Pendiente comparación cruzada |
| Production | **No tocar** hasta validar Staging |

**Conflicto infra confirmado sin query:** Clickatón usa Neon propio → riesgo alto de `SAME_EMAIL_DIFF_ID` al consolidar.
