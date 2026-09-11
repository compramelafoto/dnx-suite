# Identidad visual

El manual de marca (versión 1.0, septiembre 2026) y el kit de logos están en
`manual de marca y logos/Kit-de-Marca-Subi-la-Foto/`. Este documento lo traduce a valores
usables en el código.

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

Cuando se cree `apps/subilafoto`, los logos van a `apps/subilafoto/public/brand/`.
