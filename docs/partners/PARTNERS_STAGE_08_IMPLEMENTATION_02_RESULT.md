# Partners — ETAPA 08 — IMPLEMENTACIÓN 02 — RESULTADO

Publicador multi-DB + primera activación real de ads (Vicario) en InfoSpot y CLF.

## Resumen

- Fuente admin: Clickatón `/admin/sponsors/[partnerId]/campanas`
- Publisher: `publishPartnerCampaignToApplication(s)` (`@repo/db`)
- Dominio: `@repo/partners` `campaign-publication.ts` (snapshot, contentHash, freshness)
- Sync: `DnxPartnerPublicationSync` + targets `DnxPartnerCampaignTarget`
- Campaña real: Vicario — Nos acompañan (SYNCED InfoSpot + CLF)
- Placements: `INFOSPOT_HOME_MARQUEE`, `CLF_LOGO_MARQUEE`
- Flags: `INFOSPOT_PARTNER_ADS_ENABLED=true`, `CLF_PARTNER_ADS_ENABLED=true`
- Clicks controlados: 0→1 en ambas apps vía `/r/` + UTM

## Deploys (CLI local, sin git SHA en Vercel)

| App | Deployment | Alias |
|-----|------------|-------|
| Clickatón | `dpl_ch94tUwh6tDmqN9gRZBDewbYtcsT` | maratonfotografica.com |
| InfoSpot | `dpl_BJneu18xXwFxp6WzbncfizNaNNbu` | infospot.com.ar |
| CLF | `dpl_6xqTWRscFvrJQeEUiKvSif936ihV` | compramelafoto.dnxsuite.com |

## Migración

`packages/db/prisma/migrations/20260810140000_dnx_partner_publication_sync`

## Nota Imp 03

Cierre git en rama `feat/partners-etapa08-imp03-publisher-git-closure` (ver Imp 03).
Los deploys de Imp 02 se hicieron con `vercel deploy` desde working tree local (sin `gitSource`).
