# Inventario publicitario de DNX Partners

Qué espacios existen, quién puede venderlos, quién los ve y cuáles están
realmente montados. La tabla se genera desde `packages/partners/src/inventory.ts`;
no se escribe a mano.

## Cómo leerlo

| Columna | Qué dice |
|---|---|
| Dueño | `PLATFORM` (DNX) · `ORGANIZER` (el del concurso) · `WORKSPACE` (la institución) |
| Audiencia | Quién lo ve |
| Acceso | `SALE` se paga · `EXCHANGE` se canjea por beneficios a los socios · `BOTH` las dos |
| Estado | `Montado` = hay código que lo dibuja · `Declarado` = todavía no existe |

## Los espacios

| Clave | Nombre | Dueño | Audiencia | Acceso | Estado |
|---|---|---|---|---|---|
| `CLICKATON_EVENT_WELCOME` | Activación destacada (evento/maratón) | PLATFORM | EVENT_PARTICIPANTS | SALE | Montado |
| `CLICKATON_HOME_MARQUEE` | Franja de logos (home) | PLATFORM | ALL_USERS | SALE | Declarado |
| `CLICKATON_HOME_WELCOME` | Activación destacada (home) | PLATFORM | ALL_USERS | SALE | Declarado |
| `CLF_ALBUM_WELCOME` | Activación destacada (álbum) | PLATFORM | EVENT_PARTICIPANTS | SALE | Montado |
| `CLF_CHECKOUT_SUPPORTING` | Checkout supporting | PLATFORM | PRODUCT_PURCHASERS | SALE | Declarado |
| `CLF_EVENT_PAGE` | Página evento/álbum | PLATFORM | EVENT_PARTICIPANTS | SALE | Declarado |
| `CLF_GALLERY_INLINE` | Galería inline | PLATFORM | EVENT_PARTICIPANTS | SALE | Declarado |
| `CLF_GALLERY_TOP` | Galería top | PLATFORM | EVENT_PARTICIPANTS | SALE | Declarado |
| `CLF_HOME_PROMO` | Home promo | PLATFORM | ALL_USERS | SALE | Montado |
| `CLF_HOME_WELCOME` | Activación destacada (home) | PLATFORM | ALL_USERS | SALE | Declarado |
| `CLF_LOGO_MARQUEE` | Logo marquee | PLATFORM | ALL_USERS | SALE | Montado |
| `CLF_PHOTO_DETAIL_BELOW` | Detalle foto | PLATFORM | EVENT_PARTICIPANTS | SALE | Declarado |
| `FOTOFFICE_BENEFIT_CARD` | Ficha del beneficio | WORKSPACE | MEMBERSHIP_HOLDERS | EXCHANGE | Declarado |
| `FOTOFFICE_PORTAL_MARQUEE` | Slideshow de logos aliados (pie del portal) | WORKSPACE | MEMBERSHIP_HOLDERS | EXCHANGE | Declarado |
| `FOTOFFICE_PORTAL_SPONSORS` | Sponsors y alianzas del portal | WORKSPACE | MEMBERSHIP_HOLDERS | BOTH | Declarado |
| `FOTOFFICE_PORTAL_WELCOME` | Ventana al abrir el portal del socio | WORKSPACE | MEMBERSHIP_HOLDERS | BOTH | Declarado |
| `FOTOFFICE_PUBLIC_MARQUEE` | Franja de logos (sitio público) | WORKSPACE | ALL_USERS | SALE | Declarado |
| `FOTOFFICE_RAFFLE_SPONSOR` | Auspicio del sorteo mensual | WORKSPACE | MEMBERSHIP_HOLDERS | BOTH | Declarado |
| `FOTORANK_CONTEST_WELCOME` | Activación destacada (concurso) | ORGANIZER | EVENT_PARTICIPANTS | SALE | Montado |
| `FOTORANK_HOME_WELCOME` | Activación destacada (home) | PLATFORM | ALL_USERS | SALE | Declarado |
| `INFOSPOT_ARTICLE_BOTTOM` | Artículo bottom | PLATFORM | ALL_USERS | SALE | Declarado |
| `INFOSPOT_ARTICLE_INLINE` | Artículo inline | PLATFORM | ALL_USERS | SALE | Declarado |
| `INFOSPOT_ARTICLE_TOP` | Artículo top | PLATFORM | ALL_USERS | SALE | Declarado |
| `INFOSPOT_EVENT_PAGE` | Página de evento | PLATFORM | EVENT_PARTICIPANTS | SALE | Declarado |
| `INFOSPOT_FLOATING` | Floating (reservado) | PLATFORM | ALL_USERS | SALE | Declarado |
| `INFOSPOT_GALLERY_INLINE` | Galería editorial inline | PLATFORM | ALL_USERS | SALE | Declarado |
| `INFOSPOT_HOME_INLINE` | Home inline | PLATFORM | ALL_USERS | SALE | Montado |
| `INFOSPOT_HOME_MARQUEE` | Home marquee logos | PLATFORM | ALL_USERS | SALE | Montado |
| `INFOSPOT_HOME_TOP` | Home top banner | PLATFORM | ALL_USERS | SALE | Montado |
| `INFOSPOT_HOME_WELCOME` | Activación destacada (home) | PLATFORM | ALL_USERS | SALE | Montado |

## Los declarados y no montados

**Veintiuno declarados contra nueve montados.** Montado significa que una app lo
renderiza: figurar en una lista de configuración de `@repo/partners` no cuenta.

Sin montar quedan los tres espacios de artículo de InfoSpot, el flotante, la
galería y la página de evento; de ComprameLaFoto la galería, el detalle de foto,
la página de evento y el checkout; las tres placas de bienvenida de portada
—Clickatón, FotoRank y ComprameLaFoto—, que `UNMOUNTED_WELCOME_PLACEMENT_KEYS`
en `welcome-admin.ts` ya declaraba sin montar; la franja de logos de la portada
de Clickatón; y los seis de FotoOffice.

Una prueba compara el mapa contra esa lista, para que no vuelvan a divergir.

No se borran: varios son intención real de producto. Quedan marcados para que
`listSellableSpaces` no los ofrezca, que es lo que impide prometerle a una marca
un lugar donde su logo nunca aparecería.

## FotoOffice: adentro y afuera

**Desde afuera nadie publica adentro de un workspace.** No hace falta una regla
aparte: los espacios de FotoOffice tienen dueño `WORKSPACE`, y
`listSellableSpaces({ owner: "PLATFORM" })` nunca los devuelve. Quien vende la
red no ve el portal de una institución.

Hacia afuera sí: el owner de un workspace puede llevar a sus marcas aliadas al
resto de DNX, pagando por esas apariciones. Eso depende de la reserva de marca
entre vendedores, que todavía no está construida.

**La ventana del portal del socio.** FotoOffice era la única aplicación excluida
de las activaciones destacadas. La exclusión se levantó el 2026-08-27 por
decisión de producto: el socio que abre su portal puede ver una ventana con la
publicidad de un aliado. La defensa quedó en las rutas, que es donde corresponde:

| Ruta | Qué pasa |
|---|---|
| `/portal` | Única ruta donde la ventana puede montarse |
| `/portal/cuotas` | Bloqueada: al socio que entra a pagar no se lo interrumpe |
| `/portal/carnet`, `/w/*/asociarse`, `/workspace`, `/admin`, `/api` | Bloqueadas |

De los seis espacios de FotoOffice, **solo la ventana del portal es activación
destacada**. Los otros cinco no admiten el formato ni entran en la allowlist.

Publicar a FotoOffice sigue siendo imposible: no tiene clave de base de
publicación, y sus superficies no están construidas.

## Quién vende qué

```ts
listSellableSpaces({ owner: "ORGANIZER", application: "FOTO_RANK" })
// → solo FOTORANK_CONTEST_WELCOME. La portada es de la plataforma.
```

El generador de propuestas consume esto: `buildProposalPlan` recibe quién vende y
arma el dossier solo con lo que esa persona puede ofrecer. Hoy DNX obtiene 7 de
las 9 piezas —la del concurso es del organizador y la franja de Clickatón todavía
no está montada—, un organizador de FotoRank obtiene 1, y un workspace de
FotoOffice ninguna.

## Diseño

`docs/superpowers/specs/2026-08-27-mapa-inventario-partners-design.md`

## Cupo y reserva

`packages/partners/src/inventory-booking.ts` calcula si un espacio está libre en
un período. La tabla `DnxPartnerInventoryBooking` guarda las ocupaciones.

| Estado | ¿Ocupa? | Cuándo |
|---|---|---|
| `DRAFT` | No | La propuesta se está armando |
| `RESERVED` | Sí, hasta vencer | Se envió y espera respuesta. 10 días corridos |
| `SOLD` | Sí, hasta la fecha de fin | El acuerdo está cerrado |
| `CANCELLED` | No | |

La vigencia es obligatoria: «vendido» sin fecha de fin bloquea para siempre, y es
lo que impediría el sponsor mensual.

El cupo se cuenta numerando el lugar. Cada ocupación toma un `slotIndex`, y una
restricción de exclusión en Postgres impide que dos compartan el mismo lugar en
períodos que se pisan. Es lo que hace que una franja de doce logos admita doce
ocupaciones simultáneas y una placa de bienvenida solo una — y lo que evita que
dos vendedores confirmen el último lugar a la vez, cosa que un control en la
aplicación no puede garantizar.

Diseño: `docs/superpowers/specs/2026-08-27-cupo-y-reserva-de-inventario-design.md`.

### Cómo llega el cupo a la propuesta

`getProposalSpacesAvailability` (en `@repo/db/partners-inventory-bookings`)
devuelve, para un período, qué espacios tienen lugar. `buildProposalPlan` recibe
ese mapa y deja afuera los que no: quedan listados en `plan.unavailable` con la
fecha en que se liberan.

Sin ese mapa el generador no filtra por cupo, que es el comportamiento de
siempre. **Lo que falta para encenderlo es que la propuesta tenga un período**:
hoy no lo pide, y elegir uno por defecto es una decisión comercial —los packs de
plataforma se venden por mes, los de evento por edición—, no algo que convenga
inventar en el código.

### La tarea de vencimiento

`GET /api/cron/expire-inventory-reservations` en Clickatón, cada hora, con el
mismo esquema de autenticación que los demás crons: `Bearer CRON_SECRET` o el
header de Vercel. Cancela las reservas vencidas para liberar el lugar ante la
restricción de la base, que no sabe qué hora es.
