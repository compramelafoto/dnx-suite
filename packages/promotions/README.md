# `@repo/promotions`

Motor transversal de códigos promocionales DNX.

## Uso previsto

| App | Plataforma (`platform`) | Scope tipico |
|---|---|---|
| Clickatón | `CLICKATON` | `editionId` |
| FotoRank | `FOTORANK` | contest / org |
| Comprame La Foto | `COMPRAMELAFOTO` | álbum / evento |
| FotoOffice | `FOTOFFICE` | — |
| InfoSpot | `INFOSPOT` | — |

## MVP

- `PERCENTAGE` / `FIXED_AMOUNT`
- Vigencia, compra mínima, tope de descuento
- Límites total y por usuario
- Filtro por `platform` + `editionId` opcional
- Preview sin consumir
- Redención idempotente (`idempotencyKey`)
- Cálculo solo en backend (nunca confiar en el cliente)

## Persistencia

Tablas Prisma: `DnxPromotion`, `DnxPromotionRedemption` en `@repo/db`.

El paquete es **puro** (sin Prisma). Cada app provee un adapter de lectura/escritura.

## Códigos de prueba (no producción)

No se siembran automáticamente. Fixtures de test en Clickatón / selfchecks pueden usar `CLICKATON50` / `BIENVENIDA5000` solo en entornos TEST.
