# InfoSpot — estado local DNX Partners (Etapa 13B.3)

Ruta administrativa de solo lectura: `/admin/sponsors-dnx-partners`.

- Guard: `requireInfoSpotAdminAccess` (Director / SUPER_ADMIN vía `canAccessInfoSpotAdmin`).
- Fuente: `loadPartnerGlobalStatusForLocalApp(prisma, "INFO_SPOT")` modo `REPLICA`.
- Flag real informado: `INFOSPOT_PARTNER_ADS_ENABLED` (welcome y marquee de home). No hay flags separados en este runtime.
- Enlace central: `https://maratonfotografica.com/admin/sponsors/estado-global/infospot`.
- FotoOffice excluido.
