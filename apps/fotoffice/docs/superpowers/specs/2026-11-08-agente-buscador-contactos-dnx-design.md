# Equipo de agentes — pieza 2: base «Contactos DNX» + agente Buscador

Fecha: 08/11/2026 · Pedido de Daniel · Estado: diseño para aprobar

## Por qué

Daniel quiere hacer crecer CompraMeLaFoto (CLF) y las demás plataformas de DNX (FOTOFFICE, InfoSpot,
muestrasfotograficas.com) **sin pagar publicidad**. Los clientes que más le sirven se pueden
identificar uno por uno: fotógrafos de cada nicho, escuelas, clubes, organizadores de eventos,
asociaciones de fotógrafos, negocios de fotografía, empresas de turismo y organizadores de
muestras.

El plan del "equipo de agentes" (ver la spec del Periodista, `2026-11-07-agente-periodista-design.md`)
es una cadena:

- **Buscador:** encuentra contactos y arma la base. Es esta pieza.
- **Vendedor:** los toma caso por caso, les escribe por correo y le pide OK a Daniel por Telegram.
  Es una pieza futura.
- **Muestras y Radar de InfoSpot:** también suman contactos a la misma base. Son piezas futuras.

Esta pieza construye **la base común y el primer agente que la alimenta**. Ningún mensaje sale a
terceros desde esta pieza.

### Qué es éxito para Daniel

- Ver en un solo panel a todos los prospectos del país, separados por tipo, nicho y región.
- Que cada región que se completa tenga fotógrafos **y** organizadores. Así se pueden conectar entre
  sí: a un organizador se le ofrecen fotógrafos de su zona, a un fotógrafo se le acercan eventos de
  su zona, y el Vendedor escribe con ejemplos cercanos.
- Recibir por Telegram un resumen cuando termina cada región, sin tener que aprobar contacto por
  contacto.

## Objetivos

1. **Base «Contactos DNX»**
   - Una sola base de prospectos para todo DNX, en FOTOFFICE, visible sólo para Daniel (super admin).
   - Separada de los clientes del estudio (`Client`).
2. **Ficha por contacto con historial completo**
   - Cómo apareció: qué agente lo encontró, cuándo y de dónde sale cada dato.
   - Cambios de estado y notas a mano.
   - Lugar reservado para los correos enviados y recibidos, que llena el Vendedor más adelante.
3. **Agente Buscador**
   - Recorre el país **por regiones**.
   - Busca todos los tipos de contacto, con énfasis en los nichos **escolar, turístico y deportivo**.
   - Usa **Google Maps (Places API)** y **búsquedas web hechas por Claude**.
4. **Sin duplicados**
   - No carga dos veces al mismo contacto.
   - Marca a los que ya son usuarios de CLF o contactos de FOTOFFICE.
5. **Topes de gasto por mes: USD 20 para Google Maps y USD 30 para Claude**
   - Al acercarse a cualquiera de los dos, el agente frena esa fuente y avisa por Telegram.
6. **Resumen por Telegram** al terminar cada región, por el canal de agentes que ya existe.
7. **Carga inicial con lo que ya se conoce:** los 37 contactos de DNX Estudio con etiqueta
   «Fotógrafo», marcados el 08/11 (ver más abajo).

## Fuera de alcance (piezas siguientes)

- Escribirle a cualquier contacto. Eso es el Vendedor, que se diseña aparte.
- Recibir correos (inbound).
- Agente de Muestras y Radar de InfoSpot. El modelo sí los prevé como fuentes.
- Recomendar fotógrafos cercanos en el bot de WhatsApp.
- Que los contactos se registren en CLF desde un enlace. Por ahora la vinculación «se registró»
  queda prevista en el modelo pero no se automatiza.

## Cosas que serían un fracaso aunque «funcionen»

- **Base sucia**
  - El mismo estudio aparece tres veces.
  - Un usuario de CLF figura como desconocido.
  - Datos personales que nadie publicó para ser contactado (celulares privados, correos sacados de
    comentarios o de listas filtradas).
- **Gasto descontrolado:** la cuenta de Google Cloud **no tiene ningún tope hoy**. Un error de bucle
  no puede convertirse en una factura.
- **Ruido en Telegram:** un mensaje por contacto, o resúmenes que no dicen nada útil.
- **Mezclar con los clientes del estudio:** los prospectos no van a la lista de Contactos de DNX
  Estudio ni se sincronizan con Google Contacts.

## Decisiones de Daniel (08/11)

| Tema | Decisión |
|---|---|
| Qué guarda la base | Contactos de todo tipo en **un mismo panel**, no sólo fotógrafos. Tipos iniciales: fotógrafo, escuela/jardín, club, organizador de eventos, asociación/sociedad de fotógrafos, organizador de muestras, empresa de turismo, negocio de fotografía (foto carnet, laboratorio). Se suman tipos nuevos si aparecen. |
| Nichos de fotógrafo | Escolar, deportiva, turística, social, eventos, foto carnet, corporativa, mascotas/newborn/familia, y los nuevos que aparezcan. Énfasis ahora en **escolar, turístico y deportivo**. |
| Quién escribe | El Buscador **no escribe**. El Vendedor (futuro) toma los contactos **caso por caso**. |
| Historial | Cada contacto tiene ficha con **todo su historial**: origen, mensajes enviados, respuestas, estados. |
| Alcance geográfico | **Todo el país, por regiones**, para ir activando el trabajo región por región. |
| Fuente de mapas | **Google Maps desde el arranque**, con tope de **USD 20 por mes**. |
| Uso de Google Maps (08/11, tras la revisión) | **Sólo para descubrir** negocios. Los datos de contacto se sacan de la web o las redes del propio negocio, con esa página como fuente. Ver «Google Places». |
| Tope de Claude | **USD 30 por mes**. Al llegar, el agente se pausa hasta el mes siguiente y avisa por Telegram. |
| Avisos | Resumen por Telegram cuando termina cada región; nada de aprobar contacto por contacto. |

## Decisiones mías (Claude), que Daniel puede cambiar

- El panel vive en FOTOFFICE como página de super admin. Ahí ya están el canal de Telegram de
  agentes, `/admin/agentes` y la cola de propuestas.
- **Orden de regiones**, que se puede cambiar desde el panel:
  1. **Centro** (Santa Fe, Córdoba, Entre Ríos), donde ya hay clientes, SFPR y contactos.
  2. Buenos Aires y AMBA.
  3. Cuyo.
  4. NOA.
  5. NEA.
  6. Patagonia.
- Nombre del panel: **«Contactos DNX»**.
- Estados del contacto:
  - `NUEVO`: lo encontró un agente.
  - `REVISADO`: Daniel lo miró o lo editó.
  - `CONTACTADO`, `RESPONDIO`, `SE_SUMO`, `NO_INTERESA`: los usa el Vendedor.
  - `DESCARTADO`: no sirve, por ejemplo cerró o no es del rubro.
  - `NO_CONTACTAR`: pidió que no le escriban. Es permanente.
- **Una región puede durar más de un mes** si se llega a un tope. Dentro de cada región se trabaja
  primero con los nichos escolar, turístico y deportivo y sus contrapartes.
- **Si Maps se frena** (tope o falta de clave), sus tareas quedan `PENDIENTE` y se retoman el mes
  siguiente. La región sigue avanzando con la búsqueda web y se cierra **sólo cuando terminan las dos
  fuentes**. La región siguiente no arranca mientras tanto.
- **«Ya está en CLF»** sólo cuenta para usuarios de CLF con rol de fotógrafo, organizador o escuela.
  Un comprador (`CUSTOMER`) no cuenta como ya registrado; si coincide, se anota en la ficha como dato
  informativo («compró en CLF»), sin cambiar el vínculo.

## Contexto que ya existe

- **Canal de Telegram de agentes**
  - Archivos: `lib/agentes/canal.ts`, `canal-reglas.ts`, `webhook-agentes.ts`.
  - Bot con token `TELEGRAM_AGENTES_BOT_TOKEN`.
  - El chat de Daniel está vinculado en `SystemSettings` con la clave `fotoffice_agentes_telegram`.
- **Cola de propuestas:** `FotofficeAgentePropuesta`, pensada para cosas que Daniel aprueba. El
  Buscador no la necesita para los contactos, porque no se aprueban uno por uno.
- **Patrón de cron:** `app/api/cron/agente-periodista/route.ts`, con GET→POST e
  `isAuthorizedCronRequest`.
- **Claude**
  - Cliente en `lib/agentes/periodista/redactor.ts`, que usa `@repo/dnx-bot` con Anthropic.
  - Modelo `claude-sonnet-5-5`, herramienta `web_search_20260209`, manejo de `pause_turn` y salida
    JSON validada con zod.
  - El cálculo de costo por corrida está en `lib/agentes/periodista/costo.ts`.
- **Página `/admin/agentes`:** conectar el bot, vincular el chat, «Correr ahora» y gasto del mes.
- **Base de FOTOFFICE**
  - Proyecto Neon `divine-hall-10689679`, rama `development` (`br-old-rain-adwthzng`). Es la base de
    producción de FOTOFFICE.
  - Las migraciones se escriben a mano y se registran en `_prisma_migrations` con su sha256 (ver
    memoria del proyecto).
- **CLF vive en otra base**
  - Es el mismo proyecto Neon pero la rama `production` (`br-autumn-rain-ad18wq7y`), con su propia
    tabla `User` (~800 usuarios).
  - FOTOFFICE **no puede consultarla directamente**.
  - Ya existe una API entre plataformas, `GET /api/public/album/[slug|id]/resumen` en CLF (conexión
    FOTOFFICE↔CLF, etapa 1), pero es **pública y sin secreto**. La ruta protegida que necesita esta
    pieza es trabajo nuevo.
- **Google Cloud**
  - La facturación está reabierta desde el 12/09/2026: cuenta `01E0EB-C76321-DB0EB0`, de
    `compramelafoto@gmail.com`.
  - Proyectos con facturación: `compramelafoto-auth` y `level-array-485500-g6`. `fotoffice-auth`
    **no está vinculado a facturación**.
  - **No hay ningún tope de gasto.**
  - InfoSpot ya tiene un proveedor de geolocalización: `apps/infospot/lib/geolocation/providers/`.
- **Contactos ya clasificados el 08/11** en DNX Estudio (`Client` de FOTOFFICE)
  - **37 fotógrafos** con la etiqueta `Fotógrafo`: alumnos de cursos, pedidos de impresiones y
    producción de contenido.
  - **132 proveedores de eventos** con categoría `PROVEEDOR` y etiquetas `Proveedor de eventos` /
    `Rubro: …`.
  - Los proveedores **no** entran a Contactos DNX en esta pieza. Son proveedores del estudio, no
    prospectos de las plataformas.
  - Los fotógrafos **sí** entran, como `CONOCIDO` (ver «Carga inicial»).

## Cómo funciona (para Daniel)

1. Desde **Contactos DNX** elegís la región en curso. Por omisión es Centro.
2. El Buscador trabaja solo, en tandas a lo largo del día. Para cada ciudad de la región busca cada
   tipo de contacto:
   - **en Google Maps**, para negocios con dirección, teléfono, web y reseñas;
   - **con búsquedas en internet**, para fotógrafos que sólo tienen Instagram o web, listados de
     asociaciones, clubes y escuelas.
3. Antes de sumar a alguien revisa que no esté repetido y si ya es usuario de CLF o contacto del
   estudio.
4. Guarda sólo datos comerciales publicados (nombre, ciudad, web, redes, email y teléfono de
   contacto) y de dónde salió cada uno.
5. Cuando termina la región te llega por Telegram un resumen, por ejemplo: «Región Centro lista: 412
   contactos nuevos — 180 fotógrafos (62 escolares, 41 deportivos, 23 turísticos…), 95 escuelas, 40
   clubes… Gasto Google: USD 6,10».
6. Si el gasto de Google del mes llega a USD 18, o el de Claude a USD 28, frena esa parte y te
   avisa. Retoma el mes siguiente, o antes si subís el tope desde el panel.
7. En el panel ves la lista con filtros y la ficha de cada uno con su historial. Podés corregir
   datos, cambiar el estado, agregar notas o marcar «no contactar».

## Diseño técnico

### Modelo de datos (tablas nuevas en la base de FOTOFFICE)

Los nombres son orientativos; el que construye puede ajustarlos. Todas las tablas son globales de DNX:
no van por workspace, porque es una base de super admin. Si conviene atarla al workspace de DNX
Estudio por consistencia con el resto de `Fotoffice*`, es decisión del que construye, pero **no** se
mezcla con `Client`.

**`DnxContacto`**: el contacto (persona o negocio).

| Campo | Contenido |
|---|---|
| `id` | |
| `tipo` | `FOTOGRAFO`, `ESCUELA`, `CLUB`, `ORGANIZADOR_EVENTOS`, `ASOCIACION_FOTOGRAFOS`, `ORGANIZADOR_MUESTRAS`, `EMPRESA_TURISMO`, `NEGOCIO_FOTOGRAFIA` u `OTRO`. Va como TEXT con CHECK, igual que `FotofficeAgentePropuesta.estado`, para sumar tipos sin migrar un enum. |
| `nichos` | `text[]`, sólo para fotógrafos. Valores: `ESCOLAR`, `DEPORTIVA`, `TURISTICA`, `SOCIAL`, `EVENTOS`, `FOTO_CARNET`, `CORPORATIVA`, `MASCOTAS_NEWBORN_FAMILIA`, `OTRO:<texto>`. Lista abierta. |
| `plataformas` | `text[]`, para qué sirve: `CLF`, `INFOSPOT`, `MUESTRAS`, `FOTOFFICE`. Lo propone el agente según el tipo y Daniel lo puede editar. |
| `nombre` | Nombre comercial o de la persona. |
| `ciudad`, `provincia`, `region` | `region` es una de `CENTRO`, `BUENOS_AIRES_AMBA`, `CUYO`, `NOA`, `NEA` o `PATAGONIA`. |
| `lat`, `lng` | Opcionales; sirven para «cerca de» en el futuro. |
| `web`, `instagram`, `facebook`, `email`, `telefono`, `whatsapp` | Datos de contacto. |
| `googlePlaceId` | Único cuando existe; es la llave anti-duplicado más fuerte. |
| `estado` | Los estados de arriba. `NO_CONTACTAR` no se puede revertir automáticamente. |
| `vinculo` | `CONOCIDO_DNX_ESTUDIO` / `USUARIO_CLF` / null, más el id externo (`clientId` de FOTOFFICE o `userId` de CLF). |
| `creadoPor` | `BUSCADOR`, `MUESTRAS`, `RADAR`, `CARGA_INICIAL` o `MANUAL`. |
| `creadoEn`, `actualizadoEn` | |
| `claves` | Columnas normalizadas para el emparejamiento: dominio web, usuario de Instagram, email en minúsculas, teléfono en formato E.164 sin el 9, y nombre normalizado + ciudad. Con índices. |

**`DnxContactoDato`**: de dónde salió cada dato. Sirve para la ficha y para limpiar si una fuente
resulta mala.

| Campo | Contenido |
|---|---|
| `id` | |
| `contactoId` | |
| `campo` | Por ejemplo `email`. |
| `valor` | |
| `fuente` | `GOOGLE_PLACES`, `WEB_SEARCH`, `ALBOOM`, `MANUAL`, etc. |
| `fuenteUrl` | |
| `vistoEn` | |

**`DnxContactoEvento`**: el historial de la ficha.

| Campo | Contenido |
|---|---|
| `id` | |
| `contactoId` | |
| `tipo` | `CREADO`, `DATO_NUEVO`, `ESTADO`, `NOTA`, `FUSIONADO`, `VINCULADO`. Reservados para el Vendedor: `CORREO_ENVIADO`, `CORREO_RECIBIDO`. |
| `datos` | Json. |
| `autor` | Agente o `userId`. |
| `creadoEn` | |

El Vendedor guardará acá el texto completo de cada correo y de cada respuesta.

**`DnxBuscadorTarea`**: la cola de trabajo. Una fila por combinación de búsqueda.

| Campo | Contenido |
|---|---|
| `id` | |
| `region` | |
| `provincia`, `ciudad` | |
| `tipo` | Tipo de contacto buscado. |
| `nicho` | Opcional. |
| `fuente` | `GOOGLE_PLACES` o `WEB_SEARCH`. |
| `consulta` | El texto buscado. |
| `estado` | `PENDIENTE`, `HECHA`, `FALLO` o `SALTEADA`. |
| `intentos` | |
| `resultado` | Json: cuántos encontró, cuántos nuevos y el costo. |
| `costoUsdMicros` | |
| `hechaEn` | |

**`DnxBuscadorRegion`**: estado por región.

| Campo | Contenido |
|---|---|
| `region` | |
| `orden` | |
| `estado` | `EN_ESPERA`, `EN_CURSO`, `COMPLETA` o `PAUSADA`. |
| `iniciadaEn`, `completadaEn` | |
| `resumenEnviadoEn` | |

El gasto del mes se suma desde `DnxBuscadorTarea.costoUsdMicros` en hora argentina, o se guarda en
una tabla de consumo mensual. Decide el que construye.

Migración escrita a mano, aplicada en `development` y registrada con su checksum, como las
anteriores. Cuidado con la colisión de timestamps de migración que pasó en la pieza 1: elegir una
fecha posterior a la última de `main` en el momento de fusionar.

### Lista de ciudades por región

- Un archivo de datos versionado en el repo, por ejemplo `lib/agentes/buscador/ciudades.ts`.
- Contiene provincias por región y, por provincia, las ciudades a recorrer. Arranca con todas las
  capitales y ciudades de más de ~20.000 habitantes; Daniel puede sumar ciudades desde el panel.
- Para Centro conviene incluir el Gran Rosario completo: Funes, Roldán, Villa Gobernador Gálvez,
  Granadero Baigorria, Pérez, San Lorenzo.
- El que construye arma la lista; no hace falta un servicio externo.

### Generación de tareas

Al pasar una región a `EN_CURSO` se generan sus tareas: ciudades × tipos (× nichos para fotógrafos)
× fuente.

- **Consultas a Google Places**
  - Se usa Text Search con frases en español por tipo/nicho: «fotógrafo escolar en Córdoba»,
    «fotografía deportiva Rosario», «colegio en Paraná», «club deportivo en Villa María», «agencia
    de turismo en Carlos Paz», «foto carnet en …», «organizador de eventos en …».
  - Las frases viven en un archivo editable.
- **Consultas web con Claude**
  - Son menos y más amplias: por provincia, no por ciudad.
  - Sirven para lo que Maps no trae bien: fotógrafos que sólo tienen Instagram, asociaciones de
    fotógrafos, organizadores de muestras, ligas y federaciones deportivas.
- **Prioridad:** primero los nichos escolar, turístico y deportivo y sus contrapartes (escuelas,
  empresas de turismo, clubes). Después el resto.

### Ejecución (cron)

- Ruta nueva `app/api/cron/agente-buscador/route.ts`, con el mismo patrón GET→POST y autorización que
  el Periodista.
- **Frecuencia:** un cron frecuente, por ejemplo cada 15 minutos, que procesa tareas pendientes hasta
  un **presupuesto de tiempo por corrida**, con margen bajo el `maxDuration` de la función. No se usa
  un lote fijo.
- **Orden:** procesa la región `EN_CURSO` por orden de prioridad.
- **Errores**
  - Cada tarea es idempotente: reintentarla no duplica contactos, gracias al emparejamiento.
  - Una tarea que falla 3 veces queda en `FALLO` y la región sigue.
- **Cierre de región:** cuando no quedan tareas pendientes, la región pasa a `COMPLETA`, se manda el
  resumen y arranca la siguiente.
  - *Mi propuesta:* que arranque sola.
  - *Alternativa:* que espere a que Daniel la active.
  - Decido que **arranca sola**, porque Daniel pidió «ir activando» y el gasto ya está acotado por el
    tope.
- **Pausa:** botón **Pausar / Reanudar** en el panel.

### Google Places (sólo para descubrir)

- **Por qué así:** las condiciones de Google Maps Platform no permiten guardar en forma permanente el
  contenido de Places (nombre, teléfono, web, reseñas), sólo el `place_id`. Una base de prospectos
  para enviar correos tiene que guardar los datos para siempre. Por eso, decisión de Daniel del 08/11:
  **Maps sólo descubre**.
- **Flujo por resultado de Maps**
  1. Text Search devuelve el lugar, con su `place_id`, nombre, dirección y web si la tiene. Esos
     datos se usan **en memoria** durante la tarea para orientar el paso siguiente.
  2. El agente busca los datos de contacto en la **web o las redes del propio negocio**: abre la web
     si Maps la trajo, o hace una búsqueda web por nombre + ciudad.
  3. Se guarda el contacto con los datos sacados de esas páginas, cada uno con **esa página como
     fuente** (`WEB_SEARCH` / `SITIO_PROPIO`).
  4. De Maps sólo se guarda el `googlePlaceId`, para no repetir, y la ciudad/provincia de la tarea,
     que ya conocíamos. `GOOGLE_PLACES` **no** se usa como fuente de `DnxContactoDato`.
  5. Si no se encuentra ningún dato de contacto propio, el contacto igual se guarda con nombre y
     ciudad tomados de una página propia o de un listado público. Si ni eso existe, se descarta.
- **Costo**
  - Se usa el **field mask más barato** que alcance para descubrir: idealmente sólo ids, nombre y web.
  - No se usa Place Details para teléfono y web, salvo que el que construya demuestre que sale más
    barato.
  - El que construye **verifica la tabla de precios vigente de Places API (New)**, incluidos los usos
    gratis mensuales por SKU, y documenta el costo estimado por tarea.
- **Proyecto de GCP:** uno con facturación activa. Recomendación: un proyecto nuevo `dnx-agentes`
  vinculado a la cuenta de facturación existente, para aislar el gasto; si no, `compramelafoto-auth`.
- **Clave de API:** restringida a Places API (New) y guardada en Vercel FOTOFFICE como
  `GOOGLE_PLACES_API_KEY`. **La carga Daniel**; nunca pasa por el chat.
- **Tres frenos de gasto, porque hoy no hay ninguno:**
  1. **Contador propio:** cada llamada suma su costo estimado, **descontando el uso gratis mensual de
     cada SKU** para no frenar mucho antes que la factura real. Al llegar a USD 18 del mes, frena Maps
     y avisa por Telegram. Al cambiar de mes en hora argentina, retoma.
  2. **Cuota en Google Cloud:** límite de solicitudes por día en la consola, para que un bug no pase
     de un número fijo de llamadas aunque el contador falle.
  3. **Alerta de presupuesto** de GCP de USD 20 al correo de Daniel. Es sólo aviso: Google no corta
     solo.

  La cuota y la alerta las configura Daniel o Claude desde la consola en la puesta en marcha, con
  pasos escritos.
- **Si falta la clave:** el agente sigue sólo con la búsqueda web y lo dice en el panel.
- **Recorte de volumen:** como máximo 1 página de resultados por consulta (hasta 20 lugares) salvo
  en ciudades grandes (capitales y Gran Rosario), donde se permiten hasta 3.

### Búsqueda web con Claude

- Reusa el cliente y el cálculo de costo del Periodista: Sonnet 5.5 + `web_search_20260209`.
- Pide **salida JSON validada con zod**: una lista de candidatos con tipo, nicho, nombre, ciudad,
  datos de contacto y **la URL donde vio cada dato**.
- **Instrucciones explícitas al modelo:**
  - Sólo datos publicados por el propio negocio o persona para ser contactados (su web, su perfil
    profesional, un listado institucional).
  - Nunca inventar un email o teléfono.
  - Si no encuentra un dato, lo deja vacío.
- **Validación en código:**
  - El dominio del email coincide con la web o es de un proveedor genérico (gmail, hotmail…).
  - El teléfono tiene formato argentino válido.
  - Se descartan los candidatos sin ningún dato de contacto ni web/red.
- El gasto de Claude se registra aparte del de Google, con su propio **tope de USD 30 por mes**
  (editable en el panel). Al llegar a USD 28, el agente pausa todo lo que usa Claude (búsqueda web y
  lectura de sitios), avisa por Telegram y retoma el mes siguiente. Como los datos de contacto ahora
  salen de las webs, las tareas de Maps también usan Claude: el tope de Claude frena todo el agente.
- Cada llamada tiene `max_uses` acotado en `web_search` y un tope de continuaciones por `pause_turn`,
  para que una sola tarea no se lleve el presupuesto.

### Emparejamiento y duplicados

Al recibir un candidato, se busca un contacto existente, en este orden:

1. Mismo `googlePlaceId`.
2. Mismo dominio web propio (no de redes ni plataformas genéricas).
3. Mismo usuario de Instagram.
4. Mismo email.
5. Mismo teléfono normalizado.
6. Mismo nombre normalizado + misma ciudad.

Si encuentra uno, **suma los datos nuevos** a la ficha (con su `DnxContactoDato` y un evento
`DATO_NUEVO`) en vez de crear otro. Las reglas de normalización pueden inspirarse en las de la
migración de Alboom (`lib/alboom/carga/normalizar.ts`): correos de relleno o compartidos nunca
emparejan.

### Vínculo con CLF y con FOTOFFICE

- **FOTOFFICE (DNX Estudio):** al crear o actualizar un contacto, se busca por email o teléfono en
  `Client` del workspace de DNX Estudio (`cmv5z6qxwwmmhf0q5gp8qja1j`). Si coincide, se marca
  `CONOCIDO_DNX_ESTUDIO`, con el `clientId`.
- **CLF:** como FOTOFFICE no puede leer la base de CLF, se agrega en CLF una ruta interna **nueva**
  protegida con un secreto compartido.
  - Recibe emails y teléfonos normalizados y devuelve sólo cuáles existen, su `userId` y su rol. No
    devuelve nombres ni otros datos.
  - Fotógrafo, organizador o escuela → vínculo `USUARIO_CLF`. Comprador (`CUSTOMER`) → nota
    informativa en la ficha, sin vínculo.
  - Va en lotes, siguiendo el precedente de API entre plataformas de la conexión FOTOFFICE↔CLF.
  - Variables de entorno: `CLF_CONSULTA_USUARIOS_SECRET` en ambos proyectos de Vercel. Las carga
    Daniel.
  - Si CLF no responde, el contacto se guarda igual y el chequeo se reintenta después.
  - Un contacto con vínculo `USUARIO_CLF` sigue en la base, porque puede servir para otras
    plataformas. Se muestra marcado, y el Vendedor lo va a tratar distinto.

### Carga inicial

Con un botón «Importar conocidos» en el panel, o en la puesta en marcha:

- Se importan los 37 `Client` de DNX Estudio con la etiqueta `Fotógrafo`.
- Entran como `FOTOGRAFO`, `creadoPor: CARGA_INICIAL`, vínculo `CONOCIDO_DNX_ESTUDIO` y estado
  `REVISADO`.
- El nicho queda vacío; Daniel lo puede completar.
- Es idempotente.

### Panel «Contactos DNX» (super admin)

- **Ruta:** `/admin/contactos-dnx`, junto a `/admin/agentes`. Mismo control de acceso que esa página.
- **Lista**
  - Columnas: nombre, tipo, nichos, ciudad/provincia, región, datos de contacto (íconos), estado,
    vínculo y fecha.
  - Filtros por tipo, nicho, región, provincia, estado, vínculo y «con email».
  - Búsqueda por texto.
  - Exportar CSV.
  - Conviene reusar el listado estándar de FOTOFFICE (`lib/listado` + `components/listado`) si se
    adapta sin forzarlo.
- **Ficha**
  - Datos con su fuente (enlace a donde se vio cada uno), edición manual, estado, notas y botón
    «No contactar».
  - Línea de tiempo con los `DnxContactoEvento`.
  - Botón «Fusionar con…» para duplicados que se escaparon.
- **Cabecera del Buscador**
  - Región en curso con avance (tareas hechas / total) y orden de las regiones.
  - Pausar / Reanudar y «Correr ahora».
  - Gasto de Google del mes contra su tope (editable, por omisión USD 20) y gasto de Claude del mes
    contra su tope (editable, por omisión USD 30).
- **Enlace desde `/admin/agentes`:** el Buscador aparece como un agente más, con su estado y gasto.

### Telegram

- Usa el canal de agentes existente. Es un mensaje de texto, sin botones.
- **Cuándo escribe:**
  - Al terminar una región, con un resumen por tipo y nicho, las 5 ciudades con más contactos, el
    gasto y un enlace al panel filtrado por esa región.
  - Al frenar por tope de gasto, de Google o de Claude.
  - Si una región tiene más de un 20 % de tareas en `FALLO`, como aviso de que algo anda mal.
- **Nunca** manda un mensaje por contacto.

### Datos personales

- Sólo se guardan datos de contacto **comerciales y publicados**, con su fuente.
- `NO_CONTACTAR` es permanente: el emparejamiento lo respeta aunque el contacto vuelva a aparecer en
  otra búsqueda.
- La baja real («no quiero recibir más correos») la va a manejar el Vendedor y termina en
  `NO_CONTACTAR`.

### Pruebas

- Como en la pieza 1, con vitest y base en memoria (`lib/circuitos/base-en-memoria`), con clientes
  falsos de Google, Claude y CLF.
- **Lo mínimo:**
  - El emparejamiento, para cada llave y sus falsos positivos (correo compartido, teléfono de
    central).
  - Los dos topes de gasto: frenan exactamente al cruzar, el de Google descuenta el uso gratis, y
    retoman al cambiar de mes en hora argentina.
  - Una región con Maps frenado no se cierra hasta terminar las dos fuentes.
  - No se guarda ningún dato con fuente Google Places, salvo el `googlePlaceId`.
  - La generación de tareas por región, sin duplicarlas al reactivar.
  - La idempotencia de una tarea reintentada.
  - El cierre de región y el resumen.
  - La validación de candidatos de Claude: email inventado, sin fuente, teléfono inválido.
  - La carga inicial repetida.
- El cron se prueba sin llamadas reales.

## Puesta en marcha

1. **GCP**
   - Crear o elegir el proyecto con facturación y habilitar Places API (New).
   - Crear la clave restringida.
   - Poner la cuota diaria y la alerta de presupuesto de USD 20.
   - Pasos escritos para Daniel; se pueden hacer con el MCP de GCP (`gcp_enable_services`) donde se
     pueda.
2. **Vercel FOTOFFICE:** Daniel carga `GOOGLE_PLACES_API_KEY` y `CLF_CONSULTA_USUARIOS_SECRET`.
   **Vercel CLF:** Daniel carga el mismo secreto.
3. Aplicar la migración en `development` y registrarla.
4. Desplegar. Importar los conocidos. Activar la región Centro.
5. Revisar las primeras tandas en el panel antes de dejarlo correr solo: calidad de resultados y
   costo real por tarea contra lo estimado.

## Lo que queda a criterio del que construye

- Nombres exactos de tablas y campos.
- Si las tablas van atadas al workspace de DNX Estudio o son globales.
- La lista de ciudades y las frases de búsqueda.
- La combinación de llamadas de Places más barata, según los precios vigentes.
- Frecuencia del cron y presupuesto de tiempo por corrida.
- Diseño visual del panel, dentro del estilo de las páginas de admin existentes.
- Si conviene repartir la entrega en dos PR:
  1. base + panel + carga inicial;
  2. Buscador + Google + CLF.
