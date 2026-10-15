# Clickatoner de la semana — diseño

Fecha: 05/10/2026. Parte 3 del diseño "Socio de la semana y placas"
(`apps/fotoffice/docs/superpowers/specs/2026-10-04-socio-de-la-semana-y-placas-design.md`).

## Qué es

Cada viernes a las 00:00 (hora argentina), la portada de Clickatón presenta a alguien que corrió
una maratón: nombre, ciudad, foto, Instagram y su mejor obra, con un link a su página pública.
Se elige al azar y nadie se repite hasta que salieron todos.

## Decisiones (Daniel, 05/10)

- **"Resultados publicados" es un interruptor por edición** en el panel (Clickatoner de la
  semana). Clickatón no tenía esa marca: los lotes de resultados quedan `FINALIZED` y FotoRank
  bloquea la publicación oficial. Recién con el interruptor prendido los participantes de esa
  edición entran en la rotación y sus obras se pueden ver en público. Apagarlo los saca en el acto.
- **Entran quienes aceptaron las bases**, que incluyen el uso de imagen (los dos permisos de
  imagen se marcan solos al aceptarlas, así que filtrar por ellos no filtraba nada). En **Mi
  cuenta** cada uno puede pedir "No quiero aparecer como Clickatoner de la semana".

## Quién puede salir

Inscripción `CONFIRMED`, no de prueba (`isOpsTest`), en una edición con resultados publicados y
que no sea de prueba (`isOpsFixture`); aceptó las bases; no pidió salir; y tiene al menos una obra
`CONFIRMED` cuya **última** decisión técnica es "elegible". La persona es el email en minúsculas,
que es como Clickatón une a alguien entre ediciones.

Al 05/10, con la 1ª edición publicada entrarían **26 personas**.

## La obra destacada

La premiada (el premio más alto), si no la mejor ubicada en el ranking, y ante empate la de la
edición más reciente. Se elige al momento de salir y queda guardada.

## Lo público

- **Portada**: sección "Clickatoner de la semana" después de los testimonios. Sin clickatoner no
  se dibuja.
- **`/clickatoners/<slug>`**: la página de la persona con sus obras de ediciones publicadas y sus
  premios. Nace la primera vez que sale. Si pide salir, da 404 (el mismo que si no existiera).
- **Fotos**: `/api/public/clickatoners/fotos/<inscripción>` (perfil) y
  `/api/public/clickatoners/obras/<obra>` (vista previa de 1280 px, nunca el original). Las dos
  vuelven a verificar que la persona hoy pueda aparecer; si no, 404. Igual que la foto de un
  testimonio.

## Elección

- Tarea `/api/cron/clickatoner`, cada hora a los 5 minutos (la del viernes 00:05 elige; las demás
  no hacen nada). El panel también elige si la tarea no corrió. **La portada no elige.**
- Candado `pg_advisory_xact_lock` para que dos elecciones simultáneas no elijan dos personas.
- Saltear: desde el panel, con motivo; se elige otra persona en el momento.

## Datos

Cuatro tablas nuevas, sin tocar ninguna existente (migración
`20261006120000_clickaton_clickatoner_de_la_semana`): `ClickatonEditionResultsPublication`,
`ClickatonClickatonerOptOut`, `ClickatonPublicProfile`, `ClickatonClickatoner`.

## Fuera de alcance

Placa para redes del clickatoner (Clickatón ya tiene su sistema de placas de participante) y
agregar las páginas de perfil al sitemap.
