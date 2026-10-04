# Captación de proveedores

*Implementado el 2026-09-15. Tarea 3.9 del backlog.*

Cada evento es una noche entera de empresas reales trabajando juntas: el salón, el
catering, el DJ, la ambientación. El fotógrafo comparte un enlace, cada uno completa
su ficha en dos minutos, y esas empresas quedan en la base común de DNX.

Con el tiempo eso es una base de proveedores de eventos que no se compró ni se
raspó de ningún lado: la cargaron ellos mismos, con su permiso.

## El criterio que manda

Del backlog, textual: **un salón ya existente se vincula sin crear un duplicado**.

Una base de proveedores con el mismo salón tres veces no sirve para nada, y
limpiarla después cuesta mucho más que no ensuciarla.

## Cómo se decide si ya está

Se comparan cinco identificadores, del más fuerte al más débil, y se guarda de
cada empresa **un solo motivo**: el más fuerte. Si coinciden el CUIT y el nombre,
lo que importa es el CUIT.

| Identificador | ¿Alcanza solo? | Por qué |
|---|---|---|
| CUIT | Sí | Identifica a la empresa ante la AFIP: no hay dos |
| Email | Sí | La misma casilla es la misma empresa |
| Instagram | Sí | Un usuario, una cuenta |
| Dominio del sitio | Sí | Ídem |
| Nombre | **No** | "Catering Norte" puede haber dos en dos provincias |

Todo se compara **normalizado**, porque la base guarda lo que la persona escribió:

- El CUIT, sólo dígitos: `30-71234567-4` y `30712345674` son el mismo.
- El correo, en minúscula.
- Instagram, sin el `@` y sin la dirección: `@SalonLuna`,
  `https://instagram.com/salonluna/` y `salonluna` son el mismo.
- El sitio, sólo el dominio, sin `www` ni ruta.
- El nombre, sin acentos, sin puntuación y **sin la forma societaria**:
  "Salón Luna S.R.L." y "salon luna" son la misma empresa.

Lo de la forma societaria tiene una trampa que costó un test: si el punto se
cambia por espacio antes de comparar, `S.R.L.` queda como tres palabras de una
letra. Primero se pegan las siglas, después se limpia lo demás. Y la forma se saca
sólo si la palabra **entera** es una de ellas: buscarla como texto suelto
convertiría "Sabores" en "bores".

## Qué se hace con lo que se encuentra

| Situación | Qué pasa |
|---|---|
| Ninguna coincidencia | Se crea la empresa como `PROSPECT` |
| Una coincidencia segura | Se vincula a esa. **Es el criterio de la tarea** |
| Sólo coincidencias por nombre | Se crea igual, con los sospechosos anotados en la ficha |
| Dos coincidencias seguras | Se vincula a la más fuerte y las otras quedan anotadas |

Negarle el alta a alguien porque su nombre se parece a otro es peor que un
duplicado que un administrador fusiona después.

## A una empresa que ya está no se le pisa nada

Se completan **sólo los campos vacíos**. Quien llena el formulario en la puerta de
un salón sabe menos de la empresa que quien cargó la ficha con tiempo, y no tiene
por qué borrarle el trabajo. El nombre no se toca nunca: es lo que un administrador
ya decidió que se llama.

## El duplicado dentro del evento lo frena la base

`SubilafotoEventVendor` tiene única la combinación `(eventId, partnerId)`, y el
alta usa `createMany` con `skipDuplicates`. Dos envíos simultáneos del mismo
formulario no crean dos filas: la restricción es lo único que resuelve una carrera,
un `findFirst` antes no.

## Los dos permisos van separados

Uno es para contactarlo por este evento; sin él la ficha no se guarda. El otro es
para recibir oportunidades y novedades, y **puede ser que no**: se guarda tanto el
sí como el no, porque poder demostrar que alguien dijo que no es tan importante
como lo otro.

Ninguno viene marcado. Una casilla marcada de fábrica no es un permiso: es una
casilla que la persona no vio.

Se guardan en `SubilafotoConsent`: `TERMS` para el contacto y `PROMOTIONAL_USE`
para las novedades, con la versión del texto y la huella de la IP. Es una
reutilización de los tipos del consentimiento del invitado; el día que haga falta
distinguirlos, se agrega un tipo propio.

## El enlace

Es un `SubilafotoAccessLink` de tipo `VENDOR`, con token opaco: no lleva el evento
adentro, así que no se puede adivinar el de otro. El evento sale **del token**,
nunca del formulario — si viniera del formulario, cualquiera podría cargarle
proveedores al evento de otro cambiando un campo oculto.

La página se identifica con el evento y con el logo del vendedor, no con el
nuestro: el proveedor lo conoce a él. Alguien que llega desde un QR pegado en la
puerta de un salón necesita saber por qué le piden sus datos.

## Lo que va a quedar corto

La comparación trae hasta 5000 empresas y las compara en memoria. No se puede
hacer en SQL porque las claves se comparan normalizadas y la base guarda el texto
crudo. Hoy la base tiene una empresa, así que es gratis.

El día que se pase, la solución es una columna normalizada con índice, no subir el
número. Mientras tanto, cuando se corta queda anotado en la ficha de la empresa
nueva en vez de fallar en silencio: **un duplicado que se cuela sin que nadie se
entere es peor que un error**.

## Verificado en producción (2026-09-15)

Se creó un evento de prueba con su enlace y se mandó el formulario **dos veces**:

1. "Salón Luna Prueba S.R.L.", CUIT `30-71234567-4`, Instagram `@salonlunaprueba`.
   Respuesta: *"Tu empresa quedó vinculada a este evento."*
2. **Otro nombre** —"Eventos Luna Prueba"— con el **mismo CUIT** escrito distinto
   (`30712345674`, sin guiones). Respuesta: *"Tu empresa ya figuraba en este evento,
   así que completamos lo que faltaba."*

En la base quedó **una** empresa y **una** fila en el evento, no dos. El nombre siguió
siendo el de la primera carga: el segundo envío no lo pisó. Los dos consentimientos
quedaron registrados en los dos envíos, con el "no" a las novedades.

La prueba encontró un agujero que los tests no veían: el formulario pide **WhatsApp** y
no teléfono, así que `DnxPartner.phone` quedaba vacío siempre. En una base de proveedores
el número es lo que más vale. Ahora, si no hay teléfono, se usa el WhatsApp.

Todos los datos de prueba se borraron. La base volvió a tener las mismas filas que antes.

## Dónde se los ve

| Pantalla | Quién la abre |
|---|---|
| Álbum del evento | **Todos los invitados**, por las dos puertas |
| Panel del cliente | Quien contrató |
| Panel del vendedor | El fotógrafo |

En el álbum van **abajo de las fotos**, no arriba: el que lo abre viene a ver las fotos.
Con el sitio enlazado y el Instagram al lado, que es lo que se les prometió cuando
completaron la ficha.

## Enlaces por rubro (2026-09-16)

El capítulo 14.2 pide poder generar un enlace por categoría además del general. Mandarle
al salón uno que ya diga "salón" le ahorra un paso y, sobre todo, **evita que el catering
se anote como fotografía** por elegir mal en una lista de treinta.

El rubro viaja en la **etiqueta del enlace**, no en una columna nueva: es un dato del
enlace y `SubilafotoAccessLink` ya tenía dónde ponerlo.

Tres detalles:

- **Si el enlace trae rubro, el servidor usa ese y no lo que llega del formulario.** No es
  comodidad: el formulario de un enlace por rubro no muestra el selector, así que confiar
  en lo que llega dejaría entrar cualquier cosa escrita a mano.
- **Uno por rubro y por evento.** Generar el mismo dos veces deja dos enlaces vivos y
  después nadie sabe cuál repartió.
- **Un rubro que se saque de la lista no rompe los enlaces ya repartidos**: se comportan
  como el general y el proveedor elige.

El general sigue existiendo y es el que conviene para un grupo de WhatsApp. El de rubro
sirve cuando se le escribe a alguien en particular.

## Lo que falta

- El panel de administración para revisar, corregir y **fusionar** duplicados. Hoy
  quedan anotados en `notes` de la empresa; leerlos es a mano.
- El logo del proveedor. `DnxPartnerAsset` existe y la ficha no lo pide todavía.
