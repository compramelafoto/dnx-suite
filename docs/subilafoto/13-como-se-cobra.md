# Cómo se cobra

Aclarado por el titular el 2026-09-15. **Reemplaza lo que decía el documento
maestro sobre el adicional de descarga**, que planteaba un único modo de venta.

## Las dos formas de vender

El fotógrafo elige cuál usar compartiendo uno de dos enlaces.

| | Sin descarga | Con descarga |
|---|---|---|
| Enlace | `/v/[slug]` | `/v/[slug]?descarga=si` |
| Paga el cliente | El precio del fotógrafo | Su precio **+ 10%** |
| Cobra el fotógrafo | 85% de su precio | **85% de su precio** |
| Cobra la plataforma | 15% | 15% + el 10% del recargo |
| La descarga | Se la vendemos nosotros después, por correo | Va incluida, y se entrega sola dentro de las 24 horas |

Sobre una venta de $100.000:

- **Sin descarga:** el cliente paga $100.000, el fotógrafo cobra $85.000 y la
  plataforma $15.000.
- **Con descarga:** el cliente paga $110.000, el fotógrafo cobra $85.000 y la
  plataforma $25.000.

## La propiedad que importa

**El fotógrafo cobra lo mismo de las dos maneras.**

No es un detalle: es lo que hace que pueda elegir por lo que le conviene a su
cliente y no por lo que le conviene a él. Incluir la descarga no le quita nada,
sólo le ahorra al cliente una segunda compra.

Hay un test que lo fija. Si algún día deja de valer, alguien va a elegir mal por
la razón equivocada.

## El precio de la descarga lo pone la plataforma

`RECARGO_DE_DESCARGA_BPS = 1000`, en `lib/pagos/venta.ts`. **No es configurable
por vendedor** y es a propósito: el ingreso de la descarga es 100% nuestro, así
que dejar que lo fije el vendedor sería dejar que fije nuestro precio.

Es el mismo número en las dos situaciones —incluida o vendida después— porque es
el mismo producto. Cobrar distinto según cuándo se compra sería difícil de
explicar y fácil de discutir.

Los campos `downloadMode`, `downloadPercentBps` y `downloadPriceCents` del perfil
del vendedor **quedaron sin uso** con este cambio. No se borran todavía por si
alguna vez hace falta un precio por vendedor, pero hoy no los lee nadie.

## Todo se borra a los 30 días

Sin excepción, y también para la descarga: pasada la retención no se vende más.
Cobrar después sería cobrar por algo que ya no existe, y el borrado es una regla
del almacenamiento que no se deshace pagando.

Lo que el cliente **ya descargó** es suyo y no lo alcanza el borrado. Lo que se
borra es lo que queda en la plataforma.

## Lo que falta para que esto entregue algo

La venta con descarga marca el evento como comprado al momento de pagar. Falta
lo que viene después: armar el paquete y mandarlo. Es el ZIP con manifiesto
(3.5), el enlace firmado y revocable (3.6) y los correos (3.7).

Y falta lo otro que dijo el titular: **venderle la descarga por correo a quien
compró sin ella**. Es una secuencia de correos, no una pantalla.
