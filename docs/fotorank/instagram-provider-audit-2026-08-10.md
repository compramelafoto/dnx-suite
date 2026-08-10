# Auditoría Meta/Instagram — FotoRank ETAPA 17B

**Fecha de auditoría:** 2026-08-10  
**Estado:** GATE A completado — implementación mock + adapter  
**Alcance:** Instagram Graph API v21+ / Content Publishing / IG Media

## Fuentes oficiales consultadas

| Tema | URL oficial | Fecha doc (Meta) |
|------|-------------|------------------|
| IG Media object | https://developers.facebook.com/docs/instagram-api/reference/ig-media/ | 2026-06-22 |
| Content Publishing | https://developers.facebook.com/docs/instagram-api/guides/content-publishing/ | 2026-06-30 |
| Instagram API overview | https://developers.facebook.com/docs/instagram-api/ | 2026 |
| Rate limiting | https://developers.facebook.com/docs/graph-api/overview/rate-limiting/ | 2026 |
| Webhooks (Instagram) | https://developers.facebook.com/docs/graph-api/webhooks/getting-started/ | 2026 |
| Permissions reference | https://developers.facebook.com/docs/permissions/reference | 2026 |

## A. Tipos de cuenta

| Tipo | API Graph | Notas |
|------|-----------|-------|
| Personal | **NOT_SUPPORTED** | Requiere Professional (Business/Creator) |
| Creator | **SUPPORTED** | Via Facebook Page linkage |
| Business | **SUPPORTED** | Via Facebook Page linkage |
| Professional | **CONDITIONAL** | Depende de subtipo Business/Creator |

## B. Login flows oficiales (ambos documentados por Meta)

### B1) Instagram API with Instagram Login (Business Login for Instagram)
- Host: `graph.instagram.com`
- Token: Instagram User access token
- Scopes típicos: `instagram_business_basic`, `instagram_business_content_publish`
- No exige Page token en este camino

### B2) Instagram API with Facebook Login
- Host: `graph.facebook.com`
- Token: Facebook User / Page access token
- Scopes típicos: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`
- Requisito: IG Professional vinculada a Facebook Page

**Instagram Basic Display API:** **NOT_SUPPORTED** para publicación + métricas de negocio.

**Elección 17B (producto):** soportar conceptualmente ambos; implementación inicial documentada hacia **Facebook Login / Graph** en adapter mock, con OAuth state/exchange listos para el path oficial configurado por env (`FOTORANK_INSTAGRAM_*`). Live exchange bloqueado sin probe flag.

## C. Permisos requeridos

| Scope | Uso | App Review |
|-------|-----|------------|
| `instagram_basic` | Perfil + media IDs | Advanced Access |
| `instagram_content_publish` | Publicar feed | Advanced Access |
| `instagram_manage_insights` | Métricas / insights | Advanced Access |
| `pages_show_list` | Listar Pages | Standard |
| `pages_read_engagement` | Engagement Page | Advanced Access |

## D–G. App Review / Dev vs Live

- **Development Mode:** tokens de testers/admins; publicaciones visibles solo a roles de app.
- **Live Mode:** Advanced Access + App Review por permiso; Business Verification si aplica.
- **Business Verification:** requerida para ciertos permisos avanzados y límites elevados.

## Publicación (feed)

| Formato | Clasificación | Notas |
|---------|---------------|-------|
| Imagen única | **SUPPORTED** | Container → publish flow oficial |
| Carrusel | **SUPPORTED** | Likes a nivel **álbum**, no por slide |
| Reel | **CONDITIONAL** | Métricas distintas; no usar como unidad competitiva default |
| Story | **CONDITIONAL** | TTL 24h; no apto para ventana de votación larga |

**Decisión Clickatón:** OPCIÓN A — **una publicación por fotografía** (30 posts).  
Carrusel **prohibido** como unidad competitiva 1.º/2.º/3.º.

## Like count

- **Endpoint:** `GET /{ig-media-id}?fields=like_count`
- **Field:** `like_count` (entero; no `total_like_count` ni boosted en lectura simple de media)
- **Permisos:** `instagram_basic` + media ownership
- **Webhooks like:** **NOT_SUPPORTED** — polling obligatorio
- **Ocultamiento:** si likes hidden → field ausente/null → readiness BLOCKED

## Precisión temporal

**Clasificación: NOT_GUARANTEED**

Meta entrega contador **actual** al momento de la lectura. No garantiza snapshot exacto al segundo del cierre (`endsAt`).

**Política elegida:** `LAST_VALID_OBSERVATION_BEFORE_CUTOFF`

## Timestamps

| Campo Meta | Disponible | Mapeo FotoRank |
|------------|------------|----------------|
| Timestamp por like | **NOT_SUPPORTED** | — |
| `timestamp` del media (creación) | Sí | metadata only |
| Valor agregado actual | Sí | `metricValue` |
| Momento de lectura | Implícito | `providerObservedAt` = poll time |
| Métrica en origen | **NOT_SUPPORTED** fiable | `providerMetricTimestamp` = **null** |

## Webhooks

No existe webhook oficial de **nuevo like** / **like_count change** para IG Media feed.  
Webhooks útiles: comentarios, mentions, messaging — **no** para métrica competitiva.

## Polling

| Modo | Intervalo conceptual | Trigger |
|------|---------------------|---------|
| NORMAL | 5–15 min | round OPEN |
| NEAR_CLOSE | 30–60 s | últimos 5 min |
| FINALIZATION | 15–30 s | status CLOSING |

Respetar headers `x-app-usage` / backoff.

## Rate limits

- Platform rate limiting por app + business use case.
- Header JSON: `call_count`, `total_cputime`, `total_time`.
- Throttle ≥75% → backoff; ≥90% → pause.

## Cutoff policy

| Política 17A | Instagram |
|--------------|-----------|
| EXACT_PROVIDER_TIMESTAMP | **NOT_SUPPORTED** |
| LAST_VALID_OBSERVATION_BEFORE_CUTOFF | **ELEGIDA** |
| PROVIDER_FINAL_SNAPSHOT | **NOT_SUPPORTED** |

## Promoted / boosted content

Insights agregados pueden incluir engagement promocionado.  
**Política:** `PAID_PROMOTION_NOT_ALLOWED` durante ventana competitiva.

## Fallback

Sin métrica válida al cierre → `PENDING_FINAL_SNAPSHOT` + mensaje organizador.

## LEGAL/PRIVACY

**LEGAL/PRIVACY REVIEW REQUIRED** antes de activación comercial.
