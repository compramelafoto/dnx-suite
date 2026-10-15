# El portfolio de cada socio — diseño

Un módulo para que cada socio arme su portfolio y la institución lo publique en su sitio
web, sin que nadie de la Secretaría tenga que tocar una foto.

---

## Vocabulario

Tres palabras, y conviene no mezclarlas:

- **Portfolio** — lo que arma un socio: sus fotos, ordenadas, con una destacada.
- **Directorio** — la página del sitio público donde se ven todos los portfolios publicados.
- **Ficha** — la página de un socio dentro del directorio: su presentación y su galería.

"Socio" se usa en este documento por comodidad. En pantalla siempre gana la palabra que cada
institución eligió en Configuración → Palabras (`WorkspaceVocabulary`): voluntarios, alumnos,
colaboradores.

---

## 1. Por qué

El roadmap del portal del socio tiene el portfolio anotado desde el principio, en una sola
línea: *"Autogestionado por el propio socio"*. Nunca se diseñó.

Mientras tanto, media obra ya se construyó sin que se llamara portfolio. Cada socio tiene en
la base su **presencia profesional** — nombre del estudio, especialidades, presentación,
sitio, Instagram, TikTok, Facebook, YouTube, LinkedIn — que se pide desde el alta y se edita
en Portal → Perfil. Y tiene un `directoryOptIn` que arranca apagado a propósito, con este
comentario en el esquema:

> *Consentimiento explícito para publicar estos datos en la web pública de la institución.
> Arranca en false a propósito: publicar los datos de alguien requiere que lo haya pedido, no
> que no se haya opuesto.*

O sea: los datos están cargados, el consentimiento está pedido, y **no hay una sola pantalla
que los muestre**. Falta la mitad visual —las fotos— y falta la puerta de salida.

Del otro lado, la institución tiene desde hace poco un sitio público de verdad, con su
armazón, su menú y sus páginas de módulo. Un sitio de una sociedad de fotógrafos sin la obra
de sus fotógrafos es una cáscara.

### La advertencia que el roadmap ya dejó anotada

> *"Hoy no se está cargando contenido de ningún tipo. Diseñar el portal alrededor de contenido
> que nadie produce todavía es construir un hueco."*

Este diseño la toma en serio: el orden de las etapas pone **primero la carga y después la
publicación**, para que el directorio no estrene vacío. Ver §10.

---

## 2. Alcance

### Entra

1. Un módulo `portfolio`, encendible por institución como cualquier otro.
2. Una galería por socio, de hasta 20 fotos, con orden y una foto destacada.
3. Autogestión total desde el portal del socio, con subida directa del navegador a R2.
4. Dos páginas públicas dentro del sitio del workspace: el directorio y la ficha.
5. Una única regla que decide si un portfolio está al aire, con sus siete condiciones.
6. Control de la institución: bajar un portfolio y publicarlo igual, las dos con motivo y
   auditoría.

### No entra

- **Varias series o ensayos por socio.** Una galería, una sola. Decisión tomada.
- Comentarios, "me gusta", contador de visitas.
- Venta de copias o descargas.
- Marca de agua, o cualquier intento de impedir que alguien guarde una foto. Es teatro: la
  imagen se sirve al navegador o no se ve.
- Buscador de texto libre. Hay filtro por especialidad, que es lo que se busca de verdad.
- Portfolios de personas que no son socias.
- Dominio propio, idiomas, estadísticas. Son de otras obras.

---

## 3. Los datos

Dos tablas nuevas. Ninguna duplica nada de lo que ya existe.

### `FotofficeMemberPortfolio` — una fila por socio

| Campo | Para qué |
|---|---|
| `memberId` (único) | De quién es |
| `workspaceId` | Aislamiento por institución, como todo el resto |
| `publicSlug` | Su dirección: `/w/sfpr/socios/juan-perez`. Único dentro del workspace |
| `memberPublished` | Si el socio lo prendió. Arranca en `false` |
| `memberPublishedAt` | Cuándo lo prendió por primera vez |
| `coverPhotoId` | La foto destacada, la que representa al socio en el directorio |
| `hiddenByAdminAt` / `hiddenByAdminUserId` / `hiddenReason` | La bajada de la institución |
| `adminForcePublish` | El perdón de deuda (§4, condición 6) |

**La presentación, las especialidades, las redes y el sitio NO se guardan acá.** Viven en
`Member` desde el alta y se leen de ahí. Duplicarlas sería garantizar que un día digan cosas
distintas.

#### Sobre `publicSlug`

Se deriva del nombre y apellido al crear el portfolio (`juan-perez`), y **no vuelve a
cambiar**. Si ya existe en el workspace se desambigua con un sufijo numérico
(`juan-perez-2`).

No se usa el número de socio en la dirección: expone el padrón y no le dice nada a nadie.
Tampoco se recalcula el slug si el socio cambia de apellido — una dirección publicada que
deja de funcionar es un enlace roto en el sitio de otro.

### `FotofficeMemberPortfolioPhoto` — una fila por foto

| Campo | Para qué |
|---|---|
| `portfolioId` | A qué portfolio pertenece |
| `r2Key`, `url`, `contentType`, `sizeBytes`, `width`, `height` | El archivo |
| `order` | El orden que eligió el socio |
| `title`, `year` | Opcionales, del socio |

El alto y el ancho se guardan para reservar el espacio de cada foto antes de que cargue: sin
eso la galería salta mientras se arma.

El tope de 20 se valida al agregar, en el servidor. Un tope que sólo vive en el botón no es un
tope.

---

## 4. Una sola regla decide si se ve

Un archivo, una función, sus tests: `lib/portfolio/visibility.ts`.

Un portfolio está al aire si se cumplen **las siete**:

1. El módulo `portfolio` está habilitado en el workspace.
2. `Member.directoryOptIn === true` — el socio consintió publicarse.
3. `portfolio.memberPublished === true` — el socio lo prendió.
4. Tiene al menos una foto.
5. `Member.status === "ACTIVE"` — la baja y la suspensión lo sacan solas.
6. No tiene 3 o más cargos vencidos impagos **o** `adminForcePublish === true`.
7. `hiddenByAdminAt === null` — la institución no lo bajó.

**Por qué una sola función y no siete chequeos repartidos:** es la lección que dejó
CompraMeLaFoto con los avisos de álbum listo. Cuando la regla vive en cada pantalla, las
pantallas se desincronizan y aparece el caso en que el directorio lista a alguien cuya ficha
devuelve 404.

La función devuelve **por qué no se ve**, no un booleano pelado. El portal necesita el motivo
para decírselo al socio (§5).

### La condición 6 merece una explicación

La regla estatutaria real —definida en la spec de alta y cobros, §7— es más fina: 3 cuotas
**seguidas** impagas, o 5 **alternadas** dentro de una ventana de 24 meses, o deuda de otros
conceptos mayor a 90 días. Los tres umbrales están guardados y son configurables por
institución (`MembershipDuesSettings.consecutiveUnpaidThreshold`, `alternateUnpaidThreshold`,
`alternateWindowMonths`).

**Ninguno de los tres lo lee ningún código todavía.** El cálculo de morosidad no existe.

Este módulo usa lo que sí existe: `overdueCount`, la cantidad de cargos vencidos con saldo que
ya calcula `lib/membership/balance.ts`. Con umbral 3.

Es una aproximación, y hay que decirlo: no distingue seguidas de alternadas, ni respeta la
ventana de 24 meses. Cuando se construya el cálculo de morosidad de verdad, **se cambia una
línea de esta función y nada más**. Por eso la condición vive acá adentro y no desparramada.

### El riesgo del falso deudor, y cómo se cubre

La migración del historial de pagos está incompleta: hay 48 socios con pagos anteriores a
10/2025 que todavía no se importaron. Para el sistema, esos socios deben cuotas que ya
pagaron. Si el portfolio se apagara en silencio, el socio vería desaparecer su obra del sitio
de su institución sin entender por qué, y la Secretaría recibiría el reclamo sin saber de
dónde salió.

Dos coberturas:

1. **El socio ve el motivo exacto en su portal.** "Tu portfolio no se está mostrando porque
   figurás con 3 cuotas vencidas", con el enlace a su cuenta.
2. **La institución puede publicarlo igual**, con un clic y un motivo, sin tocar la deuda.
   Eso es `adminForcePublish`.

Una regla automática sin una forma humana de contradecirla es una trampa.

---

## 5. El socio lo arma

Portal → **Mi portfolio**, entrada nueva en el menú del portal, visible sólo si el módulo está
encendido.

La pantalla, de arriba hacia abajo:

**El estado, primero.** Un cartel que dice si el portfolio está al aire y, si no lo está, cuál
de las siete condiciones falta y qué hacer al respecto. Cada motivo con su acción: dar el
consentimiento ahí mismo, subir la primera foto, ver la cuenta, o —cuando es una decisión de
la institución— el texto de que hablen con la Secretaría.

**Las fotos.** Grilla, arrastrar para ordenar (con `@dnd-kit`, que ya está en el proyecto),
una estrella para marcar la destacada, título y año opcionales por foto. Contador visible:
"14 de 20".

**El interruptor de publicar**, al final. Si todavía no dio el consentimiento, el interruptor
lo pide antes en lugar de fallar.

Lo que el socio **no** puede hacer: ver ni tocar el portfolio de otro. Todas las acciones
resuelven el socio desde la sesión, nunca desde un id que mande el navegador — el mismo patrón
que ya usan el resto de las acciones del portal.

---

## 6. La institución lo controla

Panel → **Portfolios**, dentro del módulo.

Una lista: quién publicó, quién no, cuántas fotos tiene cada uno, y el estado de cada
portfolio con su motivo cuando no está al aire. Sirve tanto para controlar como para saber a
quién hay que recordarle que cargue sus fotos.

Dos acciones, las dos con **motivo obligatorio** y las dos registradas en la auditoría del
socio (`MemberAudit`, con dos acciones nuevas: `PORTFOLIO_HIDDEN` y `PORTFOLIO_RESTORED`):

- **Bajar del sitio** — deja el portfolio intacto y lo saca de lo público.
- **Publicar igual** — el perdón de deuda de §4.

La institución **nunca edita ni borra las fotos de un socio**. Puede sacarlas de la vista;
la obra es de quien la hizo.

---

## 7. El sitio público

Dos páginas, dentro del armazón del sitio del workspace, con su paleta, su encabezado y su
pie:

```
/w/{slug}/socios            → el directorio
/w/{slug}/socios/{socio}    → la ficha de un socio
```

**El directorio.** Grilla de tarjetas: foto destacada, nombre, nombre del estudio si tiene,
especialidades. Filtro por especialidad. Orden alfabético por apellido.

**La ficha.** Foto de perfil, nombre, estudio, presentación, especialidades, enlaces al sitio
y a las redes, y la galería con visor a pantalla completa. Los enlaces salientes van con
`rel="noopener noreferrer"`.

**El menú.** Una entrada nueva en `PUBLIC_MODULE_PAGES`, que ya es la única fuente de verdad de
qué páginas aporta cada módulo al sitio. Aparece sola cuando el módulo está encendido y
desaparece sola cuando no, y con ella el segmento queda reservado para que una página del
dueño no lo tape.

**La etiqueta del menú sigue el vocabulario del workspace.** Hoy `PUBLIC_MODULE_PAGES` sólo
admite etiquetas fijas —lo dice su propio comentario: *"Ojo: el vocabulario por workspace
todavía no se aplica acá"*. Este módulo lo necesita: una institución de voluntarios no tiene
un menú que diga "Socios". Se agrega a la entrada la posibilidad de declarar que su etiqueta
sale del vocabulario, y el menú la resuelve. Es un cambio chico y contenido, y deja el camino
hecho para los otros módulos.

**La dirección, en cambio, no cambia nunca: siempre `/socios`.** Si el segmento siguiera a la
palabra elegida, cambiar una palabra en Configuración rompería todos los enlaces publicados.
La palabra es de cara al visitante; la dirección es un compromiso.

**Módulo apagado → 404**, igual que Cursos o Reservas. No una página vacía: una página vacía
le dice al visitante que la institución abandonó algo.

**SEO.** Título y descripción por ficha, Open Graph con la foto destacada —para que compartir
el enlace de un socio en WhatsApp muestre su obra y no el logo de la institución—, y las
fichas publicadas en el `sitemap.xml` del sitio.

---

## 8. Las fotos

**Preset nuevo**, en `lib/images/presets.ts`, que ya es la fuente única de "para qué se usa
esta imagen":

- Sin proporción forzada. Es obra: hay panorámicas, verticales y cuadradas, y recortarlas
  sería decidir por el fotógrafo. Requiere admitir presets sin relación de aspecto, que hoy
  no existe.
- Mínimo 1000 px de lado mayor, hasta 10 MB, JPEG / WebP / PNG.

**Namespace propio en R2**: `fotoffice/member-portfolio/{workspaceId}`, agregado a
`r2-key-policy.ts`. FOTOFFICE comparte el bucket con las otras apps del monorepo y no puede
tocar lo que no es suyo; el borrado de una foto pasa por `assertFotofficeDeletableR2Key`, que
ya existe.

### Subida directa, sin pasar por el servidor

El navegador pide una **URL firmada** de un solo uso, sube el archivo directo a R2, y recién
después una acción del servidor registra la foto en la base.

**Por qué no se sube por el servidor como el resto de las imágenes:** las funciones de Vercel
rechazan cualquier pedido de más de 4,5 MB con `413`. Para un logo alcanza; para la obra de un
fotógrafo, no. Es el mismo problema que el módulo de Cursos ya resolvió con los videos de las
clases, y con la misma forma.

Requiere `@aws-sdk/s3-request-presigner`, que ya está en el lockfile del monorepo —lo usan
CompraMeLaFoto y FotoRank— en la misma versión mayor que el resto del SDK que FOTOFFICE ya
tiene. No entra una dependencia nueva a la casa: se declara una que ya vive acá.

**Requiere también CORS en el bucket** para el dominio de FOTOFFICE. Sin eso el navegador
rechaza la subida y el error no dice por qué. Es configuración, no código, y va en la etapa 5.

### Qué pasa cuando se borra una foto

Se borra de la base y de R2. Si era la destacada, la destacada pasa a ser la primera que
quede. Si era la única, el portfolio deja de cumplir la condición 4 y sale del sitio solo — y
el socio lee exactamente eso en su portal.

---

## 9. Riesgos

| Riesgo | Cobertura |
|---|---|
| Un socio al día marcado como deudor por la migración incompleta | El motivo visible en el portal, más "publicar igual" en el panel (§4) |
| El directorio estrena vacío | El orden de las etapas: se carga antes de que se vea (§10) |
| Alguien sube la foto de otro | Es responsabilidad del socio, igual que su presentación. La institución puede bajar el portfolio |
| El slug de un socio choca con el de otro | Sufijo numérico al crear, unicidad garantizada en la base |
| Una página del dueño llamada `socios` tapa el directorio | El segmento entra en `SITE_RESERVED_SEGMENTS`, que ya se deriva solo |
| La galería pesa en celular | Alto y ancho guardados, carga diferida, y el tope de 20 |
| El vocabulario cambia y rompe enlaces | La dirección no sigue al vocabulario: siempre `/socios` (§7) |

---

## 10. Etapas

1. **Base y regla.** Las dos tablas y su migración, las dos acciones nuevas de auditoría, el
   preset, el namespace de R2, el alta del módulo en el catálogo, y la función única de
   visibilidad con sus tests. Sin pantallas: acá se prueba la regla, que es lo que después
   nadie vuelve a mirar.
2. **El socio lo arma.** Portal → Mi portfolio: subida directa, orden, destacada, tope, el
   cartel que explica por qué no se ve, y el consentimiento.
3. **El sitio lo muestra.** El directorio, la ficha, la entrada en el menú con vocabulario,
   SEO, Open Graph y sitemap.
4. **La institución lo controla.** El listado del panel, bajar con motivo, publicar igual, y
   la auditoría.
5. **Encendido.** CORS del bucket, la migración aplicada en las bases que corresponda, y el
   módulo prendido donde se quiera usar. Encender un módulo son dos cosas: el código y la
   base.

**El orden de 2 y 3 no es negociable.** Si la página pública sale antes que la carga, la
institución estrena un directorio vacío y después pide contenido; así, los socios cargan
mientras nadie mira, y el directorio sale al aire con obra adentro.

---

## 11. Verificación

Cada etapa cierra con sus tests pasando y, desde la 2, con la pantalla vista andar en el
navegador. Nada se da por terminado sin haberlo visto funcionar.

La verificación de punta a punta, al cerrar la etapa 4:

1. Un socio sin consentimiento no aparece, y su portal le dice que falta el consentimiento.
2. El mismo socio lo da, sube fotos y publica: aparece en el directorio y su ficha abre.
3. Se le da la baja: desaparece del directorio y su ficha devuelve 404. Sus fotos siguen
   guardadas.
4. Se lo reactiva: vuelve a aparecer, con sus fotos y su orden intactos.
5. Un socio con 3 cuotas vencidas no aparece, y su portal dice exactamente eso.
6. La institución lo publica igual: aparece, sin que la deuda se toque.
7. La institución baja un portfolio con motivo: desaparece, y el motivo queda en la auditoría
   del socio.
8. Con el módulo apagado, las dos direcciones devuelven 404 y la entrada sale del menú.
9. Un socio no puede ver ni modificar el portfolio de otro.
10. En una institución con otro vocabulario, el menú dice su palabra y la dirección sigue
    siendo `/socios`.
