# Muestras cerca tuyo (portal FOTOFFICE) y Muestras → InfoSpot

Fecha: 2026-10-10 · Aprobado por Daniel en chat el 10/10.

## Objetivo

1. Que el socio, al entrar a su portal de FOTOFFICE, vea **"Muestras fotográficas cerca tuyo"**.
2. Que las muestras de muestrasfotograficas.com se **promocionen solas en InfoSpot**.

Fuente única: las `CulturalActivity` aprobadas de Muestras (misma base que FOTOFFICE, Neon
`divine-hall` rama `development`). Al 10/10 hay 16, todas con coordenadas.

## Decisiones

- Las muestras que llegan a InfoSpot **se publican solas** (ya las aprobó Daniel o la institución en
  Muestras). La redacción puede despublicarlas o editarlas.
- Sin migraciones ni enums nuevos. Sin variables de entorno nuevas.
- Fuera de alcance: resumen semanal por mail, mapa en el portal, sugerencias al blog de la institución.

## Parte 1 — Portal del socio

- Tarjeta en la portada del portal (`PortalHome`): las **3 más cercanas** abiertas o próximas de todo
  el país (`temporalStatus` ≠ CLOSED, no canceladas, no sólo virtuales, con coordenadas). Portada,
  título, ciudad, "a N km" (`distanceLabel`), fechas en hora argentina y "Últimos días" (`isLastDays`).
- Cada una enlaza a `https://muestrasfotograficas.com/m/<slug>`; "Ver todas cerca tuyo" a la portada
  de Muestras con `nearHref` (coordenadas a 4 decimales, no la casa del socio).
- **Origen**, en este orden:
  1. ciudad + provincia de la ficha del socio (`Member.city/province`);
  2. ciudad + provincia de la institución (`FotofficeWorkspaceBranding`);
  3. sin origen: las próximas a inaugurar del país, sin distancia, y un enlace a "Mi perfil".
- Ciudad → coordenadas con Nominatim (`createNominatimProvider` de `@repo/geo`), en el servidor, con
  caché persistente de Next (`unstable_cache`, clave = texto normalizado, 30 días) y tope de espera de
  3 s. Si Nominatim falla o no encuentra, se pasa al siguiente origen; nunca rompe el portal.
- Las reglas (filtro, orden, recorte a 3) viven en una función pura testeada; la consulta va aparte.
- FOTOFFICE suma la dependencia de workspace `@repo/muestras` (sus dependencias ya están en el árbol).
- Si la consulta falla, el portal sale sin la tarjeta (mismo criterio que vitrina y cumpleaños).

## Parte 2 — InfoSpot

**Muestras publica** `GET /api/public/actividades` (JSON, sin sesión, caché de CDN 10 min): las
aprobadas, no canceladas, que no cerraron hace más de 1 día. Sólo campos ya públicos en el sitio:
id, slug, tipo, título, descripción, organizadores, portada, fechas, horario, precio, lugar, ciudad,
provincia, dirección, coordenadas, virtual, url pública. Nunca mails, teléfonos ni ids de usuario.

**InfoSpot sincroniza** con un cron nuevo `/api/cron/muestras-sync` una vez por semana, jueves 10:00 hora argentina (`0 13 * * 4`, `CRON_SECRET`, igual
que `clf-events-sync`), en `lib/muestras-sync/`:

- Origen: `InfoSpotContentOrigin` con `sourceType API`, `externalEntityType EVENT`,
  `externalId "muestras:<id>"`, `externalUrl` = página pública.
- **Crear**: `InfoSpotEvent` en `PUBLISHED` con `publishedAt`, categoría `fotografia`,
  `originKind SYNCED_EXTERNAL`, `contentTag` sin revisión pendiente, `sourceUrl`/`registrationUrl` =
  página de la muestra, `organizerEmail` = casilla fija de DNX (campo obligatorio, nunca público),
  geocodificado con las coordenadas de Muestras (`locationVisibility EXACT`: es un lugar público).
- **Actualizar**: fechas, lugar y enlaces siempre; título, descripción, resumen, categoría y portada
  sólo si no están marcados como editados a mano (`*Overridden`). **Nunca** cambia el estado editorial
  de un evento existente: si la redacción lo despublicó, queda despublicado.
- **Retirar**: si la muestra deja de venir en la lista (cerró, se canceló o se despublicó), el
  evento pasa a `UNPUBLISHED` sólo si sigue `PUBLISHED` y el origen queda `STALE`.
- Las virtuales sin ciudad no se importan (InfoSpot exige ciudad y provincia).
- `?dryRun=1` cuenta lo que haría sin escribir.

## Pruebas

- Vitest: función de cercanía del portal (orden, cerradas fuera, sin coordenadas, sin origen, recorte),
  cadena de orígenes, mapeo muestra → evento, reglas de actualización con y sin `*Overridden`, retiro.
- En vivo: portal con un socio de SFPR (Rosario); endpoint público desde afuera; cron en `dryRun` y
  después real contra InfoSpot producción; ver las muestras en infospot.
