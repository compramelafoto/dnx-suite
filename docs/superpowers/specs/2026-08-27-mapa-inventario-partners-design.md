# Mapa de inventario de DNX Partners — diseño

Fecha: 2026-08-27
Estado: aprobado para implementar
Rama de trabajo: `feat/partners-inventory-map` (worktree `dnx-suite-wt-inventario`)

## Problema

El generador de propuestas muestra siempre los mismos nueve espacios porque el
único vendedor previsto era el equipo de Clickatón. En cuanto vende otro —el
organizador de un concurso de FotoRank, o la institución dueña de un workspace de
FotoOffice— la lista tiene que cambiar: nadie puede ofrecer un espacio que no es
suyo.

Falta además una distinción que hoy no está en ningún lado: dentro de un
workspace conviven el sponsor que paga y el aliado que da beneficios a los
socios. No son el mismo trato y no ocupan los mismos espacios.

## Qué ya existe

`AD_PLACEMENT_CATALOG`, en `packages/partners/src/campaigns.ts`, declara **23
espacios** con sus datos técnicos: aplicación, formatos permitidos, dispositivo,
cuántos avisos entran, modo de rotación y si viene encendido por defecto.

Lo que no dice es quién puede venderlos, quién los ve, ni si existen de verdad.

### Los 23 declarados, 12 montados

Auditoría del 2026-08-27: se buscó cada clave en `apps/` y `packages/` excluyendo
el propio catálogo, los tests y `dist/`.

**Montados** (aparecen en el código que renderiza): `INFOSPOT_HOME_WELCOME`,
`INFOSPOT_HOME_TOP`, `INFOSPOT_HOME_INLINE`, `INFOSPOT_HOME_MARQUEE`,
`CLICKATON_HOME_WELCOME`, `CLICKATON_EVENT_WELCOME`, `FOTORANK_HOME_WELCOME`,
`FOTORANK_CONTEST_WELCOME`, `CLF_HOME_WELCOME`, `CLF_ALBUM_WELCOME`,
`CLF_HOME_PROMO`, `CLF_LOGO_MARQUEE`.

**Sin una sola referencia fuera del catálogo** (11): `INFOSPOT_ARTICLE_TOP`,
`INFOSPOT_ARTICLE_INLINE`, `INFOSPOT_ARTICLE_BOTTOM`, `INFOSPOT_EVENT_PAGE`,
`INFOSPOT_GALLERY_INLINE`, `INFOSPOT_FLOATING`, `CLF_GALLERY_TOP`,
`CLF_GALLERY_INLINE`, `CLF_PHOTO_DETAIL_BELOW`, `CLF_EVENT_PAGE`,
`CLF_CHECKOUT_SUPPORTING`.

Conectar el generador al catálogo tal cual está le mostraría a una marca once
lugares donde su logo nunca aparecería. Por eso el mapa necesita la columna
`mounted`.

`FOTO_OFFICE` ya existe en el enum `DnxPartnerApplication` pero no tiene ni un
espacio declarado.

## Qué construimos

Un archivo nuevo, `packages/partners/src/inventory.ts`, que **decora** el
catálogo técnico con las cuatro columnas comerciales que le faltan. No copia la
lista: la deriva de `AD_PLACEMENT_CATALOG`.

| Columna | Qué responde |
|---|---|
| `owner` | Quién tiene derecho a venderlo |
| `audience` | Quién lo ve |
| `mounted` | Si el código lo renderiza hoy |
| `access` | Si se paga, se canjea, o cualquiera de las dos |

### Por qué un archivo aparte y no columnas nuevas en `campaigns.ts`

Son dos preguntas distintas y conviene que las conteste cada una su archivo:
`campaigns.ts` dice **cómo se dibuja** un espacio; `inventory.ts` dice **quién lo
vende**. Además `campaigns.ts` ya es grande y esto lo haría crecer sin necesidad.

El riesgo de dos listas paralelas es que se separen. Se elimina por
construcción: `inventory.ts` recorre `AD_PLACEMENT_CATALOG` y le busca a cada
clave su renglón comercial en una tabla de consulta. Una prueba verifica que la
correspondencia sea exacta en los dos sentidos — ninguna clave del catálogo sin
renglón, ningún renglón sin clave. Agregar un espacio sin decidir quién lo vende
rompe la prueba.

## Tipos

```ts
/** Quién tiene derecho a vender un espacio. */
export type DnxInventoryOwner = "PLATFORM" | "ORGANIZER" | "WORKSPACE";

/** Cómo accede un partner al espacio. */
export type DnxInventoryAccess = "SALE" | "EXCHANGE" | "BOTH";

export type DnxInventorySpace = AdPlacementCatalogEntry & {
  owner: DnxInventoryOwner;
  audience: DnxPartnerAudienceType;
  mounted: boolean;
  access: DnxInventoryAccess;
};

export const DNX_INVENTORY: readonly DnxInventorySpace[];
```

`audience` reutiliza el enum `DnxPartnerAudienceType` que ya está en la base
(`ALL_USERS`, `EVENT_PARTICIPANTS`, `MEMBERSHIP_HOLDERS`, …). No se inventa uno
nuevo.

### `access`: por qué existe

`SALE` es el sponsor que paga. `EXCHANGE` es el aliado que no pone plata y da
descuentos a los socios: su contrapartida es la visibilidad. `BOTH` es el espacio
que admite las dos vías.

El modelo de datos ya distingue los dos tratos —`DnxPartnerContributionType`
separa `MONEY` de `DISCOUNT`, `VOUCHER`, `PROMOTION` e
`INSTITUTIONAL_SUPPORT`— y el módulo `DnxPartnerBenefit` ya sabe entregarle un
beneficio a un socio. Lo que faltaba era atar la contrapartida al espacio: que
al cargar un aliado que da 20% de descuento, el sistema le ofrezca los espacios
de canje y no le intente vender la placa del portal.

## La función que consume el generador

```ts
listSellableSpaces(seller: {
  owner: DnxInventoryOwner;
  application?: DnxPartnerApplication;
  access?: DnxInventoryAccess;
  includeUnmounted?: boolean;
}): readonly DnxInventorySpace[];
```

Reglas:

- `PLATFORM` ve todos los espacios de dueño `PLATFORM`. Es DNX vendiendo la red.
- `ORGANIZER` y `WORKSPACE` ven **solo los de su propio dueño**, y si pasan
  `application`, solo los de esa aplicación.
- Sin `includeUnmounted: true`, lo no montado queda afuera. Es la regla que
  impide prometer espacios que no existen.
- Con `access`, se filtra por vía de acceso: pedir `EXCHANGE` devuelve los de
  `EXCHANGE` y los de `BOTH`; pedir `SALE` devuelve los de `SALE` y los de
  `BOTH`.

El resultado sale ordenado de forma estable —por aplicación y después por clave—
para que la propuesta no cambie de orden entre dos corridas.

## Asignación de dueños

Decidida el 2026-08-27:

| Espacios | Dueño | Motivo |
|---|---|---|
| Todos los de InfoSpot | `PLATFORM` | Es un medio; no tiene organizadores |
| `CLICKATON_HOME_WELCOME` | `PLATFORM` | Portada de la plataforma |
| `CLICKATON_EVENT_WELCOME` | `PLATFORM` | El equipo Clickatón organiza sus propias maratones |
| `FOTORANK_HOME_WELCOME` | `PLATFORM` | Portada |
| `FOTORANK_CONTEST_WELCOME` | `ORGANIZER` | El concurso es de otro |
| Todos los de ComprameLaFoto | `PLATFORM` | Hoy no hay vendedor intermedio |
| Los de FotoOffice | `WORKSPACE` | La institución consigue sus propios sponsors |

Las dos filas de FotoRank son el caso que justifica la columna: misma
plataforma, dueños distintos. El código ya lo respeta con banderas separadas por
superficie (`FOTORANK_PARTNER_WELCOME_ENABLED` para el concurso, otra para la
portada); el mapa lo vuelve explícito.

Todos los espacios existentes son `SALE`. El canje aparece recién con FotoOffice.

## Espacios nuevos de FotoOffice

Cinco, todos con dueño `WORKSPACE` y `mounted: false`. Se declaran para que se
vea qué se va a poder vender; construirlos es el subproyecto 2 del portal del
socio, que todavía no empezó.

| Clave | Dónde | Audiencia | Acceso |
|---|---|---|---|
| `FOTOFFICE_PORTAL_WELCOME` | Placa al entrar al portal del socio | `MEMBERSHIP_HOLDERS` | `SALE` |
| `FOTOFFICE_BENEFITS_MARQUEE` | Franja de logos en la pantalla de beneficios | `MEMBERSHIP_HOLDERS` | `EXCHANGE` |
| `FOTOFFICE_BENEFIT_CARD` | La ficha del beneficio: logo, descuento y cómo se usa | `MEMBERSHIP_HOLDERS` | `EXCHANGE` |
| `FOTOFFICE_RAFFLE_SPONSOR` | Auspicio del sorteo mensual | `MEMBERSHIP_HOLDERS` | `BOTH` |
| `FOTOFFICE_PUBLIC_MARQUEE` | Franja en el sitio público del workspace | `ALL_USERS` | `SALE` |

El del sorteo es `BOTH` a propósito: un aliado puede poner el premio en lugar de
pagar. El roadmap del portal lo dice — *«sin sponsors no hay qué sortear»*.

Los cinco entran también a `AD_PLACEMENT_CATALOG` con sus datos técnicos y a un
arreglo nuevo `FOTOFFICE_AD_PLACEMENT_KEYS`, siguiendo el patrón de las otras
cuatro aplicaciones. Todos con `isActiveDefault: false`.

Se verificó que el enum `DnxPartnerPlacement` ya tiene los valores que necesitan
para `trackingPlacement`, así que **no hace falta tocar el esquema**:

| Clave | `trackingPlacement` |
|---|---|
| `FOTOFFICE_PORTAL_WELCOME` | `WELCOME` |
| `FOTOFFICE_BENEFITS_MARQUEE` | `LOGO_MARQUEE` |
| `FOTOFFICE_BENEFIT_CARD` | `BENEFIT` |
| `FOTOFFICE_RAFFLE_SPONSOR` | `SPONSOR_SECTION` |
| `FOTOFFICE_PUBLIC_MARQUEE` | `LOGO_MARQUEE` |

## Declarar no es activar

El mapa vive en el código porque un espacio existe solo si algo lo renderiza:
guardarlo en la base permitiría inventar espacios que ninguna pantalla dibuja.

Qué espacios usa cada workspace y a qué partner le asigna cada uno son **datos**,
no catálogo. Se modelan con participaciones de contexto `ORGANIZATION`, que ya
existe en `DnxPartnerContextType`. Si al implementar resulta que no alcanza, se
frena y se consulta antes de tocar el esquema: **esta entrega no agrega tablas ni
migraciones**.

## Pruebas

En `@repo/partners`, con `node:test`, sin base de datos:

- correspondencia exacta entre `AD_PLACEMENT_CATALOG` y los renglones
  comerciales, en los dos sentidos
- cantidad de espacios montados y no montados, fijada como número exacto, para
  que sumar uno obligue a decidir
- `listSellableSpaces`: un organizador de FotoRank no ve la portada; un workspace
  no ve nada de otra aplicación; DNX ve toda la red
- lo no montado queda afuera salvo pedido explícito
- el filtro por `access` incluye siempre los `BOTH`
- orden estable del resultado

Las 191 pruebas actuales de `@repo/partners` deben seguir pasando. Cada archivo
nuevo de test se agrega a la lista explícita del script `test` en
`packages/partners/package.json`.

## Documentación

`docs/partners/inventario.md` con la tabla completa: espacio, superficie, dueño,
audiencia, acceso y estado. Es la foto que hoy no existe en ningún lado.

## Fuera de alcance

- **Conectar el generador de propuestas.** Vive en `feat/partners-demo-comercial-e2`,
  222 commits atrás de `main`. Traerlo adelante es el paso siguiente.
- **Construir los espacios de FotoOffice.** Se declaran, no se montan.
- **Precios y comisiones.** Diferidos por decisión: ver `$04` en
  `docs/partners/partners-pending-decisions.md`.
- **Reserva de marca entre vendedores.** La regla acordada —una marca con acuerdo
  de red vigente no puede recibir otra oferta de red— necesita persistencia y va
  en su propio diseño.
- **Borrar los 11 espacios no montados.** Quedan marcados, que es distinto de
  eliminarlos: varios son intención real de producto.
