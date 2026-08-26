# DNX Partners — Assets de marca y materiales

Fuente de cierre: [`PARTNERS_STAGE_01_IMPLEMENTATION_02_RESULT.md`](./PARTNERS_STAGE_01_IMPLEMENTATION_02_RESULT.md).

## Identidad vs participación

- **Identidad** (`DnxPartnerAsset`): permanente al partner; no se duplica por plataforma.
- **Participación** (`DnxPartnerParticipationAsset`): piezas de una participación concreta (edición, beneficio, premio, canal).

## Canales / tipos / propósitos

Enums canónicos en Prisma y `@repo/partners` (`DNX_PARTNER_MATERIAL_*`, `DNX_PARTNER_BRAND_ASSET_TYPES`). Aplicaciones: reutiliza `DnxPartnerApplication` (no segundo enum).
