# Botón de arrepentimiento y Libro de Quejas

*Implementado el 2026-09-15. Textos revisados y aprobados sin cambios el 2026-09-16.*

## Qué exige la norma

La **Resolución 424/2020** de la Secretaría de Comercio Interior obliga a toda tienda que
venda por internet en Argentina a tener:

1. Un enlace **"Botón de arrepentimiento"**, visible en la **primera pantalla de la
   portada**, que lleve **directo** al formulario. No a una página de ayuda ni a un correo.
2. Una **constancia** de la solicitud para quien la hace.
3. Un enlace visible al **Libro de Quejas Online** del Estado.

El derecho de fondo es el **artículo 34 de la Ley 24.240**: diez días corridos para
revocar, sin tener que explicar por qué y sin costo.

No lo tenía ninguna plataforma de la suite. Ahora lo tiene SubiLaFoto.

## Dónde están los enlaces

| Dónde | Por qué |
|---|---|
| Cabecera de la portada | La norma pide que se vea sin bajar |
| Pie de la portada | Donde la gente los busca |
| Dentro del formulario | El Libro de Quejas, como alternativa ante el Estado |

## Dos decisiones que importan

### Nunca se rechaza por el plazo

El artículo da diez días, pero **la solicitud entra siempre**. Decidir automáticamente que
alguien se pasó —con un dato que puede no ser el correcto, escrito de memoria por una
persona que no encuentra el correo de la compra— es negarle un derecho por un problema
nuestro. El plazo lo resuelve una persona mirando el caso.

`dentroDelPlazo` existe y está probada, pero se usa para **informar**, no para filtrar. Sin
fecha de compra devuelve `true`.

### La constancia se puede dictar por teléfono

`AR-` más seis caracteres de un alfabeto sin `I`, `O`, `U`, `0` ni `1`. Alguien la va a
copiar a mano de una pantalla o dictarla, y la diferencia entre `O` y `0` se pierde en los
dos casos.

Se deriva del identificador de la solicitud, no es al azar: **un reintento da el mismo
número** en vez de generar una constancia nueva para el mismo pedido.

## Resolverlas: `/panel/arrepentimientos`

Sólo para usuarios administradores: son solicitudes de toda la plataforma, no de un
vendedor.

### Ordenadas por lo que falta para vencer, no por fecha

La norma da **24 horas para contestar**. Lo que importa no es cuál llegó primero sino cuál
se está por vencer, así que la lista se ordena por eso y cada una dice "Quedan 8 horas" o
"Vencida hace 3 horas" en vez de una fecha.

Las horas se redondean **hacia abajo**: decir "quedan 3" cuando quedan 3 y monedas es
preferible a que alguien crea que tiene una hora más de la que tiene.

### Busca la compra sola

Ese era el único trabajo real de resolver una solicitud, y se hacía abriendo la base. Quien
escribe no tiene el identificador de la orden: tiene su correo y, con suerte, el código del
evento anotado en algún lado.

La pantalla busca por correo, por código de evento y por número de orden, y muestra las
candidatas **diciendo por qué apareció cada una**. Sin eso, una coincidencia por código con
otro correo parece un error del buscador en vez de un dato para mirar con atención.

Son candidatas, no una respuesta: dos personas comparten un correo y los códigos se
escriben mal.

### Hay que escribir qué se hizo

No alcanza con apretar un botón. Dentro de seis meses lo que hace falta saber es **qué se
resolvió**, no que alguien lo marcó. Queda registrado con el correo de quien lo hizo.

Y la condición `status: RECEIVED` va en el `where` del `updateMany`: si dos personas la
resuelven a la vez, la segunda cambia cero filas en vez de pisar lo que escribió la
primera. Lo que se pisaría es el registro de una obligación legal.

### El panel de salud avisa

Una solicitud sin resolver aparece como aviso; pasadas las 24 horas, como **grave**.
Pasado ese plazo no es una demora, es un incumplimiento.

Con vencidas, no se avisa además de las que están en plazo: dos alertas del mismo tema
empujan hacia abajo lo demás sin agregar nada.

## Lo que falta

| Falta | Quién |
|---|---|
| Que la solicitud avise por correo a quien la hizo y al titular | Espera a que estén los correos |

## Quién vende, en el pie de todas las páginas

Cargado el 2026-09-16. Lo piden la Resolución 424/2020 y el artículo 4 de la Ley 24.240:
el consumidor tiene que poder saber **con quién contrató** sin buscarlo.

| | |
|---|---|
| Responsable | Daniel Andrés Cuart |
| CUIT | 20-31973378-8 |
| Domicilio | San José 1672, Local 5, Funes (CP 2132), Santa Fe |

Dice **"Responsable"** y no "Razón social" porque el CUIT empieza con 20: es una persona
física, no una sociedad.

El dígito verificador se comprobó antes de escribirlo. Un CUIT mal tipeado en un pie legal
es peor que no ponerlo: parece cumplimiento y no lo es.

El pie vive en un solo componente —`PieLegal`— y lo usan la portada, las dos páginas
legales y la del arrepentimiento. Repetirlo en cada pantalla garantizaba que alguna quedara
con los datos viejos.

```sql
SELECT receipt, email, reference, status, "createdAt"
FROM "SubilafotoRetractionRequest" ORDER BY "createdAt" DESC;
```
