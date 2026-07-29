# Reconciliación de identidades — Clickatón → DB compartida

**Estado:** BLOQUEADO — sin connection string origen pullable  
**Fecha:** 2026-07-29

---

## Origen

| Evidencia | Valor |
| --------- | ----- |
| Health vivo | `ep-divine-smoke-av8hmt7s-pooler`, 6 ediciones |
| `vercel env pull` DATABASE_URL | **EMPTY** (Encrypted) |
| Inventario User origen | **No ejecutado** |

## Destino (`ep-round-fog`)

| Evidencia | Valor |
| --------- | ----- |
| Users | 3 seeds `@clf.dnx.test` |
| Admins dnx/rodrigo/tammy | no existen |

## Clasificación esperada (a completar con script)

Cuando exista `CLICKATON_SOURCE_DATABASE_URL`:

```bash
CLICKATON_SOURCE_DATABASE_URL=… \
DNX_IDENTITY_DATABASE_URL=… \
pnpm clickaton:staging:identity-cutover
```

El script emite `map_summary` + `admin_probe` sin hashes.

Resoluciones:

| Código | Significado |
| ------ | ----------- |
| MATCH_EMAIL_VERIFIED | email en destino |
| MATCH_EXTERNAL_IDENTITY | googleId/email OK |
| CREATE_CANONICAL_USER | alta en destino |
| MANUAL_REVIEW | conflicto google/email |
| TECHNICAL_USER / INVALID | excluir auto |

## Admins esperados

| Email | Origen | Destino round-fog | Acción prevista |
| ----- | ------ | ----------------- | --------------- |
| dnxfotografia@gmail.com | ? | ausente | CREATE o MATCH tras import |
| rodrigorincon40@gmail.com | ? | ausente | idem |
| tammytamerph@gmail.com | ? | ausente | idem + check FI (sin OAuth MP) |

**No** asignar `SUPER_ADMIN` global por ser admin Clickatón — solo membership/capability Clickatón.
