# Borrador automático al llegar una consulta web

Fecha: 08/10/2026 · Rama `feat/fotoffice-borrador-automatico` (apilada sobre `feat/fotoffice-plantillas-servicio`, PR 421) · Aprobado por Daniel en chat ("ok").

## 1. Para qué

Paso 3 del bot de ventas de DNX Estudio. Cuando entra una consulta por el formulario web de una
categoría que tiene propuesta modelo, el sistema arma solo el presupuesto **en borrador, sin
enviarlo** (productos al precio de lista de hoy + conceptos calculados con ¿Cuánto Cobro? y el
perfil de Configuración → Precios) y deja al responsable la tarea "Revisar y enviar el presupuesto".

## 2. Decisiones

1. **Interruptor por categoría** en una tabla nueva `FotofficePropuestaBorradorAuto`
   (`id`, `workspaceId`, `categoryId`, `createdAt`, `createdByUserId Int?`; único
   `(workspaceId, categoryId)`; FKs a `Workspace` y `FotofficeConsultaCategoria` con CASCADE). La
   fila existe = encendido. Tabla nueva (no columna) para que publicar el código antes del SQL no
   rompa `FotofficePropuestaModelo`. Migración `20261023100000_fotoffice_propuesta_borrador_auto`
   (posterior a `20261022120000_fotoffice_etapa_3_pedidos` de la otra sesión). Se aplica a mano.
2. **Tolerante a la tabla faltante**: leer el interruptor ante error devuelve "apagado" (y en la
   pantalla un aviso "Falta aplicar el SQL"); nunca rompe el alta ni la pantalla de propuestas.
3. **`armarBorradorDePropuesta(workspaceId, leadId, deps)`** en
   `lib/presupuestos/propuesta-automatica.ts`: reutiliza el mismo armado que `enviarPropuestaModelo`
   (consulta → categoría → propuesta → `itemsDeLaPropuesta` → `normalizarBorrador` → presupuesto
   del sistema con V1, responsable de los ajustes de Consultas o el dueño) **sin enviar**, y crea la
   tarea de revisión (`tareaDeRevision`, título `tituloDeRevision`). Se extrae la parte común a una
   función compartida; el envío automático no cambia de comportamiento. Resultado:
   `"ARMADO" | "NO_APLICA" | "YA_TIENE_PRESUPUESTO" | "FALLO" | "ERROR"`. Nunca lanza.
   - No arma si la consulta ya tiene un presupuesto (evita duplicados si se reintenta).
   - Exige el módulo Presupuestos encendido (como el envío).
4. **Alta (`lib/consultas/alta.ts`, paso 4, sólo WEB)**: si `enviarPropuestaModelo` no la envió
   (resultado distinto de `ENVIADA`/`ERROR_TRAS_ENVIO`), se intenta `armarBorradorDePropuesta`.
   La respuesta automática común sigue su regla de siempre (el borrador no se le manda a nadie).
   Aislado en try/catch como los otros pasos.
5. **Pantalla** (editor de la propuesta modelo): casilla "Armar el borrador cuando llega una
   consulta web (sin enviarlo)", con ayuda "Te queda una tarea para revisarlo y mandarlo". Se
   guarda con su propia acción (`configurar`). Si "Enviar sola" está encendido, la casilla se
   muestra deshabilitada con la aclaración "Ya sale sola".

## 3. Fuera de alcance

Ajustar las horas según los datos de la consulta (IA), consultas manuales o importadas.

## 4. Pruebas

Migración (una tabla, único, FKs); leer/guardar interruptor (permiso, tabla faltante → apagado);
`armarBorradorDePropuesta` (arma con LISTA+CALCULO sin enviar ni registrar correo, crea tarea,
no duplica, sin perfil → FALLO sin presupuesto, módulo apagado → NO_APLICA); alta WEB llama al
borrador sólo cuando no se envió; reglas de fuente de la pantalla; suite completa, typecheck, build.
