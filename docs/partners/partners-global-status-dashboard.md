# Panel global de estado — DNX Partners (Sponsor Global Etapa 13)

## Arquitectura centralizada

DNX Partners en **Clickatón** es la única fuente de verdad para sponsors, perfiles, logos, gráficas welcome, assets, campañas, creatives, alcances, placements, publicación, aprobación y analytics globales.

**FotoRank**, **InfoSpot** y **ComprameLaFoto** solo:

- consumen snapshots / réplicas locales publicadas;
- muestran estado de integración en pantallas administrativas de **solo lectura**;
- informan errores y advertencias;
- enlazan al administrador central.

**FotoOffice** está **excluido** de Sponsor Global (nota técnica en cada estado: «FotoOffice: Excluido de Sponsor Global.»).

No hay edición bidireccional ni conexión directa de los admins satélite a la base CRM de Clickatón.

## Responsabilidades por plataforma

| Plataforma | Rol |
|---|---|
| Clickatón | CRM + panel `/admin/sponsors/estado-global` (vista de las 4 apps) + sync `DnxPartnerPublicationSync` |
| FotoRank | Página local `/dashboard/sponsors-dnx-partners` (réplica) |
| InfoSpot | Página local `/admin/sponsors-dnx-partners` (réplica) |
| ComprameLaFoto | Página local `/admin/sponsors-dnx-partners` (réplica) |

## Estados de salud (server-side)

Contrato en `@repo/partners` (`global-status.ts`):

| Estado | Significado |
|---|---|
| `HEALTHY` | Schema disponible, consulta OK, flag ON, campañas > 0, sync.failed === 0 |
| `FLAGS_OFF` | Flags ausentes/OFF (efectivo sin impacto público) |
| `NO_CAMPAIGNS` | Datos OK, flags ON, total campañas = 0 (no es fallo de conexión) |
| `SYNC_PENDING` | Hay sync PENDING |
| `SYNC_FAILED` | Hay sync FAILED → advertencia |
| `CONFIGURATION_MISSING` | Tablas / contrato no disponible |
| `UNVERIFIABLE` | Consulta fallida — **nunca** se inventa cero |

Nunca declarar `HEALTHY` sin evidencia completa.

## Permisos

- Clickatón: `requireClickatonAdmin`
- FotoRank: `requireAuth` + `userIsFotorankSuperAdmin` (redirect `/dashboard` si no aplica). Menú **Sponsors — DNX Partners** con `roles: ["super_admin"]`; el layout pasa `isSuperAdmin` real. Un organizador de concurso no obtiene acceso global. El sidebar aún usa `userRoles` con `"admin"` para ítems preexistentes (riesgo histórico: no se usa como guard de esta ruta).
- InfoSpot: `requireInfoSpotAdminAccess`
- ComprameLaFoto: layout `/admin` exige `ADMIN` / `SUPER_ADMIN`

Sin SSO nuevo. El enlace central abre el dominio canónico (`resolveDnxPartnersCentralAdminUrl`). **Prohibido** pasar tokens, emails o credenciales por query string.

## Fuentes de datos

- **Central (Clickatón):** CRM + `DnxPartnerPublicationSync` + eventos de impresión/clic si existen en esa base (`mode: CENTRAL`).
- **Local (FR/IS/CLF):** tablas locales vía `loadPartnerGlobalStatusForLocalApp` (`mode: REPLICA`). Soft-read fail-closed.

Loader: `@repo/db/partners-global-status-loader`.

## Flags informados (solo lectura UI)

Estados: `ON` | `OFF` | `NO_CONFIGURADO` | `UNVERIFIABLE`. Ausente/vacío → `NO_CONFIGURADO`.

- Clickatón: welcome evento, marquee home, marquee evento
- FotoRank: welcome concurso, marquee home, marquee concurso
- InfoSpot: ads generales, welcome home, marquee home (misma env `INFOSPOT_PARTNER_ADS_ENABLED`)
- CLF: ads generales, welcome álbum, marquee existente

La UI **no** modifica variables Vercel.

## Placements mostrados

Focus por app: welcome + marquee según catálogo (`AD_PLACEMENT_CATALOG`). Formatos: `WELCOME_INTERSTITIAL`, `LOGO_MARQUEE`, `OTHER`.

## Analytics

Se muestran impresiones/clics/CTR solo si la consulta local/central los verifica. Si no hay métrica en esa fuente:

> Métrica disponible únicamente en la plataforma de destino.

Sin eventos sintéticos ni escrituras.

## Procedimiento ante sync fallido

1. El panel marca `SYNC_FAILED` y muestra advertencia.
2. No alteran campañas ni publicaciones automáticamente.
3. Revisar en Clickatón → Sponsors → Sincronización / CRM.
4. Reintentar sync desde el flujo central existente.

## Central vs local

**Central:** creación/edición, publicación, analytics globales, panel de las cuatro plataformas.

**Local:** estado de integración, placements conocidos, flags efectivos (presencia), campañas en réplica, última sync verificable (o nota), errores, enlace seguro al admin central.

## Limitaciones (Checkpoint A)

- Código + tests + docs; **sin deploy** automático.
- Sin flags ON, sin campañas nuevas, sin migraciones salvo bloqueo autorizado.
- Stash `03ef80fa…` **no** se aplica.
