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
| `CLICKATON_HOME_WELCOME` | Activación destacada (home) | PLATFORM | ALL_USERS | SALE | Montado |
| `CLF_ALBUM_WELCOME` | Activación destacada (álbum) | PLATFORM | EVENT_PARTICIPANTS | SALE | Montado |
| `CLF_CHECKOUT_SUPPORTING` | Checkout supporting | PLATFORM | PRODUCT_PURCHASERS | SALE | Declarado |
| `CLF_EVENT_PAGE` | Página evento/álbum | PLATFORM | EVENT_PARTICIPANTS | SALE | Declarado |
| `CLF_GALLERY_INLINE` | Galería inline | PLATFORM | EVENT_PARTICIPANTS | SALE | Declarado |
| `CLF_GALLERY_TOP` | Galería top | PLATFORM | EVENT_PARTICIPANTS | SALE | Declarado |
| `CLF_HOME_PROMO` | Home promo | PLATFORM | ALL_USERS | SALE | Montado |
| `CLF_HOME_WELCOME` | Activación destacada (home) | PLATFORM | ALL_USERS | SALE | Montado |
| `CLF_LOGO_MARQUEE` | Logo marquee | PLATFORM | ALL_USERS | SALE | Montado |
| `CLF_PHOTO_DETAIL_BELOW` | Detalle foto | PLATFORM | EVENT_PARTICIPANTS | SALE | Declarado |
| `FOTOFFICE_BENEFITS_MARQUEE` | Franja de logos (beneficios) | WORKSPACE | MEMBERSHIP_HOLDERS | EXCHANGE | Declarado |
| `FOTOFFICE_BENEFIT_CARD` | Ficha del beneficio | WORKSPACE | MEMBERSHIP_HOLDERS | EXCHANGE | Declarado |
| `FOTOFFICE_PORTAL_BANNER` | Banner del portal del socio | WORKSPACE | MEMBERSHIP_HOLDERS | SALE | Declarado |
| `FOTOFFICE_PUBLIC_MARQUEE` | Franja de logos (sitio público) | WORKSPACE | ALL_USERS | SALE | Declarado |
| `FOTOFFICE_RAFFLE_SPONSOR` | Auspicio del sorteo mensual | WORKSPACE | MEMBERSHIP_HOLDERS | BOTH | Declarado |
| `FOTORANK_CONTEST_WELCOME` | Activación destacada (concurso) | ORGANIZER | EVENT_PARTICIPANTS | SALE | Montado |
| `FOTORANK_HOME_WELCOME` | Activación destacada (home) | PLATFORM | ALL_USERS | SALE | Montado |
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

Once espacios del catálogo no tienen una sola referencia en el código que los
renderice —los tres de artículo de InfoSpot, el flotante, la galería y la página
de evento; y de ComprameLaFoto la galería, el detalle de foto, la página de
evento y el checkout— y los cinco de FotoOffice todavía no existen.

No se borran: varios son intención real de producto. Quedan marcados para que
`listSellableSpaces` no los ofrezca, que es lo que impide prometerle a una marca
un lugar donde su logo nunca aparecería.

## FotoOffice y las activaciones destacadas

El espacio del portal del socio es un **banner dentro de la página, no un modal**.
FotoOffice está excluido a propósito de las activaciones destacadas
(`WELCOME_ACTIVATION_EXCLUDED_APPLICATIONS` en `welcome-activation.ts`): al socio
que entra a pagar la cuota no se lo recibe con un interstitial.

## Quién vende qué

```ts
listSellableSpaces({ owner: "ORGANIZER", application: "FOTO_RANK" })
// → solo FOTORANK_CONTEST_WELCOME. La portada es de la plataforma.
```

## Diseño

`docs/superpowers/specs/2026-08-27-mapa-inventario-partners-design.md`
