# Portfolios del estudio — diseño

Fecha: 2026-11-15 · Workspace de referencia: DNX Estudio (`cmv5z6qxwwmmhf0q5gp8qja1j`, slug público `dnx-estudio`).

## Para qué

DNX suma una vendedora (closer, 10 % de comisión) que atiende todas las consultas de coberturas y
eventos. Cuando entra una consulta de XV, boda, sesión infantil, etc., tiene que encontrar **rápido**
el portfolio que corresponde y **mandarle el enlace al cliente**. Hoy el material existe pero está
desparramado (Sitio web → Trabajos, landings de CompraMeLaFoto) y ordenado para el público, no para
vender.

Esta pantalla es su herramienta de trabajo: todos los portfolios del estudio agrupados por **rubro** y
por **estilo**, con «Abrir» y «Copiar enlace» de un toque.

## Lo que ya existe (no se duplica)

- **Sitio web → Trabajos** (`FotofficeTrabajo`, `FotofficeTrabajoCategoria`, `FotofficeTrabajoFoto`):
  45 trabajos importados de Alboom, 44 publicados, ~1.670 fotos en R2, cada uno con página pública
  en `/w/dnx-estudio/trabajos/<categoria>/<trabajo>` (verificado: responde 200). Categorías del
  sitio: Books (24, casi todas sesiones pre-XV), Fiestas de XV (10), Bodas (7), Arquitectura (1),
  Graduaciones (1), Videos (1).
- **Landings de venta en CompraMeLaFoto**: `https://www.compramelafoto.com/dnx/xv`, `/dnx/xv/sp`
  (sin precio), `/dnx/bodas`, `/dnx/bodas/sp`, `/dnx/escolar`. Son código, no datos.
- **Pantalla `/portfolios`** (módulo `portfolio`, encendido en DNX Estudio): hoy muestra el portfolio
  de cada **socio** de una institución. DNX Estudio tiene 0 socios, así que hoy ve una pantalla vacía.

## Decisiones tomadas con Daniel

- **Enfoque A**: dos etiquetas internas por trabajo, sobre los Trabajos que ya existen. Descartadas:
  (B) una lista curada aparte —otra lista que mantener, un trabajo nuevo no aparece solo— y (C)
  adivinar el estilo por el título —se equivoca y no se corrige—.
- **Rubro**: uno por trabajo (XV, Bodas, Sesiones infantiles…).
- **Estilos**: varios por trabajo (Book previo, Fiesta, Sesión temática, Retrato ambientado…). Una
  sesión pre-XV puede ser a la vez «Book previo» y «Sesión temática».
- Las etiquetas **no se ven en el sitio público** ni cambian categorías ni direcciones: «Books» sigue
  en `/trabajos/books/...` aunque internamente sea rubro XV.
- **Videos**: lugar previsto, sin construir.

## Objetivos

1. Una pantalla en el panel con todos los portfolios del estudio agrupados por rubro → estilo.
2. Cada portfolio: miniatura de portada, título, «Abrir» (pestaña nueva) y «Copiar enlace» (enlace
   público absoluto al portapapeles, con aviso «Copiado»).
3. Bodas y XV aparecen con su material real desde el primer día (pre-etiquetado).
4. Las presentaciones de venta de CompraMeLaFoto aparecen dentro de su rubro, también con
   «Abrir» y «Copiar enlace».
5. Etiquetar un trabajo nuevo es parte natural de cargarlo (en su ficha).

## No objetivos

- Videos (sólo un recuadro «Videos — próximamente» por rubro, sin lógica).
- Enviar el enlace por WhatsApp o mail desde la pantalla, o registrar a quién se mandó.
- Vincularlo con Consultas (sugerir el portfolio según la categoría de la consulta). Puede venir
  después, cuando esté el circuito de ventas.
- Cambiar nada del sitio público ni de las landings de CompraMeLaFoto.
- Tocar el portfolio de socios: para instituciones con socios, la pantalla sigue igual.

## Anti-objetivos (sería un fracaso aunque funcione)

- Que la vendedora copie un enlace que da **404** al cliente. Sólo se ofrece copiar lo que de verdad
  se ve en público (trabajo publicado, en categoría visible, sitio publicado).
- Que haya que mantener una segunda lista a mano.
- Que la pantalla sea lenta en el celular de la vendedora: 45 trabajos, miniaturas chicas y diferidas.

## Diseño

### Datos (migración a mano, sin staging)

Dos tablas nuevas, **sin tocar `FotofficeTrabajo`** (decisión del constructor tras la revisión: si
una base no tuviera una columna nueva de `FotofficeTrabajo`, Prisma rompería todas las consultas del
modelo —incluidas las páginas públicas de Trabajos—; con tablas aparte, que falten sólo apaga esta
pantalla, como `FotofficeWorkspaceDomain`):

```
FotofficePortfolioRubro
  id            String   @id @default(cuid())
  workspaceId   String
  nombre        String            -- «XV», «Bodas», «Sesiones infantiles»…
  orden         Int      @default(0)
  enlacesJson   Json     @default("[]")   -- presentaciones de venta: [{ titulo, url }]
  createdAt / updatedAt
  @@unique([workspaceId, nombre])
  @@index([workspaceId, orden])

FotofficeTrabajoPortfolio          -- las etiquetas internas de un trabajo (0 o 1 fila por trabajo)
  id            String   @id @default(cuid())
  workspaceId   String
  trabajoId     String   @unique   -- sin FK Prisma, como el resto de Trabajos
  rubroId       String?
  estilos       String[] @default([])  -- textos libres, recortados, sin repetir, máx. 6 de 40 caracteres
  createdAt / updatedAt
  @@index([workspaceId, rubroId])
```

- Al borrar un trabajo se borra su fila de etiquetas (en la misma función que hoy borra el trabajo).

- Igual que el resto del módulo Trabajos: sin relaciones Prisma, todo filtrado por `workspaceId`, y
  el código tolera que la tabla/columnas falten (`esTablaFaltante`) mostrando un aviso en vez de
  romper.
- Los **estilos son texto libre** con sugerencias (los estilos ya usados en ese rubro). Una lista
  administrada de estilos sería otra pantalla para un puñado de valores; si aparecen variantes
  («Book previo» / «book pre XV»), se corrigen en las fichas.
- `enlacesJson` se valida al leer y al guardar: `https://` obligatorio, título ≤ 80, máx. 10 por rubro.
- Borrar un rubro deja las etiquetas de sus trabajos con `rubroId` nulo (pasan a «Sin etiquetar»), nunca borra
  trabajos.

### Pantalla: `/portfolios`

La misma ruta del módulo `portfolio`, con dos solapas cuando corresponde:

- **«Del estudio»** (nueva): lo de este diseño.
- **«De los socios»**: la pantalla actual, sin cambios.

Regla: si el workspace tiene socios en el padrón, se muestran las dos solapas y abre en «De los
socios» (las instituciones no notan cambio salvo la solapa nueva). Si no tiene socios (DNX Estudio),
abre directo en «Del estudio» y la otra solapa no aparece. Permiso: el mismo `portfolio` VIEW de hoy
(a la vendedora se le da con un rol); administrar rubros y presentaciones pide `portfolio` MANAGE.

Boceto (celular primero):

```
Portfolios del estudio
[ Buscar…           ]   [Todos los rubros ▾]

XV                                              (11 portfolios)
  Presentaciones de venta
    ▸ Presentación XV            [Abrir] [Copiar enlace]
    ▸ Presentación XV sin precio [Abrir] [Copiar enlace]
  Book previo
    [img] Sesión Pre XV de Valen!   Rosario · 2024   [Abrir] [Copiar enlace]
    [img] …
  Fiesta
    [img] Fiesta de XV de LUPE                        [Abrir] [Copiar enlace]
  Sesión temática
    [img] Sesión Pre XV de Sofi Bracco (Pin-Up)       [Abrir] [Copiar enlace]
  Videos — próximamente

Bodas …
Sesiones infantiles
  Todavía no hay trabajos etiquetados en este rubro.

Sin etiquetar (3)   ← sólo lo ve quien puede editar Trabajos; enlaza a la ficha para etiquetar
```

- Un trabajo con varios estilos aparece en cada uno (es lo que busca la vendedora: «mandame una
  temática»). Dentro de un estilo: destacados primero, después por fecha (más nuevo primero).
- Un trabajo con rubro y sin estilos va en «Otros» dentro de su rubro.
- El buscador filtra por título y lugar en el navegador (son pocos), y el selector salta a un rubro.
- «Copiar enlace» copia la URL **absoluta** del trabajo (dominio propio si el sitio lo tiene
  conectado y verificado —buscarlo como lo hace `sitioDelWorkspace` en `lib/presupuestos/sitio.ts`,
  y comprobar que la ruta con dominio propio no da 404—; si no, `appUrl()` + `/w/<slug>/trabajos/...`).
  `blogAbsoluteUrl` no sirve para esto: siempre arma la dirección de fotoffice.com. Hoy DNX no tiene
  dominio propio conectado (dnxfotografia.com.ar sigue en Alboom), así que los enlaces salen por
  fotoffice.com y cambiarán solos el día que se conecte. Si el portapapeles no está disponible, se muestra el enlace seleccionado
  para copiar a mano.
- Trabajos que **no** se pueden compartir (borrador, categoría oculta, sin categoría, sitio sin
  publicar) aparecen atenuados con el motivo y sin «Copiar enlace» —sólo para quien edita Trabajos;
  a la vendedora no le aparecen—.

### Administrar rubros (MANAGE)

En la misma solapa, un desplegable «Administrar rubros»: crear, renombrar, ordenar (↑/↓), borrar, y
cargar las presentaciones de venta de cada rubro (título + enlace). Sin pantalla aparte.

### Etiquetar en la ficha del trabajo

En `Sitio web → Trabajos → (trabajo)`, un recuadro nuevo «Portfolio interno (no se ve en el sitio)»
con: selector de **Rubro** y campo de **Estilos** (fichas que se agregan con Enter o eligiendo una
sugerencia; se quitan con ×). Se guarda con el mismo «Guardar» de la ficha. Quien edita Trabajos
(`requireBlogEditor`) etiqueta; la acción valida que el rubro sea del workspace.

### Carga inicial en DNX Estudio

Con SQL a mano en producción (rama `development` del proyecto Neon `compramelafoto`), después de la
migración:

- Rubros, en este orden: XV · Bodas · Sesiones infantiles · Cumpleaños · Bautismos y comuniones ·
  Graduaciones · Eventos corporativos · Producción de contenido · Arquitectura.
  Se toman de las categorías de Consultas de DNX. **A confirmar con Daniel.**
- Presentaciones: XV ← `/dnx/xv` y `/dnx/xv/sp`; Bodas ← `/dnx/bodas` y `/dnx/bodas/sp`.
  `/dnx/escolar` queda afuera: no hay rubro escolar en la lista.
- Pre-etiquetado por título:
  - Fiestas de XV → XV / Fiesta.
  - Books con «XV/15/pre/post» en el título → XV / Book previo, y Sofi Bracco además Sesión temática.
  - Bodas → Bodas.
  - Graduaciones → Graduaciones. Arquitectura → Arquitectura.
  - Lo dudoso queda **sin etiquetar** para que lo resuelva Daniel: «Luzka», «Emilia..», «Book ZOE!»,
    «Books», «Book Andy!», «Sesión Brichu & Nachu!», «Gise y Fatu – 10° Aniversario!», «VIDEOS!».
  - Antes de aplicar se le muestra a Daniel la tabla trabajo → rubro/estilos.

## Restricciones

- Next.js con cambios de versión: leer `node_modules/next/dist/docs/` antes de escribir
  (`AGENTS.md`).
- Migración: SQL a mano en la rama `development` del proyecto Neon `compramelafoto`, registrada con
  `prisma migrate resolve --applied`, **antes** de fusionar (no hay staging).
- El código tolera que falten las columnas o la tabla (aviso, no error 500).
- Textos en español rioplatense, para alguien que no es programador.

## Lo que queda para quien construye

Nombres internos de archivos y componentes, cómo se parte el JSX, cómo se arma el estado del campo
de estilos, los textos exactos de ayuda y los tests (lo puro —validar estilos y enlaces, agrupar,
decidir si un trabajo es compartible— con tests unitarios).
