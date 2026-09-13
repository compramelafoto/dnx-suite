# Identidad visual

El manual de marca (versión 1.0, septiembre 2026) y el kit de logos están en
[`marca/`](./marca/). Este documento lo traduce a valores usables en el código.

En `marca/` hay **dos PDF con el mismo nombre y contenido distinto**: `kit/Manual-de-Marca-Subi-la-Foto.pdf`
y `Manual-de-Marca-Subi-la-Foto-raiz.pdf`, que venía suelto junto al kit. Los checksums no
coinciden, así que se conservan los dos hasta saber cuál es el bueno.

## Marca

- **Nombre visible:** Subí la Foto — siempre con tilde en "Subí"
- **Promesa:** Todas las miradas de tu evento, en un solo lugar
- **Llamado a la acción:** Escaneá. Subí. Compartí.
- **Personalidad:** cercana, dinámica, confiable, tecnológica y festiva
- **Isotipo:** obturador violeta (pertenencia a DNX) con pictograma amarillo de foto
  ascendente (la acción principal), centro profundo para que se lea en tamaños chicos

## Tokens

```css
:root {
  /* Marca */
  --slf-violeta:        #7C2BFF;  /* identifica el producto */
  --slf-purpura:        #200638;  /* fondos profundos, pantalla del evento */
  --slf-amarillo:       #FFD51F;  /* impulsa la acción: botones, QR, destacados */
  --slf-lila:           #D9B9FF;  /* apoyo, bordes suaves, estados deshabilitados */
  --slf-blanco:         #F8F6FC;  /* fondo cálido, no blanco puro */

  /* Tipografía */
  --slf-font: "Montserrat", system-ui, -apple-system, "Segoe UI", sans-serif;
  /* Bold / ExtraBold para marca y títulos. Regular / Medium para interfaz y textos. */
}
```

Montserrat está en Google Fonts, que es una de las fuentes permitidas por la política de
CSP del monorepo. Cargar sólo los pesos 400, 500 y 800: cada peso extra son kilobytes que
paga el invitado con datos móviles en un salón.

## Contraste: lo que hay que saber antes de maquetar

Verificado contra WCAG. **El amarillo no es un color de texto.**

| Combinación | Ratio | Veredicto |
|---|---:|---|
| Violeta `#7C2BFF` sobre blanco cálido | 5,4:1 | Texto normal ✓ |
| Blanco sobre violeta | 5,4:1 | Texto normal ✓ |
| Amarillo sobre púrpura profundo | 10,9:1 | Excelente ✓ |
| Amarillo sobre violeta | 4,1:1 | **Sólo títulos grandes y botones.** No para texto corrido |
| Amarillo sobre blanco cálido | 1,3:1 | **Ilegible. Nunca** |

Regla práctica: el amarillo vive sobre fondos oscuros. Cuando haga falta un llamado a la
acción sobre fondo claro, va el violeta con texto blanco, no el amarillo.

Esto importa especialmente en la pantalla del evento, que se mira desde el fondo del salón,
y en el flujo del invitado, que se usa con poca luz y a veces con una copa en la mano.

## Aplicación por superficie

| Superficie | Fondo | Acentos |
|---|---|---|
| Pantalla del evento (`/pantalla/[codigo]`) | Púrpura profundo | Amarillo para el QR y la placa de cierre |
| Flujo del invitado (móvil) | Blanco cálido | Botón principal violeta; amarillo sólo en el botón grande de subir sobre fondo oscuro |
| Panel del profesional | Blanco cálido | Violeta. Herramienta de trabajo, sobria |
| Emails | Blanco cálido | Encabezado con logo horizontal |
| Favicon y avatar | — | `subilafoto-icon-*.png` y `subilafoto-avatar-1080.png` |

La marca **no** se tematiza con las plantillas del evento. Las plantillas cambian el aspecto
del evento; Subí la Foto se mantiene reconocible en los bordes.

## Reglas del manual que afectan al código

Del capítulo "Usos incorrectos", las que un desarrollador puede violar sin darse cuenta:

1. **No deformar.** Los logos van con `object-fit: contain`, nunca con ancho y alto fijos
   distintos de su proporción.
2. **No cambiar los colores.** Nada de filtros CSS sobre el logo para "adaptarlo" a un
   fondo: para eso están las variantes monocromáticas y negativas.
3. **No agregar sombras ni contornos.** El isotipo ya tiene volumen propio.
4. **Área de seguridad:** margen mínimo alrededor del logo equivalente a la mitad del
   diámetro del pictograma central.
5. **Tamaños mínimos:** isotipo 24 px, logo horizontal 140 px de ancho.
6. **"Subi" sin tilde no existe** en la marca visible. En identificadores técnicos, rutas y
   nombres de archivo sí se escribe sin tilde (`subilafoto`), porque un tilde en una URL o
   en un nombre de tabla trae problemas.

## Lo que falta del kit

El propio LEEME lo advierte: **los PNG se generaron a partir del isotipo, no hay versión
vectorial maestra.** Antes de imprenta —y para que el logo se vea nítido en la pantalla de
un televisor 4K— hace falta un SVG. No bloquea el desarrollo, pero conviene resolverlo
antes de producir los materiales impresos con el QR del evento.

Los logos ya están copiados en `apps/subilafoto/public/brand/`, que es de donde los toma la
aplicación. `docs/subilafoto/marca/` es el archivo maestro; no se sirve al público.

## El design system: Subí la Foto ya tiene el suyo

**Agregado el 2026-09-12.** Hasta ese día Subí la Foto no estaba registrada en
`@repo/design-system`, el paquete que comparten las otras plataformas. Los
botones se dibujaban a mano con clases de Tailwind, y por eso el de la portada
era una píldora amarilla: se veía bien, pero era de otra familia que el resto de
la suite.

Ahora hay un tema propio, igual que los de CompraMeLaFoto, FotoRank y FOTOFFICE:

```
packages/design-system/src/design-system/themes/subilafoto.ts
```

Es el **único tema de la suite con un fondo de color** en lugar de negro o
blanco: el púrpura `#200638` del manual. El amarillo es el acento y se usa poco
a propósito — en el manual es el color de una sola cosa por pantalla. El violeta
queda como acento secundario.

Contrastes verificados contra el fondo: texto 17,1:1, secundario 10,8:1,
`muted` 6,9:1, acento 12,9:1, borde fuerte 3,4:1 sobre la superficie.

### Los botones

La geometría es la del design system y no se inventa nada: radio de 8 px
(`radius.button`), relleno de 12 × 24, peso 600 y letra de 0,9375 rem. Lo único
propio es el color.

Vive en `apps/subilafoto/lib/boton-dnx.ts` y hay un test que lo amarra a los
tokens del paquete: si alguien cambia el radio del botón de DNX, el test avisa.

**Por qué es una función de estilo y no el componente `Button`:** el `Button` de
`@repo/design-system` es un componente de cliente y necesita su proveedor de
tema. La portada de Subí la Foto se sirve estática y no carga nada de
JavaScript; meter un proveedor para un solo botón sería pagar caro. En el panel,
que ya es dinámico, corresponde usar el `Button` de verdad.

**Un detalle encontrado al medir:** el tamaño mediano del `Button` compartido da
**42,75 px de alto** y el mínimo cómodo para tocar con el dedo es 44. No se tocó
el paquete —lo usan cinco aplicaciones— pero el botón de Subí la Foto fija el
piso en 44, porque se toca en un salón, de noche y con el celular en una mano.
Conviene revisarlo en el paquete alguna vez.

### La tinta sobre el amarillo es `#050505`, no el púrpura

El `Button` del design system elige el color del texto según la luminancia del
fondo: claro → tinta casi negra. El amarillo es claro, así que da `#050505`.

Se respeta esa regla en lugar del púrpura de la marca para que un botón de la
portada y uno del panel no queden con dos tintas distintas. La diferencia entre
`#050505` y `#200638` a ese tamaño no se percibe; la inconsistencia sí.
