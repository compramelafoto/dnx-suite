# Públicos de Meta para captar fotógrafos (CompraMeLaFoto, Argentina)

Fecha: 14/11/2026 · Base: producción CLF (Neon `divine-hall-10689679`, rama `br-autumn-rain-ad18wq7y`), consultas de solo lectura.
Nada se subió a Meta. Esto no es asesoramiento legal: antes de la primera subida conviene que lo mire un abogado.

## En resumen

1. **Hoy no conviene subir ninguna lista a Meta.** No por falta de personas, sino porque CompraMeLaFoto
   todavía no tiene derecho claro a usar esos correos para publicidad en Meta:
   - La política de privacidad dice que el marketing es «solo con consentimiento explícito (opt-in)» y,
     en «Con quién los compartimos», no nombra a Meta.
   - El registro de fotógrafo **no tiene casilla ni aviso**: el sistema marca `marketingOptIn = true` solo
     (`lib/auth/register-account-request.ts`). Ese «sí» no es un consentimiento real.
   - El permiso «desde el perfil» tampoco: al abrir Configuración (fotógrafo) o el panel del cliente, el
     sistema lo activaba solo y **borraba la baja** de quien se había dado de baja.
2. **Se destraba con el PR de este mismo trabajo** más un correo de aviso (ver «Antes de subir»).
3. **Lo que sí se puede hacer ya, sin subir nada:** los públicos del sitio con el píxel y las campañas por
   intereses con la landing de cada nicho.
4. **Solo dos públicos de origen llegan a 100:** «fotógrafos que vendieron» (136) y, si se suman los
   inscriptos de la charla de foto escolar, «escolar» (123). Deportivo (29) y turismo (no medible) no llegan.

## 1. De dónde salen las listas y si se pueden usar en Meta

| Lista | Dónde vive | De dónde salió | ¿Se puede subir a Meta? |
|---|---|---|---|
| Fotógrafos registrados en CLF | CLF, tabla `User` | Se registraron ellos | **Sí, después del aviso.** Hay relación directa con la persona. |
| Inscriptos a charlas (`TalkLead`) | CLF | Formularios de charlas (foto escolar y SFPR) | **Solo los que se inscriban después del aviso** que agrega el PR. Los 130 de hoy, solo para correo con baja. |
| **Contactos del Buscador** (`DnxContacto*`) | **Base de FOTOFFICE**, panel `/admin/contactos-dnx` | El agente Buscador los encuentra con Google Maps y búsqueda web y guarda solo datos comerciales **publicados** en la web o redes del propio negocio, con su enlace de origen | **No. Solo para correo con baja.** |
| `BotOutreach` (350) | CLF | Registro de los mensajes del DNX Bot a usuarios inactivos | No es una lista nueva: son los mismos usuarios de `User`. |
| `SchoolOutreachProspect` (25) | CLF | Administraciones de colegios | No sirve: son escuelas, no fotógrafos. |
| `SchoolLead`, `DnxCourseLead`, `CourseSalesLead`, `CharlaFotoEscolarLead` | CLF | — | Vacías o con 1 fila. |

**Por qué los contactos del Buscador no van a Meta (ni siquiera para similares):**

- Meta exige, en sus condiciones de públicos personalizados, que quien sube la lista haya **avisado** a esas
  personas y tenga **el permiso o la base legal** para usar sus datos así. Al que encontró el Buscador nadie
  le avisó nada: no sabe que DNX tiene su correo.
- La Ley 25.326 deja usar datos de fuentes públicas para ofrecer servicios (art. 27), pero con la persona
  pudiendo pedir la baja en cualquier momento. Mandarle un correo con baja de un clic cumple eso; subirla
  a Meta para perfilarla es otro uso que no esperaba.
- Además rinde poco: son correos comerciales (`info@estudio...`) que casi nunca coinciden con una cuenta
  personal de Facebook o Instagram, y como semilla de similares enseñan a Meta a buscar «gente que no
  compró», cuando lo que queremos es gente parecida a los que **sí** venden.
- **El camino correcto:** escribirles por correo con baja; los que entran al sitio o se registran quedan en
  los públicos del píxel y, ya como usuarios de CLF, en las listas que sí se pueden subir.

## 2. Conteos por nicho (fotógrafos de Argentina, sin bloqueo y sin baja)

Todos cuentan una vez publicada la política nueva y enviado el aviso con baja. No hay un «modo
estricto» posible: ningún permiso guardado hasta hoy es un consentimiento real (ni «signup» ni «profile»).

| Público de origen | Personas | ¿Llega a 100? |
|---|---:|---|
| **General: vendieron** (pedido pagado) | **136** | ✔ |
| General: tienen algún álbum | 258 | ✔ |
| Todos los fotógrafos registrados | 831 | ✔ |
| **Escolar** (álbum SCHOOL o con colegio) | 15 | ✘ |
| Escolar + inscriptos de la charla de foto escolar (los 111 de hoy) | 123 | ✔ en número, pero **no se pueden usar**: se inscribieron sin aviso |
| **Deportivo** (álbum SPORTS) | 29 (14 vendieron) | ✘ |
| **Turismo** | no medible | ✘ |

Notas:
- **Turismo no se puede medir**: CLF no tiene un tipo de álbum «turismo». Los más cercanos (sesión
  pública, fotografía pública, festival) suman 6 fotógrafos. El 93 % de los álbumes no tiene tipo cargado.
- Los inscriptos de la charla solo cuentan desde que el formulario muestra el aviso (este PR). El
  script los filtra con `--incluir-charlas-desde`. El similar escolar queda para cuando junten ~90 nuevos.
- Hay 7 fotógrafos con álbum fuera de Argentina: el script los deja afuera.

## 3. Estructura recomendada

### A. Públicos del sitio (píxel) — se pueden armar ya
El píxel es parte del sitio y se cubre con el aviso de cookies; igual hay que nombrarlo en la política.

| Público | Regla | Uso |
|---|---|---|
| Visitó la home o una landing de nicho, 30 días | URL contiene `/`, landings de escolar/deportivo/turismo | Remarketing |
| Inició registro sin terminar, 30 días | visitó `/registro` y **no** disparó CompleteRegistration | Remarketing «terminá tu cuenta» |
| Se registró sin primer álbum, 60 días | CompleteRegistration y no PrimerAlbum | Remarketing de activación |
| Creó álbum sin vender, 90 días | PrimerAlbum y no PrimeraVenta | Contenido de «cómo vender» |
| **Ganados: PrimeraVenta, 180 días** | evento PrimeraVenta | **Semilla de similar** cuando junte 100, y exclusión |

### B. Similares (después de los arreglos)
1. **Similar general «vendieron» al 1 % Argentina** — semilla 136. Es la campaña principal.
2. **Similar escolar al 1 %** — cuando usuarios escolares + inscriptos nuevos de la charla lleguen a 100.
   Mientras tanto, escolar va por intereses con su landing.
3. **Similar «PrimeraVenta» del píxel** — cuando el evento junte 100 personas, reemplaza a la lista subida
   y se actualiza sola.

### C. Nichos que no llegan: campañas por intereses + landing del nicho
- **Deportivo** (29): intereses fotografía deportiva, fútbol amateur, running, ciclismo, maratones;
  landing de deportes.
- **Turismo** (sin medir): intereses fotografía de viajes, turismo, fotógrafos de excursiones;
  landing de turismo. Para que en el futuro se pueda medir, sumar «Turismo» al tipo de álbum.
- Todas en Argentina, 22 a 55 años, con la exclusión de abajo.

### D. Exclusiones (en todas las campañas de captación)
- Lista **«fotógrafos registrados»** (855, incluye los que no tienen álbum): no pagar por mostrar
  «registrate» a quien ya tiene cuenta.
- Público del píxel **CompleteRegistration, 180 días** (cubre a los que se registran después de subir la lista).

## Antes de subir cualquier lista

Resuelto en el PR de esta rama (`feat/clf-privacidad-publicidad-meta`):
1. **Política de privacidad**: nueva sección «Publicidad en redes sociales (Meta)» que cuenta qué manda el
   píxel y la API de conversiones (email, teléfono e identificador cifrados; IP, navegador y el monto de la
   primera venta), qué son los públicos personalizados y cómo oponerse. Meta figura entre los proveedores.
2. **Registro** (general y organizador): casilla de novedades **sin marcar**.
3. **Paneles**: se sacó la reactivación automática; el fotógrafo tiene el interruptor «Novedades y
   publicidad» en Configuración → Datos. Desactivarlo marca la baja (`unsubscribedAt`).
4. **Formulario de charlas**: aviso de uso de datos con enlace a la política.

Queda para Daniel:
5. **Correo de aviso a los fotógrafos actuales** (texto abajo), con baja de un clic. Esperar ~15 días.
6. Recién ahí correr el script con `--politica-actualizada`.

Pendiente aparte (no entra en este PR): el registro de embajadores de referidos
(`api/public/referral-ambassador/signup`) también fija el permiso en `true`, y el sitio no tiene aviso de
cookies para el píxel.

**Texto sugerido del aviso** — Asunto: «Actualizamos nuestra política de privacidad»

> Hola, {nombre}. Actualizamos la política de privacidad de ComprameLaFoto. Lo nuevo: usamos
> herramientas de Meta (Facebook e Instagram) para medir nuestros anuncios y mostrárselos a otros
> fotógrafos. Para eso podemos enviarle a Meta tu email cifrado; Meta no lo ve legible ni lo suma a tu
> perfil. Si no querés participar, tocá «No quiero» abajo o desactivá «Novedades y publicidad» en
> Configuración. Podés leer la política completa en compramelafoto.com/privacidad#publicidad.

## 4. Script de exportación

`apps/compramelafoto/scripts/meta-publicos/exportar-publicos-meta.ts` (cifrado en `cifrado.ts`, pruebas en
`cifrado.test.ts`, 5 de 5 pasan).

- Solo lee: todo corre en una transacción `READ ONLY`.
- Correos sin espacios, en minúsculas, sin duplicados, cifrados con SHA-256. El CSV nunca tiene un `@`.
- Escribe fuera del repositorio (por defecto `~/Desktop/publicos-meta-AAAA-MM-DD`) con permisos solo del
  dueño, y solo las listas que llegan a 100 (la exclusión siempre).
- Sin `--politica-actualizada` muestra los conteos y no escribe nada.
- Deja afuera de todas las listas, incluida la de exclusión, a quien se dio de baja.
- **No se corrió contra producción.** Las consultas se validaron aparte, solo contando.

```bash
cd apps/compramelafoto && npx tsx scripts/meta-publicos/exportar-publicos-meta.ts --politica-actualizada --incluir-charlas-desde AAAA-MM-DD
```

Después de subir los CSV al Administrador de públicos, borrar la carpeta.
