# Prueba de carga

*Etapa 4. Corrida del 2026-09-15 contra producción.*

El requisito del cronograma: **100 fotos simultáneas de 10 dispositivos**. Es el momento
del brindis, cuando todo el salón sube al mismo tiempo.

## Cómo se corre

```bash
cd apps/subilafoto
node scripts/prueba-de-carga.mjs <CODIGO> <token1,token2,…> [cantidad] [concurrencia]
```

El script recorre el camino del invitado **tal cual lo hace un teléfono**: pide permiso,
sube la foto derecho a R2 con la URL firmada, y confirma. Sin atajos por la base: si algo
del camino está roto, la prueba se entera.

Dos detalles que importan:

- **Cada foto es distinta.** La base tiene única la combinación de evento y checksum: cien
  copias del mismo archivo darían noventa y nueve repetidas y una subida, que no prueba
  nada. El script pinta el número arriba para que el checksum cambie.
- **Varios tokens = varios invitados.** Cada sesión tiene su propio tope de subidas y su
  propio contador. Una fiesta son cien fotos de treinta teléfonos, no cien de uno.

### Preparar los invitados

Una sesión de invitado que ya aceptó los términos, por cada "teléfono":

```sql
WITH nums AS (SELECT generate_series(1, 10) AS n),
g AS (
  INSERT INTO "SubilafotoGuestSession" (id, "eventId", token, "displayName", "lastSeenAt")
  SELECT 'gs-carga-' || n, '<id-del-evento>', 'carga-invitado-' || n, 'Invitado ' || n, now()
  FROM nums RETURNING id, "eventId"
)
INSERT INTO "SubilafotoConsent" (id, "eventId", "guestSessionId", kind, "documentVersion", accepted)
SELECT 'cons-' || g.id, g."eventId", g.id, 'TERMS', '<version vigente>', true FROM g;
```

La versión de los términos sale de `lib/legal/contenido.ts`. Si no coincide, la subida
devuelve 403 — que es exactamente lo que tiene que pasar.

## Resultado

Fotos de **3000×4000**, unos 110 KB cada una, desde 10 invitados, de a 10 a la vez.

### La subida

| | |
|---|---|
| Subidas | 99 |
| Repetidas | 1 |
| **Fallidas** | **0** |
| Mediana | 2.182 s |
| p90 | 4.075 s |
| Peor caso | 5.383 s |
| Total | 33,9 s |

El promedio no se mira: en una fiesta lo que se siente es la foto que tardó más, no la que
tardó el promedio. **Cinco segundos y medio en el peor caso**, con la foto entera saliendo
del teléfono.

La repetida no es un error: era la foto de una prueba anterior, con el mismo contenido y
por lo tanto el mismo checksum. La deduplicación la reconoció y no la volvió a subir. Salió
gratis, pero es la verificación de que funciona con una colisión de verdad.

### La moderación

Las cien se decidieron **sin que interviniera el cron de rescate**: cada una se moderó
apenas el invitado confirmó.

| | |
|---|---|
| Decisiones | 100 |
| Aprobadas | 100 |
| Con error | 0 |
| Latencia media | 308 ms |
| p90 | 385 ms |
| Peor caso | 1.084 ms |

### Las variantes

**100 de 100 con sus dos variantes.** Ninguna rezagada.

De un original de 3000×4000 salen `pantalla` 1440×1920 (unos 27 KB) y `panel` 480×640
(unos 4 KB). La proporción se respeta y no se agranda nada.

### Las pantallas con cien fotos adentro

| Pantalla | Tiempo | Peso |
|---|---|---|
| Álbum | 1,79 s | 188 KB de HTML |
| Pantalla del salón | 0,47 s | — |

Y la verificación que importaba: en el HTML del álbum hay **216 referencias a
`--pantalla.jpg` y cero al original**. La regla anti-bypass funciona con carga real, no
sólo en el test.

## Lo que esta prueba no dice

- Se corrió desde una conexión de fibra, no desde el wifi de un salón. Los tiempos de
  subida reales van a ser peores; los del servidor, iguales.
- Las cien fotos eran generadas y todas parecidas. Rekognition puede tardar más con fotos
  reales de una fiesta, aunque la parte 2 de la prueba de moderación (capítulo 06) midió
  243 y 219 ms con fotos de verdad.
- No se probó **subir mientras la pantalla proyecta**. La pantalla del salón y la carga son
  dos caminos distintos y comparten la base. Queda para el ensayo del 8 de octubre.
