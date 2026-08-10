# Instagram Provider — Capability Matrix (17B)

**Derivado de:** `instagram-provider-audit-2026-08-10.md`  
**Implementación:** `apps/fotorank/app/lib/fotorank/public-vote/instagram/capabilities.ts`

| Capacidad | Valor | Evidencia |
|-----------|-------|-----------|
| `canPublishSingleImage` | true | Content Publishing API |
| `canPublishCarousel` | true | Soportado pero no unidad competitiva |
| `canPublishStory` | true | Conditional / TTL |
| `canPublishReel` | true | Conditional |
| `canReadLikeCount` | true | IG Media `like_count` field |
| `canReceiveLikeWebhook` | **false** | Sin webhook like oficial |
| `canReadMetricTimestamp` | **false** | Solo valor actual |
| `canProvideFinalSnapshot` | **false** | No snapshot oficial al cierre |
| `supportsExactCutoff` | **false** | NOT_GUARANTEED |
| `canUseCarouselAsCompetitiveUnit` | **false** | Likes a nivel álbum |
| `metricField` | `like_count` | Campo documentado |
| `cutoffPolicy` | `LAST_VALID_OBSERVATION_BEFORE_CUTOFF` | Única honesta |
| `requiresPolling` | true | Sin webhooks de likes |

## Unidad competitiva Clickatón

- 10 consignas × 3 finalistas = **30 publicaciones IMAGE individuales**
- Mapping 1:1 `publicCode` ↔ `externalMediaId`

## Estados de publicación

`PREPARED` → `APPROVED_FOR_PUBLICATION` → `PUBLISHING` → `PUBLISHED` | `FAILED`

PREPARED ≠ PUBLISHED. Aprobación humana obligatoria.
