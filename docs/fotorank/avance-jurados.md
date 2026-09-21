# FotoRank — Altas de jurados: avance de obra

*Última revisión: 2026-09-21.*

Mide el plan `docs/superpowers/plans/2026-09-20-fotorank-altas-de-jurados.md` y
`docs/superpowers/plans/2026-09-20-fotorank-ux-jurados-y-usuarios.md`, sobre el spec
`docs/superpowers/specs/2026-09-20-fotorank-altas-de-jurados-y-ux-design.md`.

Formato: [la convención](../00-convencion-de-avance.md). **Código** es escrito, probado y
mergeado. **Producción** es que corrió de verdad contra la base real y alguien lo miró.

**Nada de esto está desplegado todavía.** En la base de producción hay 0 cuentas de jurado.

El 2026-09-21 el circuito de la etapa B se probó **de punta a punta en local contra una
rama Neon copia de producción**: postulación → correo verificado → cola de revisión →
rechazo con motivo → aprobación → página pública. Quedó todo bien, pero es una rama copia
y código sin desplegar: por eso esas filas están en 🟡 y no en ✅. Para pasarlas a ✅ hace
falta el despliegue, la migración en las cinco bases y que un jurado real se postule.

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
| A.1 | La foto va al bucket privado, con el hash en la clave | ✅ | ⬜ | 6 pruebas. Nunca se subió una foto real |
| A.2 | Ruta propia que sirve la foto, con cache permanente | ✅ | ⬜ | 4 pruebas. Sin probar contra R2 |
| A.3 | Los doce consumidores pasados al nuevo almacenamiento | ✅ | ⬜ | Incluye el directorio y la API pública |
| A.4 | El jurado sube y quita su propia foto | ✅ | ⬜ | Falta que un jurado real lo haga |
| A.5 | El registro acepta la invitación sin asignación previa | ✅ | ⬜ | 3 pruebas. La invitación que existe sigue sin aceptar |

<!-- avance: FotoRank jurados — Etapa B: el alta por cuenta propia -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| B.1 | Máquina de estados de la revisión | ✅ | 🟡 | 8 pruebas. El circuito entero corrió en vivo, pero contra una rama copia, no la base real |
| B.2 | Validación del formulario público | ✅ | 🟡 | 11 pruebas. El formulario se llenó y se envió de verdad en local |
| B.3 | Verificación del correo | ✅ | 🟡 | 10 pruebas. Verificado en vivo, incluido que el enlace no sirve dos veces |
| B.4 | Migración: estado de revisión y origen del alta | ✅ | ✅ | **Aplicada en las 5 bases el 21/09** y registrada en `_prisma_migrations`. Los 5 controles dieron lo esperado en cada una |
| B.5 | Los dos correos nuevos | ✅ | ⬜ | Se encolan, pero **ningún correo salió**: falta la clave de Resend |
| B.6 | La página `/jurados/postulacion` y su acción | ✅ | 🟡 | Un alta real quedó escrita: entra, no se publica sola, pidió el directorio sin estar listada |
| B.7 | La cola de revisión en Super Admin | ✅ | 🟡 | Rechazo con motivo y aprobación probados en vivo; la página pública aparece al aprobar |

<!-- avance: FotoRank jurados — Etapa C: el perfil completo -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| C.1 | El jurado carga sus URL, su Instagram y su teléfono | ✅ | 🟡 | 7 pruebas de los otros links. Los campos se ven y guardan en local |
| C.2 | La página pública respeta los interruptores de privacidad | ✅ | 🟡 | 6 pruebas. Verificado en vivo: al apagar la web y la ubicación, desaparecen |

<!-- avance: FotoRank jurados — Etapa D: los jurados en el concurso -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| D.1 | Retrato, titular y carrusel con más de seis | ✅ | 🟡 | 3 pruebas. Verificado en vivo con 1 jurado (grilla) y con 7 (carrusel con scroll real) |

<!-- avance: FotoRank jurados — Etapa E: la UX de jurados y usuarios -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| E.1 | Módulo que traduce cada estado al castellano | ⬜ | ⬜ | |
| E.2 | Fechas en lenguaje humano | ⬜ | ⬜ | |
| E.3 | Una sola tarjeta de jurado para todas las pantallas | ⬜ | ⬜ | |
| E.4 | Las cinco pantallas del organizador | ⬜ | ⬜ | |
| E.5 | Directorio, auditoría y portal del jurado | ⬜ | ⬜ | |
| E.6 | Super Admin: la cola y la sección de usuarios | ⬜ | ⬜ | Depende de B.7 |
| E.7 | Prueba que impide que vuelva a colarse un enum | ⬜ | ⬜ | |
