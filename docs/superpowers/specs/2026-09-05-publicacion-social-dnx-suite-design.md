# Publicación social de DNX Suite

**Fecha:** 2026-09-05
**Apps:** `compramelafoto`, `fotoffice`, `fotorank`, `clickaton`
**Paquetes:** `@repo/social-publisher`, `@repo/design-studio`, `@repo/social-pieces` (nuevo)
**Estado por defecto:** simulacro (`DNX_SOCIAL_PUBLISHER_LIVE` ausente = no publica nada real)

---

## 1. Objetivo

Que cada plataforma de la suite publique en su propia cuenta de Instagram las piezas que
la comunidad genera —álbumes nuevos, socios nuevos, sponsors, obras ganadoras,
participantes— **etiquetando a la gente y a las empresas que participan**, de modo que la
difusión le llegue también a ellos y el conjunto se lea como una comunidad y no como
cuatro productos sueltos.

Todo pasa por una cola de aprobación. **Nada llega a Instagram sin un clic humano.**

## 2. La corrección que ordena todo: etiquetar no es conectar

Son dos capacidades independientes y conviene no mezclarlas nunca:

| | Conectar una cuenta | Etiquetar a alguien |
|---|---|---|
| Qué logra | El post sale **desde** ese feed | La persona queda como coautora o mencionada |
| Qué necesita | OAuth, token cifrado, renovación cada 50 días | **Solo su @usuario** |
| Revisión de Meta | Sí, si la cuenta no es propia | No |
| Acción de la persona | Autorizar la app | Aceptar la invitación (solo para coautoría) |

**La comunidad se construye etiquetando, no conectando.** El socio, el sponsor, el
ganador, el organizador, el fotógrafo y CLF entran todos como etiquetas o menciones.

Los @usuarios **ya están en la base**, dispersos pero completos: `Member.instagram`,
`MembershipApplication.instagram`, `FotorankProfile.instagram`,
`FotorankContestParticipant.instagramHandle`, `ClickatonRegistration.instagramHandle`,
`DnxPartner.instagram`, `CommunityProfile.instagram` y los sponsors de landing de
organizador. No hay que pedir datos nuevos ni migrar nada: alcanza con normalizarlos al
leerlos.

**Conclusión: cuatro conexiones, no miles.** Una por plataforma, hecha una vez por el
admin de esa plataforma.

## 3. Restricciones estructurales

**Cada app tiene su propia base Neon.** El schema es compartido, pero CLF apunta a
`ep-proud-wildflower` y fotoffice a `ep-dawn-dew`. Una cuenta conectada en una app no se
ve desde otra. Por eso no hay panel social único: cada app conecta su cuenta, tiene su
cola y su panel. La capacidad se comparte como **paquetes**, no como servicio.

**fotoffice es multi-institución.** La bienvenida a un socio la publica la institución, no
DNX. Ahí la cuenta se conecta **por workspace**. Para evitar tocar el schema —un campo
nuevo hay que aplicarlo a mano en las cinco bases— el alcance se guarda en
`DnxSocialAccountGrant.application` con la forma `FOTOFFICE:{workspaceSlug}`, que es un
campo de texto que ya existe justamente para esto.

**Sin cambios de schema.** Todo lo que hace falta ya está en los modelos `DnxSocial*` y en
los campos de Instagram existentes.

## 4. Arquitectura

| Pieza | Responsabilidad | Qué no hace |
|---|---|---|
| `@repo/design-studio` | Arma la imagen: layout, tipografía, huecos de foto, variables, QR | No sabe de red, ni de tokens, ni de colas |
| `@repo/social-publisher` | Publica: estados, tokens, reintentos, auditoría, Meta | No sabe de diseño ni de negocio |
| `@repo/social-pieces` (nuevo) | Une los dos: plantilla + datos → JPEG → R2 → solicitud. Y arma copy y menciones | No decide cuándo publicar |
| Cada app | Decide cuándo, con qué datos y con qué permiso | No habla con Meta directo |

**Por qué el Designer arma la pieza pero no publica.** El Designer es un motor de
documentos y a propósito no sabe de red: recibe bytes y devuelve un archivo. Publicar
tiene estados, reintentos, auditoría y secretos; diseñar no tiene nada de eso. Si se
mezclan, cada retoque de diseño toca el código que guarda los tokens de Meta.

**Por qué el Designer y no `@repo/media-composition`.** El otro motor es más liviano, pero
sus plantillas son objetos de TypeScript: cambiar el diseño significa tocar código. Como
cada plataforma —y en fotoffice, cada institución— necesita su propia estética, la
plantilla tiene que ser un dato. El Designer ya renderiza bloques de imagen con recorte y
máscara, texto con variables y QR, y su cadena PDF → PNG está en producción hoy (diplomas
de FotoRank, carnets de fotoffice).

## 5. Catálogo de piezas

"Se arma sola" significa que **la pieza se genera y queda esperando en el panel**. La
publicación siempre la aprueba una persona.

| App | Pieza | ¿Se arma sola? | Disparador | Datos |
|---|---|---|---|---|
| CLF | Álbum listo: carrusel + historia | Sí | `album-analysis-readiness` dice listo | Álbum, 3-4 fotos elegidas, @fotógrafo |
| CLF | Bienvenida a fotógrafo nuevo | Sí | Alta verificada | Perfil, avatar, @ |
| fotoffice | Bienvenida a socio nuevo | Sí | Alta aprobada | `Member`: nombre, foto de portal, @, categoría |
| fotoffice | Bienvenida a sponsor | No | A mano | `DnxPartner` / sponsors: nombre, logo, @ |
| fotoffice | Carnet | **Nunca se publica** | — | — |
| FotoRank | Obras ganadoras | No, pieza pregenerada | A mano tras el fallo | Obra, autor, @, organizador, sponsors |
| FotoRank | Bienvenida a participante | Sí | Inscripción confirmada | `FotorankContestParticipant` |
| Clickatón | Bienvenida | Ya existe | Pago acreditado | `ClickatonRegistration` |

### El criterio de qué se arma solo

Se arma sola la pieza que es **frecuente, repetitiva y de bajo riesgo**, con datos
estructurados y completos: la plantilla siempre sirve y equivocarse es barato.

Se arma a mano la pieza **rara, valiosa y donde el texto es el producto**: sponsors y
obras ganadoras. Ahí la máquina pregenera la imagen —que es el trabajo aburrido— y la
persona escribe el copy.

### El carnet queda afuera

El carnet lleva el número de documento del socio. Publicarlo sería filtrar datos
personales de gente que no lo autorizó. El Designer lo sigue emitiendo; el motor social no
lo toca. Ninguna plantilla de publicación puede leer campos de documento.

## 6. Menciones y etiquetas

| | Carrusel / Post | Historia | Reel |
|---|---|---|---|
| Copy con menciones `@` | Sí | No hay copy | Sí |
| Etiqueta de colaborador | Sí | **No** | Sí |
| Etiqueta sobre la foto (`user_tags`) | Sí | No | No |

### Lista priorizada de menciones

**Cuántos colaboradores admite Instagram no está claro:** las fuentes dan 3, 4 o 5 según
la época y el tipo de cuenta. El diseño no puede depender de ese número.

Cada pieza arma una **lista ordenada por prioridad** de las cuentas a mencionar —por
ejemplo, para un álbum: fotógrafo → organizador → sponsor → CLF. Las primeras se envían
como colaboradores; **las que sobran caen automáticamente al copy** como menciones de
texto. Si Meta rechaza la lista por exceso, el motor reintenta con una menos y baja esa al
copy. Así la pieza sale siempre, sea cual sea el límite vigente.

Regla: **nadie desaparece.** Toda cuenta de la lista termina o etiquetada o mencionada.

### En historias no se puede etiquetar

Meta no permite agregar stickers por API: ni link, ni mención, ni hashtag, ni música. No
hay permiso que lo habilite. Como la pieza la arma el Designer, la historia lleva el logo
y el `@` **impresos en la imagen**, más la dirección web legible. Se acepta que no sean
tocables.

### La coautoría hay que aceptarla

Quien queda como colaborador **tiene que aceptar la invitación desde su celular** para que
el post aparezca en su perfil; hasta entonces vive solo en el feed de quien publicó. Esto
se le explica a la persona en la misma pantalla donde da el permiso o deja su usuario, o
va a parecer que el sistema falló.

## 7. El módulo de conexión

Es lo único que se construye de cero: hoy no existe ningún flujo OAuth con Meta en el
monorepo.

**Método: "Instagram Login"**, no Facebook Login — *no exige una página de Facebook
vinculada*. Permisos: `instagram_business_basic` e `instagram_business_content_publish`.

**Piezas:** una ruta que arranca el login, una ruta de retorno que canjea el código por un
token de larga duración y lo guarda cifrado en `DnxSocialAccount` (el `vault` AES-256-GCM
ya existe), y una pantalla que muestra la cuenta conectada, su estado y permite
desconectarla.

**Renovación de token — no es opcional.** Los tokens duran **60 días** y se renuevan contra
`GET /refresh_access_token` si tienen al menos 24 horas y no vencieron. Un cron renueva
toda cuenta a la que le queden menos de 10 días y marca la cuenta como caída si falla.
**Sin esto todo funciona dos meses y después deja de funcionar solo, sin error visible.**
Es la forma más común en que estas integraciones se rompen en producción.

**Solo cuentas propias de cada plataforma.** Publicar desde cuentas de terceros exige
acceso avanzado y revisión de app de Meta. No hace falta para nada de lo de acá.

## 8. El permiso

**En CLF, por álbum.** El fotógrafo elige entre 3 y 4 fotos "para redes" (con menos de 3
no se genera nada; el orden de selección es el orden del carrusel), tilda el permiso de
difusión y deja su usuario de Instagram. **Sin permiso o sin fotos elegidas no se genera
ninguna solicitud.** Es la protección de fondo: los álbumes de CLF incluyen eventos
escolares y deportivos con menores y con gente identificable. El permiso lo da quien tiene
la relación con las personas fotografiadas.

**En las bienvenidas, por persona.** Socio, participante y fotógrafo nuevo tildan al
registrarse si quieren aparecer. Sin tilde no se genera la pieza. La foto que se usa es la
de perfil que la persona eligió mostrar, nunca la de documento.

**El usuario de Instagram vive en el perfil de la persona**, se pide una vez y se reusa.
El permiso es por pieza. Se normaliza con `normalizeInstagramHandle` de
`@repo/media-composition`, que ya existe y rechaza entradas inválidas en vez de
silenciarlas.

## 9. La pieza

Plantillas del Designer, una por marca y por tipo. Variables según la pieza:
`{{nombre}}`, `{{fecha}}`, `{{arroba}}`, `{{url}}`, `{{categoria}}`, `{{concurso}}`.

| | Carrusel | Historia |
|---|---|---|
| Medida | 1080×1350 | 1080×1920 |
| Texto | En el copy | Impreso en la imagen |
| Link | En el copy | Impreso, no tocable |

**Las fotos de álbum van con marca de agua**, las mismas derivadas que usa la galería
pública: publicar el original sería regalar el producto que se vende.

**Cadena de render:** documento del Designer → PDF → PNG → `sharp` → **JPEG**. La
conversión final es obligatoria: **Meta acepta únicamente JPEG**, ni PNG, ni WEBP, ni
JPEG extendido. El archivo sube a R2, que es de donde Meta lo lee: la API exige una URL
pública y no acepta recibir bytes.

## 10. El motor

Al provider de Instagram se le agrega:

**Carrusel** — un contenedor por foto con `is_carousel_item=true`, después un contenedor
padre con `media_type=CAROUSEL`, la lista de hijos, el copy y `collaborators`, y recién
ahí se publica el padre. El parámetro de colaboradores va **en el padre, nunca en los
hijos**: ponerlo en los hijos es un error conocido que hace fallar la publicación.

**Historia** — contenedor con `media_type=STORIES` y publicación. Sin copy ni
colaboradores.

**Menciones** — la lista priorizada del punto 6, con caída al copy.

**Límite de Meta:** 100 publicaciones por API cada 24 horas por cuenta; un carrusel cuenta
como una. El motor consulta el límite antes de publicar y difiere en vez de fallar si está
cerca.

## 11. Cableado por app

Cada app monta lo mismo: su `prisma-store`, su cron `/api/cron/social-publish`
autenticado con `CRON_SECRET`, y su panel de aprobación. El patrón ya existe y funciona en
`apps/clickaton/lib/social-publisher/`.

**Los disparadores son soft-fail:** si crear la solicitud falla, no debe romper la
operación que lo disparó (el correo al cliente, el alta del socio, la inscripción). Es el
criterio que ya usa Clickatón tras el pago.

**Una solicitud por publicación, no por evento.** El carrusel y la historia de un álbum
son dos solicitudes distintas —distinto contenedor, una puede fallar sin la otra—, con
claves idempotentes propias y enlazadas por `metadata`. El panel las muestra como una
tarjeta y las aprueba juntas; se pueden rechazar por separado.

## 12. Variables de entorno

| Variable | Uso |
|---|---|
| `DNX_SOCIAL_VAULT_MASTER_KEY` | Cifrado de tokens (base64, 32 bytes). Ya existe |
| `DNX_SOCIAL_PUBLISHER_LIVE` | `true` para publicar de verdad. Ausente = simulacro |
| `META_APP_ID` / `META_APP_SECRET` | App de Meta para el login |
| `META_OAUTH_REDIRECT_URL` | Ruta de retorno del login, una por app |
| `CRON_SECRET` | Autenticación del cron. Ya existe |

## 13. Pruebas

Siguiendo el patrón de `decideAlbumReadiness`: las decisiones puras se testean sin base.

- **Decisión:** si corresponde generar la pieza (permiso, datos completos, no duplicada).
- **Menciones:** que la lista priorizada reparta bien entre colaboradores y copy, que
  nadie se pierda, y que al rechazar Meta se degrade a una menos.
- **Meta:** con un `fetch` falso, como el test que ya existe en el paquete. Carrusel de
  tres pasos, historia, colaboradores en el hijo (debe fallar), límite alcanzado.
- **Render:** JPEG, medida correcta, sin variables sin resolver.
- **Token:** renueva con menos de 10 días, no renueva con menos de 24 horas, marca caída
  si Meta rechaza.
- **Privacidad:** ninguna plantilla de publicación puede resolver campos de documento.

## 14. Riesgos

| Riesgo | Mitigación |
|---|---|
| El token vence a los 60 días y todo muere en silencio | Cron de renovación + estado visible + registro al fallar |
| Se publica una foto de un menor o de alguien que no quiere | Permiso explícito por álbum y por persona; sin permiso no se genera |
| Se publica algo desafortunado | Cola de aprobación: nada sale sin un clic |
| Meta cambia el límite de colaboradores | Lista priorizada con caída al copy y reintento con una menos |
| Se filtra un dato personal en una pieza | El carnet queda afuera; test que prohíbe campos de documento |
| El render pesado rompe el empaquetado | Ya resuelto con `serverExternalPackages`; se copia esa configuración |
| La persona no acepta la coautoría y cree que falló | Se le explica en la pantalla del permiso |

## 15. Decisiones cerradas

1. Publica **la cuenta de cada plataforma**; las personas se **etiquetan**, no conectan.
2. En fotoffice, **una cuenta por workspace**, con el alcance en `grant.application`.
3. **Cola de aprobación** siempre. "Automático" es la generación, no la publicación.
4. **Carrusel e historia.** Nada de Reels en esta etapa.
5. Se arma solo lo **frecuente y de bajo riesgo**; sponsors y ganadores se escriben a mano.
6. **El carnet no se publica nunca.**
7. **La pieza se diseña en el Designer**, no se codea.
8. **Sin cambios de schema.**
9. La historia lleva link y `@` **impresos**, no como stickers.

## 16. Fuera de alcance

**Que cada persona conecte su propia cuenta.** Exige acceso avanzado y revisión de app de
Meta —screencast, semanas, rechazo frecuente— y renovar tokens de cientos de cuentas. No
hace falta para nada de lo de acá: la coautoría da la misma visibilidad. El modelo lo
soporta (`DnxSocialAccountGrant`), así que si algún día se quiere, es cableado.

**Stickers tocables en historias.** Meta no lo permite por API. No hay rodeo.

**Reels, videos y YouTube.** Nota para esa etapa: los videos subidos por API desde un
proyecto no auditado por Google **quedan bloqueados como privados**.

**Panel social único para toda la suite.** Lo impide la separación de bases.

## 17. Etapas

| Etapa | Qué entrega |
|---|---|
| 1 | Conexión con Meta y renovación de token, en `@repo/social-publisher` |
| 2 | Carrusel, historia y menciones priorizadas en el provider |
| 3 | `@repo/social-pieces`: plantilla + datos → JPEG → R2 → solicitud |
| 4 | CLF: permiso y elección de fotos, disparador, cron y panel |
| 5 | fotoffice: bienvenida a socio (automática) y sponsor (a mano), por workspace |
| 6 | FotoRank: bienvenida a participante y obras ganadoras |
| 7 | Clickatón: migrar lo existente al motor ampliado |

Las etapas 1 a 4 son el camino crítico y dejan CLF publicando. De la 5 en adelante cada
app es cableado, no diseño.
