# Portal de equipos — dirección visual

Fecha: 27/11/2026. Pedido de Daniel: que comprar y vender se sienta **seguro y confiable**; diseño de todas las pantallas.
Lo propone Claude (Daniel delegó las decisiones: «avanzá sin pedir autorización»).

## Idea

El portal no es una vidriera de ofertas: es un **registro de procedencia**, como el título de un auto o el informe de un
taller. Cada equipo tiene papeles. El lenguaje visual sale del mundo del fotógrafo:

- **La carta gris del 18 %** como fondo neutro: el gris que todo fotógrafo conoce como referencia honesta.
- **La placa de serie grabada** para mostrar números de serie (enmascarados) y datos comprobados.
- **El indicador de exposición del visor** (`−2 ·· −1 ·· 0 ·· +1 ·· +2`) como medidor del **nivel de confianza**: la
  única pieza llamativa del sistema. Todo lo demás es sobrio.

## Tokens

| Nombre | Valor | Uso |
|---|---|---|
| `--gris-carta` | `#E9ECEB` | fondo de página |
| `--papel` | `#FFFFFF` | superficies (fichas, formularios) |
| `--grafito` | `#1E2A30` | texto principal, encabezado |
| `--grafito-suave` | `#55636B` | texto secundario, lo «declarado» |
| `--comprobado` | `#0F6B5A` | marcas de lo comprobado por el portal, botón principal |
| `--revision` | `#A86412` | «en revisión», «no verificada» |
| `--alerta` | `#B42318` | denuncia activa, errores |
| `--linea` | `#C9D0CE` | bordes |

Contraste: texto sobre `--papel` y `--gris-carta` ≥ 4.5:1 (grafito y grafito-suave lo cumplen). Modo oscuro: no en esta
etapa (el portal es de uso diurno y documental).

**Tipografía** (local con `next/font/local`, archivos woff2 latinos de Fontsource en `app/_fonts`, nunca
`next/font/google`):

- **Archivo** (400, 600, 700) para todo el texto: grotesca sólida, de manual técnico.
- **IBM Plex Mono** (500) **sólo** para números de serie y cantidades leídas de metadatos — es lo que va grabado en el
  equipo; no se usa para etiquetas ni adornos.
- Escala: 15/16 px cuerpo con interlineado 1.55; títulos 22, 28 y 36 px, peso 700, interletrado −0,01 em. Sin
  mayúsculas sostenidas en etiquetas. Líneas de lectura ≤ 72 caracteres.

**Formas:** radio 4 px en campos y botones, 8 px en fichas, sellos en forma de píldora. Sin sombras de tarjeta: las
superficies se separan con `--linea`. Sin degradés.

## Piezas comunes (`apps/equipos/app/_ui/`)

| Pieza | Qué muestra |
|---|---|
| `Encabezado` | marca provisoria «Equipos verificados», enlaces Ver equipos · Mi equipo · Mis publicaciones · Consultar serie · cuenta |
| `Pagina` | contenedor con título, bajada opcional y ancho de lectura (`angosta` 640 px para formularios, `ancha` 1080 px) |
| `Boton` | principal (fondo `--comprobado`), secundario (borde), peligro (`--alerta`); texto = la acción exacta |
| `Campo` | etiqueta, ayuda y error debajo del control; error con `role="alert"` |
| `Aviso` | éxito, revisión y error, con ícono y texto; nunca se disculpa |
| `SelloIdentidad` | píldora «Identidad verificada» con marca ✔ en `--comprobado` |
| `PlacaSerie` | serie enmascarada en Plex Mono sobre un rectángulo con borde doble, como una placa grabada |
| `MedidorConfianza` | el indicador de exposición: cuatro tramos Básico · Bueno · Alto · Máximo, con el tramo actual marcado y el nombre del nivel al lado; accesible con `role="meter"` y texto |
| `FichaConfianza` | dos listas: «Comprobado por el portal» (✔, `--comprobado`) y «Declarado por el vendedor» (□, `--grafito-suave`), más la línea de disparos |
| `EstadoPublicacion` | píldora por estado (publicada, en revisión, pausada, vendida, cerrada) |
| `GuiaCompraSegura` | recuadro lateral con el texto fijo del plan |

## Pantallas

- **Catálogo** (`/equipos`): filtros en una columna a la izquierda (arriba en el celular); resultados en filas anchas,
  no tarjetas iguales: foto, modelo en grande, precio, zona, medidor de confianza chico y sello de identidad.
- **Ficha** (`/equipos/[id]`): a la izquierda fotos, precio, descripción, estado e incluye; a la derecha, fija al
  desplazarse, la **ficha de confianza** (medidor grande, comprobado/declarado, placa de serie, disparos) y debajo el
  botón «Contactar al vendedor» y la guía de compra segura. En el celular la ficha de confianza va después del precio.
- **Formularios** (registro, verificación, publicar): una columna angosta, pasos numerados sólo donde son una secuencia
  real (verificación: correo → teléfono → identidad).
- **Mi equipo e informe:** listas con estado, sin adornos; el informe se ve como un documento.
- **Inicio** (`/`): lo primero es la promesa en una línea («Equipos usados de fotógrafos con identidad verificada») y un
  buscador del catálogo; debajo, tres caminos: comprar, vender, consultar una serie.

## Principios

1. Lo comprobado y lo declarado nunca se ven igual.
2. El medidor de confianza es la única pieza llamativa; el resto se calla.
3. Texto en voz activa, en español rioplatense, sin vender: describir qué es y qué hace.
4. Responsive hasta 360 px, foco de teclado visible, `prefers-reduced-motion` respetado, sin animaciones de entrada.
