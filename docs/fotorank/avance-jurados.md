# FotoRank — Altas de jurados: avance de obra

*Última revisión: 2026-09-20.*

Mide el plan `docs/superpowers/plans/2026-09-20-fotorank-altas-de-jurados.md` y
`docs/superpowers/plans/2026-09-20-fotorank-ux-jurados-y-usuarios.md`, sobre el spec
`docs/superpowers/specs/2026-09-20-fotorank-altas-de-jurados-y-ux-design.md`.

Formato: [la convención](../00-convencion-de-avance.md). **Código** es escrito, probado y
mergeado. **Producción** es que corrió de verdad contra la base real y alguien lo miró.

**Nada de esto está en producción todavía.** En la base hay 0 cuentas de jurado, así que
ninguna pantalla nueva se puede verificar mirando datos reales: las pruebas son la única
red hasta que se cargue el primer jurado.

<!-- avance: FotoRank jurados — Paso 0: el padrón único -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| 0.1 | Poner la rama al día con `origin/main` | ✅ | 🚫 | Sin conflictos; recupera los 8 commits de la maratón del 19/9 |
| 0.2 | Verificar las 45 pruebas de jurado | ✅ | 🚫 | 5+8+17+6+9 en verde, más 43 chequeos de subida de fotos |
| 0.3 | Abrir el PR a `main` | ✅ | 🟡 | PR #202, 8 verificaciones en verde y sin conflictos. **Falta fusionarlo** |
| 0.4 | Cargar las 4 variables del jurado compartido | ⬜ | ⬜ | Sin ellas el código falla suave: FotoRank anda igual, sólo con sus concursos |

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
| B.1 | Máquina de estados de la revisión | ⬜ | ⬜ | |
| B.2 | Validación del formulario público | ⬜ | ⬜ | |
| B.3 | Verificación del correo | ⬜ | ⬜ | Reutiliza `EmailVerificationToken`, que ya está en las 5 bases |
| B.4 | Migración: estado de revisión y origen del alta | ⬜ | ⬜ | Hay que aplicarla a mano en las 5 bases Neon |
| B.5 | Los dos correos nuevos | ⬜ | ⬜ | |
| B.6 | La página `/jurados/postulacion` y su acción | ⬜ | ⬜ | Con tope por IP, campo trampa y tiempo mínimo |
| B.7 | La cola de revisión en Super Admin | ⬜ | ⬜ | |

<!-- avance: FotoRank jurados — Etapa C: el perfil completo -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| C.1 | El jurado carga sus URL, su Instagram y su teléfono | ⬜ | ⬜ | Hoy sólo puede el organizador |
| C.2 | La página pública respeta los interruptores de privacidad | ⬜ | ⬜ | Hoy los ignora: el directorio sí los respeta |

<!-- avance: FotoRank jurados — Etapa D: los jurados en el concurso -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| D.1 | Retrato, titular y carrusel con más de seis | ⬜ | ⬜ | La sección ya existe desde antes; esto la mejora |

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
