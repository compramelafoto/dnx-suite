# Presupuesto por horas: el bot arma la receta de cualquier evento — diseño

Fecha: 28/10/2026 · Pedido de Daniel Cuart (DNX Estudio) · Estado: borrador para aprobar

## 1. Para qué

Hoy el bot de WhatsApp sólo arma presupuestos de eventos para las categorías que tienen una
**propuesta modelo** cargada y el interruptor "Aprobar por Telegram" encendido (en DNX Estudio:
Boda y XV). Para cualquier otro evento, como un cumpleaños infantil, le pasa el chat a una persona.

Daniel no quiere cargar una receta a mano por cada tipo de evento. En sus palabras, el precio de un
evento sale **de la cantidad de horas**. El bot puede preguntarle las horas al cliente y armar la
receta solo, con reglas fijas del estudio. El precio lo pone ¿Cuánto cobro? con el perfil de precios
que ya existe. Como hoy, una persona aprueba por Telegram antes de que salga.

**Éxito:** un cliente pide presupuesto para un cumpleaños infantil, bautismo, comunión, evento
corporativo o cualquier evento sin propuesta modelo. El bot pregunta lo necesario, a Daniel le llega
a Telegram un presupuesto con un precio razonable para aprobar, y el cliente lo recibe por WhatsApp.

## 2. Reglas del estudio (dichas por Daniel)

| Regla | Valor |
|---|---|
| Lo que define el precio | Las **horas de cobertura** del evento |
| Edición | **2 horas de edición por cada hora de cobertura**, igual para cualquier evento |
| Fotos que rinde (interno) | XV: 2000–3000 fotos; cumpleaños infantil de 3 h: 1500–2000. Referencia ≈ **500–650 fotos por hora**. Sólo para el cálculo interno (`estimatedShots`, desgaste de cámara): **no se le promete al cliente** |
| Fotos que se prometen | **Eventos: mínimo 400 fotos**, aunque después se entreguen 1000 o más. **Sesiones de fotos: mínimo 70 fotos**. Siempre se promete el mínimo, nunca la estimación |
| Sesiones de fotos | **También se cotizan por horas**, con la misma regla de edición y traslado |
| Entrega incluida | **Galería online**, siempre |
| Extras | Impresiones, fotolibro y otros se contratan **después**: el bot los menciona como opcionales y no los cotiza |
| Traslado | Como un Uber: **$15.000 de ida y $15.000 de vuelta cada 10 km** = **$3.000 por km de distancia** (ida + vuelta). **Lo paga el cliente tal cual, sin margen, y no se ve detallado**: va sumado dentro del precio de la cobertura |
| Punto de partida del traslado | La casa de Daniel: **García del Cossio 2050** (se supone Funes; confirmar al configurar) |
| Aprobación | Por Telegram, como el presupuesto automático actual (PR 795): los presupuestos de eventos se aprueban ahí |

## 3. Cómo funciona

1. El cliente pide presupuesto para un evento por WhatsApp.
2. El bot junta: tipo de evento, nombre y apellido, fecha, lugar (dirección o salón y localidad),
   **cuántas horas dura la cobertura** y, si se puede, un correo. Pregunta como mucho una o dos cosas
   por mensaje.
3. `preparar_presupuesto` (herramienta que ya existe) recibe además `horas`.
4. Si la categoría tiene su **propuesta modelo** y el interruptor encendido (XV, Boda): sigue igual
   que hoy, sin cambios.
5. Si no la tiene: se arma el borrador con la **receta por horas**:
   - un concepto "Cobertura fotográfica de *N* horas" con `coverageHours = N`,
     `editingHours = 2 × N`, `travelHours = 0`, `estimatedShots = N × 575` (redondeado);
   - el **traslado** = km × $3.000 (km por calle, ver §4) se suma **al precio final** del renglón de
     cobertura, **sin pasar por el margen del perfil** (no es `directCost`) y **sin renglón propio**:
     el cliente ve un solo precio. El aviso de Telegram sí lo muestra aparte para Daniel ("incluye
     traslado: 12 km, $36.000"). Si no se pudo calcular, no se suma y el aviso lo marca;
   - en la descripción: "Incluye la galería online con un mínimo de *M* fotos editadas" (M = el
     mínimo prometido: 400 en eventos, 70 en sesiones de fotos; ver §2) y una línea
     "Opcionales para después: impresiones y fotolibro".
   - El precio lo calcula ¿Cuánto cobro? con el perfil de precios del estudio, igual que los
     conceptos calculados de una propuesta modelo (sin copiar ni guardar el perfil).
6. Se crea la fila de aprobación y llega el aviso a Telegram como hoy, con el resumen (ítems, horas,
   total, margen) y un dato más: "Armado por horas" y, si aplica, "No se pudo ubicar el lugar: el
   traslado no está sumado".
7. Aprobar / corregir / atenderlo yo: igual que hoy.

**Categoría de la consulta:** el bot intenta asociarla a una categoría existente ("cumpleaños
infantil" → "Cumpleaños Infantil"). Si no encuentra una sola, usa una categoría genérica
"Evento" (se crea una vez si no existe, sin propuesta modelo). Nunca le pasa el chat a una persona
sólo porque el tipo no coincide.

## 4. Distancia

- Se usa el geocodificador que ya tiene FOTOFFICE (`lib/geocode/nominatim.ts`, el mismo de los
  envíos de impresiones) para ubicar el punto de partida y el lugar del evento.
- Km por calle ≈ **línea recta × 1,3**, como en el envío de impresiones.
- El punto de partida se guarda ya ubicado (lat/long) en la configuración: no se geocodifica en
  cada consulta.
- Si el lugar no se puede ubicar (un salón sin dirección, Nominatim caído o más de 200 km), el
  traslado no se suma y el aviso de Telegram lo dice para que Daniel lo corrija antes de aprobar.

## 5. Configuración

En **Configuración → Telegram**, una sección nueva "Presupuesto por horas (eventos sin propuesta
modelo)" con:

- interruptor encendido/apagado (apagado por omisión; en DNX Estudio se enciende al publicar);
- horas de edición por hora de cobertura (2);
- fotos por hora para el cálculo interno (575);
- fotos mínimas prometidas: eventos (400) y sesiones de fotos (70);
- qué categorías son "sesión de fotos" (en DNX Estudio: "Sesión de Fotos"); el resto son eventos;
- costo del traslado por km de distancia, ida y vuelta (3.000);
- dirección de partida (García del Cossio 2050, Funes), con "ubicada en el mapa: sí/no";
- texto de lo que incluye (galería online) y de los opcionales (impresiones, fotolibro).

Se guarda por workspace. Valores de Daniel cargados para DNX Estudio.

## 6. El bot

- La guía y la descripción de `preparar_presupuesto` piden las **horas de cobertura** para todo
  evento. Si el cliente no sabe, el bot pregunta "¿más o menos cuántas horas dura la fiesta?" y,
  si sigue sin saber, la consulta se registra **sin horas** y el aviso de Telegram dice "falta la
  cantidad de horas" (no se inventa un número).
- El bot nunca dice el precio: lo manda el estudio después de aprobar (igual que hoy).
- Puede mencionar que la galería online va incluida y que después se pueden sumar impresiones o un
  fotolibro.
- Ya no pasa a una persona por "ese tipo no tiene presupuesto automático" cuando el presupuesto por
  horas está encendido.

## 7. Fuera de este diseño

- Que la cantidad de invitados cambie el precio.
- Cotizar impresiones o fotolibro dentro del presupuesto inicial.
- Video (si el cliente pide video, se anota en el detalle; la receta es de fotografía).
- Distancia por rutas reales (Google Maps u otro servicio pago).
- Cambiar el flujo de XV y Bodas, que ya tienen propuesta modelo.

## 8. Pruebas

- Cálculo de la receta (puro): 3 h → cobertura 3, edición 6, `estimatedShots` 1725; traslado a
  10 km → $30.000 sumados al precio sin margen y sin renglón propio; el texto promete el mínimo
  (evento: 400; sesión: 70), nunca la estimación.
- Distancia (pura): línea recta × 1,3; más de 200 km o sin coordenadas → sin traslado.
- `preparar_presupuesto` con categoría sin propuesta y presupuesto por horas encendido → borrador
  armado por horas y aviso a Telegram; apagado → como hoy.
- Sin horas → consulta registrada y aviso con "falta la cantidad de horas".
- Prueba real: Daniel pide por WhatsApp un cumpleaños infantil de 3 h en un salón de Funes y
  revisa el aviso de Telegram.

## 9. Decisiones de quien diseña (para que Daniel las revise)

- **WhatsApp y formulario web (decidido por Daniel).** El formulario público de consultas suma la
  pregunta "¿Cuántas horas dura el evento o la sesión?" (número, opcional). Una consulta web de una
  categoría sin propuesta modelo, con el presupuesto por horas encendido, también se arma por horas
  y va a Telegram; la respuesta automática por correo sigue saliendo como hoy. Sin horas, aviso
  "falta la cantidad de horas". El bot **no** le escribe primero al cliente de una consulta web
  (haría falta una plantilla paga de Meta: fuera de este diseño).
- **Sesión en el estudio:** si el lugar es el estudio, no se suma traslado. *(Decisión mía.)*
- **Una categoría con propuesta modelo la usa siempre** cuando la consulta llega por el bot, tenga o
  no el interruptor "Aprobar por Telegram" encendido; la receta por horas es sólo para las que no
  tienen propuesta modelo. Desde el bot, todo pasa por la aprobación de Telegram. *(Decisión mía.)*
- **Sin horas no se arma borrador.** El bot insiste una vez; si el cliente no sabe, la consulta se
  registra y el aviso de Telegram dice "falta la cantidad de horas" con "Abrir consulta" para
  completarlo a mano. *(Decisión mía.)*
- **Dónde se guardan las horas:** en la ficha del evento de la consulta; si hace falta una columna,
  la migración se aplica a mano como siempre en FOTOFFICE. *(Decisión de quien construye.)*
