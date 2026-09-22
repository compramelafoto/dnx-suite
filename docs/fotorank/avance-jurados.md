# FotoRank — Altas de jurados: avance de obra

*Última revisión: 2026-09-21, después del despliegue.*

Mide el plan `docs/superpowers/plans/2026-09-20-fotorank-altas-de-jurados.md` y
`docs/superpowers/plans/2026-09-20-fotorank-ux-jurados-y-usuarios.md`, sobre el spec
`docs/superpowers/specs/2026-09-20-fotorank-altas-de-jurados-y-ux-design.md`.

Formato: [la convención](../00-convencion-de-avance.md). **Código** es escrito, probado y
mergeado. **Producción** es que corrió de verdad contra la base real y alguien lo miró.

**Desplegado a producción el 2026-09-21** (PR 205). La migración ya estaba aplicada en las
cinco bases. En la base de producción hay **0 cuentas de jurado**: el módulo está abierto y
todavía nadie lo usó.

Criterio de la columna de producción, acá:

- **✅** está desplegado **y** se verificó su comportamiento contra producción.
- **🟡** está desplegado, pero no se puede terminar de verificar hasta que haya un jurado
  real. Con cero jurados no hay nada que mirar.
- **⬜** no se puede verificar todavía.

Verificado contra `https://fotorank.dnxsuite.com` después del despliegue:
`/jurados/postulacion` responde 200, `/super-admin/jurados` manda al login sin sesión, un
enlace de verificación inválido contesta *"Este enlace no es válido"* en castellano, y la
ruta de la foto devuelve 404 —no 500— para un jurado que no existe.

<!-- avance: FotoRank jurados — Paso 0: el padrón único -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| 0.1 | Poner la rama al día con `origin/main` | ✅ | 🚫 | Sin conflictos; recupera los 8 commits de la maratón del 19/9 |
| 0.2 | Verificar las 45 pruebas de jurado | ✅ | 🚫 | 5+8+17+6+9 en verde, más 43 chequeos de subida de fotos |
| 0.3 | Fusionar el padrón único a `main` | ✅ | ✅ | PR #202 fusionado el 21/09 con 8 verificaciones en verde |
| 0.4 | Cargar las 4 variables del jurado compartido | 🚫 | ⬜ | Verificado el 21/09: ninguna está en Vercel. Sin ellas el código falla suave y FotoRank anda igual, sólo con sus concursos. Es configuración, no código |

<!-- avance: FotoRank jurados — Etapa A: cimientos -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| A.1 | La foto va al bucket privado, con el hash en la clave | ✅ | 🟡 | 6 pruebas. Desplegado. **Ninguna foto real se subió a R2 todavía** |
| A.2 | Ruta propia que sirve la foto, con cache permanente | ✅ | ✅ | 4 pruebas. En producción devuelve 404 para un jurado inexistente, no 500 |
| A.3 | Los doce consumidores pasados al nuevo almacenamiento | ✅ | ✅ | Incluye el directorio y la API pública. Las pantallas cargan en producción |
| A.4 | El jurado sube y quita su propia foto | ✅ | 🟡 | Desplegado. Falta que un jurado real lo haga |
| A.5 | El registro acepta la invitación sin asignación previa | ✅ | 🟡 | 3 pruebas. Desplegado. La invitación que existe sigue sin aceptar |

<!-- avance: FotoRank jurados — Etapa B: el alta por cuenta propia -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| B.1 | Máquina de estados de la revisión | ✅ | ✅ | 8 pruebas. El circuito entero corrió en vivo contra una copia de la base, y está desplegado |
| B.2 | Validación del formulario público | ✅ | ✅ | 11 pruebas. El formulario responde 200 en producción |
| B.3 | Verificación del correo | ✅ | ✅ | 10 pruebas. En producción, un enlace inválido contesta en castellano |
| B.4 | Migración: estado de revisión y origen del alta | ✅ | ✅ | **Aplicada en las 5 bases el 21/09** y registrada en `_prisma_migrations`. Los 5 controles dieron lo esperado en cada una |
| B.5 | Los dos correos nuevos | ✅ | ⬜ | La clave de Resend **sí** está en producción desde hace 47 días. **Ningún correo salió todavía** porque nadie se postuló |
| B.6 | La página `/jurados/postulacion` y su acción | ✅ | ✅ | **En producción**. Un alta quedó escrita en la copia: entra, no se publica sola |
| B.7 | La cola de revisión en Super Admin | ✅ | ✅ | Rechazo y aprobación probados en vivo. En producción, sin sesión manda al login |

<!-- avance: FotoRank jurados — Etapa C: el perfil completo -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| C.1 | El jurado carga sus URL, su Instagram y su teléfono | ✅ | 🟡 | 7 pruebas. Desplegado; falta un jurado real que cargue sus links |
| C.2 | La página pública respeta los interruptores de privacidad | ✅ | ✅ | 6 pruebas. Verificado en vivo: al apagar la web y la ubicación, desaparecen. Desplegado |

<!-- avance: FotoRank jurados — Etapa D: los jurados en el concurso -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| D.1 | Retrato, titular y carrusel con más de seis | ✅ | 🟡 | 3 pruebas. Verificado con 1 jurado (grilla) y 7 (carrusel). En producción no hay ninguno que mostrar |

<!-- avance: FotoRank jurados — Etapa E: la UX de jurados y usuarios -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| E.1 | Módulo que traduce cada estado al castellano | ✅ | 🟡 | 6 pruebas. Reutiliza StatusTone y PresentedStatus, que ya existían |
| E.2 | Fechas en lenguaje humano | ✅ | 🟡 | 8 pruebas. Verificado en vivo: "Entró el mes pasado", "Todavía no entró" |
| E.3 | Una sola tarjeta de jurado para todas las pantallas | ✅ | 🟡 | Reutiliza StatusBadge y EmptyState del propio FotoRank |
| E.4 | Las pantallas del organizador | ✅ | 🟡 | Lista verificada en vivo con 7 jurados y con la pantalla vacía |
| E.5 | Directorio, auditoría y portal del jurado | ✅ | 🟡 | Las dos estadísticas que nadie escribía salen de la pantalla y de los datos |
| E.6 | Super Admin: la cola y la sección de usuarios | ✅ | 🟡 | Se fueron los nombres de funciones internas. Las otras cuatro secciones no se tocaron |
| E.7 | Prueba que impide que vuelva a colarse un enum | ✅ | 🟡 | Verificada introduciendo un caso malo a propósito: lo detecta con archivo y línea |

<!-- avance: FotoRank jurados — Etapa F: portfolio y galería -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| F.1 | Claves y guardado de las imágenes | ✅ | ✅ | 7 pruebas. Mismo mecanismo que la foto de perfil |
| F.2 | El orden sin huecos ni empates | ✅ | 🟡 | 9 pruebas. Desplegado; nadie reordenó nada real todavía |
| F.3 | Migración de la tabla | ✅ | ✅ | **Aplicada en las 5 bases el 21/09**, con los 5 controles en verde en cada una |
| F.4 | Ruta que sirve las imágenes | ✅ | ✅ | En producción devuelve 404 para una imagen inexistente. Hash equivocado → 404 |
| F.5 | Subir, titular, ordenar y borrar | ✅ | 🟡 | Desplegado. Falta que un jurado real suba su primera foto |
| F.6 | Achicar las fotos en el navegador | ✅ | 🟡 | 8 pruebas. Desplegado; sin foto real que achicar todavía |
| F.7 | La sección de portfolio en el perfil | ✅ | 🟡 | Desplegado. `/jurado/perfil` pide sesión, como corresponde |
| F.8 | La foto en el formulario de postulación | ✅ | ✅ | El campo está en producción: "Tu foto", con el aviso de que se achica sola |
| F.9 | El portfolio en la página pública y el directorio | ✅ | 🟡 | Verificado con datos de prueba: galería, tira de tres y orden por ficha completa |
| F.10 | El cobro por foto calificada | 🚫 | 🚫 | **Bloqueado por Mercado Pago**: el split sigue en sandbox. Diseñado en el spec del 21/09 |
| F.11 | El anuncio del cobro al jurado | ✅ | 🟡 | Aviso de que va a poder cobrar por la plataforma, en la postulación y en "Modalidad económica". Se borra cuando F.10 se encienda |

<!-- avance: FotoRank jurados — Etapa G: jurado y participante a la vez -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| G.1 | "Panel de jurado" en el menú lateral | ✅ | ⬜ | En el panel de organizador y en el de participante. **Para marcarlo hace falta** entrar con una cuenta que sea las dos cosas y ver la entrada |
| G.2 | La cola de revisión, visible | ✅ | ⬜ | Atajo con el número y aviso en `/super-admin`. **Para marcarlo hace falta** entrar con `cuart.daniel@gmail.com` y ver "Jurados por revisar (2)" |
| G.3 | Guardia en `contarJuradosPendientes` | ✅ | ⬜ | Era una server action sin permiso: devolvía el número a cualquiera. **Para marcarlo hace falta** que un usuario común no vea el atajo |
| G.4 | Nadie juzga la categoría donde compite | ✅ | ⬜ | En las dos compuertas y en las dos bases. 18 pruebas, verificadas rompiendo la regla a propósito. **No se puede ejercer todavía**: no hay ningún jurado asignado a un concurso en producción |
| G.5 | Avisar al organizador al asignar | ✅ | ⬜ | La individual no se crea y explica por qué; la masiva saltea y lo informa. 8 pruebas. **Para marcarlo hace falta** intentar asignar a alguien que compita |
| G.6 | Aviso por correo de una postulación nueva | ✅ | ⬜ | A los super admins, al confirmarse el correo. **Nunca salió uno real**: se confirma con la próxima postulación |
| G.7 | Resolver las dos fichas que esperan | 🚫 | ⬜ | Daniel Caurt y Maria Belen Saldaña, con el correo confirmado desde el 21/09. No es código: se aprueban en `/super-admin/jurados` |
| G.8 | `dnxfotografia@gmail.com` no es super admin | 🚫 | ⬜ | Figura como usuario común, así que con esa cuenta la cola no se ve. Decidir si se le da el permiso o se administra con la otra |
