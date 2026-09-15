# Accesibilidad del flujo del invitado

*Etapa 4. Auditoría del 2026-09-15.*

El invitado no es un usuario cualquiera: está parado, con una mano, en un salón oscuro,
con el brillo bajo y el wifi saturado. Todo lo que acá se llama accesibilidad es, antes que
eso, que la pantalla funcione en ese lugar.

## Contraste: pasa, y con margen

Las seis plantillas ya tenían test de contraste a opacidad completa. Faltaba lo que se ve
de verdad: **`opacity` no baja "un poquito" el contraste, mezcla el color con el fondo**.
Un texto que pasaba con holgura puede quedar abajo del mínimo.

Se midió cada plantilla en las cuatro opacidades que usan las pantallas (0.62, 0.7, 0.78 y
0.8), calculando el color mezclado:

| Plantilla | 100% | 78% | 70% | 62% |
|---|---|---|---|---|
| Jardín de noche | 13.90 | 8.95 | 7.49 | 6.17 |
| Luces | 19.29 | 11.74 | 9.55 | 7.69 |
| Velitas | 16.02 | 10.10 | 8.33 | 6.81 |
| Señalética | 13.18 | 8.63 | 7.22 | 6.00 |
| Pizarrón | 10.91 | 7.32 | 6.22 | **5.21** |
| Sin tema | 16.67 | 10.51 | 8.68 | 7.07 |

El mínimo de WCAG AA para texto normal es **4.5**. El peor caso —Pizarrón al 62%— da 5.21.
Pasa con margen, y ahora hay un test que lo vuelve a medir si alguien cambia un color o
sube una opacidad.

## Tamaños de toque: había dos enlaces chicos

`Ver las fotos del evento` en la puerta del invitado y `Volver` en el álbum eran enlaces
sueltos de 14 píxeles: unos veinte de alto. Hay que acertarles con el pulgar, parado, en un
salón oscuro.

Con relleno vertical llegan a los **44 píxeles** que pide la guía. No es aire: es el
tamaño de un dedo.

Los enlaces a *términos* y *privacidad* quedaron como están: van adentro de una oración, y
la guía exime explícitamente a los enlaces en línea. Agrandarlos rompería el párrafo.

## Lectores de pantalla: el resumen mentía

El cargador tiene **una sola región viva**, el resumen de arriba. La lista de archivos no
lo es a propósito: con veinte fotos subiendo, anunciar cada cambio sería imposible de
seguir.

El problema es que ese resumen contaba sólo las que salieron bien. Con tres subidas y dos
caídas decía **"3 fotos subidas"** y se quedaba callado. Para alguien que usa un lector de
pantalla eso no era un detalle de redacción: era la única información que recibía, y era
falsa. Para el que ve la pantalla, tampoco: el error estaba en la lista de abajo, en gris.

Ahora dice *"3 fotos subidas. 2 no se pudieron subir: probá de nuevo con esas."*

Tres reglas, con test:

- **Las repetidas cuentan como subidas.** Ya estaban: para el invitado es una foto que
  está, no un problema.
- **Mientras algo sigue en curso no se habla de las que fallaron.** Interrumpir por un
  error que todavía no requiere hacer nada es ruido; cuando termine, el resumen lo dice
  entero.
- **Si fallaron todas no se anuncia un cero.** Dice que no se pudo subir ninguna.

## Lo que ya estaba bien

| Qué | Cómo |
|---|---|
| El selector de archivos | `<input class="sr-only">` con su `<label for>`: el label es el botón grande y el input sigue siendo un input de verdad |
| Los símbolos de estado (✓, !, =) | `aria-hidden`: son decoración, el texto al lado dice lo mismo |
| Foco visible | Contorno de 3 px, y **cambia de color sobre fondo claro** porque el amarillo ahí no se ve |
| Movimiento | `prefers-reduced-motion` apaga la animación del lema y la franja de la portada; la franja pasa a recorrerse a mano |
| Idioma | `lang="es"` en la raíz |
| Textos alternativos | Todas las imágenes tienen `alt`; las decorativas lo llevan vacío, que es lo correcto |
| Botón principal del invitado | 68 px de alto |

## Lo que queda por probar con gente

Lo de arriba se puede verificar leyendo y midiendo. Lo que no:

- VoiceOver en iPhone y TalkBack en Android, recorriendo la puerta y la carga enteras.
- Alguien con el teléfono en una mano y un vaso en la otra.
- La pantalla del salón vista desde la última mesa.
