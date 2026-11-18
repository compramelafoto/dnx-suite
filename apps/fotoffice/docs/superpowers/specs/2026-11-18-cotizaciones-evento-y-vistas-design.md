# Cotizaciones: evento y aperturas del cliente (diseño corto)

Fecha: 18/11/2026. Aprobado por Daniel en la conversación.

## Para qué

Giuli, la vendedora de DNX Estudio, trabaja desde Cotizaciones. Hoy no puede ver de qué evento es
cada cotización ni si el cliente la abrió sin entrar a la consulta. Los datos ya están en la base:
la categoría, la fecha, el lugar, los invitados, las horas de cobertura y el mensaje. Las aperturas se
registran en `FotofficePresupuestoVista`.

## Qué se hace

- **Listado de cotizaciones:**
  - Columnas nuevas «Tipo de evento» (la categoría de la consulta) y «Fecha del evento», que se
    puede ordenar.
  - Filtro «Tipo de evento».
  - Debajo del estado, las aperturas del cliente («2 veces · última 17/11»).
  - Todo esto también va a la exportación.
- **Ficha de la cotización:** un recuadro «Evento» arriba de los ítems.
  - Muestra el tipo, la fecha (con la hora, si se conoce), los protagonistas, el lugar, la
    ceremonia, la fiesta, la ciudad, los invitados, las horas, el segundo fotógrafo, la distancia,
    el origen y el mensaje.
  - Sólo aparecen las líneas que tienen dato.
  - Debajo, «¿La vio el cliente?», con cuántas veces la abrió, la primera y la última apertura.
  - Tiene un enlace «Editar en la consulta».
- **Ficha de la consulta:** suma las respuestas del formulario guardadas en `metaJson.porHoras`:
  horas, segundo fotógrafo y distancia.

## Enfoques

1. **Leer siempre de la consulta (elegido).** No hay copia que pueda quedar distinta, y una
   corrección en la consulta se ve enseguida en la cotización.
2. Copiar los datos del evento en la cotización: se descartó porque duplica y se desactualiza.
3. Editar el evento desde la cotización: Daniel pidió verlo, no editarlo. El enlace lleva a la
   consulta.

## Decisiones mías (Claude)

- El tipo de evento es el nombre de la categoría tal como está cargado, y si no hay, el tipo viejo
  de la consulta. Para acortarlo se renombra la categoría.
- Las aperturas cuentan todas las versiones. Las del equipo nunca se registran (`vistas.ts`).

## Sin cambios de base

No hay migraciones. Se lee lo que ya existe.
