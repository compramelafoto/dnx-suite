# FOTOFFICE: sponsors de la institución sobre DNX Partners

Fecha: 2026-10-06 · Estado: aprobado por Daniel en chat (opción A)

## Problema

FOTOFFICE no tiene módulo de sponsors. Los sponsors de la suite viven en **DNX Partners**
(tablas `DnxPartner*`), en la base de Clickatón, y sólo se administran desde el panel de
Clickatón. FOTOFFICE los lee con el cliente de sólo lectura para las fichas de premio de los
sorteos. Por eso una sociedad (SFPR) no puede dar de alta sus sponsors ni elegir en qué lugar
de su sitio o de su portal aparecen.

El catálogo de espacios publicitarios (`packages/partners/src/campaigns.ts` +
`inventory.ts`) ya declara seis espacios de FOTOFFICE, todos `mounted: false`.

## Decisiones (tomadas con Daniel)

1. **Una sola base de sponsors para toda la suite.** FOTOFFICE escribe en DNX Partners, en la
   base de Clickatón. No se duplican tablas.
2. **Cada sociedad ve sólo los suyos.** Un sponsor "es de SFPR" si tiene una participación de
   FOTOFFICE para su workspace. Para sumar uno que ya existe, el buscador muestra sólo nombre y
   logo; vincularlo crea la participación. Contactos, email y notas de otras plataformas no se
   ven.
3. **La ficha común la puede editar cualquiera que la use.** Nombre, logo, web e Instagram son
   uno solo: si SFPR los cambia, cambia también en Clickatón.
4. **Espacios de esta entrega:** franja de logos del sitio público, sección de sponsors del
   portal, ventana al abrir el portal y logos al pie del portal. Ninguno en el panel de
   administración.
5. **Conexión:** cliente de escritura acotado hacia la base de Clickatón, igual que
   `clickaton-jury-client.ts` de FotoRank. Los logos se suben al bucket `clickaton-media`, en el
   mismo namespace que usa el panel de Clickatón.

## Datos: qué es un sponsor de una institución

Se usan las columnas que ya existen. No hay migración.

`DnxPartnerParticipation` de la institución:

| Campo | Valor |
|---|---|
| `application` | `FOTO_OFFICE` |
| `organizationId` | `workspaceId` |
| `contextType` / `contextId` | `ORGANIZATION` / `workspaceId` |
| `participationType` | `SPONSOR` |
| `status` | `ACTIVE` (desvincular = `ARCHIVED` + `archivedAt`, no se borra) |
| `publicVisibility` | `PUBLIC` |
| `destinationUrl` | enlace propio de la sociedad (opcional; si falta, la web del sponsor) |
| `title` / `description` | texto que la sociedad muestra en el portal |
| `notes` | notas internas de la sociedad |

La consulta "sponsors de la institución" filtra por `application = FOTO_OFFICE`,
`contextType = ORGANIZATION`, `contextId = workspaceId` y `archivedAt` nulo y estado distinto de `ARCHIVED`/`CANCELLED`. Así entra también
la participación que ya existía en producción (Proyecto Design, creada el 06/10 con
`organizationId` nulo); al editarla se completa `organizationId`.

`DnxPartnerInventoryBooking` para ubicar un sponsor en un espacio:

| Campo | Valor |
|---|---|
| `placementKey` | uno de los 4 espacios |
| `contextType` / `contextId` | `ORGANIZATION` / `workspaceId` |
| `partnerId` / `participationId` | el sponsor y su participación en la sociedad |
| `status` | `SOLD` directo. Una sociedad no reserva con vencimiento: asigna. |
| `startsAt` / `endsAt` | medianoche argentina del día de inicio / del día siguiente al de fin |
| `slotIndex` | el primer lugar libre en ese rango, menor que `maxItems` del catálogo |
| `soldByOrganizationId` | `workspaceId` |

La restricción de exclusión de Postgres (`DnxPartnerInventoryBooking_no_overlap`) garantiza que
dos asignaciones no ocupen el mismo lugar a la vez. Quitar una asignación = `CANCELLED`.

Cupos, del catálogo: franjas 12, sección del portal 6, ventana de bienvenida 1.

## Conexión con la base de Clickatón

`packages/db/src/clickaton-partners-client.ts`, variable `CLICKATON_PARTNERS_DATABASE_URL`.
Mismo molde que el cliente del jurado (bloqueo de hosts equivocados, singleton global), pero
además **un proxy que sólo deja usar los modelos `dnxPartner*`**: cualquier otro modelo o SQL
crudo tira error. Sin la variable, FOTOFFICE **no** cae a su propia base para escribir (la base
de FOTOFFICE también tiene tablas `DnxPartner*`, y escribir ahí crearía sponsors fantasma):
el panel queda en modo lectura con un aviso.

Las lecturas siguen la regla actual: cliente de sólo lectura si está, y si no la base propia.

## Logos

`apps/fotoffice/lib/sponsors/logo-storage.ts` sube a `clickaton-media` con la clave
`clickaton/partners/logos/<AAAA-MM-DD>/<uuid>.<ext>` (la misma de
`apps/clickaton/lib/admin/partners/partner-logo-storage.ts`, que el proxy `/api/media` de
Clickatón ya permite). PNG, JPG o WebP hasta 5 MB. Crea un `DnxPartnerAsset` `LOGO_GENERAL`,
`ACTIVE` + `APPROVED`, primario. Variables: `CLICKATON_MEDIA_R2_ENDPOINT`,
`CLICKATON_MEDIA_R2_ACCESS_KEY_ID`, `CLICKATON_MEDIA_R2_SECRET_ACCESS_KEY` y, opcional,
`CLICKATON_MEDIA_R2_BUCKET` (por defecto `clickaton-media`).

La ruta `app/api/sorteos/logo/[assetId]` se generaliza para aceptar también ese namespace (hoy
sólo acepta `partners/<id>/brand/`), y la usan todos los espacios nuevos.

## Pantallas

### Panel: módulo "Sponsors" (`/sponsors`)

Módulo nuevo `sponsors` en `lib/modules/registry.ts` (categoría INSTITUTIONAL), con niveles
VIEW/MANAGE como el resto. Gestionar requiere MANAGE.

- **Lista**: sponsors de la sociedad con logo, nombre y en qué espacios están hoy.
- **Agregar**: buscador en la base común (sólo nombre y logo, mínimo 2 letras). "Vincular" crea
  la participación. Si no aparece, "Crear sponsor nuevo" (nombre obligatorio; web e Instagram
  opcionales; slug único generado).
- **Ficha** (`/sponsors/<partnerId>`): datos comunes editables (nombre, web, Instagram, logo)
  con el aviso "se ve en todas las plataformas"; datos de la sociedad (enlace, título, texto,
  notas internas); **espacios** asignados con alta (espacio + desde + hasta) y baja; botón
  "Desvincular de la sociedad".

### Espacios públicos

Todos leen sólo asignaciones `SOLD` vigentes ahora (hora argentina), de sponsors no archivados,
con participación activa, y muestran el logo por `/api/sorteos/logo/<assetId>`. Si la base de
Clickatón no responde, el espacio no se dibuja y la página sigue.

- `FOTOFFICE_PUBLIC_MARQUEE`: franja de logos en la portada del sitio público
  (`/w/<slug>` y dominio propio), antes del pie.
- `FOTOFFICE_PORTAL_SPONSORS`: sección "Sponsors y alianzas" en el inicio del portal del socio,
  tarjetas con logo, título, texto y enlace.
- `FOTOFFICE_PORTAL_MARQUEE`: franja de logos al pie de todas las páginas del portal.
- `FOTOFFICE_PORTAL_WELCOME`: ventana al entrar al portal; se muestra una vez por sesión del
  navegador (`sessionStorage`), con botón cerrar y enlace.

Los cuatro pasan a `mounted: true` en `packages/partners/src/inventory.ts`.

## Arreglos de paso

- `searchPartners` del formulario de premios devolvía todos los sponsors de la suite con su
  email. Pasa a buscar sólo nombre y logo, en los sponsors de la sociedad primero y en el
  catálogo común después (para poder vincular).
- Los sponsors que ya donaron premios en SFPR (3) se vinculan a SFPR con un script idempotente
  (`apps/fotoffice/scripts/vincular-aliados-de-sorteos.ts`).

## Fuera de alcance

Conteo de vistas y clics, beneficios para socios (`FOTOFFICE_BENEFIT_CARD`), auspicio del
sorteo (`FOTOFFICE_RAFFLE_SPONSOR`), propuestas y cobro.

## Pruebas

- Unidad: elección del lugar libre y armado de fechas; filtro "vigente ahora"; validación del
  logo; proxy del cliente acotado (rechaza modelos ajenos); regex de claves del logo.
- Tipos y build completo de FOTOFFICE (`pnpm --filter fotoffice build`).
- En producción: SFPR, alta de un sponsor, asignación y vista de los cuatro espacios.

## Etapas

1. Conexión + módulo Sponsors (alta, vínculo, edición, logo) + buscador de premios.
2. Asignación a espacios.
3. Los cuatro espacios en el sitio y el portal.

Se entregan en un solo PR si el tamaño lo permite; si no, apilados.
