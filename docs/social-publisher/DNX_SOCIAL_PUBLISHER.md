# DNX Social Publisher (Etapa 9)

**Paquete:** `@repo/social-publisher`  
**Persistencia:** `DnxSocialAccount`, `DnxSocialPublishRequest`, `DnxSocialPublishAttempt`, `DnxSocialPublishLog`  
**Primera integración:** Instagram Graph Content Publishing  
**Default:** dry-run (no publica en producción sin flag explícito)

---

## 1. Principio

Las aplicaciones **nunca** publican directo a Meta/redes.

Flujo:

```
App → PublishRequest (PENDING_APPROVAL)
    → Admin aprueba / programa
    → Worker (cron)
    → Adapter (Instagram / futuros)
    → IDs externos + logs
```

---

## 2. Dominio (`@repo/social-publisher`)

| Concepto | Rol |
|---|---|
| `SocialAccount` | Cuenta conectada + scopes + status |
| `PublishRequest` | Solicitud genérica multi-app |
| `PublishAsset` | Media ya existente (`publicUrl`) — no regenera |
| `PublishTarget` | platform + socialAccountId |
| Engine | create / approve / reject / schedule / cancel / duplicate / processDue |
| Vault | AES-256-GCM (`DNX_SOCIAL_VAULT_MASTER_KEY`) |
| Instagram provider | container → publish → permalink (o dry-run) |

Plataformas tipadas (solo IG implementada): Instagram, Facebook, Threads, LinkedIn, X, TikTok.

---

## 3. Estados

`DRAFT` → `PENDING_APPROVAL` → `APPROVED` | `SCHEDULED` → `PUBLISHING` → `PUBLISHED`

También: `FAILED` (retry), `REJECTED`, `CANCELLED`.

**Aprobar ≠ publicar.** El worker solo toma `APPROVED`/`SCHEDULED` vencidos (o `FAILED` con `nextRetryAt`).

---

## 4. Clickatón

Tras pago PAID (soft-fail):

1. Encola `PublishRequest` idempotente `clickaton:welcome-publish:{registrationId}` en `PENDING_APPROVAL`.
2. Si no hay cuenta IG (`CLICKATON_SOCIAL_ACCOUNT_ID` / grant), deja outbox `CLICKATON_WELCOME_PUBLISH_PENDING`.
3. Al generar la placa, actualiza assets (`publicUrl` PNG) sin cambiar el estado de aprobación.
4. Admin en `/admin/social` aprueba / rechaza / programa / reintenta.
5. Cron `/api/cron/social-publish` cada 5 min.

Publicación real solo si `DNX_SOCIAL_PUBLISHER_LIVE=true` **y** token vault válido **y** asset con URL pública.

---

## 5. Seguridad

- Tokens cifrados en DB (`tokenCiphertext` / `nonce` / `authTag`).
- Descifrado solo en memoria del worker.
- Logs sin secretos ni access tokens.
- Consent `socialPublicationConsent` debe existir en el origen (Clickatón wizard).

---

## 6. Variables

| Env | Uso |
|---|---|
| `DNX_SOCIAL_VAULT_MASTER_KEY` | base64 32 bytes |
| `DNX_SOCIAL_PUBLISHER_LIVE` | `true` solo para Meta real |
| `CLICKATON_SOCIAL_ACCOUNT_ID` | cuenta IG destino (opcional) |
| `CRON_SECRET` | auth cron |

---

## 7. Extensión futura

Carruseles, Reels, Stories, Top 10, sponsors: nuevos `entityType` + templates de caption; mismos `PublishRequest` / worker.

Nuevo adapter = implementar `SocialPublishProvider` y registrarlo en el worker de la app.

---

## 8. Tests

```bash
pnpm --filter @repo/social-publisher test
pnpm --filter clickaton selfcheck:social-publisher
```

---

## 9. Etapa 10 — consignas / timeline

Por defecto **no** publicar texto secreto de consignas. Guard Clickatón: `apps/clickaton/lib/timeline/social-guard.ts`.

- Entity `PROMPT` / `CLICKATON_PROMPT` rechazado por defecto
- Captions de hitos públicos sin título/instrucciones de consigna
- No generar publicación antes de liberación; aprobación + `DNX_SOCIAL_PUBLISHER_LIVE` siguen obligatorios
