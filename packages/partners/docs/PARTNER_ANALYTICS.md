# Partner Analytics (ETAPA 09 Imp 01)

## Qué mide

- **Impresión**: creative publicitaria presentada y viewable (≥50% visible ≥1s). No es persona única ni conversión.
- **Click**: `DnxPartnerClickEvent` existente (`/r/[trackingKey]`).
- **CTR** = clicks válidos / impressions válidas × 100 (null si impressions = 0).

Timezone de agregación dashboard: **UTC**.

## Source type (v1)

Solo **CAMPAIGN** impressions. No se inventa campaign para logos institucionales.

## Política institucional (Clickatón / FotoRank)

| Rol | Advertising impression |
|-----|------------------------|
| ORGANIZER / CO_ORGANIZER | **No** (por defecto) |
| SPONSOR / MAIN_SPONSOR / COLLABORATOR | Elegible solo si hay Campaign ad instrumentada |

La visualización pública no cambia.

## Privacy

No se guardan: IP completa, UA crudo, email, userId, fingerprint, geo precisa, cookies cross-site.

## Marquee

Loop infinito duplica nodos DOM; solo `data-loop-copy="0"` + key lógica `campaign:creative:placement` cuentan una impresión.

## Flag

`DNX_PARTNER_IMPRESSION_TRACKING_ENABLED` — ausente = ON; `"false"` = OFF. Independiente del kill switch de ADS.
